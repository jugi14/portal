import React, { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TurndownService from 'turndown';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { 
  Paperclip, 
  X, 
  FileText,
  Flag,
  Loader2,
  Bold,
  Italic,
  List,
  ListOrdered,
  Code,
  Heading2,
  Trash2,
  ImageIcon,
  CheckSquare,
  Bug,
  ListTodo
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
  strongDelimiter: '**',
});

// Add task list rule for Turndown
turndownService.addRule('taskList', {
  filter: (node) => {
    return (
      node.nodeName === 'UL' && node.getAttribute('data-type') === 'taskList'
    );
  },
  replacement: (content) => content,
});

turndownService.addRule('taskItem', {
  filter: (node) => {
    return (
      node.nodeName === 'LI' && node.getAttribute('data-type') === 'taskItem'
    );
  },
  replacement: (content, node) => {
    const checkbox = node.querySelector('input[type="checkbox"]');
    const isChecked = checkbox?.checked;
    return `- [${isChecked ? 'x' : ' '}] ${content.trim()}\n`;
  },
});

interface CreateAcceptanceIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (issueData: AcceptanceIssueData) => Promise<void>;
  teamId: string;
  activeUATCycle?: {
    id: string;
    name: string;
  };
}

interface AcceptanceIssueData {
  title: string;
  description: string;
  priority: number;
  stateId?: string;
  cycleId?: string;
  labelIds?: string[];
  files?: File[]; // Manual attachments only
}

const PRIORITY_OPTIONS = [
  { value: 0, label: 'No priority', color: 'text-gray-500' },
  { value: 4, label: 'Low', color: 'text-blue-600' },
  { value: 3, label: 'Medium', color: 'text-yellow-600' },
  { value: 2, label: 'High', color: 'text-orange-600' },
  { value: 1, label: 'Urgent', color: 'text-red-600' },
];

const getSystemInfo = () => {
  const ua = navigator.userAgent;
  
  let browser = 'Unknown';
  if (ua.indexOf('Firefox') > -1) {
    browser = 'Firefox';
  } else if (ua.indexOf('Edg') > -1) {
    browser = 'Edge';
  } else if (ua.indexOf('Chrome') > -1) {
    browser = 'Chrome';
  } else if (ua.indexOf('Safari') > -1) {
    browser = 'Safari';
  }
  
  let os = 'Unknown';
  if (ua.indexOf('Win') > -1) {
    os = 'Windows';
    if (ua.indexOf('Windows NT 10.0') > -1) os = 'Windows 10/11';
  } else if (ua.indexOf('Mac') > -1) {
    os = 'macOS';
  } else if (ua.indexOf('Linux') > -1) {
    os = 'Linux';
  } else if (ua.indexOf('Android') > -1) {
    os = 'Android';
  } else if (ua.indexOf('iOS') > -1 || ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1) {
    os = 'iOS';
  }
  
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  return {
    browser,
    os,
    screenSize: `${screenWidth}x${screenHeight} (screen), ${viewportWidth}x${viewportHeight} (viewport)`,
  };
};

const generateIssueTemplate = () => {
  const { browser, os, screenSize } = getSystemInfo();

  return `<p><strong>Description of Issue:</strong></p>
<p><em>Briefly describe the issue you encountered.</em></p>

<p><strong>Steps to recreate:</strong></p>
<p><em>Provide the steps to take in order to recreate the issue</em></p>
<ol>
  <li><p>First step</p></li>
  <li><p>Second step</p></li>
  <li><p>Third step</p></li>
</ol>

<p><strong>Expected vs Actual:</strong></p>
<ul>
  <li><p><strong>Expected:</strong> What should happen</p></li>
  <li><p><strong>Actual:</strong> What actually happens</p></li>
</ul>

<p><strong>Additional information:</strong></p>
<p><em>System information auto-detected - update if needed</em></p>
<ul>
  <li><p>Browser: ${browser}</p></li>
  <li><p>OS: ${os}</p></li>
  <li><p>Screen size: ${screenSize}</p></li>
</ul>`;
};

