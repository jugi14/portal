import React, { useState, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import TurndownService from 'turndown';
import { marked } from 'marked';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { MarkdownRenderer } from './MarkdownRenderer';
import { 
  Pencil, 
  Save, 
  X, 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Code, 
  Heading2,
  Loader2,
  ImageIcon
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { LinearMutations } from '../../services/linearTeamIssuesService';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
  strongDelimiter: '**',
});

// CRITICAL: Custom rules for better TipTap HTML conversion
// Fix list item formatting issues
turndownService.addRule('listItem', {
  filter: 'li',
  replacement: function (content, node) {
    // Clean up whitespace and ensure single line per item
    const cleanContent = content.trim().replace(/\n+/g, ' ');
    return cleanContent + '\n';
  }
});

// Fix paragraph in list items (TipTap wraps content in <p>)
turndownService.addRule('listItemParagraph', {
  filter: function (node) {
    return (
      node.nodeName === 'P' &&
      node.parentNode &&
      node.parentNode.nodeName === 'LI'
    );
  },
  replacement: function (content) {
    return content;
  }
});

interface EditableDescriptionProps {
  description: string | null | undefined;
  issueId: string;
  onUpdate?: (newDescription: string) => void;
}

export function EditableDescription({ description, issueId, onUpdate }: EditableDescriptionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // CRITICAL: Use local state for description to handle updates
  // Parent may not update prop immediately after save
  const [localDescription, setLocalDescription] = useState(description);

  // Sync local state when prop changes (e.g., after parent refetch)
  React.useEffect(() => {
    setLocalDescription(description);
  }, [description]);

  // Convert File to base64 data URL
  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({
        placeholder: 'Edit description... Paste images directly (Ctrl+V)',
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'ProseMirror',
      },
      handlePaste: async (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          
          if (item.type.indexOf('image') !== -1) {
            event.preventDefault();
            
            const file = item.getAsFile();
            if (!file || !editor) continue;

            console.log('[EditableDescription] Image pasted:', file.name);

            try {
              // Convert to base64 and insert directly
              const base64 = await fileToBase64(file);
              
              editor.chain().focus().setImage({ 
                src: base64, 
                alt: file.name 
              }).run();
              
              toast.success('Image inserted (will be uploaded when you save)');
            } catch (error) {
              console.error('[EditableDescription] Failed to convert image:', error);
              toast.error('Failed to insert image');
            }
            
            return true;
          }
        }
        
        return false;
      },
    },
  });

  // Handle manual image upload via button
  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editor) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    try {
      // Convert to base64 and insert
      const base64 = await fileToBase64(file);
      
      editor.chain().focus().setImage({ 
        src: base64, 
        alt: file.name 
      }).run();
      
      toast.success('Image inserted');
    } catch (error) {
      console.error('[EditableDescription] Failed to insert image:', error);
      toast.error('Failed to insert image');
    }

    // Reset input
    event.target.value = '';
  }, [editor, fileToBase64]);

  const handleEdit = useCallback(async () => {
    if (!editor) return;
    
    try {
      // Convert markdown to HTML for TipTap editor
      // marked returns a Promise in newer versions
      const html = await marked.parse(localDescription || '');
      
      // Set HTML content in editor (will render with proper formatting)
      editor.commands.setContent(html);
      setIsEditing(true);
      
      console.log('[EditableDescription] Loaded markdown into editor');
    } catch (error) {
      console.error('[EditableDescription] Failed to parse markdown:', error);
      // Fallback: load as-is if parsing fails
      editor.commands.setContent(localDescription || '');
      setIsEditing(true);
    }
  }, [editor, localDescription]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    if (editor) {
      editor.commands.setContent('');
    }
  }, [editor]);

  const handleSave = useCallback(async () => {
    if (!editor) return;

    const htmlContent = editor.getHTML();
    let markdownContent = turndownService.turndown(htmlContent);

    // DEBUG: Log conversion to detect formatting issues
    console.log('[EditableDescription] HTML -> Markdown conversion:', {
      htmlLength: htmlContent.length,
      markdownLength: markdownContent.length,
      htmlPreview: htmlContent.substring(0, 200),
      markdownPreview: markdownContent.substring(0, 200),
    });

    if (!markdownContent.trim()) {
      toast.error('Description cannot be empty');
      return;
    }

    setIsSaving(true);

    try {
      console.log('[EditableDescription] Updating description:', {
        issueId,
        lengthBefore: localDescription?.length || 0,
        lengthAfter: markdownContent.length,
      });

      // Update description via Linear API
      await LinearMutations.updateIssue({
        issueId,
        description: markdownContent,
      });

      // CRITICAL: Update local state immediately
      // This ensures UI shows updated description even if parent doesn't refetch
      setLocalDescription(markdownContent);

      toast.success('Description updated successfully');
      
      // Call parent callback
      if (onUpdate) {
        onUpdate(markdownContent);
      }

      setIsEditing(false);
    } catch (error) {
      console.error('[EditableDescription] Failed to update:', error);
      toast.error('Failed to update description');
    } finally {
      setIsSaving(false);
    }
  }, [editor, issueId, localDescription, onUpdate]);

  if (!localDescription && !isEditing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-primary rounded-full"></div>
            <h4 className="text-sm uppercase tracking-wide text-muted-foreground">
              Description
            </h4>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            className="h-8 px-3"
          >
            <Pencil className="h-3.5 w-3.5 mr-2" />
            Add
          </Button>
        </div>
        <Card className="shadow-none border-0 bg-muted/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground italic">
              No description provided
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-primary rounded-full"></div>
          <h4 className="text-sm uppercase tracking-wide text-muted-foreground">
            Description
          </h4>
        </div>
        
        {!isEditing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            className="h-8 px-3"
          >
            <Pencil className="h-3.5 w-3.5 mr-2" />
            Edit
          </Button>
        )}

        {isEditing && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isSaving}
              className="h-8 px-3"
            >
              <X className="h-3.5 w-3.5 mr-2" />
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="h-8 px-3 bg-primary hover:bg-primary/90"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 mr-2" />
                  Update
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      <Card className="shadow-none border-0 bg-muted/20">
        <CardContent className="p-4">
          {!isEditing ? (
            <MarkdownRenderer content={localDescription || ''} />
          ) : (
            <div className="space-y-3">
              {/* Toolbar */}
              <div className="flex items-center gap-1.5 pb-3 border-b border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  disabled={!editor || isSaving}
                  className={`h-8 w-8 p-0 ${editor?.isActive('bold') ? 'bg-primary/10 text-primary' : ''}`}
                  title="Bold"
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  disabled={!editor || isSaving}
                  className={`h-8 w-8 p-0 ${editor?.isActive('italic') ? 'bg-primary/10 text-primary' : ''}`}
                  title="Italic"
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                  disabled={!editor || isSaving}
                  className={`h-8 w-8 p-0 ${editor?.isActive('heading', { level: 2 }) ? 'bg-primary/10 text-primary' : ''}`}
                  title="Heading"
                >
                  <Heading2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  disabled={!editor || isSaving}
                  className={`h-8 w-8 p-0 ${editor?.isActive('bulletList') ? 'bg-primary/10 text-primary' : ''}`}
                  title="Bullet List"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                  disabled={!editor || isSaving}
                  className={`h-8 w-8 p-0 ${editor?.isActive('orderedList') ? 'bg-primary/10 text-primary' : ''}`}
                  title="Numbered List"
                >
                  <ListOrdered className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
                  disabled={!editor || isSaving}
                  className={`h-8 w-8 p-0 ${editor?.isActive('codeBlock') ? 'bg-primary/10 text-primary' : ''}`}
                  title="Code Block"
                >
                  <Code className="h-4 w-4" />
                </Button>
              </div>

              {/* Editor */}
              <div className="border border-border rounded-lg bg-background overflow-hidden min-h-[240px]">
                {editor ? (
                  <EditorContent editor={editor} />
                ) : (
                  <div className="min-h-[200px] p-4 flex items-center justify-center text-muted-foreground">
                    Loading editor...
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Paste images (Cmd+V / Ctrl+V) to upload them inline
              </p>

              {/* Image upload button */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSaving}
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Upload Image
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}