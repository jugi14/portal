/**
 * Linear Routes - Teifi Client Portal
 *
 * Linear.app integration endpoints
 * Wrapper cho linearTeamService & linearTeamIssuesService
 *
 * @module linearRoutes
 * @version 2.1.2
 * @updated 2025-10-19 - Force recompile for GraphQL cycles fix
 */

import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js";
import { authMiddleware } from "./authHelpers.tsx";
import { LinearTeamService } from "./linearTeamService.tsx";
import * as linearTeamIssuesService from "./linearTeamIssuesService.tsx";
import { teamMethodsV2 } from "./teamMethodsV2.tsx";

export const linearRoutes = new Hono();

// Apply auth middleware to all routes
linearRoutes.use("*", authMiddleware);

// Initialize Linear service
const linearService = new LinearTeamService();

// ==================================================
// LINEAR CONNECTION & TESTING
// ==================================================

/**
 * GET /linear/test
 * Test Linear API connection
 */
linearRoutes.get("/linear/test", async (c) => {
  try {
    const user = c.get("user");
    console.log(
      `[Linear] Testing connection for user: ${user.email}`,
    );

    const result = await linearService.testConnection();

    return c.json({
      success: result.success,
      message: result.message,
      data: result.data || null,
    });
  } catch (error) {
    console.error("[Linear] Test connection error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to test Linear connection",
        message:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 },
    );
  }
});

// ==================================================
// LINEAR TEAMS
// ==================================================

/**
 * GET /linear/hierarchy
 * Get team hierarchy from KV Store (cached)
 * Falls back to Linear API if not cached
 */
linearRoutes.get("/linear/hierarchy", async (c) => {
  try {
    const user = c.get("user");
    console.log(
      `[Linear] Fetching team hierarchy for user: ${user.email}`,
    );

    // Try to get from KV store first
    const { data: kvData, error: kvError } = await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )
      .from("kv_store_7f0d90fb")
      .select("value")
      .eq("key", "linear_teams:all")
      .single();

    if (kvError) {
      console.log(
        `[Linear] KV cache miss for linear_teams:all - Error: ${kvError.message}`,
      );
    }

    if (!kvError && kvData?.value) {
      const hierarchyData =
        typeof kvData.value === "string"
          ? JSON.parse(kvData.value)
          : kvData.value;

      console.log(
        `[Linear] Loaded ${hierarchyData.teams?.length || 0} teams from KV cache`,
      );
      console.log(
        `[Linear] Cache age: ${hierarchyData.syncedAt}`,
      );
      
      // Validate data structure
      if (!hierarchyData.teams || !Array.isArray(hierarchyData.teams)) {
        console.error('[Linear] Invalid KV cache data structure:', {
          hasTeams: !!hierarchyData.teams,
          isArray: Array.isArray(hierarchyData.teams),
          keys: Object.keys(hierarchyData)
        });
        // Fall through to fetch from API
      } else {
        return c.json({
          success: true,
          data: hierarchyData,
          source: "cache",
        });
      }
    }

    // Fallback: fetch from Linear API
    console.log(
      "️ [Linear] No cached data, fetching from API...",
    );
    const result = await linearService.listTeams();

    if (!result.success) {
      return c.json(
        {
          success: false,
          error: result.message || "Failed to fetch teams",
        },
        { status: 500 },
      );
    }

    return c.json({
      success: true,
      data: {
        teams: result.teams || [],
        count: result.teams?.length || 0,
        syncedAt: new Date().toISOString(),
      },
      source: "api",
    });
  } catch (error) {
    console.error("[Linear] Get hierarchy error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch team hierarchy",
        message:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 },
    );
  }
});

/**
 * GET /linear/teams
 * Get all Linear teams
 */
