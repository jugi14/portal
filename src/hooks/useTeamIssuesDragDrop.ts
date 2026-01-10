import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { LinearIssue, LinearState, LinearMutations, LinearQueries } from '../services/linearTeamIssuesService';
import { isValidDrop } from '../utils/teamIssuesDragDrop';

interface UseTeamIssuesDragDropProps {
  columns: LinearState[];
  currentTeamId: string | null;
  moveIssueOptimistically: (
    issueId: string,
    sourceStateId: string,
    targetStateId: string,
    targetState: LinearState
  ) => { updatedIssue: LinearIssue; originalIssue: LinearIssue };
  revertIssueMove: (
    issueId: string,
    sourceStateId: string,
    targetStateId: string,
    originalIssue: LinearIssue
  ) => void;
  refreshIssues: () => Promise<void>;
  userRole?: string;
}

interface UseTeamIssuesDragDropReturn {
  syncingIssues: Set<string>;
  dragInProgress: Set<string>;
  handleDragStart: (issue: LinearIssue, sourceStateId: string) => void;
  handleDragOver: (event: React.DragEvent, targetStateId: string) => void;
  handleDragLeave: (event: React.DragEvent) => void;
  handleDrop: (event: React.DragEvent, targetStateId: string) => Promise<void>;
  clearAllDragStates: () => void;
}

/**
 * Hook for managing drag and drop operations for team issues
 * Handles drag state, validation, optimistic updates, and API sync
 */
