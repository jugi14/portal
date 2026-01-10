/**
 * API Helpers for Teifi Digital Client Portal
 * 
 * Centralizes endpoint calls and data transformation
 * Ensures consistency between frontend and backend
 */

import { projectId, publicAnonKey } from './supabase/info';

// =====================================
// TYPES & INTERFACES
// =====================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  cached?: boolean;
  fallback?: boolean;
  timestamp?: string;
  meta?: any;
}

export interface TeamConfig {
  id: string;
  name: string;
  key: string;
  description?: string;
  states?: TeamState[];
  labels?: TeamLabel[];
  members?: TeamMember[];
  createdAt?: string;
  updatedAt?: string;
}

export interface TeamState {
  id: string;
  name: string;
  type: string;
  color: string;
  position?: number;
}

export interface TeamLabel {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  active?: boolean;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  url?: string;
  priority?: number;
  priorityLabel?: string;
  estimate?: number;
  dueDate?: string;
  state: {
    id: string;
    name: string;
    type: string;
    color: string;
  };
  assignee?: TeamMember;
  project?: {
    id: string;
    name: string;
    color?: string;
  };
  labels?: TeamLabel[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// =====================================
// ENDPOINT CONFIGURATION
// =====================================

export class ApiClient {
  private baseUrl: string;
  private headers: HeadersInit;

  constructor(accessToken?: string) {
    this.baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-7f0d90fb`;
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': accessToken ? `Bearer ${accessToken}` : `Bearer ${publicAnonKey}`
    };
  }

  /**
   * Make HTTP request with proper error handling
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error ${response.status} on ${endpoint}:`, errorText);
        
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          message: errorText
        };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`API Request failed for ${endpoint}:`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Network or parsing error occurred'
      };
    }
  }

  // =====================================
  // TEAM ENDPOINTS
  // =====================================

  /**
   * Get team configuration using proper REST endpoint
   */
  async getTeamConfig(teamId: string): Promise<ApiResponse<{ team: TeamConfig }>> {
    return this.makeRequest<{ team: TeamConfig }>(`/linear/teams/${teamId}/config`);
  }

  /**
   * Get all teams with hierarchy
   */
  async getTeamsHierarchy(customerId?: string, isAdmin = false): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (customerId) params.append('customerId', customerId);
    if (isAdmin) params.append('admin', 'true');
    
    const queryString = params.toString();
    const endpoint = `/linear/teams/hierarchy${queryString ? `?${queryString}` : ''}`;
    
    return this.makeRequest(endpoint);
  }

  /**
   * Get teams list
   */
  async getTeams(customerId?: string): Promise<ApiResponse<{ teams: any[], teamsCount: number }>> {
    const params = customerId ? `?customerId=${encodeURIComponent(customerId)}` : '';
    return this.makeRequest(`/linear/teams${params}`);
  }

  // =====================================
  // ISSUES ENDPOINTS
  // =====================================

  /**
   * Get all team issues for Kanban board
   */
  async getTeamIssues(teamId: string): Promise<ApiResponse<{ issues: LinearIssue[], count: number }>> {
    return this.makeRequest(`/linear/teams/${teamId}/issues/all`);
  }

  /**
   * Get issues by state
   */
  async getTeamIssuesByState(teamId: string, stateId: string): Promise<ApiResponse<{ issues: LinearIssue[], count: number }>> {
    return this.makeRequest(`/linear/teams/${teamId}/states/${stateId}/issues`);
  }

  /**
   * Get customer deliverables (filtered issues)
   */
  async getCustomerDeliverables(
    teamId: string, 
    projectName = 'Electrical Distribution Platform',
    states = ['Pending Review', 'Approved', 'Released', 'Needs Input', 'Failed Review']
  ): Promise<ApiResponse<{ deliverables: LinearIssue[], count: number }>> {
    const params = new URLSearchParams();
    params.append('projectName', projectName);
    params.append('states', states.join(','));
    
    return this.makeRequest(`/linear/teams/${teamId}/deliverables?${params.toString()}`);
  }

  /**
   * Get issues in specific state - Alias for getTeamIssuesByState
   */
  async getIssuesInState(teamId: string, stateId: string): Promise<ApiResponse<{ issues: LinearIssue[], count: number }>> {
    return this.getTeamIssuesByState(teamId, stateId);
  }

  /**
   * Get all team issues grouped by state ID - Efficient endpoint for Kanban
   */
  async getTeamIssuesGroupedByState(teamId: string): Promise<ApiResponse<{ [stateId: string]: LinearIssue[] }>> {
    return this.makeRequest(`/linear/teams/${teamId}/issues/by-state`);
  }

  /**
   * Get issue details
   */
  async getIssueDetail(issueId: string): Promise<ApiResponse<{ issue: LinearIssue }>> {
    return this.makeRequest(`/linear/issues/${issueId}`);
  }

  // =====================================
  // ADMIN ENDPOINTS
  // =====================================

  /**
   * Get admin stats
   */
  async getAdminStats(): Promise<ApiResponse<any>> {
    return this.makeRequest('/admin/stats');
  }

  /**
   * Get users
   */
  async getUsers(): Promise<ApiResponse<any>> {
    return this.makeRequest('/admin/users');
  }

  // =====================================
  // UTILITY METHODS
  // =====================================

  /**
   * Validate team ID format
   */
  static isValidTeamId(teamId: string): boolean {
    // UUID format: 8-4-4-4-12 characters
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // Linear team ID format: alphanumeric
    const linearPattern = /^[a-zA-Z0-9]{1,20}$/;
    
    return uuidPattern.test(teamId) || linearPattern.test(teamId);
  }

  /**
   * Transform GraphQL team data to standardized format
   */
  static transformTeamData(graphqlTeam: any): TeamConfig {
    if (!graphqlTeam) {
      throw new Error('Invalid team data provided');
    }

    // Safely handle members with proper type checking
    const members = Array.isArray(graphqlTeam.members?.nodes) 
      ? graphqlTeam.members.nodes.map((member: any) => ({
          id: member?.id || '',
          name: member?.name || '',
          email: member?.email || '',
          avatarUrl: member?.avatarUrl,
          active: member?.active !== false
        }))
      : [];

    // Safely handle states with proper type checking  
    const states = Array.isArray(graphqlTeam.states?.nodes)
      ? graphqlTeam.states.nodes.map((state: any) => ({
          id: state?.id || '',
          name: state?.name || '',
          type: state?.type || '',
          color: state?.color || '',
          position: state?.position || 0
        }))
      : [];

    // Safely handle labels with proper type checking
    const labels = Array.isArray(graphqlTeam.labels?.nodes)
      ? graphqlTeam.labels.nodes.map((label: any) => ({
          id: label?.id || '',
          name: label?.name || '',
          color: label?.color || '',
          description: label?.description
        }))
      : [];

    return {
      id: graphqlTeam.id || '',
      name: graphqlTeam.name || '',
      key: graphqlTeam.key || '',
      description: graphqlTeam.description,
      states,
      labels,
      members,
      createdAt: graphqlTeam.createdAt,
      updatedAt: graphqlTeam.updatedAt
    };
  }

  /**
   * Create error response
   */
  static createErrorResponse<T>(error: string, message?: string): ApiResponse<T> {
    return {
      success: false,
      error,
      message: message || error
    };
  }

  /**
   * Create success response
   */
  static createSuccessResponse<T>(data: T, message?: string): ApiResponse<T> {
    return {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString()
    };
  }
}