linearRoutes.get("/linear/teams", async (c) => {
  try {
    const user = c.get("user");
    console.log(
      `[Linear] Fetching teams for user: ${user.email}`,
    );

    const result = await linearService.listTeams();

    if (!result.success) {
      return c.json(
        {
          success: false,
          error: result.message || "Failed to fetch teams",
        },
        { status: 500 },
      );
    }

    // FIX: Use result.teams instead of result.data
    return c.json({
      success: true,
      data: result.teams || [],
    });
  } catch (error) {
    console.error("[Linear] Get teams error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch Linear teams",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
});

/**
 * POST /linear/clear-cache
 * Clear ALL Linear-related KV cache data
 * Useful when Linear data changes or becomes outdated
 * Admin/Superadmin only
 */
linearRoutes.post("/linear/clear-cache", async (c) => {
  try {
    const user = c.get("user");
    const role = c.get("role");
    const isSuperAdmin = c.get("isSuperAdmin");

    // Authorization check
    if (!["superadmin", "admin"].includes(role) && !isSuperAdmin) {
      return c.json(
        {
          success: false,
          error: "Unauthorized. Only admins can clear cache.",
        },
        { status: 403 },
      );
    }

    console.log(`[Linear Cache Clear] User: ${user.email} (role: ${role})`);
    console.log('[Linear Cache Clear] Clearing all Linear-related KV data...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Clear all Linear-related cache entries
    const keysToDelete = [
      'linear:organization',
      'linear_teams:all',
      'team_ownership_map:all',
    ];

    let deletedCount = 0;

    // Delete specific keys
    for (const key of keysToDelete) {
      const { error } = await supabase
        .from('kv_store_7f0d90fb')
        .delete()
        .eq('key', key);
      
      if (!error) {
        deletedCount++;
        console.log(`[Linear Cache Clear] Deleted: ${key}`);
      }
    }

    // Delete all keys with Linear-related prefixes
    const prefixes = ['cache:linear-teams', 'linear:', 'team:'];
    for (const prefix of prefixes) {
      const { error } = await supabase
        .from('kv_store_7f0d90fb')
        .delete()
        .like('key', `${prefix}%`);
      
      if (!error) {
        console.log(`[Linear Cache Clear] Deleted keys with prefix: ${prefix}`);
      }
    }

    // Invalidate team cache
    await teamMethodsV2.invalidateCache();

    console.log(`[Linear Cache Clear] Complete! Cleared ${deletedCount} specific keys + all prefixed keys`);

    return c.json({
      success: true,
      message: 'All Linear cache data cleared successfully',
      deletedKeys: deletedCount,
      clearedPrefixes: prefixes,
    });
  } catch (error) {
    console.error('[Linear Cache Clear] Error:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to clear cache',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
});

/**
 * POST /linear/sync-hierarchy
 * Sync all teams from Linear to KV Store
 * Admin/Superadmin only
 */
linearRoutes.post("/linear/sync-hierarchy", async (c) => {
  try {
    const user = c.get("user");
    const role = c.get("role"); //Get role from auth context (set by authMiddleware)
    const isSuperAdmin = c.get("isSuperAdmin");

    console.log(
      `[Linear] Syncing hierarchy for user: ${user.email} (role: ${role})`,
    );

    //CRITICAL: Invalidate ALL caches before sync
    console.log('[Linear] Invalidating all caches before sync...');
    await teamMethodsV2.invalidateCache();
    
    // CRITICAL: Also invalidate organization cache and linear teams cache
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    
    // Delete all Linear-related caches
    await supabase
      .from('kv_store_7f0d90fb')
      .delete()
      .or('key.eq.linear:organization,key.eq.team_ownership_map:all,key.like.cache:linear-teams%');
    
    console.log('[Linear] All Linear caches invalidated');

    //FIXED: Check role from context instead of user.user_metadata
    if (
      !["superadmin", "admin"].includes(role) &&
      !isSuperAdmin
    ) {
      console.log(
        `[Linear] Authorization failed - role: ${role}, isSuperAdmin: ${isSuperAdmin}`,
      );
      return c.json(
        {
          success: false,
          error:
            "Unauthorized. Only admins can sync team hierarchy.",
        },
        { status: 403 },
      );
    }

    const result = await linearService.syncTeamHierarchy();

    if (!result.success) {
      return c.json(
        {
          success: false,
          error:
            result.message || "Failed to sync team hierarchy",
        },
        { status: 500 },
      );
    }
    
    // CRITICAL: Log sync results for debugging
    console.log('[Linear] Sync completed successfully:', {
      totalTeams: result.data?.teamsCount || 0,
      rootTeams: result.data?.rootTeamsCount || 0,
      syncedAt: result.data?.syncedAt
    });

    return c.json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    console.error("[Linear] Sync hierarchy error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to sync team hierarchy",
        message:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 },
    );
  }
});

/**
 * GET /linear/teams/:teamId
 * Get Linear team by ID
 */
linearRoutes.get("/linear/teams/:teamId", async (c) => {
  //CRITICAL: Declare teamId outside try block for catch scope access
  const teamId = c.req.param("teamId");

  try {
    const user = c.get("user");

    console.log(
      `[Linear] Fetching team ${teamId} for user: ${user.email}`,
    );

    const result = await linearService.getTeamById(teamId);

    if (!result) {
      return c.json(
        {
          success: false,
          error: "Team not found",
          teamId,
        },
        { status: 404 },
      );
    }

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[Linear] Get team error:", error);

    //Check if team not found in Linear workspace
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("not found in Linear workspace")
    ) {
      return c.json(
        {
          success: false,
          error: "Team not found in Linear workspace",
          message:
            "This team may have been deleted from Linear or you don't have access to it.",
          teamId, //Now teamId is in scope!
        },
        { status: 404 },
      );
    }

    return c.json(
      {
        success: false,
        error: "Failed to fetch Linear team",
        message: errorMessage,
      },
      { status: 500 },
    );
  }
});

/**
 * GET /linear/teams/:teamId/config
 * Get team configuration (states, labels, members, projects)
 */
linearRoutes.get("/linear/teams/:teamId/config", async (c) => {
  //CRITICAL: Declare teamId outside try block for catch scope access
  const teamId = c.req.param("teamId");

  try {
    const user = c.get("user");

    console.log(
      `[Linear] Fetching config for team ${teamId}`,
    );

    const result =
      await linearTeamIssuesService.getTeamConfig(teamId);

    if (!result) {
      return c.json(
        {
          success: false,
          error: "Team config not found",
        },
        { status: 404 },
      );
    }

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[Linear] Get team config error:", error);

    //Check if team not found in Linear workspace
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("not found in Linear workspace")
    ) {
      return c.json(
        {
          success: false,
          error: "Team not found in Linear workspace",
          message:
            "This team may have been deleted from Linear or you don't have access to it.",
          teamId, //Now teamId is in scope!
        },
        { status: 404 },
      );
    }

    return c.json(
      {
        success: false,
        error: "Failed to fetch team config",
        message: errorMessage,
      },
      { status: 500 },
    );
  }
});

/**
 *GET /linear/teams/:teamId/state-by-name
 * LIGHTWEIGHT: Get workflow state ID by name (perfect for approve button!)
 * Query param: ?name=Client Review
 */
linearRoutes.get(
  "/linear/teams/:teamId/state-by-name",
  async (c) => {
    const teamId = c.req.param("teamId");
    const stateName = c.req.query("name");

    try {
      const user = c.get("user");

      if (!stateName) {
        return c.json(
          {
            success: false,
            error: "Missing required query parameter: name",
          },
          { status: 400 },
        );
      }

      console.log(
        `[Linear] Getting state ID for "${stateName}" in team ${teamId}`,
      );

      const stateId =
        await linearTeamIssuesService.getStateIdByName(
          teamId,
          stateName,
        );

      if (!stateId) {
        return c.json(
          {
            success: false,
            error: `State "${stateName}" not found in team`,
          },
          { status: 404 },
        );
      }

      return c.json({
        success: true,
        data: {
          stateId,
          stateName,
        },
      });
    } catch (error) {
      console.error("[Linear] Get state by name error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return c.json(
        {
          success: false,
          error: "Failed to fetch state by name",
          message: errorMessage,
        },
        { status: 500 },
      );
    }
  },
);

// ==================================================
// LINEAR TEAM ISSUES
// ==================================================

/**
 * GET /linear/teams/:teamId/issues-by-state
 * Get team issues pre-grouped by workflow states (optimized for Kanban)
 *
 * @returns {
 *   team: { id, name, key },
 *   states: [{ state: {...}, issues: [...], totalCount, rootCount, subIssueCount }],
 *   totalIssues: number,
 *   timestamp: string
 * }
 */
linearRoutes.get(
  "/linear/teams/:teamId/issues-by-state",
  async (c) => {
    //CRITICAL: Declare teamId outside try block for catch scope access
    const teamId = c.req.param("teamId");

    try {
      const user = c.get("user");

      console.log(
        `[Linear] Fetching issues by state for team ${teamId}`,
      );

      const result =
        await linearTeamIssuesService.getTeamIssuesByState(
          teamId,
        );

      if (!result) {
        return c.json(
          {
            success: false,
            error: "Failed to fetch team issues by state",
          },
          { status: 500 },
        );
      }

      return c.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "[Linear] Get team issues by state error:",
        error,
      );

      //Check if team not found in Linear workspace
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes("not found in Linear workspace")
      ) {
        return c.json(
          {
            success: false,
            error: "Team not found in Linear workspace",
            message:
              "This team may have been deleted from Linear or you don't have access to it.",
            teamId, //Now teamId is in scope!
          },
          { status: 404 },
        );
      }

      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch team issues by state",
          message: errorMessage,
        },
        { status: 500 },
      );
    }
  },
);

