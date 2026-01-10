/**
 * Linear Teams Service - Frontend client for Linear API
 *
 *MIGRATED: Now uses global apiClient for authenticated requests
 * Version: 2.0.0
 * Date: 2025-10-11
 */

import { apiClient } from "./apiClient";
import { sessionManager } from "./sessionManager";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  cached?: boolean;
  fallback?: boolean;
  timestamp?: string;
}

interface Team {
  id: string;
  name: string;
  key: string;
  description?: string;
  members?: Array<{
    name: string;
    email: string;
    avatarUrl?: string;
  }>;
  states?: Array<{
    id: string;
    name: string;
    type: string;
    color: string;
    position?: number;
  }>;
  labels?: Array<{
    id: string;
    name: string;
    color: string;
    description?: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

interface ProcessedTeam {
  id: string;
  name: string;
  key: string;
  description: string | null;
  parent?: { id: string; name: string } | null;
  level: number;
  childCount: number;
  totalDescendants: number;
  children: ProcessedTeam[];
}

interface TeamHierarchyResponse {
  totalTeams: number;
  rootTeams: number;
  hierarchy: ProcessedTeam[];
}

interface Label {
  id: string;
  name: string;
  color: string;
  description?: string;
  createdAt?: string;
}

class LinearTeamService {
  /**
   * Test connection to Linear API
   *MIGRATED: Uses global apiClient
   */
  async testConnection(): Promise<
    ApiResponse<{
      success: boolean;
      message: string;
      data?: any;
    }>
  > {
    // ️ Skip if page is hidden (save API calls)
    if (typeof document !== "undefined" && document.hidden) {
      return { success: false, error: "Page hidden" };
    }

    return apiClient.get("/test-linear");
  }

  /**
   * Health check
   *MIGRATED: Uses global apiClient
   */
  async healthCheck(): Promise<
    ApiResponse<{ status: string }>
  > {
    // ️ Skip if page is hidden
    if (typeof document !== "undefined" && document.hidden) {
      return { success: false, error: "Page hidden" };
    }

    return apiClient.get("/health");
  }

  /**
   * List all teams
   *MIGRATED: Uses global apiClient
   */
  async listTeams(customerId?: string): Promise<
    ApiResponse<{
      success: boolean;
      teams: Team[];
      message: string;
      teamsCount: number;
    }>
  > {
    const queryParams = customerId
      ? `?customerId=${encodeURIComponent(customerId)}`
      : "";
    return apiClient.get(`/linear/teams${queryParams}`);
  }

  /**
   * Get teams with hierarchy structure
   *MIGRATED: Uses global apiClient
   */
  async getTeamsHierarchy(
    customerId?: string,
  ): Promise<ApiResponse<TeamHierarchyResponse>> {
    const queryParams = customerId
      ? `?customerId=${encodeURIComponent(customerId)}`
      : "";
    return apiClient.get(
      `/linear/teams/hierarchy${queryParams}`,
    );
  }

  /**
   * Alias for getTeamsHierarchy to match server-side method name
   */
  async getProcessedTeamsHierarchy(
    customerId?: string,
  ): Promise<ApiResponse<TeamHierarchyResponse>> {
    return this.getTeamsHierarchy(customerId);
  }

  /**
   *Build hierarchy tree from flat teams with parent relationships
   * Matches backend buildHierarchyFromParents logic
   */
  buildHierarchyFromParents(
    rawTeams: Array<{
      id: string;
      name: string;
      key: string;
      description?: string;
      parent?: { id: string; name: string } | null;
    }>,
  ): ProcessedTeam[] {
    // Create map: team.id → team object with children array
    const teamsMap = new Map<string, ProcessedTeam>();

    for (const team of rawTeams) {
      teamsMap.set(team.id, {
        id: team.id,
        name: team.name,
        key: team.key || team.id,
        description: team.description || null,
        parent: team.parent || null,
        children: [],
        level: 0,
        childCount: 0,
        totalDescendants: 0,
      });
    }
    // Attach children by iterating through all teams
    for (const team of rawTeams) {
      if (team.parent?.id && teamsMap.has(team.parent.id)) {
        const parentTeam = teamsMap.get(team.parent.id);
        const childTeam = teamsMap.get(team.id);
        if (parentTeam && childTeam) {
          parentTeam.children.push(childTeam);
        }
      }
    }

    // Calculate hierarchy metrics (level, childCount, totalDescendants)
    const calculateMetrics = (
      team: ProcessedTeam,
      level: number,
    ): number => {
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
      .filter((t): t is ProcessedTeam => t !== undefined);
    // Calculate metrics for all root teams and their descendants
    for (const root of roots) {
      calculateMetrics(root, 0);
    }

    // Sort roots alphabetically
    roots.sort((a, b) => a.name.localeCompare(b.name));
    return roots;
  }

  /**
   * Count all teams in hierarchy tree (recursive)
   */
  countAllTeams(teams: ProcessedTeam[]): number {
    return teams.reduce((count, team) => {
      return (
        count + 1 + this.countAllTeams(team.children || [])
      );
    }, 0);
  }

  /**
   * Get team by ID
   *MIGRATED: Uses global apiClient
   */
  async getTeamById(teamId: string): Promise<
    ApiResponse<{
      success: boolean;
      team: Team;
    }>
  > {
    return apiClient.get(`/linear/teams/${teamId}/config`);
  }

  /**
   * Get team labels
   *MIGRATED: Uses global apiClient
   */
  async getTeamLabels(teamId: string): Promise<
    ApiResponse<{
      success: boolean;
      labels: Label[];
      count: number;
      teamId: string;
    }>
  > {
    return apiClient.get(`/labels/${teamId}`);
  }
}

// Export singleton instance
export const linearTeamService = new LinearTeamService();

// Export types for use in components
export type {
  Team,
  Label,
  ProcessedTeam,
  TeamHierarchyResponse,
  ApiResponse,
};