// =====================================
// CONVENIENCE FUNCTIONS
// =====================================

/**
 * Create API client instance
 */
export function createApiClient(accessToken?: string): ApiClient {
  return new ApiClient(accessToken);
}

/**
 * Extract team ID from URL parameters
 */
export function extractTeamId(teamParam: string): string {
  // Handle both "teams/uuid" and "uuid" formats
  if (teamParam.startsWith('teams/')) {
    return teamParam.substring(6); // Remove "teams/" prefix
  }
  return teamParam;
}

/**
 * Check if error is related to team not found
 */
export function isTeamNotFoundError(error: string): boolean {
  const notFoundPatterns = [
    'team not found',
    'uuid team not found',
    'team does not exist',
    'invalid team id',
    'team not accessible'
  ];
  
  const errorLower = error.toLowerCase();
  return notFoundPatterns.some(pattern => errorLower.includes(pattern));
}

/**
 * Get fallback team data for unknown teams
 */
export function getFallbackTeamData(teamId: string): TeamConfig {
  return {
    id: teamId,
    name: `Team ${teamId.substring(0, 8)}`,
    key: teamId.substring(0, 4).toUpperCase(),
    description: 'This team is not available in the current Linear workspace.',
    states: [],
    labels: [],
    members: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export default ApiClient;