/**
 * GET /linear/teams/:teamId/issues
 * Get all issues for a Linear team
 */
linearRoutes.get("/linear/teams/:teamId/issues", async (c) => {
  //CRITICAL: Declare teamId outside try block for catch scope access
  const teamId = c.req.param("teamId");

  try {
    const user = c.get("user");

    console.log(`[Linear] Fetching issues for team ${teamId}`);

    // Check team access (optional - depends on your access control)
    // const accessCheck = await teamMethodsV2.checkUserTeamAccess(user.id, teamId);
    // if (!accessCheck.success) {
    //   return c.json(
    //     { success: false, error: "Access denied to this team" },
    //     { status: 403 },
    //   );
    // }

    const result =
      await linearTeamIssuesService.getTeamIssues(teamId);

    if (!result) {
      return c.json(
        {
          success: false,
          error: "Failed to fetch team issues",
        },
        { status: 500 },
      );
    }

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[Linear] Get team issues error:", error);

    //Check if team not found in Linear workspace
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("not found in Linear workspace")
    ) {
      return c.json(
        {
          success: false,
          error: "Team not found in Linear workspace",
          message:
            "This team may have been deleted from Linear or you don't have access to it.",
          teamId, //Now teamId is in scope!
        },
        { status: 404 },
      );
    }

    return c.json(
      {
        success: false,
        error: "Failed to fetch team issues",
        message: errorMessage,
      },
      { status: 500 },
    );
  }
});

