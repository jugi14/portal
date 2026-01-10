# Cache Key Patterns Reference

> **Quick reference for standardized cache key patterns used throughout the application**

**Date**: November 4, 2025  
**Related**: Removed unused `CacheService.generate*Key()` methods  
**Approach**: Use inline string templates for clarity

---

## Philosophy

We use **inline string templates** instead of helper functions because:

1. **More readable**: `team-config:${teamId}` is clearer than `generateTeamKey(teamId)`
2. **Easier to search**: grep for `"team-config:"` finds all usages
3. **Less abstraction**: No need to import helper for trivial templates
4. **Context-aware**: Different features may need variations of base pattern

---

## Standard Patterns

### Team-Related Keys

| Pattern | Usage | TTL | Example |
|---------|-------|-----|---------|
| `team-config:${teamId}` | Team configuration (states, labels, members) | 24h | `team-config:abc-123` |
| `team:${teamId}` | Basic team data | 10min | `team:abc-123` |
| `team-issues:${teamId}` | All issues for team | 5min | `team-issues:abc-123` |
| `team-issues:${teamId}:${stateId}` | Issues in specific state | 3min | `team-issues:abc-123:done` |
| `team-members:${teamId}` | Team members list | 30min | `team-members:abc-123` |
| `team-hierarchy:${customerId}` | Customer team tree | 10min | `team-hierarchy:cust-456` |
| `team-hierarchy:all` | All teams tree | 10min | `team-hierarchy:all` |

### Issue-Related Keys

| Pattern | Usage | TTL | Example |
|---------|-------|-----|---------|
| `issue:${issueId}` | Issue detail | 3min | `issue:issue-789` |
| `issue:${issueId}:comments` | Issue comments | 2min | `issue:issue-789:comments` |
| `issue:${issueId}:children` | Sub-issues | 5min | `issue:issue-789:children` |
| `issues:${teamId}` | Team issues grouped by state | 5min | `issues:abc-123` |
| `deliverables:${teamId}` | Client UAT filtered issues | 5min | `deliverables:abc-123` |

### User & Permissions Keys

| Pattern | Usage | TTL | Example |
|---------|-------|-----|---------|
| `user:${userId}` | User profile | 30min | `user:user-101` |
| `permissions:${userId}` | User permissions | 0 (no cache) | `permissions:user-101` |
| `user-teams:${userId}` | User's assigned teams | 10min | `user-teams:user-101` |

### Admin & System Keys

| Pattern | Usage | TTL | Example |
|---------|-------|-----|---------|
| `admin:stats` | Admin dashboard stats | 3min | `admin:stats` |
| `admin:users` | All users list | 5min | `admin:users` |
| `admin:customers` | All customers list | 5min | `admin:customers` |
| `admin:linear-teams` | Linear teams list | 30min | `admin:linear-teams` |
| `superadmin:emails` | Superadmin emails | 1min | `superadmin:emails` |
| `superadmin:list:${role}` | Superadmin list by role | 1min | `superadmin:list:client` |

### Dashboard Keys

| Pattern | Usage | TTL | Example |
|---------|-------|-----|---------|
| `dashboard:stats:${customerId}` | Customer dashboard | 2min | `dashboard:stats:cust-456` |
| `dashboard:activity` | Recent activity | 1min | `dashboard:activity` |

---

## Usage Examples

### Basic Cache Operation

```typescript
import { globalCache } from '../services/cacheService';

// SET: Cache team config
const teamConfig = await fetchTeamConfig(teamId);
globalCache.set(`team-config:${teamId}`, teamConfig, 24 * 60 * 60 * 1000); // 24h

// GET: Retrieve team config
const cached = globalCache.get<TeamConfig>(`team-config:${teamId}`);
if (cached) {
  return cached;
}

// DELETE: Invalidate specific team
globalCache.delete(`team-config:${teamId}`);
```

### Pattern Invalidation

```typescript
// Clear all team-related cache
globalCache.invalidatePattern('team:*');

// Clear specific customer's teams
globalCache.invalidatePattern(`team-hierarchy:${customerId}`);

// Clear all admin data
globalCache.invalidatePattern('admin:*');
```

### With Hooks

```typescript
import { useCache } from '../hooks/useCache';

function TeamIssues({ teamId }: Props) {
  const { data: issues, loading } = useCache(
    `team-issues:${teamId}`,  // Cache key
    () => fetchTeamIssues(teamId),  // Fetcher
    { ttl: 5 * 60 * 1000 }  // 5 min TTL
  );
  
  // Component logic...
}
```

---

## Invalidation Strategies

### When to Invalidate

| Event | Keys to Clear | Method |
|-------|---------------|--------|
| User logout | All user-specific | `globalCache.clear()` |
| Team updated | `team:${id}`, `team-config:${id}` | `invalidatePattern('team:*')` |
| Issue updated | `issue:${id}`, `team-issues:${teamId}` | Manual delete |
| Permission change | `permissions:*` | `invalidatePattern('permissions:*')` |
| Team assignment | `team-hierarchy:*`, `user-teams:*` | `invalidatePattern()` both |
| Admin data change | `admin:*` | `invalidatePattern('admin:*')` |

### Example: After Issue Update

```typescript
async function updateIssue(issueId: string, teamId: string, changes: any) {
  // Update via API
  await apiClient.put(`/issues/${issueId}`, changes);
  
  // Invalidate affected caches
  globalCache.delete(`issue:${issueId}`);  // Issue detail
  globalCache.invalidatePattern(`team-issues:${teamId}`);  // Team issues
  globalCache.invalidatePattern(`issues:${teamId}`);  // Grouped issues
}
```

