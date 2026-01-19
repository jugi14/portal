import { apiClient } from '../apiClient';
import type { LinearIssue, LinearComment } from './types';
import { LINEAR_MUTATIONS } from './graphql-mutations';
import { generateRequestId } from './helpers';
import { secureTokenStorage } from '../secureTokenStorage';

/**
 * Generate user metadata footer for Linear issues/comments
 * Visible in Linear.app, invisible on Client Portal (stripped by helpers)
 * 
 * Format: [Portal Metadata] User: Name <email> Time: timestamp
 * 
 * @returns Metadata string with user info and timestamp (single-line format)
 */
function generateUserMetadata(): string {
  try {
    const sessionData = sessionStorage.getItem('current_session');
    console.log('[Linear] Available sessionStorage keys:', Object.keys(sessionStorage));
    
    if (!sessionData) {
      console.warn('[Linear] No session found in sessionStorage - metadata will not be added');
      console.warn('[Linear] This is expected if user is not logged in');
      return '';
    }
    
    const session = JSON.parse(sessionData);
    
    console.log('[Linear] Session structure:', {
      hasUser: !!session.user,
      hasUserMetadata: !!session.user?.user_metadata,
      hasEmail: !!session.user?.email,
      userMetadataKeys: session.user?.user_metadata ? Object.keys(session.user.user_metadata) : [],
      fullSession: session
    });
    
    const userName = session.user?.user_metadata?.name || session.user?.email || 'Unknown User';
    const userEmail = session.user?.email || '';
    const timestamp = new Date().toISOString();
    
    // CRITICAL: Add newline BEFORE metadata to ensure it's always on separate line
    // This makes regex stripping reliable - metadata is always at end of description/comment
    // Format: \n[Portal Metadata] User: ... Time: ...
    const metadata = `\n[Portal Metadata] User: ${userName}${userEmail ? ` ${userEmail}` : ''} Time: ${new Date(timestamp).toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    })}`;
    
    console.log('[Linear] Metadata generated successfully:', {
      userName,
      userEmail,
      metadataLength: metadata.length,
      metadataPreview: metadata.substring(0, 100)
    });
    
    return metadata;
  } catch (error) {
    console.error('[Linear] CRITICAL: Failed to generate user metadata:', error);
    console.error('[Linear] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Return empty string on error - don't break issue creation
    return '';
  }
}

export class LinearMutations {
  // CRITICAL: No baseUrl needed - apiClient handles this
  constructor() {
    // apiClient already has baseURL configured
  }

  private ensureToken(): void {
    // CRITICAL: Use user's access token from secure storage
    const accessToken = secureTokenStorage.getToken();
    
    if (!accessToken) {
      console.error('[LinearMutationService] No access token available');
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

    console.log(`[${requestId}] Executing Linear mutation:`, {
      mutation: query.trim().split('\n')[1]?.trim(),
      variables,
      variablesType: typeof variables,
      variablesIsString: typeof variables === 'string',
    });

    try {
      // CRITICAL: Ensure token is set in apiClient
      this.ensureToken();

      // CRITICAL DEBUG: Check payload before sending
      const payload = { query, variables };
      console.log(`[${requestId}] Payload to send:`, {
        query: query.substring(0, 100),
        variables,
        variablesType: typeof variables,
        payloadStringified: JSON.stringify(payload).substring(0, 200),
      });

      // CRITICAL: Use apiClient instead of raw fetch
      // Using /linear/execute to avoid potential Vercel routing issues with /linear/graphql
      const result = await apiClient.post<any>('/linear/execute', payload);

      const responseTime = Date.now() - startTime;

      console.log(`[${requestId}] Raw API response:`, {
        success: result.success,
        hasData: !!result.data,
        dataKeys: result.data ? Object.keys(result.data) : [],
        responseTime
      });

      if (!result.success) {
        console.error(`[${requestId}] HTTP Error:`, result.error);
        throw new Error(`Linear API Error: ${result.error}`);
      }

      // apiClient wraps response in { success, data, error }
      // GraphQL responses are in result.data
      const graphqlResult = result.data;
      
      if (!graphqlResult) {
        console.error(`[${requestId}] No GraphQL result in response`);
        throw new Error('No data returned from Linear API');
      }
      
      console.log(`[${requestId}] GraphQL result structure:`, {
        hasDataField: 'data' in graphqlResult,
        topLevelKeys: Object.keys(graphqlResult),
        fullResult: graphqlResult
      });
      
      // Check for GraphQL errors first
      if (graphqlResult.errors && graphqlResult.errors.length > 0) {
        console.error(`[${requestId}] GraphQL Errors:`, graphqlResult.errors);
        throw new Error(`GraphQL Error: ${graphqlResult.errors[0]?.message || 'Unknown error'}`);
      }

      // CRITICAL FIX: Handle both response structures
      // 1. Standard GraphQL: { data: { issueUpdate: {...} } }
      // 2. Already unwrapped: { issueUpdate: {...} }
      const mutationData = graphqlResult.data || graphqlResult;

      console.log(`[${requestId}] Mutation successful (${responseTime}ms)`, {
        dataKeys: Object.keys(mutationData)
      });

      return mutationData;
    } catch (error) {
      console.error(`[${requestId}] Mutation failed:`, error);
      throw error;
    }
  }

  async updateIssueState(issueId: string, stateId: string): Promise<boolean> {
    const data = await this.executeQuery(LINEAR_MUTATIONS.UPDATE_ISSUE_STATE, { issueId, stateId });
    
    if (!data || !data.issueUpdate) {
      console.error('[LinearMutations] Invalid updateIssueState response:', data);
      throw new Error('Invalid response from Linear API');
    }
    
    return data.issueUpdate.success;
  }

  async addComment(issueId: string, body: string): Promise<LinearComment> {
    // Always add [external] prefix if not present
    const externalComment = body.trim().startsWith('[external]') 
      ? body 
      : `[external] ${body}`;
    
    // Add user metadata footer (invisible on portal, visible in Linear.app)
    let commentWithMetadata = externalComment;
    
    try {
      const metadata = generateUserMetadata();
      
      if (metadata) {
        commentWithMetadata = externalComment + metadata;
      } else {
        console.warn('[Linear] No metadata generated - comment will not have metadata');
      }
    } catch (error) {
      console.error('[Linear] Failed to append user metadata to comment:', error);
      console.error('[Linear] Error details:', {
        message: error.message,
        stack: error.stack
      });
    }
    
    console.log('[Linear] Final comment to send:', {
      issueId,
      originalLength: body.length,
      finalLength: commentWithMetadata.length,
      hasPrefix: commentWithMetadata.startsWith('[external]'),
      hasMetadata: commentWithMetadata.includes('[Portal Metadata]'),
      preview: commentWithMetadata.substring(0, 200)
    });
    
    const data = await this.executeQuery(LINEAR_MUTATIONS.ADD_COMMENT, { issueId, body: commentWithMetadata });
    return data.commentCreate.comment;
  }

  async addCommentToIssue(issueId: string, body: string): Promise<LinearComment> {
    return this.addComment(issueId, body);
  }

  async addLabel(issueId: string, labelId: string): Promise<boolean> {
    const data = await this.executeQuery(LINEAR_MUTATIONS.ADD_LABEL, { issueId, labelId });
    return data.issueAddLabel.success;
  }

  async createLabel(params: {
    teamId: string;
    name: string;
    color?: string;
    description?: string;
  }): Promise<{ id: string; name: string; color?: string }> {
    const data = await this.executeQuery(LINEAR_MUTATIONS.CREATE_LABEL, {
      teamId: params.teamId,
      name: params.name,
      color: params.color || '#FF6B6B', // Default orange-red color
      description: params.description || `Auto-created label: ${params.name}`
    });
    
    if (!data || !data.issueLabelCreate) {
      console.error('[LinearMutations] Invalid createLabel response:', data);
      throw new Error('Invalid response from Linear API');
    }
    
    if (!data.issueLabelCreate.success) {
      throw new Error('Failed to create label');
    }
    return data.issueLabelCreate.issueLabel;
  }

  async createIssue(params: {
    teamId: string;
    title: string;
    description?: string;
    priority?: number;
    assigneeId?: string;
    stateId?: string;
    labelIds?: string[];
    cycleId?: string;
  }): Promise<LinearIssue> {
    try {
      this.ensureToken();

      // Append user metadata to description
      const metadata = generateUserMetadata();
      const descriptionWithMetadata = params.description 
        ? params.description + metadata 
        : metadata.trim();

      const paramsWithMetadata = {
        ...params,
        description: descriptionWithMetadata
      };

      console.log('[LinearMutations] Issue description with metadata:', {
        originalLength: params.description?.length || 0,
        metadataLength: metadata.length,
        finalLength: descriptionWithMetadata.length,
        hasMetadata: descriptionWithMetadata.includes('[Portal Metadata]')
      });

      const result = await apiClient.post<LinearIssue>('/linear/issues/create', paramsWithMetadata);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to create issue');
      }
      return result.data;
    } catch (error) {
      console.error('[LinearMutations] createIssue failed:', error);
      throw error;
    }
  }

  async createSubIssue(
    parentIssueId: string, 
    title: string, 
    description?: string
  ): Promise<LinearIssue> {
    try {
      this.ensureToken();

      // Append user metadata to description
      const metadata = generateUserMetadata();
      const descriptionWithMetadata = description 
        ? description + metadata 
        : metadata.trim();

      console.log('[LinearMutations] Sub-issue description with metadata:', {
        originalLength: description?.length || 0,
        metadataLength: metadata.length,
        finalLength: descriptionWithMetadata.length,
        hasMetadata: descriptionWithMetadata.includes('[Portal Metadata]')
      });

      const result = await apiClient.post<LinearIssue>(
        `/linear/issues/${parentIssueId}/sub-issues`, 
        {
          title: title.trim(),
          description: descriptionWithMetadata
        }
      );

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to create sub-issue');
      }
      return result.data;
    } catch (error) {
      console.error('[LinearMutations] createSubIssue failed:', error);
      throw error;
    }
  }

  async uploadFilesToIssue(issueId: string, files: File[]): Promise<any> {
    try {
      const formData = new FormData();
      
      files.forEach((file) => {
        formData.append('files', file);
      });

      console.log('[LinearMutations] Files prepared, sending to server:', {
        count: files.length,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        files: files.map(f => ({ name: f.name, size: f.size, type: f.type }))
      });

      this.ensureToken();

      const result = await apiClient.upload(`/linear/issues/${issueId}/upload`, formData);

      if (!result.success) {
        throw new Error(result.error || 'Failed to upload files');
      }
      return result.data;
    } catch (error) {
      console.error('[LinearMutations] uploadFilesToIssue failed:', error);
      throw error;
    }
  }

  async deleteIssue(issueId: string): Promise<boolean> {
    const data = await this.executeQuery(LINEAR_MUTATIONS.DELETE_ISSUE, { issueId });
    return data.issueDelete.success;
  }

  async updateIssue(params: {
    issueId: string;
    title?: string;
    description?: string;
    priority?: number;
    assigneeId?: string;
    stateId?: string;
    labelIds?: string[];
  }): Promise<LinearIssue> {
    const data = await this.executeQuery(LINEAR_MUTATIONS.UPDATE_ISSUE, params);
    return data.issueUpdate.issue;
  }

  async updateIssueCycle(issueId: string, cycleId: string | null): Promise<boolean> {
    const data = await this.executeQuery(LINEAR_MUTATIONS.UPDATE_ISSUE_CYCLE, { 
      issueId, 
      cycleId 
    });
    
    if (!data || !data.issueUpdate) {
      console.error('[LinearMutations] Invalid updateIssueCycle response:', data);
      throw new Error('Invalid response from Linear API');
    }
    
    return data.issueUpdate.success;
  }

  async getTeamCycles(teamId: string): Promise<any[]> {
    const data = await this.executeQuery(LINEAR_MUTATIONS.GET_TEAM_CYCLES, { teamId });
    
    if (!data || !data.team) {
      console.error('[LinearMutations] Invalid getTeamCycles response:', data);
      return [];
    }
    
    return data.team.cycles?.nodes || [];
  }

  async getNextCycle(teamId: string, currentCycleEndsAt?: string): Promise<any | null> {
    // Use isFuture filter instead of date comparison
    const data = await this.executeQuery(LINEAR_MUTATIONS.GET_NEXT_CYCLE, { 
      teamId
    });
    
    if (!data || !data.team || !data.team.cycles?.nodes?.length) {
      return null;
    }
    
    return data.team.cycles.nodes[0];
  }

  async partialApproveIssue(params: {
    issueId: string;
    teamId: string;
    subIssues: any[];
  }): Promise<{
    success: boolean;
    movedIssues: string[];
    message: string;
  }> {
    try {
      // Step 1: Create/find "Partial Approved" label
      const teamConfigResponse = await this.executeQuery(`
        query GetTeamConfig($teamId: String!) {
          team(id: $teamId) {
            id
            labels {
              nodes {
                id
                name
                color
              }
            }
          }
        }
      `, { teamId: params.teamId });
      
      const labels = teamConfigResponse?.team?.labels?.nodes || [];
      let partialApprovedLabel = labels.find((l: any) => 
        l.name.toLowerCase() === 'partial approved'
      );
      
      if (!partialApprovedLabel) {
        partialApprovedLabel = await this.createLabel({
          teamId: params.teamId,
          name: 'Partial Approved',
          color: '#FFA500',
          description: 'Issue partially approved - some sub-tasks moved to next cycle'
        });
      }
      
      // Step 2: Add label to parent issue
      await this.addLabel(params.issueId, partialApprovedLabel.id);
      // Step 3: Filter unfinished sub-issues (not in "Release Ready" or completed)
      const unfinishedSubIssues = params.subIssues.filter((sub: any) => {
        const stateName = sub.state?.name;
        const stateType = sub.state?.type;
        return stateName !== 'Release Ready' && stateType !== 'completed';
      });
      if (unfinishedSubIssues.length === 0) {
        return {
          success: true,
          movedIssues: [],
          message: 'All sub-tasks already completed'
        };
      }
      
      // Step 4: Get current cycle and find next cycle
      const currentIssue = await this.executeQuery(`
        query GetIssueCycle($issueId: String!) {
          issue(id: $issueId) {
            id
            cycle {
              id
              name
              endsAt
            }
          }
        }
      `, { issueId: params.issueId });
      
      const currentCycle = currentIssue?.issue?.cycle;
      
      if (!currentCycle) {
        return {
          success: true,
          movedIssues: [],
          message: 'Partial approved (no cycle to move issues)'
        };
      }
      
      const nextCycle = await this.getNextCycle(params.teamId, currentCycle.endsAt);
      
      if (!nextCycle) {
        return {
          success: true,
          movedIssues: [],
          message: 'Partial approved (no next cycle available)'
        };
      }
      // Step 5: Move unfinished sub-issues to next cycle
      const movedIssues: string[] = [];
      for (const subIssue of unfinishedSubIssues) {
        try {
          await this.updateIssueCycle(subIssue.id, nextCycle.id);
          movedIssues.push(subIssue.identifier);
        } catch (error) {
          console.error(`[Partial Approve] Failed to move ${subIssue.identifier}:`, error);
        }
      }
      
      // Step 6: Add comment to parent explaining what happened
      await this.addComment(
        params.issueId,
        `[Partial Approved] ${movedIssues.length} sub-task${movedIssues.length > 1 ? 's' : ''} moved to cycle "${nextCycle.name}": ${movedIssues.join(', ')}`
      );
      
      return {
        success: true,
        movedIssues,
        message: `Partial approved: ${movedIssues.length} sub-task${movedIssues.length > 1 ? 's' : ''} moved to ${nextCycle.name}`
      };
      
    } catch (error) {
      console.error('[Partial Approve] Failed:', error);
      throw error;
    }
  }
}

export const linearMutations = new LinearMutations();