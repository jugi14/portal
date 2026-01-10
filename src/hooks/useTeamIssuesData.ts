import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { LinearIssue, LinearTeam, LinearState, LinearQueries } from '../services/linearTeamIssuesService';
import { apiClient } from '../services/apiClient';

interface UseTeamIssuesDataProps {
  teamId: string;
  onIssuesUpdate?: (totalCount: number) => void;
  onError?: (error: string) => void;
}

interface UseTeamIssuesDataReturn {
  issues: LinearIssue[];
  teamConfig: LinearTeam | null;
  columns: LinearState[];
  issuesByState: Record<string, LinearIssue[]>;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  currentTeamId: string | null;
  initializeKanban: () => Promise<void>;
  refreshIssues: () => Promise<void>;
  updateIssueInState: (updatedIssue: LinearIssue) => void;
  moveIssueOptimistically: (
    issueId: string,
    sourceStateId: string,
    targetStateId: string,
    targetState: LinearState
  ) => { updatedIssue: LinearIssue; originalIssue: LinearIssue };
  revertIssueMove: (issueId: string, sourceStateId: string, targetStateId: string, originalIssue: LinearIssue) => void;
}

/**
 * Hook for managing team issues data loading and state
 * Handles initialization, refreshing, and optimistic updates
 */
