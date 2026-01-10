/**
 * Client Task Drag & Drop Hook
 * 
 * Separated drag & drop logic for better maintainability
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { LinearIssue, LinearState, LinearMutations } from '../services/linearTeamIssuesService';
import { ClientColumn, mapStateToClientColumn, CLIENT_COLUMNS } from '../utils/clientTasksMapping';

export interface UseClientTaskDragDropProps {
  columns: LinearState[];
  issuesByColumn: Record<ClientColumn, LinearIssue[]>;
  onIssuesByColumnChange: (newIssuesByColumn: Record<ClientColumn, LinearIssue[]>) => void;
  onRefresh: () => Promise<void>;
}

export interface UseClientTaskDragDropReturn {
  draggingIssueId: string | null;
  handleDragStart: (issue: LinearIssue, columnId: ClientColumn) => void;
  handleDragEnd: () => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, targetColumn: ClientColumn) => Promise<void>;
}

export const useClientTaskDragDrop = ({
  columns,
  issuesByColumn,
  onIssuesByColumnChange,
  onRefresh,
}: UseClientTaskDragDropProps): UseClientTaskDragDropReturn => {
  const [draggingIssueId, setDraggingIssueId] = useState<string | null>(null);

  // Drag Start
  const handleDragStart = useCallback((issue: LinearIssue, columnId: ClientColumn) => {
    setDraggingIssueId(issue.id);
    
    // Store drag data in session storage
    sessionStorage.setItem('dragData', JSON.stringify({
      issueId: issue.id,
      sourceColumn: columnId,
      issue
    }));
    
    console.log('[ClientTasksKanban] Drag started:', issue.identifier, 'from', columnId);
  }, []);

  // Drag End
  const handleDragEnd = useCallback(() => {
    setDraggingIssueId(null);
    sessionStorage.removeItem('dragData');
  }, []);

  // Drag Over
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('drop-zone-active');
  }, []);

  // Drag Leave
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const element = e.currentTarget as HTMLElement;
    const relatedTarget = e.relatedTarget as HTMLElement;
    
    // Only remove class if actually leaving (not moving to child)
    if (relatedTarget && element.contains(relatedTarget)) {
      return;
    }
    
    e.currentTarget.classList.remove('drop-zone-active', 'drop-zone-invalid');
  }, []);

  // Drop - Move task to new column
  const handleDrop = useCallback(async (e: React.DragEvent, targetColumn: ClientColumn) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drop-zone-active', 'drop-zone-invalid');
    
    try {
      const dragDataStr = sessionStorage.getItem('dragData');
      if (!dragDataStr) return;
      
      const dragData = JSON.parse(dragDataStr);
      const { issueId, sourceColumn, issue } = dragData;
      
      // Same column - no change
      if (sourceColumn === targetColumn) {
        console.log('Same column, no update needed');
        toast.info('Task is already in this column');
        return;
      }
      
      console.log('[ClientTasksKanban] Moving task:', issue.identifier, 'from', sourceColumn, 'to', targetColumn);
      
      // Find corresponding Linear state for target column
      // STRICT: Only find states that map to target column (null means no match)
      const targetLinearState = columns.find(state => {
        const mappedCol = mapStateToClientColumn(state);
        return mappedCol === targetColumn;
      });
      
      if (!targetLinearState) {
        toast.error('Target state not found');
        return;
      }
      
      // Optimistic update - move in UI immediately
      const newIssuesByColumn = { ...issuesByColumn };
      
      // Remove from source
      newIssuesByColumn[sourceColumn] = newIssuesByColumn[sourceColumn].filter(i => i.id !== issueId);
      
      // Add to target
      const updatedIssue = { ...issue, state: targetLinearState };
      newIssuesByColumn[targetColumn] = [...newIssuesByColumn[targetColumn], updatedIssue];
      
      console.log(`[ClientTasksKanban] Optimistic update complete:`, {
        issueId,
        from: sourceColumn,
        to: targetColumn,
        targetColumnCount: newIssuesByColumn[targetColumn].length,
        isClientReview: targetColumn === 'client-review'
      });
      
      onIssuesByColumnChange(newIssuesByColumn);
      
      const targetColName = CLIENT_COLUMNS.find(c => c.id === targetColumn)?.title;
      toast.success(`Moved to ${targetColName}${targetColumn === 'client-review' ? ' - Actions available!' : ''}`);
      
      // Background API update
      try {
        await LinearMutations.updateIssueState(issueId, targetLinearState.id);
        console.log('[ClientTasksKanban] State updated in Linear');
      } catch (apiError) {
        console.error('[ClientTasksKanban] Failed to update state:', apiError);
        toast.error('Failed to update task state');
        
        // Rollback on error
        await onRefresh();
      }
    } catch (error) {
      console.error('[ClientTasksKanban] Drop error:', error);
      toast.error('Failed to move task');
    } finally {
      setDraggingIssueId(null);
      sessionStorage.removeItem('dragData');
    }
  }, [columns, issuesByColumn, onIssuesByColumnChange, onRefresh]);

  return {
    draggingIssueId,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
};
