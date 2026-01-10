import { apiClient } from '../apiClient';
import type { LinearTeam, LinearIssue, IssuesByParentResponse } from './types';
import { LINEAR_QUERIES } from './graphql-queries';
import { generateRequestId, getDataStructure, validateTeamId } from './helpers';
import { linearCache } from '../linearCacheService';
import { secureTokenStorage } from '../secureTokenStorage';

export class LinearQueries {
  // CRITICAL: No baseUrl needed - apiClient handles this
  constructor() {
    // apiClient already has baseURL configured
  }

  private ensureToken(): void {
    // CRITICAL: Use user's access token from secure storage
    const accessToken = secureTokenStorage.getToken();
    
    if (!accessToken) {
      console.error('[LinearQueryService] No access token available');
      throw new Error('Authentication required. Please login to continue.');
    }
    
    // CRITICAL: Ensure token is set in apiClient
    const tokenData = secureTokenStorage.getTokenData();
    const tokenExpiry = tokenData?.expiresAt || Date.now() + (60 * 60 * 1000);
    apiClient.setAccessToken(accessToken, tokenExpiry);
  }

  private async executeQuery(query: string, variables: Record<string, any> = {}): Promise<any> {
    const requestId = generateRequestId();
    const startTime = Date.now();

    console.log(`[${requestId}] Executing Linear query:`, {
      query: query.trim().split('\n')[1]?.trim(),
      variables
    });

    try {
      // CRITICAL: Ensure token is set in apiClient
      this.ensureToken();

      // CRITICAL: Use apiClient instead of raw fetch
      const result = await apiClient.post<any>('/linear/graphql', { query, variables });

      const responseTime = Date.now() - startTime;

      if (!result.success) {
        console.error(`[${requestId}] HTTP Error:`, result.error);
        throw new Error(`Linear API Error: ${result.error}`);
      }

      // apiClient wraps response in { success, data, error }
      // GraphQL responses are in result.data
      const graphqlResult = result.data;
      
      console.log(`[${requestId}] Response parsed:`, {
        hasData: !!graphqlResult.data,
        hasErrors: !!graphqlResult.errors,
        dataKeys: graphqlResult.data ? Object.keys(graphqlResult.data) : [],
        responseTime: `${responseTime}ms`
      });
      
      if (graphqlResult.errors && graphqlResult.errors.length > 0) {
        console.error(`[${requestId}] GraphQL Errors:`, {
          errors: graphqlResult.errors,
          query: query.trim().split('\n')[1]?.trim(),
          variables,
          fullResponse: graphqlResult
        });
        throw new Error(`GraphQL Error: ${graphqlResult.errors[0]?.message || 'Unknown error'}`);
      }

      if (!graphqlResult.data) {
        console.warn(`[${requestId}] No data in response:`, {
          fullResponse: graphqlResult,
          query: query.trim().split('\n')[1]?.trim(),
          variables
        });
        throw new Error('No data returned from GraphQL query');
      }

      console.log(`[${requestId}] Query successful:`, {
        responseTime: `${responseTime}ms`,
        dataStructure: graphqlResult.data ? getDataStructure(graphqlResult.data) : 'No data'
      });

      return graphqlResult.data;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error(`[${requestId}] Query failed:`, {
        error: error instanceof Error ? error.message : String(error),
        errorType: error?.constructor?.name || 'Unknown',
        responseTime: `${responseTime}ms`,
        query: query.trim().split('\n')[1]?.trim(),
        variables,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  async getTeamConfig(teamId: string): Promise<LinearTeam> {
    const methodId = `getTeamConfig-${Math.random().toString(36).substr(2, 6)}`;
    try {
      // CRITICAL: Ensure token is set in apiClient
      this.ensureToken();
      
      const result = await apiClient.get<any>(`/linear/teams/${teamId}/config`);

      if (!result.success || !result.data?.team) {
        throw new Error(result.error || 'No team data returned');
      }

      const team = result.data.team;
      return team;
    } catch (error) {
      console.error(`[${methodId}] Error getting team config:`, error);
      
      if (validateTeamId(teamId)) {
        console.warn(`[${methodId}] UUID team ${teamId} not found in Linear workspace`);
        throw new Error(`UUID team not found: ${teamId}`);
      }
      
      throw error;
    }
  }

  async getIssueDetails(issueId: string, bypassCache = false): Promise<LinearIssue> {
    const methodId = `getIssueDetail-${Math.random().toString(36).substr(2, 6)}`;
    
    const fetcher = async (): Promise<LinearIssue> => {
      // CRITICAL: Ensure token is set in apiClient
      this.ensureToken();
      
      const result = await apiClient.get<any>(`/linear/issues/${issueId}`);

      console.log(`[${methodId}] Response structure check:`, {
        hasResult: !!result,
        hasSuccess: result?.success !== undefined,
        successValue: result?.success,
        hasData: !!result?.data,
        hasDataIssue: !!result?.data?.issue,
        dataKeys: result?.data ? Object.keys(result.data) : [],
        firstLevelKeys: result ? Object.keys(result) : []
      });

      if (!result.success) {
        throw new Error(result.error || 'API request failed');
      }

      if (!result.data) {
        throw new Error('No data in response');
      }

      // CRITICAL FIX: Handle both response structures
      // 1. Wrapped: { success: true, data: { issue: {...} } }
      // 2. Direct: { success: true, data: {...} } (data IS the issue)
      const issue = result.data.issue || result.data;

      if (!issue || !issue.id) {
        console.error(`[${methodId}] Response validation failed:`, {
          success: result.success,
          hasData: !!result.data,
          dataStructure: result.data,
          error: result.error
        });
        throw new Error(result.error || 'No issue data returned');
      }

      if (!issue.subIssues) {
        issue.subIssues = [];
      }
      return issue;
    };

    if (bypassCache) {
      return fetcher();
    }

    const cacheKey = `linear:issue-detail:issueId:${issueId}`;
    const ttl = 3 * 60 * 1000; // 3 minutes
    const staleTime = 1 * 60 * 1000; // 1 minute

    try {
      return await linearCache.get<LinearIssue>(cacheKey, fetcher, ttl, staleTime);
    } catch (error) {
      console.error(`[${methodId}] Error fetching issue details:`, error);
      throw error;
    }
  }

  async getTeamIssues(teamId: string): Promise<LinearIssue[]> {
    const methodId = `getTeamIssues-${Math.random().toString(36).substr(2, 6)}`;
    try {
      // CRITICAL: Ensure token is set in apiClient
      this.ensureToken();
      
      const result = await apiClient.get<any>(`/linear/teams/${teamId}/issues`);

      if (!result.success || !result.data?.issues) {
        throw new Error(result.error || 'No issues data returned');
      }
      return result.data.issues;
    } catch (error) {
      console.error(`[${methodId}] Error fetching team issues:`, error);
      throw error;
    }
  }

  async getIssuesGroupedByParent(teamId: string): Promise<IssuesByParentResponse> {
    const methodId = `getIssuesGroupedByParent-${Math.random().toString(36).substr(2, 6)}`;
    try {
      // CRITICAL: Ensure token is set in apiClient
      this.ensureToken();
      
      const result = await apiClient.get<any>(`/linear/teams/${teamId}/issues-by-parent`);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'No data returned');
      }
      return result.data;
    } catch (error) {
      console.error(`[${methodId}] Error fetching issues by parent:`, error);
      throw error;
    }
  }

  async getTeamWorkflowStates(teamId: string): Promise<any[]> {
    const methodId = `getTeamWorkflowStates-${Math.random().toString(36).substr(2, 6)}`;
    try {
      const teamConfig = await this.getTeamConfig(teamId);
      return teamConfig.states?.nodes || [];
    } catch (error) {
      console.error(`[${methodId}] Error fetching workflow states:`, error);
      throw error;
    }
  }

  async getAllTeamIssues(teamId: string): Promise<LinearIssue[]> {
    return this.getTeamIssues(teamId);
  }

  async getIssuesInState(teamId: string, stateId: string): Promise<LinearIssue[]> {
    const methodId = `getIssuesInState-${Math.random().toString(36).substr(2, 6)}`;
    try {
      // CRITICAL: Ensure token is set in apiClient
      this.ensureToken();
      
      const result = await apiClient.get<any>(`/linear/teams/${teamId}/states/${stateId}/issues`);

      if (!result.success || !result.data?.issues) {
        throw new Error(result.error || 'No issues data returned');
      }
      return result.data.issues;
    } catch (error) {
      console.error(`[${methodId}] Error fetching issues in state:`, error);
      throw error;
    }
  }

  invalidateIssues(teamId: string): void {
    const patterns = [
      `linear:team-${teamId}`,
      `linear:issue-detail`,
      `linear:issues-by-parent:${teamId}`
    ];

    // OPTIMIZATION: Use specific cache key patterns instead of scanning all localStorage
    // This prevents blocking navigation with expensive operations
    patterns.forEach(pattern => {
      try {
        // Only clear known cache keys instead of scanning entire localStorage
        const specificKeys = [
          `${pattern}:${teamId}`,
          `linear:team-${teamId}-issues`,
          `linear:issues-by-parent:${teamId}`
        ];
        
        specificKeys.forEach(key => {
          if (localStorage.getItem(key)) {
            localStorage.removeItem(key);
          }
        });
      } catch (error) {
        console.warn(`[LinearQueries] Failed to invalidate pattern ${pattern}:`, error);
      }
    });
  }
}

export const linearQueries = new LinearQueries();