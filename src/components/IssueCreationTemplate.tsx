import React, { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import TurndownService from "turndown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Switch } from "./ui/switch";
import { Separator } from "./ui/separator";
import {
  Paperclip,
  X,
  FileText,
  User,
  Flag,
  Bold,
  Italic,
  List,
  ListOrdered,
  Code,
  Heading2,
  Trash2,
  CheckSquare,
  Bug,
  ListTodo,
} from "lucide-react";
import { toast } from "sonner@2.0.3";

// Initialize Turndown for HTML → Markdown conversion with tasklist support
const turndownService = new TurndownService({
  headingStyle: "atx",
  hr: "---",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "_",
  strongDelimiter: "**",
});

// Add task list rule for Turndown
turndownService.addRule("taskList", {
  filter: (node) => {
    return (
      node.nodeName === "UL" && node.getAttribute("data-type") === "taskList"
    );
  },
  replacement: (content) => content,
});

turndownService.addRule("taskItem", {
  filter: (node) => {
    return (
      node.nodeName === "LI" && node.getAttribute("data-type") === "taskItem"
    );
  },
  replacement: (content, node) => {
    const checkbox = node.querySelector('input[type="checkbox"]');
    const isChecked = checkbox?.checked;
    return `- [${isChecked ? "x" : " "}] ${content.trim()}\n`;
  },
});

interface IssueCreationTemplateProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (issueData: IssueFormData) => Promise<void>;
  teamId?: string;
  workflowStates?: any[];
  teamMembers?: any[];
}

interface IssueFormData {
  title: string;
  description: string;
  priority: number;
  stateId?: string;
  assigneeId?: string;
  files?: File[];
}

const PRIORITY_OPTIONS = [
  { value: 0, label: "No priority", color: "text-gray-500" },
  { value: 4, label: "Low", color: "text-blue-600" },
  { value: 3, label: "Medium", color: "text-yellow-600" },
  { value: 2, label: "High", color: "text-orange-600" },
  { value: 1, label: "Urgent", color: "text-red-600" },
];

// Auto-detect browser, OS, and screen size
const getSystemInfo = () => {
  const ua = navigator.userAgent;

  // Detect browser
  let browser = "Unknown";
  if (ua.indexOf("Firefox") > -1) {
    browser = "Firefox";
  } else if (ua.indexOf("SamsungBrowser") > -1) {
    browser = "Samsung Internet";
  } else if (
    ua.indexOf("Opera") > -1 ||
    ua.indexOf("OPR") > -1
  ) {
    browser = "Opera";
  } else if (ua.indexOf("Trident") > -1) {
    browser = "Internet Explorer";
  } else if (ua.indexOf("Edge") > -1) {
    browser = "Edge (Legacy)";
  } else if (ua.indexOf("Edg") > -1) {
    browser = "Edge";
  } else if (ua.indexOf("Chrome") > -1) {
    browser = "Chrome";
  } else if (ua.indexOf("Safari") > -1) {
    browser = "Safari";
  }

  // Detect OS
  let os = "Unknown";
  if (ua.indexOf("Win") > -1) {
    os = "Windows";
    if (ua.indexOf("Windows NT 10.0") > -1)
      os = "Windows 10/11";
    else if (ua.indexOf("Windows NT 6.3") > -1)
      os = "Windows 8.1";
    else if (ua.indexOf("Windows NT 6.2") > -1)
      os = "Windows 8";
    else if (ua.indexOf("Windows NT 6.1") > -1)
      os = "Windows 7";
  } else if (ua.indexOf("Mac") > -1) {
    os = "macOS";
  } else if (
    ua.indexOf("X11") > -1 ||
    ua.indexOf("Linux") > -1
  ) {
    os = "Linux";
  } else if (ua.indexOf("Android") > -1) {
    os = "Android";
  } else if (
    ua.indexOf("iOS") > -1 ||
    ua.indexOf("iPhone") > -1 ||
    ua.indexOf("iPad") > -1
  ) {
    os = "iOS";
  }

  // Get screen size
  const screenSize = `${window.innerWidth}×${window.innerHeight} (viewport), ${screen.width}×${screen.height} (screen)`;

  return { browser, os, screenSize };
};

