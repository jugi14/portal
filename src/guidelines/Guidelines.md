# Teifi Client Portal - Development Guidelines

> **Core Philosophy**: Build simple, maintainable, performant applications that scale gracefully.

---

## TABLE OF CONTENTS

1. [Critical Rules](#critical-rules)
2. [Core Development Principles](#core-development-principles)
3. [Architecture Patterns](#architecture-patterns)
4. [Cache Architecture & Best Practices](#cache-architecture--best-practices)
5. [Security Guidelines](#security-guidelines)
6. [Performance Best Practices](#performance-best-practices)
7. [Code Style](#code-style)
8. [Quick Reference Checklist](#quick-reference-checklist)

---

## CRITICAL RULES

### NO EMOJIS IN CODE

**NEVER use emojis in code, comments, or console logs.**

```typescript
// BAD - DO NOT DO THIS
console.log("[Service] Data loaded successfully");
const status = "Ready";

// GOOD - Use clear text instead
console.log("[Service] Data loaded successfully");
const status = "Ready";
```

**Rationale:**

- Emojis cause encoding issues in some environments
- Not searchable or grep-friendly
- Can break CI/CD pipelines
- Not professional in production code
- Difficult to read in certain terminals/editors

**Exception:** Emojis are ONLY allowed in:

- Markdown documentation files (\*.md)
- User-facing UI text (when explicitly requested)

---

## Core Development Principles

### 1. **KISS Principle: Keep It Simple, Stupid**

**Philosophy**: Simple solutions are easier to understand, maintain, debug, and scale.

####DO:

- Use straightforward, readable code
- Prefer built-in browser APIs and React features
- Keep component logic focused on a single responsibility
- Use clear, descriptive naming conventions
- Minimize conditional complexity
- Favor composition over inheritance

####DON'T:

- Over-engineer solutions
- Add abstractions prematurely
- Create complex nested component hierarchies
- Use clever tricks that sacrifice readability
- Add dependencies when native solutions exist

####Examples:

**Good (Simple):**

```tsx
// Direct, clear permission check
const canEdit =
  userRole === "admin" || userRole === "client_manager";
```

**Bad (Over-complicated):**

```tsx
// Unnecessary abstraction
const canEdit = new PermissionChecker()
  .withRole(userRole)
  .withAction("edit")
  .validate()
  .getResult();
```

---

### 2. **DRY Principle: Don't Repeat Yourself**

**Philosophy**: Single source of truth prevents bugs, reduces maintenance, and improves consistency.

####DO:

- **Use existing contexts** (AuthContext, PermissionContext, SidebarContext)
- Extract repeated logic into hooks
- Create reusable components for common patterns
- Centralize configuration and constants
- Share types and interfaces
- Use utility functions for common operations

####DON'T:

- Duplicate permission checks across components
- Copy-paste code between files
- Recreate existing functionality
- Hardcode values in multiple places
- Implement the same logic differently in different places

####Examples:

**Good (DRY - Use existing PermissionContext):**

```tsx
import { usePermissions } from "./contexts/PermissionContext";

function MyComponent() {
  const { hasPermission } = usePermissions();

  if (!hasPermission("manage_users")) {
    return <AccessDenied />;
  }

  return <AdminPanel />;
}
```

**Bad (Violates DRY - Reimplementing permission logic):**

```tsx
function MyComponent() {
  const { user } = useAuth();
  const [canManageUsers, setCanManageUsers] = useState(false);

  useEffect(() => {
    //Duplicating permission logic already in PermissionContext
    const checkPermission = async () => {
      const response = await fetch(
        `/api/users/${user.id}/permissions`,
      );
      const data = await response.json();
      setCanManageUsers(
        data.permissions.includes("manage_users"),
      );
    };
    checkPermission();
  }, [user]);

  // ... rest of component
}
```

---

### 3. **Performance: Fewer Layers = Faster App**

**Philosophy**: Every layer of abstraction adds overhead. Optimize the critical path.

####DO:

- Use React.memo() for expensive components
- Implement useMemo() and useCallback() strategically
- Leverage existing service layer caching
- Batch API requests when possible
- Use virtualization for long lists (react-window)
- Optimize re-renders with proper dependency arrays
- Cache expensive computations
- Lazy load routes and heavy components

####DON'T:

- Add unnecessary wrapper components
- Create deep component hierarchies
- Make redundant API calls
- Force re-renders unnecessarily
- Load all data upfront
- Use inline function definitions in render
- Over-optimize premature cases

####Examples:

**Good (Performant):**

```tsx
// Use existing cache service
const { data: teams } = useCache(
  "teams",
  linearTeamService.getTeams,
);

// Memoize expensive calculations
const sortedIssues = useMemo(
  () => issues.sort((a, b) => a.priority - b.priority),
  [issues],
);

// Memoize callbacks
const handleUpdate = useCallback(
  (id: string) => {
    updateIssue(id);
  },
  [updateIssue],
);
```

**Bad (Performance issues):**

```tsx
//Makes API call on every render
function MyComponent() {
  const [teams, setTeams] = useState([]);

  // No dependency array - runs every render!
  useEffect(() => {
    fetch("/api/teams")
      .then((r) => r.json())
      .then(setTeams);
  });

  //Inline function creates new reference every render
  return (
    <div>
      {teams.map((team) => (
        <TeamCard
          key={team.id}
          team={team}
          onClick={() => handleClick(team.id)} //New function every render
        />
      ))}
    </div>
  );
}
```

---

### 4. **Maintainability: Less Code = Fewer Bugs**

**Philosophy**: The best code is no code. The second best is simple, obvious code.

####DO:

- Write self-documenting code
- Add comments for complex business logic only
- Keep functions small and focused (< 50 lines)
- Use TypeScript types strictly
- Follow consistent naming conventions
- Keep file length reasonable (< 500 lines)
- Extract complex logic into separate files
- Use descriptive variable names

####DON'T:

- Write god components (> 500 lines)
- Mix multiple concerns in one file
- Use cryptic variable names
- Leave commented-out code
- Skip TypeScript types with `any`
- Create deeply nested logic
- Write code that needs extensive comments to understand

####Examples:

**Good (Maintainable):**

```tsx
interface UserPermissions {
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
}

function useIssuePermissions(issueId: string): UserPermissions {
  const { hasPermission } = usePermissions();
  const { user } = useAuth();

  return {
    canEdit: hasPermission("edit_issues"),
    canDelete: hasPermission("delete_issues"),
    canApprove: hasPermission("approve_issues"),
  };
}
```

**Bad (Hard to maintain):**

```tsx
//Unclear what this does, mixed concerns, no types
function useStuff(id: string) {
  const [x, setX] = useState<any>(null);
  const [y, setY] = useState<any>(false);
  const [z, setZ] = useState<any>({});

  useEffect(() => {
    // 100 lines of mixed logic...
  }, [id]);

  return { x, y, z };
}
```

---

## Architecture Patterns

### Context Usage

**Available Contexts:**

1. **AuthContext** - User authentication & session
2. **PermissionContext** - Role-based access control (RBAC)
3. **SidebarContext** - Sidebar state management
4. **ThemeContext** - Light/dark theme

**Pattern:**

```tsx
//Use existing context
import { usePermissions } from "./contexts/PermissionContext";

function MyComponent() {
  const { userRole, hasPermission } = usePermissions();
  // ... component logic
}

//Don't create new permission logic
const [userPerms, setUserPerms] = useState(null); //Duplicate state
```

---

### Service Layer Pattern

**Available Services:**

- `linearTeamService` - Team data
- `linearTeamIssuesService` - Issue data
- `customerServiceV2` - Customer management
- `userServiceV2` - User management
- `cacheService` - Generic caching
- `sessionManager` - Session persistence

**Pattern:**

```tsx
//Use existing service with caching
import { linearTeamIssuesService } from "./services/linearTeamIssuesService";
import { useCache } from "./hooks/useCache";

function MyComponent({ teamId }: Props) {
  const { data: issues, loading } = useCache(
    `team-${teamId}-issues`,
    () => linearTeamIssuesService.getTeamIssues(teamId),
  );

  // ... component logic
}

//Don't make raw API calls
const [issues, setIssues] = useState([]);
useEffect(() => {
  fetch(`/api/teams/${teamId}/issues`) //Bypasses caching
    .then((r) => r.json())
    .then(setIssues);
}, [teamId]);
```

---

### Navigation Architecture

**Two-Level Navigation System:**

1. **Header Navigation (Top Bar)**
   - Admin tabs: Overview, Users, Customers, Teams, Activity, System
   - Always visible for admin users (superadmin, admin, client_manager)
   - Sticky position at top of viewport
   - Location: `/components/Header.tsx`

2. **Sidebar Navigation (Left Panel)**
   - Dashboard link
   - Team list with hierarchy
   - User profile and logout
   - NO admin links (to avoid duplication with header)
   - Collapsible on desktop, sheet on mobile
   - Location: `/components/Sidebar.tsx`

**Pattern:**

```tsx
// Header - Admin navigation tabs (always visible for admins)
{isAdmin && (
  <nav className="hidden md:flex items-center gap-2">
    <Button onClick={() => navigate('/admin')}>Overview</Button>
    <Button onClick={() => navigate('/admin/users')}>Users</Button>
    {/* ... other admin tabs */}
  </nav>
)}

// Sidebar - Core navigation only (no admin links)
<SidebarNavigation />  // Dashboard link
<SidebarTeamList />    // Team hierarchy
<SidebarFooter />      // Logout
```

**Rules:**

- Admin navigation ONLY in header (single source of truth)
- Sidebar focuses on team/project navigation
- No duplicate navigation items
- Mobile: Header tabs hidden, use sidebar sheet

---

## Component Organization

### File Structure Rules

```
components/
├── ui/                    # Reusable UI components (ShadCN)
├── admin/                 # Admin-specific components
├── [Feature]Component.tsx # Feature components (PascalCase)
└── figma/                 # Figma imports (protected)

contexts/                  # Global state management
hooks/                     # Custom React hooks
services/                  # API & business logic
utils/                     # Pure utility functions
types/                     # TypeScript definitions
```

### Component Size Guidelines

- **Small**: < 100 lines - Single purpose UI components
- **Medium**: 100-300 lines - Feature components with hooks
- **Large**: 300-500 lines - Complex page components
- **Refactor**: > 500 lines - Split into smaller components

### Component Structure Best Practices

**Avoid unnecessary wrapper divs - keep DOM structure clean:**

```tsx
// BAD: Unnecessary wrapper divs
function MyComponent() {
  return (
    <div>              {/* Unnecessary */}
      <div>            {/* Unnecessary */}
        <div className="content">
          <p>Content</p>
        </div>
      </div>
    </div>
  );
}

// GOOD: Minimal DOM structure
function MyComponent() {
  return (
    <div className="content">
      <p>Content</p>
    </div>
  );
}

// GOOD: Use React.Fragment when needed
function MyComponent() {
  return (
    <>
      <Header />
      <Content />
      <Footer />
    </>
  );
}
```

**Avoid over-wrapping with ErrorBoundary:**

```tsx
// BAD: Too many ErrorBoundary wrappers
<ErrorBoundary>
  <ErrorBoundary>
    <ErrorBoundary>
      <Component />
    </ErrorBoundary>
  </ErrorBoundary>
</ErrorBoundary>

// GOOD: One ErrorBoundary at appropriate level
<ErrorBoundary context="Feature">
  <Component />
</ErrorBoundary>
```

**Use semantic HTML and avoid div soup:**

```tsx
// BAD: Div soup (empty/meaningless divs)
<div>
  <div className="">
    <div className="">
      <div className="actual-content">
        Content
      </div>
    </div>
  </div>
</div>

// GOOD: Semantic HTML with purpose
<article className="card">
  <header className="card-header">
    <h2>Title</h2>
  </header>
  <section className="card-body">
    Content
  </section>
</article>
```

---

## Permission System

### Role Hierarchy

```
superadmin (full access)
  ↓
admin (manage users/customers)
  ↓
client_manager (manage customer teams)
  ↓
client_user (view customer teams)
  ↓
tester (limited testing access)
  ↓
viewer (read-only access)
```

### Permission Patterns

```tsx
//Component-level protection
<PermissionGate permission="manage_users">
  <AdminPanel />
</PermissionGate>;

//Hook-based check
const { hasPermission } = usePermissions();
if (hasPermission("edit_issues")) {
  // ... show edit UI
}

//Route protection
<ProtectedRoute context="Admin Panel">
  <AdminPage />
</ProtectedRoute>;
```

---

## UAT State Mapping Strategy

### Overview

The Client Portal UAT (User Acceptance Testing) board uses a **strict name-based matching strategy** to map Linear workflow states to 5 client-friendly columns.

### Mapping Philosophy

**STRICT MATCHING ONLY - No Fallbacks**

- Only states with explicit name matches are displayed
- States that don't match any rule are filtered out
- No generic type-based fallbacks (e.g., all "completed" states)
- Ensures precise control over what clients see

### 5-Column UAT Workflow

```
┌─────────────────────────────────────────────────┐
│  CLIENT UAT KANBAN BOARD (5 COLUMNS)           │
├─────────────────────────────────────────────────┤
│ 1. Pending Review (client-review)              │
│    - Issues ready for client review            │
│    - Linear state: "Client Review"             │
│                                                 │
│ 2. Blocked/Needs Input (blocked)               │
│    - Waiting for client feedback                │
│    - Linear states: "Blocked", "Waiting", etc. │
│                                                 │
│ 3. Approved (done)                              │
│    - Completed and approved by client           │
│    - Linear states: "Release Ready", etc.      │
│                                                 │
│ 4. Released (released)                          │
│    - Shipped to production                      │
│    - Linear states: "Shipped", "Released"      │
│                                                 │
│ 5. Failed Review (failed-review)                │
│    - Canceled or duplicate issues               │
│    - Linear states: "Canceled", "Duplicate"    │
└─────────────────────────────────────────────────┘
```

### State Mapping Priority Order

**File**: `/utils/clientTasksMapping.ts`

```typescript
// Priority 1: Shipped/Released states → Released
if (stateName.includes("shipped") || stateName.includes("released")) {
  return "released";
}

// Priority 2: Client Review states → Pending Review
if (stateName.includes("client review")) {
  return "client-review";
}

// Priority 3: Canceled/Duplicate states → Failed Review
if (stateType === "canceled" || stateName.includes("duplicate")) {
  return "failed-review";
}

// Priority 4: Release Ready states → Approved
if (stateName.includes("release ready") || stateName.includes("approved")) {
  return "done";
}

// Priority 5: Blocked/Waiting states → Blocked
if (stateName.includes("blocked") || stateName.includes("waiting")) {
  return "blocked";
}

// NO FALLBACK - Return null if no match
return null;
```

### Critical Design Decision: No Completed Type Fallback

**Why we removed the generic `if (stateType === "completed")` check:**

```typescript
// ❌ OLD APPROACH (Had Issues):
// Priority 2: All completed states → Approved
if (stateType === "completed") {
  return "done";  // "Client Review" matched HERE (wrong!)
}

// Priority 5: Client Review by name → Pending Review  
if (stateName.includes("client review")) {
  return "client-review";  // NEVER REACHED
}

// ✅ NEW APPROACH (Name-Based Only):
// Priority 2: Client Review by name → Pending Review
if (stateName.includes("client review")) {
  return "client-review";  // Matches FIRST (correct!)
}

// Priority 4: Release Ready by name → Approved
if (stateName.includes("release ready")) {
  return "done";  // Explicit name match
}

// NO completed type fallback - strict matching only
```

**Benefits of Name-Based Matching:**

1. **Explicit Control**: Only states we explicitly name are displayed
2. **No Conflicts**: "Client Review" (type=completed) correctly maps to Pending Review
3. **Easier Debugging**: Clear which states match which columns
4. **Prevents Leaks**: Unknown completed states are filtered out (not shown)

### Linear Workflow Configuration Impact

From Linear, the "Completed" workflow group contains:
- **Client Review** (8 issues) → Maps to "Pending Review"
- **Release Ready** (5 issues) → Maps to "Approved"  
- **Shipped** (524 issues) → Maps to "Released"

**All have `type="completed"` but map to DIFFERENT columns based on name.**

### State Mapping Examples

| Linear State | Type | Mapped Column | Reason |
|-------------|------|---------------|--------|
| "Client Review" | completed | Pending Review | Name match (Priority 2) |
| "Release Ready" | completed | Approved | Name match (Priority 4) |
| "Shipped" | completed | Released | Name match (Priority 1) |
| "Blocked" | started | Blocked | Name match (Priority 5) |
| "Canceled" | canceled | Failed Review | Type match (Priority 3) |
| "In Progress" | started | (filtered out) | No match - not displayed |
| "QA" | started | (filtered out) | No match - not displayed |

### Adding New State Mappings

To add a new Linear state to UAT board:

```typescript
// 1. Decide which column it should map to
// 2. Add name check to appropriate priority level

// Example: Add "Ready for Client" state → Pending Review
if (
  stateName.includes("client review") ||
  stateName.includes("client-review") ||
  stateName.includes("ready for client")  // NEW
) {
  return "client-review";
}
```

### Debugging State Mappings

**Console logs show state mapping decisions:**

```bash
[StateMapping] Checking state: "Client Review" (type: completed)
[StateMapping] -> Mapped to PENDING REVIEW

[StateMapping] Checking state: "In Progress" (type: started)
[StateMapping] -> NO MATCH - Issue will be filtered out
```

**To debug mapping issues:**

1. Check console for `[StateMapping]` logs
2. Verify state name matches one of the patterns
3. Check priority order (earlier matches win)
4. Confirm Linear state type if needed

### Testing State Mappings

```typescript
// Test cases for state mapping
import { mapStateToClientColumn } from './clientTasksMapping';

// Should map to Pending Review
const clientReview = mapStateToClientColumn({ 
  name: "Client Review", 
  type: "completed" 
});
expect(clientReview).toBe("client-review");

// Should map to Released
const shipped = mapStateToClientColumn({ 
  name: "Shipped", 
  type: "completed" 
});
expect(shipped).toBe("released");

// Should be filtered out
const inProgress = mapStateToClientColumn({ 
  name: "In Progress", 
  type: "started" 
});
expect(inProgress).toBeNull();
```

### State Mapping Checklist

Before modifying state mapping logic:

- [ ] Understand strict matching strategy (no fallbacks)
- [ ] Check priority order (earlier matches win)
- [ ] Verify Linear state names exactly (case-insensitive)
- [ ] Test with console logs enabled
- [ ] Confirm all 5 columns have expected issues
- [ ] Check no states are incorrectly filtered out

---

## Cache Architecture & Best Practices

### Overview

The application uses a **multi-layered caching strategy** to optimize performance and reduce unnecessary API calls.

### Cache Architecture Layers

```
┌─────────────────────────────────────────┐
│     APPLICATION CACHE LAYERS            │
├─────────────────────────────────────────┤
│ 1. In-Memory (RAM)                      │
│    - globalCache (CacheService)         │
│    - Fastest: <1ms access time          │
│    - Lost on page refresh               │
│    - TTL-based expiration               │
│                                         │
│ 2. Browser Storage                      │
│    - sessionStorage (per-tab)           │
│    - localStorage (persistent)          │
│    - Survives page refresh              │
│    - 5-10MB limit                       │
│                                         │
│ 3. Service Worker Cache                 │
│    - HTTP response cache                │
│    - Static assets only                 │
│    - Offline support                    │
│                                         │
│ 4. Backend KV Store                     │
│    - Server-side persistence            │
│    - Shared across all clients          │
│    - NOT for caching KV data            │
└─────────────────────────────────────────┘
```

### Critical Rule: Correct Cache Signature

**ALWAYS use correct parameter order for `globalCache.set()`**

```typescript
// CORRECT SIGNATURE
globalCache.set(key: string, data: T, ttlMs?: number, options?: {...})

// ✅ CORRECT: TTL as number (3rd parameter)
globalCache.set('cache-key', data, 60 * 1000);

// ✅ CORRECT: With persist options (4th parameter)
globalCache.set(
  'cache-key',
  data,
  60 * 1000,                                // TTL in ms
  { persist: true, storage: 'sessionStorage' }  // Options
);

// ❌ WRONG: Passing options object as TTL
globalCache.set('cache-key', data, { ttl: 60 * 1000 });
//                                 ^^^^^^^^^^^^^^^^^^
//                                 This becomes "[object Object]"!
```

**Why This Matters**:
- Wrong signature → TTL = `[object Object]` → Cache never expires
- Causes memory leaks and performance degradation
- Console will show: `Cache SET: key (TTL: [object Object]ms)`

### Frontend Cache Strategy

#### 1. **Use globalCache for API Responses**

```typescript
import { globalCache } from '../services/cacheService';

// ✅ CORRECT: Cache API response with 5-minute TTL
const fetchUserData = async (userId: string) => {
  const cacheKey = `user-data:${userId}`;
  
  // Check cache first
  const cached = globalCache.get<UserData>(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Fetch from API
  const data = await apiClient.get(`/users/${userId}`);
  
  // Cache for 5 minutes
  globalCache.set(cacheKey, data, 5 * 60 * 1000);
  
  return data;
};
```

#### 2. **Use Hooks for Component-Level Caching**

```typescript
import { useCache } from '../hooks/useCache';

// ✅ CORRECT: useCache hook handles caching automatically
function TeamList({ customerId }: Props) {
  const { data: teams, loading, error, refresh } = useCache(
    `customer-${customerId}-teams`,  // Cache key
    () => linearTeamService.getCustomerTeams(customerId),  // Fetch function
    { ttl: 5 * 60 * 1000 }  // 5 minutes TTL
  );
  
  // Component logic...
}
```

### Cache TTL Reference

```typescript
// Recommended TTL values for different data types
export const CACHE_TTL = {
  // User & Auth Data
  USER_PERMISSIONS: 0,                // No cache - always fresh
  SUPERADMIN_LIST: 60 * 1000,        // 1 minute
  TEAM_HIERARCHY: 10 * 60 * 1000,    // 10 minutes
  USER_PROFILE: 30 * 60 * 1000,      // 30 minutes
  
  // Teams & Linear Data
  TEAMS_LIST: 5 * 60 * 1000,         // 5 minutes
  TEAM_DETAILS: 10 * 60 * 1000,      // 10 minutes
  TEAM_CONFIG: 24 * 60 * 60 * 1000,  // 24 hours
  LINEAR_TEAMS: 30 * 60 * 1000,      // 30 minutes (from Linear API)
  
  // Issues & Tasks
  ISSUES_LIST: 5 * 60 * 1000,        // 5 minutes
  ISSUE_DETAIL: 3 * 60 * 1000,       // 3 minutes
  ISSUE_COMMENTS: 2 * 60 * 1000,     // 2 minutes
  
  // Dashboard & Stats
  DASHBOARD_STATS: 2 * 60 * 1000,    // 2 minutes
  ACTIVITY_LOGS: 1 * 60 * 1000,      // 1 minute
  ADMIN_STATS: 3 * 60 * 1000,        // 3 minutes
  
  // Static/Slow-changing Data
  WORKFLOWS: 30 * 60 * 1000,         // 30 minutes
  LABELS: 30 * 60 * 1000,            // 30 minutes
  PROJECTS: 15 * 60 * 1000,          // 15 minutes
};
```

### Cache Invalidation Patterns

#### When to Invalidate Cache

| Event | Cache Keys to Clear | Method |
|-------|-------------------|---------|
| User logout | All user-specific | `globalCache.clear()` |
| Permission change | `permissions:*`, `team-hierarchy:*` | `globalCache.deletePattern('permissions:*')` |
| Team assignment | `team-config:*`, `team-hierarchy:*` | `globalCache.deletePattern('team-*')` |
| Issue update | `team-issues:*`, `issue-detail:${id}` | `globalCache.delete(key)` |
| Superadmin change | `superadmin:*` | `globalCache.deletePattern('superadmin:*')` |

#### Implementation Examples

```typescript
// 1. Clear specific key
globalCache.delete('team-issues:team-123');

// 2. Clear pattern (all keys matching)
globalCache.deletePattern('team-*');  // Clears team-issues:*, team-config:*, etc.

// 3. Clear all cache (logout)
globalCache.clear();

// 4. Clear with storage cleanup
globalCache.clearStorage('sessionStorage', 'team-');  // Clear persisted cache
```

### Backend Cache Strategy

#### Server-Side In-Memory Cache

**File**: `/supabase/functions/server/serverCacheManager.tsx`

```typescript
import { serverCache, SERVER_CACHE_TTL } from './serverCacheManager.tsx';

// ✅ CORRECT: Cache superadmin emails in memory (not in KV)
const getSuperadminEmails = async () => {
  const cacheKey = 'superadmin:emails';
  
  // Check in-memory cache
  const cached = serverCache.get<string[]>(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Fetch from KV store
  const emails = await kv.get('superadmin:emails');
  
  // Cache in memory (NOT in KV!)
  serverCache.set(cacheKey, emails, SERVER_CACHE_TTL.SUPERADMIN_EMAILS);
  
  return emails;
};
```

**Why**: Caching KV data in KV = 2 DB queries. Cache in memory = 0 DB queries on cache hit!

### Anti-Patterns to Avoid

#### 1. ❌ Caching KV Data in KV (Redundant Cache)

```typescript
// ❌ WRONG: Cache KV data back into KV
const getData = async () => {
  // Check KV cache
  const cached = await kv.get('cache:data');
  if (cached) return cached;
  
  // Fetch from KV
  const data = await kv.get('data');
  
  // Cache back into KV (REDUNDANT - 2 DB queries!)
  await kv.set('cache:data', data);
  
  return data;
};

// ✅ CORRECT: Cache KV data in memory
const getData = async () => {
  // Check in-memory cache
  const cached = serverCache.get('data');
  if (cached) return cached;
  
  // Fetch from KV (1 DB query)
  const data = await kv.get('data');
  
  // Cache in memory (no DB write)
  serverCache.set('data', data, 5 * 60 * 1000);
  
  return data;
};
```

**Impact**:
- Before: 2 DB queries (check cache KV → fetch data KV)
- After: 1 DB query (fetch data KV, cache in RAM)
- **50% reduction in DB load**

#### 2. ❌ Wrong Cache Signature (Object as TTL)

```typescript
// ❌ WRONG: Options object in TTL parameter
globalCache.set('key', data, { ttl: 60000 });
// Result: TTL = "[object Object]" → Cache broken

// ✅ CORRECT: TTL as number
globalCache.set('key', data, 60000);
```

#### 3. ❌ No Cache Invalidation

```typescript
// ❌ WRONG: Update data without clearing cache
const updateTeam = async (teamId, changes) => {
  await apiClient.put(`/teams/${teamId}`, changes);
  // Cache still has old data!
};

// ✅ CORRECT: Invalidate cache after mutation
const updateTeam = async (teamId, changes) => {
  await apiClient.put(`/teams/${teamId}`, changes);
  
  // Clear affected caches
  globalCache.delete(`team-detail:${teamId}`);
  globalCache.deletePattern('team-list:*');
  globalCache.deletePattern('team-hierarchy:*');
};
```

#### 4. ❌ Caching Sensitive Data Insecurely

```typescript
// ❌ WRONG: Cache tokens in localStorage (XSS vulnerability)
localStorage.setItem('access_token', session.access_token);

// ✅ CORRECT: Use secure storage for tokens
secureTokenStorage.setToken(session.access_token);

// ✅ CORRECT: Cache non-sensitive metadata only
const metadata = {
  user: session.user,
  expires_at: session.expires_at,
  // NO access_token
};
sessionStorage.setItem('session', JSON.stringify(metadata));
```

### Performance Optimization Patterns

#### 1. Parallel Loading with Cache

```typescript
// ✅ OPTIMAL: Load permissions + teams in parallel
const loadUserData = async () => {
  // Both load simultaneously
  const [permissions, teams] = await Promise.all([
    loadUserPermissions(),   // Sets loading=false when done
    loadTeamAccess()          // Loads in background
  ]);
  
  // UI renders as soon as permissions available
  // Sidebar loads asynchronously
};
```

#### 2. Stale-While-Revalidate Pattern

```typescript
// ✅ OPTIMAL: Show stale data immediately, refresh in background
const getTeamIssues = async (teamId: string) => {
  const cacheKey = `team-issues:${teamId}`;
  
  // Get cached data (even if stale)
  const cached = globalCache.get(cacheKey, { allowStale: true });
  
  // Show immediately if available
  if (cached) {
    setIssues(cached);
  }
  
  // Refresh in background
  const fresh = await apiClient.get(`/teams/${teamId}/issues`);
  setIssues(fresh);
  globalCache.set(cacheKey, fresh, 5 * 60 * 1000);
};
```

#### 3. Cache Warming on Login

```typescript
// ✅ OPTIMAL: Pre-fetch critical data on login
const warmCache = async () => {
  // Fetch all critical data in parallel
  await Promise.all([
    fetchUserPermissions(),
    fetchTeamHierarchy(),
    fetchTeamConfig(),
    fetchRecentActivity(),
  ]);
  
  console.log('[Cache] Warmed critical paths');
};

// Call after successful login
onLoginSuccess(() => {
  warmCache();
});
```

### Cache Debugging

#### Console Log Patterns

```typescript
// ✅ GOOD - Valid cache operation
Cache SET: superadmin:list:client (TTL: 60000ms, Size: 2)
Cache SET: team-config:abc-123 (TTL: 86400000ms, Size: 3)

// ❌ BAD - Indicates bug
Cache SET: key (TTL: [object Object]ms)  // Wrong signature!
Cache SET: key (TTL: NaNms)              // Invalid TTL!
Cache SET: key (TTL: undefinedms)        // Missing TTL!
```

#### Check Cache Stats

```typescript
// Get cache performance metrics
const stats = globalCache.getStats();
console.log('Cache Performance:', {
  hitRatio: `${(stats.hitRatio * 100).toFixed(1)}%`,
  hits: stats.hits,
  misses: stats.misses,
  size: stats.entries,
  efficiency: stats.hitRatio > 0.8 ? 'excellent' : 
              stats.hitRatio > 0.6 ? 'good' : 
              stats.hitRatio > 0.4 ? 'fair' : 'poor'
});
```

### Cache Checklist

Before deploying cache code:

- [ ] Used correct `globalCache.set()` signature (TTL as number)
- [ ] No `[object Object]` in console cache logs
- [ ] TTL values are appropriate for data type
- [ ] Cache invalidation on data mutations
- [ ] Sensitive data NOT cached in localStorage
- [ ] Server-side: Using in-memory cache (not KV cache for KV data)
- [ ] Implemented error handling for cache misses
- [ ] Cache size limits enforced (prevent memory leaks)

---

## Security Guidelines

### XSS Prevention (CRITICAL)

**Never use `innerHTML` with user input - this is a critical security vulnerability.**

#### DO: Use Safe Methods

```typescript
// SAFE: textContent automatically escapes HTML
element.textContent = userInput;

// SAFE: React JSX automatically escapes
<div>{userInput}</div>

// SAFE: TipTap editor safe methods
const text = editor.getText(); // Returns plain text

// SAFE: Build DOM programmatically
const div = document.createElement('div');
div.textContent = userInput;
parent.appendChild(div);
```

#### DON'T: Use Dangerous Methods

```typescript
// DANGEROUS: innerHTML executes scripts
element.innerHTML = userInput; // XSS vulnerability

// DANGEROUS: dangerouslySetInnerHTML without sanitization
<div dangerouslySetInnerHTML={{ __html: userInput }} /> // XSS vulnerability

// DANGEROUS: Template strings in HTML context
element.innerHTML = `<div>${userInput}</div>`; // XSS vulnerability

// DANGEROUS: eval or Function with user input
eval(userInput); // Code injection
new Function(userInput)(); // Code injection
```

#### If You Must Use HTML

Only if absolutely necessary, and only after sanitizing:

```typescript
import DOMPurify from "dompurify";

// SAFE: Sanitize first
const clean = DOMPurify.sanitize(dirtyHTML);
element.innerHTML = clean;
```

#### Security Checklist

Before committing code:

- [ ] No `innerHTML =` with user input
- [ ] No `dangerouslySetInnerHTML` with user input
- [ ] Use `textContent` or DOM API methods
- [ ] No `console.log` with token information
- [ ] No token length, presence, or timing logs
- [ ] Access tokens NOT in sessionStorage session object
- [ ] Run XSS scanner: `npx ts-node scripts/checkXSS.ts`

#### Common XSS Attack Patterns

Be aware of these attack vectors:

```javascript
// Image onerror
<img src=x onerror="alert('XSS')">

// Script tag
<script>alert('XSS')</script>

// SVG with script
<svg onload="alert('XSS')">

// Link with javascript:
<a href="javascript:alert('XSS')">Click</a>

// Form with malicious action
<form action="javascript:alert('XSS')">
```

**All of these are blocked when you use `textContent` or safe DOM methods.**

---

### Token Security (CRITICAL)

**Never log token information - this is a critical security vulnerability.**

#### DO: Secure Token Handling

```typescript
// SAFE: No token logging
if (session?.access_token) {
  apiClient.setAccessToken(session.access_token);
  // SECURITY: Do not log token information
}

// SAFE: Store only session metadata (no access_token)
const sessionMetadata = {
  user: session.user,
  expires_at: session.expires_at,
  // access_token deliberately omitted for security
};
sessionStorage.setItem(
  "session",
  JSON.stringify(sessionMetadata),
);

// SAFE: Generic error without token info
if (!token) {
  console.error("[Auth] Authentication required");
}
```

#### DON'T: Log or Expose Tokens

```typescript
// DANGEROUS: Logging token length
console.log("Token length:", token.length); // Security vulnerability

// DANGEROUS: Logging token presence
console.log("Token:", token ? "present" : "missing"); // Security vulnerability

// DANGEROUS: Logging token timing
console.log("Token expires in", minutes, "minutes"); // Security vulnerability

// DANGEROUS: Storing full session with access_token
sessionStorage.setItem("session", JSON.stringify(session)); // XSS vulnerability

// DANGEROUS: Logging token operations
console.log("[Service] Access token set"); // Security vulnerability
```

#### Why This Matters

Token information in console logs can be:

- Captured by browser extensions
- Logged to error tracking services
- Exposed in screenshots/recordings
- Stolen by attackers with DevTools access

#### Token Storage Architecture

```
Session Metadata (sessionStorage)
├── User info (safe to store)
└── Expiry time (safe to store)

Token Storage (secureTokenStorage - separate)
├── Access token (NEVER in sessionStorage.session)
├── Token expiry
└── Issued time
```

#### Security Checklist

Before committing authentication code:

- [ ] No `console.log` with token information
- [ ] No token length, presence, or timing logs
- [ ] Access tokens NOT in sessionStorage session object
- [ ] Session metadata stored separately from tokens
- [ ] Security comments in place of removed logs

---

## Input Validation (CRITICAL)

### Why Input Validation Matters

**Never trust user input - this is a fundamental security principle.**

Unvalidated input can lead to:

- XSS attacks (malicious scripts)
- SQL injection
- Data corruption
- Poor user experience
- System crashes

### Validation Utilities

Use the comprehensive validation utilities in `/utils/inputValidation.ts`:

```typescript
import {
  validateEmail,
  validatePassword,
  validateName,
  sanitizeSearchQuery,
  validateAndSanitizeInput,
} from "../utils/inputValidation";
```

### DO: Validate All User Input

```typescript
// GOOD: Email validation with real-time feedback
const [email, setEmail] = useState("");
const [emailError, setEmailError] = useState("");

const handleEmailChange = (
  e: React.ChangeEvent<HTMLInputElement>,
) => {
  const value = e.target.value;
  setEmail(value);

  // Real-time validation
  const { validation } = validateAndSanitizeInput(
    value,
    "email",
    { required: false },
  );
  setEmailError(validation.error || "");
};

// GOOD: Password validation with strength indicator
const handlePasswordChange = (
  e: React.ChangeEvent<HTMLInputElement>,
) => {
  const value = e.target.value;
  setPassword(value);

  const strength = getPasswordStrength(value);
  setPasswordStrength(strength);
};

// GOOD: Form submission validation
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // Validate all fields before submission
  const emailValidation = validateEmail(email);
  const passwordValidation = validatePassword(password, true);

  if (!emailValidation.isValid) {
    setError(emailValidation.error);
    return;
  }

  if (!passwordValidation.isValid) {
    setError(passwordValidation.error);
    return;
  }

  // Proceed with submission
  await submitForm();
};
```

### DON'T: Direct Input Without Validation

```typescript
// BAD: No validation
onChange={(e) => setEmail(e.target.value)} // No email format check

// BAD: No password strength check
onChange={(e) => setPassword(e.target.value)} // Weak passwords allowed

// BAD: No search sanitization
onChange={(e) => setSearchQuery(e.target.value)} // XSS vulnerability

// BAD: No form validation
const handleSubmit = () => {
  // Submits without checking if email is valid!
  submitForm(email, password);
};
```

### Search Input Sanitization

```typescript
// GOOD: Sanitize search queries
import { sanitizeSearchQuery } from "../utils/inputValidation";

const handleSearchChange = (
  e: React.ChangeEvent<HTMLInputElement>,
) => {
  const sanitized = sanitizeSearchQuery(e.target.value);
  setSearchQuery(sanitized);
};
```

### Password Strength Requirements

Passwords must meet these requirements:

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (strict mode)

```typescript
// GOOD: Show password requirements
<div className="space-y-2">
  <Input
    type="password"
    value={password}
    onChange={handlePasswordChange}
  />

  {password && (
    <div className="text-xs">
      <p className={passwordStrength.level === 'weak' ? 'text-destructive' : 'text-success'}>
        {passwordStrength.feedback}
      </p>
    </div>
  )}
</div>
```

### Email Validation Pattern

```typescript
// GOOD: Validate email format
const emailValidation = validateEmail(email);

if (!emailValidation.isValid) {
  toast.error(emailValidation.error);
  return;
}
```

### Name Field Validation

```typescript
// GOOD: Validate names
const nameValidation = validateName(
  customerName,
  "Customer Name",
);

if (!nameValidation.isValid) {
  setNameError(nameValidation.error);
  return;
}
```

### Input Validation Checklist

Before submitting forms:

- [ ] Email fields validated with `validateEmail()`
- [ ] Password fields checked with `validatePassword()`
- [ ] Search inputs sanitized with `sanitizeSearchQuery()`
- [ ] Name fields validated with `validateName()`
- [ ] All text inputs sanitized with `sanitizeTextInput()`
- [ ] Client-side validation before API calls
- [ ] Server-side validation as final check
- [ ] Clear error messages shown to user

### Common Validation Patterns

```typescript
// Email Input
<Input
  type="email"
  value={email}
  onChange={(e) => {
    const { value, validation } = validateAndSanitizeInput(
      e.target.value,
      'email'
    );
    setEmail(value);
    setEmailError(validation.error);
  }}
/>
{emailError && <p className="text-sm text-destructive">{emailError}</p>}

// Password Input with Strength
<Input
  type="password"
  value={password}
  onChange={(e) => {
    const value = e.target.value;
    setPassword(value);
    setPasswordStrength(getPasswordStrength(value));
  }}
/>

// Search Input
<Input
  type="search"
  value={searchQuery}
  onChange={(e) => {
    const sanitized = sanitizeSearchQuery(e.target.value);
    setSearchQuery(sanitized);
  }}
/>

// Name Input
<Input
  type="text"
  value={name}
  onChange={(e) => {
    const { value, validation } = validateAndSanitizeInput(
      e.target.value,
      'name',
      { fieldName: 'Customer Name' }
    );
    setName(value);
    setNameError(validation.error);
  }}
/>
```

### Client-Side vs Server-Side Validation

**Both are required:**

1. **Client-Side** (UX):
   - Immediate feedback
   - Prevents unnecessary API calls
   - Better user experience

2. **Server-Side** (Security):
   - Final validation
   - Cannot be bypassed
   - Protects database integrity

```typescript
// Client-side validation
const clientValidation = validateEmail(email);
if (!clientValidation.isValid) {
  toast.error(clientValidation.error);
  return;
}

// Server will also validate
const response = await fetch("/api/users", {
  method: "POST",
  body: JSON.stringify({ email }),
});

// Server returns validation errors if any
if (!response.ok) {
  const error = await response.json();
  toast.error(error.message);
}
```

### Security Best Practices

1. **Always sanitize** before displaying
2. **Always validate** before submitting
3. **Never trust** client-side validation alone
4. **Use whitelist** approach (allow known good, block everything else)
5. **Provide clear** error messages
6. **Log validation** failures (server-side only)

---

## Performance Best Practices

### 1. **Caching Strategy**

```tsx
//Use cache service for expensive operations
const { data, loading, error, refresh } = useCache(
  "cache-key",
  fetchFunction,
  { ttl: 5 * 60 * 1000 }, // 5 minutes
);
```

### 2. **Memoization**

```tsx
//Memoize expensive computations
const filteredData = useMemo(
  () => data.filter(complexFilter),
  [data],
);

//Memoize callbacks
const handleClick = useCallback(
  (id: string) => {
    // ... handler logic
  },
  [dependency],
);
```

### 2.5. **React.memo for List Components**

**CRITICAL for performance in lists/kanban boards: Always memoize list item components.**

**Why**: In a kanban with 100 cards, updating ONE card without memo re-renders ALL 100 cards.

```tsx
// BAD: Card re-renders even if its data hasn't changed
export function IssueCard({ issue, onDragStart }) {
  return (
    <Card>
      <h3>{issue.title}</h3>
      {/* ... */}
    </Card>
  );
}

// GOOD: Card only re-renders when issue/props actually change
const IssueCardComponent: React.FC<IssueCardProps> = ({
  issue,
  stateId,
  isSyncing,
  onDragStart,
  onViewDetails,
}) => {
  return (
    <Card>
      <h3>{issue.title}</h3>
      {/* ... */}
    </Card>
  );
};

export const IssueCard = React.memo(IssueCardComponent);
```

**Performance Impact:**
- **Without memo**: 100 cards × 100ms = 10 seconds render time
- **With memo**: 1 card × 100ms = 100ms render time
- **Speedup**: 100x faster for single card updates

**When to use React.memo:**
- ✅ List/grid items (cards, rows, tiles)
- ✅ Components rendered in loops (.map)
- ✅ Components with expensive rendering logic
- ✅ Components that receive same props frequently
- ❌ Components that change often (defeats memo)
- ❌ Components with children prop (breaks memo)
- ❌ Simple components (< 10ms render time)

**Custom comparison function (advanced):**

```tsx
// Only re-render if issue ID or state changes
const areEqual = (prevProps: Props, nextProps: Props) => {
  return (
    prevProps.issue.id === nextProps.issue.id &&
    prevProps.issue.state?.id === nextProps.issue.state?.id &&
    prevProps.isSyncing === nextProps.isSyncing
  );
};

export const IssueCard = React.memo(IssueCardComponent, areEqual);
```

**Debugging memo:**

```tsx
// Add displayName for React DevTools
IssueCardComponent.displayName = 'IssueCard';
export const IssueCard = React.memo(IssueCardComponent);

// Check if memo is working in DevTools:
// 1. Open React DevTools Profiler
// 2. Update one item
// 3. Only that item should highlight (not all siblings)
```

### 3. **Code Splitting**

```tsx
//Lazy load heavy components
const AdminPage = lazy(() => import("./pages/AdminPage"));

// Use with Suspense
<Suspense fallback={<PageLoading />}>
  <AdminPage />
</Suspense>;
```

---

## Code Style

### Naming Conventions

```tsx
// Components: PascalCase
function TeamDetailPage() {}

// Hooks: camelCase with "use" prefix
function useTeamAccess() {}

// Services: camelCase with descriptive suffix
const linearTeamService = {};

// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;

// Types/Interfaces: PascalCase
interface UserPermissions {}
type TeamRole = "admin" | "member";
```

### Code Comments - NO EMOJIS

```tsx
// GOOD - Clear, searchable comments
// CRITICAL: Validate user permissions before API call
// TODO: Refactor this function to reduce complexity
// NOTE: This workaround is temporary until Linear API v2

// BAD - Do not use emojis
//CRITICAL: Validate user permissions
//TODO: Refactor this function
//NOTE: This workaround is temporary
```

### UI Component Styling Best Practices

**Base components (ShadCN) have default styles that may need to be overridden.**

#### Font Import Best Practices

**Always include italic and bold variants when importing Google Fonts.**

```css
/* BAD: Missing italic variants - font-style: italic won't work */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

/* GOOD: Include both regular (0) and italic (1) for all weights */
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap');
```

**Why This Matters**:
- Without italic variants, `font-style: italic` will use synthetic (faux) italics
- Synthetic italics look poor and unprofessional (slanted, not true italic glyphs)
- Google Fonts requires explicit `ital` parameter for italic support
- Format: `ital,wght@0,weight;1,weight` where `0` = normal, `1` = italic
- **Note**: We use Inter font (not Manrope) because Inter has proper italic support

**Checking if italics are working**:
1. Apply `font-style: italic` to text
2. Inspect in DevTools → Fonts tab
3. Should show "Inter Italic" not "Inter (synthetic-oblique)"

#### Overriding Base Component Styles

When base UI components (like AlertDialog, Dialog, etc.) have default `max-w-*` or other constraints:

```tsx
// PROBLEM: Base component has sm:max-w-lg (512px)
// Your className with max-w-[30vh] gets overridden by responsive class

// SOLUTION 1: Use ! (important) prefix
<AlertDialogContent className="!max-w-[30vh] min-w-[320px]">
  {/* Your content */}
</AlertDialogContent>

// SOLUTION 2: Use more specific responsive class
<AlertDialogContent className="max-w-[30vh] sm:max-w-[30vh] min-w-[320px]">
  {/* Your content */}
</AlertDialogContent>
```

#### Viewport-Relative Sizing for Modal Hierarchy

**Use viewport units (vh/vw) to create visual hierarchy between nested modals:**

```tsx
// Main modal: Fixed large size
<DialogContent className="max-w-5xl">
  {/* Primary content */}
</DialogContent>

// Confirmation dialog: Viewport-relative (appears smaller)
<AlertDialogContent className="!max-w-[30vh] min-w-[320px]">
  {/* Delete confirmation */}
</AlertDialogContent>
```

**Benefits:**
- Clear visual hierarchy (main vs. subordinate dialogs)
- Responsive to different screen sizes
- Maintains professional appearance
- Use `min-w-*` to prevent too-small modals on short viewports

#### Common Tailwind Override Patterns

```tsx
// Gap override (base components may have default gap-4)
<div className="flex gap-2">  {/* May be overridden */}
<div className="flex !gap-2"> {/* Enforced */}

// Typography override (globals.css sets defaults)
<h1 className="text-2xl">     {/* Avoid unless intentional */}
<h1>                          {/* Use global defaults */}

// Padding override for compact layouts
<Card className="p-3">        {/* May be overridden by base p-6 */}
<Card className="!p-3">       {/* Enforced */}
```

#### Checking for Style Conflicts

**If your Tailwind classes aren't applying:**

1. **Inspect DevTools** - Check computed styles for conflicting classes
2. **Check base component** - Look for default responsive classes (sm:, md:)
3. **Use !important prefix** - Add `!` before class name
4. **Verify specificity** - More specific selectors override general ones

```bash
# Example: AlertDialog has sm:max-w-lg by default
# Your max-w-[30vh] works on mobile but overridden on desktop
# Solution: !max-w-[30vh] enforces on all breakpoints
```

#### Tooltip Best Practices

**Standard tooltip behavior: 1 second delay, 0.2s animation, appears at cursor position**

```tsx
// GOOD: Use default tooltip (1s delay, fast animation)
<Tooltip>
  <TooltipTrigger asChild>
    <Button>Hover me</Button>
  </TooltipTrigger>
  <TooltipContent>
    This appears after 1 second with smooth 0.2s animation
  </TooltipContent>
</Tooltip>

// GOOD: Custom delay if needed (e.g., instant for critical UI)
<Tooltip delayDuration={0}>
  <TooltipTrigger asChild>
    <Button variant="destructive">Delete</Button>
  </TooltipTrigger>
  <TooltipContent>
    Instant tooltip for important actions
  </TooltipContent>
</Tooltip>
```

**Why these settings**:
- **1s delay**: Prevents tooltip spam while hovering
- **0.2s animation**: Fast enough to feel responsive, slow enough to be smooth
- **No slide animation**: Tooltip appears where cursor is (no flying in from sides)
- **4px offset**: Small gap between trigger and tooltip for polish

**Tooltip positioning**:
```tsx
// Default: Bottom (shows below trigger)
<TooltipContent>Content</TooltipContent>

// Top (shows above trigger)
<TooltipContent side="top">Content</TooltipContent>

// Left/Right
<TooltipContent side="left">Content</TooltipContent>
<TooltipContent side="right">Content</TooltipContent>

// With custom offset
<TooltipContent side="top" sideOffset={8}>
  Further from trigger
</TooltipContent>
```

**Avoid**:
```tsx
// BAD: Don't hardcode delayDuration everywhere
<TooltipProvider delayDuration={300}>  // Inconsistent UX
<TooltipProvider delayDuration={200}>  // Different timing

// GOOD: Use component defaults (1000ms)
<Tooltip>  // Uses 1s delay automatically
```

---

### Import Order

```tsx
// 1. React & external libraries
import React, { useState } from "react";
import { useParams } from "react-router-dom";

// 2. Contexts
import { useAuth } from "./contexts/AuthContext";
import { usePermissions } from "./contexts/PermissionContext";

// 3. Hooks
import { useCache } from "./hooks/useCache";

// 4. Services
import { linearTeamService } from "./services/linearTeamService";

// 5. Components
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";

// 6. Types
import type { Team, User } from "./types";

// 7. Utils
import { formatDate } from "./utils/helpers";
```

---

## Quick Reference Checklist

Before submitting code, verify:

### Code Quality

- [ ] **NO EMOJIS in code, comments, or console logs**
- [ ] Used existing contexts (Auth, Permissions, etc.)
- [ ] No duplicate logic or API calls
- [ ] Components < 500 lines
- [ ] Proper TypeScript types (no `any`)
- [ ] Memoized expensive computations
- [ ] Used caching for API calls
- [ ] Error boundaries in place
- [ ] Clear, descriptive naming
- [ ] Removed commented code
- [ ] Tested critical flows

### Security (CRITICAL)

- [ ] No `innerHTML =` with user input
- [ ] No `dangerouslySetInnerHTML` with user input
- [ ] Use `textContent` or DOM API methods
- [ ] No `console.log` with token information
- [ ] No token length, presence, or timing logs
- [ ] Access tokens NOT in sessionStorage session object
- [ ] Run XSS scanner: `npx ts-node scripts/checkXSS.ts`

---

## Example: Following All Principles

```tsx
/**
 * PERFECT EXAMPLE - Follows all guidelines
 * NO EMOJIS in comments or code
 */
import { usePermissions } from "./contexts/PermissionContext"; // DRY: Use existing
import { useCache } from "./hooks/useCache"; // Performance: Cache layer
import { linearTeamService } from "./services/linearTeamService"; // DRY: Existing service

interface TeamListProps {
  customerId: string;
}

/**
 * Display customer's teams with permission checks
 * Simple, focused component following KISS principle
 */
export function TeamList({ customerId }: TeamListProps) {
  // DRY: Use existing permission context
  const { hasPermission } = usePermissions();

  // Performance: Cache expensive team fetch
  const { data: teams, loading } = useCache(
    `customer-${customerId}-teams`,
    () => linearTeamService.getCustomerTeams(customerId),
  );

  // KISS: Simple permission check
  const canManageTeams = hasPermission("manage_teams");

  if (loading) return <PageLoading />;
  if (!teams?.length)
    return <EmptyState message="No teams found" />;

  return (
    <div className="space-y-4">
      {teams.map((team) => (
        <TeamCard
          key={team.id}
          team={team}
          showActions={canManageTeams}
        />
      ))}
    </div>
  );
}
```

---

## Common Anti-Patterns to Avoid

### 1. **Using Emojis in Code**

```tsx
// BAD: Emojis in code
console.log("[Service] Success");
// CRITICAL: Important validation
const status = "Deploying";

// GOOD: Clean text only
console.log("[Service] Success");
// CRITICAL: Important validation
const status = "Deploying";
```

### 2. **God Components**

```tsx
// BAD: 1000+ line component doing everything
function MegaComponent() {
  // 50 useState declarations
  // 30 useEffect hooks
  // Complex business logic
  // API calls
  // Multiple features
  // Rendering logic
}

// GOOD: Split into focused components
function TeamPage() {
  return (
    <>
      <TeamHeader />
      <TeamStats />
      <TeamIssuesKanban />
      <TeamMembers />
    </>
  );
}
```

### 3. **Prop Drilling Hell**

```tsx
// BAD: Passing props through 5 levels
<GrandParent user={user}>
  <Parent user={user}>
    <Child user={user}>
      <GrandChild user={user}>
        <GreatGrandChild user={user} />

// GOOD: Use context
const { user } = useAuth(); // Available anywhere
```

### 4. **Duplicate Permission Logic**

```tsx
// BAD: Reimplementing permission checks
function MyComponent() {
  const checkPerm = async () => {
    const res = await fetch("/api/permissions");
    // ... duplicate logic
  };
}

// GOOD: Use PermissionContext
const { hasPermission } = usePermissions();
if (hasPermission("edit_issues")) {
  /* ... */
}
```

### 5. **Flash of Old Content in Modals**

**Problem**: When switching between items in a modal (e.g., different issues), the UI briefly shows the previous item's content before loading the new one.

**Root Causes:**
1. React caches rendered content between renders
2. Loading state set inside async function (too late)
3. `displayData` fallback to old data during loading

**Solution: 3-Part Fix**

#### Part 1: Add `key` prop to force unmount/remount

```tsx
// BAD: Dialog keeps same DOM, shows cached content
<Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent>
    {issue.title}  // Shows old title briefly
  </DialogContent>
</Dialog>

// GOOD: Key forces React to unmount old, mount new
<Dialog 
  key={issue.id}
  open={isOpen} 
  onOpenChange={onClose}
>
  <DialogContent>
    {issue.title}  // Always fresh
  </DialogContent>
</Dialog>
```

#### Part 2: Clear old data BEFORE setting loading

```tsx
// BAD: Loading set first, data cleared later
setLoading(true);          // Frame 1: loading=true, data=OLD
setData(null);             // Frame 2: data=null
// Result: 1 frame of old content flash

// GOOD: Clear data first, then show loading
setData(null);             // Frame 1: data=null
setLoading(true);          // Frame 1: loading=true
// Result: Immediate skeleton, no flash
```

#### Part 3: Set loading SYNCHRONOUSLY before async calls

```tsx
// BAD: Loading set inside async function (too late)
const loadData = async () => {
  setLoading(true);  // Happens AFTER async function starts
  const data = await fetch(...);
  setData(data);
  setLoading(false);
};

// GOOD: Set loading BEFORE async operation
const loadData = async () => {
  // Empty - loading already set by caller
};

// Caller:
setLoading(true);    // SYNCHRONOUS - immediate
loadData();          // ASYNC - happens later
```

#### Part 4: Never fallback to old data during loading

```tsx
// BAD: Falls back to old data when loading new
const displayData = useMemo(() => {
  if (loading && !newData) {
    return null;
  }
  return newData || oldData;  // PROBLEM: Shows oldData while loading
}, [newData, oldData, loading]);

// GOOD: Always null when loading (shows skeleton)
const displayData = useMemo(() => {
  if (loading) {
    return null;  // ALWAYS null when loading
  }
  return newData;  // No fallback
}, [newData, loading]);
```

#### Complete Example: Modal Without Content Flash

```tsx
function IssueDetailModal({ issue, isOpen, onClose }) {
  const [issueDetails, setIssueDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Load issue data
  const loadIssue = useCallback(async (issueToLoad) => {
    // Loading already set synchronously by caller
    try {
      const data = await fetchIssue(issueToLoad.id);
      setIssueDetails(data);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // When issue changes
  useEffect(() => {
    if (isOpen && issue?.id) {
      // CRITICAL ORDER:
      setIssueDetails(null);   // 1. Clear old data FIRST
      setLoading(true);         // 2. Set loading SYNCHRONOUSLY
      loadIssue(issue);         // 3. Load new data ASYNC
    }
  }, [isOpen, issue?.id, loadIssue]);
  
  // Compute display data (never fallback when loading)
  const displayData = useMemo(() => {
    if (loading) return null;  // Show skeleton
    return issueDetails;        // No fallback to issue prop
  }, [issueDetails, loading]);
  
  if (!displayData) {
    return (
      <Dialog 
        key={`loading-${issue.id}`}
        open={isOpen} 
        onOpenChange={onClose}
      >
        <DialogContent>
          <Skeleton />  // Clean skeleton, no old content
        </DialogContent>
      </Dialog>
    );
  }
  
  return (
    <Dialog 
      key={issue.id}
      open={isOpen} 
      onOpenChange={onClose}
    >
      <DialogContent>
        <h2>{displayData.title}</h2>  // Always fresh data
      </DialogContent>
    </Dialog>
  );
}
```

**Checklist for Modal Content Flash Prevention:**

- [ ] `key` prop on Dialog/Modal component (forces remount)
- [ ] Clear old data BEFORE setting loading state
- [ ] Set loading SYNCHRONOUSLY before async call
- [ ] `displayData` memo never falls back to old data
- [ ] Skeleton shown when `displayData` is null
- [ ] Both loading state and loaded state have unique keys

**Performance Impact:**
- **Before**: Flash of wrong content → Confusing UX
- **After**: Smooth skeleton transition → Professional UX
- **Cost**: Minimal (remount overhead negligible vs. UX improvement)

---

---

## Additional Resources

- [React Best Practices](https://react.dev/learn)
- [TypeScript Guidelines](https://www.typescriptlang.org/docs/)
- [Performance Optimization](https://web.dev/performance/)
- [Accessibility Standards](https://www.w3.org/WAI/WCAG21/quickref/)
- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [Security Documentation](../docs/XSS_VULNERABILITY_FIX.md)

---

**Last Updated**: January 2025  
**Version**: 2.1  
**Maintained by**: Teifi Digital Development Team