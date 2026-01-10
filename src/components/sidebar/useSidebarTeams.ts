/**
 * useSidebarTeams Hook
 * 
 * Manages team hierarchy loading and state for sidebar
 * CRITICAL: Prevents duplicate API calls with smart caching
 */

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionContext';
import { teamServiceV2 } from '../../services/teamServiceV2';
import { TeamHierarchyNode } from './types';

// Build hierarchy from flat list
function buildHierarchyFromFlat(teams: TeamHierarchyNode[]): TeamHierarchyNode[] {
  const rootTeams = teams.filter(t => !t.parentId && !t.parent_id);
  const childTeams = teams.filter(t => t.parentId || t.parent_id);

  const attachChildren = (parent: TeamHierarchyNode): TeamHierarchyNode => {
    const children = childTeams.filter(
      t => (t.parentId || t.parent_id) === parent.id
    );
    return {
      ...parent,
      children: children.length > 0 ? children.map(attachChildren) : undefined,
    };
  };

  return rootTeams.map(attachChildren);
}

// Flatten hierarchy to list
function flattenHierarchy(hierarchy: TeamHierarchyNode[]): TeamHierarchyNode[] {
  const flat: TeamHierarchyNode[] = [];
  
  const traverse = (node: TeamHierarchyNode) => {
    flat.push(node);
    if (node.children) {
      node.children.forEach(traverse);
    }
  };
  
  hierarchy.forEach(traverse);
  return flat;
}

export function useSidebarTeams() {
  const [teamHierarchy, setTeamHierarchy] = useState<TeamHierarchyNode[]>([]);
  const [flatTeams, setFlatTeams] = useState<TeamHierarchyNode[]>([]);
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});
  const [loadingTeams, setLoadingTeams] = useState(true); // CHANGED: Start with true for initial skeleton
  const [teamsError, setTeamsError] = useState<string | null>(null);

  const { user } = useAuth();
  const { 
    userRole, 
    loading: permissionsLoading,
    teamsLoading, // CRITICAL: Check team hierarchy loading state
    teamHierarchy: contextTeamHierarchy 
  } = usePermissions();

  // Track if teams loaded for this user (prevent reload)
  const teamsLoadedForUserRef = useRef<string | null>(null);

  const loadTeamsHierarchy = async () => {
    if (!user) {
      // Removed verbose log - only keep errors
      return;
    }

    try {
      setLoadingTeams(true);
      setTeamsError(null);

      const isSuperAdmin = userRole?.role === 'superadmin';
      const isAdmin = userRole?.role === 'admin';

      let hierarchy: TeamHierarchyNode[] = [];
      let flatList: TeamHierarchyNode[] = [];

      if (isSuperAdmin) {
        // SUPERADMIN: Get ALL teams with hierarchy
        const result = await teamServiceV2.getAll(true);

        if (result.hierarchy && result.hierarchy.length > 0) {
          hierarchy = result.hierarchy;
          flatList = result.teams || [];
        } else if (result.teams && result.teams.length > 0) {
          flatList = result.teams;
          hierarchy = buildHierarchyFromFlat(result.teams);
        }
      } else {
        // REGULAR USER: Get only accessible teams
        const result = await teamServiceV2.getHierarchy();

        if (result && result.length > 0) {
          hierarchy = result;
          flatList = flattenHierarchy(result);
        }
      }

      if (hierarchy.length > 0) {
        setTeamHierarchy(hierarchy);
        // Removed verbose log - data loaded successfully
      } else {
        // Removed verbose log - only keep critical errors
        setTeamHierarchy([]);
      }

      setFlatTeams(flatList);

      // Auto-expand root teams that have children
      if (hierarchy.length > 0) {
        const defaultExpanded: Record<string, boolean> = {};
        hierarchy.forEach(root => {
          if (root.children && root.children.length > 0) {
            defaultExpanded[root.id] = true;
          }
        });
        setExpandedTeams(defaultExpanded);
      }

      setLoadingTeams(false);
    } catch (error) {
      console.error('[useSidebarTeams] Error loading teams:', error);
      setTeamsError(error instanceof Error ? error.message : 'Failed to load teams');
      setLoadingTeams(false);
    }
  };

  const toggleTeam = (teamId: string) => {
    setExpandedTeams(prev => ({
      ...prev,
      [teamId]: !prev[teamId],
    }));
  };

  // OPTIMIZED: Use hierarchy from PermissionContext (no duplicate API calls)
  useEffect(() => {
    if (!user || !userRole || permissionsLoading) {
      // Removed verbose log - waiting for auth
      return;
    }

    const currentUserId = user.id;
    const currentUserRole = userRole.role;
    const isAdmin = currentUserRole === 'superadmin' || currentUserRole === 'admin';

    // CRITICAL: Check if already loaded for this user
    if (teamsLoadedForUserRef.current === currentUserId) {
      // Removed verbose log - already loaded
      return;
    }

    // OPTIMIZED: Use context hierarchy if available (for regular users)
    if (!isAdmin) {
      // SIMPLE FIX: Wait for PermissionContext to finish loading teams
      if (teamsLoading) {
        // Removed verbose log - waiting for context
        setLoadingTeams(true);
        return; // Wait for teamsLoading to become false
      }
      
      // Removed verbose log - teams from context
      
      setTeamHierarchy(contextTeamHierarchy || []);
      setFlatTeams(contextTeamHierarchy ? flattenHierarchy(contextTeamHierarchy) : []);
      setLoadingTeams(false);

      if (contextTeamHierarchy && contextTeamHierarchy.length > 0) {
        // Auto-expand root teams
        const defaultExpanded: Record<string, boolean> = {};
        contextTeamHierarchy.forEach(root => {
          if (root.children && root.children.length > 0) {
            defaultExpanded[root.id] = true;
          }
        });
        setExpandedTeams(defaultExpanded);
      }

      teamsLoadedForUserRef.current = currentUserId;
      // Removed verbose log - teams loaded
      return;
    }

    // Admins need to load (but only once per user)
    if (isAdmin && teamsLoadedForUserRef.current !== currentUserId) {
      // Removed verbose log - loading for admin
      loadTeamsHierarchy();
      teamsLoadedForUserRef.current = currentUserId;
    }
  }, [user?.id, userRole?.role, permissionsLoading, teamsLoading, contextTeamHierarchy]);

  return {
    teamHierarchy,
    flatTeams,
    expandedTeams,
    loadingTeams,
    teamsError,
    loadTeamsHierarchy,
    toggleTeam,
  };
}