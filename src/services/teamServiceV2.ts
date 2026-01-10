/**
 *Team Service V2
 *
 * Handles all team-related API calls
 * Uses /teams endpoints from API V2
 *
 * Version: 2.0.0
 * Date: 2025-10-10
 */

import { apiClient } from "./apiClient";

export interface Team {
  id: string;
  name: string;
  key?: string;
  description?: string;
  state?: string;
  color?: string;
  icon?: string;
  timezone?: string;
  cyclesEnabled?: boolean;
  issueCount?: number;

  //NEW: Parent-child hierarchy from Linear
  parentId?: string | null; //Schema V2.0: camelCase
  parentName?: string | null; //Schema V2.0: camelCase
  parentKey?: string | null; //Schema V2.0: camelCase
  parent?: {
    id: string;
    name: string;
    key: string;
    description?: string;
    color?: string;
    icon?: string;
  } | null;
  children?: TeamChild[];
  childCount?: number;
  hasParent?: boolean;
  hasChildren?: boolean;

  // Internal metadata
  membersCount?: number; //Schema V2.0: camelCase
  customersCount?: number; //Schema V2.0: camelCase
  members?: TeamMember[];
  customers?: TeamCustomer[];

  createdAt?: string; //Schema V2.0: camelCase
  updatedAt?: string; //Schema V2.0: camelCase
  syncedAt?: string;
  source?: string;
}

