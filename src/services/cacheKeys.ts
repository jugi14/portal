/**
 * Centralized Cache Key Management
 *
 * Following DRY principle: Single source of truth for cache keys
 * Benefits:
 * - Consistent naming convention
 * - Easy pattern-based invalidation
 * - Type-safe cache keys
 * - Self-documenting cache structure
 * - Prevent cache key collisions
 */

/**
 * Cache key prefix for all Linear-related data
 */
const LINEAR_PREFIX = "linear" as const;

/**
 * Cache TTL constants (in milliseconds)
 */
export const CACHE_TTL = {
  SHORT: 1 * 60 * 1000, // 1 minute
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 15 * 60 * 1000, // 15 minutes
  VERY_LONG: 60 * 60 * 1000, // 1 hour
} as const;

/**
 * Default TTL for different resource types
 */
export const DEFAULT_TTL = {
  TEAMS: CACHE_TTL.VERY_LONG, // Teams change rarely
  TEAM_CONFIG: CACHE_TTL.LONG, // States, labels, etc
  ISSUES: CACHE_TTL.MEDIUM, // Issues change frequently
  ISSUE_DETAIL: CACHE_TTL.MEDIUM, // Issue details
  COMMENTS: CACHE_TTL.SHORT, // Comments may update quickly
  CUSTOMERS: CACHE_TTL.VERY_LONG, // Customer data changes rarely
  USERS: CACHE_TTL.VERY_LONG, // User data changes rarely
} as const;

/**
 * Centralized cache keys
 * Format: {resource}:{id}:{subresource}
 */
export const CACHE_KEYS = {
  /**
   * Team-related cache keys
   */
  team: (teamId: string) => `${LINEAR_PREFIX}:team:${teamId}` as const,

  teamConfig: (teamId: string) =>
    `${LINEAR_PREFIX}:team:${teamId}:config` as const,

  teamIssues: (teamId: string) =>
    `${LINEAR_PREFIX}:team:${teamId}:issues` as const,

  teamMembers: (teamId: string) =>
    `${LINEAR_PREFIX}:team:${teamId}:members` as const,

  teamStates: (teamId: string) =>
    `${LINEAR_PREFIX}:team:${teamId}:states` as const,

  teamLabels: (teamId: string) =>
    `${LINEAR_PREFIX}:team:${teamId}:labels` as const,

  teamProjects: (teamId: string) =>
    `${LINEAR_PREFIX}:team:${teamId}:projects` as const,

  teamCycles: (teamId: string) =>
    `${LINEAR_PREFIX}:team:${teamId}:cycles` as const,

  /**
   * Issue-related cache keys
   */
  issue: (issueId: string) => `${LINEAR_PREFIX}:issue:${issueId}` as const,

  issueDetail: (issueId: string) =>
    `${LINEAR_PREFIX}:issue:${issueId}:detail` as const,

  issueComments: (issueId: string) =>
    `${LINEAR_PREFIX}:issue:${issueId}:comments` as const,

  issueChildren: (issueId: string) =>
    `${LINEAR_PREFIX}:issue:${issueId}:children` as const,

  issueAttachments: (issueId: string) =>
    `${LINEAR_PREFIX}:issue:${issueId}:attachments` as const,

  /**
   * Composite cache keys (filtered/scoped data)
   */
  teamIssuesInState: (teamId: string, stateId: string) =>
    `${LINEAR_PREFIX}:team:${teamId}:state:${stateId}:issues` as const,

  teamIssuesInProject: (teamId: string, projectId: string) =>
    `${LINEAR_PREFIX}:team:${teamId}:project:${projectId}:issues` as const,

  teamIssuesInCycle: (teamId: string, cycleId: string) =>
    `${LINEAR_PREFIX}:team:${teamId}:cycle:${cycleId}:issues` as const,

  teamIssuesByAssignee: (teamId: string, assigneeId: string) =>
    `${LINEAR_PREFIX}:team:${teamId}:assignee:${assigneeId}:issues` as const,

  /**
   * Customer-related cache keys
   */
  customer: (customerId: string) => `customer:${customerId}` as const,

  customerTeams: (customerId: string) =>
    `customer:${customerId}:teams` as const,

  customerMembers: (customerId: string) =>
    `customer:${customerId}:members` as const,

  customerUsers: (customerId: string) =>
    `customer:${customerId}:users` as const,

  /**
   * User-related cache keys
   */
  user: (userId: string) => `user:${userId}` as const,

  userPermissions: (userId: string) => `user:${userId}:permissions` as const,

  userTeams: (userId: string) => `user:${userId}:teams` as const,

  userCustomers: (userId: string) => `user:${userId}:customers` as const,

  /**
   * Admin/System cache keys
   */
  allTeams: () => `${LINEAR_PREFIX}:teams:all` as const,

  allCustomers: () => `customers:all` as const,

  allUsers: () => `users:all` as const,

  systemConfig: () => `system:config` as const,

  /**
   * Pattern-based invalidation keys
   * Use with linearCache.invalidatePattern()
   */
  patterns: {
    team: (teamId: string) => `${LINEAR_PREFIX}:team:${teamId}:*` as const,

    issue: (issueId: string) => `${LINEAR_PREFIX}:issue:${issueId}:*` as const,

    customer: (customerId: string) => `customer:${customerId}:*` as const,

    user: (userId: string) => `user:${userId}:*` as const,

    allTeams: () => `${LINEAR_PREFIX}:team:*` as const,

    allIssues: () => `${LINEAR_PREFIX}:issue:*` as const,

    allLinear: () => `${LINEAR_PREFIX}:*` as const,
  },
} as const;