export function useTeamIssuesDragDrop({
  columns,
  currentTeamId,
  moveIssueOptimistically,
  revertIssueMove,
  refreshIssues,
  userRole,
}: UseTeamIssuesDragDropProps): UseTeamIssuesDragDropReturn {
  const [syncingIssues, setSyncingIssues] = useState<Set<string>>(new Set());
  const [dragInProgress, setDragInProgress] = useState<Set<string>>(new Set());
  const dragThrottleRef = useRef<Map<string, number>>(new Map());

  /**
   * Clear all drag-related states
   */
  const clearAllDragStates = useCallback(() => {
    // Clear drag visual states from DOM
    document.querySelectorAll('.drop-zone-active, .drop-zone-invalid').forEach((element) => {
      element.classList.remove('drop-zone-active', 'drop-zone-invalid');
    });

    // Clear session storage
    sessionStorage.removeItem('dragData');

    // Clear drag in progress set
    setDragInProgress(new Set());

    // Clear throttle timeouts
    dragThrottleRef.current.forEach((timeout) => clearTimeout(timeout));
    dragThrottleRef.current.clear();

    console.log('[DragDrop] All drag states cleared');
  }, []);

  /**
   * Handle drag start event
   */
  const handleDragStart = useCallback((issue: LinearIssue, sourceStateId: string) => {
    console.log('[DragDrop] Starting drag:', {
      issueId: issue.id,
      sourceState: issue.state.name,
      sourceStateId,
    });

    const dragData = {
      issueId: issue.id,
      sourceStateId,
      issue,
    };

    sessionStorage.setItem('dragData', JSON.stringify(dragData));

    toast.info(`Dragging: ${issue.title}`);
  }, []);

  /**
   * Handle drag over event
   */
  const handleDragOver = useCallback((event: React.DragEvent, targetStateId: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const element = event.currentTarget as HTMLElement;
    element.classList.remove('drop-zone-active', 'drop-zone-invalid');
    element.classList.add('drop-zone-active');

    // Quick validation for visual feedback
    try {
      const dragDataStr = sessionStorage.getItem('dragData');
      if (dragDataStr) {
        const dragData = JSON.parse(dragDataStr);
        const { sourceStateId } = dragData;

        if (sourceStateId === targetStateId) {
          event.dataTransfer.dropEffect = 'none';
          element.classList.remove('drop-zone-active');
          element.classList.add('drop-zone-invalid');
        }
      }
    } catch (error) {
      console.warn('[DragDrop] Drag validation error:', error);
    }
  }, []);

  /**
   * Handle drag leave event
   */
  const handleDragLeave = useCallback((event: React.DragEvent) => {
    const element = event.currentTarget as HTMLElement;
    const relatedTarget = event.relatedTarget as HTMLElement;

    // Don't remove classes if moving to child element
    if (relatedTarget && element.contains(relatedTarget)) {
      return;
    }

    element.classList.remove('drop-zone-active', 'drop-zone-invalid');
  }, []);

  /**
   * Handle drop event
   */
  const handleDrop = useCallback(async (event: React.DragEvent, targetStateId: string) => {
    event.preventDefault();

    const element = event.currentTarget as HTMLElement;
    element.classList.remove('drop-zone-active', 'drop-zone-invalid');

    let dragData: any = null;

    try {
      const dragDataStr = sessionStorage.getItem('dragData');
      if (!dragDataStr) return;

      dragData = JSON.parse(dragDataStr);
      const { issueId, sourceStateId, issue } = dragData;

      // Validation: Check drop validity (including parent-children rules)
      const validationResult = isValidDrop(sourceStateId, targetStateId, issue, userRole);

      if (!validationResult.isValid) {
        console.log('[DragDrop] Drop prevented:', validationResult);

        toast.error(validationResult.title || 'Cannot Move Issue', {
          description:
            validationResult.reason +
            (validationResult.suggestion ? `\n${validationResult.suggestion}` : ''),
          duration: 5000,
        });

        return;
      }

      // Prevent concurrent operations
      if (dragInProgress.has(issueId)) {
        toast.info('Please wait, previous operation is still processing', { duration: 2000 });
        return;
      }

      // Throttle rapid drags
      const throttleKey = `${issueId}-${sourceStateId}-${targetStateId}`;
      if (dragThrottleRef.current.has(throttleKey)) {
        toast.info('Please wait before moving this item again', { duration: 1500 });
        return;
      }

      const throttleTimeout = setTimeout(() => {
        dragThrottleRef.current.delete(throttleKey);
      }, 1000);

      dragThrottleRef.current.set(throttleKey, throttleTimeout as unknown as number);
      setDragInProgress((prev) => new Set(prev).add(issueId));

      // Same state check
      if (sourceStateId === targetStateId) {
        toast.info('Issue is already in this state');
        return;
      }

      // Find target state
      const targetState = columns.find((s) => s.id === targetStateId);
      if (!targetState) {
        toast.error('Target state not found');
        return;
      }

      console.log('[DragDrop] Moving issue:', {
        issueId,
        from: issue.state.name,
        to: targetState.name,
      });

      // OPTIMISTIC UPDATE: Update UI immediately
      const { originalIssue } = moveIssueOptimistically(
        issueId,
        sourceStateId,
        targetStateId,
        targetState
      );

      toast.success(`Moved to ${targetState.name}`);

      // Background API update
      try {
        setSyncingIssues((prev) => new Set(prev).add(issueId));

        // Invalidate cache before mutation
        if (currentTeamId) {
          LinearQueries.invalidateIssues(currentTeamId);
        }

        const success = await LinearMutations.updateIssueState(issueId, targetStateId);

        if (success) {
          setSyncingIssues((prev) => {
            const newSet = new Set(prev);
            newSet.delete(issueId);
            return newSet;
          });
        } else {
          throw new Error('API update failed');
        }
      } catch (apiError) {
        console.error('[DragDrop] API update failed:', apiError);

        // Revert optimistic update
        revertIssueMove(issueId, sourceStateId, targetStateId, originalIssue);

        setSyncingIssues((prev) => {
          const newSet = new Set(prev);
          newSet.delete(issueId);
          return newSet;
        });

        toast.error('Failed to update - reverted changes');
      }
    } catch (error) {
      console.error('[DragDrop] Drop failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to move issue: ${errorMessage}`);
    } finally {
      sessionStorage.removeItem('dragData');

      document.querySelectorAll('.drop-zone-active, .drop-zone-invalid').forEach((el) => {
        el.classList.remove('drop-zone-active', 'drop-zone-invalid');
      });

      if (dragData?.issueId) {
        setDragInProgress((prev) => {
          const newSet = new Set(prev);
          newSet.delete(dragData.issueId);
          return newSet;
        });
      }
    }
  }, [columns, currentTeamId, dragInProgress, moveIssueOptimistically, revertIssueMove, userRole]);

  // Global drag cleanup listeners
  useEffect(() => {
    const handleGlobalDragEnd = () => {
      setTimeout(() => clearAllDragStates(), 100);
    };

    const handleGlobalDragLeave = (event: DragEvent) => {
      if (!event.relatedTarget) {
        setTimeout(() => clearAllDragStates(), 100);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearAllDragStates();
      }
    };

    document.addEventListener('dragend', handleGlobalDragEnd);
    document.addEventListener('dragleave', handleGlobalDragLeave);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('dragend', handleGlobalDragEnd);
      document.removeEventListener('dragleave', handleGlobalDragLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clearAllDragStates]);

  return {
    syncingIssues,
    dragInProgress,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    clearAllDragStates,
  };
}