/**
 * GET /linear/teams/:teamId/issues/by-state
 * Get issues grouped by state (NEW - optimized for kanban)
 */
linearRoutes.get(
  "/linear/teams/:teamId/issues/by-state",
  async (c) => {
    try {
      const user = c.get("user");
      const teamId = c.req.param("teamId");

      console.log(
        `[Linear] Fetching issues grouped by state for team ${teamId}`,
      );

      const result =
        await linearTeamIssuesService.getTeamIssuesByState(
          teamId,
        );

      if (!result) {
        return c.json(
          {
            success: false,
            error: "Failed to fetch issues by state",
          },
          { status: 500 },
        );
      }

      return c.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error(
        "[Linear] Get issues by state error:",
        error,
      );
      return c.json(
        {
          success: false,
          error: "Failed to fetch issues by state",
        },
        { status: 500 },
      );
    }
  },
);

/**
 * POST /linear/graphql
 * Execute GraphQL query/mutation against Linear API
 * Used for drag-and-drop updates and other mutations
 */
linearRoutes.post("/linear/graphql", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const { query, variables } = body;

    // CRITICAL DEBUG: Check if variables is already stringified
    console.log(`[Linear] GraphQL variables type check:`, {
      variablesType: typeof variables,
      isString: typeof variables === 'string',
      variablesValue: variables,
    });

    console.log(`[Linear] Executing GraphQL:`, {
      user: user.email,
      query: query?.trim().split("\n")[1]?.trim() || "Unknown",
      variables,
    });

    // Validate input
    if (!query) {
      return c.json(
        {
          success: false,
          error: "GraphQL query is required",
        },
        { status: 400 },
      );
    }

    // Execute query via linearTeamIssuesService
    const result =
      await linearTeamIssuesService.executeLinearQuery(
        query,
        variables || {},
      );

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[Linear] GraphQL execution error:", error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to execute GraphQL query",
      },
      { status: 500 },
    );
  }
});

