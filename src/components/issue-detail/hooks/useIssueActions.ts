import { useCallback } from 'react';
import { toast } from 'sonner';
import type { LinearIssue } from '../../../services/linearTeamIssuesService';
import { LinearMutations, LinearQueries } from '../../../services/linearTeamIssuesService';
import { apiClient } from '../../../services/apiClient';
import { projectId } from '../../../utils/supabase/info';

interface UseIssueActionsProps {
  issue: LinearIssue | null;
  currentIssue: LinearIssue | null;
  issueDetails: LinearIssue | null;
  onRefreshDetails: (forceRefresh?: boolean) => Promise<void>;
  onIssueUpdate?: (updatedIssue: LinearIssue) => void;
}

export function useIssueActions({
  issue,
  currentIssue,
  issueDetails,
  onRefreshDetails,
  onIssueUpdate
}: UseIssueActionsProps) {
  
  const getTeamId = useCallback(() => {
    return (issueDetails || issue)?.team?.id;
  }, [issueDetails, issue]);

  const getStateIdByName = useCallback(async (stateName: string): Promise<{ stateId: string; stateName: string } | null> => {
    const teamId = getTeamId();
    if (!teamId) {
      console.error('[IssueActions] Team ID not found');
      toast.error('Team information missing');
      return null;
    }

    const accessToken = apiClient.getAccessToken();
    if (!accessToken) {
      console.error('[IssueActions] No access token found or expired');
      toast.error('Authentication required. Please sign in again.');
      return null;
    }

    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-7f0d90fb/linear/teams/${teamId}/state-by-name?name=${encodeURIComponent(stateName)}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const result = await response.json();

    if (!result.success || !result.data?.stateId) {
      console.error('[IssueActions] Failed to get state:', result.error);
      toast.error(result.error || `${stateName} state not found`);
      return null;
    }

    return {
      stateId: result.data.stateId,
      stateName: result.data.stateName || stateName
    };
  }, [getTeamId]);

  const handleApproveMainIssue = useCallback(async () => {
    const approveToastId = toast.loading('Approving issue...');
    
    try {
      const targetIssue = issueDetails || issue;
      if (!targetIssue) {
        toast.error('No issue to approve', { id: approveToastId });
        return;
      }
      
      console.log('[Approve Main] Approving issue:', targetIssue.identifier);
      
      const stateData = await getStateIdByName('Release Ready');
      if (!stateData) {
        toast.error('Failed to get Release Ready state', { id: approveToastId });
        return;
      }
      
      await LinearMutations.updateIssueState(targetIssue.id, stateData.stateId);
      
      toast.success(`${targetIssue.identifier} approved and moved to Release Ready`, { id: approveToastId });
      
      await onRefreshDetails();
      
      if (onIssueUpdate && issueDetails) {
        onIssueUpdate(issueDetails);
      }
    } catch (error) {
      console.error('[Approve Main] Failed:', error);
      toast.error('Failed to approve issue', { id: approveToastId });
    }
  }, [issueDetails, issue, getStateIdByName, onRefreshDetails, onIssueUpdate]);

  const handleCancelMainIssue = useCallback(async () => {
    const toastId = toast.loading('Canceling issue...');
    
    try {
      const targetIssue = issueDetails || issue;
      if (!targetIssue) {
        toast.error('No issue to cancel', { id: toastId });
        return;
      }
      
      console.log('[Cancel Main] Canceling issue:', targetIssue.identifier);
      
      const stateData = await getStateIdByName('Canceled');
      if (!stateData) {
        toast.error('Failed to get Canceled state', { id: toastId });
        return;
      }
      
      await LinearMutations.updateIssueState(targetIssue.id, stateData.stateId);
      
      toast.success(`${targetIssue.identifier} moved to Canceled`, { id: toastId });
      
      await onRefreshDetails();
      
      if (onIssueUpdate && issueDetails) {
        onIssueUpdate(issueDetails);
      }
    } catch (error) {
      console.error('[Cancel Main] Failed:', error);
      toast.error('Failed to cancel issue', { id: toastId });
    }
  }, [issueDetails, issue, getStateIdByName, onRefreshDetails, onIssueUpdate]);

  const handleReopenMainIssue = useCallback(async () => {
    const toastId = toast.loading('Reopening issue...');
    
    try {
      const targetIssue = issueDetails || issue;
      if (!targetIssue) {
        toast.error('No issue to reopen', { id: toastId });
        return;
      }
      
      console.log('[Reopen Main] Reopening issue:', targetIssue.identifier);
      
      const stateData = await getStateIdByName('In Progress');
      if (!stateData) {
        toast.error('Failed to get In Progress state', { id: toastId });
        return;
      }
      
      await LinearMutations.updateIssueState(targetIssue.id, stateData.stateId);
      
      toast.success(`${targetIssue.identifier} reopened`, { id: toastId });
      
      await onRefreshDetails();
      
      if (onIssueUpdate && issueDetails) {
        onIssueUpdate(issueDetails);
      }
    } catch (error) {
      console.error('[Reopen Main] Failed:', error);
      toast.error('Failed to reopen issue', { id: toastId });
    }
  }, [issueDetails, issue, getStateIdByName, onRefreshDetails, onIssueUpdate]);

  return {
    handleApproveMainIssue,
    handleCancelMainIssue,
    handleReopenMainIssue,
  };
}