/**
 * Helper functions for cache invalidation
 */
export const cacheInvalidation = {
  /**
   * Invalidate all cache for a specific team
   */
  invalidateTeam(teamId: string): string {
    return CACHE_KEYS.patterns.team(teamId);
  },

  /**
   * Invalidate all cache for a specific issue
   */
  invalidateIssue(issueId: string): string {
    return CACHE_KEYS.patterns.issue(issueId);
  },

  /**
   * Invalidate all cache for a specific customer
   */
  invalidateCustomer(customerId: string): string {
    return CACHE_KEYS.patterns.customer(customerId);
  },

  /**
   * Invalidate all cache for a specific user
   */
  invalidateUser(userId: string): string {
    return CACHE_KEYS.patterns.user(userId);
  },

  /**
   * Invalidate all Linear-related cache
   */
  invalidateAllLinear(): string {
    return CACHE_KEYS.patterns.allLinear();
  },
};

/**
 * Type-safe cache key builder
 * Use when you need dynamic cache keys with type safety
 */
export function buildCacheKey<T extends keyof typeof CACHE_KEYS>(
  resource: T,
  ...params: Parameters<(typeof CACHE_KEYS)[T]>
): string {
  // @ts-ignore - Dynamic parameter types
  return CACHE_KEYS[resource](...params);
}

/**
 * Usage examples:
 *
 * // Basic usage
 * const key = CACHE_KEYS.teamIssues('team-123');
 * // Result: 'linear:team:team-123:issues'
 *
 * // With useCache hook
 * const { data, loading } = useCache(
 *   CACHE_KEYS.teamConfig(teamId),
 *   () => linearService.getTeamConfig(teamId),
 *   { ttl: DEFAULT_TTL.TEAM_CONFIG }
 * );
 *
 * // Invalidate pattern
 * linearCache.invalidatePattern(CACHE_KEYS.patterns.team(teamId));
 *
 * // Or use helper
 * linearCache.invalidatePattern(cacheInvalidation.invalidateTeam(teamId));
 *
 * // Type-safe builder
 * const key = buildCacheKey('teamIssues', 'team-123');
 */