/**
 * GET /linear/issues/:issueId
 * Get single issue by ID
 */
linearRoutes.get("/linear/issues/:issueId", async (c) => {
  try {
    const user = c.get("user");
    const issueId = c.req.param("issueId");

    console.log(`[Linear] Fetching issue ${issueId}`);

    const result =
      await linearTeamIssuesService.getIssueDetail(issueId);

    if (!result) {
      return c.json(
        {
          success: false,
          error: "Issue not found",
        },
        { status: 404 },
      );
    }

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[Linear] Get issue error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch issue",
      },
      { status: 500 },
    );
  }
});

/**
 * POST /linear/issues/:parentIssueId/sub-issues
 * Create sub-issue for a parent issue
 *NEW: Properly handles teamId extraction from parent
 */
linearRoutes.post(
  "/linear/issues/:parentIssueId/sub-issues",
  async (c) => {
    try {
      const user = c.get("user");
      const parentIssueId = c.req.param("parentIssueId");
      const body = await c.req.json();
      const { title, description } = body;

      console.log(
        `[Linear] Creating sub-issue for parent ${parentIssueId}:`,
        {
          user: user.email,
          title,
          hasDescription: !!description,
        },
      );

      // Validate input
      if (!title || !title.trim()) {
        return c.json(
          {
            success: false,
            error: "Title is required",
          },
          { status: 400 },
        );
      }

      // Call linearTeamIssuesService which properly handles teamId extraction
      const result =
        await linearTeamIssuesService.createSubIssue(
          parentIssueId,
          title.trim(),
          description?.trim(),
        );

      if (!result) {
        return c.json(
          {
            success: false,
            error: "Failed to create sub-issue",
          },
          { status: 500 },
        );
      }

      console.log(
        `[Linear] Sub-issue created successfully: ${result.issue?.identifier}`,
      );

      return c.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("[Linear] Create sub-issue error:", error);

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return c.json(
        {
          success: false,
          error: "Failed to create sub-issue",
          message: errorMessage,
        },
        { status: 500 },
      );
    }
  },
);

/**
 * PUT /linear/issues/:issueId/state
 * Update issue state
 */
linearRoutes.put("/linear/issues/:issueId/state", async (c) => {
  try {
    const user = c.get("user");
    const issueId = c.req.param("issueId");
    const body = await c.req.json();
    const { stateId } = body;

    console.log(
      `[Linear] Updating issue ${issueId} state to ${stateId}`,
    );

    if (!stateId) {
      return c.json(
        { success: false, error: "stateId is required" },
        { status: 400 },
      );
    }

    const result =
      await linearTeamIssuesService.updateIssueState(
        issueId,
        stateId,
      );

    if (!result) {
      return c.json(
        {
          success: false,
          error: "Failed to update issue state",
        },
        { status: 500 },
      );
    }

    return c.json({
      success: true,
      data: result,
      message: "Issue state updated successfully",
    });
  } catch (error) {
    console.error("[Linear] Update issue state error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to update issue state",
      },
      { status: 500 },
    );
  }
});

// REMOVED: Duplicate /linear/issues endpoint
// Use /issues endpoint from issueRoutes.tsx instead (has team access check)

/**
 * POST /linear/issues/create
 * Create a new parent issue in a team
 */
