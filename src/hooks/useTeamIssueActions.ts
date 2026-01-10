import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { LinearIssue, LinearMutations } from '../services/linearTeamIssuesService';
import { linearTeamConfigService } from '../services/linearTeamConfigService';

interface UseTeamIssueActionsProps {
  currentTeamId: string | null;
  refreshIssues: () => Promise<void>;
}

interface UseTeamIssueActionsReturn {
  selectedIssue: LinearIssue | null;
  commentText: string;
  addingComment: boolean;
  handleApprove: (issueId: string) => Promise<void>;
  handleRequestChanges: (issueId: string, reason?: string) => Promise<void>;
  handleProvideInput: (issueId: string, issues: LinearIssue[]) => Promise<void>;
  submitComment: () => Promise<void>;
  setSelectedIssue: (issue: LinearIssue | null) => void;
  setCommentText: (text: string) => void;
}

/**
 * Hook for managing team issue actions
 * Handles approve, request changes, and provide input actions
 */
export function useTeamIssueActions({
  currentTeamId,
  refreshIssues,
}: UseTeamIssueActionsProps): UseTeamIssueActionsReturn {
  const [selectedIssue, setSelectedIssue] = useState<LinearIssue | null>(null);
  const [commentText, setCommentText] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  /**
   * Approve an issue and move to Release Ready
   */
  const handleApprove = useCallback(async (issueId: string) => {
    if (!currentTeamId) {
      toast.error('Team ID not available');
      return;
    }

    try {
      console.log(`[IssueActions] Approving issue ${issueId}`);

      const releaseReadyStateId = await linearTeamConfigService.getStateIdByName(
        currentTeamId,
        'Release Ready'
      );

      if (!releaseReadyStateId) {
        toast.error('Release Ready state not found in team configuration');
        return;
      }

      const success = await LinearMutations.updateIssueState(issueId, releaseReadyStateId);

      if (success) {
        toast.success('Issue approved and moved to Release Ready');
        await refreshIssues();
      } else {
        toast.error('Failed to approve issue');
      }
    } catch (error) {
      console.error('[IssueActions] Failed to approve issue:', error);
      toast.error('Failed to approve issue');
    }
  }, [currentTeamId, refreshIssues]);

  /**
   * Request changes for an issue and move to In Progress
   */
  const handleRequestChanges = useCallback(async (issueId: string, reason?: string) => {
    if (!currentTeamId) {
      toast.error('Team ID not available');
      return;
    }

    try {
      console.log(`[IssueActions] Requesting changes for issue ${issueId}`);

      const inProgressStateId = await linearTeamConfigService.getStateIdByName(
        currentTeamId,
        'In Progress'
      );

      if (!inProgressStateId) {
        toast.error('In Progress state not found in team configuration');
        return;
      }

      const stateUpdateSuccess = await LinearMutations.updateIssueState(
        issueId,
        inProgressStateId
      );

      if (stateUpdateSuccess && reason) {
        await LinearMutations.addComment(issueId, `Changes requested by client: ${reason}`);
      }

      if (stateUpdateSuccess) {
        toast.success('Changes requested - Issue moved to In Progress for revision');
        await refreshIssues();
      } else {
        toast.error('Failed to request changes');
      }
    } catch (error) {
      console.error('[IssueActions] Failed to request changes:', error);
      toast.error('Failed to request changes');
    }
  }, [currentTeamId, refreshIssues]);

  /**
   * Provide input for an issue
   */
  const handleProvideInput = useCallback(async (issueId: string, issues: LinearIssue[]) => {
    try {
      const issue = issues.find((i) => i.id === issueId);
      setSelectedIssue(issue || null);
    } catch (error) {
      console.error('[IssueActions] Failed to provide input:', error);
      toast.error('Failed to provide input');
    }
  }, []);

  /**
   * Submit comment for selected issue
   */
  const submitComment = useCallback(async () => {
    if (!selectedIssue || !commentText.trim()) {
      return;
    }

    try {
      setAddingComment(true);
      await LinearMutations.addComment(selectedIssue.id, commentText);
      toast.success('Input provided successfully');
      setCommentText('');
      setSelectedIssue(null);
      await refreshIssues();
    } catch (error) {
      console.error('[IssueActions] Failed to add comment:', error);
      toast.error('Failed to provide input');
    } finally {
      setAddingComment(false);
    }
  }, [selectedIssue, commentText, refreshIssues]);

  return {
    selectedIssue,
    commentText,
    addingComment,
    handleApprove,
    handleRequestChanges,
    handleProvideInput,
    submitComment,
    setSelectedIssue,
    setCommentText,
  };
}
