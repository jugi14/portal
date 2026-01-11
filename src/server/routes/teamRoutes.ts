/**
 *Team Routes - Teifi Client Portal
 *
 * Team management, hierarchy, access control
 * Schema V2.0 - Customer > Team architecture
 *
 * @module teamRoutes
 */

import { Hono } from "hono";
import { supabase, authMiddleware } from "../authHelpers";
import { teamMethodsV2 } from "../methods/teamMethodsV2";
import { adminHelpers } from "../helpers/adminHelpers";
import * as kv from "../kv_store";

export const teamRoutes = new Hono();

// Apply auth middleware to all routes
teamRoutes.use("*", authMiddleware);

// ==================================================
// TEAM ACCESS & HIERARCHY
// ==================================================

/**
 * GET /teams/my-teams
 * Get current user's assigned teams
 */
teamRoutes.get("/teams/my-teams", async (c) => {
  try {
    const user = c.get("user");

    const result = await teamMethodsV2.getUserTeams(user.id);

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("[Teams] Get user teams error:", error);
    return c.json(
      { success: false, error: "Failed to fetch user teams" },
      { status: 500 }
    );
  }
});

/**
 * GET /teams/hierarchy
 * Get team hierarchy for current user
 *
 * ️ IMPORTANT: This MUST be defined BEFORE /teams/:teamId to avoid route conflicts
 *PERMISSION: Open to all authenticated users (no special permission required)
 */
teamRoutes.get("/teams/hierarchy", async (c) => {
  try {
    const user = c.get("user");
    const role = c.get("role");
    const isSuperAdmin = c.get("isSuperAdmin");
    const userPermissions = c.get("userPermissions");

    //Enhanced logging for debugging
    // Validate user context
    if (!user || !user.id) {
      console.error("[Teams] Missing user context in request");
      return c.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const result = await teamMethodsV2.getTeamHierarchy(user.id, isSuperAdmin);

    if (!result.success) {
      console.error(`[Teams] getTeamHierarchy failed:`, result.error);
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("[Teams] Get hierarchy error:", error);
    return c.json(
      { success: false, error: "Failed to fetch team hierarchy" },
      { status: 500 }
    );
  }
});

/**
 * GET /teams/:teamId/access
 * Check if user has access to a specific team
 */
teamRoutes.get("/teams/:teamId/access", async (c) => {
  try {
    const user = c.get("user");
    const teamId = c.req.param("teamId");

    const result = await teamMethodsV2.checkUserTeamAccess(user.id, teamId);

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 403 });
    }

    return c.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("[Teams] Check team access error:", error);
    return c.json(
      { success: false, error: "Failed to check team access" },
      { status: 500 }
    );
  }
});

/**
 * GET /teams/:teamId
 * Get team by ID with full details including hierarchy
 *
 * Query params:
 * - includeHierarchy=true - Include parent/children relationships
 */
teamRoutes.get("/teams/:teamId", async (c) => {
  try {
    const user = c.get("user");
    const teamId = c.req.param("teamId");
    const includeHierarchy = c.req.query("includeHierarchy") !== "false"; // Default true

    // Check user access to team
    const accessCheck = await teamMethodsV2.checkUserTeamAccess(
      user.id,
      teamId
    );
    if (!accessCheck.success) {
      return c.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Get team with details
    const result = await teamMethodsV2.getTeamById(teamId, includeHierarchy);

    if (!result.success) {
      return c.json(
        { success: false, error: result.error },
        { status: result.error === "Team not found" ? 404 : 500 }
      );
    }

    return c.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("[Teams] Get team error:", error);
    return c.json(
      { success: false, error: "Failed to fetch team" },
      { status: 500 }
    );
  }
});

/**
 * GET /teams
 * Get all teams with optional hierarchy
 *
 * Query params:
 * - includeHierarchy=true - Include parent-child tree structure
 */
teamRoutes.get("/teams", async (c) => {
  try {
    const user = c.get("user");
    const role = c.get("role");
    const includeHierarchy = c.req.query("includeHierarchy") === "true"; // Default false

    // Admin/superadmin can see all teams
    const result = await teamMethodsV2.getAllTeams(includeHierarchy);

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("[Teams] Get all teams error:", error);
    return c.json(
      { success: false, error: "Failed to fetch teams" },
      { status: 500 }
    );
  }
});

// ==================================================
// TEAM CRUD (Admin only)
// ==================================================

/**
 * POST /teams
 * Create new team
 */
teamRoutes.post("/teams", async (c) => {
  try {
    const user = c.get("user");
    const role = c.get("role");

    // Check admin permission
    if (role !== "admin" && role !== "superadmin") {
      return c.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await c.req.json();
    const { customer_id, name, linear_team_id, linear_team_key } = body;

    if (!customer_id || !name) {
      return c.json(
        { success: false, error: "customer_id and name are required" },
        { status: 400 }
      );
    }

    const result = await teamMethodsV2.createTeam(
      { customer_id, name, linear_team_id, linear_team_key },
      user.id
    );

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      data: result.data,
      message: "Team created successfully",
    });
  } catch (error) {
    console.error("[Teams] Create team error:", error);
    return c.json(
      { success: false, error: "Failed to create team" },
      { status: 500 }
    );
  }
});

/**
 * PUT /teams/:teamId
 * Update team
 */