export function CreateAcceptanceIssueModal({
  isOpen,
  onClose,
  onSubmit,
  teamId,
  activeUATCycle
}: CreateAcceptanceIssueModalProps) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convert File to base64 data URL
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({
        placeholder: 'Start typing here... Paste images directly (Ctrl+V)',
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'task-list',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'task-item',
        },
      }),
    ],
    content: generateIssueTemplate(),
    editorProps: {
      attributes: {
        class: 'ProseMirror focus:outline-none !min-h-[500px] !p-4',
      },
      handlePaste: async (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        // Get current editor instance from view
        const currentEditor = view.state;
        
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          
          if (item.type.indexOf('image') !== -1) {
            event.preventDefault();
            
            const file = item.getAsFile();
            if (!file) continue;

            console.log('[CreateIssue] Image pasted:', file.name, file.type, file.size);

            try {
              // Convert to base64 and insert
              const base64 = await fileToBase64(file);
              
              console.log('[CreateIssue] Base64 conversion successful, length:', base64.length);
              
              // Insert image using view's dispatch
              const { schema } = view.state;
              const node = schema.nodes.image?.create({
                src: base64,
                alt: file.name,
              });
              
              if (node) {
                const transaction = view.state.tr.replaceSelectionWith(node);
                view.dispatch(transaction);
                console.log('[CreateIssue] Image inserted into editor');
                toast.success('Image pasted successfully');
              } else {
                console.error('[CreateIssue] Failed to create image node');
                toast.error('Failed to insert image');
              }
            } catch (error) {
              console.error('[CreateIssue] Failed to convert image:', error);
              toast.error('Failed to insert image');
            }
            
            return true;
          }
        }
        
        return false;
      },
    },
  });

  useEffect(() => {
    if (isOpen && editor) {
      editor.commands.setContent(generateIssueTemplate());
      setTitle('');
      setSelectedFiles([]);
      setPriority(0);
    }
  }, [isOpen, editor]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handleClearTemplate = () => {
    if (!editor) return;
    editor.commands.setContent('');
    toast.success('Template cleared');
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (!editor) {
      toast.error('Editor not initialized');
      return;
    }

    const textContent = editor.getText() || '';
    if (!textContent.trim()) {
      toast.error('Please enter a description');
      return;
    }

    setIsSubmitting(true);

    try {
      const descriptionHTML = editor.getHTML();
      const descriptionMarkdown = turndownService.turndown(descriptionHTML);
      
      // IMPORTANT: Keep base64 images in markdown
      // Linear automatically converts base64 to real URLs when saving
      // No need to strip or upload separately
      
      console.log('[CreateAcceptanceIssue] Converting HTML to Markdown:', {
        htmlLength: descriptionHTML.length,
        markdownLength: descriptionMarkdown.length,
        filesCount: selectedFiles.length,
        hasBase64Images: descriptionMarkdown.includes('data:image'),
        preview: descriptionMarkdown.substring(0, 200),
      });

      const issueData: AcceptanceIssueData = {
        title: title.trim(),
        description: descriptionMarkdown,
        priority,
        cycleId: activeUATCycle?.id,
        files: selectedFiles.length > 0 ? selectedFiles : undefined,
      };

      await onSubmit(issueData);

      toast.success('Issue created successfully');
      handleClose();
    } catch (error) {
      console.error('[CreateAcceptanceIssue] Failed to create issue:', error);
      toast.error('Failed to create issue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    if (editor) {
      editor.commands.setContent(generateIssueTemplate());
    }
    setPriority(0);
    setSelectedFiles([]);
    onClose();
  };

  const selectedPriority = PRIORITY_OPTIONS.find((p) => p.value === priority);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="!max-w-5xl !w-[95vw] !h-[90vh] !p-0 !gap-0 !overflow-hidden !flex !flex-col">
        <DialogHeader className="px-6 py-4 border-b border-border bg-muted/20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle>Create Acceptance Issue</DialogTitle>
              <DialogDescription>
                Complete the form below - use toolbar to format text
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-8">
            {/* Title Input */}
            <div className="space-y-2">
              <Label htmlFor="issue-title">Title</Label>
              <Input
                id="issue-title"
                placeholder="Enter a clear, concise title for the issue"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-11"
                autoFocus
              />
            </div>

            {/* Description Editor */}
            <div className="space-y-2">
              <Label htmlFor="tiptap-editor">Description</Label>

              <div className="flex items-center gap-1 p-2 border border-border rounded-t-lg bg-muted/20">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  disabled={!editor}
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
                  disabled={!editor}
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
                  disabled={!editor}
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
                  disabled={!editor}
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
                  disabled={!editor}
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
                  disabled={!editor}
                  className={`h-8 w-8 p-0 ${editor?.isActive('codeBlock') ? 'bg-primary/10 text-primary' : ''}`}
                  title="Code Block"
                >
                  <Code className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleTaskList().run()}
                  disabled={!editor}
                  className={`h-8 w-8 p-0 ${editor?.isActive('taskList') ? 'bg-primary/10 text-primary' : ''}`}
                  title="Task List"
                >
                  <ListTodo className="h-4 w-4" />
                </Button>
              </div>

              <div className="border border-t-0 border-border rounded-b-lg bg-background overflow-hidden">
                {editor ? (
                  <div className="min-h-[500px]">
                    <EditorContent editor={editor} />
                  </div>
                ) : (
                  <div className="min-h-[500px] p-4 flex items-center justify-center text-muted-foreground">
                    Loading editor...
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Tip: Paste images (Cmd+V / Ctrl+V) to preview - they will be uploaded into issue description
              </p>
            </div>

            {/* Attachments Section */}
            <div className="space-y-3 rounded-lg bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Attachments</Label>
                {selectedFiles.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                  </span>
                )}
              </div>
              
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => {
                    const isImage = file.type.startsWith('image/');
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border"
                      >
                        {isImage ? (
                          <ImageIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        ) : (
                          <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFile(index)}
                          className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  multiple
                  onChange={handleFileSelect}
                  accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx"
                  ref={fileInputRef}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-9"
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  Attach files
                </Button>
              </div>
            </div>

            {/* Metadata Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg bg-muted/20 p-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Priority
                </Label>
                <Select
                  value={priority.toString()}
                  onValueChange={(value) => setPriority(parseInt(value))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue>
                      {selectedPriority && (
                        <div className="flex items-center gap-2">
                          <Flag className={`h-3.5 w-3.5 ${selectedPriority.color}`} />
                          <span>{selectedPriority.label}</span>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value.toString()}
                      >
                        <div className="flex items-center gap-2">
                          <Flag className={`h-3.5 w-3.5 ${option.color}`} />
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {activeUATCycle && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Cycle
                  </Label>
                  <div className="h-9 px-3 flex items-center rounded-md border border-border bg-background">
                    <span className="text-sm">{activeUATCycle.name}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/20 flex-shrink-0">
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearTemplate}
              disabled={isSubmitting || !editor}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear template
            </Button>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !title.trim()}
                className="bg-primary hover:bg-primary/90 min-w-[140px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create issue'
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}