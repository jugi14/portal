/**
 * Linear API Caching Service
 * 
 * Aggressive caching strategy to reduce Linear API calls and avoid rate limits
 * Rate Limit: 1500 requests per hour
 * 
 * Strategy:
 * - Long TTL for static data (teams, users): 30 minutes
 * - Medium TTL for issues: 5 minutes
 * - Short TTL for real-time data: 1 minute
 * - Stale-while-revalidate pattern
 * - Smart invalidation on mutations
 */

import { projectId } from '../utils/supabase/info';
import { fetchWithRateLimit } from '../utils/rateLimitHandler';
import { secureTokenStorage } from './secureTokenStorage';
import { apiClient } from './apiClient';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  staleAt: number; // When to show stale but trigger refresh
}

interface CacheStats {
  hits: number;
  misses: number;
  staleHits: number;
  size: number;
}

class LinearCacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private pendingRequests: Map<string, Promise<any>> = new Map();
  private stats: CacheStats = { hits: 0, misses: 0, staleHits: 0, size: 0 };
  
  // TTL Configuration (in milliseconds)
  private readonly TTL = {
    TEAMS: 30 * 60 * 1000,           // 30 minutes - teams rarely change
    TEAM_DETAILS: 30 * 60 * 1000,    // 30 minutes
    WORKFLOWS: 30 * 60 * 1000,       // 30 minutes - workflows stable
    USERS: 30 * 60 * 1000,           // 30 minutes
    ISSUES_BY_STATE: 5 * 60 * 1000,  // 5 minutes - issues change frequently
    ISSUE_DETAIL: 3 * 60 * 1000,     // 3 minutes
    PROJECTS: 15 * 60 * 1000,        // 15 minutes
  };
  
  // Stale time: show cached data but trigger background refresh
  private readonly STALE_TIME = {
    TEAMS: 15 * 60 * 1000,           // Stale after 15 min
    TEAM_DETAILS: 15 * 60 * 1000,
    WORKFLOWS: 15 * 60 * 1000,
    USERS: 15 * 60 * 1000,
    ISSUES_BY_STATE: 2 * 60 * 1000,  // Stale after 2 min
    ISSUE_DETAIL: 1 * 60 * 1000,     // Stale after 1 min
    PROJECTS: 10 * 60 * 1000,
  };
  
  constructor() {
    // Persist cache to localStorage for cross-tab sharing
    this.loadFromLocalStorage();
    
    // Auto-cleanup expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
    
    // Log cache stats every minute
    setInterval(() => this.logStats(), 60 * 1000);
  }
  
  /**
   * Generate cache key - FIXED: Use simple string format instead of JSON
   * CRITICAL: Keys must be predictable for invalidation to work
   */
  private getCacheKey(endpoint: string, params?: Record<string, any>): string {
    if (!params || Object.keys(params).length === 0) {
      return `linear:${endpoint}`;
    }
    
    // Create predictable key from params (sorted alphabetically)
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join(':');
    
    return `linear:${endpoint}:${sortedParams}`;
  }
  
  /**
   * Get tags for cache entry (for easier invalidation)
   */
  private getTags(endpoint: string, params?: Record<string, any>): string[] {
    const tags: string[] = [endpoint];
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        tags.push(`${key}:${value}`);
      });
    }
    
    return tags;
  }
  
  /**
   * Get from cache with stale-while-revalidate
   * Enhanced with issue cache safety checks
   */
  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number,
    staleTime: number
  ): Promise<T> {
    const entry = this.cache.get(key);
    const now = Date.now();
    
    // SAFETY: Check if page is hidden - don't use stale cache for issues
    const isIssueCacheKey = key.includes('issues-by-state') || key.includes('issue-detail');
    if (isIssueCacheKey && document.hidden) {
      // PERFORMANCE: Skip cache for hidden page
      this.stats.misses++;
      return this.fetchAndCache(key, fetcher, ttl, staleTime);
    }
    
    // Cache hit - fresh data
    if (entry && now < entry.expiresAt) {
      this.stats.hits++;
      // PERFORMANCE: Cache hit (fresh)
      return entry.data;
    }
    
    // Cache hit - stale data (show immediately, refresh in background)
    // CRITICAL: For issues cache, NEVER use stale data (too risky for state changes)
    if (entry && now < entry.staleAt) {
      // Issues cache: treat as MISS if stale (force fresh fetch)
      if (isIssueCacheKey) {
        this.stats.misses++;
        // PERFORMANCE: Stale issues not allowed, fetching fresh
        return this.fetchAndCache(key, fetcher, ttl, staleTime);
      }
      
      // Other cache: use stale-while-revalidate
      this.stats.staleHits++;
      // PERFORMANCE: Cache hit (stale), refreshing in background
      
      // Trigger background refresh (don't await)
      this.refreshInBackground(key, fetcher, ttl, staleTime).catch(err => {
        console.warn(`[LinearCache] Background refresh failed for ${key}:`, err);
      });
      
      return entry.data;
    }
    
    // Cache miss or expired - fetch fresh data
    this.stats.misses++;
    // PERFORMANCE: Cache miss
    
    // Prevent duplicate requests (request coalescing)
    if (this.pendingRequests.has(key)) {
      // PERFORMANCE: Request already pending, waiting
      return this.pendingRequests.get(key)!;
    }
    
    const promise = this.fetchAndCache(key, fetcher, ttl, staleTime);
    this.pendingRequests.set(key, promise);
    
    try {
      return await promise;
    } finally {
      this.pendingRequests.delete(key);
    }
  }
  
  /**
   * Fetch and cache data
   */
  private async fetchAndCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number,
    staleTime: number
  ): Promise<T> {
    const data = await fetcher();
    const now = Date.now();
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + ttl,
      staleAt: now + staleTime
    };
    
    this.cache.set(key, entry);
    this.stats.size = this.cache.size;
    
    // Persist important data to localStorage
    this.saveToLocalStorage(key, entry);
    
    return data;
  }
  
  /**
   * Refresh data in background (stale-while-revalidate)
   */
  private async refreshInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number,
    staleTime: number
  ): Promise<void> {
    try {
      await this.fetchAndCache(key, fetcher, ttl, staleTime);
      // PERFORMANCE: Background refresh completed
    } catch (error) {
      console.warn(`[LinearCache] Background refresh failed for ${key}:`, error);
      // Keep stale data on error
    }
  }
  
  /**
   * Invalidate specific cache keys
   */
  invalidate(pattern: string | RegExp): void {
    const keys = Array.from(this.cache.keys());
    const toDelete: string[] = [];
    
    keys.forEach(key => {
      if (typeof pattern === 'string') {
        if (key.includes(pattern)) {
          toDelete.push(key);
        }
      } else {
        if (pattern.test(key)) {
          toDelete.push(key);
        }
      }
    });
    
    toDelete.forEach(key => {
      this.cache.delete(key);
      localStorage.removeItem(key);
    });
    
    // PERFORMANCE: Invalidated cache entries
    this.stats.size = this.cache.size;
  }
  
  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, staleHits: 0, size: 0 };
    
    // Clear localStorage cache
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('linear:')) {
        localStorage.removeItem(key);
      }
    });
    
    // PERFORMANCE: Cache cleared
  }
  
  /**
   * Clear cache for a specific team
   * CRITICAL: Call when navigating between teams to ensure fresh data
   */
  clearTeamCache(teamId: string): void {
    let removed = 0;
    
    // Clear in-memory cache
    this.cache.forEach((entry, key) => {
      if (key.includes(teamId)) {
        this.cache.delete(key);
        removed++;
      }
    });
    
    // Clear localStorage cache
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('linear:') && key.includes(teamId)) {
        localStorage.removeItem(key);
      }
    });
    
    // Clear sessionStorage cache
    const sessionKeys = Object.keys(sessionStorage);
    sessionKeys.forEach(key => {
      if (key.includes(teamId)) {
        sessionStorage.removeItem(key);
      }
    });
    
    // PERFORMANCE: Cleared cache for team
    this.stats.size = this.cache.size;
  }
  
  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    
    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt + 60000) { // Keep for 1 min past expiry
        this.cache.delete(key);
        localStorage.removeItem(key);
        removed++;
      }
    });
    
    if (removed > 0) {
      this.stats.size = this.cache.size;
    }
  }
  
  /**
   * Save to localStorage for persistence
   * CRITICAL: DO NOT cache issues to localStorage (they change too frequently)
   */
  private saveToLocalStorage(key: string, entry: CacheEntry<any>): void {
    try {
      // Only cache STATIC data to localStorage (not issues which change frequently)
      // DO NOT cache: issues-by-state, issue-detail (too dynamic)
      // Cache: teams, workflows, users (rarely change)
      if (key.includes('teams') || key.includes('workflows') || key.includes('users')) {
        // Skip issue-related keys
        if (!key.includes('issues') && !key.includes('issue-detail')) {
          localStorage.setItem(key, JSON.stringify(entry));
        }
      }
    } catch (error) {
      // Ignore localStorage errors (quota exceeded, etc.)
      console.warn('Failed to save to localStorage:', error);
    }
  }
  
  /**
   * Load from localStorage on init
   * CRITICAL: Clean up stale issue caches that may have been mistakenly saved
   */
  private loadFromLocalStorage(): void {
    try {
      const keys = Object.keys(localStorage);
      let loaded = 0;
      let cleaned = 0;
      
      keys.forEach(key => {
        if (key.startsWith('linear:')) {
          // CRITICAL: Remove any issue-related cache from localStorage
          // (these should NEVER be persisted due to frequent changes)
          if (key.includes('issues-by-state') || key.includes('issue-detail')) {
            localStorage.removeItem(key);
            cleaned++;
            return;
          }
          
          try {
            const entry = JSON.parse(localStorage.getItem(key)!);
            const now = Date.now();
            
            // Only load if not expired
            if (entry.expiresAt > now) {
              this.cache.set(key, entry);
              loaded++;
            } else {
              localStorage.removeItem(key);
              cleaned++;
            }
          } catch {
            localStorage.removeItem(key);
            cleaned++;
          }
        }
      });
      
      if (loaded > 0) {
      }
      if (cleaned > 0) {
      }
      this.stats.size = this.cache.size;
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
    }
  }
  
  /**
   * Log cache statistics
   */
  private logStats(): void {
    const total = this.stats.hits + this.stats.misses;
    if (total === 0) return;
    
    const hitRate = ((this.stats.hits + this.stats.staleHits) / total * 100).toFixed(1);
    const freshRate = (this.stats.hits / total * 100).toFixed(1);
    const staleRate = (this.stats.staleHits / total * 100).toFixed(1);
    
    console.log(`[LinearCache] Stats: ${hitRate}% hit rate (${freshRate}% fresh, ${staleRate}% stale) | ${this.stats.size} entries`);
  }
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits + this.stats.staleHits) / total : 0;
    
    return {
      ...this.stats,
      hitRate
    };
  }
  
  // ========================================
  // Linear API Specific Methods
  // ========================================
  
  /**
   * Get teams with caching
   */
  async getTeams(organizationId: string): Promise<any> {
    const key = this.getCacheKey('teams', { organizationId });
    
    return this.get(
      key,
      async () => {
        const url = `https://${projectId}.supabase.co/functions/v1/make-server-7f0d90fb/linear/teams`;
        const accessToken = secureTokenStorage.getToken();
        
        if (!accessToken) {
          throw new Error('Authentication required. Please login to continue.');
        }
        
        const response = await fetchWithRateLimit(url, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch teams: ${response.statusText}`);
        }
        
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch teams');
        }
        
        return result.data;
      },
      this.TTL.TEAMS,
      this.STALE_TIME.TEAMS
    );
  }
  
  /**
   * Get team details with caching
   */
  async getTeamDetails(teamId: string): Promise<any> {
    const key = this.getCacheKey('team-details', { teamId });
    
    return this.get(
      key,
      async () => {
        const url = `https://${projectId}.supabase.co/functions/v1/make-server-7f0d90fb/linear/teams/${teamId}`;
        const response = await fetchWithRateLimit(url, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch team details: ${response.statusText}`);
        }
        
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch team details');
        }
        
        return result.data;
      },
      this.TTL.TEAM_DETAILS,
      this.STALE_TIME.TEAM_DETAILS
    );
  }
  
  /**
   * DEPRECATED: Use apiClient.get('/linear/teams/:teamId/issues-by-state') instead
   * Get issues by state with caching
   * CRITICAL: Use shorter TTL and NO stale data for issues (they change frequently)
   */
  async getIssuesByState(teamId: string): Promise<any> {
    console.warn('DEPRECATED: linearCache.getIssuesByState() is deprecated. Use apiClient.get("/linear/teams/:teamId/issues-by-state") instead');
    const key = this.getCacheKey('issues-by-state', { teamId });
    
    // For issues, use FRESH-only strategy (no stale-while-revalidate)
    return this.get(
      key,
      async () => {
        const url = `https://${projectId}.supabase.co/functions/v1/make-server-7f0d90fb/linear/teams/${teamId}/issues/by-state`;
        const accessToken = secureTokenStorage.getToken();
        
        if (!accessToken) {
          throw new Error('Authentication required. Please login to continue.');
        }
        
        const response = await fetchWithRateLimit(url, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch issues: ${response.statusText}`);
        }
        
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch issues');
        }
        
        return result.data;
      },
      this.TTL.ISSUES_BY_STATE,
      // CRITICAL: Set staleTime = TTL to disable stale-while-revalidate for issues
      this.TTL.ISSUES_BY_STATE // No stale data for issues
    );
  }
  
  /**
   * Get issue detail with caching
   */
  async getIssueDetail(issueId: string): Promise<any> {
    const key = this.getCacheKey('issue-detail', { issueId });
    
    return this.get(
      key,
      async () => {
        // Use secure token storage (validates expiry automatically)
        const accessToken = apiClient.getAccessToken();
        if (!accessToken) {
          throw new Error('No access token available - user may not be logged in or token expired');
        }
        
        const url = `https://${projectId}.supabase.co/functions/v1/make-server-7f0d90fb/linear/issues/${issueId}`;
        const response = await fetchWithRateLimit(url, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch issue detail: ${response.statusText}`);
        }
        
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch issue detail');
        }
        
        return result.data;
      },
      this.TTL.ISSUE_DETAIL,
      this.STALE_TIME.ISSUE_DETAIL
    );
  }
  
  /**
   * Invalidate issues cache after mutation
   * FIXED: Use correct key patterns that match getCacheKey() format
   * AGGRESSIVE: Clear both memory + localStorage + pendingRequests immediately
   */
  invalidateIssues(teamId?: string): void {
    if (teamId) {
      // Clear specific team's issues - FIX: Match getCacheKey format
      // Key format: linear:issues-by-state:teamId:<id>
      const issuesPattern = `linear:issues-by-state:teamId:${teamId}`;
      this.invalidate(issuesPattern);
      
      // Also invalidate all issue details (they may belong to this team)
      this.invalidate('linear:issue-detail');
      
      // CRITICAL: Clear from pendingRequests to prevent serving stale in-flight data
      const pendingKeys = Array.from(this.pendingRequests.keys());
      pendingKeys.forEach(key => {
        if (key.includes(`teamId:${teamId}`) || key.includes('issue-detail')) {
          this.pendingRequests.delete(key);
        }
      });
    } else {
      // Clear all issues
      this.invalidate('linear:issues-by-state');
      this.invalidate('linear:issue-detail');
      
      // Clear all pending issue requests
      const pendingKeys = Array.from(this.pendingRequests.keys());
      pendingKeys.forEach(key => {
        if (key.includes('issues-by-state') || key.includes('issue-detail')) {
          this.pendingRequests.delete(key);
        }
      });
    }
  }
  
  /**
   * Invalidate team cache - FIXED: Use correct key patterns
   */
  invalidateTeam(teamId?: string): void {
    if (teamId) {
      // Key format: linear:team-details:teamId:<id>
      this.invalidate(`linear:team-details:teamId:${teamId}`);
    } else {
      this.invalidate('linear:teams');
      this.invalidate('linear:team-details');
    }
  }
  
  /**
   * Fetch with network-only mode (bypass cache)
   * Use this after mutations to ensure fresh data
   */
  async fetchNetworkOnly<T>(
    endpoint: string,
    params: Record<string, any>,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const key = this.getCacheKey(endpoint, params);
    
    // Delete from cache to force fresh fetch
    this.cache.delete(key);
    this.pendingRequests.delete(key);
    localStorage.removeItem(key);
    // Fetch fresh data (will be cached automatically)
    const ttl = endpoint.includes('issues') 
      ? this.TTL.ISSUES_BY_STATE 
      : this.TTL.TEAM_DETAILS;
    const staleTime = endpoint.includes('issues')
      ? this.TTL.ISSUES_BY_STATE
      : this.STALE_TIME.TEAM_DETAILS;
    
    return this.fetchAndCache(key, fetcher, ttl, staleTime);
  }
}

// Singleton instance
export const linearCache = new LinearCacheService();

// Make linearCache available in dev console for debugging
(window as any).linearCache = linearCache;

// PERFORMANCE: Linear Cache Service initialized - removed verbose console.log per Guidelines.md