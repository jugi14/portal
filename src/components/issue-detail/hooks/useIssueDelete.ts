import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { LinearIssue } from '../../../services/linearTeamIssuesService';
import { LinearMutations, LinearQueries } from '../../../services/linearTeamIssuesService';
import { apiClient } from '../../../services/apiClient';

interface UseIssueDeleteProps {
  issue: LinearIssue | null;
  onClose?: () => void;
  onIssueUpdate?: (issue: LinearIssue) => void;
}

interface DeleteConfirmation {
  issueId: string;
  identifier: string;
  title: string;
  isParent: boolean;
  childrenCount: number;
}

export function useIssueDelete({
  issue,
  onClose,
  onIssueUpdate
}: UseIssueDeleteProps) {
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  /**
   * Initiate delete flow with confirmation dialog
   */
  const initiateDelete = useCallback((targetIssue: {
    id: string;
    identifier: string;
    title: string;
    children?: { nodes?: any[] };
  }) => {
    const childrenCount = targetIssue.children?.nodes?.length || 0;
    const isParent = childrenCount > 0;

    setDeleteConfirmation({
      issueId: targetIssue.id,
      identifier: targetIssue.identifier,
      title: targetIssue.title,
      isParent,
      childrenCount
    });

    console.log('[Delete] Initiated delete confirmation:', {
      identifier: targetIssue.identifier,
      isParent,
      childrenCount
    });
  }, []);

  /**
   * Cancel delete operation
   */
  const cancelDelete = useCallback(() => {
    console.log('[Delete] Cancelled');
    setDeleteConfirmation(null);
  }, []);

  /**
   * Execute delete operation after confirmation
   */
  const confirmDelete = useCallback(async () => {
    if (!deleteConfirmation) return;

    const { issueId, identifier, isParent, childrenCount } = deleteConfirmation;
    const toastId = toast.loading(`Deleting ${identifier}...`);
    setIsDeleting(true);

    try {
      console.log('[Delete] Starting delete operation:', {
        issueId,
        identifier,
        isParent,
        childrenCount
      });

      // CRITICAL: Warn about cascade delete for parent issues
      if (isParent && childrenCount > 0) {
        console.warn(`[Delete] Parent issue has ${childrenCount} children - Linear will handle cascade`);
      }

      // Execute delete via Linear API
      const success = await LinearMutations.deleteIssue(issueId);

      if (!success) {
        throw new Error('Delete operation returned false');
      }

      console.log('[Delete] Issue deleted successfully:', identifier);
      
      toast.success(
        isParent && childrenCount > 0
          ? `${identifier} and ${childrenCount} sub-issue${childrenCount > 1 ? 's' : ''} deleted`
          : `${identifier} deleted successfully`,
        { id: toastId }
      );

      // Clear cache for parent issue if this is a sub-issue
      if (issue?.id && issue.id !== issueId) {
        const cacheKey = `linear:issue-detail:issueId:${issue.id}`;
        if (localStorage.getItem(cacheKey)) {
          localStorage.removeItem(cacheKey);
          console.log('[Delete] Cleared parent issue cache:', issue.identifier);
        }
      }

      // Invalidate team cache
      const teamId = issue?.team?.id;
      if (teamId) {
        try {
          LinearQueries.invalidateIssues(teamId);
          console.log('[Delete] Invalidated team cache:', teamId);
        } catch (err) {
          console.warn('[Delete] Cache invalidation failed:', err);
        }
      }

      // Close confirmation dialog
      setDeleteConfirmation(null);

      // CRITICAL: If deleting current issue, close modal
      if (issue?.id === issueId && onClose) {
        setTimeout(() => {
          onClose();
        }, 300);
      }

      // Dispatch event for kanban refresh
      if (teamId) {
        window.dispatchEvent(new CustomEvent('linear-issue-updated', {
          detail: {
            issueId,
            teamId,
            action: 'delete',
            deletedIssue: { identifier }
          }
        }));
      }

      // Use callback if provided (optimized - no full reload)
      if (onIssueUpdate && issue && issue.id !== issueId) {
        console.log('[Delete] Using onIssueUpdate callback to refresh parent');
        // Refresh parent issue to update sub-issues list
        try {
          const refreshed = await LinearQueries.getIssueDetails(issue.id, true);
          if (refreshed) {
            onIssueUpdate(refreshed);
          }
        } catch (err) {
          console.error('[Delete] Failed to refresh parent:', err);
        }
      }

    } catch (error) {
      console.error('[Delete] Failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to delete ${identifier}: ${errorMessage}`, { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  }, [deleteConfirmation, issue, onClose, onIssueUpdate]);

  return {
    deleteConfirmation,
    isDeleting,
    initiateDelete,
    cancelDelete,
    confirmDelete
  };
}
