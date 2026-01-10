/**
 * Linear Maintenance Routes - Teifi Client Portal
 *
 * Cleanup và maintenance operations cho Linear data
 * 
 * @module linearMaintenanceRoutes
 */

import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js";
import { authMiddleware } from "./authHelpers.tsx";

export const linearMaintenanceRoutes = new Hono();

// Apply auth middleware to all routes
linearMaintenanceRoutes.use("*", authMiddleware);

/**
 * POST /linear/cleanup-orphaned-mappings
 * Clean up customer-team mappings for teams that no longer exist in Linear
 * 
 * CRITICAL: This endpoint preserves data integrity by:
 * 1. Getting all valid team IDs from Linear teams cache
 * 2. Checking all customer-team mappings
 * 3. Removing assignments to teams that were deleted in Linear
 * 4. Preserving assignments to valid teams
 * 
 * Admin/Superadmin only
 */
linearMaintenanceRoutes.post("/linear/cleanup-orphaned-mappings", async (c) => {
  try {
    const user = c.get("user");
    const role = c.get("role");
    const isSuperAdmin = c.get("isSuperAdmin");

    // Authorization check
    if (!["superadmin", "admin"].includes(role) && !isSuperAdmin) {
      return c.json(
        {
          success: false,
          error: "Unauthorized. Only admins can cleanup orphaned mappings.",
        },
        { status: 403 },
      );
    }

    console.log(`[Linear Cleanup] User: ${user.email} (role: ${role})`);
    console.log('[Linear Cleanup] Finding orphaned team mappings...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Get all valid team IDs from Linear teams
    const { data: teamsData, error: teamsError } = await supabase
      .from('kv_store_7f0d90fb')
      .select('value')
      .eq('key', 'linear_teams:all')
      .single();

    if (teamsError || !teamsData?.value) {
      return c.json(
        {
          success: false,
          error: 'Could not load teams data. Please sync teams first.',
        },
        { status: 500 },
      );
    }

    const teamsValue = typeof teamsData.value === 'string' 
      ? JSON.parse(teamsData.value) 
      : teamsData.value;
    
    const validTeamIds = new Set(
      (teamsValue.teams || []).map((t: any) => t.id)
    );

    console.log(`[Linear Cleanup] Found ${validTeamIds.size} valid teams in Linear`);

    // Get all customer-team mappings
    const { data: customerMappings, error: mappingsError } = await supabase
      .from('kv_store_7f0d90fb')
      .select('key, value')
      .like('key', 'customer_teams:%');

    if (mappingsError) {
      return c.json(
        {
          success: false,
          error: 'Failed to load customer mappings',
        },
        { status: 500 },
      );
    }

    if (!customerMappings || customerMappings.length === 0) {
      return c.json({
        success: true,
        message: 'No customer mappings found',
        data: {
          customersChecked: 0,
          orphanedRemoved: 0,
          customersUpdated: 0,
        },
      });
    }

    console.log(`[Linear Cleanup] Checking ${customerMappings.length} customer mappings...`);

    let totalOrphanedRemoved = 0;
    let customersUpdated = 0;
    const cleanupDetails: Array<{
      customerId: string;
      removed: string[];
      remaining: number;
    }> = [];

    // Check each customer's team assignments
    for (const mapping of customerMappings) {
      const customerId = mapping.key.replace('customer_teams:', '');
      const teamIds = Array.isArray(mapping.value) ? mapping.value : [];

      // Find orphaned team IDs
      const validTeams = teamIds.filter((teamId: string) => validTeamIds.has(teamId));
      const orphanedTeams = teamIds.filter((teamId: string) => !validTeamIds.has(teamId));

      if (orphanedTeams.length > 0) {
        console.log(`[Linear Cleanup] Customer ${customerId}: Removing ${orphanedTeams.length} orphaned teams`);
        console.log(`[Linear Cleanup] Orphaned team IDs:`, orphanedTeams);

        // Update customer mapping with only valid teams
        await supabase
          .from('kv_store_7f0d90fb')
          .update({
            value: validTeams,
          })
          .eq('key', `customer_teams:${customerId}`);

        totalOrphanedRemoved += orphanedTeams.length;
        customersUpdated++;

        cleanupDetails.push({
          customerId,
          removed: orphanedTeams,
          remaining: validTeams.length,
        });
      }
    }

    console.log(`[Linear Cleanup] Complete! Removed ${totalOrphanedRemoved} orphaned mappings from ${customersUpdated} customers`);

    return c.json({
      success: true,
      message: `Cleanup complete! Removed ${totalOrphanedRemoved} orphaned team assignments from ${customersUpdated} customers`,
      data: {
        customersChecked: customerMappings.length,
        orphanedRemoved: totalOrphanedRemoved,
        customersUpdated,
        validTeamsCount: validTeamIds.size,
        details: cleanupDetails,
      },
    });

  } catch (error) {
    console.error('[Linear Cleanup] Error:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to cleanup orphaned mappings',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
});

/**
 * GET /linear/validate-mappings
 * Check for orphaned team mappings without modifying them
 * 
 * Returns report of:
 * - Total customers checked
 * - Customers with orphaned mappings
 * - Details of orphaned teams
 * 
 * Admin/Superadmin only
 */
linearMaintenanceRoutes.get("/linear/validate-mappings", async (c) => {
  try {
    const user = c.get("user");
    const role = c.get("role");
    const isSuperAdmin = c.get("isSuperAdmin");

    // Authorization check
    if (!["superadmin", "admin", "client_manager"].includes(role) && !isSuperAdmin) {
      return c.json(
        {
          success: false,
          error: "Unauthorized. Only admins can validate mappings.",
        },
        { status: 403 },
      );
    }

    console.log(`[Linear Validate] User: ${user.email} (role: ${role})`);
    console.log('[Linear Validate] Checking team mappings...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Get all valid team IDs
    const { data: teamsData, error: teamsError } = await supabase
      .from('kv_store_7f0d90fb')
      .select('value')
      .eq('key', 'linear_teams:all')
      .single();

    if (teamsError || !teamsData?.value) {
      return c.json(
        {
          success: false,
          error: 'Could not load teams data. Please sync teams first.',
        },
        { status: 500 },
      );
    }

    const teamsValue = typeof teamsData.value === 'string' 
      ? JSON.parse(teamsData.value) 
      : teamsData.value;
    
    const validTeamIds = new Set(
      (teamsValue.teams || []).map((t: any) => t.id)
    );
    const teamMap = new Map(
      (teamsValue.teams || []).map((t: any) => [t.id, t])
    );

    // Get all customer-team mappings
    const { data: customerMappings } = await supabase
      .from('kv_store_7f0d90fb')
      .select('key, value')
      .like('key', 'customer_teams:%');

    if (!customerMappings || customerMappings.length === 0) {
      return c.json({
        success: true,
        message: 'No customer mappings found',
        data: {
          validTeamsCount: validTeamIds.size,
          customersChecked: 0,
          customersWithOrphans: 0,
          totalOrphaned: 0,
          issues: [],
        },
      });
    }

    const issues: Array<{
      customerId: string;
      orphanedTeams: Array<{
        teamId: string;
        note: string;
      }>;
      validTeamsCount: number;
    }> = [];

    let totalOrphaned = 0;

    // Check each customer
    for (const mapping of customerMappings) {
      const customerId = mapping.key.replace('customer_teams:', '');
      const teamIds = Array.isArray(mapping.value) ? mapping.value : [];

      const orphaned: Array<{teamId: string; note: string}> = [];

      for (const teamId of teamIds) {
        if (!validTeamIds.has(teamId)) {
          const team = teamMap.get(teamId);
          orphaned.push({
            teamId,
            note: team ? `Team "${team.name}" no longer exists` : 'Unknown team (deleted from Linear)',
          });
          totalOrphaned++;
        }
      }

      if (orphaned.length > 0) {
        issues.push({
          customerId,
          orphanedTeams: orphaned,
          validTeamsCount: teamIds.length - orphaned.length,
        });
      }
    }

    console.log(`[Linear Validate] Found ${totalOrphaned} orphaned mappings in ${issues.length} customers`);

    return c.json({
      success: true,
      message: totalOrphaned > 0 
        ? `Found ${totalOrphaned} orphaned team assignments in ${issues.length} customers. Use cleanup endpoint to remove them.`
        : 'All customer-team mappings are valid',
      data: {
        validTeamsCount: validTeamIds.size,
        customersChecked: customerMappings.length,
        customersWithOrphans: issues.length,
        totalOrphaned,
        issues,
      },
    });

  } catch (error) {
    console.error('[Linear Validate] Error:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to validate mappings',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
});