export interface TeamChild {
  id: string;
  name: string;
  key: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface TeamMember {
  userId: string; //Schema V2.0: camelCase
  email: string;
  name: string;
  role: string;
  status: string;
  assignedAt?: string; //Schema V2.0: camelCase
  assignedBy?: string; //Schema V2.0: camelCase
}

export interface TeamCustomer {
  id: string;
  name: string;
  status: string;
}

export interface TeamHierarchy extends Team {
  children: TeamHierarchy[];
  level: number;
  totalDescendants?: number;
}

export interface TeamAccessCheck {
  hasAccess: boolean;
  accessType: "direct" | "customer" | "parent_team" | "none";
  role: string;
  permissions: string[];
}

export interface CreateTeamRequest {
  name: string;
  linearTeamId: string; //Schema V2.0: camelCase
  customerId: string; //Schema V2.0: camelCase
  description?: string;
  parentTeamId?: string | null; //Schema V2.0: camelCase
}

export interface UpdateTeamRequest {
  name?: string;
  description?: string;
  parentTeamId?: string | null; //Schema V2.0: camelCase
  isActive?: boolean; //Schema V2.0: camelCase
}

export const teamServiceV2 = {
  /**
   * Get team hierarchy for current user
   */
  async getHierarchy(): Promise<TeamHierarchy[]> {
    const response = await apiClient.get<TeamHierarchy[]>(
      "/teams/hierarchy",
    );

    if (!response.success) {
      console.error(
        "[TeamService] Failed to fetch team hierarchy:",
        response.error,
      );
      return [];
    }

    return response.data || [];
  },

  /**
   * Get team by ID with full details
   *
   * @param teamId - Linear team ID
   * @param includeHierarchy - Include parent/children relationships (default: true)
   */
  async getById(
    teamId: string,
    includeHierarchy = true,
  ): Promise<Team | null> {
    const response = await apiClient.get<{ team: Team }>(
      `/teams/${teamId}?includeHierarchy=${includeHierarchy}`,
    );

    if (!response.success) {
      console.error(
        `[TeamService] Failed to fetch team ${teamId}:`,
        response.error,
      );
      return null;
    }

    return response.data?.team || null;
  },

  /**
   * Get all teams with optional hierarchy
   *
   * @param includeHierarchy - Include parent-child tree structure
   */
  async getAll(includeHierarchy = false): Promise<{
    teams: Team[];
    hierarchy?: TeamHierarchy[];
    rootTeamsCount?: number;
    totalTeamsCount?: number;
    count: number;
    source?: string;
  }> {
    const response = await apiClient.get<any>(
      `/teams?includeHierarchy=${includeHierarchy}`,
    );

    if (!response.success) {
      console.error(
        "[TeamService] Failed to fetch teams:",
        response.error,
      );
      return {
        teams: [],
        count: 0,
      };
    }

    return response.data || { teams: [], count: 0 };
  },

  /**
   * Create new team
   */
  async create(
    teamData: CreateTeamRequest,
  ): Promise<Team | null> {
    const response = await apiClient.post<Team>(
      "/teams",
      teamData,
    );

    if (!response.success) {
      console.error(
        "[TeamService] Failed to create team:",
        response.error,
      );
      throw new Error(
        response.error || "Failed to create team",
      );
    }

    return response.data || null;
  },

  /**
   * Update team
   */
  async update(
    teamId: string,
    updates: UpdateTeamRequest,
  ): Promise<Team | null> {
    const response = await apiClient.put<Team>(
      `/teams/${teamId}`,
      updates,
    );

    if (!response.success) {
      console.error(
        `[TeamService] Failed to update team ${teamId}:`,
        response.error,
      );
      throw new Error(
        response.error || "Failed to update team",
      );
    }

    return response.data || null;
  },

  /**
   * Delete team
   */
  async delete(teamId: string): Promise<boolean> {
    const response = await apiClient.delete(`/teams/${teamId}`);

    if (!response.success) {
      console.error(
        `[TeamService] Failed to delete team ${teamId}:`,
        response.error,
      );
      throw new Error(
        response.error || "Failed to delete team",
      );
    }

    return true;
  },

  /**
   * Check team access for user
   */
  async checkAccess(
    userId: string,
    teamId: string,
  ): Promise<TeamAccessCheck | null> {
    const response = await apiClient.post<TeamAccessCheck>(
      "/teams/check-access",
      {
        userId,
        teamId,
      },
    );

    if (!response.success) {
      console.error(
        "[TeamService] Failed to check team access:",
        response.error,
      );
      return null;
    }

    return response.data || null;
  },

  /**
   * Get team members
   */
  async getMembers(teamId: string): Promise<any[]> {
    const response = await apiClient.get<any[]>(
      `/teams/${teamId}/members`,
    );

    if (!response.success) {
      console.error(
        `[TeamService] Failed to fetch team members ${teamId}:`,
        response.error,
      );
      return [];
    }

    return response.data || [];
  },

  /**
   * Get current user's teams (via customer assignments)
   */
  async getMyTeams(): Promise<Team[]> {
    const response = await apiClient.get<{ teams: Team[] }>(
      "/teams/my-teams",
    );

    if (!response.success) {
      console.error(
        "[TeamService] Failed to fetch my teams:",
        response.error,
      );
      return [];
    }

    return response.data?.teams || [];
  },

  /**
   * Add member to team
   */
  async addMember(
    teamId: string,
    userId: string,
  ): Promise<boolean> {
    const response = await apiClient.post(
      `/teams/${teamId}/members`,
      { userId },
    );

    if (!response.success) {
      console.error(
        "[TeamService] Failed to add member to team:",
        response.error,
      );
      throw new Error(response.error || "Failed to add member");
    }

    return true;
  },

  /**
   * Remove member from team
   */
  async removeMember(
    teamId: string,
    userId: string,
  ): Promise<boolean> {
    const response = await apiClient.delete(
      `/teams/${teamId}/members/${userId}`,
    );

    if (!response.success) {
      console.error(
        "[TeamService] Failed to remove member from team:",
        response.error,
      );
      throw new Error(
        response.error || "Failed to remove member",
      );
    }

    return true;
  },

  /**
   * Get teams assigned to a customer
   */
  async getTeamsByCustomer(
    customerId: string,
  ): Promise<Team[]> {
    const response = await apiClient.get<{
      teams: Team[];
      count: number;
    }>(`/admin/customers/${customerId}/teams`);

    if (!response.success) {
      console.error(
        `[TeamService] Failed to fetch teams for customer ${customerId}:`,
        response.error,
      );
      return [];
    }

    //V2 API returns { success, data: { teams, count } }
    // Extract teams array from response
    if (response.data && Array.isArray(response.data.teams)) {
      return response.data.teams;
    }

    // Fallback for legacy format (if data is already an array)
    if (Array.isArray(response.data)) {
      return response.data;
    }

    return [];
  },
};