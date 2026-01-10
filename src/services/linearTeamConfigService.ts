/**
 * Linear Team Configuration Service
 *
 * Simplified service using REST API endpoints instead of GraphQL
 * Focused on team configuration and issues management
 * Provides consistent data format and error handling
 * 
 * OPTIMIZED: Uses TeamConfigCacheService for team configs
 * FIXED: Uses global apiClient for proper auth token sync
 */

import {
  createApiClient,
  TeamConfig,
  LinearIssue,
  extractTeamId,
  isTeamNotFoundError,
} from "../utils/apiHelpers";
import { globalCache } from "./cacheService";
import { apiClient as globalApiClient } from "./apiClient";

export class LinearTeamConfigService {
  private apiClient: ReturnType<typeof createApiClient>;
  private accessToken?: string;

  constructor(accessToken?: string) {
    this.apiClient = createApiClient(accessToken);
    this.accessToken = accessToken;
    
    // SECURITY: Do not log token information
  }

  /**
   * Get team configuration with proper error handling for UUID teams
   * Uses cache for faster access with 24 hour TTL
   */
  async getTeamConfig(teamId: string, forceRefresh = false): Promise<TeamConfig> {
    const cleanTeamId = extractTeamId(teamId);

    try {
      // Try cache first unless force refresh
      if (!forceRefresh) {
        const cached = globalCache.get<TeamConfig>(
          `team-config:${cleanTeamId}`,
          { fallback: 'sessionStorage' }
        );
        
        if (cached) {
          console.log(`[LinearTeamConfig] Using cached config for ${cleanTeamId}`);
          return cached;
        }
      }

      // Fetch from API using global apiClient
      console.log(`[LinearTeamConfig] Fetching config from API for ${cleanTeamId}`);
      
      // Use global apiClient for authenticated requests
      const response = await globalApiClient.get(`/linear/teams/${cleanTeamId}/config`);

      if (!response.success) {
        console.warn(
          `Team config API failed:`,
          response.error,
        );

        // Check if it's a team not found error
        if (isTeamNotFoundError(response.error || "")) {
          throw new Error(
            `Team ${cleanTeamId} not found in Linear workspace`,
          );
        }

        throw new Error(
          response.error || "Failed to get team configuration",
        );
      }

      if (!response.data) {
        throw new Error(`No team data found for ${cleanTeamId}`);
      }

      const teamConfig = response.data;

      // Cache the result with 24 hour TTL
      globalCache.set(
        `team-config:${cleanTeamId}`,
        teamConfig,
        24 * 60 * 60 * 1000,
        { persist: true, storage: 'sessionStorage' }
      );

      return teamConfig;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (isTeamNotFoundError(errorMessage)) {
        // GRACEFUL: Clear stale cache for missing team
        globalCache.delete(`team-config:${cleanTeamId}`, { storage: 'sessionStorage' });
        console.warn(`[LinearTeamConfig] Team ${cleanTeamId} not found in Linear - cache cleared`);
        
        // Re-throw with standard error code
        throw new Error('TEAM_NOT_FOUND');
      }
      
      throw error;
    }
  }

