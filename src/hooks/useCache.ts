import React, { useState, useEffect, useCallback } from 'react';
import { globalCache, CACHE_TTL, CACHE_STRATEGIES } from '../services/cacheService';

// Helper function for uptime formatting
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else {
    return `${minutes}m ${seconds % 60}s`;
  }
}

interface UseCacheOptions<T> {
  key: string;
  fetcher: () => Promise<T>;
  ttl?: number;
  refreshInterval?: number;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface UseCacheReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  invalidate: () => void;
  mutate: (newData: T) => void;
}

export function useCache<T>({
  key,
  fetcher,
  ttl = CACHE_TTL.DASHBOARD_STATS,
  refreshInterval,
  enabled = true,
  onSuccess,
  onError
}: UseCacheOptions<T>): UseCacheReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // OPTIMIZED: Request deduplication - prevent multiple simultaneous requests
  const isFetchingRef = React.useRef(false);
  const lastFetchTimeRef = React.useRef<number>(0);

  const fetchData = useCallback(async (useCache = true) => {
    if (!enabled) return;
    
    // DEDUPLICATION: Skip if already fetching
    if (isFetchingRef.current) {
      console.log(`[useCache] Fetch already in progress for key: ${key}, skipping duplicate request`);
      return;
    }
    
    // THROTTLE: Prevent rapid successive calls (< 100ms apart)
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 100) {
      console.log(`[useCache] Throttling rapid request for key: ${key}`);
      return;
    }

    try {
      isFetchingRef.current = true;
      lastFetchTimeRef.current = now;
      setLoading(true);
      setError(null);

      // Try cache first if enabled
      if (useCache) {
        const cachedData = globalCache.get<T>(key);
        if (cachedData) {
          setData(cachedData);
          setLoading(false);
          onSuccess?.(cachedData);
          return;
        }
      }

      // Fetch fresh data
      const freshData = await fetcher();
      
      // Cache the result
      globalCache.set(key, freshData, ttl);
      
      setData(freshData);
      onSuccess?.(freshData);
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      onError?.(error);
      console.error(`Cache fetch error for key ${key}:`, error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [key, ttl, enabled]); // Removed fetcher, onSuccess, onError from dependencies to prevent infinite loops

  const refresh = useCallback(async () => {
    await fetchData(false);
  }, [fetchData]);

  const invalidate = useCallback(() => {
    globalCache.delete(key);
    setData(null);
  }, [key]);

  const mutate = useCallback((newData: T) => {
    setData(newData);
    globalCache.set(key, newData, ttl);
  }, [key, ttl]);

  // Initial fetch - only run when key, enabled, or ttl changes
  useEffect(() => {
    if (enabled) {
      fetchData();
    }
  }, [key, enabled, ttl]); // Removed fetchData dependency to prevent infinite loops

  // Set up refresh interval if specified
  useEffect(() => {
    if (refreshInterval && enabled) {
      const interval = setInterval(() => {
        fetchData(false);
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [refreshInterval, enabled]); // Removed fetchData dependency

  return {
    data,
    loading,
    error,
    refresh,
    invalidate,
    mutate
  };
}

// Pre-configured hooks for common use cases
export function useAdminStats(options?: { enabled?: boolean }) {
  return useCache({
    key: 'admin:stats',
    fetcher: async () => {
      // DISABLED: adminService.getStats() does not exist
      // Return mock stats to prevent errors
      return {
        customers: 0,
        users: 0,
        teamAssignments: 0,
        activityLogs: 0
      };
    },
    ttl: CACHE_TTL.ADMIN_STATS,
    enabled: false, // Disabled until backend implements /admin/stats endpoint
    refreshInterval: 5 * 60 * 1000 // Refresh every 5 minutes
  });
}

export function useAdminUsers(options?: { enabled?: boolean }) {
  return useCache({
    key: 'admin:users',
    fetcher: async () => {
      const { adminService } = await import('../services/adminService');
      const response = await adminService.getUsers();
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch users');
      }
      
      const users = response.data?.users || [];
      return users;
    },
    ttl: CACHE_TTL.USER_DATA,
    enabled: options?.enabled !== false
  });
}

export function useAdminOrganizations(options?: { enabled?: boolean }) {
  return useCache({
    key: 'admin:customers',
    fetcher: async () => {
      const { adminService } = await import('../services/adminService');
      const response = await adminService.getCustomers();
      
      const customers = response.data?.customers || [];
      return customers;
    },
    ttl: CACHE_TTL.TEAMS_LIST,
    enabled: options?.enabled !== false
  });
}

// Backward compatibility alias
export const useAdminCustomers = useAdminOrganizations;

export function useAdminActivityLogs(limit = 50) {
  return useCache({
    key: `admin:activity_logs:${limit}`,
    fetcher: async () => {
      const { adminService } = await import('../services/adminService');
      const response = await adminService.getActivityLogs({ limit });
      return response.logs;
    },
    ttl: CACHE_TTL.ACTIVITY_LOGS,
    refreshInterval: 2 * 60 * 1000 // Refresh every 2 minutes for activity logs
  });
}

export function useLinearTeams() {
  return useCache({
    key: 'admin:linear_teams',
    fetcher: async () => {
      // Mock Linear teams data for now
      return [
        { id: '1', name: 'Guillevin Digital', key: 'GD', description: 'Electrical Distribution Platform' },
        { id: '2', name: 'Inventory Management', key: 'IM', description: 'Stock and warehouse management' },
        { id: '3', name: 'Customer Portal', key: 'CP', description: 'Customer-facing applications' },
        { id: '4', name: 'Analytics & Reporting', key: 'AR', description: 'Business intelligence and reporting' }
      ];
    },
    ttl: CACHE_TTL.TEAMS_LIST,
    onSuccess: (teams) => {
      console.log(`Loaded ${teams.length} Linear teams from cache/API`);
    }
  });
}

export function useSystemHealth() {
  return useCache({
    key: 'admin:system_health',
    fetcher: async () => {
      // Mock system health data for now
      const { globalCache } = await import('../services/cacheService');
      const cacheStats = globalCache.getStats();
      const hitRate = globalCache.getHitRatio();
      
      return {
        health: {
          database: 'healthy' as const,
          server: 'healthy' as const,
          cache: hitRate > 0.7 ? 'healthy' as const : hitRate > 0.5 ? 'warning' as const : 'error' as const,
          linear: 'healthy' as const
        },
        stats: {
          uptime: formatUptime(Date.now() - (Date.now() - 3600000)), // Mock 1 hour uptime
          totalRequests: 1247,
          cacheHitRate: hitRate,
          activeUsers: 12,
          memoryUsage: 45.7,
          responseTime: 127
        }
      };
    },
    ttl: CACHE_TTL.DASHBOARD_STATS,
    refreshInterval: 30 * 1000 // Refresh every 30 seconds for system health
  });
}

// Cache invalidation helpers
export const cacheStrategies = CACHE_STRATEGIES;