/**
 * Client Task Actions Hook
 * 
 * Tách riêng logic xử lý các actions: approve, request changes, add issue
 * để dễ bảo trì và test
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TurndownService from 'turndown';
import { LinearIssue, LinearState, LinearMutations, LinearQueries } from '../services/linearTeamIssuesService';

// Initialize Turndown for HTML → Markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
  strongDelimiter: '**'
});

export interface UseClientTaskActionsProps {
  teamId: string;
  columns: LinearState[];
  onRefresh: () => Promise<void>;
}

export interface UseClientTaskActionsReturn {
  // Approve task
  handleApprove: (issue: LinearIssue) => Promise<void>;
  
  // Request changes
  handleRequestChanges: (issue: LinearIssue) => void;
  requestChangesIssue: LinearIssue | null;
  requestChangesEditor: ReturnType<typeof useEditor> | null;
  requestChangesFiles: File[];
  isRequestingChanges: boolean;
  handleRequestChangesFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleRequestChangesRemoveFile: (index: number) => void;
  handleSubmitRequestChanges: () => Promise<void>;
  handleCancelRequestChanges: () => void;
  
  // Add issue/feedback (opens modal)
  handleAddIssue: (parentIssue: LinearIssue) => void;
  submitIssueModal: { isOpen: boolean; parentIssue: LinearIssue | null };
  handleCloseSubmitIssueModal: () => void;
  
  // Submit issue (creates sub-task)
  handleSubmitIssue: (issueData: {
    title: string;
    description: string;
    priority: number;
    stateId?: string;
    assigneeId?: string;
    files?: File[];
  }) => Promise<void>;
  creatingIssue: boolean;
}

export const useClientTaskActions = ({
  teamId,
  columns,
  onRefresh,
}: UseClientTaskActionsProps): UseClientTaskActionsReturn => {
  // Request Changes state
  const [requestChangesIssue, setRequestChangesIssue] = useState<LinearIssue | null>(null);
  const [requestChangesFiles, setRequestChangesFiles] = useState<File[]>([]);
  const [isRequestingChanges, setIsRequestingChanges] = useState(false);
  
  // Submit Issue modal state
  const [submitIssueModal, setSubmitIssueModal] = useState<{
    isOpen: boolean;
    parentIssue: LinearIssue | null;
  }>({ isOpen: false, parentIssue: null });
  const [creatingIssue, setCreatingIssue] = useState(false);

  // Tiptap Editor for Request Changes dialog
  const requestChangesEditor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Describe what needs to be changed or fixed...',
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'ProseMirror focus:outline-none min-h-[200px] p-4',
      },
    },
  });

  // Approve Task - Move to Release Ready
  const handleApprove = useCallback(async (issue: LinearIssue) => {
    try {
      // Find "Release Ready" state (exact match only)
      const releaseReadyState = columns.find(s => 
        s.name.toLowerCase() === 'release ready'
      );

      if (!releaseReadyState) {
        console.error('[ClientTaskActions] Release Ready state not found in team configuration');
        toast.error('Release Ready state not found. Please contact administrator.');
        return;
      }

      console.log('[ClientTaskActions] Approving issue:', issue.identifier, 'moving to state:', releaseReadyState.name);
      
      const success = await LinearMutations.updateIssueState(issue.id, releaseReadyState.id);
      
      if (success) {
        toast.success(`Task "${issue.title}" approved and moved to ${releaseReadyState.name}`);
        
        // CRITICAL: Refresh immediately to regroup issues
        await onRefresh();
      } else {
        toast.error('Failed to approve task');
      }
    } catch (err) {
      console.error('[ClientTaskActions] Failed to approve task:', err);
      toast.error('Failed to approve task');
    }
  }, [columns, onRefresh]);

  // Request Changes - Open Dialog
  const handleRequestChanges = useCallback((issue: LinearIssue) => {
    console.log('[Request Changes] Opening dialog for:', issue.identifier, issue);
    setRequestChangesIssue(issue);
    setRequestChangesFiles([]);
    if (requestChangesEditor) {
      requestChangesEditor.commands.setContent('');
    }
  }, [requestChangesEditor]);

  // Handle file upload for request changes
  const handleRequestChangesFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setRequestChangesFiles((prev) => [...prev, ...files]);
  }, []);

  const handleRequestChangesRemoveFile = useCallback((index: number) => {
    setRequestChangesFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);
  
  // Submit Request Changes - Add comment and add label (NO state change)
  const handleSubmitRequestChanges = useCallback(async () => {
    if (!requestChangesIssue) {
      toast.error('No issue selected');
      return;
    }

    // Get content from editor
    if (!requestChangesEditor) {
      toast.error('Editor not initialized');
      return;
    }

    const htmlContent = requestChangesEditor.getHTML();
    const markdownContent = turndownService.turndown(htmlContent);

    if (!markdownContent.trim() || markdownContent === '<p></p>') {
      toast.error('Please enter a comment describing the changes needed');
      return;
    }
    
    setIsRequestingChanges(true);
    try {
      console.log('[Request Changes] Adding comment and label:', requestChangesIssue.identifier);
      
      // CRITICAL: Request Changes does NOT change task state
      // Task stays in current state (whatever it is)
      // Only adds comment + label
      
      // Step 1: Add comment with [external] prefix
      const commentWithPrefix = `[external] ${markdownContent.trim()}`;
      await LinearMutations.addComment(requestChangesIssue.id, commentWithPrefix);
      
      console.log('[Request Changes] Comment added successfully');

      // Step 2: Handle file attachments if any
      if (requestChangesFiles.length > 0) {
        console.log(`[Request Changes] Uploading ${requestChangesFiles.length} file(s)`);
        await LinearMutations.uploadFilesToIssue(requestChangesIssue.id, requestChangesFiles);
        console.log('[Request Changes] Files uploaded successfully');
      }
      
      // Step 3: Add "UAT Request Changes" label
      try {
        // Get team config to find label ID
        const teamConfig = await LinearQueries.getTeamConfig(teamId);
        const labels = teamConfig?.labels || [];
        
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
          console.log('[Request Changes] Adding label:', requestChangesLabel.name);
          await LinearMutations.addLabel(requestChangesIssue.id, requestChangesLabel.id);
          console.log('[Request Changes] Label added successfully');
        }
      } catch (labelError) {
        console.error('[Request Changes] Failed to add label:', labelError);
        // Continue anyway - comment is more important than label
      }
      
      // Step 4: Success - NO state change
      toast.success(`Changes requested for "${requestChangesIssue.title}"`);
      
      // Close dialog and reset
      setRequestChangesIssue(null);
      setRequestChangesFiles([]);
      if (requestChangesEditor) {
        requestChangesEditor.commands.setContent('');
      }
      
      // Refresh issues
      await onRefresh();
      
    } catch (err) {
      console.error('[Request Changes] Failed:', err);
      toast.error('Failed to request changes');
    } finally {
      setIsRequestingChanges(false);
    }
  }, [requestChangesIssue, requestChangesEditor, requestChangesFiles, teamId, onRefresh]);

  // Cancel request changes
  const handleCancelRequestChanges = useCallback(() => {
    setRequestChangesIssue(null);
    setRequestChangesFiles([]);
    if (requestChangesEditor) {
      requestChangesEditor.commands.setContent('');
    }
  }, [requestChangesEditor]);

  // Add Issue/Feedback - Open Modal
  const handleAddIssue = useCallback((parentIssue: LinearIssue) => {
    setSubmitIssueModal({ isOpen: true, parentIssue });
  }, []);

  // Close submit issue modal
  const handleCloseSubmitIssueModal = useCallback(() => {
    setSubmitIssueModal({ isOpen: false, parentIssue: null });
  }, []);

  // Submit Issue - Create parent issue (Group Task) OR sub-task (Acceptance Issue)
  const handleSubmitIssue = useCallback(async (issueData: {
    title: string;
    description: string;
    priority: number;
    stateId?: string;
    assigneeId?: string;
    files?: File[];
  }) => {
    const parentIssue = submitIssueModal.parentIssue;
    const isSubIssue = !!parentIssue;
    const issueType = isSubIssue ? 'acceptance issue' : 'group task';
    
    // Determine teamId: from parent issue OR from hook prop
    const issueTeamId = parentIssue?.team?.id || teamId;
    
    if (!issueTeamId) {
      console.error('[ClientTaskActions] Cannot create issue: missing team ID');
      toast.error('Cannot create issue: missing team information');
      return;
    }

    setCreatingIssue(true);
    try {
      console.log(`[ClientTaskActions] Creating ${issueType} for team ${issueTeamId}:`, issueData);
      
      // Create issue (with or without parent)
      const newIssue = await LinearMutations.createIssue({
        teamId: issueTeamId,
        title: issueData.title,
        description: issueData.description || undefined,
        parentId: isSubIssue ? parentIssue.id : undefined,
        priority: issueData.priority,
        stateId: issueData.stateId,
        assigneeId: issueData.assigneeId,
      });

      if (newIssue) {
        const successMessage = isSubIssue
          ? `Acceptance issue created: ${newIssue.identifier}`
          : `Group task created: ${newIssue.identifier}`;
        
        toast.success(successMessage);
        
        // Close modal
        setSubmitIssueModal({ isOpen: false, parentIssue: null });
        
        // Refresh issues
        await onRefresh();
      } else {
        toast.error(`Failed to create ${issueType}`);
      }
    } catch (err) {
      console.error(`[ClientTaskActions] Failed to create ${issueType}:`, err);
      toast.error('Failed to create issue');
      throw err; // Re-throw so IssueCreationTemplate can handle it
    } finally {
      setCreatingIssue(false);
    }
  }, [teamId, submitIssueModal, onRefresh]);

  return {
    handleApprove,
    handleRequestChanges,
    requestChangesIssue,
    requestChangesEditor,
    requestChangesFiles,
    isRequestingChanges,
    handleRequestChangesFileSelect,
    handleRequestChangesRemoveFile,
    handleSubmitRequestChanges,
    handleCancelRequestChanges,
    handleAddIssue,
    submitIssueModal,
    handleCloseSubmitIssueModal,
    handleSubmitIssue,
    creatingIssue,
  };
};