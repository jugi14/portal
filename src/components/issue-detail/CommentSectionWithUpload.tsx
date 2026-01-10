/**
 * Comment Section with File Upload & Paste Support
 * 
 * Example component showing how to integrate useCommentActions hook
 * with complete file upload and paste functionality
 */

import React from 'react';
import { EditorContent } from '@tiptap/react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import {
  Paperclip,
  X,
  MessageSquare,
  Loader2,
  Bold,
  Italic,
  List,
  ListOrdered,
  Code,
  Heading2
} from 'lucide-react';
import { useCommentActions } from './hooks/useCommentActions';
import type { LinearIssue } from '../../services/linearTeamIssuesService';

interface CommentSectionProps {
  issue: LinearIssue | null;
  currentIssue: LinearIssue | null;
  issueDetails: LinearIssue | null;
  setIssueDetails: (issue: LinearIssue) => void;
  onIssueUpdate?: (updatedIssue: LinearIssue) => void;
}

export function CommentSectionWithUpload({
  issue,
  currentIssue,
  issueDetails,
  setIssueDetails,
  onIssueUpdate
}: CommentSectionProps) {
  const {
    commentEditor,
    isAddingComment,
    isUploadingImage,
    attachedFiles,
    handleAddComment,
    handleFileSelect,
    handleRemoveFile,
  } = useCommentActions({
    issue,
    currentIssue,
    issueDetails,
    setIssueDetails,
    onIssueUpdate,
  });

  if (!commentEditor) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div 
        data-comment-toolbar
        className={`flex items-center gap-1 p-2 border border-border rounded-t-lg bg-muted/30 ${isUploadingImage ? 'is-uploading' : ''}`}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => commentEditor.chain().focus().toggleBold().run()}
          disabled={isAddingComment || isUploadingImage}
          className={`h-8 w-8 p-0 ${commentEditor.isActive('bold') ? 'is-active bg-primary/10 text-primary' : ''}`}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => commentEditor.chain().focus().toggleItalic().run()}
          disabled={isAddingComment || isUploadingImage}
          className={`h-8 w-8 p-0 ${commentEditor.isActive('italic') ? 'is-active bg-primary/10 text-primary' : ''}`}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <div className="toolbar-separator" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => commentEditor.chain().focus().toggleHeading({ level: 2 }).run()}
          disabled={isAddingComment || isUploadingImage}
          className={`h-8 w-8 p-0 ${commentEditor.isActive('heading', { level: 2 }) ? 'is-active bg-primary/10 text-primary' : ''}`}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => commentEditor.chain().focus().toggleBulletList().run()}
          disabled={isAddingComment || isUploadingImage}
          className={`h-8 w-8 p-0 ${commentEditor.isActive('bulletList') ? 'is-active bg-primary/10 text-primary' : ''}`}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => commentEditor.chain().focus().toggleOrderedList().run()}
          disabled={isAddingComment || isUploadingImage}
          className={`h-8 w-8 p-0 ${commentEditor.isActive('orderedList') ? 'is-active bg-primary/10 text-primary' : ''}`}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => commentEditor.chain().focus().toggleCodeBlock().run()}
          disabled={isAddingComment || isUploadingImage}
          className={`h-8 w-8 p-0 ${commentEditor.isActive('codeBlock') ? 'is-active bg-primary/10 text-primary' : ''}`}
          title="Code Block"
        >
          <Code className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor */}
      <div className="editor-container border border-t-0 border-border rounded-b-lg bg-background overflow-hidden">
        <EditorContent editor={commentEditor} />
      </div>

      {/* Image Upload Indicator */}
      {isUploadingImage && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
          <span className="text-sm text-blue-700 dark:text-blue-300">
            Uploading image...
          </span>
        </div>
      )}

      {/* File Attachments */}
      {attachedFiles.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Attachments ({attachedFiles.length})
          </Label>
          <div className="space-y-2">
            {attachedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-lg border border-border"
              >
                <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveFile(index)}
                  disabled={isAddingComment}
                  className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {/* Attach Files Button */}
        <div className="flex-1">
          <input
            type="file"
            id="comment-file-upload"
            className="hidden"
            multiple
            onChange={handleFileSelect}
            disabled={isAddingComment || isUploadingImage}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => document.getElementById('comment-file-upload')?.click()}
            disabled={isAddingComment || isUploadingImage}
            className="w-full"
          >
            <Paperclip className="h-4 w-4 mr-2" />
            Attach Files
          </Button>
        </div>

        {/* Submit Button */}
        <div className="flex-1">
          <Button
            onClick={handleAddComment}
            disabled={isAddingComment || isUploadingImage}
            className="w-full"
          >
            {isAddingComment ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <MessageSquare className="h-4 w-4 mr-2" />
                Add Comment
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Helper Text */}
      <p className="text-xs text-muted-foreground">
        Tip: You can paste images directly (Cmd+V / Ctrl+V) into the editor
      </p>
    </div>
  );
}