teamRoutes.put("/teams/:teamId", async (c) => {
  try {
    const user = c.get("user");
    const role = c.get("role");
    const teamId = c.req.param("teamId");

    // Check admin permission
    if (role !== "admin" && role !== "superadmin") {
      return c.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await c.req.json();
    const { name, linear_team_id, linear_team_key, status } = body;

    const result = await teamMethodsV2.updateTeam(
      teamId,
      { name, linear_team_id, linear_team_key, status },
      user.id
    );

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      data: result.data,
      message: "Team updated successfully",
    });
  } catch (error) {
    console.error("[Teams] Update team error:", error);
    return c.json(
      { success: false, error: "Failed to update team" },
      { status: 500 }
    );
  }
});

/**
 * DELETE /teams/:teamId
 * Delete team
 */
teamRoutes.delete("/teams/:teamId", async (c) => {
  try {
    const user = c.get("user");
    const role = c.get("role");
    const teamId = c.req.param("teamId");

    // Check admin permission
    if (role !== "admin" && role !== "superadmin") {
      return c.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    const result = await teamMethodsV2.deleteTeam(teamId, user.id);

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      message: "Team deleted successfully",
    });
  } catch (error) {
    console.error("[Teams] Delete team error:", error);
    return c.json(
      { success: false, error: "Failed to delete team" },
      { status: 500 }
    );
  }
});

// ==================================================
// LINEAR SYNC
// ==================================================

/**
 * POST /teams/sync-from-linear
 * Sync teams from Linear API to KV database
 * Admin only
 */
teamRoutes.post("/teams/sync-from-linear", async (c) => {
  try {
    const user = c.get("user");
    const role = c.get("role");

    // Check admin permission
    if (role !== "admin" && role !== "superadmin") {
      return c.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    // Import LinearTeamService
    const { LinearTeamService } = await import("../services/linearTeamService");
    const linearService = new LinearTeamService();

    // Fetch all teams from Linear
    const linearResult = await linearService.listTeams();

    if (!linearResult.success || !linearResult.teams) {
      console.error(
        "[Teams] Failed to fetch teams from Linear:",
        linearResult.message
      );
      return c.json(
        {
          success: false,
          error: linearResult.message || "Failed to fetch teams from Linear",
        },
        { status: 500 }
      );
    }

    const teams = linearResult.teams;

    // Save teams to KV database
    let syncedCount = 0;
    let errorCount = 0;

    for (const team of teams) {
      try {
        const teamKey = `linear_teams:${team.id}`;

        // Save team data
        await kv.set(teamKey, {
          id: team.id,
          name: team.name,
          key: team.key,
          description: team.description || "",
          state: "active",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          synced_from_linear: true,
          last_sync: new Date().toISOString(),
        });

        syncedCount++;
      } catch (error) {
        errorCount++;
        console.error(`[Teams] Failed to sync team ${team.name}:`, error);
      }
    }

    return c.json({
      success: true,
      data: {
        total: teams.length,
        synced: syncedCount,
        errors: errorCount,
      },
      message: `Successfully synced ${syncedCount} teams from Linear`,
    });
  } catch (error) {
    console.error("[Teams] Sync from Linear error:", error);
    return c.json(
      { success: false, error: "Failed to sync teams from Linear" },
      { status: 500 }
    );
  }
});

// ==================================================
// TEAM MEMBER MANAGEMENT
// ==================================================

/**
 * GET /teams/:teamId/members
 * Get team members
 */
teamRoutes.get("/teams/:teamId/members", async (c) => {
  try {
    const user = c.get("user");
    const teamId = c.req.param("teamId");

    // Check user has access to this team
    const accessCheck = await teamMethodsV2.checkUserTeamAccess(
      user.id,
      teamId
    );
    if (!accessCheck.success) {
      return c.json(
        { success: false, error: "Access denied to this team" },
        { status: 403 }
      );
    }

    const result = await teamMethodsV2.getTeamMembers(teamId);

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("[Teams] Get team members error:", error);
    return c.json(
      { success: false, error: "Failed to fetch team members" },
      { status: 500 }
    );
  }
});

/**
 * POST /teams/:teamId/members/:userId
 * Add member to team
 */
teamRoutes.post("/teams/:teamId/members/:userId", async (c) => {
  try {
    const user = c.get("user");
    const role = c.get("role");
    const teamId = c.req.param("teamId");
    const userId = c.req.param("userId");

    // Check admin permission
    if (
      role !== "admin" &&
      role !== "superadmin" &&
      role !== "client_manager"
    ) {
      return c.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const result = await teamMethodsV2.addMemberToTeam(teamId, userId, user.id);

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      message: "Member added to team successfully",
    });
  } catch (error) {
    console.error("[Teams] Add member error:", error);
    return c.json(
      { success: false, error: "Failed to add member to team" },
      { status: 500 }
    );
  }
});

/**
 * DELETE /teams/:teamId/members/:userId
 * Remove member from team
 */
teamRoutes.delete("/teams/:teamId/members/:userId", async (c) => {
  try {
    const user = c.get("user");
    const role = c.get("role");
    const teamId = c.req.param("teamId");
    const userId = c.req.param("userId");

    // Check admin permission
    if (
      role !== "admin" &&
      role !== "superadmin" &&
      role !== "client_manager"
    ) {
      return c.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const result = await teamMethodsV2.removeMemberFromTeam(
      teamId,
      userId,
      user.id
    );

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      message: "Member removed from team successfully",
    });
  } catch (error) {
    console.error("[Teams] Remove member error:", error);
    return c.json(
      { success: false, error: "Failed to remove member from team" },
      { status: 500 }
    );
  }
});