  /**
   * Get team issues for Kanban board
   * SECURE: Uses global apiClient for authenticated requests
   */
  async getTeamIssues(teamId: string): Promise<LinearIssue[]> {
    const cleanTeamId = extractTeamId(teamId);
    const requestId = Math.random().toString(36).substr(2, 6);

    console.log(
      `[LinearTeamConfig-${requestId}] Getting team issues for: ${cleanTeamId}`,
    );

    try {
      // Use global apiClient for authenticated requests
      const response = await globalApiClient.get(`/linear/teams/${cleanTeamId}/issues`);

      if (!response.success) {
        console.warn(
          `[LinearTeamConfig-${requestId}] Failed to get team issues:`,
          response.error,
        );
        return []; // Return empty array instead of throwing
      }

      const issues = response.data?.issues || [];
      console.log(
        `[LinearTeamConfig-${requestId}] Loaded ${issues.length} issues`,
      );

      return issues;
    } catch (error) {
      console.error(
        `💥 [LinearTeamConfig-${requestId}] Error getting team issues:`,
        {
          teamId: cleanTeamId,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
      );

      // Return empty array for graceful degradation
      return [];
    }
  }

  /**
   * Get customer deliverables (filtered issues)
   * SECURE: Uses global apiClient for authenticated requests
   */
  async getCustomerDeliverables(
    teamId: string,
    projectName = "Electrical Distribution Platform",
    states = [
      "Pending Review",
      "Approved",
      "Released",
      "Needs Input",
      "Failed Review",
    ],
  ): Promise<LinearIssue[]> {
    const cleanTeamId = extractTeamId(teamId);
    const requestId = Math.random().toString(36).substr(2, 6);

    console.log(
      `[LinearTeamConfig-${requestId}] Getting customer deliverables for: ${cleanTeamId}`,
    );

    try {
      // Use global apiClient for authenticated requests
      const response = await globalApiClient.post(
        `/linear/teams/${cleanTeamId}/deliverables`,
        {
          projectName,
          states,
        }
      );

      if (!response.success) {
        console.warn(
          `[LinearTeamConfig-${requestId}] Failed to get deliverables:`,
          response.error,
        );
        return [];
      }

      const deliverables = response.data?.deliverables || [];
      console.log(
        `[LinearTeamConfig-${requestId}] Loaded ${deliverables.length} deliverables`,
      );

      return deliverables;
    } catch (error) {
      console.error(
        `💥 [LinearTeamConfig-${requestId}] Error getting deliverables:`,
        {
          teamId: cleanTeamId,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
      );

      return [];
    }
  }

  /**
   * Get teams hierarchy
   */
  async getTeamsHierarchy(
    customerId?: string,
    isAdmin = false,
  ): Promise<any> {
    const requestId = Math.random().toString(36).substr(2, 6);

    console.log(
      `[LinearTeamConfig-${requestId}] Getting teams hierarchy`,
    );

    try {
      const response = await this.apiClient.getTeamsHierarchy(
        customerId,
        isAdmin,
      );

      if (!response.success) {
        console.warn(
          `[WARNING] [LinearTeamConfig-${requestId}] Failed to get teams hierarchy:`,
          response.error,
        );
        return { totalTeams: 0, rootTeams: 0, hierarchy: [] };
      }

      console.log(
        `[LinearTeamConfig-${requestId}] Teams hierarchy loaded`,
      );
      return response.data;
    } catch (error) {
      console.error(
        `💥 [LinearTeamConfig-${requestId}] Error getting teams hierarchy:`,
        {
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
      );

      return { totalTeams: 0, rootTeams: 0, hierarchy: [] };
    }
  }

  /**
   * Get teams list
   */
  async getTeamsList(customerId?: string): Promise<any[]> {
    const requestId = Math.random().toString(36).substr(2, 6);

    console.log(
      `[LinearTeamConfig-${requestId}] Getting teams list`,
    );

    try {
      const response =
        await this.apiClient.getTeams(customerId);

      if (!response.success) {
        console.warn(
          `[WARNING] [LinearTeamConfig-${requestId}] Failed to get teams list:`,
          response.error,
        );
        return [];
      }

      const teams = response.data?.teams || [];
      console.log(
        `[LinearTeamConfig-${requestId}] Loaded ${teams.length} teams`,
      );

      return teams;
    } catch (error) {
      console.error(
        `💥 [LinearTeamConfig-${requestId}] Error getting teams list:`,
        {
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
      );

      return [];
    }
  }

  /**
   * Get issue details
   */
  async getIssueDetail(
    issueId: string,
  ): Promise<LinearIssue | null> {
    const requestId = Math.random().toString(36).substr(2, 6);

    console.log(
      `[LinearTeamConfig-${requestId}] Getting issue detail for: ${issueId}`,
    );

    try {
      const response =
        await this.apiClient.getIssueDetail(issueId);

      if (!response.success) {
        console.warn(
          `[LinearTeamConfig-${requestId}] Failed to get issue detail:`,
          response.error,
        );
        return null;
      }

      const issue = response.data?.issue;
      console.log(
        `[LinearTeamConfig-${requestId}] Issue detail loaded:`,
        {
          id: issue?.id,
          title: issue?.title,
        },
      );

      return issue || null;
    } catch (error) {
      console.error(
        `💥 [LinearTeamConfig-${requestId}] Error getting issue detail:`,
        {
          issueId,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
      );

      return null;
    }
  }

  /**
   * Get state ID by name - Helper for Linear API integration
   * ⚡ OPTIMIZED: Uses cached team config
   */
  async getStateIdByName(
    teamId: string,
    stateName: string,
  ): Promise<string | null> {
    const cleanTeamId = extractTeamId(teamId);
    const requestId = Math.random().toString(36).substr(2, 6);

    console.log(
      `[LinearTeamConfig-${requestId}] Getting state ID for "${stateName}" in team: ${cleanTeamId}`,
    );

    try {
      // Use cached config (super fast!)
      const teamConfig = await this.getTeamConfig(cleanTeamId, false);

      if (!teamConfig.states?.length) {
        console.warn(
          `[WARNING] [LinearTeamConfig-${requestId}] No states found in team config`,
        );
        return null;
      }

      const found = teamConfig.states.find(
        (state: any) => state.name === stateName,
      );

      if (!found) {
        console.warn(
          `[WARNING] [LinearTeamConfig-${requestId}] State not found: ${stateName}`,
        );
        console.log(
          `Available states:`,
          teamConfig.states.map((s: any) => s.name),
        );
        return null;
      }

      console.log(
        `[LinearTeamConfig-${requestId}] State ID found: ${found.id} for "${stateName}" (cached)`,
      );
      return found.id;
    } catch (error) {
      console.error(
        `💥 [LinearTeamConfig-${requestId}] Error getting state ID:`,
        {
          teamId: cleanTeamId,
          stateName,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
      );
      return null;
    }
  }

  /**
   * Get issues in specific state - Real Linear API integration
   */
  async getIssuesInState(
    teamId: string,
    stateName: string,
  ): Promise<LinearIssue[]> {
    const cleanTeamId = extractTeamId(teamId);
    const requestId = Math.random().toString(36).substr(2, 6);

    console.log(
      `🎯 [LinearTeamConfig-${requestId}] Getting issues in state "${stateName}" for team: ${cleanTeamId}`,
    );

    try {
      // First, get the state ID
      const stateId = await this.getStateIdByName(
        cleanTeamId,
        stateName,
      );

      if (!stateId) {
        console.warn(
          `⚠️ [LinearTeamConfig-${requestId}] Could not resolve state ID for: ${stateName}`,
        );
        return [];
      }

      // Get issues for this specific state
      const response = await this.apiClient.getIssuesInState(
        cleanTeamId,
        stateId,
      );

      if (!response.success) {
        console.warn(
          `⚠️ [LinearTeamConfig-${requestId}] Failed to get issues in state:`,
          response.error,
        );
        return [];
      }

      const issues = response.data?.issues || [];
      console.log(
        `✅ [LinearTeamConfig-${requestId}] Found ${issues.length} issues in state "${stateName}"`,
      );

      return issues;
    } catch (error) {
      console.error(
        `💥 [LinearTeamConfig-${requestId}] Error getting issues in state:`,
        {
          teamId: cleanTeamId,
          stateName,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
      );
      return [];
    }
  }

  /**
   * OPTIMIZED: Fast state mapping using lookup tables
   */
  private mapStateToCategory(
    stateName: string,
    stateType?: string,
  ):
    | "pendingReview"
    | "approved"
    | "released"
    | "needsInput"
    | "failedReview"
    | null {
    // Exact match lookup (O(1))
    const exactMatch = this.STATE_MAPPING[stateName];
    if (exactMatch) return exactMatch;

    // Fast keyword matching using pre-compiled patterns
    const lowerName = stateName.toLowerCase();

    // Skip development states (fastest check first)
    if (
      this.DEVELOPMENT_PATTERNS.some((pattern) =>
        lowerName.includes(pattern),
      )
    ) {
      return null;
    }

    // Client-facing pattern matching
    for (const [category, patterns] of Object.entries(
      this.CATEGORY_PATTERNS,
    )) {
      if (
        patterns.some((pattern) => lowerName.includes(pattern))
      ) {
        return category as
          | "pendingReview"
          | "approved"
          | "released"
          | "needsInput"
          | "failedReview";
      }
    }

    // State type fallback
    if (stateType === "completed") return "released";

    return null; // Skip unknown states
  }

  /**
   * OPTIMIZED: Pre-compiled lookup tables for O(1) performance
   */
  private readonly STATE_MAPPING: Record<
    string,
    | "pendingReview"
    | "approved"
    | "released"
    | "needsInput"
    | "failedReview"
  > = {
    // Exact matches for common states
    "Client Review": "pendingReview",
    "Release Ready": "approved",
    Shipped: "released",
    Released: "released",
    Deployed: "released",
    Done: "released",
    "Client Blocked": "needsInput",
    "Needs Input": "needsInput",
    "Waiting for Client": "needsInput",
    Blocked: "needsInput",
    "Failed Review": "failedReview",
    "Review Failed": "failedReview",
    Rejected: "failedReview",
  };

  private readonly DEVELOPMENT_PATTERNS = [
    "backlog",
    "todo",
    "progress",
    "triage",
    "development",
    "coding",
    "qa",
    "testing",
    "under review",
    "draft",
  ];

  private readonly CATEGORY_PATTERNS = {
    pendingReview: ["review"],
    approved: ["ready", "approved"],
    released: ["shipped", "released", "done", "deployed"],
    needsInput: ["blocked", "waiting", "input"],
    failedReview: ["failed", "rejected"],
  };

  /**
   * OPTIMIZED: Get issues categorized by business logic states
   * ⚡ Uses cached team config for state mapping
   */
  async getCategorizedIssues(teamId: string): Promise<{
    pendingReview: LinearIssue[];
    approved: LinearIssue[];
    released: LinearIssue[];
    needsInput: LinearIssue[];
    failedReview: LinearIssue[];
  }> {
    const cleanTeamId = extractTeamId(teamId);

    try {
      // Get issues grouped by state ID
      const response =
        await this.apiClient.getTeamIssuesGroupedByState(
          cleanTeamId,
        );
      if (!response.success) {
        return this.getEmptyCategories();
      }

      // Get state mapping from cache (super fast!)
      const teamConfig = await this.getTeamConfig(cleanTeamId, false);
      const stateIdToName: Record<string, string> = {};
      teamConfig.states?.forEach((state: any) => {
        stateIdToName[state.id] = state.name;
      });

      // Categorize issues using optimized mapping
      const categorized = this.getEmptyCategories();
      Object.entries(response.data || {}).forEach(
        ([stateId, issues]) => {
          if (!Array.isArray(issues) || issues.length === 0)
            return;

          const stateName = stateIdToName[stateId];
          const category = this.mapStateToCategory(
            stateName,
            issues[0]?.state?.type,
          );

          if (category) {
            categorized[category].push(...issues);
          }
        },
      );

      const totalIssues =
        Object.values(categorized).flat().length;
      if (totalIssues > 0) {
        console.log(
          `✅ Categorized ${totalIssues} issues for team ${cleanTeamId} (using cached config)`,
        );
      }

      return categorized;
    } catch (error) {
      console.error(
        `❌ Error categorizing issues for team ${cleanTeamId}:`,
        error,
      );
      return this.getEmptyCategories();
    }
  }

  private getEmptyCategories() {
    return {
      pendingReview: [] as LinearIssue[],
      approved: [] as LinearIssue[],
      released: [] as LinearIssue[],
      needsInput: [] as LinearIssue[],
      failedReview: [] as LinearIssue[],
    };
  }

  /**
   * Validate team exists and is accessible
   */
  async validateTeamAccess(
    teamId: string,
  ): Promise<{
    exists: boolean;
    accessible: boolean;
    teamData?: TeamConfig;
  }> {
    const cleanTeamId = extractTeamId(teamId);

    try {
      const teamData = await this.getTeamConfig(cleanTeamId);

      // If we got fallback data, team doesn't exist in Linear
      const isRealTeam =
        teamData.name !== `Team ${cleanTeamId.substring(0, 8)}`;

      return {
        exists: isRealTeam,
        accessible: true, // If we can get config, it's accessible
        teamData,
      };
    } catch (error) {
      return {
        exists: false,
        accessible: false,
      };
    }
  }
}

// Create and export singleton instance
export const linearTeamConfigService =
  new LinearTeamConfigService();

// Export the class for custom instances
export default LinearTeamConfigService;