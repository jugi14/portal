import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { LinearIssue } from '../../../services/linearTeamIssuesService';
import { LinearMutations, LinearQueries } from '../../../services/linearTeamIssuesService';
import { apiClient } from '../../../services/apiClient';
import { projectId } from '../../../utils/supabase/info';

interface UseSubIssueActionsProps {
  issue: LinearIssue | null;
  currentIssue: LinearIssue | null;
  issueDetails: LinearIssue | null;
  setIssueDetails: (issue: LinearIssue) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
}

export function useSubIssueActions({
  issue,
  currentIssue,
  issueDetails,
  setIssueDetails,
  scrollContainerRef
}: UseSubIssueActionsProps) {
  const [savedScrollPosition, setSavedScrollPosition] = useState(0);

  const handleApproveSubIssue = useCallback(async (subIssue: any) => {
    const approveToastId = toast.loading(`Approving ${subIssue.identifier}...`);
    const originalIssueDetails = issueDetails;
    
    try {
      console.log('[Approve] Approving sub-issue:', subIssue.identifier);
      
      const teamId = (issueDetails || issue)?.team?.id;
      if (!teamId) {
        console.error('[Approve] Team ID not found in parent issue');
        toast.error('Team information missing', { id: approveToastId });
        return;
      }
      
      console.log(`[Approve] Fetching "Release Ready" state ID for team ${teamId}...`);
      
      const accessToken = apiClient.getAccessToken();
      if (!accessToken) {
        console.error('[Approve] No access token found or expired');
        toast.error('Authentication required. Please sign in again.', { id: approveToastId });
        return;
      }
      
      const response = await apiClient.get(`/linear/teams/${teamId}/state-by-name?name=Release Ready`);
      
      const result = response;
      
      if (!result.success || !result.data?.stateId) {
        console.error('[Approve] Failed to get Release Ready state:', result.error);
        toast.error(result.error || 'Release Ready state not found', { id: approveToastId });
        return;
      }
      
      const releaseReadyStateId = result.data.stateId;
      const releaseReadyStateName = result.data.stateName || 'Release Ready';
      console.log('[Approve] Got Release Ready state ID:', releaseReadyStateId);
      
      if (issueDetails && (issueDetails as any).subIssues) {
        const updatedSubIssues = (issueDetails as any).subIssues.map((si: any) => {
          if (si.id === subIssue.id) {
            return {
              ...si,
              state: {
                ...si.state,
                id: releaseReadyStateId,
                name: releaseReadyStateName,
                type: 'completed',
              },
              _optimisticUpdate: true,
            };
          }
          return si;
        });
        
        setIssueDetails({
          ...issueDetails,
          subIssues: updatedSubIssues,
        } as any);
        
        console.log('[Approve] Optimistic UI update applied');
      }
      
      await LinearMutations.updateIssueState(subIssue.id, releaseReadyStateId);
      
      toast.success(`${subIssue.identifier} approved and moved to Release Ready`, { id: approveToastId });
      
      if (scrollContainerRef.current) {
        const currentScroll = scrollContainerRef.current.scrollTop;
        setSavedScrollPosition(currentScroll);
      }
      
      const issueToLoad = currentIssue || issue;
      if (issueToLoad) {
        try {
          const cacheKey = `linear:issue-detail:issueId:${issueToLoad.id}`;
          
          if (localStorage.getItem(cacheKey)) {
            localStorage.removeItem(cacheKey);
          }
          
          // OPTIMIZATION: Skip expensive localStorage loop
          // The specific cache key clear above is sufficient
          
          const details = await LinearQueries.getIssueDetails(issueToLoad.id, true);
          
          if (details) {
            if (!(details as any).subIssues) {
              (details as any).subIssues = [];
            }
            setIssueDetails(details);
            
            setTimeout(() => {
              if (scrollContainerRef.current && savedScrollPosition > 0) {
                scrollContainerRef.current.scrollTop = savedScrollPosition;
              }
            }, 50);
          }
        } catch (refreshError) {
          console.error('[Approve] Refresh failed:', refreshError);
          if (originalIssueDetails) {
            setIssueDetails(originalIssueDetails);
          }
        }
      }
      
      setTimeout(async () => {
        console.log('[Approve] Triggering kanban board refresh...');
        
        try {
          console.log(`[Approve] Clearing ALL cache for team ${teamId}...`);
          
          try {
            LinearQueries.invalidateIssues(teamId);
            console.log('[Approve] Cache cleared via LinearQueries.invalidateIssues');
          } catch (err) {
            console.warn('[Approve] LinearQueries.invalidateIssues failed:', err);
          }
          
          // OPTIMIZATION: Use service layer cache invalidation instead of localStorage loop
          // This prevents blocking navigation with expensive operations
          const clearedKeys: string[] = [];
          console.log(`[Approve] Cleared ${clearedKeys.length} localStorage entries:`, clearedKeys);
        } catch (e) {
          console.error('[Approve] Cache clear error:', e);
        }
        
        window.dispatchEvent(new CustomEvent('linear-issue-updated', {
          detail: { 
            issueId: subIssue.id, 
            teamId, 
            action: 'approve',
            newState: releaseReadyStateName,
          }
        }));
      }, 500);
      
    } catch (error) {
      console.error('[Approve] Failed:', error);
      toast.error(`Failed to approve ${subIssue.identifier}`, { id: approveToastId });
      
      if (originalIssueDetails) {
        setIssueDetails(originalIssueDetails);
      }
    }
  }, [issueDetails, currentIssue, issue, setIssueDetails, scrollContainerRef, savedScrollPosition]);

  const handleRequestChanges = useCallback(async (
    subIssue: any,
    comment: string,
    onSuccess: () => void
  ) => {
    if (!comment.trim()) {
      toast.error('Please provide a comment');
      return;
    }
    
    const toastId = toast.loading(`Requesting changes for ${subIssue.identifier}...`);
    
    try {
      const teamId = (issueDetails || issue)?.team?.id;
      if (!teamId) {
        toast.error('Team information missing', { id: toastId });
        return;
      }
      
      const accessToken = apiClient.getAccessToken();
      if (!accessToken) {
        toast.error('Authentication required. Please sign in again.', { id: toastId });
        return;
      }
      
      // CRITICAL: Request Changes does NOT change task state
      // Task stays in current state (whatever it is)
      // Only adds comment + label
      
      // Step 1: Add comment with [external] prefix
      await LinearMutations.addCommentToIssue(
        subIssue.id,
        `[external] ${comment.trim()}`
      );
      
      // Step 2: Add "UAT Request Changes" label (if exists)
      try {
        // Get team config to find label
        const teamConfigResponse = await apiClient.get(`/linear/teams/${teamId}/config`);
        
        const teamConfig = teamConfigResponse;
        const labels = teamConfig?.data?.labels || [];
        
        // Find "UAT Request Changes" label (case-insensitive)
        let requestChangesLabel = labels.find((label: any) => 
          label.name.toLowerCase() === 'uat request changes'
        );
        
        // Create label if it doesn't exist
        if (!requestChangesLabel) {
          console.log('[Request Changes] Label not found, creating "UAT Request Changes" label');
          const newLabel = await LinearMutations.createLabel({
            teamId: teamId,
            name: 'UAT Request Changes',
            color: '#FF6B6B', // Orange-red color
            description: 'Client requested changes during UAT review'
          });
          requestChangesLabel = newLabel;
          console.log('[Request Changes] Label created successfully:', newLabel);
        }
        
        if (requestChangesLabel) {
          await LinearMutations.addLabel(subIssue.id, requestChangesLabel.id);
        }
      } catch (labelError) {
        console.error('[Request Changes] Failed to add label:', labelError);
        // Continue anyway - comment is more important
      }
      
      // Step 3: Success - NO state change
      toast.success(`Changes requested for ${subIssue.identifier}`, { id: toastId });
      
      onSuccess();
      
      const issueToLoad = currentIssue || issue;
      if (issueToLoad) {
        try {
          const cacheKey = `linear:issue-detail:issueId:${issueToLoad.id}`;
          if (localStorage.getItem(cacheKey)) {
            localStorage.removeItem(cacheKey);
          }
          
          const details = await LinearQueries.getIssueDetails(issueToLoad.id, true);
          if (details) {
            if (!(details as any).subIssues) {
              (details as any).subIssues = [];
            }
            setIssueDetails(details);
          }
        } catch (refreshError) {
          console.error('[Request Changes] Refresh failed:', refreshError);
        }
      }
      
      window.dispatchEvent(new CustomEvent('linear-issue-updated', {
        detail: { 
          issueId: subIssue.id, 
          teamId, 
          action: 'request-changes',
        }
      }));
      
    } catch (error) {
      console.error('[Request Changes] Failed:', error);
      toast.error('Failed to request changes', { id: toastId });
    }
  }, [issueDetails, issue, currentIssue, setIssueDetails]);

  return {
    handleApproveSubIssue,
    handleRequestChanges,
  };
}