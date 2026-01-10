import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { LinearIssue } from '../../../services/linearTeamIssuesService';
import { LinearMutations } from '../../../services/linearTeamIssuesService';

interface UseSubIssueCreationProps {
  parentIssue: LinearIssue | null;
  onCreated: () => Promise<void>;
  onIssueUpdate?: (updatedIssue: LinearIssue) => void;
}

export function useSubIssueCreation({
  parentIssue,
  onCreated,
  onIssueUpdate
}: UseSubIssueCreationProps) {
  const [isCreatingSubIssue, setIsCreatingSubIssue] = useState(false);
  const [showSubIssueDialog, setShowSubIssueDialog] = useState(false);
  const [newSubIssueTitle, setNewSubIssueTitle] = useState('');
  const [newSubIssueDescription, setNewSubIssueDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    console.log('[SubIssueCreation] Files selected:', {
      count: files.length,
      files: files.map(f => ({ name: f.name, size: f.size, type: f.type }))
    });
    
    const maxSize = 10 * 1024 * 1024;
    const validFiles = files.filter(file => {
      if (file.size > maxSize) {
        console.error(`[SubIssueCreation] File too large: ${file.name} (${file.size} bytes)`);
        toast.error(`File "${file.name}" is too large (max 10MB)`);
        return false;
      }
      return true;
    });
    
    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      toast.success(`${validFiles.length} file(s) selected`);
    }
    
    e.target.value = '';
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleCreateSubIssue = useCallback(async () => {
    if (!parentIssue || !newSubIssueTitle.trim()) {
      toast.error('Please enter a title for the sub-issue');
      return;
    }

    try {
      setIsCreatingSubIssue(true);
      
      console.log('[SubIssueCreation] Creating sub-issue:', {
        parentId: parentIssue.id,
        parentIdentifier: parentIssue.identifier,
        title: newSubIssueTitle
      });
      
      const result = await LinearMutations.createSubIssue(
        parentIssue.id, 
        newSubIssueTitle,
        newSubIssueDescription || undefined
      );
      
      console.log('[SubIssueCreation] Sub-issue created:', {
        issueId: result?.id,
        identifier: result?.identifier
      });
      
      if (selectedFiles.length > 0 && result?.id) {
        setUploadingFiles(true);
        toast.info(`Uploading ${selectedFiles.length} file(s)...`);
        
        console.log('[SubIssueCreation] Starting file upload:', {
          issueId: result.id,
          identifier: result.identifier,
          fileCount: selectedFiles.length,
          files: selectedFiles.map(f => f.name)
        });
        
        try {
          const uploadResult = await LinearMutations.uploadFilesToIssue(result.id, selectedFiles);
          
          console.log('[SubIssueCreation] Upload complete:', uploadResult);
          
          toast.success(`Sub-issue created with ${selectedFiles.length} attachment(s)!`);
        } catch (uploadError) {
          console.error('[SubIssueCreation] Upload failed:', uploadError);
          toast.warning('Sub-issue created but file upload failed');
        } finally {
          setUploadingFiles(false);
        }
      } else {
        toast.success(`Sub-issue ${result?.identifier} created successfully`);
      }
      
      setNewSubIssueTitle('');
      setNewSubIssueDescription('');
      setSelectedFiles([]);
      setShowSubIssueDialog(false);
      
      console.log('[SubIssueCreation] Invalidating issue detail cache');
      import('../../../services/linearCacheService').then(({ linearCache }) => {
        linearCache.invalidate(`linear:issue-detail:issueId:${parentIssue.id}`);
      });
      
      setTimeout(async () => {
        console.log('[SubIssueCreation] Reloading issue details after sub-issue creation');
        await onCreated();
        
        if (onIssueUpdate && parentIssue) {
          onIssueUpdate(parentIssue);
        }
      }, 100);
    } catch (error) {
      console.error('[SubIssueCreation] Failed to create sub-issue:', error);
      toast.error('Failed to create sub-issue');
    } finally {
      setIsCreatingSubIssue(false);
    }
  }, [parentIssue, newSubIssueTitle, newSubIssueDescription, selectedFiles, onCreated, onIssueUpdate]);

  return {
    isCreatingSubIssue,
    showSubIssueDialog,
    setShowSubIssueDialog,
    newSubIssueTitle,
    setNewSubIssueTitle,
    newSubIssueDescription,
    setNewSubIssueDescription,
    selectedFiles,
    uploadingFiles,
    handleFileSelect,
    handleRemoveFile,
    handleCreateSubIssue,
  };
}
