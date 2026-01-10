/**
 * Cache Invalidation Utilities
 * 
 * Centralized cache invalidation patterns for maintaining data consistency
 * after mutations. Ensures all affected caches are cleared when data changes.
 * 
 * GUIDELINES COMPLIANCE:
 * - DRY: Single source of truth for invalidation patterns
 * - KISS: Simple, predictable API
 * - Performance: Prevents stale data bugs
 * - Maintainability: Clear, documented invalidation rules
 */

import { globalCache } from '../services/cacheService';

/**
 * Cache Invalidation Helpers
 * 
 * Call these after mutations to ensure data consistency across components
 * that use cached data (AdminOverview, AdminPermissions, etc.)
 */
export const invalidateCacheAfter = {
  /**
   * User created
   * Invalidates: user list, admin stats
   */
  userCreated: () => {
    console.log('[Cache Invalidation] User created - clearing admin:users, admin:stats');
    globalCache.delete('admin:users');
    globalCache.delete('admin:stats');
  },

  /**
   * User updated
   * Invalidates: user list, user permissions
   */
  userUpdated: (userId: string) => {
    console.log(`[Cache Invalidation] User updated (${userId}) - clearing admin:users, permissions`);
    globalCache.delete('admin:users');
    globalCache.deletePattern(`permissions:${userId}*`);
  },

  /**
   * User deleted
   * Invalidates: user list, admin stats, team hierarchy (user assignments removed)
   */
  userDeleted: (userId: string) => {
    console.log(`[Cache Invalidation] User deleted (${userId}) - clearing admin:users, admin:stats, team-hierarchy`);
    globalCache.delete('admin:users');
    globalCache.delete('admin:stats');
    globalCache.deletePattern('team-hierarchy:*');
  },

  /**
   * Customer created
   * Invalidates: customer list, admin stats
   */
  customerCreated: () => {
    console.log('[Cache Invalidation] Customer created - clearing admin:customers, admin:stats');
    globalCache.delete('admin:customers');
    globalCache.delete('admin:stats');
  },

  /**
   * Customer updated
   * Invalidates: customer list
   */
  customerUpdated: (customerId: string) => {
    console.log(`[Cache Invalidation] Customer updated (${customerId}) - clearing admin:customers`);
    globalCache.delete('admin:customers');
  },

  /**
   * Customer deleted
   * Invalidates: customer list, admin stats, team hierarchy
   */
  customerDeleted: (customerId: string) => {
    console.log(`[Cache Invalidation] Customer deleted (${customerId}) - clearing admin:customers, admin:stats, team-hierarchy`);
    globalCache.delete('admin:customers');
    globalCache.delete('admin:stats');
    globalCache.deletePattern('team-hierarchy:*');
  },

  /**
   * Team assigned to user
   * Invalidates: team hierarchy, user list (user's teams changed)
   */
  teamAssigned: (userId: string, teamId: string) => {
    console.log(`[Cache Invalidation] Team assigned (user: ${userId}, team: ${teamId}) - clearing team-hierarchy, admin:users`);
    globalCache.deletePattern('team-hierarchy:*');
    globalCache.delete('admin:users');
  },

  /**
   * Team unassigned from user
   * Invalidates: team hierarchy, user list
   */
  teamUnassigned: (userId: string, teamId: string) => {
    console.log(`[Cache Invalidation] Team unassigned (user: ${userId}, team: ${teamId}) - clearing team-hierarchy, admin:users`);
    globalCache.deletePattern('team-hierarchy:*');
    globalCache.delete('admin:users');
  },

  /**
   * Issue state changed (e.g., moved in Kanban)
   * Invalidates: team issues, issue detail
   */
  issueStateChanged: (teamId: string, issueId: string) => {
    console.log(`[Cache Invalidation] Issue state changed (team: ${teamId}, issue: ${issueId}) - clearing team-issues, issue-detail`);
    globalCache.deletePattern(`team-issues:${teamId}*`);
    globalCache.delete(`issue-detail:${issueId}`);
    // Also clear Linear cache for this team
    globalCache.deletePattern(`linear:issue-detail:issueId:${issueId}*`);
  },

  /**
   * Sub-issue created
   * Invalidates: team issues, parent issue detail
   */
  subIssueCreated: (teamId: string, parentIssueId: string) => {
    console.log(`[Cache Invalidation] Sub-issue created (team: ${teamId}, parent: ${parentIssueId}) - clearing team-issues, issue-detail`);
    globalCache.deletePattern(`team-issues:${teamId}*`);
    globalCache.delete(`issue-detail:${parentIssueId}`);
    // Also clear Linear cache
    globalCache.deletePattern(`linear:issue-detail:issueId:${parentIssueId}*`);
  },

  /**
   * Issue updated (title, description, etc.)
   * Invalidates: team issues, issue detail
   */
  issueUpdated: (teamId: string, issueId: string) => {
    console.log(`[Cache Invalidation] Issue updated (team: ${teamId}, issue: ${issueId}) - clearing team-issues, issue-detail`);
    globalCache.deletePattern(`team-issues:${teamId}*`);
    globalCache.delete(`issue-detail:${issueId}`);
    globalCache.deletePattern(`linear:issue-detail:issueId:${issueId}*`);
  },

  /**
   * Issue deleted
   * Invalidates: team issues
   */
  issueDeleted: (teamId: string, issueId: string) => {
    console.log(`[Cache Invalidation] Issue deleted (team: ${teamId}, issue: ${issueId}) - clearing team-issues`);
    globalCache.deletePattern(`team-issues:${teamId}*`);
    globalCache.delete(`issue-detail:${issueId}`);
    globalCache.deletePattern(`linear:issue-detail:issueId:${issueId}*`);
  },

  /**
   * Comment added to issue
   * Invalidates: issue detail only (comments are part of issue detail)
   */
  commentAdded: (issueId: string) => {
    console.log(`[Cache Invalidation] Comment added (issue: ${issueId}) - clearing issue-detail`);
    globalCache.delete(`issue-detail:${issueId}`);
    globalCache.deletePattern(`linear:issue-detail:issueId:${issueId}*`);
  },

  /**
   * Attachment uploaded to issue
   * Invalidates: issue detail
   */
  attachmentUploaded: (issueId: string) => {
    console.log(`[Cache Invalidation] Attachment uploaded (issue: ${issueId}) - clearing issue-detail`);
    globalCache.delete(`issue-detail:${issueId}`);
    globalCache.deletePattern(`linear:issue-detail:issueId:${issueId}*`);
  },

  /**
   * Superadmin list changed
   * Invalidates: superadmin cache
   */
  superadminListChanged: () => {
    console.log('[Cache Invalidation] Superadmin list changed - clearing superadmin cache');
    globalCache.deletePattern('superadmin:*');
  },

  /**
   * Permission changed (role updated)
   * Invalidates: permissions cache, user cache
   */
  permissionChanged: (userId: string) => {
    console.log(`[Cache Invalidation] Permission changed (user: ${userId}) - clearing permissions, admin:users`);
    globalCache.deletePattern(`permissions:${userId}*`);
    globalCache.delete('admin:users');
    globalCache.deletePattern('team-hierarchy:*');
  },

  /**
   * Clear all caches (use sparingly - typically on logout)
   */
  clearAll: () => {
    console.log('[Cache Invalidation] Clearing ALL caches');
    globalCache.clear();
  }
};

