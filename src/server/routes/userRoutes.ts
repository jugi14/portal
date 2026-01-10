/**
 * User Routes - Teifi Client Portal
 *
 * User-specific endpoints for team access and permissions
 * Schema V2.0 - User > Customer > Team
 *
 * @module userRoutes
 */

import { Hono } from "hono";
import { authMiddleware } from "../authHelpers";
import * as kv from "../kv_store";

export const userRoutes = new Hono();

// ==================================================
// USER TEAM ACCESS
// ==================================================

/**
 * GET /user/teams
 * Get all teams accessible by current user
 *
 * Authorization: Bearer token required
 * Returns: Array of teams user has access to
 */
userRoutes.get("/user/teams", authMiddleware, async (c) => {
  try {
    const userId = c.get("userId");
    const userEmail = c.get("userEmail");
    const role = c.get("role");
    const isSuperAdmin = c.get("isSuperAdmin");

    console.log(
      `[UserRoutes] Fetching teams for user: ${userEmail} (${role})`,
    );

    // Superadmin/Admin gets ALL teams
    if (isSuperAdmin || role === "admin") {
      console.log(
        "[UserRoutes] Admin/Superadmin - returning all teams",
      );

      // Get all teams from KV
      const cachedHierarchy = await kv.get("linear_teams:all");

      let teams = [];
      if (cachedHierarchy) {
        // Parse if string
        const parsedCache =
          typeof cachedHierarchy === "string"
            ? JSON.parse(cachedHierarchy)
            : cachedHierarchy;

        teams = parsedCache.teams || [];
      }

      return c.json({
        success: true,
        data: {
          teams,
          count: teams.length,
          access: "all",
          reason: isSuperAdmin ? "superadmin" : "admin",
        },
      });
    }

    // Get user's customer assignments
    const userCustomers =
      (await kv.get(`user:${userId}:customers`)) || [];
    console.log(
      `[UserRoutes] User assigned to ${userCustomers.length} customers:`,
      userCustomers,
    );
    console.log(`   KV key: user:${userId}:customers`);

    if (userCustomers.length === 0) {
      return c.json({
        success: true,
        data: {
          teams: [],
          count: 0,
          access: "none",
          reason: "no_customer_assignment",
        },
      });
    }

    //CRITICAL FIX: Check team-level membership for granular access control
    const accessibleTeams = new Set();
    const teamMembershipMap = new Map(); // Track which customer each team belongs to

    console.log(
      `[UserRoutes] Checking team-level access for user ${userId}...`,
    );

    for (const customerId of userCustomers) {
      console.log(`\n[UserRoutes] Customer: ${customerId}`);
      console.log(`   KV key: customer:${customerId}:teams`);

      const customerTeams =
        (await kv.get(`customer:${customerId}:teams`)) || [];
      console.log(
        `   → Customer has ${customerTeams.length} teams:`,
        customerTeams,
      );

      if (customerTeams.length === 0) {
        console.warn(`   ️ No teams assigned to this customer`);
        continue;
      }

      // Check team-level membership for each team
      for (const teamId of customerTeams) {
        const teamMembersKey = `customer:${customerId}:team:${teamId}:members`;
        console.log(`\n   ️ [UserRoutes] Team: ${teamId}`);
        console.log(`      KV key: ${teamMembersKey}`);

        const teamMembers =
          (await kv.get(teamMembersKey)) || [];
        console.log(
          `      → ${teamMembers.length} members:`,
          teamMembers,
        );
        console.log(
          `      → User ${userId} in list: ${teamMembers.includes(userId)}`,
        );

        // Only add team if user is explicit member
        if (teamMembers.includes(userId)) {
          accessibleTeams.add(teamId);
          teamMembershipMap.set(teamId, customerId);
          console.log(`     ACCESS GRANTED`);
        } else {
          console.log(`     ACCESS DENIED`);
        }
      }
    }

    console.log(
      `\n[UserRoutes] SUMMARY: User has access to ${accessibleTeams.size} teams`,
    );
    console.log(
      `   Accessible team IDs:`,
      Array.from(accessibleTeams),
    );

    //Debug: If no teams found, provide detailed diagnosis
    if (accessibleTeams.size === 0) {
      console.error(
        `\n========== NO TEAMS ACCESSIBLE! ==========`,
      );
      console.error(`Possible causes:`);
      console.error(`  1. User not assigned to any customer`);
      console.error(`  2. Customer has no teams assigned`);
      console.error(
        `  3. User not added to team-level members (Schema V2.0)`,
      );
      console.error(`  4. Empty KV keys for team members`);
      console.error(`\nNext Steps:`);
      console.error(
        `  1. Check backend logs for detailed info`,
      );
      console.error(`  2. Verify KV storage keys:`);
      console.error(`     - user:{userId}:customers`);
      console.error(`     - customer:{customerId}:teams`);
      console.error(
        `     - customer:{customerId}:team:{teamId}:members`,
      );
      console.error(
        `  3. Admin: Open Team Assignment → Manage Team Members → Add user`,
      );
      console.error(
        `===============================================\n`,
      );

      // Log diagnostic summary
      let totalCustomerTeams = 0;
      for (const customerId of userCustomers) {
        const customerTeams =
          (await kv.get(`customer:${customerId}:teams`)) || [];
        totalCustomerTeams += customerTeams.length;
      }

      console.error(`Diagnostic Summary:`);
      console.error(`  - User ID: ${userId}`);
      console.error(`  - Email: ${userEmail}`);
      console.error(
        `  - Customers assigned: ${userCustomers.length}`,
      );
      console.error(
        `  - Total teams across customers: ${totalCustomerTeams}`,
      );
      console.error(`  - Teams user is member of: 0`);
    }

    // Get team details
    const teams = [];
    for (const teamId of accessibleTeams) {
      let team = await kv.get(`linear_teams:${teamId}`);

      // Parse if string
      if (typeof team === "string") {
        try {
          team = JSON.parse(team);
        } catch (err) {
          console.warn(
            `️ [UserRoutes] Failed to parse team ${teamId}`,
          );
          continue;
        }
      }

      if (team && team.id) {
        teams.push({
          id: team.id,
          name: team.name,
          key: team.key,
          description: team.description,
        });
      }
    }

    return c.json({
      success: true,
      data: {
        teamIds: Array.from(accessibleTeams), //Return team IDs for PermissionContext
        teams,
        count: teams.length,
        permissionModel: "team-level", //Granular team-level access
        customerCount: userCustomers.length,
      },
    });
  } catch (error) {
    console.error(
      "[UserRoutes] Error fetching user teams:",
      error,
    );
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch user teams",
      },
      { status: 500 },
    );
  }
});

