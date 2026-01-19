import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { LinearIssue } from '../../../services/linearTeamIssuesService';
import { LinearQueries } from '../../../services/linearTeamIssuesService';

interface UseIssueNavigationProps {
  initialIssue: LinearIssue | null;
  isOpen: boolean;
}

export function useIssueNavigation({ initialIssue, isOpen }: UseIssueNavigationProps) {
  const [navigationStack, setNavigationStack] = useState<LinearIssue[]>([]);
  const [currentIssue, setCurrentIssue] = useState<LinearIssue | null>(null);
  const [issueDetails, setIssueDetails] = useState<LinearIssue | null>(null);
  const [loading, setLoading] = useState(false);

  const loadIssueDetails = useCallback(async (issueToLoad: LinearIssue, bypassCache = false) => {
    try {
      setLoading(true);
      const details = await LinearQueries.getIssueDetails(issueToLoad.id, bypassCache);
      
      if (details) {
        if (!(details as any).subIssues) {
          (details as any).subIssues = [];
        }
      }
      
      setIssueDetails(details);
      return details;
    } catch (error) {
      console.error('[IssueDetailModal] Failed to load issue details:', error);
      setIssueDetails(issueToLoad);
      return issueToLoad;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleNavigateToSubIssue = useCallback(async (subIssue: any) => {
    console.log('[Navigation] Navigating to sub-issue:', subIssue.identifier);
    
    const parentToSave = issueDetails || currentIssue || initialIssue;
    
    if (!parentToSave) {
      console.error('[Navigation] No parent issue to save');
      return;
    }
    
    console.log('[Navigation] Saving parent to stack:', {
      identifier: parentToSave.identifier,
      hasSubIssues: !!(parentToSave as any).subIssues,
      subIssuesCount: (parentToSave as any).subIssues?.length || 0
    });
    
    setNavigationStack(prev => [...prev, parentToSave]);
    setCurrentIssue(subIssue);
    
    try {
      await loadIssueDetails(subIssue);
      console.log('[Navigation] Sub-issue details loaded:', subIssue.identifier);
    } catch (error) {
      console.error('[Navigation] Failed to load sub-issue:', error);
      toast.error('Failed to load sub-issue details');
      setNavigationStack(prev => prev.slice(0, -1));
      setCurrentIssue(navigationStack[navigationStack.length - 1] || initialIssue);
    }
  }, [currentIssue, issueDetails, navigationStack, initialIssue, loadIssueDetails]);

  const handleNavigateBack = useCallback(() => {
    console.log('[Navigation] Navigating back, stack length:', navigationStack.length);
    
    if (navigationStack.length > 0) {
      const parentIssue = navigationStack[navigationStack.length - 1];
      
      console.log('[Navigation] Restoring parent from stack:', {
        identifier: parentIssue.identifier,
        hasSubIssues: !!(parentIssue as any).subIssues,
        subIssuesCount: (parentIssue as any).subIssues?.length || 0,
      });
      
      setNavigationStack(prev => prev.slice(0, -1));
      setCurrentIssue(parentIssue);
      setIssueDetails(parentIssue);
      
      console.log('[Navigation] Returned to parent:', parentIssue.identifier);
    }
  }, [navigationStack]);

  const resetNavigation = useCallback(() => {
    setNavigationStack([]);
    setCurrentIssue(null);
    setIssueDetails(null);
  }, []);

  const initializeNavigation = useCallback(async () => {
    if (isOpen && initialIssue) {
      resetNavigation();
      setCurrentIssue(initialIssue);
      await loadIssueDetails(initialIssue);
    } else if (!isOpen) {
      resetNavigation();
    }
  }, [isOpen, initialIssue, loadIssueDetails, resetNavigation]);

  return {
    navigationStack,
    currentIssue,
    issueDetails,
    loading,
    setIssueDetails,
    loadIssueDetails,
    handleNavigateToSubIssue,
    handleNavigateBack,
    resetNavigation,
    initializeNavigation,
  };
}
