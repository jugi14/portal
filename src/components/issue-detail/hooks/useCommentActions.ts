import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import TurndownService from 'turndown';
import type { LinearIssue } from '../../../services/linearTeamIssuesService';
import { LinearMutations, LinearQueries } from '../../../services/linearTeamIssuesService';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
  strongDelimiter: '**'
});

interface UseCommentActionsProps {
  issue: LinearIssue | null;
  currentIssue: LinearIssue | null;
  issueDetails: LinearIssue | null;
  setIssueDetails: (issue: LinearIssue) => void;
  onIssueUpdate?: (updatedIssue: LinearIssue) => void;
}

export function useCommentActions({
  issue,
  currentIssue,
  issueDetails,
  setIssueDetails,
  onIssueUpdate
}: UseCommentActionsProps) {
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  // Upload image to Linear and return URL
  const uploadImageToLinear = useCallback(async (file: File): Promise<string | null> => {
    try {
      setIsUploadingImage(true);
      
      const targetIssue = issueDetails || currentIssue || issue;
      if (!targetIssue) {
        throw new Error('No issue selected');
      }

      console.log('[CommentImage] Uploading image:', file.name);
      
      const result = await LinearMutations.uploadFilesToIssue(targetIssue.id, [file]);
      
      // Linear returns uploaded file data with URL
      if (result?.attachments?.[0]?.url) {
        const imageUrl = result.attachments[0].url;
        console.log('[CommentImage] Upload successful:', imageUrl);
        return imageUrl;
      }
      
      throw new Error('No URL returned from upload');
    } catch (error) {
      console.error('[CommentImage] Upload failed:', error);
      toast.error('Failed to upload image');
      return null;
    } finally {
      setIsUploadingImage(false);
    }
  }, [issue, currentIssue, issueDetails]);

  const commentEditor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: 'Write your comment here... Paste images directly or use toolbar to format text',
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        // Remove inline styling - let rich-text-editor.css handle all styling
        class: 'ProseMirror',
      },
      // Handle paste for images
      handlePaste: async (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          
          // Check if pasted item is an image
          if (item.type.indexOf('image') !== -1) {
            event.preventDefault();
            
            const file = item.getAsFile();
            if (!file) continue;

            // Upload image to Linear
            const imageUrl = await uploadImageToLinear(file);
            
            if (imageUrl && commentEditor) {
              // Insert image node (not markdown text) for preview
              commentEditor.chain().focus().setImage({ 
                src: imageUrl, 
                alt: file.name 
              }).run();
              
              toast.success('Image uploaded successfully');
            }
            
            return true;
          }
        }
        
        return false;
      },
    },
  });

  // Handle file selection from file input
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setAttachedFiles(prev => [...prev, ...files]);
    toast.success(`${files.length} file(s) attached`);
    
    // Reset input
    event.target.value = '';
  }, []);

  // Remove attached file
  const handleRemoveFile = useCallback((index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddComment = useCallback(async () => {
    if (!commentEditor) {
      toast.error('Editor not initialized');
      return;
    }
    
    const commentHTML = commentEditor.getHTML();
    
    // SECURITY: Check if comment is empty using editor's getText() method (no XSS risk)
    // Do NOT use innerHTML as it could execute malicious scripts
    const textContent = commentEditor.getText() || '';
    
    // Check if editor has images (even without text)
    const hasImages = commentHTML.includes('<img');
    
    if (!textContent.trim() && attachedFiles.length === 0 && !hasImages) {
      toast.error('Please enter a comment, paste images, or attach files');
      return;
    }
    
    let commentMarkdown = turndownService.turndown(commentHTML);
    
    console.log('[Comment] Adding comment:', {
      htmlLength: commentHTML.length,
      markdownLength: commentMarkdown.length,
      attachedFiles: attachedFiles.length,
      preview: commentMarkdown.substring(0, 200)
    });
    
    try {
      setIsAddingComment(true);
      
      const targetIssue = issueDetails || currentIssue || issue;
      if (!targetIssue) {
        toast.error('No issue selected');
        return;
      }
      
      // Upload attached files first and append to comment
      if (attachedFiles.length > 0) {
        console.log('[Comment] Uploading attached files:', attachedFiles.length);
        
        try {
          const uploadResult = await LinearMutations.uploadFilesToIssue(targetIssue.id, attachedFiles);
          
          // Append file links to comment markdown
          if (uploadResult?.attachments?.length > 0) {
            const fileLinks = uploadResult.attachments.map((att: any) => {
              const fileName = att.title || att.filename || 'Attachment';
              const fileUrl = att.url;
              
              // Check if it's an image
              const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName);
              
              if (isImage) {
                return `![${fileName}](${fileUrl})`;
              } else {
                return `[${fileName}](${fileUrl})`;
              }
            }).join('\n');
            
            // Append to markdown
            if (commentMarkdown.trim()) {
              commentMarkdown += '\n\n' + fileLinks;
            } else {
              commentMarkdown = fileLinks;
            }
            
            console.log('[Comment] Files uploaded, markdown updated:', {
              attachmentsCount: uploadResult.attachments.length,
              markdownLength: commentMarkdown.length
            });
          }
        } catch (uploadError) {
          console.error('[Comment] File upload failed:', uploadError);
          toast.error('Failed to upload attachments');
          return;
        }
      }
      
      await LinearMutations.addComment(targetIssue.id, commentMarkdown);
      
      toast.success('Comment added successfully');
      
      commentEditor.commands.setContent('');
      setAttachedFiles([]);
      
      const issueToLoad = currentIssue || issue;
      if (issueToLoad) {
        try {
          // CRITICAL: Pass true to bypass cache and get fresh data with new comment
          const details = await LinearQueries.getIssueDetails(issueToLoad.id, true);
          if (details) {
            if (!(details as any).subIssues) {
              (details as any).subIssues = [];
            }
            setIssueDetails(details);
            
            if (onIssueUpdate) {
              onIssueUpdate(details);
            }
          }
        } catch (refreshError) {
          console.error('[Comment] Failed to refresh issue details:', refreshError);
        }
      }
    } catch (error) {
      console.error('[Comment] Failed to add comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setIsAddingComment(false);
    }
  }, [commentEditor, currentIssue, issue, issueDetails, setIssueDetails, onIssueUpdate, attachedFiles]);

  return {
    commentEditor,
    isAddingComment,
    isUploadingImage,
    attachedFiles,
    handleAddComment,
    handleFileSelect,
    handleRemoveFile,
  };
}