/**
 * GET /user/teams/:teamId/access
 * Check if user has access to specific team
 *
 * Authorization: Bearer token required
 * Returns: Access status and details
 */
userRoutes.get(
  "/user/teams/:teamId/access",
  authMiddleware,
  async (c) => {
    try {
      const userId = c.get("userId");
      const userEmail = c.get("userEmail");
      const role = c.get("role");
      const isSuperAdmin = c.get("isSuperAdmin");
      const teamId = c.req.param("teamId");

      console.log(
        `[UserRoutes] Checking access for ${userEmail} to team ${teamId}`,
      );

      //FIX: Get team name from Linear cache OR fallback to Linear API
      const getTeamName = async (
        id: string,
      ): Promise<string | undefined> => {
        // Try cache first
        let team = await kv.get(`linear_teams:${id}`);

        // Parse if string
        if (typeof team === "string") {
          try {
            team = JSON.parse(team);
          } catch (err) {
            console.warn(
              `️ [UserRoutes] Failed to parse team ${id} from cache`,
            );
            team = null;
          }
        }

        if (team?.name) {
          console.log(
            `[UserRoutes] Team name from cache: ${team.name}`,
          );
          return team.name;
        }

        //FALLBACK: Try Linear API if not in cache
        try {
          console.log(
            `[UserRoutes] Team not in cache, fetching from Linear API...`,
          );
          const { LinearTeamService } = await import(
            "../services/linearTeamService"
          );
          const linearService = new LinearTeamService();
          const teamData = await linearService.getTeamById(id);

          if (teamData?.name) {
            console.log(
              `[UserRoutes] Team name from Linear API: ${teamData.name}`,
            );

            //Cache the team for future requests
            await kv.set(`linear_teams:${id}`, teamData);

            return teamData.name;
          }
        } catch (err) {
          console.error(
            `[UserRoutes] Failed to fetch team from Linear API:`,
            err,
          );
        }

        //ULTIMATE FALLBACK: Return team ID if all else fails
        console.warn(
          `️ [UserRoutes] Could not get team name for ${id}, using ID as fallback`,
        );
        return id;
      };

      // Superadmin/Admin has access to all teams
      if (isSuperAdmin || role === "admin") {
        const teamName = await getTeamName(teamId);

        return c.json({
          success: true,
          hasAccess: true,
          accessType: "customer-level",
          role: isSuperAdmin ? "superadmin" : "admin",
          teamName,
          teamId,
        });
      }

      // Get user's customer assignments
      const userCustomers =
        (await kv.get(`user:${userId}:customers`)) || [];
      console.log(
        `[UserRoutes] User customers:`,
        userCustomers,
      );

      // Check if any of user's customers has access to this team
      for (const customerId of userCustomers) {
        const customerTeams =
          (await kv.get(`customer:${customerId}:teams`)) || [];
        console.log(
          `[UserRoutes] Customer ${customerId} teams:`,
          customerTeams,
        );

        if (customerTeams.includes(teamId)) {
          console.log(
            `[UserRoutes] User has access via customer ${customerId}`,
          );
          const teamName = await getTeamName(teamId);

          return c.json({
            success: true,
            hasAccess: true,
            accessType: "customer-level",
            role,
            teamName,
            customerId,
            teamId,
          });
        }
      }

      // No access found
      console.log(
        `[UserRoutes] User does not have access to team ${teamId}`,
      );

      return c.json({
        success: true,
        hasAccess: false,
        accessType: null,
        teamId,
      });
    } catch (error) {
      console.error(
        "[UserRoutes] Error checking team access:",
        error,
      );
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to check team access",
        },
        { status: 500 },
      );
    }
  },
);