/**
 * Batch invalidation for complex mutations
 */
export const invalidateCacheBatch = {
  /**
   * User role and teams changed together
   */
  userRoleAndTeamsChanged: (userId: string) => {
    console.log(`[Cache Invalidation Batch] User role and teams changed (${userId})`);
    invalidateCacheAfter.permissionChanged(userId);
    invalidateCacheAfter.teamAssigned(userId, 'batch'); // Placeholder teamId
  },

  /**
   * Customer and associated users deleted
   */
  customerWithUsersDeleted: (customerId: string) => {
    console.log(`[Cache Invalidation Batch] Customer with users deleted (${customerId})`);
    invalidateCacheAfter.customerDeleted(customerId);
    globalCache.delete('admin:users'); // Users may have been affected
  }
};

/**
 * Get cache invalidation stats
 * Useful for debugging and monitoring
 */
export const getCacheInvalidationStats = () => {
  const stats = globalCache.getStats();
  
  return {
    currentEntries: stats.entries,
    hitRatio: stats.hitRatio,
    efficiency: stats.hitRatio > 0.8 ? 'excellent' : 
                stats.hitRatio > 0.6 ? 'good' : 
                stats.hitRatio > 0.4 ? 'fair' : 'poor',
    recommendation: stats.hitRatio < 0.6 
      ? 'Consider reviewing cache invalidation patterns - hit ratio is below optimal'
      : 'Cache performing well'
  };
};

/**
 * Debug helper - list all current cache keys
 * DEVELOPMENT USE ONLY
 */
export const debugCacheKeys = () => {
  const allKeys = globalCache.getAllKeys();
  
  console.group('[Cache Debug] Current Cache Keys');
  console.log('Total keys:', allKeys.length);
  
  // Group by prefix
  const grouped: Record<string, string[]> = {};
  allKeys.forEach(key => {
    const prefix = key.split(':')[0];
    if (!grouped[prefix]) grouped[prefix] = [];
    grouped[prefix].push(key);
  });
  
  Object.entries(grouped).forEach(([prefix, keys]) => {
    console.log(`${prefix}: ${keys.length} keys`);
    keys.forEach(key => console.log(`  - ${key}`));
  });
  
  console.groupEnd();
  
  return grouped;
};
