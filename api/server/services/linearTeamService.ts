import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export class LinearTeamService {
  config;
  baseUrl = "https://api.linear.app/graphql";

  constructor(customApiKey?: string) {
    this.config = {
      apiKey:
        customApiKey || process.env.LINEAR_API_KEY || "",
      teamId: process.env.LINEAR_TEAM_ID || "",
      workspaceId: process.env.LINEAR_WORKSPACE_ID || "",
    };
  }

  async testConnection() {
    console.log("Testing Linear connection...");
    console.log("API Key present:", !!this.config.apiKey);
    console.log(
      "API Key prefix:",
      this.config.apiKey?.substring(0, 10) + "...",
    );

    if (!this.config.apiKey) {
      return {
        success: false,
        message:
          "Linear API key not configured. Please set LINEAR_API_KEY environment variable.",
      };
    }

    // Validate API key format
    if (!this.config.apiKey.startsWith("lin_api_")) {
      return {
        success: false,
        message:
          'Invalid Linear API key format. API key should start with "lin_api_"',
      };
    }

    const query = `
      query {
        viewer {
          id
          name
          email
        }
        organization {
          id
          name
        }
      }
    `;

    try {
      const result = await this.makeGraphQLRequest(query);

      if (result.data?.viewer) {
        return {
          success: true,
          message: "Linear API connection successful",
          data: {
            user: result.data.viewer,
            organization: result.data.organization,
            apiKeyPrefix:
              this.config.apiKey.substring(0, 10) + "...",
          },
        };
      }

      return {
        success: false,
        message: "Linear API returned unexpected response",
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: `Linear API connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        data: { error: error.toString() },
      };
    }
  }

  async makeGraphQLRequest(
    query: string,
    variables = {},
    options: { allowTeamNotFound?: boolean } = {},
  ) {
    if (!this.config.apiKey) {
      throw new Error("Linear API key not configured");
    }

    // Extract query name for better logging
    const queryNameMatch = query.match(/(?:query|mutation)\s+(\w+)/);
    const queryName = queryNameMatch ? queryNameMatch[1] : 'UnknownQuery';
    
    // Log detailed request information
    console.log(`[Linear TeamService] Executing ${queryName}`);
    console.log(`[Linear TeamService] Variables:`, JSON.stringify(variables, null, 2));
    
    // Log variable types for debugging type mismatches
    Object.entries(variables).forEach(([key, value]) => {
      const type = typeof value;
      const isUuid = typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
      console.log(`[Linear TeamService] Variable ${key}: ${type}${isUuid ? ' (UUID)' : ''} = ${value}`);
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      15000,
    );

    try {
      console.log(
        "Making Linear GraphQL request with API key:",
        this.config.apiKey?.substring(0, 8) + "...",
      );

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          Authorization: this.config.apiKey,
          "Content-Type": "application/json",
          "public-file-urls-expire-in": "3600", // 1 hour signed URLs for attachments
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `Linear API HTTP error: ${response.status} ${response.statusText}`;
        try {
          const errorBody = await response.text();
          console.error(
            `[Linear TeamService] HTTP Error for ${queryName}:`,
            errorBody,
          );
          errorMessage += ` - ${errorBody}`;
        } catch (e) {
          console.error(
            "Could not read error response body:",
            e,
          );
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (result.errors) {
        console.error(`[Linear TeamService] GraphQL Errors for ${queryName}:`, result.errors);
        
        // Log the exact query and variables that caused the error
        console.error(`[Linear TeamService] Failed Query: ${queryName}`);
        console.error(`[Linear TeamService] Failed Variables:`, JSON.stringify(variables, null, 2));
        console.error(`[Linear TeamService] Query Text:`, query);

        // Check for specific error types
        const errorMessage = result.errors[0]?.message || 'Unknown GraphQL error';
        
        // Type mismatch errors
        if (errorMessage.includes('Variable') && errorMessage.includes('type') && errorMessage.includes('expecting')) {
          console.error(`[Linear TeamService] TYPE MISMATCH ERROR in ${queryName}:`);
          console.error(`[Linear TeamService] Error: ${errorMessage}`);
          throw new Error(`Linear GraphQL Type Error in ${queryName}: ${errorMessage}`);
        }

        const teamNotFoundError = result.errors.find(
          (error: any) =>
            error.message?.includes("Entity not found: Team") ||
            error.extensions?.userPresentableMessage?.includes(
              "Could not find referenced Team",
            ),
        );

        if (teamNotFoundError) {
          console.log(
            "Team not found error detected:",
            teamNotFoundError,
          );
          if (options.allowTeamNotFound) {
            return {
              data: null,
              teamNotFound: true,
              errors: result.errors,
            };
          }
          throw new Error(
            `Team not found: ${teamNotFoundError.extensions?.userPresentableMessage || teamNotFoundError.message}`,
          );
        }

        // Handle authentication errors specifically
        const authError = result.errors.find(
          (error: any) =>
            error.message?.includes("authentication") ||
            error.message?.includes("Unauthorized") ||
            error.message?.includes("Invalid token") ||
            error.extensions?.code === "UNAUTHENTICATED",
        );

        if (authError) {
          console.error(
            "Linear authentication error:",
            authError,
          );
          throw new Error(
            "Linear API authentication failed. Please check your API key.",
          );
        }

        // Log detailed error for debugging
        const firstError = result.errors[0];
        throw new Error(
          `Linear API error in ${queryName}: ${firstError.message} (Code: ${firstError.extensions?.code || "Unknown"})`,
        );
      }

      console.log(`[Linear TeamService] Successfully executed ${queryName}`);
      return result;
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "AbortError"
      ) {
        throw new Error("Linear API request timed out");
      }
      throw error;
    }
  }

  /**
   *Sync team hierarchy from Linear to KV Store
   * Fetches all teams with full details and stores in hierarchical structure
   */
  async syncTeamHierarchy() {
    if (!this.config.apiKey) {
      return {
        success: false,
        message: "Linear API key not configured",
      };
    }

    console.log('[LinearTeamService] Starting team hierarchy sync...');

    //OPTIMIZED: Reduced complexity to stay under Linear's 10,000 limit
    // - Reduced pagination from 100 to 20 teams per page
    // - Removed members (can fetch separately when needed)
    // - Removed projects (can fetch separately when needed)
    // - Kept essential: parent, states, labels for hierarchy
    const query = `
      query GetTeamsWithHierarchy($after: String) {
        teams(first: 20, after: $after) {
          nodes {
            id
            name
            key
            description
            color
            icon
            createdAt
            updatedAt
            parent {
              id
              name
              key
            }
            organization {
              id
              name
            }
            states(first: 20) {
              nodes {
                id
                name
                type
                color
                position
              }
            }
            labels(first: 20) {
              nodes {
                id
                name
                color
                description
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    try {
      let allTeams: any[] = [];
      let after: string | undefined = undefined;
      let pageCount = 0;

      // Paginate through all teams
      while (true) {
        pageCount++;
        console.log(`[Sync] Fetching teams page ${pageCount}...`);
        
        const result = await this.makeGraphQLRequest(query, { after });

        if (result.data?.teams?.nodes) {
          const teams = result.data.teams.nodes;
          allTeams = allTeams.concat(teams);
          console.log(`[Sync] Page ${pageCount}: ${teams.length} teams (total: ${allTeams.length})`);

          const pageInfo = result.data.teams.pageInfo;
          if (!pageInfo.hasNextPage) {
            console.log(`[Sync] Complete! Total teams: ${allTeams.length}`);
            break;
          }

          after = pageInfo.endCursor;
        } else {
          break;
        }
      }

      if (allTeams.length === 0) {
        console.warn('️ [Sync] No teams found in Linear workspace');
        return {
          success: true,
          message: 'No teams found in Linear workspace',
          data: {
            teamsCount: 0,
            teams: [],
          },
        };
      }

      //Build hierarchy structure
      console.log(`[Sync] Building team hierarchy...`);
      
      const syncedAt = new Date().toISOString();
      
      // CRITICAL: Delete old team entries before syncing new ones
      // This prevents orphaned teams that were deleted in Linear
      console.log('[Sync] Cleaning up old team entries...');
      
      // Get all existing team keys
      const { data: oldTeamKeys } = await supabase
        .from('kv_store_7f0d90fb')
        .select('key')
        .like('key', 'linear_teams:%')
        .neq('key', 'linear_teams:all');
      
      if (oldTeamKeys && oldTeamKeys.length > 0) {
        console.log(`[Sync] Found ${oldTeamKeys.length} existing team entries`);
        
        // Delete all old team entries
        await supabase
          .from('kv_store_7f0d90fb')
          .delete()
          .like('key', 'linear_teams:%')
          .neq('key', 'linear_teams:all');
        
        console.log(`[Sync] Deleted ${oldTeamKeys.length} old team entries`);
      }
      
      // Store each team individually with parent info
      console.log('[Sync] Storing new team entries...');
      for (const team of allTeams) {
        const teamData = {
          ...team,
          parent_id: team.parent?.id || null,
          parent_name: team.parent?.name || null,
          parent_key: team.parent?.key || null,
          syncedAt,
          source: 'linear_api',
        };
        
        //FIX: Don't stringify - JSONB column handles it
        await supabase
          .from('kv_store_7f0d90fb')
          .upsert({
            key: `linear_teams:${team.id}`,
            value: teamData,  // Direct object, no stringify
          });
      }
      
      console.log(`[Sync] Stored ${allTeams.length} new team entries`);

      // Build hierarchical structure
      const buildHierarchy = (teams: any[]): any[] => {
        const teamMap = new Map(teams.map(t => [t.id, { ...t, children: [], level: 0, childCount: 0 }]));
        const rootTeams: any[] = [];
        
        // First pass: establish parent-child relationships
        for (const team of teams) {
          const teamNode = teamMap.get(team.id);
          if (!teamNode) continue;
          
          if (team.parent?.id && teamMap.has(team.parent.id)) {
            // Has parent - add to parent's children
            const parentNode = teamMap.get(team.parent.id);
            if (parentNode) {
              parentNode.children.push(teamNode);
              teamNode.level = parentNode.level + 1;
            }
          } else {
            // No parent - this is a root team
            rootTeams.push(teamNode);
          }
        }
        
        // Second pass: calculate descendant counts
        const calculateDescendants = (node: any): number => {
          if (node.children.length === 0) {
            node.childCount = 0;
            node.totalDescendants = 0;
            return 0;
          }
          
          let total = node.children.length;
          for (const child of node.children) {
            total += calculateDescendants(child);
          }
          
          node.childCount = node.children.length;
          node.totalDescendants = total;
          return total;
        };
        
        for (const root of rootTeams) {
          calculateDescendants(root);
        }
        
        return rootTeams;
      };
      
      const hierarchy = buildHierarchy(allTeams);
      
      console.log(`[Sync] Built hierarchy: ${hierarchy.length} root teams, ${allTeams.length} total teams`);

      // Store flat team list for quick access
      const teamList = allTeams.map(t => ({
        id: t.id,
        name: t.name,
        key: t.key,
        description: t.description,
        color: t.color,
        icon: t.icon,
        parent_id: t.parent?.id || null,
        parent_name: t.parent?.name || null,
      }));

      // Store both flat list and hierarchy
      //FIX: Don't stringify - JSONB column handles it
      await supabase
        .from('kv_store_7f0d90fb')
        .upsert({
          key: 'linear_teams:all',
          value: {
            teams: teamList,
            hierarchy: hierarchy,
            rootTeamsCount: hierarchy.length,
            totalTeamsCount: teamList.length,
            count: teamList.length,
            syncedAt,
          },  // Direct object, no stringify
        });

      // Store organization info if available
      if (allTeams[0]?.organization) {
        //FIX: Don't stringify - JSONB column handles it
        await supabase
          .from('kv_store_7f0d90fb')
          .upsert({
            key: 'linear:organization',
            value: {
              ...allTeams[0].organization,
              teamsCount: allTeams.length,
              syncedAt,
            },  // Direct object, no stringify
          });
      }

      console.log('[Sync] Team hierarchy successfully synced to KV');
      console.log(`[Sync] Hierarchy stats: ${hierarchy.length} roots, ${allTeams.length} total teams`);

      // CRITICAL: Validate customer-team mappings after sync
      console.log('[Sync] Validating customer-team mappings...');
      const validTeamIds = new Set(allTeams.map(t => t.id));
      
      // Get all customer-team mappings
      const { data: customerMappings } = await supabase
        .from('kv_store_7f0d90fb')
        .select('key, value')
        .like('key', 'customer_teams:%');
      
      let orphanedCount = 0;
      const orphanedMappings: Array<{customerId: string; teamIds: string[]}> = [];
      
      if (customerMappings && customerMappings.length > 0) {
        console.log(`[Sync] Checking ${customerMappings.length} customer mappings...`);
        
        for (const mapping of customerMappings) {
          const customerId = mapping.key.replace('customer_teams:', '');
          const teamIds = Array.isArray(mapping.value) ? mapping.value : [];
          
          // Find orphaned team IDs (teams that no longer exist in Linear)
          const orphaned = teamIds.filter((teamId: string) => !validTeamIds.has(teamId));
          
          if (orphaned.length > 0) {
            orphanedCount += orphaned.length;
            orphanedMappings.push({
              customerId,
              teamIds: orphaned
            });
            
            console.log(`[Sync] Customer ${customerId} has ${orphaned.length} orphaned team assignments:`, orphaned);
          }
        }
      }
      
      if (orphanedCount > 0) {
        console.log(`[Sync] WARNING: Found ${orphanedCount} orphaned team assignments across ${orphanedMappings.length} customers`);
        console.log('[Sync] These teams were deleted in Linear but still assigned to customers');
        console.log('[Sync] Use /admin/cleanup-orphaned-mappings endpoint to clean up');
      } else {
        console.log('[Sync] All customer-team mappings are valid');
      }

      return {
        success: true,
        message: `Successfully synced ${allTeams.length} teams (${hierarchy.length} root teams)`,
        data: {
          teamsCount: allTeams.length,
          rootTeamsCount: hierarchy.length,
          teams: teamList,
          hierarchy: hierarchy,
          syncedAt,
          orphanedMappings: orphanedMappings.length > 0 ? {
            count: orphanedCount,
            customers: orphanedMappings.length,
            details: orphanedMappings
          } : null
        },
      };

    } catch (error) {
      console.error('[Sync] Team hierarchy sync error:', error);
      return {
        success: false,
        message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async listTeams() {
    if (!this.config.apiKey) {
      return {
        success: false,
        message: "Linear API key not configured",
      };
    }

    //ENHANCED: Added pagination support
    const query = `
      query GetTeamsPaginated($after: String) {
        teams(first: 250, after: $after) {
          nodes {
            id
            name
            key  
            description
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    try {
      console.log("Starting Linear teams query with pagination...");
      
      let allTeams: any[] = [];
      let after: string | undefined = undefined;
      let pageCount = 0;

      while (true) {
        pageCount++;
        console.log(`[Pagination] Fetching teams page ${pageCount}`);
        
        const result = await this.makeGraphQLRequest(query, { after });

        if (result.data?.teams?.nodes) {
          const teams = result.data.teams.nodes;
          allTeams = allTeams.concat(teams);
          console.log(`[Pagination] Page ${pageCount}: Retrieved ${teams.length} teams (total: ${allTeams.length})`);

          const pageInfo = result.data.teams.pageInfo;
          if (!pageInfo.hasNextPage) {
            console.log(`[Pagination] Complete! Total teams fetched: ${allTeams.length} across ${pageCount} page(s)`);
            break;
          }

          after = pageInfo.endCursor;
        } else {
          break;
        }
      }

      if (allTeams.length > 0) {
        console.log(`Found ${allTeams.length} teams in Linear workspace`);
        return {
          success: true,
          teams: allTeams,
          message: "Teams fetched successfully",
        };
      }

      return {
        success: false,
        message: "No teams found in Linear workspace",
      };
    } catch (error) {
      console.error("Linear listTeams error:", error);
      return {
        success: false,
        message: `Failed to fetch teams: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  isValidTeamId(teamId: string | null | undefined): boolean {
    if (!teamId || typeof teamId !== "string") {
      return false;
    }

    const trimmed = teamId.trim();
    if (trimmed.length === 0) {
      return false;
    }

    return /^[a-zA-Z0-9\-_]{2,50}$/.test(trimmed);
  }

  async getTeamById(teamId: string) {
    if (!this.isValidTeamId(teamId)) {
      console.log(`Invalid team ID format: ${teamId}`);
      return null;
    }

    const query = `
      query GetTeam($teamId: String!) {
  team(id: $teamId) {
    id
    name
    key
    description
    members {
      nodes {
        name
        email
        avatarUrl
      }
    }
    states {
      nodes {
        id
        name
        type
        color
        position
      }
    }
    labels {
      nodes {
        id
        name
        color
        description
      }
    }
    createdAt
    updatedAt
  }
}
    `;

    try {
      const result = await this.makeGraphQLRequest(
        query,
        { teamId },
        { allowTeamNotFound: true },
      );

      if (result.teamNotFound) {
        console.log(
          `Team ${teamId} not found in Linear workspace`,
        );
        return null;
      }

      if (result.data?.team) {
        console.log(`Fetched team: ${result.data.team.name}`);
        return result.data.team;
      }

      return null;
    } catch (error) {
      console.error("Failed to fetch team by ID:", error);
      if (
        error instanceof Error &&
        error.message.includes("Entity not found: Team")
      ) {
        console.log(
          `Team ${teamId} does not exist in Linear workspace`,
        );
        return null;
      }
      return null;
    }
  }

  async getTeamLabels(teamId: string) {
    if (!this.isValidTeamId(teamId)) {
      console.log(
        `Invalid team ID format for labels: ${teamId}`,
      );
      return [];
    }

    const query = `
      query GetTeamLabels($teamId: String!) {
        team(id: $teamId) {
          id
          name
          labels {
            nodes {
              id
              name
              color
              description
              createdAt
            }
          }
        }
      }
    `;

    try {
      const result = await this.makeGraphQLRequest(
        query,
        { teamId },
        { allowTeamNotFound: true },
      );

      if (result.teamNotFound) {
        console.log(
          `Team ${teamId} not found when fetching labels`,
        );
        return [];
      }

      if (result.data?.team?.labels?.nodes) {
        console.log(
          `Fetched ${result.data.team.labels.nodes.length} labels for team: ${result.data.team.name}`,
        );
        return result.data.team.labels.nodes;
      }

      return [];
    } catch (error) {
      console.error("Failed to fetch team labels:", error);
      if (
        error instanceof Error &&
        error.message.includes("Entity not found: Team")
      ) {
        console.log(
          `Team ${teamId} does not exist when fetching labels`,
        );
        return [];
      }
      return [];
    }
  }

  async authenticateUser(accessToken: string) {
    if (!accessToken) {
      throw new Error("Authorization token required");
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      throw new Error("Invalid or expired token");
    }

    return {
      user,
      userEmail: user.email || "unknown",
    };
  }

  async getTeamsWithHierarchy() {
    if (!this.config.apiKey) {
      throw new Error("Linear API key not configured");
    }

    const query = `
      query GetTeamsPaginated($after: String) {
        teams(first: 250, after: $after) {
          nodes {
            id
            name
            key
            description
            parent { id name }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    let after = null;
    let allTeams = [];
    let page = 1;

    try {
      console.log("Fetching Linear teams with pagination...");

      while (true) {
        console.log(
          `️  Fetching page ${page} (after: ${after || "none"})`,
        );

        const result = await this.makeGraphQLRequest(query, {
          after,
        });

        if (!result.data?.teams?.nodes) {
          console.warn("️ No team nodes in Linear response.");
          break;
        }

        const { nodes, pageInfo } = result.data.teams;
        allTeams.push(...nodes);

        console.log(
          `Page ${page}: fetched ${nodes.length} teams (total ${allTeams.length})`,
        );

        if (!pageInfo?.hasNextPage) {
          console.log("All teams fetched from Linear.");
          break;
        }

        after = pageInfo.endCursor;
        page++;

        // Optional: wait to respect API rate limit
        await new Promise((r) => setTimeout(r, 150));
      }

      const withParent = allTeams.filter((t) => t.parent).length;
      const rootTeams = allTeams.filter((t) => !t.parent).length;

      console.log("Linear Team Stats:", {
        total: allTeams.length,
        rootTeams,
        withParent,
      });

      return allTeams;
    } catch (error) {
      console.error(
        "Failed to fetch teams with hierarchy:",
        error,
      );
      throw error;
    }
  }

  buildHierarchyFromParents(rawTeams: any[]) {
    console.log(
      "Building hierarchy from parent relationships...",
    );
    console.log(`Processing ${rawTeams.length} teams`);

    // Map team.id → team object with children array
    const teamsMap = new Map(
      rawTeams.map((t) => [
        t.id,
        {
          id: t.id,
          name: t.name,
          key: t.key || t.id,
          description: t.description || "",
          parent: t.parent,
          children: [],
          level: 0,
          childCount: 0,
          totalDescendants: 0,
        },
      ]),
    );

    console.log(`Created teams map with ${teamsMap.size} entries`);

    // Attach children manually by iterating through all teams
    for (const team of rawTeams) {
      if (team.parent?.id && teamsMap.has(team.parent.id)) {
        const parentTeam = teamsMap.get(team.parent.id);
        const childTeam = teamsMap.get(team.id);
        if (parentTeam && childTeam) {
          parentTeam.children.push(childTeam);
          console.log(
            `  ↳ Attached "${childTeam.name}" to parent "${parentTeam.name}"`,
          );
        }
      }
    }

    // Calculate hierarchy metrics (level, childCount, totalDescendants)
    const calculateMetrics = (team: any, level: number): number => {
      team.level = level;
      team.childCount = team.children.length;
      let totalDescendants = team.children.length;

      for (const child of team.children) {
        totalDescendants += calculateMetrics(child, level + 1);
      }

      team.totalDescendants = totalDescendants;
      return totalDescendants;
    };

    // Filter root teams (those without a parent)
    const roots = rawTeams
      .filter((t) => !t.parent || !t.parent.id)
      .map((t) => teamsMap.get(t.id))
      .filter(Boolean);

    console.log(`Found ${roots.length} root teams`);

    // Calculate metrics for all root teams and their descendants
    for (const root of roots) {
      calculateMetrics(root, 0);
      console.log(
        ` Root: "${root.name}" [${root.key}] - ${root.childCount} direct children, ${root.totalDescendants} total descendants`,
      );
    }

    // Sort roots alphabetically
    roots.sort((a: any, b: any) => a.name.localeCompare(b.name));

    console.log(
      `Built hierarchy: ${roots.length} root teams with full tree structure`,
    );
    return roots;
  }

  buildHierarchyFromNested(rawTeams: any[]) {
    console.log(
      "️ buildHierarchyFromNested is deprecated, using buildHierarchyFromParents instead",
    );
    return this.buildHierarchyFromParents(rawTeams);
  }

  countAllTeams(teams: any[]): number {
    return teams.reduce((count, team) => {
      return (
        count + 1 + this.countAllTeams(team.children || [])
      );
    }, 0);
  }

  async validateTeam(teamId: string) {
    const startTime = Date.now();
    const result: any = {
      success: false,
      message: "",
      team: null,
      error: null,
      details: [],
      timestamp: new Date().toISOString(),
      responseTime: 0,
    };

    try {
      if (
        !teamId ||
        typeof teamId !== "string" ||
        teamId.trim() === ""
      ) {
        result.error =
          "Team ID is required and must be a non-empty string";
        result.details = [
          "Provide a valid team ID (not empty, null, or whitespace)",
          "Team ID should be a string format",
          "Check if the team ID was passed correctly",
        ];
        return result;
      }

      if (!this.isValidTeamId(teamId)) {
        result.error = "Invalid team ID format";
        result.details = [
          "Team ID must be 2-50 characters with alphanumeric, hyphens, or underscores only",
          'Examples: "a1", "team-backend-dev", "eng_platform_123"',
          "Copy team ID directly from Linear interface",
          `Provided: "${teamId}" (${teamId.length} chars)`,
        ];
        return result;
      }

      if (!this.config.apiKey) {
        result.error = "Linear API key not configured";
        result.details = [
          "Set LINEAR_API_KEY environment variable",
          "Generate API key from Linear Settings → API",
          "Ensure API key has team read permissions",
        ];
        return result;
      }

      const query = `
        query ValidateTeam($teamId: ID!) {
          team(id: $teamId) {
            id
            name
            key
            description
            createdAt
            updatedAt
          }
        }
      `;

      console.log(`Validating team ID: ${teamId}`);
      const apiResult = await this.makeGraphQLRequest(
        query,
        { teamId },
        { allowTeamNotFound: true },
      );

      if (apiResult.teamNotFound) {
        result.error = "Team not found in workspace";
        result.details = [
          "Contact Linear admin if team should exist",
        ];
        return result;
      }

      if (apiResult.data?.team) {
        result.success = true;
        result.message = `Team found: ${apiResult.data.team.name} (${apiResult.data.team.key})`;
        result.team = apiResult.data.team;
        result.details = [
          "Team validation successful",
          "Team exists and is accessible",
        ];
        return result;
      }

      result.error = "Unexpected response from Linear API";
      result.details = ["Try again in a few moments"];
      return result;
    } catch (error) {
      console.error("Team validation error:", error);

      if (error instanceof Error) {
        if (error.message.includes("Entity not found: Team")) {
          result.error = "Team entity not found";
          result.details = [
            "Verify API key has sufficient permissions",
          ];
        } else if (error.message.includes("Unauthorized")) {
          result.error = "API authentication failed";
          result.details = [
            "Invalid or expired Linear API key",
          ];
        } else if (error.message.includes("timeout")) {
          result.error = "Linear API request timeout";
          result.details = ["Try again in a few moments"];
        } else {
          result.error = error.message;
          result.details = ["Check server logs for details"];
        }
      }

      return result;
    } finally {
      result.responseTime = Date.now() - startTime;
    }
  }

  async getSingleTeam(teamId: string) {
    if (!this.isValidTeamId(teamId)) {
      console.log(`Invalid team ID format: ${teamId}`);
      return null;
    }

    const query = `
      query GetSingleTeam($teamId: ID!) {
        team(id: $teamId) {
          id
          name
          key
          description
          parent {
            id
            name
            key
          }
          members {
            nodes {
              id
              name
              email
              avatarUrl
            }
          }
          states {
            nodes {
              id
              name
              type
              color
              position
            }
          }
          labels {
            nodes {
              id
              name
              color
              description
            }
          }
          createdAt
          updatedAt
        }
      }
    `;

    try {
      const result = await this.makeGraphQLRequest(
        query,
        { teamId },
        { allowTeamNotFound: true },
      );

      if (result.teamNotFound) {
        console.log(
          `Team ${teamId} not found in Linear workspace`,
        );
        return null;
      }

      if (result.data?.team) {
        console.log(
          `Fetched single team: ${result.data.team.name} (${result.data.team.key})`,
        );
        return result.data.team;
      }

      return null;
    } catch (error) {
      console.error("Failed to fetch single team:", error);
      return null;
    }
  }

  async getTeamsBatch(
    teamIds: string[],
    includeDetails = false,
  ) {
    if (!teamIds || teamIds.length === 0) {
      return [];
    }

    const BATCH_SIZE = 10;
    const batches = [];

    for (let i = 0; i < teamIds.length; i += BATCH_SIZE) {
      batches.push(teamIds.slice(i, i + BATCH_SIZE));
    }

    console.log(
      `Processing ${teamIds.length} teams in ${batches.length} batches`,
    );

    const results = [];

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(async (teamId) => {
          try {
            if (includeDetails) {
              return await this.getSingleTeam(teamId);
            } else {
              const query = `
                query GetTeamBasic($teamId: String!) {
                  team(id: $teamId) {
                    id
                    name
                    key
                    description
                    parent {
                      id
                      name
                      key
                    }
                  }
                }
              `;
              const result = await this.makeGraphQLRequest(
                query,
                { teamId },
              );
              return result.data?.team || null;
            }
          } catch (error) {
            console.warn(
              `Failed to fetch team ${teamId}:`,
              (error as Error).message,
            );
            return null;
          }
        }),
      );

      results.push(...batchResults.filter(Boolean));

      if (batches.length > 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, 100),
        );
      }
    }

    console.log(
      `Successfully fetched ${results.length}/${teamIds.length} teams`,
    );
    return results;
  }

  async getProcessedTeamsHierarchy(page = 1, pageSize = 50) {
    const rawTeams = await this.getTeamsWithHierarchy();

    if (!rawTeams || rawTeams.length === 0) {
      throw new Error(
        "No teams data available from Linear API",
      );
    }

    const hierarchy = this.buildHierarchyFromNested(rawTeams);
    const totalTeams = this.countAllTeams(hierarchy);

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedHierarchy = hierarchy.slice(
      startIndex,
      endIndex,
    );

    const response = {
      totalTeams,
      rootTeams: hierarchy.length,
      currentPage: page,
      pageSize,
      totalPages: Math.ceil(hierarchy.length / pageSize),
      hierarchy: paginatedHierarchy,
      hasMore: endIndex < hierarchy.length,
    };

    console.log("Paginated team hierarchy response:", {
      totalTeams: response.totalTeams,
      rootTeams: response.rootTeams,
      currentPage: response.currentPage,
      totalPages: response.totalPages,
      returnedRootTeams: paginatedHierarchy.length,
    });

    return response;
  }

  buildTeamHierarchyResponse(rawTeams: any[]) {
    const hierarchy = this.buildHierarchyFromNested(rawTeams);
    const totalTeams = this.countAllTeams(hierarchy);

    const response = {
      totalTeams,
      rootTeams: hierarchy.length,
      hierarchy,
    };

    console.log("Team hierarchy response:", {
      totalTeams: response.totalTeams,
      rootTeams: response.rootTeams,
      rootTeamNames: response.hierarchy.map(
        (t: any) =>
          `${t.name} [${t.key}] (${t.totalDescendants} descendants)`,
      ),
    });

    return response;
  }

  async determineTeamAssignment(
    feature: string,
    customerContext: any,
  ) {
    console.log(
      `Determining team assignment for feature: ${feature}`,
      customerContext,
    );

    const rawTeams = await this.getTeamsWithHierarchy();

    if (feature.toLowerCase().includes("inventory")) {
      const inventoryTeam = rawTeams.find(
        (team: any) =>
          team.name.toLowerCase().includes("inventory") ||
          team.key.toLowerCase().includes("inv"),
      );

      if (inventoryTeam) {
        console.log(
          `Assigned to inventory team: ${inventoryTeam.name}`,
        );
        return inventoryTeam.id;
      }
    }

    if (rawTeams.length > 0) {
      console.log(`Default assignment to: ${rawTeams[0].name}`);
      return rawTeams[0].id;
    }

    throw new Error("No teams available for assignment");
  }

  async autoAssignEpicOwner(epic: string) {
    console.log(`Auto-assigning epic owner for: ${epic}`);

    try {
      const rawTeams = await this.getTeamsWithHierarchy();

      if (rawTeams.length > 0) {
        console.log(
          `Epic ${epic} assignment logic not yet implemented`,
        );
        return undefined;
      }

      return undefined;
    } catch (error) {
      console.error("Error in autoAssignEpicOwner:", error);
      return undefined;
    }
  }

  /**
   * Sync all teams from Linear to KV store
   * This should be called once initially and then on-demand by superadmin
   */
  async syncTeamsToKV() {
    console.log("Starting Linear teams sync to KV store...");
    
    try {
      // Import KV store
      const kv = await import("../kv_store");
      
      // Fetch all teams from Linear with hierarchy
      console.log("Fetching all teams from Linear API...");
      const rawTeams = await this.getTeamsWithHierarchy();
      
      if (!rawTeams || rawTeams.length === 0) {
        throw new Error("No teams found in Linear workspace");
      }
      
      console.log(`Fetched ${rawTeams.length} teams from Linear`);
      
      // Store each team individually
      const teamIds: string[] = [];
      const syncStartTime = Date.now();
      
      for (const team of rawTeams) {
        const teamData = {
          id: team.id,
          name: team.name,
          key: team.key,
          description: team.description || null,
          parent: team.parent || null,
          createdAt: team.createdAt || new Date().toISOString(),
          updatedAt: team.updatedAt || new Date().toISOString(),
          syncedAt: new Date().toISOString(),
        };
        
        // Store individual team
        await kv.set(`linear_teams:${team.id}`, teamData);
        teamIds.push(team.id);
        
        console.log(` Synced team: ${team.name} [${team.key}]`);
      }
      
      // Store list of all team IDs for quick lookup
      await kv.set("linear_teams:all", teamIds);
      
      // Store sync metadata
      const syncMetadata = {
        lastSync: new Date().toISOString(),
        teamCount: rawTeams.length,
        syncDuration: Date.now() - syncStartTime,
        source: "Linear API",
      };
      await kv.set("linear_teams:metadata", syncMetadata);
      
      console.log(`Successfully synced ${rawTeams.length} teams to KV store`);
      console.log(`Sync duration: ${syncMetadata.syncDuration}ms`);
      
      return {
        success: true,
        teamCount: rawTeams.length,
        syncMetadata,
        teams: rawTeams,
      };
    } catch (error) {
      console.error("Failed to sync teams to KV:", error);
      throw error;
    }
  }

  /**
   * Get all teams from KV store
   */
  async getTeamsFromKV() {
    console.log("Fetching teams from KV store...");
    
    try {
      const kv = await import("../kv_store");
      
      // Get list of all team IDs
      const teamIds = await kv.get("linear_teams:all");
      
      if (!teamIds || !Array.isArray(teamIds)) {
        console.warn("️ No teams found in KV store. Need to sync from Linear first.");
        return {
          success: false,
          message: "No teams synced yet. Please sync from Linear first.",
          teams: [],
          metadata: null,
        };
      }
      
      console.log(`Found ${teamIds.length} team IDs in KV store`);
      
      // Fetch all teams data
      const teams = [];
      for (const teamId of teamIds) {
        const teamData = await kv.get(`linear_teams:${teamId}`);
        if (teamData) {
          teams.push(teamData);
        }
      }
      
      // Get sync metadata
      const metadata = await kv.get("linear_teams:metadata");
      
      console.log(`Retrieved ${teams.length} teams from KV store`);
      if (metadata) {
        console.log(`ℹ️  Last sync: ${metadata.lastSync}`);
      }
      
      return {
        success: true,
        teams,
        metadata,
      };
    } catch (error) {
      console.error("Failed to get teams from KV:", error);
      throw error;
    }
  }

  /**
   * Get teams hierarchy from KV store
   */
  async getTeamsHierarchyFromKV() {
    console.log("Building teams hierarchy from KV store...");
    
    const kvResult = await this.getTeamsFromKV();
    
    if (!kvResult.success || !kvResult.teams || kvResult.teams.length === 0) {
      return {
        success: false,
        message: kvResult.message || "No teams available",
        hierarchy: [],
        totalTeams: 0,
        rootTeams: 0,
        metadata: null,
      };
    }
    
    // Build hierarchy from KV teams
    const hierarchy = this.buildHierarchyFromParents(kvResult.teams);
    const totalTeams = this.countAllTeams(hierarchy);
    
    console.log(`Built hierarchy: ${hierarchy.length} root teams, ${totalTeams} total teams`);
    
    return {
      success: true,
      hierarchy,
      totalTeams,
      rootTeams: hierarchy.length,
      metadata: kvResult.metadata,
    };
  }

  /**
   * Get single team from KV store by ID
   */
  async getTeamFromKV(teamId: string) {
    console.log(`Fetching team ${teamId} from KV store...`);
    
    try {
      const kv = await import("../kv_store");
      const teamData = await kv.get(`linear_teams:${teamId}`);
      
      if (teamData) {
        console.log(`Found team in KV: ${teamData.name} [${teamData.key}]`);
        return teamData;
      }
      
      console.warn(`️ Team ${teamId} not found in KV store`);
      return null;
    } catch (error) {
      console.error(`Failed to get team ${teamId} from KV:`, error);
      return null;
    }
  }
}