// ==================================================
// KANBAN SETTINGS
// ==================================================

/**
 * GET /user/teams/:teamId/kanban-settings
 * Get user's Kanban board settings for a specific team
 *
 * Authorization: Bearer token required
 * Returns: KanbanBoardSettings or null if no settings exist
 */
userRoutes.get(
  "/user/teams/:teamId/kanban-settings",
  authMiddleware,
  async (c) => {
    try {
      const userId = c.get("userId");
      const teamId = c.req.param("teamId");

      console.log(
        `[UserRoutes] GET Kanban settings for user ${userId}, team ${teamId}`,
      );

      // Get settings from KV
      const settingsKey = `user:${userId}:team:${teamId}:kanban_settings`;
      const settings = await kv.get(settingsKey);

      if (!settings) {
        console.log(
          `ℹ️ [UserRoutes] No Kanban settings found for user ${userId}, team ${teamId}`,
        );
        return c.json(
          { success: true, data: null },
          { status: 404 },
        );
      }

      console.log(`[UserRoutes] Kanban settings retrieved:`, {
        columnsCount: settings.columnsOrder?.length,
        visibleCount: settings.visibleColumns?.length,
      });

      return c.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      console.error(
        "[UserRoutes] Error fetching Kanban settings:",
        error,
      );
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch Kanban settings",
        },
        { status: 500 },
      );
    }
  },
);

/**
 * PUT /user/teams/:teamId/kanban-settings
 * Save user's Kanban board settings for a specific team
 *
 * Authorization: Bearer token required
 * Body: KanbanBoardSettings object
 * Returns: Success status
 */
userRoutes.put(
  "/user/teams/:teamId/kanban-settings",
  authMiddleware,
  async (c) => {
    try {
      const userId = c.get("userId");
      const teamId = c.req.param("teamId");
      const settings = await c.req.json();

      console.log(
        `[UserRoutes] PUT Kanban settings for user ${userId}, team ${teamId}:`,
        {
          columnsCount: settings.columnsOrder?.length,
          visibleCount: settings.visibleColumns?.length,
          hideEmptyColumns: settings.hideEmptyColumns,
        },
      );

      // Validate settings structure
      if (
        !settings.columnsOrder ||
        !Array.isArray(settings.columnsOrder)
      ) {
        return c.json(
          {
            success: false,
            error:
              "Invalid settings: columnsOrder is required and must be an array",
          },
          { status: 400 },
        );
      }

      // Add metadata
      const settingsWithMetadata = {
        ...settings,
        teamId,
        userId,
        updatedAt: new Date().toISOString(),
      };

      // Save to KV
      const settingsKey = `user:${userId}:team:${teamId}:kanban_settings`;
      await kv.set(settingsKey, settingsWithMetadata);

      console.log(
        `[UserRoutes] Kanban settings saved successfully`,
      );

      return c.json({
        success: true,
        message: "Kanban settings saved successfully",
      });
    } catch (error) {
      console.error(
        "[UserRoutes] Error saving Kanban settings:",
        error,
      );
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to save Kanban settings",
        },
        { status: 500 },
      );
    }
  },
);

/**
 * DELETE /user/teams/:teamId/kanban-settings
 * Delete user's Kanban board settings for a specific team
 *
 * Authorization: Bearer token required
 * Returns: Success status
 */
userRoutes.delete(
  "/user/teams/:teamId/kanban-settings",
  authMiddleware,
  async (c) => {
    try {
      const userId = c.get("userId");
      const teamId = c.req.param("teamId");

      console.log(
        `️ [UserRoutes] DELETE Kanban settings for user ${userId}, team ${teamId}`,
      );

      // Delete from KV
      const settingsKey = `user:${userId}:team:${teamId}:kanban_settings`;
      await kv.del(settingsKey);

      console.log(
        `[UserRoutes] Kanban settings deleted successfully`,
      );

      return c.json({
        success: true,
        message: "Kanban settings deleted successfully",
      });
    } catch (error) {
      console.error(
        "[UserRoutes] Error deleting Kanban settings:",
        error,
      );
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to delete Kanban settings",
        },
        { status: 500 },
      );
    }
  },
);