export function useTeamIssuesData({
  teamId,
  onIssuesUpdate,
  onError,
}: UseTeamIssuesDataProps): UseTeamIssuesDataReturn {
  const [issues, setIssues] = useState<LinearIssue[]>([]);
  const [teamConfig, setTeamConfig] = useState<LinearTeam | null>(null);
  const [columns, setColumns] = useState<LinearState[]>([]);
  const [issuesByState, setIssuesByState] = useState<Record<string, LinearIssue[]>>({});
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(teamId || null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initializingRef = useRef(false);

  const cacheKey = `team-issues-${teamId}`;

  /**
   * Load team issues from API
   */
  const loadTeamIssues = useCallback(async (teamId: string): Promise<boolean> => {
    // Validate teamId
    if (!teamId || typeof teamId !== 'string') {
      console.error('[useTeamIssuesData] Invalid teamId:', teamId);
      setError('Invalid team ID');
      return false;
    }

    // Validate Linear team ID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const alphanumericRegex = /^[a-z0-9]+$/i;
    
    if (!uuidRegex.test(teamId) && !alphanumericRegex.test(teamId)) {
      console.error('[useTeamIssuesData] Invalid Linear team ID format:', teamId);
      setError(`Invalid Linear team ID format: ${teamId}`);
      return false;
    }

    try {
      console.log(`[useTeamIssuesData] Loading team configuration and issues for: ${teamId}`);

      const response = await apiClient.get(`/linear/teams/${teamId}/issues-by-state`);

      if (!response.success || !response.data) {
        if (response.error && response.error.includes('not found in Linear workspace')) {
          console.warn(`[useTeamIssuesData] Team ${teamId} not found in Linear workspace - may have been deleted`);
          throw new Error('TEAM_NOT_FOUND');
        }
        throw new Error(response.error || `Failed to fetch issues for team ${teamId}`);
      }

      const { team, states, totalIssues } = response.data;

      console.log(
        `[useTeamIssuesData] Loaded ${team.name} (${team.key}): ${totalIssues} total issues across ${states.length} states`
      );

      // Build team config
      const config = {
        id: team.id,
        name: team.name,
        key: team.key,
        states: states.map((s: any) => s.state),
      };

      setTeamConfig(config);
      setColumns(states.map((s: any) => s.state));

      // Convert states array to issuesByState object
      const grouped: Record<string, LinearIssue[]> = {};
      states.forEach((stateData: any) => {
        grouped[stateData.state.id] = stateData.issues || [];
      });

      setIssuesByState(grouped);

      // Flatten to get all PARENT issues
      const allIssues = states.flatMap((s: any) => s.issues || []);
      setIssues(allIssues);

      // Notify parent component
      if (onIssuesUpdate) {
        onIssuesUpdate(allIssues.length);
      }

      return true;
    } catch (error) {
      console.error('[useTeamIssuesData] Failed to load team issues:', error);
      setError(
        error instanceof Error ? error.message : 'Failed to load team issues data'
      );
      return false;
    }
  }, [onIssuesUpdate]);

  /**
   * Initialize kanban board
   */
  const initializeKanban = useCallback(async () => {
    if (initializingRef.current) {
      console.log('[useTeamIssuesData] Initialization already in progress');
      return;
    }

    if (!teamId) {
      const errorMsg = 'Team ID is required';
      console.error('[useTeamIssuesData]', errorMsg);
      setError(errorMsg);
      setLoading(false);
      return;
    }

    try {
      initializingRef.current = true;
      setLoading(true);
      setError(null);
      setCurrentTeamId(teamId);

      // Check for cache invalidation after extended tab hiding
      const tabHiddenAt = sessionStorage.getItem('tab_hidden_at');
      if (tabHiddenAt) {
        const hiddenDuration = Date.now() - parseInt(tabHiddenAt);
        if (hiddenDuration > 2 * 60 * 1000) {
          console.log(
            `[useTeamIssuesData] Tab was hidden for ${Math.round(hiddenDuration / 1000)}s - clearing cache`
          );
          LinearQueries.invalidateIssues(teamId);
        }
      }

      const success = await loadTeamIssues(teamId);

      if (!success) {
        throw new Error('Failed to load team issues');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to load team issues';
      
      // GRACEFUL: Handle team not found without showing error to user
      if (errorMessage === 'TEAM_NOT_FOUND') {
        console.warn(`[useTeamIssuesData] Team ${teamId} not found - skipping without user notification`);
        setError('Team not found in Linear workspace');
        // Don't show toast for missing teams - they may be stale in hierarchy
        return;
      }
      
      console.error('[useTeamIssuesData] Initialization failed:', error);
      setError(errorMessage);
      onError?.(errorMessage);
      toast.error('Failed to load team issues');
    } finally {
      setLoading(false);
      initializingRef.current = false;
    }
  }, [teamId, loadTeamIssues, onError]);

  /**
   * Refresh issues manually
   */
  const refreshIssues = useCallback(async () => {
    if (!currentTeamId) {
      toast.error('Team not loaded');
      return;
    }

    if (refreshing) {
      console.log('[useTeamIssuesData] Refresh already in progress');
      return;
    }

    setRefreshing(true);
    try {
      console.log('[useTeamIssuesData] Manual refresh triggered');

      // Force fresh data
      LinearQueries.invalidateIssues(currentTeamId);
      sessionStorage.removeItem(cacheKey);

      const success = await loadTeamIssues(currentTeamId);
      if (success) {
        toast.success('Issues refreshed');
      } else {
        toast.error('Failed to refresh some data');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // GRACEFUL: Handle team not found during refresh
      if (errorMessage === 'TEAM_NOT_FOUND') {
        console.warn('[useTeamIssuesData] Team no longer exists in Linear - refresh skipped');
        toast.info('This team is no longer available in Linear');
        return;
      }
      
      console.error('[useTeamIssuesData] Refresh failed:', error);
      toast.error('Failed to refresh issues');
    } finally {
      setRefreshing(false);
    }
  }, [currentTeamId, refreshing, cacheKey, loadTeamIssues]);

  /**
   * Update a single issue in state
   */
  const updateIssueInState = useCallback((updatedIssue: LinearIssue) => {
    // Update issues array
    setIssues((currentIssues) =>
      currentIssues.map((issue) =>
        issue.id === updatedIssue.id ? updatedIssue : issue
      )
    );

    // CRITICAL: Also update issuesByState for kanban board
    setIssuesByState((currentGrouped) => {
      const newGrouped = { ...currentGrouped };
      
      // Find which state the issue is currently in
      let foundInStateId: string | null = null;
      for (const stateId in newGrouped) {
        if (newGrouped[stateId].some((issue) => issue.id === updatedIssue.id)) {
          foundInStateId = stateId;
          break;
        }
      }

      // If found in a state
      if (foundInStateId) {
        const newStateId = updatedIssue.state?.id;
        
        // If state changed, move to new state
        if (newStateId && foundInStateId !== newStateId) {
          // Remove from old state
          newGrouped[foundInStateId] = newGrouped[foundInStateId].filter(
            (issue) => issue.id !== updatedIssue.id
          );
          
          // Add to new state
          newGrouped[newStateId] = [...(newGrouped[newStateId] || []), updatedIssue];
          
          console.log(`[updateIssueInState] Moved ${updatedIssue.identifier} from ${foundInStateId} to ${newStateId}`);
        } else {
          // Update in same state
          newGrouped[foundInStateId] = newGrouped[foundInStateId].map((issue) =>
            issue.id === updatedIssue.id ? updatedIssue : issue
          );
          
          console.log(`[updateIssueInState] Updated ${updatedIssue.identifier} in ${foundInStateId}`);
        }
      }

      return newGrouped;
    });
  }, []);

  /**
   * Move issue optimistically between states
   */
  const moveIssueOptimistically = useCallback((
    issueId: string,
    sourceStateId: string,
    targetStateId: string,
    targetState: LinearState
  ) => {
    let updatedIssue: LinearIssue | null = null;
    let originalIssue: LinearIssue | null = null;

    setIssuesByState((prev) => {
      const newGrouped = { ...prev };
      
      // Find the original issue
      const sourceIssue = newGrouped[sourceStateId]?.find((i) => i.id === issueId);
      if (!sourceIssue) {
        return prev;
      }

      originalIssue = sourceIssue;
      updatedIssue = { ...sourceIssue, state: targetState };

      // Remove from source
      newGrouped[sourceStateId] = newGrouped[sourceStateId].filter((i) => i.id !== issueId);

      // Add to target
      newGrouped[targetStateId] = [...(newGrouped[targetStateId] || []), updatedIssue];

      return newGrouped;
    });

    // Update flat issues array
    if (updatedIssue) {
      setIssues((prevIssues) =>
        prevIssues.map((i) => (i.id === issueId ? updatedIssue! : i))
      );
    }

    return { updatedIssue: updatedIssue!, originalIssue: originalIssue! };
  }, []);

  /**
   * Revert an optimistic issue move
   */
  const revertIssueMove = useCallback((
    issueId: string,
    sourceStateId: string,
    targetStateId: string,
    originalIssue: LinearIssue
  ) => {
    setIssuesByState((prev) => {
      const reverted = { ...prev };

      // Remove from target
      reverted[targetStateId] = reverted[targetStateId].filter((i) => i.id !== issueId);

      // Add back to source
      reverted[sourceStateId] = [...(reverted[sourceStateId] || []), originalIssue];

      return reverted;
    });

    // Revert flat issues array
    setIssues((prevIssues) =>
      prevIssues.map((i) => (i.id === issueId ? originalIssue : i))
    );
  }, []);

  // Initialize on mount or teamId change
  useEffect(() => {
    if (teamId) {
      initializeKanban();
    }

    return () => {
      initializingRef.current = false;
    };
  }, [teamId, initializeKanban]);

  return {
    issues,
    teamConfig,
    columns,
    issuesByState,
    loading,
    refreshing,
    error,
    currentTeamId,
    initializeKanban,
    refreshIssues,
    updateIssueInState,
    moveIssueOptimistically,
    revertIssueMove,
  };
}