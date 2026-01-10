interface CacheItem<T> {
  data: T;
  timestamp: number;
  expireTime: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  totalSize: number;
}

export class CacheService {
  private cache = new Map<string, CacheItem<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default
  private maxEntries = 100;
  private stats: CacheStats = { hits: 0, misses: 0, entries: 0, totalSize: 0 };

  // Set cache with custom TTL and optional storage
  set<T>(key: string, data: T, ttlMs?: number, options?: { 
    persist?: boolean; 
    storage?: 'localStorage' | 'sessionStorage' 
  }): void {
    const ttl = ttlMs || this.defaultTTL;
    const now = Date.now();
    
    // Clean up if cache is full
    if (this.cache.size >= this.maxEntries) {
      this.cleanup();
    }
    
    const item: CacheItem<T> = {
      data,
      timestamp: now,
      expireTime: now + ttl
    };
    
    this.cache.set(key, item);
    this.updateStats();
    
    // Persist to storage if requested
    if (options?.persist) {
      this.persistToStorage(key, item, options.storage || 'sessionStorage');
    }
    
    console.log(`Cache SET: ${key} (TTL: ${ttl}ms, Size: ${this.cache.size})`);
  }

  // Get from cache with automatic expiration check and optional storage fallback
  get<T>(key: string, options?: { 
    fallback?: 'localStorage' | 'sessionStorage';
    allowStale?: boolean;
  }): T | null {
    const item = this.cache.get(key);
    
    if (!item && options?.fallback) {
      // Try storage fallback
      const stored = this.getFromStorage<T>(key, options.fallback);
      if (stored) {
        // Restore to memory cache
        this.cache.set(key, stored);
        this.stats.hits++;
        // PERFORMANCE: Do not log cache hits
        return stored.data as T;
      }
    }
    
    if (!item) {
      this.stats.misses++;
      // PERFORMANCE: Do not log cache misses
      return null;
    }
    
    const now = Date.now();
    if (now > item.expireTime) {
      if (options?.allowStale) {
        // PERFORMANCE: Do not log stale cache
        return item.data as T;
      }
      this.cache.delete(key);
      this.stats.misses++;
      // PERFORMANCE: Do not log expired cache
      return null;
    }
    
    this.stats.hits++;
    // PERFORMANCE: Do not log cache hits
    return item.data as T;
  }

  // Check if key exists and is not expired
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (Date.now() > item.expireTime) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  // Remove specific key
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    this.updateStats();
    return result;
  }

  // Clear all cache
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, entries: 0, totalSize: 0 };
  }

  // Get cache statistics
  getStats(): CacheStats {
    return { ...this.stats };
  }

  // Get cache hit ratio
  getHitRatio(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? this.stats.hits / total : 0;
  }

  // Update internal stats
  private updateStats(): void {
    this.stats.entries = this.cache.size;
    // Rough estimate of memory usage (not precise but good enough)
    this.stats.totalSize = this.cache.size * 1000; // Assume ~1KB per entry average
  }

  // Batch operations
  setMany<T>(entries: Array<{ key: string; data: T; ttl?: number }>): void {
    entries.forEach(({ key, data, ttl }) => {
      this.set(key, data, ttl);
    });
  }

  getMany<T>(keys: string[]): Map<string, T | null> {
    const results = new Map<string, T | null>();
    keys.forEach(key => {
      results.set(key, this.get<T>(key));
    });
    return results;
  }

  // Invalidate pattern-based keys
  invalidatePattern(pattern: string): number {
    let deleted = 0;
    const regex = new RegExp(pattern.replace('*', '.*'));
    
    // Clear from memory cache
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    
    // CRITICAL: Also clear from sessionStorage (fallback layer)
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const storageKey = sessionStorage.key(i);
        if (storageKey?.startsWith('cache:')) {
          const cacheKey = storageKey.substring(6); // Remove 'cache:' prefix
          if (regex.test(cacheKey)) {
            keysToRemove.push(storageKey);
          }
        }
      }
      
      // Remove matched keys from sessionStorage
      keysToRemove.forEach(key => {
        sessionStorage.removeItem(key);
        deleted++;
      });
      
      if (keysToRemove.length > 0) {
      }
    } catch (error) {
      console.warn('[Cache] Failed to clear sessionStorage:', error);
    }
    
    this.updateStats();
    console.log(`[Cache] INVALIDATE PATTERN: ${pattern} (${deleted} keys removed)`);
    return deleted;
  }

  // Warm up cache with preloaded data
  warmUp<T>(data: Array<{ key: string; value: T; ttl?: number }>): void {
    data.forEach(({ key, value, ttl }) => {
      this.set(key, value, ttl);
    });
  }

  // Clean up expired entries
  cleanup(): number {
    const before = this.cache.size;
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expireTime && entry.expireTime < now) {
        this.cache.delete(key);
        removed++;
      }
    }

    this.updateStats();
    console.log(`[Cache] CLEANUP: Removed ${removed} expired entries (${before} -> ${this.cache.size})`);
    return removed;
  }

  // Storage helper methods
  private persistToStorage<T>(key: string, item: CacheItem<T>, storage: 'localStorage' | 'sessionStorage'): void {
    try {
      const storageObj = storage === 'localStorage' ? localStorage : sessionStorage;
      storageObj.setItem(`cache:${key}`, JSON.stringify(item));
    } catch (error) {
      console.warn(`Failed to persist cache to ${storage}:`, error);
    }
  }

  private getFromStorage<T>(key: string, storage: 'localStorage' | 'sessionStorage'): CacheItem<T> | null {
    try {
      const storageObj = storage === 'localStorage' ? localStorage : sessionStorage;
      const stored = storageObj.getItem(`cache:${key}`);
      if (!stored) return null;
      
      const item = JSON.parse(stored) as CacheItem<T>;
      const now = Date.now();
      
      if (now > item.expireTime) {
        storageObj.removeItem(`cache:${key}`);
        return null;
      }
      
      return item;
    } catch (error) {
      console.warn(`Failed to get cache from ${storage}:`, error);
      return null;
    }
  }

  clearStorage(storage: 'localStorage' | 'sessionStorage', pattern?: string): void {
    try {
      const storageObj = storage === 'localStorage' ? localStorage : sessionStorage;
      const keys = Object.keys(storageObj);
      const cacheKeys = keys.filter(k => k.startsWith('cache:'));
      
      cacheKeys.forEach(key => {
        if (!pattern || key.includes(pattern)) {
          storageObj.removeItem(key);
        }
      });
    } catch (error) {
      console.warn(`Failed to clear ${storage}:`, error);
    }
  }
}