linearRoutes.post("/linear/issues/create", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const {
      teamId,
      title,
      description,
      priority,
      stateId,
      assigneeId,
      labelIds,
      cycleId,
    } = body;

    console.log(`[Linear] Creating issue in team ${teamId}`, {
      user: user.email,
      title,
      hasCycleId: !!cycleId,
      hasLabels: !!labelIds?.length,
    });

    // Validate required fields
    if (!teamId || !title) {
      return c.json(
        {
          success: false,
          error: "teamId and title are required",
        },
        { status: 400 },
      );
    }

    // Check team access
    const accessCheck = await teamMethodsV2.checkUserTeamAccess(
      user.id,
      teamId,
    );
    if (!accessCheck.success) {
      return c.json(
        { success: false, error: "Access denied to this team" },
        { status: 403 },
      );
    }

    // Create issue via service
    const result = await linearTeamIssuesService.createIssue({
      teamId,
      title,
      description,
      priority,
      stateId,
      assigneeId,
      labelIds,
      cycleId,
    });

    if (!result || !result.data) {
      return c.json(
        {
          success: false,
          error: "Failed to create issue",
        },
        { status: 500 },
      );
    }

    console.log(
      `[Linear] Issue created successfully: ${result.data.identifier}`,
    );

    return c.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("[Linear] Create issue error:", error);

    const errorMessage =
      error instanceof Error ? error.message : String(error);

    return c.json(
      {
        success: false,
        error: "Failed to create issue",
        message: errorMessage,
      },
      { status: 500 },
    );
  }
});

// ==================================================
// LINEAR CACHE MANAGEMENT
// ==================================================

/**
 * POST /linear/cache/invalidate
 * Invalidate Linear cache
 */
linearRoutes.post("/linear/cache/invalidate", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const { teamId } = body;

    console.log(
      `[Linear] Invalidating cache for team ${teamId || "all"}`,
    );

    const result =
      await linearTeamIssuesService.invalidateCache(teamId);

    return c.json({
      success: true,
      message: "Cache invalidated successfully",
    });
  } catch (error) {
    console.error("[Linear] Invalidate cache error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to invalidate cache",
      },
      { status: 500 },
    );
  }
});

/**
 * GET /linear/cache/stats
 * Get cache statistics (admin only)
 */
linearRoutes.get("/linear/cache/stats", async (c) => {
  try {
    const user = c.get("user");
    const role = c.get("role");

    // Only admin/superadmin can view cache stats
    if (role !== "admin" && role !== "superadmin") {
      return c.json(
        { success: false, error: "Admin access required" },
        { status: 403 },
      );
    }

    console.log(`[Linear] Fetching cache stats`);

    const result =
      await linearTeamIssuesService.getCacheStats();

    return c.json({
      success: true,
      data: result.data || {},
    });
  } catch (error) {
    console.error("[Linear] Get cache stats error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch cache stats",
      },
      { status: 500 },
    );
  }
});

// ==================================================
// LINEAR WORKFLOW STATES
// ==================================================

/**
 * GET /linear/teams/:teamId/states
 * Get workflow states for a team
 */
linearRoutes.get("/linear/teams/:teamId/states", async (c) => {
  try {
    const user = c.get("user");
    const teamId = c.req.param("teamId");

    console.log(`[Linear] Fetching states for team ${teamId}`);

    const config =
      await linearTeamIssuesService.getTeamConfig(teamId);

    if (!config) {
      return c.json(
        {
          success: false,
          error: "Team config not found",
        },
        { status: 404 },
      );
    }

    return c.json({
      success: true,
      data: {
        states: config.states || [],
        team: {
          id: config.id,
          name: config.name,
          key: config.key,
        },
      },
    });
  } catch (error) {
    console.error("[Linear] Get states error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch team states",
      },
      { status: 500 },
    );
  }
});

/**
 * GET /linear/teams/:teamId/labels
 * Get labels for a team
 */
linearRoutes.get("/linear/teams/:teamId/labels", async (c) => {
  try {
    const user = c.get("user");
    const teamId = c.req.param("teamId");

    console.log(
      `️ [Linear] Fetching labels for team ${teamId}`,
    );

    const config =
      await linearTeamIssuesService.getTeamConfig(teamId);

    if (!config) {
      return c.json(
        {
          success: false,
          error: "Team config not found",
        },
        { status: 404 },
      );
    }

    return c.json({
      success: true,
      data: {
        labels: config.labels || [],
        team: {
          id: config.id,
          name: config.name,
          key: config.key,
        },
      },
    });
  } catch (error) {
    console.error("[Linear] Get labels error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch team labels",
      },
      { status: 500 },
    );
  }
});