// Template types
type TemplateType = "bug" | "task" | "blank";

// Generate HTML Template based on type
const generateTemplate = (type: TemplateType) => {
  const { browser, os, screenSize } = getSystemInfo();

  if (type === "bug") {
    // Bug Report Template with system info
    return `<h2>Description of Issue:</h2>
<p><em>Briefly describe the issue you encountered.</em></p>

<h2>Steps to recreate:</h2>
<p><em>Provide the steps to take in order to recreate the issue</em></p>
<ol>
  <li><p>First step</p></li>
  <li><p>Second step</p></li>
  <li><p>Third step</p></li>
</ol>

<h2>Expected vs Actual:</h2>
<ul>
  <li><p><strong>Expected:</strong> What should happen</p></li>
  <li><p><strong>Actual:</strong> What actually happens</p></li>
</ul>

<h2>Additional information:</h2>
<p><em>System information auto-detected - update if needed</em></p>
<ul>
  <li><p>Browser: ${browser}</p></li>
  <li><p>OS: ${os}</p></li>
  <li><p>Screen size: ${screenSize}</p></li>
</ul>`;
  } else if (type === "task") {
    // Task Template with checklist
    return `<h2>Task Overview:</h2>
<p><em>What needs to be done?</em></p>

<h2>Acceptance Criteria:</h2>
<ul data-type="taskList">
  <li data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Criteria 1</p></div></li>
  <li data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Criteria 2</p></div></li>
  <li data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Criteria 3</p></div></li>
</ul>

<h2>Implementation Notes:</h2>
<p><em>Any technical details or considerations</em></p>`;
  } else {
    // Blank template
    return "<p></p>";
  }
};

