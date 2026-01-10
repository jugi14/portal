/**
 * Rich Text Editor Component with TipTap
 * 
 * OUTPUT: Returns HTML content (caller must convert to Markdown using TurndownService)
 * Features: Bold, Italic, Bullet/Numbered lists, Checklist, Simple toolbar
 * Typography: Follows Teifi Design System from globals.css
 * 
 * PATTERN: Same as IssueCreationTemplate
 * - Editor stores HTML internally
 * - onChange returns HTML
 * - Parent component converts HTML to Markdown before API submission
 */

import React, { useEffect, useCallback, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Bold, Italic, List, ListOrdered, Code, Heading2, CheckSquare } from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  id?: string;
}

/**
 * Rich Text Editor with toolbar
 * Returns HTML content for Markdown conversion
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start typing...',
  minHeight = '120px',
  id,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
        blockquote: false,
        horizontalRule: false,
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
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      // Return HTML for parent to convert to Markdown
      const html = editor.getHTML();
      onChange(html);
    },
    editorProps: {
      attributes: {
        class: 'ProseMirror',
        // REMOVED: inline style - use CSS for height control
      },
    },
  });

  // Update editor content when value changes externally
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  // PERFORMANCE: Memoize toolbar button handlers
  const handleBold = useCallback(() => {
    editor?.chain().focus().toggleBold().run();
  }, [editor]);

  const handleItalic = useCallback(() => {
    editor?.chain().focus().toggleItalic().run();
  }, [editor]);

  const handleHeading = useCallback(() => {
    editor?.chain().focus().toggleHeading({ level: 2 }).run();
  }, [editor]);

  const handleBulletList = useCallback(() => {
    editor?.chain().focus().toggleBulletList().run();
  }, [editor]);

  const handleOrderedList = useCallback(() => {
    editor?.chain().focus().toggleOrderedList().run();
  }, [editor]);

  const handleTaskList = useCallback(() => {
    editor?.chain().focus().toggleTaskList().run();
  }, [editor]);

  const handleCodeBlock = useCallback(() => {
    editor?.chain().focus().toggleCodeBlock().run();
  }, [editor]);

  // PERFORMANCE: Memoize active states
  const isActive = useMemo(() => ({
    bold: editor?.isActive('bold') ?? false,
    italic: editor?.isActive('italic') ?? false,
    heading: editor?.isActive('heading', { level: 2 }) ?? false,
    bulletList: editor?.isActive('bulletList') ?? false,
    orderedList: editor?.isActive('orderedList') ?? false,
    taskList: editor?.isActive('taskList') ?? false,
    codeBlock: editor?.isActive('codeBlock') ?? false,
  }), [editor?.state]);

  if (!editor) {
    return null;
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background">
      {/* Toolbar */}
      <div 
        data-comment-toolbar
        className="flex items-center gap-1 p-2 border-b border-border bg-muted/30"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBold}
              className={`h-8 w-8 p-0 ${isActive.bold ? 'is-active bg-primary/10 text-primary' : ''}`}
            >
              <Bold className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Bold (Ctrl+B)</TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleItalic}
              className={`h-8 w-8 p-0 ${isActive.italic ? 'is-active bg-primary/10 text-primary' : ''}`}
            >
              <Italic className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Italic (Ctrl+I)</TooltipContent>
        </Tooltip>

        <div className="toolbar-separator" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleHeading}
              className={`h-8 w-8 p-0 ${isActive.heading ? 'is-active bg-primary/10 text-primary' : ''}`}
            >
              <Heading2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Heading 2</TooltipContent>
        </Tooltip>

        <div className="toolbar-separator" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBulletList}
              className={`h-8 w-8 p-0 ${isActive.bulletList ? 'is-active bg-primary/10 text-primary' : ''}`}
            >
              <List className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Bullet List</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleOrderedList}
              className={`h-8 w-8 p-0 ${isActive.orderedList ? 'is-active bg-primary/10 text-primary' : ''}`}
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Numbered List</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleTaskList}
              className={`h-8 w-8 p-0 ${isActive.taskList ? 'is-active bg-primary/10 text-primary' : ''}`}
            >
              <CheckSquare className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Checklist (Task List)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCodeBlock}
              className={`h-8 w-8 p-0 ${isActive.codeBlock ? 'is-active bg-primary/10 text-primary' : ''}`}
            >
              <Code className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Code Block</TooltipContent>
        </Tooltip>
      </div>

      {/* Editor Content */}
      <EditorContent 
        editor={editor} 
        id={id}
        placeholder={placeholder}
        className="editor-container"
      />
    </div>
  );
}