/**
 * GET /linear/teams/:teamId/members
 * Get Linear team members
 */
linearRoutes.get("/linear/teams/:teamId/members", async (c) => {
  try {
    const user = c.get("user");
    const teamId = c.req.param("teamId");

    console.log(`[Linear] Fetching members for team ${teamId}`);

    const config =
      await linearTeamIssuesService.getTeamConfig(teamId);

    if (!config) {
      return c.json(
        {
          success: false,
          error: "Team config not found",
        },
        { status: 404 },
      );
    }

    return c.json({
      success: true,
      data: {
        members: config.members || [],
        team: {
          id: config.id,
          name: config.name,
          key: config.key,
        },
      },
    });
  } catch (error) {
    console.error("[Linear] Get members error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch team members",
      },
      { status: 500 },
    );
  }
});

/**
 * GET /linear/teams/:teamId/projects
 * Get Linear team projects
 */
linearRoutes.get(
  "/linear/teams/:teamId/projects",
  async (c) => {
    try {
      const user = c.get("user");
      const teamId = c.req.param("teamId");

      console.log(
        `[Linear] Fetching projects for team ${teamId}`,
      );

      const config =
        await linearTeamIssuesService.getTeamConfig(teamId);

      if (!config) {
        return c.json(
          {
            success: false,
            error: "Team config not found",
          },
          { status: 404 },
        );
      }

      return c.json({
        success: true,
        data: {
          projects: config.projects || [],
          team: {
            id: config.id,
            name: config.name,
            key: config.key,
          },
        },
      });
    } catch (error) {
      console.error("[Linear] Get projects error:", error);
      return c.json(
        {
          success: false,
          error: "Failed to fetch team projects",
        },
        { status: 500 },
      );
    }
  },
);

// ==================================================
// FILE UPLOAD TO LINEAR
// ==================================================

/**
 * POST /linear/issues/:issueId/upload
 * Upload files to Linear issue
 */
linearRoutes.post(
  "/linear/issues/:issueId/upload",
  async (c) => {
    try {
      const issueId = c.req.param("issueId");

      console.log(
        `[Linear Routes] File upload request for issue: ${issueId}`,
      );
      
      // Debug headers
      const contentType = c.req.header('Content-Type');
      console.log('[Linear Routes] Content-Type:', contentType);

      // Get multipart form data
      const formData = await c.req.formData();
      const files = formData.getAll("files") as File[];

      if (!files || files.length === 0) {
        console.error('[Linear Routes] No files in formData');
        return c.json(
          { success: false, error: "No files provided" },
          { status: 400 },
        );
      }

      console.log(
        `[Linear Routes] Received ${files.length} files:`,
        files.map(f => ({ name: f.name, size: f.size, type: f.type }))
      );

      // Validate files are actual File objects
      const validFiles = files.filter(f => f instanceof File);
      if (validFiles.length === 0) {
        console.error('[Linear Routes] No valid File objects found');
        return c.json(
          { success: false, error: "No valid files found" },
          { status: 400 },
        );
      }

      // Upload files using service
      const attachments =
        await linearTeamIssuesService.uploadFilesToIssue(
          issueId,
          validFiles,
        );

      if (!attachments || attachments.length === 0) {
        console.error('[Linear Routes] No attachments returned from service');
        return c.json(
          { success: false, error: "Failed to upload any files" },
          { status: 500 },
        );
      }

      console.log(`[Linear Routes] Successfully uploaded ${attachments.length} files`);

      return c.json({
        success: true,
        data: {
          attachments,
          count: attachments.length,
        },
      });
    } catch (error) {
      console.error(
        "[Linear Routes] File upload error:",
        error,
      );
      console.error("[Linear Routes] Error stack:", error instanceof Error ? error.stack : 'No stack');
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to upload files",
        },
        { status: 500 },
      );
    }
  },
);