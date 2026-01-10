/**
 * Dashboard Data Hook - Simplified
 * 
 * OPTIMIZATION: Removed cache layer - PermissionContext already provides data
 * 
 * Why:
 * - PermissionContext loads teamHierarchy on app init
 * - No need to cache again in Dashboard
 * - Simpler, faster, follows DRY principle
 * 
 * Follows Guidelines.md:
 * - KISS: Use existing context data
 * - DRY: Don't duplicate PermissionContext logic
 * - Performance: No redundant cache layer
 */

import { useMemo, useCallback } from 'react';
import { usePermissions } from '../contexts/PermissionContext';
import type { TeamHierarchy } from '../services/teamHierarchyService';

interface DashboardStats {
  totalTeams: number;
  totalIssues: number;
  activeIssues: number;
  completedIssues: number;
  teamMembers: number;
}

interface AccessibleTeam extends TeamHierarchy {
  issueCount?: number;
  activeIssueCount?: number;
  completedIssueCount?: number;
  memberCount?: number;
}

export function useDashboardData() {
  const { 
    teamHierarchy: contextTeamHierarchy,
    loading: permissionsLoading,
    teamsLoading // NEW: Get teamsLoading state from PermissionContext
  } = usePermissions();

  // Extract teams from hierarchy - memoized
  const teams = useMemo(() => {
    if (!contextTeamHierarchy || contextTeamHierarchy.length === 0) {
      return [];
    }

    const extractedTeams: AccessibleTeam[] = [];
    
    for (const customer of contextTeamHierarchy) {
      if (customer.children && Array.isArray(customer.children)) {
        customer.children.forEach(team => {
          extractedTeams.push(team as AccessibleTeam);
        });
      }
    }

    return extractedTeams;
  }, [contextTeamHierarchy]);

  // Flatten teams helper - memoized
  const flattenedTeams = useMemo(() => {
    const flat: AccessibleTeam[] = [];
    
    const traverse = (t: AccessibleTeam) => {
      flat.push(t);
      if (t.children) {
        t.children.forEach(child => traverse(child as AccessibleTeam));
      }
    };
    
    teams.forEach(traverse);
    return flat;
  }, [teams]);

  // Sort teams - memoized
  const sortedTeams = useMemo(() => {
    const sortTeams = (teamsList: AccessibleTeam[]): AccessibleTeam[] => {
      return teamsList.sort((a, b) => {
        const aHasChildren = (a.children?.length || 0) > 0;
        const bHasChildren = (b.children?.length || 0) > 0;
        
        if (aHasChildren && !bHasChildren) return -1;
        if (!aHasChildren && bHasChildren) return 1;
        
        return a.name.localeCompare(b.name);
      }).map(team => {
        if (team.children && team.children.length > 0) {
          return {
            ...team,
            children: sortTeams(team.children as AccessibleTeam[])
          };
        }
        return team;
      });
    };

    return sortTeams([...teams]);
  }, [teams]);

  // Calculate stats - memoized
  const stats = useMemo((): DashboardStats => {
    return {
      totalTeams: flattenedTeams.length,
      totalIssues: 0,
      activeIssues: 0,
      completedIssues: 0,
      teamMembers: 0,
    };
  }, [flattenedTeams]);

  // No-op refresh since PermissionContext handles data
  const handleRefresh = useCallback(async () => {
    console.log('[Dashboard] Refresh requested - PermissionContext handles data');
    // PermissionContext.refreshTeamAccess() could be called if needed
  }, []);

  return {
    loading: permissionsLoading || teamsLoading, // Wait for BOTH permissions AND teams
    refreshing: false, // No background refresh needed
    stats,
    teams: sortedTeams,
    handleRefresh,
  };
}