---

## Naming Conventions

### Key Structure

```
{resource}:{identifier}[:{subresource}]

Examples:
team:abc-123              # Team resource, ID abc-123
team-issues:abc-123       # Team issues
issue:issue-789:comments  # Issue comments (subresource)
```

### Hierarchy

```
customer → team → issue → comment
   ↓        ↓       ↓
cust-456:team-abc:issue-789:comments
```

### Pattern Matching

Use wildcards with `invalidatePattern()`:

```typescript
// Match pattern
'team:*'              → matches team:abc-123, team:def-456
'team-issues:*'       → matches team-issues:abc-123, team-issues:def-456
'issue:issue-789:*'   → matches issue:issue-789:comments, issue:issue-789:children
```

---

## TTL Guidelines

### Short TTL (< 5 min)

**Use for**: Frequently changing data

- Issue lists: 3-5 min
- Dashboard stats: 2-3 min
- Activity logs: 1 min
- Superadmin list: 1 min

### Medium TTL (5-30 min)

**Use for**: Moderate update frequency

- Team data: 10 min
- User teams: 10 min
- Team hierarchy: 10 min
- Linear teams: 30 min
- User profile: 30 min

### Long TTL (> 30 min)

**Use for**: Rarely changing data

- Team config (states, labels): 24h
- Workflows: 30 min
- Projects: 15 min

### No Cache (TTL = 0)

**Use for**: Security-sensitive or always-fresh data

- User permissions: 0 (always fetch fresh)
- Auth tokens: Never cache in globalCache

---

## Anti-Patterns to Avoid

### Don't: Inconsistent Key Format

```typescript
// BAD: Different formats for same resource
globalCache.set('team_' + teamId, data);  // Underscore
globalCache.set(`teams/${teamId}`, data);  // Slash
globalCache.set('Team-' + teamId, data);  // Capitalized

// GOOD: Consistent format
globalCache.set(`team:${teamId}`, data);  // Always colon, lowercase
```

### Don't: Over-specific Keys

```typescript
// BAD: Too specific (can't pattern match easily)
globalCache.set(`team-issues-for-abc-123-in-state-done`, data);

// GOOD: Structured, pattern-matchable
globalCache.set(`team-issues:abc-123:done`, data);
```

### Don't: Unclear Resource Type

```typescript
// BAD: What does 'data' refer to?
globalCache.set(`data:${id}`, teamData);

// GOOD: Clear resource type
globalCache.set(`team:${id}`, teamData);
```

---

## Migration from Helper Functions

### Old Approach (Removed)

```typescript
// REMOVED: Static helper methods
CacheService.generateTeamKey(teamId, true);
CacheService.generateHierarchyKey(customerId);
CacheService.generateStatsKey(customerId, 'prod');
CacheService.generateMembersKey(teamId);
```

### New Approach (Current)

```typescript
// USE: Inline string templates
`team-config:${teamId}`;
`team-hierarchy:${customerId}`;
`dashboard:stats:${customerId}`;
`team-members:${teamId}`;
```

**Benefits**:
- More readable
- Easier to search/grep
- No import needed
- Context-aware (can vary pattern as needed)

---

## Debugging Cache Issues

### Check What's Cached

```typescript
// Get cache stats
const stats = globalCache.getStats();
console.log('Cache Performance:', {
  hitRatio: `${(stats.hitRatio * 100).toFixed(1)}%`,
  hits: stats.hits,
  misses: stats.misses,
  size: stats.entries
});

// Check if specific key exists
if (globalCache.has('team:abc-123')) {
  console.log('Team cached');
}
```

### Console Logs

Cache operations log automatically:

```
Cache SET: team-config:abc-123 (TTL: 86400000ms, Size: 12)
Cache DELETE: team:abc-123
Cache CLEARED
```

### Find Stale Cache

```typescript
// Force fresh data by clearing first
globalCache.delete(`team:${teamId}`);
const freshData = await fetchTeam(teamId);
```

---

## Best Practices

### DO

✅ Use consistent naming: `resource:id[:subresource]`  
✅ Use lowercase for resource names  
✅ Use colons `:` as separators  
✅ Include resource type in key  
✅ Use appropriate TTL for data type  
✅ Invalidate on mutations  
✅ Use pattern matching for bulk invalidation

### DON'T

❌ Use spaces in keys  
❌ Use slashes `/` (conflicts with URLs)  
❌ Use underscores `_` (harder to split)  
❌ Capitalize resource names  
❌ Cache sensitive data (tokens, passwords)  
❌ Use infinite TTL (memory leak risk)  
❌ Forget to invalidate after updates

---

## Quick Reference Card

```typescript
// TEAMS
`team-config:${teamId}`           // 24h
`team:${teamId}`                  // 10min
`team-issues:${teamId}`           // 5min
`team-hierarchy:${customerId}`    // 10min

// ISSUES
`issue:${issueId}`                // 3min
`issues:${teamId}`                // 5min
`deliverables:${teamId}`          // 5min

// USERS
`user:${userId}`                  // 30min
`permissions:${userId}`           // 0 (no cache)
`user-teams:${userId}`            // 10min

// ADMIN
`admin:stats`                     // 3min
`admin:users`                     // 5min
`admin:customers`                 // 5min
`superadmin:emails`               // 1min

// INVALIDATION
globalCache.delete('key')         // Single key
globalCache.invalidatePattern('team:*')  // Pattern
globalCache.clear()               // All cache
```

---

**Last Updated**: November 4, 2025  
**Maintained by**: Teifi Digital Development Team  
**Related Docs**: `/docs/UNUSED_FUNCTIONS_REPORT.md`