// Global cache instance
export const globalCache = new CacheService();

// Cache TTL constants for different data types
export const CACHE_TTL = {
  TEAMS_LIST: 5 * 60 * 1000,      // 5 minutes for teams list
  TEAM_DETAILS: 10 * 60 * 1000,   // 10 minutes for individual team details
  HIERARCHY: 5 * 60 * 1000,       // 5 minutes for hierarchy data
  DASHBOARD_STATS: 2 * 60 * 1000, // 2 minutes for dashboard stats
  MEMBERS: 15 * 60 * 1000,        // 15 minutes for team members (less likely to change)
  USER_DATA: 30 * 60 * 1000,      // 30 minutes for user profile data
  ADMIN_STATS: 3 * 60 * 1000,     // 3 minutes for admin stats
  ACTIVITY_LOGS: 1 * 60 * 1000,   // 1 minute for activity logs (frequently updated)
  SYSTEM_STATUS: 30 * 1000,       // 30 seconds for system status
} as const;

// Cache invalidation strategies
export const CACHE_STRATEGIES = {
  // Invalidate all admin-related cache when admin data changes
  ADMIN_DATA_CHANGE: () => {
    globalCache.invalidatePattern('admin:*');
  },
  
  // Invalidate user-related cache when user data changes
  USER_DATA_CHANGE: (userId?: string) => {
    if (userId) {
      globalCache.invalidatePattern(`user:${userId}*`);
    } else {
      globalCache.invalidatePattern('user:*');
    }
    globalCache.invalidatePattern('admin:users*');
  },
  
  // Invalidate customer-related cache when customer data changes
  CUSTOMER_DATA_CHANGE: (customerId?: string) => {
    if (customerId) {
      globalCache.invalidatePattern(`customer:${customerId}*`);
    } else {
      globalCache.invalidatePattern('customer:*');
    }
    globalCache.invalidatePattern('admin:customers*');
    globalCache.invalidatePattern('admin:stats*');
  },
  
  // Invalidate team-related cache when team assignments change
  TEAM_ASSIGNMENT_CHANGE: () => {
    globalCache.invalidatePattern('team:*');
    globalCache.invalidatePattern('admin:linear*');
    globalCache.invalidatePattern('admin:customers*');
    globalCache.invalidatePattern('admin:stats*');
  },
  
  // Full cache refresh strategy
  FULL_REFRESH: () => {
    globalCache.clear();
  },
  
  // Clear all cache strategy  
  CLEAR_ALL_CACHE: () => {
    globalCache.clear();
  }
} as const;

// Performance monitoring utilities
export const cachePerformance = {
  // Monitor cache performance and provide insights
  getPerformanceReport: () => {
    const stats = globalCache.getStats();
    const hitRatio = globalCache.getHitRatio();
    
    return {
      ...stats,
      hitRatio,
      efficiency: hitRatio > 0.8 ? 'excellent' : hitRatio > 0.6 ? 'good' : hitRatio > 0.4 ? 'fair' : 'poor',
      recommendations: generateCacheRecommendations(stats, hitRatio)
    };
  },
  
  // Log performance insights
  logPerformanceInsights: () => {
    const report = cachePerformance.getPerformanceReport();
    console.group('[Cache Performance Report]');
    console.log(`Hit Ratio: ${(report.hitRatio * 100).toFixed(1)}% (${report.efficiency})`);
    console.groupEnd();
  }
};

function generateCacheRecommendations(stats: any, hitRatio: number): string[] {
  const recommendations: string[] = [];
  
  if (hitRatio < 0.5) {
    recommendations.push('Consider increasing cache TTL for frequently accessed data');
    recommendations.push('Review data access patterns to optimize caching strategy');
  }
  
  if (stats.entries > 1000) {
    recommendations.push('Consider implementing cache size limits to prevent memory issues');
  }
  
  if (stats.misses > stats.hits * 2) {
    recommendations.push('High miss rate detected - review cache warming strategies');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Cache performance is optimal');
  }
  
  return recommendations;
}