export function IssueCreationTemplate({
  isOpen,
  onClose,
  onSubmit,
  teamId,
  workflowStates = [],
  teamMembers = [],
}: IssueCreationTemplateProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<number>(0);
  const [stateId, setStateId] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>(
    [],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [templateType, setTemplateType] = useState<TemplateType>("task");

  // Get default state - prefer first state in workflowStates list (Client Review for UAT kanban)
  const defaultState =
    workflowStates.length > 0
      ? workflowStates[0] // Use first state in the list (usually Client Review)
      : workflowStates.find(
          (state) =>
            state.type === "unstarted" ||
            state.name.toLowerCase() === "backlog",
        );

  // Initialize Tiptap WYSIWYG Editor with auto-populated template
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3], // Only h2 and h3
        },
      }),
      Placeholder.configure({
        placeholder: "Start typing here...",
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
    content: generateTemplate("task"), // Use function to generate template with system info
    editorProps: {
      attributes: {
        class: "ProseMirror focus:outline-none !min-h-[500px] !p-4",
      },
    },
  });

  React.useEffect(() => {
    if (isOpen && defaultState && !stateId) {
      setStateId(defaultState.id);
    }
  }, [isOpen, defaultState, stateId]);

  // Reset content when dialog opens - regenerate template with fresh system info
  React.useEffect(() => {
    if (isOpen && editor) {
      editor.commands.setContent(generateTemplate(templateType)); // Regenerate with current system info
      setTitle("");
      setSelectedFiles([]);
      setPriority(0);
      setAssigneeId("");
    }
  }, [isOpen, editor, templateType]);

  // Change template when type changes
  const handleTemplateTypeChange = (type: TemplateType) => {
    setTemplateType(type);
    if (editor) {
      editor.commands.setContent(generateTemplate(type));
    }
  };

  const handleFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) =>
      prev.filter((_, i) => i !== index),
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (!editor) {
      toast.error("Editor not initialized");
      return;
    }

    setIsSubmitting(true);

    try {
      // Get HTML content from editor
      const descriptionHTML = editor.getHTML();

      // Convert HTML to Markdown for Linear API
      const descriptionMarkdown =
        turndownService.turndown(descriptionHTML);

      console.log(
        "[IssueCreation] Converting HTML to Markdown:",
        {
          htmlLength: descriptionHTML.length,
          markdownLength: descriptionMarkdown.length,
          preview: descriptionMarkdown.substring(0, 200),
        },
      );

      const issueData: IssueFormData = {
        title: title.trim(),
        description: descriptionMarkdown, // Send Markdown, not HTML
        priority,
        stateId: stateId || defaultState?.id,
        assigneeId:
          assigneeId && assigneeId !== "unassigned"
            ? assigneeId
            : undefined,
        files:
          selectedFiles.length > 0 ? selectedFiles : undefined,
      };

      await onSubmit(issueData);

      toast.success(
        "Issue created successfully",
      );

      handleClose();
    } catch (error) {
      console.error("Failed to create issue:", error);
      toast.error("Failed to create issue");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setTitle("");
    if (editor) {
      editor.commands.setContent(generateTemplate("bug")); // Fresh template
    }
    setPriority(0);
    setStateId("");
    setAssigneeId("");
    setSelectedFiles([]);
    onClose();
  };

  const handleClearTemplate = () => {
    if (!editor) return;
    
    // Clear editor content completely
    editor.commands.setContent("");
    toast.success("Template cleared");
  };

  const selectedPriority = PRIORITY_OPTIONS.find(
    (p) => p.value === priority,
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="!max-w-5xl !w-[95vw] !h-[90vh] !p-0 !gap-0 !overflow-hidden !flex !flex-col">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border bg-muted/20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle>Create Sub-Issue</DialogTitle>
              <DialogDescription>
                Add a child task to break down this issue into smaller pieces
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="issue-title">Title</Label>
              <Input
                id="issue-title"
                placeholder="Issue title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-11"
                autoFocus
              />
            </div>

            <Separator />

            {/* Description with WYSIWYG Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="tiptap-editor">Description</Label>
                
                {/* Template Type Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Template:</span>
                  <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTemplateTypeChange('task')}
                      className={`h-7 px-3 text-xs ${
                        templateType === 'task'
                          ? 'bg-background shadow-sm'
                          : 'hover:bg-background/50'
                      }`}
                      title="Task template with checklist"
                    >
                      <ListTodo className="h-3 w-3 mr-1.5" />
                      Task
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTemplateTypeChange('bug')}
                      className={`h-7 px-3 text-xs ${
                        templateType === 'bug'
                          ? 'bg-background shadow-sm'
                          : 'hover:bg-background/50'
                      }`}
                      title="Bug report with system info"
                    >
                      <Bug className="h-3 w-3 mr-1.5" />
                      Bug
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTemplateTypeChange('blank')}
                      className={`h-7 px-3 text-xs ${
                        templateType === 'blank'
                          ? 'bg-background shadow-sm'
                          : 'hover:bg-background/50'
                      }`}
                      title="Start from scratch"
                    >
                      <FileText className="h-3 w-3 mr-1.5" />
                      Blank
                    </Button>
                  </div>
                </div>
              </div>

              {/* Formatting Toolbar */}
              <div className="flex items-center gap-1 p-2 border border-border rounded-t-lg bg-muted/30">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    editor?.chain().focus().toggleBold().run()
                  }
                  disabled={!editor}
                  className={`h-8 w-8 p-0 ${editor?.isActive("bold") ? "bg-primary/10 text-primary" : ""}`}
                  title="Bold"
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    editor?.chain().focus().toggleItalic().run()
                  }
                  disabled={!editor}
                  className={`h-8 w-8 p-0 ${editor?.isActive("italic") ? "bg-primary/10 text-primary" : ""}`}
                  title="Italic"
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    editor
                      ?.chain()
                      .focus()
                      .toggleHeading({ level: 2 })
                      .run()
                  }
                  disabled={!editor}
                  className={`h-8 w-8 p-0 ${editor?.isActive("heading", { level: 2 }) ? "bg-primary/10 text-primary" : ""}`}
                  title="Heading"
                >
                  <Heading2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    editor
                      ?.chain()
                      .focus()
                      .toggleBulletList()
                      .run()
                  }
                  disabled={!editor}
                  className={`h-8 w-8 p-0 ${editor?.isActive("bulletList") ? "bg-primary/10 text-primary" : ""}`}
                  title="Bullet List"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    editor
                      ?.chain()
                      .focus()
                      .toggleOrderedList()
                      .run()
                  }
                  disabled={!editor}
                  className={`h-8 w-8 p-0 ${editor?.isActive("orderedList") ? "bg-primary/10 text-primary" : ""}`}
                  title="Numbered List"
                >
                  <ListOrdered className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    editor
                      ?.chain()
                      .focus()
                      .toggleCodeBlock()
                      .run()
                  }
                  disabled={!editor}
                  className={`h-8 w-8 p-0 ${editor?.isActive("codeBlock") ? "bg-primary/10 text-primary" : ""}`}
                  title="Code Block"
                >
                  <Code className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    editor
                      ?.chain()
                      .focus()
                      .toggleTaskList()
                      .run()
                  }
                  disabled={!editor}
                  className={`h-8 w-8 p-0 ${editor?.isActive("taskList") ? "bg-primary/10 text-primary" : ""}`}
                  title="Task List"
                >
                  <ListTodo className="h-4 w-4" />
                </Button>
              </div>

              {/* WYSIWYG Editor */}
              <div className="border border-t-0 border-border rounded-b-lg bg-background overflow-hidden">
                {editor ? (
                  <EditorContent editor={editor} />
                ) : (
                  <div className="min-h-[400px] p-4 flex items-center justify-center text-muted-foreground">
                    Loading editor...
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Use the toolbar above to format your text. You
                see what you type!
              </p>
            </div>

            {/* File Attachments */}
            <div className="space-y-2">
              <Label>Attachments</Label>
              <div className="space-y-3">
                {/* Selected Files */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border file-attachment-card"
                      >
                        <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleRemoveFile(index)
                          }
                          className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Button */}
                <div>
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    multiple
                    onChange={handleFileSelect}
                    accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      document
                        .getElementById("file-upload")
                        ?.click()
                    }
                    className="h-9"
                  >
                    <Paperclip className="h-4 w-4 mr-2" />
                    Attach files
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            {/* Properties Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* State (Backlog) */}
              {workflowStates.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Status
                  </Label>
                  <Select
                    value={stateId}
                    onValueChange={setStateId}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {workflowStates.map((state) => (
                        <SelectItem
                          key={state.id}
                          value={state.id}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{
                                backgroundColor: state.color,
                              }}
                            />
                            {state.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Priority */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Priority
                </Label>
                <Select
                  value={priority.toString()}
                  onValueChange={(value) =>
                    setPriority(parseInt(value))
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue>
                      {selectedPriority && (
                        <div className="flex items-center gap-2">
                          <Flag
                            className={`h-3.5 w-3.5 ${selectedPriority.color}`}
                          />
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
                          <Flag
                            className={`h-3.5 w-3.5 ${option.color}`}
                          />
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Assignee */}
              {teamMembers.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Assignee
                  </Label>
                  <Select
                    value={assigneeId || "unassigned"}
                    onValueChange={(value) =>
                      setAssigneeId(
                        value === "unassigned" ? "" : value,
                      )
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Unassigned">
                        {assigneeId &&
                        assigneeId !== "unassigned" ? (
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5" />
                            <span>
                              {teamMembers.find(
                                (m) => m.id === assigneeId,
                              )?.name || "Assigned"}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Unassigned
                            </span>
                          </div>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Unassigned
                          </span>
                        </div>
                      </SelectItem>
                      {teamMembers.map((member) => (
                        <SelectItem
                          key={member.id}
                          value={member.id}
                        >
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5" />
                            <span>{member.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/20">
          <div className="flex items-center justify-between">
            {/* Left: Clear Template Button */}
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

            {/* Right: Action Buttons */}
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
                {isSubmitting ? "Creating..." : "Create issue"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}