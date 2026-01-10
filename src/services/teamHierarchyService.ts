/**
 * 🏗️ Team Hierarchy Service
 * 
 * Simple service for fetching team hierarchy from KV database
 * NO CACHING - Direct KV database calls only
 * 
 * Version: 3.0.0
 * Date: 2025-10-10
 * 
 * Simplified from teamHierarchyCacheService to remove all caching logic.
 * Teams are fetched directly from KV database via /teams/hierarchy endpoint.
 */

import { apiClient } from './apiClient';

export interface TeamHierarchy {
  id: string;
  name: string;
  key: string;
  description?: string;
  parent?: { id: string; name: string } | null;
  level?: number;
  children?: TeamHierarchy[];
  childCount?: number;
  totalDescendants?: number;
}

class TeamHierarchyService {
  /**
   * Get teams hierarchy directly from KV database
   * NO CACHING - Always fresh data
   */
  async getTeamsHierarchy(): Promise<TeamHierarchy[]> {
    const response = await apiClient.get<TeamHierarchy[]>('/teams/hierarchy');

    if (!response.success) {
      console.error('❌ [TeamHierarchy] API error:', response.error);
      return [];
    }

    const hierarchy = response.data || [];
    return hierarchy;
  }

  /**
   * Get all teams (flat list, not hierarchy)
   */
  async getAllTeamsFlat(): Promise<TeamHierarchy[]> {
    const hierarchy = await this.getTeamsHierarchy();
    return this.flattenHierarchy(hierarchy);
  }

  /**
   * Flatten hierarchy to a flat list of teams
   */
  private flattenHierarchy(hierarchy: TeamHierarchy[]): TeamHierarchy[] {
    const teams: TeamHierarchy[] = [];
    
    for (const customer of hierarchy) {
      if (customer.children) {
        teams.push(...customer.children);
      }
    }
    
    return teams;
  }

  /**
   * Get team by ID
   */
  async getTeamById(teamId: string): Promise<TeamHierarchy | null> {
    const teams = await this.getAllTeamsFlat();
    return teams.find(t => t.id === teamId) || null;
  }

  /**
   * Get customer's teams
   */
  async getCustomerTeams(customerId: string): Promise<TeamHierarchy[]> {
    const hierarchy = await this.getTeamsHierarchy();
    const customer = hierarchy.find(c => c.id === customerId);
    return customer?.children || [];
  }

  /**
   * 🌳 Build hierarchy tree from flat teams with parent relationships
   * Matches backend buildHierarchyFromParents logic
   */
  buildHierarchyFromParents(rawTeams: Array<{
    id: string;
    name: string;
    key: string;
    description?: string;
    parent?: { id: string; name: string } | null;
  }>): TeamHierarchy[] {
    // Create map: team.id → team object with children array
    const teamsMap = new Map<string, TeamHierarchy>();
    
    for (const team of rawTeams) {
      teamsMap.set(team.id, {
        id: team.id,
        name: team.name,
        key: team.key || team.id,
        description: team.description,
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
          parentTeam.children!.push(childTeam);
        }
      }
    }

    // Calculate hierarchy metrics (level, childCount, totalDescendants)
    const calculateMetrics = (team: TeamHierarchy, level: number): number => {
      team.level = level;
      team.childCount = team.children?.length || 0;
      let totalDescendants = team.children?.length || 0;

      for (const child of team.children || []) {
        totalDescendants += calculateMetrics(child, level + 1);
      }

      team.totalDescendants = totalDescendants;
      return totalDescendants;
    };

    // Filter root teams (those without a parent)
    const roots = rawTeams
      .filter((t) => !t.parent || !t.parent.id)
      .map((t) => teamsMap.get(t.id))
      .filter((t): t is TeamHierarchy => t !== undefined);
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
  countAllTeams(teams: TeamHierarchy[]): number {
    return teams.reduce((count, team) => {
      return count + 1 + this.countAllTeams(team.children || []);
    }, 0);
  }
}

export const teamHierarchyService = new TeamHierarchyService();

// Backward compatibility alias
export const teamHierarchyCache = teamHierarchyService;
