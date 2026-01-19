import React, { useState, useEffect, useCallback, useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import TurndownService from "turndown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Separator } from "./ui/separator";
import { Card, CardContent } from "./ui/card";
import { Progress } from "./ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import {
  ExternalLink,
  MessageSquare,
  Calendar,
  User,
  Clock,
  Hash,
  Tag,
  Paperclip,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Plus,
  GitBranch,
  ChevronRight,
  ChevronDown,
  X,
  Bold,
  Italic,
  List,
  ListOrdered,
  Code,
  Heading2,
  FileText,
  Image as ImageIcon,
  File,
  Trash2,
  MoreVertical,
} from "lucide-react";
import {
  LinearIssue,
  LinearQueries,
  LinearMutations,
  LinearHelpers,
} from "../services/linearTeamIssuesService";
import { IssueCreationTemplate } from "./IssueCreationTemplate";
import { IssueDetailSkeleton } from "./ui/skeleton-library";
import { projectId, publicAnonKey } from "../utils/supabase/info";
import { secureTokenStorage } from "../services/secureTokenStorage";
import { toast } from "sonner";
import { useHasRole } from "../contexts/PermissionContext";
import {
  areAllChildrenApproved,
  getChildrenNotReadyForRelease,
} from "../utils/teamIssuesDragDrop";
import { apiClient } from "../services/apiClient";
import { MarkdownRenderer } from "./issue-detail/MarkdownRenderer";
import { EditableDescription } from "./issue-detail/EditableDescription";
import { useCommentActions } from "./issue-detail/hooks/useCommentActions";
import { useViewportStability } from "../utils/viewportStability";
import { useIssueDelete } from "./issue-detail/hooks/useIssueDelete";
import { DeleteConfirmationDialog } from "./issue-detail/DeleteConfirmationDialog";

// Initialize Turndown for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: "atx",
  hr: "---",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "_",
  strongDelimiter: "**",
});

interface IssueDetailModalProps {
  issue: LinearIssue | null;
  isOpen: boolean;
  onClose: () => void;
  onIssueUpdate?: (updatedIssue: LinearIssue) => void;
  onIssueClick?: (issue: LinearIssue) => void; // Click sub-issue to open its modal
  forceEnableComments?: boolean; // Force enable comments (for Tasks board)
  showAcceptanceIssues?: boolean; // Show/hide Acceptance Issues section (default: true for Tasks, false for Issues)
}

// Memoized component to avoid unnecessary re-renders
const IssueDetailModalComponent = ({
  issue,
  isOpen,
  onClose,
  onIssueUpdate,
  onIssueClick, // Handle sub-issue click
  forceEnableComments = false, // Default false for backward compatibility
  showAcceptanceIssues = true, // Default true for backward compatibility
}: IssueDetailModalProps) => {
  const [issueDetails, setIssueDetails] = useState<LinearIssue | null>(null);
  const [loading, setLoading] = useState(false);

  // Navigation state - Track parent/sub-issue navigation
  const [navigationStack, setNavigationStack] = useState<LinearIssue[]>([]);
  const [currentIssue, setCurrentIssue] = useState<LinearIssue | null>(null);

  // Scroll position preservation
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [savedScrollPosition, setSavedScrollPosition] = useState(0);

  // Sub-issue creation state
  const [isCreatingSubIssue, setIsCreatingSubIssue] = useState(false);
  const [showSubIssueDialog, setShowSubIssueDialog] = useState(false);
  const [newSubIssueTitle, setNewSubIssueTitle] = useState("");
  const [newSubIssueDescription, setNewSubIssueDescription] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Request Changes state
  const [requestChangesSubIssue, setRequestChangesSubIssue] =
    useState<any>(null);
  const [isRequestingChanges, setIsRequestingChanges] = useState(false);
  const [requestChangesFiles, setRequestChangesFiles] = useState<File[]>([]);
  const [isUploadingRequestChangesImage, setIsUploadingRequestChangesImage] =
    useState(false);
  const [requestChangesHasContent, setRequestChangesHasContent] =
    useState(false);

  // Approve state
  const [isApproving, setIsApproving] = useState(false);

  // Partial Approve state
  const [isPartialApproving, setIsPartialApproving] = useState(false);

  // Refresh state - Show subtle indicator when refreshing after mutations
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Team configuration for issue creation
  const [teamConfig, setTeamConfig] = useState<any>(null);
  const [loadingTeamConfig, setLoadingTeamConfig] = useState(false);

  // Check user role for Linear link
  const isAdminOrSuperAdmin = useHasRole(["admin", "superadmin"]);

  // Viewport stability hook
  const { lockScroll, unlockScroll, isKeyboardVisible, deviceType } =
    useViewportStability();

  // Check if comments are enabled (admin setting or forced)
  const [commentsEnabled, setCommentsEnabled] = useState(() => {
    if (forceEnableComments) return true; // Tasks board always enables comments
    return localStorage.getItem("teifi_enable_comments") === "true";
  });

  // Comment actions with file upload support
  const {
    commentEditor,
    isAddingComment,
    isUploadingImage,
    attachedFiles,
    handleAddComment,
    handleFileSelect: handleCommentFileSelect,
    handleRemoveFile,
  } = useCommentActions({
    issue,
    currentIssue,
    issueDetails,
    setIssueDetails,
    onIssueUpdate,
  });

  // Delete functionality
  const {
    deleteConfirmation,
    isDeleting,
    initiateDelete,
    cancelDelete,
    confirmDelete,
  } = useIssueDelete({
    issue: issueDetails || currentIssue || issue,
    onClose,
    onIssueUpdate,
  });

  // TipTap editor for Request Changes
  const requestChangesEditor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder:
          "Write your comment here... Paste images directly or use toolbar to format text",
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
    ],
    content: "",
    onUpdate: ({ editor }) => {
      // Update content state when editor changes
      const text = editor.getText();
      const html = editor.getHTML();
      const hasImages = html.includes("<img");
      setRequestChangesHasContent(text.trim().length > 0 || hasImages);
    },
    editorProps: {
      attributes: {
        // Remove inline styling - let rich-text-editor.css handle all styling
        class: "ProseMirror",
      },
      // Handle paste for images
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (let i = 0; i < items.length; i++) {
          const item = items[i];

          // Check if pasted item is an image
          if (item.type.indexOf("image") !== -1) {
            event.preventDefault();

            const file = item.getAsFile();
            if (!file) continue;

            // Upload image immediately
            handleRequestChangesImagePaste(file);

            return true;
          }
        }

        return false;
      },
    },
  });

  // Load team configuration for issue creation
  const loadTeamConfig = useCallback(async () => {
    const issueToLoad = currentIssue || issue;
    if (!issueToLoad?.team?.id) return;

    // CRITICAL FIX: Only load team config for Linear team keys (not UUIDs)
    // UUID format: 8-4-4-4-12 (e.g., 1ab84990-0e26-4d53-a94f-7516d518116c)
    // Linear team key: Short alphanumeric string (e.g., "TEAM", "DEV", "PROD")
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (uuidRegex.test(issueToLoad.team.id)) {
      console.warn(
        "[IssueDetailModal] Skipping team config load - team.id is UUID:",
        issueToLoad.team.id
      );
      setTeamConfig(null);
      setLoadingTeamConfig(false);
      return;
    }

    try {
      setLoadingTeamConfig(true);
      console.log(
        "[IssueDetailModal] Loading team config for:",
        issueToLoad.team.id
      );
      const config = await LinearQueries.getTeamConfig(issueToLoad.team.id);
      setTeamConfig(config);
    } catch (error) {
      // CRITICAL FIX: Gracefully handle team config errors
      // Team config is only needed for creating sub-issues, not for viewing
      // If Linear team ID is unavailable (e.g., UUID from database), fail silently
      console.error("[IssueDetailModal] Failed to load team config:", error);
      setTeamConfig(null);
      // Do NOT show error toast - this is non-critical for viewing issues
    } finally {
      setLoadingTeamConfig(false);
    }
  }, [currentIssue, issue]);

  // PERFORMANCE: Track in-flight API calls to prevent duplicates
  const loadingIssueIdRef = React.useRef<string | null>(null);
  const loadIssuePromiseRef = React.useRef<Promise<LinearIssue | null> | null>(
    null
  );

  // Load detailed issue data - defined early so it can be used in other callbacks
  // CRITICAL FIX: Fetch fresh data from API to get sub-issues
  // Returns the loaded issue details for immediate use
  // @param bypassCache - When true, fetches fresh data from Linear API (use after mutations like approve)
  const loadIssueDetails = useCallback(
    async (issueToLoad: LinearIssue, bypassCache = false): Promise<LinearIssue | null> => {
      if (!issueToLoad) {
        // ERROR: Invalid function call
        return null;
      }

      // PERFORMANCE: Prevent concurrent calls for same issue (unless bypassing cache)
      if (
        !bypassCache &&
        loadingIssueIdRef.current === issueToLoad.id &&
        loadIssuePromiseRef.current
      ) {
        console.log(
          "[IssueDetailModal] Reusing in-flight request for:",
          issueToLoad.identifier
        );
        return loadIssuePromiseRef.current;
      }

      loadingIssueIdRef.current = issueToLoad.id;

      // CRITICAL: Set loading SYNCHRONOUSLY before async operation
      setLoading(true);

      // Create promise and store reference
      const loadPromise = (async () => {
        try {
          // PERFORMANCE: Fetching full issue data from API

          console.log(
            "[IssueDetailModal] Fetching issue details for:",
            issueToLoad.identifier,
            bypassCache ? "(bypassing cache)" : ""
          );

          // FIXED: Fetch from API to get complete data including sub-issues
          // Use bypassCache=true after mutations to get fresh data from Linear
          const endpoint = bypassCache
            ? `/issues/${issueToLoad.id}?bypassCache=true`
            : `/issues/${issueToLoad.id}`;
          const response = await apiClient.get(endpoint);

          if (!response.success || !response.data?.issue) {
            throw new Error(response.error || "No issue data returned");
          }

          const details = response.data.issue;

          // Concise logging (removed verbose sub-issues data)
          console.log(
            "[IssueDetailModal] Loaded:",
            details?.identifier,
            "| Sub-issues:",
            (details as any)?.subIssues?.length || 0
          );

          // CRITICAL: Ensure subIssues is always an array
          if (details) {
            if (!(details as any).subIssues) {
              (details as any).subIssues = [];
            }
          }

          setIssueDetails(details);

          // Restore scroll position after data load (if saved)
          const currentScrollPos = savedScrollPosition;
          if (currentScrollPos > 0) {
            setTimeout(() => {
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = currentScrollPos;
                console.log("[Scroll] Restored to position:", currentScrollPos);
              }
            }, 100); // Small delay to ensure DOM is ready
          }

          return details; // Return loaded details
        } catch (error) {
          console.error(
            "[IssueDetailModal] Failed to load issue details:",
            error
          );
          // Fallback to basic issue data
          setIssueDetails(issueToLoad);
          return issueToLoad; // Return fallback
        } finally {
          setLoading(false);
          // Clear loading tracking
          loadingIssueIdRef.current = null;
          loadIssuePromiseRef.current = null;
        }
      })();

      loadIssuePromiseRef.current = loadPromise;
      return loadPromise;
    },
    []
  ); // STABLE - No dependencies!

  // Initialize navigation when modal opens
  // CRITICAL FIX: Use ref to prevent double execution
  const isInitializedRef = React.useRef(false);
  const lastIssueIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    // Only run when modal opens OR issue ID changes (new issue selected)
    if (isOpen && issue?.id) {
      // Check if this is actually a NEW issue (prevent duplicate loads)
      const isNewIssue = lastIssueIdRef.current !== issue.id;

      if (!isNewIssue && isInitializedRef.current) {
        // Same issue, already initialized - skip to prevent reload
        console.log(
          "[IssueDetailModal] Already loaded:",
          issue.identifier,
          "- skipping reload"
        );
        return;
      }

      console.log(
        "[IssueDetailModal] Opening:",
        issue.identifier,
        isNewIssue ? "(new issue)" : "(first open)"
      );

      isInitializedRef.current = true;
      lastIssueIdRef.current = issue.id;

      // CRITICAL FIX: Clear old data and show loading IMMEDIATELY
      // This prevents flash of old issue content when switching
      setIssueDetails(null); // Clear FIRST - before setting loading
      setLoading(true); // Then show skeleton

      // Reset navigation stack and state
      setNavigationStack([]);
      setCurrentIssue(issue);
      setIsApproving(false);

      // CRITICAL: Pass issue explicitly to stable callback
      // SAFETY: Extra validation before calling (redundant but defensive)
      if (issue && issue.id) {
        loadIssueDetails(issue);
      }
      // Load team config for issue creation
      loadTeamConfig();
    } else if (!isOpen) {
      // CRITICAL: Clean up when modal closes
      if (isInitializedRef.current) {
        console.log("[IssueDetailModal] Closing - cleanup");
      }

      isInitializedRef.current = false;
      lastIssueIdRef.current = null;
      loadingIssueIdRef.current = null;
      loadIssuePromiseRef.current = null;
      setNavigationStack([]);
      setCurrentIssue(null);
      setIssueDetails(null);
      setTeamConfig(null);
      setIsApproving(false);
      setIsPartialApproving(false);
      setSavedScrollPosition(0);
    }
  }, [isOpen, issue?.id, loadIssueDetails, loadTeamConfig]); // Explicit dependencies

  // Navigate to sub-issue
  const handleNavigateToSubIssue = useCallback(
    async (subIssue: any) => {
      console.log("[Navigation] Navigating to sub-issue:", subIssue.identifier);

      // CRITICAL FIX: Save FULL parent issue details (including subIssues array)
      // Use issueDetails if available (has full data), otherwise use issue
      const parentToSave = issueDetails || currentIssue || issue;

      if (!parentToSave) {
        console.error("[Navigation] No parent issue to save");
        return;
      }

      console.log("[Navigation] Saving parent to stack:", {
        identifier: parentToSave.identifier,
        hasSubIssues: !!(parentToSave as any).subIssues,
        subIssuesCount: (parentToSave as any).subIssues?.length || 0,
      });

      // Add parent issue to navigation stack
      setNavigationStack((prev) => [...prev, parentToSave]);

      // CRITICAL FIX: Clear old issue data immediately to prevent stale data flash
      setIssueDetails(null);
      setLoading(true);

      // Set new current issue
      setCurrentIssue(subIssue);

      // Load sub-issue details using shared function
      try {
        // SAFETY: Validate sub-issue before loading
        if (subIssue && subIssue.id) {
          await loadIssueDetails(subIssue);
          console.log(
            "[Navigation] Sub-issue details loaded:",
            subIssue.identifier
          );
        } else {
          throw new Error("Invalid sub-issue data");
        }
      } catch (error) {
        console.error("[Navigation] Failed to load sub-issue:", error);
        toast.error("Failed to load sub-issue details");
        // Revert navigation on error
        setNavigationStack((prev) => prev.slice(0, -1));
        setCurrentIssue(navigationStack[navigationStack.length - 1] || issue);
        setIssueDetails(parentToSave); // Restore parent data
        setLoading(false);
      }
    },
    [issueDetails, navigationStack, issue, loadIssueDetails]
  );

  // Navigate back to parent
  const handleNavigateBack = useCallback(() => {
    console.log(
      "[Navigation] Navigating back, stack length:",
      navigationStack.length
    );

    if (navigationStack.length > 0) {
      // Pop from stack and restore parent
      const parentIssue = navigationStack[navigationStack.length - 1];

      console.log("[Navigation] Restoring parent from stack:", {
        identifier: parentIssue.identifier,
        hasSubIssues: !!(parentIssue as any).subIssues,
        subIssuesCount: (parentIssue as any).subIssues?.length || 0,
        subIssuesData: (parentIssue as any).subIssues?.map(
          (s: any) => s.identifier
        ),
      });

      // Update navigation stack
      setNavigationStack((prev) => prev.slice(0, -1));

      // CRITICAL: Restore parent issue with FULL data
      setCurrentIssue(parentIssue);
      setIssueDetails(parentIssue); // This has subIssues array!

      console.log("[Navigation] Returned to parent:", parentIssue.identifier);
    }
  }, [navigationStack]);

  // Approve sub-issue - change status to "Client Review" with optimistic update
  const handleApproveSubIssue = useCallback(
    async (subIssue: any) => {
      const approveToastId = toast.loading(
        `Approving ${subIssue.identifier}...`
      );

      // Store original state for rollback if needed
      const originalIssueDetails = issueDetails;

      try {
        console.log("[Approve] Approving sub-issue:", subIssue.identifier);

        // LIGHTWEIGHT: Get "Client Review" state ID directly (no full config needed!)
        // Get teamId from PARENT issue (sub-issues don't have team property)
        const teamId = (issueDetails || issue)?.team?.id;
        if (!teamId) {
          console.error("[Approve] Team ID not found in parent issue");
          toast.error("Team information missing", {
            id: approveToastId,
          });
          return;
        }

        console.log(
          `[Approve] Fetching "Client Review" state ID for team ${teamId}...`
        );

        // Use secure token storage (validates expiry automatically)
        const accessToken = apiClient.getAccessToken();
        if (!accessToken) {
          console.error("[Approve] No access token found or expired");
          toast.error("Authentication required. Please sign in again.", {
            id: approveToastId,
          });
          return;
        }

        const response = await apiClient.get(
          `/linear/teams/${teamId}/state-by-name?name=Release Ready`
        );

        if (!response.success || !response.data?.stateId) {
          console.error(
            "[Approve] Failed to get Release Ready state:",
            response.error
          );
          toast.error(response.error || "Release Ready state not found", {
            id: approveToastId,
          });
          return;
        }

        const releaseReadyStateId = result.data.stateId;
        const releaseReadyStateName = result.data.stateName || "Release Ready";
        console.log(
          "[Approve] Got Release Ready state ID:",
          releaseReadyStateId
        );

        // OPTIMISTIC UPDATE: Update UI immediately before API call
        if (issueDetails && (issueDetails as any).subIssues) {
          const updatedSubIssues = (issueDetails as any).subIssues.map(
            (si: any) => {
              if (si.id === subIssue.id) {
                return {
                  ...si,
                  state: {
                    ...si.state,
                    id: releaseReadyStateId,
                    name: releaseReadyStateName,
                    type: "completed", // Release Ready is typically 'completed' type
                  },
                  _optimisticUpdate: true, // Mark for UI indication
                };
              }
              return si;
            }
          );

          setIssueDetails({
            ...issueDetails,
            subIssues: updatedSubIssues,
          } as any);

          console.log("[Approve] Optimistic UI update applied");
        }

        // Update issue state via API
        await LinearMutations.updateIssueState(
          subIssue.id,
          releaseReadyStateId
        );

        toast.success(
          `${subIssue.identifier} approved and moved to Release Ready`,
          { id: approveToastId }
        );

        // CRITICAL: Wait for Linear API to propagate changes
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Save current scroll position before refresh
        if (scrollContainerRef.current) {
          const currentScroll = scrollContainerRef.current.scrollTop;
          setSavedScrollPosition(currentScroll);
          console.log("[Approve] Saved scroll position:", currentScroll);
        }

        const issueToLoad = currentIssue || issue;
        if (issueToLoad?.id) {
          try {
            console.log(
              "[Approve] Refreshing parent issue details:",
              issueToLoad.identifier
            );
            setIsRefreshing(true); // Show subtle loading indicator

            // CRITICAL: Use bypassCache=true to get fresh data from Linear API
            const refreshedDetails = await loadIssueDetails(issueToLoad, true);

            // Update parent via callback with fresh data
            if (onIssueUpdate && refreshedDetails) {
              console.log(
                "[Approve] Calling onIssueUpdate with refreshed parent data"
              );
              onIssueUpdate(refreshedDetails);
            }
          } catch (refreshError) {
            console.error(
              "[Approve] Failed to refresh issue data:",
              refreshError
            );
          } finally {
            setIsRefreshing(false);
          }
        }

        // Clear team cache for consistency
        try {
          LinearQueries.invalidateIssues(teamId);
        } catch (err) {
          console.warn("[Approve] Cache invalidation failed:", err);
        }
      } catch (error) {
        console.error("[Approve] Failed:", error);
        toast.error(`Failed to approve ${subIssue.identifier}`, {
          id: approveToastId,
        });

        // Rollback optimistic update on error
        if (originalIssueDetails) {
          setIssueDetails(originalIssueDetails);
        }
      }
    },
    [issueDetails, currentIssue, issue, loadIssueDetails, onIssueUpdate]
  );

  // Handle image paste for Request Changes editor
  const handleRequestChangesImagePaste = useCallback(
    async (file: File) => {
      if (!requestChangesEditor) return;

      setIsUploadingRequestChangesImage(true);
      try {
        const targetIssue = issueDetails || currentIssue || issue;
        if (!targetIssue) {
          throw new Error("No issue selected");
        }

        console.log("[Request Changes] Uploading pasted image:", file.name);

        // Upload to Linear
        const result = await LinearMutations.uploadFilesToIssue(
          targetIssue.id,
          [file]
        );

        if (result?.attachments?.[0]?.url) {
          const imageUrl = result.attachments[0].url;
          console.log("[Request Changes] Image uploaded:", imageUrl);

          // Insert image node (not markdown text) for preview
          requestChangesEditor
            .chain()
            .focus()
            .setImage({
              src: imageUrl,
              alt: file.name,
            })
            .run();

          toast.success("Image uploaded successfully");
        } else {
          throw new Error("No URL returned from upload");
        }
      } catch (error) {
        console.error("[Request Changes] Image paste failed:", error);
        toast.error("Failed to upload image");
      } finally {
        setIsUploadingRequestChangesImage(false);
      }
    },
    [requestChangesEditor, issueDetails, currentIssue, issue]
  );

  // Handle file selection for Request Changes
  const handleRequestChangesFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      const maxSize = 10 * 1024 * 1024; // 10MB
      const validFiles = files.filter((file) => {
        if (file.size > maxSize) {
          toast.error(`${file.name} is too large (max 10MB)`);
          return false;
        }
        return true;
      });

      setRequestChangesFiles((prev) => [...prev, ...validFiles]);
      e.target.value = ""; // Reset input
    },
    []
  );

  // Handle remove file for Request Changes
  const handleRemoveRequestChangesFile = useCallback((index: number) => {
    setRequestChangesFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Request Changes for sub-issue - Add comment and move to Canceled state
  const handleRequestChanges = useCallback(async () => {
    if (!requestChangesSubIssue || !requestChangesEditor) {
      toast.error("Please provide a comment");
      return;
    }

    // Get content from editor
    const htmlContent = requestChangesEditor.getHTML();
    const textContent = requestChangesEditor.getText();

    // Check if editor has images (even without text)
    const hasImages = htmlContent.includes("<img");

    if (!textContent.trim() && requestChangesFiles.length === 0 && !hasImages) {
      toast.error("Please provide a comment, paste images, or attach files");
      return;
    }

    setIsRequestingChanges(true);
    const toastId = toast.loading(
      `Requesting changes for ${requestChangesSubIssue.identifier}...`
    );

    try {
      const teamId = (issueDetails || issue)?.team?.id;
      if (!teamId) {
        toast.error("Team information missing", {
          id: toastId,
        });
        return;
      }

      const accessToken = apiClient.getAccessToken();
      if (!accessToken) {
        toast.error("Authentication required. Please sign in again.", {
          id: toastId,
        });
        setIsRequestingChanges(false);
        return;
      }

      // Convert HTML to Markdown
      let commentMarkdown = turndownService.turndown(htmlContent);

      // Upload attached files first and append to comment
      if (requestChangesFiles.length > 0) {
        console.log(
          "[Request Changes] Uploading attached files:",
          requestChangesFiles.length
        );

        try {
          const uploadResult = await LinearMutations.uploadFilesToIssue(
            requestChangesSubIssue.id,
            requestChangesFiles
          );

          // Append file links to comment markdown
          if (uploadResult?.attachments?.length > 0) {
            const fileLinks = uploadResult.attachments
              .map((att: any) => {
                const fileName = att.title || att.filename || "Attachment";
                const fileUrl = att.url;

                // Check if it's an image
                const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(
                  fileName
                );

                if (isImage) {
                  return `![${fileName}](${fileUrl})`;
                } else {
                  return `[${fileName}](${fileUrl})`;
                }
              })
              .join("\n");

            // Append to markdown
            if (commentMarkdown.trim()) {
              commentMarkdown += "\n\n" + fileLinks;
            } else {
              commentMarkdown = fileLinks;
            }

            console.log(
              "[Request Changes] Files uploaded and added to comment"
            );
          }
        } catch (uploadError) {
          console.error("[Request Changes] File upload failed:", uploadError);
          toast.error("Failed to upload attachments", {
            id: toastId,
          });
          setIsRequestingChanges(false);
          return;
        }
      }

      // Step 1: Add comment with [external] prefix
      await LinearMutations.addCommentToIssue(
        requestChangesSubIssue.id,
        `[external] ${commentMarkdown}`
      );

      // Step 2: Add "UAT Request Changes" label (if exists)
      try {
        const teamConfigResponse = await apiClient.get(
          `/linear/teams/${teamId}/config`
        );

        const teamConfig = teamConfigResponse;
        const labels = teamConfig?.data?.labels || [];

        // Find "UAT Request Changes" label (case-insensitive)
        let requestChangesLabel = labels.find(
          (label: any) => label.name.toLowerCase() === "uat request changes"
        );

        // Create label if it doesn't exist
        if (!requestChangesLabel) {
          console.log(
            '[Request Changes] Label not found, creating "UAT Request Changes" label'
          );
          const newLabel = await LinearMutations.createLabel({
            teamId: teamId,
            name: "UAT Request Changes",
            color: "#FF6B6B", // Orange-red color
            description: "Client requested changes during UAT review",
          });
          requestChangesLabel = newLabel;
          console.log(
            "[Request Changes] Label created successfully:",
            newLabel
          );
        }

        if (requestChangesLabel) {
          await LinearMutations.addLabel(
            requestChangesSubIssue.id,
            requestChangesLabel.id
          );
        }
      } catch (labelError) {
        console.error("[Request Changes] Failed to add label:", labelError);
        // Continue anyway - comment is more important
      }

      // Step 3: Success - NO state change
      toast.success(
        `Changes requested for ${requestChangesSubIssue.identifier}`,
        { id: toastId }
      );

      // Close dialog and reset
      setRequestChangesSubIssue(null);
      setRequestChangesFiles([]);
      if (requestChangesEditor) {
        requestChangesEditor.commands.setContent("");
      }

      // Refresh issue details - same pattern as Approve
      const issueToLoad = currentIssue || issue;
      if (issueToLoad) {
        try {
          const cacheKey = `linear:issue-detail:issueId:${issueToLoad.id}`;
          if (localStorage.getItem(cacheKey)) {
            localStorage.removeItem(cacheKey);
          }

          const details = await LinearQueries.getIssueDetails(
            issueToLoad.id,
            true
          );
          if (details) {
            if (!(details as any).subIssues) {
              (details as any).subIssues = [];
            }
            setIssueDetails(details);
          }
        } catch (refreshError) {
          console.error("[Request Changes] Refresh failed:", refreshError);
        }
      }

      // Trigger global refresh
      window.dispatchEvent(
        new CustomEvent("linear-issue-updated", {
          detail: {
            issueId: requestChangesSubIssue.id,
            teamId,
            action: "request-changes",
          },
        })
      );
    } catch (error) {
      console.error("[Request Changes] Failed:", error);
      toast.error(`Failed to request changes`, { id: toastId });
    } finally {
      setIsRequestingChanges(false);
    }
  }, [
    requestChangesSubIssue,
    requestChangesEditor,
    requestChangesFiles,
    issueDetails,
    issue,
    currentIssue,
  ]);

  // Approve main issue - change status to "Release Ready"
  const handleApproveMainIssue = useCallback(async () => {
    setIsApproving(true);
    const approveToastId = toast.loading("Approving issue...");

    try {
      const targetIssue = issueDetails || issue;
      if (!targetIssue) {
        toast.error("No issue to approve", {
          id: approveToastId,
        });
        setIsApproving(false);
        return;
      }

      console.log("[Approve Main] Approving issue:", targetIssue.identifier);

      // LIGHTWEIGHT: Get "Release Ready" state ID directly
      const teamId = targetIssue.team?.id;
      if (!teamId) {
        console.error("[Approve Main] Team ID not found");
        toast.error("Team information missing", {
          id: approveToastId,
        });
        setIsApproving(false);
        return;
      }

      console.log(
        `[Approve Main] Fetching "Release Ready" state ID for team ${teamId}...`
      );

      // Use secure token storage (validates expiry automatically)
      const accessToken = apiClient.getAccessToken();
      if (!accessToken) {
        console.error("[Approve Main] No access token found or expired");
        toast.error("Authentication required. Please sign in again.", {
          id: approveToastId,
        });
        setIsApproving(false);
        return;
      }

      const response = await apiClient.get(
        `/linear/teams/${teamId}/state-by-name?name=Release Ready`
      );

      const result = response;

      if (!result.success || !result.data?.stateId) {
        console.error(
          "[Approve Main] Failed to get Release Ready state:",
          result.error
        );
        toast.error(result.error || "Release Ready state not found", {
          id: approveToastId,
        });
        setIsApproving(false);
        return;
      }

      const releaseReadyStateId = result.data.stateId;
      console.log("[Approve Main] Got state ID:", releaseReadyStateId);

      // Update issue state
      await LinearMutations.updateIssueState(
        targetIssue.id,
        releaseReadyStateId
      );

      toast.success(
        `${targetIssue.identifier} approved and moved to Release Ready`,
        { id: approveToastId }
      );

      // CRITICAL: Wait for Linear API to propagate changes
      await new Promise((resolve) => setTimeout(resolve, 500));

      // CRITICAL: Dispatch event FIRST to trigger Kanban board reload
      // This ensures the board starts refreshing while modal also refreshes
      console.log("[Approve Main] Dispatching linear-issue-updated event");
      window.dispatchEvent(
        new CustomEvent("linear-issue-updated", {
          detail: {
            issueId: targetIssue.id,
            teamId: targetIssue.team?.id,
            action: "approve",
            newState: "Release Ready",
          },
        })
      );

      // CRITICAL FIX: Refresh using loadIssueDetails to get fresh data
      // This ensures consistency with modal's fetch mechanism
      const issueToLoad = currentIssue || issue;
      if (issueToLoad) {
        try {
          console.log(
            "[Approve Main] Refreshing issue details:",
            issueToLoad.identifier
          );

          // CRITICAL: Use bypassCache=true to get fresh data from Linear API
          // This ensures the modal shows the updated state after approve
          const refreshedDetails = await loadIssueDetails(issueToLoad, true);

          // Notify parent component immediately with fresh data
          if (onIssueUpdate && refreshedDetails) {
            console.log(
              "[Approve Main] Calling onIssueUpdate with refreshed data"
            );
            onIssueUpdate(refreshedDetails);
          }
        } catch (refreshError) {
          console.error("[Approve Main] Refresh failed:", refreshError);
        }
      }
    } catch (error) {
      console.error("[Approve Main] Failed:", error);
      toast.error("Failed to approve issue", {
        id: approveToastId,
      });
    } finally {
      setIsApproving(false);
    }
  }, [issueDetails, currentIssue, issue, onIssueUpdate, loadIssueDetails]);

  // Partial Approve main issue - mark as partial approved and move unfinished sub-tasks to next cycle
  const handlePartialApproveMainIssue = useCallback(async () => {
    setIsPartialApproving(true);
    const partialApproveToastId = toast.loading("Partially approving issue...");

    try {
      const targetIssue = issueDetails || issue;
      if (!targetIssue) {
        toast.error("No issue to partially approve", {
          id: partialApproveToastId,
        });
        setIsPartialApproving(false);
        return;
      }

      const teamId = targetIssue.team?.id;
      if (!teamId) {
        console.error("[Partial Approve] Team ID not found");
        toast.error("Team information missing", {
          id: partialApproveToastId,
        });
        setIsPartialApproving(false);
        return;
      }

      const subIssues = (targetIssue as any).subIssues || [];

      console.log(
        "[Partial Approve] Partially approving issue:",
        targetIssue.identifier
      );

      const result = await LinearMutations.partialApproveIssue({
        issueId: targetIssue.id,
        teamId: teamId,
        subIssues: subIssues,
      });

      if (result.success) {
        toast.success(result.message, {
          id: partialApproveToastId,
        });

        // OPTIMIZED: Refresh only modal internal state, let parent listen to event
        const issueToLoad = currentIssue || issue;
        if (issueToLoad) {
          try {
            console.log(
              "[Partial Approve] Refreshing modal internal state:",
              issueToLoad.identifier
            );
            setIsRefreshing(true); // Show subtle loading indicator

            // CRITICAL: Use bypassCache=true to get fresh data from Linear API
            const refreshedDetails = await loadIssueDetails(issueToLoad, true);

            // Trigger global event for parent components to refresh independently
            console.log(
              "[Partial Approve] Dispatching linear-issue-updated event"
            );
            window.dispatchEvent(
              new CustomEvent("linear-issue-updated", {
                detail: {
                  issueId: targetIssue.id,
                  teamId: teamId,
                  action: "partial-approve",
                },
              })
            );

            // OPTIONAL: Call onIssueUpdate if provided (for legacy support)
            // Parent can choose to listen to event instead
            if (onIssueUpdate && refreshedDetails) {
              console.log(
                "[Partial Approve] Calling onIssueUpdate with refreshed data"
              );
              onIssueUpdate(refreshedDetails);
            }
          } catch (refreshError) {
            console.error("[Partial Approve] Refresh failed:", refreshError);
          } finally {
            setIsRefreshing(false);
          }
        }
      } else {
        toast.error("Failed to partially approve issue", {
          id: partialApproveToastId,
        });
      }
    } catch (error) {
      console.error("[Partial Approve] Failed:", error);
      toast.error("Failed to partially approve issue", {
        id: partialApproveToastId,
      });
    } finally {
      setIsPartialApproving(false);
    }
  }, [issueDetails, currentIssue, issue, onIssueUpdate, loadIssueDetails]);

  // Load detailed issue data when current issue changes
  useEffect(() => {
    if (isOpen && currentIssue && currentIssue.id !== issueDetails?.id) {
      loadIssueDetails(currentIssue); // CRITICAL: Pass currentIssue explicitly
    }
  }, [isOpen, currentIssue, issueDetails?.id, loadIssueDetails]);

  // Enhanced keyboard navigation with back support
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen) return;

      // ESC or Backspace to go back (when viewing sub-issue)
      if (
        (event.key === "Escape" || event.key === "Backspace") &&
        navigationStack.length > 0
      ) {
        event.preventDefault();
        event.stopPropagation();
        handleNavigateBack();
        return;
      }

      // Ctrl/Cmd + O to open in Linear
      if (event.key === "o" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        const currentIssueUrl = (currentIssue || issue)?.url;
        if (currentIssueUrl) {
          window.open(currentIssueUrl, "_blank");
        }
      }
    },
    [isOpen, issue, currentIssue, navigationStack, handleNavigateBack]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Listen for comments toggle events from admin (only if not forced)
  useEffect(() => {
    if (forceEnableComments) {
      setCommentsEnabled(true); // Always enabled for Tasks board
      return;
    }

    const handleCommentsToggle = (event: CustomEvent) => {
      setCommentsEnabled(event.detail.enabled);
    };

    window.addEventListener(
      "teifi_comments_toggle",
      handleCommentsToggle as EventListener
    );
    return () => {
      window.removeEventListener(
        "teifi_comments_toggle",
        handleCommentsToggle as EventListener
      );
    };
  }, [forceEnableComments]);

  // Handle creating sub-issue
  const handleCreateSubIssue = async () => {
    if (!issueDetails || !newSubIssueTitle.trim()) {
      toast.error("Please enter a title for the sub-issue");
      return;
    }

    try {
      setIsCreatingSubIssue(true);

      // Create sub-issue with parent reference
      const result = await LinearMutations.createSubIssue(
        issueDetails.id,
        newSubIssueTitle,
        newSubIssueDescription || undefined
      );

      // Upload files if any selected
      if (selectedFiles.length > 0 && result?.id) {
        setUploadingFiles(true);
        toast.info(`Uploading ${selectedFiles.length} file(s)...`);

        try {
          const uploadResult = await LinearMutations.uploadFilesToIssue(
            result.id,
            selectedFiles
          );

          toast.success(
            `Sub-issue created with ${selectedFiles.length} attachment(s)!`
          );
        } catch (uploadError) {
          console.error("[IssueDetailModal] Upload failed:", uploadError);
          toast.warning("Sub-issue created but file upload failed");
        } finally {
          setUploadingFiles(false);
        }
      } else {
        toast.success(`Sub-issue ${result?.identifier} created successfully`);
      }

      // Reset form
      setNewSubIssueTitle("");
      setNewSubIssueDescription("");
      setSelectedFiles([]);
      setShowSubIssueDialog(false);

      // CRITICAL: Clear cache before reloading
      console.log("[IssueDetailModal] Invalidating issue detail cache");
      // Invalidate cache
      import("../services/linearCacheService").then(({ linearCache }) => {
        linearCache.invalidate(
          `linear:issue-detail:issueId:${issueDetails.id}`
        );
      });

      // Trigger board reload to fetch fresh data including new sub-issue
      console.log("[IssueDetailModal] Dispatching sub-issue-created event");
      window.dispatchEvent(
        new CustomEvent("linear-issue-updated", {
          detail: {
            issueId: issueDetails.id,
            teamId: issueDetails.team?.id,
            action: "sub-issue-created",
          },
        })
      );

      // Board will auto-refresh and update modal via event listener
      toast.success("Board refreshing to show new sub-issue...");
    } catch (error) {
      console.error("[IssueDetailModal] Failed to create sub-issue:", error);
      toast.error("Failed to create sub-issue");
    } finally {
      setIsCreatingSubIssue(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    console.log("[IssueDetailModal] Files selected:", {
      count: files.length,
      files: files.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
      })),
    });

    // Validate file sizes (max 10MB per file)
    const maxSize = 10 * 1024 * 1024;
    const validFiles = files.filter((file) => {
      if (file.size > maxSize) {
        console.error(
          `[IssueDetailModal] File too large: ${file.name} (${file.size} bytes)`
        );
        toast.error(`File "${file.name}" is too large (max 10MB)`);
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...validFiles]);
      toast.success(`${validFiles.length} file(s) selected`);
    }

    // Reset input
    e.target.value = "";
  };

  const getPriorityColor = (priority?: number) => {
    switch (priority) {
      case 4:
        return "bg-red-500";
      case 3:
        return "bg-orange-500";
      case 2:
        return "bg-yellow-500";
      case 1:
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const getPriorityLabel = (priority?: number, priorityLabel?: string) => {
    if (priorityLabel) return priorityLabel;

    switch (priority) {
      case 4:
        return "Urgent";
      case 3:
        return "High";
      case 2:
        return "Medium";
      case 1:
        return "Low";
      default:
        return "None";
    }
  };

  const getStateIcon = (stateType: string) => {
    switch (stateType) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "canceled":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "started":
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Viewport stability: Lock scroll when modal opens
  React.useEffect(() => {
    if (isOpen) {
      lockScroll();
    } else {
      unlockScroll();
    }

    return () => {
      unlockScroll(); // Cleanup on unmount
    };
  }, [isOpen, lockScroll, unlockScroll]);

  const displayIssue = useMemo(() => {
    // CRITICAL: During loading or when switching issues, show nothing
    // This prevents flash of old issue data when switching between issues
    if (loading) {
      return null;
    }

    // Only show issueDetails if available (loaded from API)
    // Never fallback to issue prop during transitions
    return issueDetails;
  }, [issueDetails, loading]);

  if (!issue) return null;

  // CRITICAL: If displayIssue is null (during initial load), show loading skeleton
  // This prevents showing stale data from previous issue
  if (!displayIssue) {
    return (
      <Dialog key={`loading-${issue.id}`} open={isOpen} onOpenChange={onClose}>
        <DialogContent className="issue-modal !max-w-4xl !w-[92vw] !h-[88vh] !p-0 !gap-0 !flex !flex-col">
          <DialogHeader className="flex-shrink-0 p-6 pb-4 border-b bg-background">
            <DialogTitle className="text-xl">Loading...</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="px-6 py-6">
                <IssueDetailSkeleton />
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog key={issue.id} open={isOpen} onOpenChange={onClose}>
        <DialogContent className="issue-modal !max-w-4xl !w-[92vw] !h-[88vh] !p-0 !gap-0 !flex !flex-col">
          {/* Fixed Header with Breadcrumb Navigation */}
          <DialogHeader className="flex-shrink-0 p-6 pb-4 border-b bg-background relative">
            {/* Subtle refresh indicator - moved left to not overlap close button */}
            {isRefreshing && (
              <div className="absolute top-2 right-20 z-10">
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Updating...
                </div>
              </div>
            )}

            {/* ACCESSIBILITY: DialogTitle must come first for screen readers */}
            <DialogTitle className="sr-only">
              {displayIssue.identifier}: {displayIssue.title}
            </DialogTitle>

            {/* Hidden description for accessibility */}
            <DialogDescription className="sr-only">
              {displayIssue.title} - {displayIssue.state.name}
            </DialogDescription>

            {/*Breadcrumb Navigation - Show when viewing sub-issue */}
            {navigationStack.length > 0 && (
              <div className="mb-4 flex flex-col md:flex-row md:items-center gap-2 text-sm sub-issue-breadcrumb">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNavigateBack}
                  className="h-8 gap-2 hover:bg-primary/10 hover:text-primary transition-colors w-full md:w-auto justify-start back-to-parent-btn"
                >
                  <ChevronRight className="h-4 w-4 rotate-180" />
                  Back to Parent Issue
                </Button>
                <Separator
                  orientation="vertical"
                  className="h-4 hidden md:block"
                />
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="text-xs font-medium truncate max-w-[200px]">
                    {navigationStack[0].identifier}
                  </span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-xs font-medium text-foreground">
                    {displayIssue.identifier}
                  </span>
                </div>
              </div>
            )}

            {/* Issue Header - OPTIMIZED UX: Compact single-row layout */}
            <div className="space-y-2.5">
              {/* Row 1: Title + Metadata + Action Buttons (all in one for efficiency) */}
              <div className="flex items-start justify-between gap-4 sub-issue-header-row">
                <div className="flex-1 min-w-0">
                  {/* Title - Left-aligned for F-pattern reading */}
                  <h2
                    className="leading-tight mb-2 sub-issue-title"
                    aria-hidden="true"
                  >
                    {displayIssue.title}
                  </h2>

                  {/* Metadata Row - Compact badges inline with title */}
                </div>

                {/* Action Buttons - Top right */}
                <div className="flex-shrink-0">
                  {(() => {
                    // Sub-Issue Actions (when viewing sub-issue from parent)
                    if (navigationStack.length > 0 && showAcceptanceIssues) {
                      const stateName =
                        displayIssue.state?.name?.toLowerCase() || "";
                      const stateType =
                        displayIssue.state?.type?.toLowerCase() || "";

                      // CRITICAL: State-aware button logic based on Linear workflow

                      // 1. Shipped/Completed - NO ACTIONS (read-only)
                      if (
                        stateType === "completed" ||
                        stateName.includes("shipped")
                      ) {
                        return (
                          <div className="flex-shrink-0">
                            <Badge
                              variant="outline"
                              className="text-sm px-3 py-1.5 border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
                            >
                              <CheckCircle className="h-4 w-4 mr-1.5" />
                              Completed
                            </Badge>
                          </div>
                        );
                      }

                      // 2. Canceled - Show REOPEN button
                      if (
                        stateType === "canceled" ||
                        stateName.includes("canceled")
                      ) {
                        return (
                          <div className="flex-shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 px-4 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950 dark:hover:text-blue-400"
                              onClick={async (e) => {
                                e.stopPropagation();
                                toast.info("Reopen functionality coming soon");
                              }}
                            >
                              <AlertTriangle className="h-4 w-4 mr-2" />
                              Reopen for Retest
                            </Button>
                          </div>
                        );
                      }

                      // 3. Blocked - Show Request Changes (disabled)
                      if (
                        stateName.includes("blocked") ||
                        stateName.includes("waiting")
                      ) {
                        return (
                          <div className="flex-shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled
                              className="h-9 px-4 opacity-50 cursor-not-allowed"
                            >
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Request Changes
                            </Button>
                          </div>
                        );
                      }

                      // 4. QA / In Progress / Internal states - NO BUTTONS
                      if (
                        stateName.includes("qa") ||
                        stateName.includes("in progress") ||
                        stateName.includes("code review") ||
                        stateName.includes("development")
                      ) {
                        return (
                          <div className="flex-shrink-0">
                            <Badge
                              variant="secondary"
                              className="text-sm px-3 py-1.5"
                            >
                              Internal testing
                            </Badge>
                          </div>
                        );
                      }

                      // 5. Release Ready - ONLY Request Changes
                      if (
                        stateName.includes("release ready") ||
                        stateName.includes("ready for release")
                      ) {
                        return (
                          <div className="flex-shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 px-4 hover:bg-orange-50 hover:text-orange-700 dark:hover:bg-orange-950 dark:hover:text-orange-400"
                              onClick={() => {
                                setRequestChangesSubIssue(displayIssue as any);
                              }}
                            >
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Request Changes
                            </Button>
                          </div>
                        );
                      }

                      // 6. Client Review / Triage - Show BOTH buttons (active UAT phase)
                      if (
                        stateName.includes("client review") ||
                        stateName.includes("triage") ||
                        stateType === "unstarted"
                      ) {
                        return (
                          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                            <Button
                              variant="default"
                              size="sm"
                              className="h-9 px-4 bg-green-600 hover:bg-green-700 text-white shadow-sm"
                              onClick={async () => {
                                await handleApproveSubIssue(
                                  displayIssue as any
                                );
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 px-4 hover:bg-orange-50 hover:text-orange-700 dark:hover:bg-orange-950 dark:hover:text-orange-400"
                              onClick={() => {
                                setRequestChangesSubIssue(displayIssue as any);
                              }}
                            >
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Request Changes
                            </Button>
                          </div>
                        );
                      }

                      // 7. Default fallback - Show both buttons
                      return (
                        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                          <Button
                            variant="default"
                            size="sm"
                            className="h-9 px-4 bg-green-600 hover:bg-green-700 text-white shadow-sm"
                            onClick={async () => {
                              await handleApproveSubIssue(displayIssue as any);
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 px-4 hover:bg-orange-50 hover:text-orange-700 dark:hover:bg-orange-950 dark:hover:text-orange-400"
                            onClick={() => {
                              setRequestChangesSubIssue(displayIssue as any);
                            }}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Request Changes
                          </Button>
                        </div>
                      );
                    }

                    // Parent Issue Approve Button
                    // CRITICAL: Approve = Move to "Release Ready" state
                    // Business Rule: ALL children must be in "Release Ready" to approve parent
                    if (
                      displayIssue.state?.name !== "Release Ready" &&
                      navigationStack.length === 0
                    ) {
                      const subIssues = (displayIssue as any).subIssues || [];
                      const hasSubIssues = subIssues.length > 0;

                      // Check how many children are NOT ready for release
                      const notReadyInfo = hasSubIssues
                        ? getChildrenNotReadyForRelease(displayIssue)
                        : { count: 0, identifiers: [] };

                      // Determine button state based on business rules
                      let buttonState: "enabled" | "disabled" | "hidden" =
                        "hidden";
                      let tooltipText = "";

                      if (!hasSubIssues) {
                        // No sub-issues: Show Approve button as enabled
                        buttonState = "enabled";
                        tooltipText = "Approve this issue";
                      } else if (notReadyInfo.count === 0) {
                        // All children in "Release Ready": Enable Approve button
                        buttonState = "enabled";
                        tooltipText = "All sub-tasks ready for release";
                      } else {
                        // Some children NOT in "Release Ready": Disable button
                        buttonState = "disabled";
                        tooltipText = `${notReadyInfo.count} sub-task${
                          notReadyInfo.count > 1 ? "s" : ""
                        } not ready for release yet`;
                      }

                      if (buttonState === "hidden") return null;

                      // Show Partial Approve button if there are incomplete sub-issues
                      const showPartialApprove =
                        hasSubIssues && notReadyInfo.count > 0;
                      const completedCount = hasSubIssues
                        ? subIssues.length - notReadyInfo.count
                        : 0;

                      return (
                        <TooltipProvider>
                          <div className="flex flex-wrap items-center gap-2">
                            {showPartialApprove && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9 px-3 sm:px-4 border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700 dark:border-orange-600 dark:text-orange-400 dark:hover:bg-orange-950 dark:hover:text-orange-300 font-medium transition-all"
                                    onClick={handlePartialApproveMainIssue}
                                    disabled={isPartialApproving || isApproving}
                                  >
                                    {isPartialApproving ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-1 sm:mr-2 animate-spin" />
                                        <span className="hidden xs:inline">
                                          Partial Approving...
                                        </span>
                                        <span className="xs:hidden">
                                          Approving...
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle className="h-4 w-4 mr-1 sm:mr-2" />
                                        <span className="hidden xs:inline">
                                          Partial Approve
                                        </span>
                                        <span className="xs:hidden">
                                          Partial
                                        </span>
                                      </>
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-sm p-4">
                                  <p className="text-sm font-medium mb-2">
                                    Mark issue as partially approved
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Keep {completedCount} completed sub-task
                                    {completedCount > 1 ? "s" : ""} and move{" "}
                                    {notReadyInfo.count} unfinished task
                                    {notReadyInfo.count > 1 ? "s" : ""} to the
                                    next cycle
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-2 italic">
                                    Maintains parent-child relationships for
                                    traceability
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="h-9 px-4 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all"
                                  onClick={handleApproveMainIssue}
                                  disabled={
                                    buttonState === "disabled" ||
                                    isApproving ||
                                    isPartialApproving
                                  }
                                >
                                  {isApproving ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Approving...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Approve
                                    </>
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm p-3">
                                <p className="text-sm font-medium">
                                  {tooltipText}
                                </p>
                                {buttonState === "disabled" && (
                                  <p className="text-xs text-muted-foreground mt-2">
                                    All sub-tasks must be in Release Ready state
                                  </p>
                                )}
                              </TooltipContent>
                            </Tooltip>

                            {/* More Actions Dropdown - Admin only, inline with Approve */}
                            {isAdminOrSuperAdmin && (
                              <DropdownMenu>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-9 px-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                      >
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-sm">More actions</p>
                                  </TooltipContent>
                                </Tooltip>
                                <DropdownMenuContent
                                  align="end"
                                  className="w-48"
                                >
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                                    onClick={() => initiateDelete(displayIssue)}
                                    disabled={isDeleting}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete{" "}
                                    {(displayIssue as any).subIssues?.length > 0
                                      ? "group task"
                                      : "issue"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </TooltipProvider>
                      );
                    }

                    return null;
                  })()}
                </div>
              </div>
            </div>
          </DialogHeader>
          <div className="flex items-center gap-1.5 overflow-x-auto sub-issue-metadata">
            {/* Issue ID */}
            <Badge
              variant="outline"
              className="text-xs font-mono whitespace-nowrap"
            >
              {displayIssue.identifier}
            </Badge>

            {/* State Badge with Icon */}
            <div className="flex items-center gap-1 whitespace-nowrap">
              {getStateIcon(displayIssue.state.type)}
              <Badge variant="secondary" className="text-xs">
                {displayIssue.state.name}
              </Badge>
            </div>

            {/* Priority Badge */}
            {displayIssue.priority !== undefined && (
              <Badge
                className={`text-xs whitespace-nowrap ${getPriorityColor(
                  displayIssue.priority
                )} text-white`}
              >
                {getPriorityLabel(
                  displayIssue.priority,
                  displayIssue.priorityLabel
                )}
              </Badge>
            )}

            {/* Sub-issue indicator */}
            {navigationStack.length > 0 && (
              <Badge
                variant="outline"
                className="text-xs bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-400"
              >
                <GitBranch className="h-3 w-3 mr-1" />
                Sub-Issue
              </Badge>
            )}

            {/* Linear External Link (admin only) */}
            {isAdminOrSuperAdmin && displayIssue.url && (
              <a
                href={displayIssue.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                title="Open in Linear"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          {/* Scrollable Content - OPTIMIZED: Tighter spacing */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div ref={scrollContainerRef} className="px-4 py-4">
                {loading ? (
                  <IssueDetailSkeleton />
                ) : (
                  <div className="space-y-4">
                    {/* Editable Description with Paste Image Support */}
                    <EditableDescription
                      description={displayIssue.description}
                      issueId={displayIssue.id}
                      onUpdate={(newDescription) => {
                        // Update local state
                        setIssueDetails({
                          ...displayIssue,
                          description: newDescription,
                        } as LinearIssue);

                        // Invalidate cache
                        import("../services/linearCacheService").then(
                          ({ linearCache }) => {
                            linearCache.invalidate(
                              `linear:issue-detail:issueId:${displayIssue.id}`
                            );
                          }
                        );

                        // Trigger refresh
                        if (onIssueUpdate) {
                          onIssueUpdate({
                            ...displayIssue,
                            description: newDescription,
                          } as LinearIssue);
                        }
                      }}
                    />

                    {/* Issue Details - Single Column with Collapsible Sections */}
                    <div className="space-y-3">
                      {/* Task Details - Collapsible */}
                      <Collapsible defaultOpen={false}>
                        <div className="border border-border/50 rounded-lg bg-muted/20">
                          <CollapsibleTrigger className="w-full flex items-center justify-between p-3 hover:bg-muted/40 transition-colors">
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-4 bg-accent rounded-full"></div>
                              <h4 className="text-sm font-semibold text-foreground">
                                Task Details
                              </h4>
                            </div>
                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-3 pb-3 pt-1">
                              {/* Important dates and info only - NO staff info */}
                              <div className="space-y-2.5">
                                {!displayIssue.completedAt &&
                                !displayIssue.dueDate &&
                                !displayIssue.estimate ? (
                                  <div className="p-3 bg-muted/30 rounded-lg border border-dashed border-border">
                                    <p className="text-sm text-muted-foreground text-center">
                                      No task details available
                                    </p>
                                  </div>
                                ) : (
                                  <>
                                    {displayIssue.completedAt && (
                                      <div className="flex items-center gap-2.5 p-2.5 bg-green-50/50 dark:bg-green-900/10 rounded-lg border border-green-200/50 dark:border-green-800/30">
                                        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                                            Completed
                                          </p>
                                          <p className="text-sm text-foreground truncate">
                                            {formatDate(
                                              displayIssue.completedAt
                                            )}
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                    {displayIssue.dueDate && (
                                      <div className="flex items-center gap-2.5 p-2.5 bg-orange-50/50 dark:bg-orange-900/10 rounded-lg border border-orange-200/50 dark:border-orange-800/30">
                                        <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs text-orange-700 dark:text-orange-400 font-medium">
                                            Due Date
                                          </p>
                                          <p className="text-sm text-foreground truncate">
                                            {formatDate(displayIssue.dueDate)}
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                    {displayIssue.estimate && (
                                      <div className="flex items-center gap-2.5 p-2.5 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-200/50 dark:border-blue-800/30">
                                        <Hash className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">
                                            Time Estimate
                                          </p>
                                          <p className="text-sm text-foreground">
                                            {displayIssue.estimate} hours
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>

                      {/* Additional Information - Collapsible */}
                      <Collapsible defaultOpen={false}>
                        <div className="border border-border/50 rounded-lg bg-muted/20">
                          <CollapsibleTrigger className="w-full flex items-center justify-between p-3 hover:bg-muted/40 transition-colors">
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-4 bg-accent rounded-full"></div>
                              <h4 className="text-sm font-semibold text-foreground">
                                Additional Information
                              </h4>
                            </div>
                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-3 pb-3 pt-1 space-y-3">
                              {/* Project */}
                              {displayIssue.project && (
                                <div className="p-3 bg-muted/20 rounded-md border border-border/50">
                                  <div className="flex items-center gap-2">
                                    <div className="text-xl">
                                      {displayIssue.project.icon || "📋"}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs text-muted-foreground">
                                        Project
                                      </p>
                                      <p className="text-sm font-medium text-foreground truncate">
                                        {displayIssue.project.name}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Labels */}
                              {displayIssue.labels?.nodes &&
                                displayIssue.labels.nodes.length > 0 && (
                                  <div className="p-3 bg-muted/20 rounded-lg border border-border/50">
                                    <div className="flex items-center gap-2 mb-3">
                                      <Tag className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-xs font-medium text-foreground tracking-wide">
                                        Labels
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {displayIssue.labels.nodes.map(
                                        (label) => (
                                          <Badge
                                            key={label.id}
                                            variant="outline"
                                            className="text-xs px-2.5 py-1 font-medium shadow-sm"
                                            style={{
                                              borderColor: label.color,
                                              color: label.color,
                                              backgroundColor: `${label.color}15`,
                                            }}
                                          >
                                            {label.name}
                                          </Badge>
                                        )
                                      )}
                                    </div>
                                  </div>
                                )}

                              {/* Attachments */}
                              {displayIssue.attachments?.nodes &&
                                displayIssue.attachments.nodes.length > 0 && (
                                  <div className="p-3 bg-muted/20 rounded-lg border border-border/50">
                                    <div className="flex items-center gap-2 mb-3">
                                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-xs font-medium text-foreground tracking-wide">
                                        Attachments
                                      </span>
                                    </div>
                                    <div className="space-y-2">
                                      {displayIssue.attachments.nodes.map(
                                        (attachment) => (
                                          <a
                                            key={attachment.id}
                                            href={attachment.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 p-2.5 bg-card rounded-md hover:bg-accent/50 transition-all border border-border hover:border-primary/50 group shadow-sm"
                                          >
                                            <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0 transition-colors" />
                                            <span className="text-sm text-foreground group-hover:text-primary transition-colors truncate font-medium">
                                              {attachment.title}
                                            </span>
                                          </a>
                                        )
                                      )}
                                    </div>
                                  </div>
                                )}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    </div>

                    {/*Acceptance Issues Section - Professional Table Design */}
                    {/*Acceptance Issues - Only show if enabled */}

                    {showAcceptanceIssues &&
                      (displayIssue as any).subIssues &&
                      (displayIssue as any).subIssues.length > 0 &&
                      (() => {
                        const subIssues = (displayIssue as any).subIssues;
                        const completedCount = subIssues.filter(
                          (sub: any) => sub.state?.type === "completed"
                        ).length;
                        const inProgressCount = subIssues.filter(
                          (sub: any) => sub.state?.type === "started"
                        ).length;
                        const totalCount = subIssues.length;
                        const percentage = Math.round(
                          (completedCount / totalCount) * 100
                        );

                        return (
                          <div className="border-t pt-6">
                            {/* Header with Stats */}
                            <div className="px-6 flex items-center justify-between mb-5">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
                                  <GitBranch className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-base text-foreground">
                                    Acceptance Issues
                                  </h4>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {totalCount}{" "}
                                    {totalCount === 1 ? "task" : "tasks"} •{" "}
                                    {completedCount} completed
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="text-xs px-2.5 py-1 border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
                                >
                                  <CheckCircle className="h-3 w-3 mr-1.5" />
                                  {completedCount} Done
                                </Badge>
                                {inProgressCount > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs px-2.5 py-1 border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400"
                                  >
                                    <Clock className="h-3 w-3 mr-1.5" />
                                    {inProgressCount} In Progress
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Compact Progress Bar */}
                            <div className="mx-6 mb-5 p-3.5 bg-gradient-to-r from-muted/40 to-muted/20 rounded-lg border border-border/50">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-muted-foreground">
                                  Overall Progress
                                </span>
                                <span className="text-sm font-semibold text-primary">
                                  {percentage}%
                                </span>
                              </div>
                              <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-accent transition-all duration-500 ease-out rounded-full"
                                  style={{
                                    width: `${percentage}%`,
                                  }}
                                />
                              </div>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-muted-foreground">
                                  {completedCount} of {totalCount} completed
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {totalCount - completedCount} remaining
                                </span>
                              </div>
                            </div>

                            {/* Warning: Unapproved Children - Parent Cannot Be Moved */}
                            {(() => {
                              const allApproved =
                                areAllChildrenApproved(displayIssue);

                              // CRITICAL: Use workflow approval status (not release-ready status)
                              // For workflow lock message, we check if children are in "Client Review"
                              const subIssues =
                                (displayIssue as any).subIssues || [];
                              const unapprovedForWorkflow = subIssues.filter(
                                (subIssue: any) => {
                                  const stateName = subIssue.state?.name;
                                  const stateType = subIssue.state?.type;
                                  // Not approved for workflow = not in Client Review and not completed
                                  return !(
                                    stateName === "Client Review" ||
                                    stateType === "completed"
                                  );
                                }
                              );
                              const unapproved = {
                                count: unapprovedForWorkflow.length,
                                identifiers: unapprovedForWorkflow.map(
                                  (si: any) => si.identifier
                                ),
                              };

                              if (!allApproved && unapproved.count > 0) {
                                return (
                                  <div className="mx-6 mb-5 p-3 bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/20 dark:to-orange-900/10 border border-orange-300 dark:border-orange-800 rounded-lg shadow-sm">
                                    <div className="flex items-start gap-2.5">
                                      <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2 mb-1.5">
                                          <h5 className="text-sm font-semibold text-orange-900 dark:text-orange-200">
                                            Locked
                                          </h5>
                                          <span className="text-xs text-orange-700 dark:text-orange-300">
                                            Awaiting {unapproved.count} approval
                                            {unapproved.count > 1 ? "s" : ""}
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                          {unapproved.identifiers
                                            .slice(0, 5)
                                            .map((id) => {
                                              const subIssue =
                                                issue.children?.nodes.find(
                                                  (si: any) =>
                                                    si.identifier === id
                                                );
                                              return (
                                                <Badge
                                                  key={id}
                                                  variant="outline"
                                                  className="text-xs font-mono border-orange-400 dark:border-orange-600 bg-white dark:bg-orange-950/50 text-orange-900 dark:text-orange-200 hover:bg-orange-200 dark:hover:bg-orange-900/70 transition-colors cursor-pointer"
                                                  onClick={() => {
                                                    if (subIssue) {
                                                      setSelectedIssue(
                                                        subIssue
                                                      );
                                                      setParentIssueChain([
                                                        ...parentIssueChain,
                                                        issue,
                                                      ]);
                                                    }
                                                  }}
                                                >
                                                  {id}
                                                </Badge>
                                              );
                                            })}
                                          {unapproved.count > 5 && (
                                            <span className="text-xs text-orange-600 dark:text-orange-400 font-medium self-center">
                                              +{unapproved.count - 5}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}

                            {/* Professional Table - Redesigned with Content-First Layout */}
                            <div className="border-t border-border bg-card">
                              <table className="w-full table-fixed">
                                <tbody className="divide-y divide-border">
                                  {subIssues.map(
                                    (subIssue: any, index: number) => (
                                      <tr
                                        key={subIssue.id}
                                        className="group hover:bg-muted/30 transition-colors"
                                      >
                                        {/* ID + Title Column */}
                                        <td
                                          className="px-4 py-3.5 cursor-pointer"
                                          style={{ width: "40%" }}
                                          onClick={() =>
                                            handleNavigateToSubIssue(subIssue)
                                          }
                                        >
                                          <div className="flex items-center gap-2.5">
                                            {/* ID Badge */}
                                            <Badge
                                              variant="outline"
                                              className="text-xs font-mono font-semibold border-border/60 bg-muted/30 hover:border-primary/50 transition-colors flex-shrink-0"
                                            >
                                              {subIssue.identifier}
                                            </Badge>

                                            {/* Chevron Icon */}
                                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors" />

                                            {/* Title */}
                                            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                                              {subIssue.title}
                                            </span>

                                            {/* Linear Link - Admin only */}
                                            {isAdminOrSuperAdmin && (
                                              <a
                                                href={subIssue.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) =>
                                                  e.stopPropagation()
                                                }
                                                className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 ml-auto"
                                                title="Open in Linear"
                                              >
                                                <ExternalLink className="h-3.5 w-3.5" />
                                              </a>
                                            )}
                                          </div>
                                        </td>

                                        {/* Status Column */}
                                        <td
                                          className="px-4 py-3.5"
                                          style={{ width: "20%" }}
                                        >
                                          {subIssue.state ? (
                                            <Badge
                                              variant="secondary"
                                              className={`text-xs font-medium px-2.5 py-1 whitespace-nowrap inline-flex items-center ${
                                                subIssue._optimisticUpdate
                                                  ? "animate-pulse border-2 border-dashed"
                                                  : ""
                                              }`}
                                              style={{
                                                backgroundColor: `${subIssue.state.color}15`,
                                                color: subIssue.state.color,
                                                borderColor: `${subIssue.state.color}30`,
                                              }}
                                            >
                                              {subIssue._optimisticUpdate && (
                                                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                              )}
                                              {!subIssue._optimisticUpdate &&
                                                subIssue.state.type ===
                                                  "completed" && (
                                                  <CheckCircle className="h-3 w-3 mr-1.5" />
                                                )}
                                              {!subIssue._optimisticUpdate &&
                                                subIssue.state.type ===
                                                  "started" && (
                                                  <Clock className="h-3 w-3 mr-1.5" />
                                                )}
                                              {subIssue.state.name}
                                            </Badge>
                                          ) : (
                                            <span className="text-xs text-muted-foreground">
                                              —
                                            </span>
                                          )}
                                        </td>

                                        {/* Actions Column */}
                                        <td
                                          className="px-4 py-3.5"
                                          style={{ width: "40%" }}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <div className="flex items-center justify-end gap-2">
                                            {(() => {
                                              const stateName =
                                                subIssue.state?.name?.toLowerCase() ||
                                                "";
                                              const stateType =
                                                subIssue.state?.type?.toLowerCase() ||
                                                "";

                                              // CRITICAL: State-aware button logic based on Linear workflow

                                              // 1. Shipped/Completed - NO ACTIONS (read-only)
                                              if (
                                                stateType === "completed" ||
                                                stateName.includes("shipped")
                                              ) {
                                                return (
                                                  <Badge
                                                    variant="outline"
                                                    className="text-xs px-2.5 py-0.5 border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400 whitespace-nowrap"
                                                  >
                                                    <CheckCircle className="h-3 w-3 mr-1" />
                                                    Completed
                                                  </Badge>
                                                );
                                              }

                                              // 2. Canceled - Show REOPEN button
                                              if (
                                                stateType === "canceled" ||
                                                stateName.includes("canceled")
                                              ) {
                                                return (
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 px-2.5 text-xs hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950 dark:hover:text-blue-400 transition-all whitespace-nowrap"
                                                    onClick={async (e) => {
                                                      e.stopPropagation();
                                                      // TODO: Implement reopen logic - move to "Client Review" state
                                                      toast.info(
                                                        "Reopen functionality coming soon"
                                                      );
                                                    }}
                                                  >
                                                    <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                                                    Reopen for Retest
                                                  </Button>
                                                );
                                              }

                                              // 3. Blocked - Show Request Changes (disabled)
                                              if (
                                                stateName.includes("blocked") ||
                                                stateName.includes("waiting")
                                              ) {
                                                return (
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled
                                                    className="!h-7 !px-2 !py-0 text-xs opacity-50 cursor-not-allowed whitespace-nowrap"
                                                  >
                                                    <MessageSquare className="h-3.5 w-3.5 mr-1" />
                                                    Request Changes
                                                  </Button>
                                                );
                                              }

                                              // 4. QA / In Progress / Internal states - NO BUTTONS (hidden from client)
                                              if (
                                                stateName.includes("qa") ||
                                                stateName.includes(
                                                  "in progress"
                                                ) ||
                                                stateName.includes(
                                                  "code review"
                                                ) ||
                                                stateName.includes(
                                                  "development"
                                                )
                                              ) {
                                                return (
                                                  <span className="text-xs text-muted-foreground italic">
                                                    Internal testing
                                                  </span>
                                                );
                                              }

                                              // 5. Release Ready - ONLY Request Changes (allow regression testing)
                                              if (
                                                stateName.includes(
                                                  "release ready"
                                                ) ||
                                                stateName.includes(
                                                  "ready for release"
                                                )
                                              ) {
                                                return (
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="!h-7 !px-2 !py-0 text-xs hover:bg-orange-50 hover:text-orange-700 dark:hover:bg-orange-950 dark:hover:text-orange-400 transition-all whitespace-nowrap"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setRequestChangesSubIssue(
                                                        subIssue
                                                      );
                                                    }}
                                                  >
                                                    <MessageSquare className="h-3.5 w-3.5 mr-1" />
                                                    Request Changes
                                                  </Button>
                                                );
                                              }

                                              // 6. Client Review / Triage - Show BOTH buttons (active UAT phase)
                                              if (
                                                stateName.includes(
                                                  "client review"
                                                ) ||
                                                stateName.includes("triage") ||
                                                stateType === "unstarted"
                                              ) {
                                                return (
                                                  <>
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      className="!h-7 !px-2 !py-0 text-xs hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950 dark:hover:text-green-400 transition-all whitespace-nowrap"
                                                      onClick={async (e) => {
                                                        e.stopPropagation();
                                                        await handleApproveSubIssue(
                                                          subIssue
                                                        );
                                                      }}
                                                    >
                                                      <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                                      Approve
                                                    </Button>
                                                    <Button
                                                      variant="outline"
                                                      size="sm"
                                                      className="!h-7 !px-2 !py-0 text-xs border-border hover:bg-orange-50 hover:text-orange-700 hover:border-orange-300 dark:hover:bg-orange-950 dark:hover:text-orange-400 transition-all whitespace-nowrap"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setRequestChangesSubIssue(
                                                          subIssue
                                                        );
                                                      }}
                                                    >
                                                      <MessageSquare className="h-3.5 w-3.5 mr-1" />
                                                      Request Changes
                                                    </Button>
                                                  </>
                                                );
                                              }

                                              // 7. Default fallback - Show both buttons for unknown states
                                              return (
                                                <>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="!h-7 !px-2 !py-0 text-xs hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950 dark:hover:text-green-400 transition-all whitespace-nowrap"
                                                    onClick={async (e) => {
                                                      e.stopPropagation();
                                                      await handleApproveSubIssue(
                                                        subIssue
                                                      );
                                                    }}
                                                  >
                                                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                                    Approve
                                                  </Button>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="!h-7 !px-2 !py-0 text-xs hover:bg-orange-50 hover:text-orange-700 dark:hover:bg-orange-950 dark:hover:text-orange-400 transition-all whitespace-nowrap"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setRequestChangesSubIssue(
                                                        subIssue
                                                      );
                                                    }}
                                                  >
                                                    <MessageSquare className="h-3.5 w-3.5 mr-1" />
                                                    Request Changes
                                                  </Button>
                                                </>
                                              );
                                            })()}

                                            {/* Delete Button - Admin only, shown on hover */}
                                            {isAdminOrSuperAdmin && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 ml-1"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  initiateDelete(subIssue);
                                                }}
                                                title={`Delete ${subIssue.identifier}`}
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </Button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    )
                                  )}
                                </tbody>
                              </table>
                            </div>

                            {/* Add New Task Button - Only show in "Client Review" state */}
                            {displayIssue.state?.name === "Client Review" && (
                              <div className="mx-6 mt-4">
                                <Button
                                  variant="outline"
                                  className="w-full border-dashed border-border/70 hover:border-primary hover:bg-primary/5 transition-all"
                                  onClick={() => setShowSubIssueDialog(true)}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add new task
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                    {/* 🆕 Add Sub-Issue Button (when no acceptance issues exist) - Only show if enabled AND in "Client Review" state */}
                    {showAcceptanceIssues &&
                      (!(displayIssue as any).subIssues ||
                        (displayIssue as any).subIssues.length === 0) &&
                      displayIssue.state?.name === "Client Review" && (
                        <div className="border-t pt-6">
                          <div className="flex items-center gap-3 mb-4">
                            <GitBranch className="h-5 w-5 text-muted-foreground" />
                            <h4 className="font-semibold text-base">
                              Acceptance Issues
                            </h4>
                          </div>
                          <div className="p-8 bg-muted/20 rounded-lg border-2 border-dashed border-border text-center">
                            <p className="text-sm text-muted-foreground mb-4">
                              No acceptance issues yet. Break down this issue
                              into smaller tasks.
                            </p>
                            <Button
                              variant="outline"
                              className="border-dashed hover:border-primary hover:bg-primary/5 transition-colors"
                              onClick={() => setShowSubIssueDialog(true)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add new task
                            </Button>
                          </div>
                        </div>
                      )}

                    {/* Comments Section - Only show if enabled by admin */}
                    {commentsEnabled &&
                      (() => {
                        //Filter to only show [external] comments (client portal comments)
                        const allComments = displayIssue.comments?.nodes || [];

                        const externalComments = allComments.filter(
                          (comment: any) => {
                            const body = comment.body || "";

                            const normalizedBody = body
                              .replace(/\\/g, "") //REMOVE ALL BACKSLASHES (handles \[external\])
                              .trim() // Remove leading/trailing whitespace
                              .replace(/^[\s\n\r\t]+/, "") // Remove any remaining leading whitespace/newlines
                              .replace(/^\uFEFF/, "") // Remove BOM if present
                              .toLowerCase(); //CASE-INSENSITIVE

                            const isExternal =
                              normalizedBody.startsWith("[external]");

                            return isExternal;
                          }
                        );

                        return (
                          <div className="border-t pt-6">
                            <div className="flex items-center gap-3 mb-6">
                              <MessageSquare className="h-5 w-5 text-muted-foreground" />
                              <h4 className="font-semibold text-base">
                                Comments ({externalComments.length})
                              </h4>
                            </div>

                            {/* Existing Comments - Filtered to [external] only */}
                            {externalComments.length > 0 && (
                              <div className="space-y-4 mb-8">
                                {externalComments.map((comment: any) => {
                                  // Strip [external] prefix for display
                                  const cleanBody =
                                    LinearHelpers.stripExternalPrefix(
                                      comment.body || ""
                                    );

                                  // Extract Portal Metadata to get real user info
                                  // CRITICAL: Single Linear API key means comment.user = API key owner
                                  // Real portal user is in [Portal Metadata] footer
                                  const portalMetadata =
                                    LinearHelpers.extractPortalMetadata(
                                      comment.body || ""
                                    );

                                  console.log(
                                    "[IssueDetailModal] Comment metadata:",
                                    {
                                      hasMetadata: !!portalMetadata,
                                      linearUser: comment.user?.name,
                                      portalUser: portalMetadata?.userName,
                                      commentId: comment.id,
                                    }
                                  );

                                  // Use Portal user if metadata exists, otherwise fallback to Linear API user
                                  const displayName = portalMetadata
                                    ? portalMetadata.userName
                                    : comment.user?.name || "Unknown User";

                                  const displayTime = portalMetadata
                                    ? portalMetadata.timestamp
                                    : formatDate(comment.createdAt);

                                  const displayInitials = portalMetadata
                                    ? portalMetadata.userInitials
                                    : comment.user?.name
                                        ?.substring(0, 2)
                                        .toUpperCase() || "?";

                                  // CRITICAL: If Portal Metadata exists, DON'T use Linear avatar
                                  // Portal users aren't Linear users, so only show initials
                                  const displayAvatarUrl = portalMetadata
                                    ? undefined
                                    : comment.user?.avatarUrl;

                                  return (
                                    <Card
                                      key={comment.id}
                                      className="shadow-sm border-border/50"
                                    >
                                      <CardContent className="!p-3">
                                        <div className="flex items-start gap-2.5">
                                          <Avatar className="h-7 w-7 flex-shrink-0">
                                            <AvatarImage
                                              src={displayAvatarUrl}
                                            />
                                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                              {displayInitials}
                                            </AvatarFallback>
                                          </Avatar>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className="text-sm font-medium text-foreground">
                                                {displayName}
                                              </span>
                                              <span className="text-xs text-muted-foreground">
                                                {displayTime}
                                              </span>
                                            </div>
                                            <div className="prose prose-sm max-w-none text-sm">
                                              <MarkdownRenderer
                                                content={cleanBody}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  );
                                })}
                              </div>
                            )}

                            {/* Add New Comment - Tiptap WYSIWYG Editor */}
                            <div className="space-y-2">
                              <Label htmlFor="comment-editor">
                                Add a comment
                              </Label>

                              {/*Formatting Toolbar */}
                              <div className="flex items-center gap-1 p-2 border border-border rounded-t-lg bg-muted/30">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    commentEditor
                                      ?.chain()
                                      .focus()
                                      .toggleBold()
                                      .run()
                                  }
                                  disabled={
                                    !commentEditor ||
                                    isAddingComment ||
                                    isUploadingImage
                                  }
                                  className={`h-8 w-8 p-0 ${
                                    commentEditor?.isActive("bold")
                                      ? "bg-primary/10 text-primary"
                                      : ""
                                  }`}
                                  title="Bold"
                                >
                                  <Bold className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    commentEditor
                                      ?.chain()
                                      .focus()
                                      .toggleItalic()
                                      .run()
                                  }
                                  disabled={
                                    !commentEditor ||
                                    isAddingComment ||
                                    isUploadingImage
                                  }
                                  className={`h-8 w-8 p-0 ${
                                    commentEditor?.isActive("italic")
                                      ? "bg-primary/10 text-primary"
                                      : ""
                                  }`}
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
                                    commentEditor
                                      ?.chain()
                                      .focus()
                                      .toggleHeading({
                                        level: 2,
                                      })
                                      .run()
                                  }
                                  disabled={
                                    !commentEditor ||
                                    isAddingComment ||
                                    isUploadingImage
                                  }
                                  className={`h-8 w-8 p-0 ${
                                    commentEditor?.isActive("heading", {
                                      level: 2,
                                    })
                                      ? "bg-primary/10 text-primary"
                                      : ""
                                  }`}
                                  title="Heading"
                                >
                                  <Heading2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    commentEditor
                                      ?.chain()
                                      .focus()
                                      .toggleBulletList()
                                      .run()
                                  }
                                  disabled={
                                    !commentEditor ||
                                    isAddingComment ||
                                    isUploadingImage
                                  }
                                  className={`h-8 w-8 p-0 ${
                                    commentEditor?.isActive("bulletList")
                                      ? "bg-primary/10 text-primary"
                                      : ""
                                  }`}
                                  title="Bullet List"
                                >
                                  <List className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    commentEditor
                                      ?.chain()
                                      .focus()
                                      .toggleOrderedList()
                                      .run()
                                  }
                                  disabled={
                                    !commentEditor ||
                                    isAddingComment ||
                                    isUploadingImage
                                  }
                                  className={`h-8 w-8 p-0 ${
                                    commentEditor?.isActive("orderedList")
                                      ? "bg-primary/10 text-primary"
                                      : ""
                                  }`}
                                  title="Numbered List"
                                >
                                  <ListOrdered className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    commentEditor
                                      ?.chain()
                                      .focus()
                                      .toggleCodeBlock()
                                      .run()
                                  }
                                  disabled={
                                    !commentEditor ||
                                    isAddingComment ||
                                    isUploadingImage
                                  }
                                  className={`h-8 w-8 p-0 ${
                                    commentEditor?.isActive("codeBlock")
                                      ? "bg-primary/10 text-primary"
                                      : ""
                                  }`}
                                  title="Code Block"
                                >
                                  <Code className="h-4 w-4" />
                                </Button>

                                {/* Spacer */}
                                <div className="flex-1" />

                                {/* Submit Button */}
                                <Button
                                  onClick={handleAddComment}
                                  disabled={isAddingComment || isUploadingImage}
                                  size="sm"
                                  className="h-8"
                                >
                                  {(isAddingComment || isUploadingImage) && (
                                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                  )}
                                  {isAddingComment
                                    ? "Adding..."
                                    : isUploadingImage
                                    ? "Uploading..."
                                    : "Comment"}
                                </Button>
                              </div>

                              {/*WYSIWYG Editor */}
                              <div className="border border-t-0 border-border rounded-b-lg bg-background overflow-hidden">
                                {commentEditor ? (
                                  <EditorContent editor={commentEditor} />
                                ) : (
                                  <div className="min-h-[120px] p-4 flex items-center justify-center text-muted-foreground">
                                    Loading editor...
                                  </div>
                                )}
                              </div>

                              {/* Image Upload Indicator */}
                              {isUploadingImage && (
                                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg mt-2">
                                  <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                                  <span className="text-sm text-blue-700 dark:text-blue-300">
                                    Uploading image...
                                  </span>
                                </div>
                              )}

                              {/* File Attachments */}
                              {attachedFiles.length > 0 && (
                                <div className="space-y-2.5 mt-3">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground">
                                      Attachments ({attachedFiles.length})
                                    </Label>
                                    {attachedFiles.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          for (
                                            let i = attachedFiles.length - 1;
                                            i >= 0;
                                            i--
                                          ) {
                                            handleRemoveFile(i);
                                          }
                                        }}
                                        disabled={isAddingComment}
                                        className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                                      >
                                        Clear all
                                      </button>
                                    )}
                                  </div>

                                  {/* Grid layout for multiple files */}
                                  <div
                                    className={`grid gap-2 ${
                                      attachedFiles.length === 1
                                        ? "grid-cols-1"
                                        : attachedFiles.length === 2
                                        ? "grid-cols-2"
                                        : "grid-cols-2 md:grid-cols-3"
                                    }`}
                                  >
                                    {attachedFiles.map((file, index) => {
                                      const isImage =
                                        file.type.startsWith("image/");
                                      const isPdf =
                                        file.type === "application/pdf";
                                      const fileUrl = URL.createObjectURL(file);

                                      return (
                                        <div
                                          key={index}
                                          className="group relative flex flex-col gap-2 p-2.5 bg-muted/30 hover:bg-muted/50 rounded-lg border border-border transition-colors"
                                        >
                                          {/* File preview or icon */}
                                          <div className="relative aspect-video w-full bg-muted rounded overflow-hidden flex items-center justify-center">
                                            {isImage ? (
                                              <img
                                                src={fileUrl}
                                                alt={file.name}
                                                className="w-full h-full object-cover"
                                                onLoad={() =>
                                                  URL.revokeObjectURL(fileUrl)
                                                }
                                              />
                                            ) : (
                                              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                {isPdf ? (
                                                  <FileText className="h-8 w-8" />
                                                ) : (
                                                  <File className="h-8 w-8" />
                                                )}
                                                <span className="text-xs px-2 py-0.5 bg-background rounded">
                                                  {file.name
                                                    .split(".")
                                                    .pop()
                                                    ?.toUpperCase()}
                                                </span>
                                              </div>
                                            )}

                                            {/* Remove button overlay */}
                                            <Button
                                              type="button"
                                              variant="destructive"
                                              size="sm"
                                              onClick={() =>
                                                handleRemoveFile(index)
                                              }
                                              disabled={isAddingComment}
                                              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                              <X className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>

                                          {/* File info */}
                                          <div className="min-w-0">
                                            <p
                                              className="text-xs font-medium truncate"
                                              title={file.name}
                                            >
                                              {file.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              {file.size < 1024 * 1024
                                                ? `${(file.size / 1024).toFixed(
                                                    1
                                                  )} KB`
                                                : `${(
                                                    file.size /
                                                    (1024 * 1024)
                                                  ).toFixed(2)} MB`}
                                            </p>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* File Upload Button */}
                              <div className="mt-3">
                                <input
                                  type="file"
                                  id="comment-file-upload-input"
                                  className="hidden"
                                  multiple
                                  accept="image/*,.pdf,.doc,.docx,.txt"
                                  onChange={handleCommentFileSelect}
                                  disabled={isAddingComment || isUploadingImage}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    document
                                      .getElementById(
                                        "comment-file-upload-input"
                                      )
                                      ?.click()
                                  }
                                  disabled={isAddingComment || isUploadingImage}
                                  className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                                >
                                  <Paperclip className="h-4 w-4" />
                                  <span>
                                    {attachedFiles.length > 0
                                      ? "Add more files"
                                      : "Attach files"}
                                  </span>
                                  <span className="ml-auto text-xs">
                                    Images, PDFs, Docs
                                  </span>
                                </Button>
                              </div>

                              <div className="flex items-start gap-2 mt-3 p-2.5 bg-muted/30 rounded-lg border border-border">
                                <div className="flex-shrink-0 mt-0.5">
                                  <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                                    <ImageIcon className="h-3 w-3 text-primary" />
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-foreground">
                                    Quick image insert
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Paste images directly with{" "}
                                    <kbd className="px-1 py-0.5 text-xs bg-muted rounded">
                                      Cmd+V
                                    </kbd>{" "}
                                    or{" "}
                                    <kbd className="px-1 py-0.5 text-xs bg-muted rounded">
                                      Ctrl+V
                                    </kbd>
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmation && (
        <DeleteConfirmationDialog
          open={!!deleteConfirmation}
          identifier={deleteConfirmation.identifier}
          title={deleteConfirmation.title}
          isParent={deleteConfirmation.isParent}
          childrenCount={deleteConfirmation.childrenCount}
          isDeleting={isDeleting}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}

      {/* Professional Issue Creation Template */}
      <IssueCreationTemplate
        isOpen={showSubIssueDialog}
        onClose={() => {
          setShowSubIssueDialog(false);
          setNewSubIssueTitle("");
          setNewSubIssueDescription("");
          setSelectedFiles([]);
        }}
        onSubmit={async (issueData) => {
          try {
            setIsCreatingSubIssue(true);

            console.log("[IssueDetailModal] Creating sub-issue:", issueData);

            const result = await LinearMutations.createSubIssue(
              issueDetails.id,
              issueData.title,
              issueData.description,
              issueData.priority,
              issueData.stateId,
              issueData.assigneeId
            );

            if (issueData.files && issueData.files.length > 0 && result?.id) {
              setUploadingFiles(true);
              toast.info(`Uploading ${issueData.files.length} file(s)...`);

              try {
                await LinearMutations.uploadFilesToIssue(
                  result.id,
                  issueData.files
                );
                toast.success(
                  `Sub-issue created with ${issueData.files.length} attachment(s)!`
                );
              } catch (uploadError) {
                console.error("Upload failed:", uploadError);
                toast.warning("Sub-issue created but file upload failed");
              } finally {
                setUploadingFiles(false);
              }
            } else {
              toast.success(
                `Sub-issue ${result?.identifier} created successfully`
              );
            }

            setNewSubIssueTitle("");
            setNewSubIssueDescription("");
            setSelectedFiles([]);
            setShowSubIssueDialog(false);

            // CRITICAL: Invalidate cache before reloading
            import("../services/linearCacheService").then(({ linearCache }) => {
              linearCache.invalidate(
                `linear:issue-detail:issueId:${issueDetails.id}`
              );
            });

            // CRITICAL FIX: Dispatch event to trigger board reload
            // This ensures sub-issue count updates on parent issue
            console.log(
              "[IssueDetailModal] Dispatching sub-issue-created event"
            );
            window.dispatchEvent(
              new CustomEvent("linear-issue-updated", {
                detail: {
                  issueId: issueDetails.id,
                  teamId: issueDetails.team?.id,
                  action: "sub-issue-created",
                },
              })
            );

            // Reload modal with fresh data (board will also reload via event listener)
            // CRITICAL: Use bypassCache=true after creating sub-issue
            const issueToReload = issueDetails || currentIssue || issue;
            if (issueToReload) {
              setTimeout(async () => {
                await loadIssueDetails(issueToReload, true);
              }, 100);
            }
          } catch (error) {
            console.error(
              "[IssueDetailModal] Failed to create sub-issue:",
              error
            );
            toast.error("Failed to create sub-issue");
            throw error;
          } finally {
            setIsCreatingSubIssue(false);
          }
        }}
        teamId={displayIssue.team?.id}
        workflowStates={teamConfig?.states?.nodes || []}
        teamMembers={teamConfig?.members?.nodes || []}
      />

      {/*Request Changes Dialog */}
      <Dialog
        open={!!requestChangesSubIssue}
        onOpenChange={(open) => {
          if (!open) {
            setRequestChangesSubIssue(null);
            setRequestChangesFiles([]);
            setRequestChangesHasContent(false);
            if (requestChangesEditor) {
              requestChangesEditor.commands.setContent("");
            }
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Request Changes - {requestChangesSubIssue?.identifier}
            </DialogTitle>
            <DialogDescription>
              Add a comment describing what changes are needed for this
              acceptance issue.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Comment</Label>

              {/* Formatting Toolbar */}
              <div className="flex items-center gap-1 p-2 border border-border rounded-t-lg bg-muted/30">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    requestChangesEditor?.chain().focus().toggleBold().run()
                  }
                  disabled={
                    !requestChangesEditor ||
                    isRequestingChanges ||
                    isUploadingRequestChangesImage
                  }
                  className={`h-8 w-8 p-0 ${
                    requestChangesEditor?.isActive("bold")
                      ? "bg-primary/10 text-primary"
                      : ""
                  }`}
                  title="Bold"
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    requestChangesEditor?.chain().focus().toggleItalic().run()
                  }
                  disabled={
                    !requestChangesEditor ||
                    isRequestingChanges ||
                    isUploadingRequestChangesImage
                  }
                  className={`h-8 w-8 p-0 ${
                    requestChangesEditor?.isActive("italic")
                      ? "bg-primary/10 text-primary"
                      : ""
                  }`}
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
                    requestChangesEditor
                      ?.chain()
                      .focus()
                      .toggleHeading({ level: 2 })
                      .run()
                  }
                  disabled={
                    !requestChangesEditor ||
                    isRequestingChanges ||
                    isUploadingRequestChangesImage
                  }
                  className={`h-8 w-8 p-0 ${
                    requestChangesEditor?.isActive("heading", { level: 2 })
                      ? "bg-primary/10 text-primary"
                      : ""
                  }`}
                  title="Heading"
                >
                  <Heading2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    requestChangesEditor
                      ?.chain()
                      .focus()
                      .toggleBulletList()
                      .run()
                  }
                  disabled={
                    !requestChangesEditor ||
                    isRequestingChanges ||
                    isUploadingRequestChangesImage
                  }
                  className={`h-8 w-8 p-0 ${
                    requestChangesEditor?.isActive("bulletList")
                      ? "bg-primary/10 text-primary"
                      : ""
                  }`}
                  title="Bullet List"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    requestChangesEditor
                      ?.chain()
                      .focus()
                      .toggleOrderedList()
                      .run()
                  }
                  disabled={
                    !requestChangesEditor ||
                    isRequestingChanges ||
                    isUploadingRequestChangesImage
                  }
                  className={`h-8 w-8 p-0 ${
                    requestChangesEditor?.isActive("orderedList")
                      ? "bg-primary/10 text-primary"
                      : ""
                  }`}
                  title="Numbered List"
                >
                  <ListOrdered className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    requestChangesEditor
                      ?.chain()
                      .focus()
                      .toggleCodeBlock()
                      .run()
                  }
                  disabled={
                    !requestChangesEditor ||
                    isRequestingChanges ||
                    isUploadingRequestChangesImage
                  }
                  className={`h-8 w-8 p-0 ${
                    requestChangesEditor?.isActive("codeBlock")
                      ? "bg-primary/10 text-primary"
                      : ""
                  }`}
                  title="Code Block"
                >
                  <Code className="h-4 w-4" />
                </Button>
              </div>

              {/* Editor */}
              <div className="border border-t-0 border-border rounded-b-lg bg-background overflow-hidden">
                {requestChangesEditor ? (
                  <EditorContent editor={requestChangesEditor} />
                ) : (
                  <div className="min-h-[120px] p-4 flex items-center justify-center text-muted-foreground">
                    Loading editor...
                  </div>
                )}
              </div>

              {/* Image Upload Indicator */}
              {isUploadingRequestChangesImage && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    Uploading image...
                  </span>
                </div>
              )}

              {/* File Attachments */}
              {requestChangesFiles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Attachments ({requestChangesFiles.length})
                  </Label>
                  <div className="space-y-2">
                    {requestChangesFiles.map((file, index) => {
                      const isImage = file.type.startsWith("image/");

                      return (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-lg border border-border group relative"
                        >
                          {/* Thumbnail or Icon */}
                          <div className="flex-shrink-0 w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden">
                            {isImage ? (
                              <img
                                src={URL.createObjectURL(file)}
                                alt={file.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <File className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>

                          {/* Remove button */}
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              handleRemoveRequestChangesFile(index)
                            }
                            disabled={isRequestingChanges}
                            className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>

                          {/* File info */}
                          <div className="min-w-0">
                            <p
                              className="text-xs font-medium truncate"
                              title={file.name}
                            >
                              {file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {file.size < 1024 * 1024
                                ? `${(file.size / 1024).toFixed(1)} KB`
                                : `${(file.size / (1024 * 1024)).toFixed(
                                    2
                                  )} MB`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* File Upload Button */}
              <div className="mt-3">
                <input
                  type="file"
                  id="request-changes-file-upload-input"
                  className="hidden"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  onChange={handleRequestChangesFileSelect}
                  disabled={
                    isRequestingChanges || isUploadingRequestChangesImage
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    document
                      .getElementById("request-changes-file-upload-input")
                      ?.click()
                  }
                  disabled={
                    isRequestingChanges || isUploadingRequestChangesImage
                  }
                  className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                >
                  <Paperclip className="h-4 w-4" />
                  <span>
                    {requestChangesFiles.length > 0
                      ? "Add more files"
                      : "Attach files"}
                  </span>
                  <span className="ml-auto text-xs">Images, PDFs, Docs</span>
                </Button>
              </div>

              {/* Helper Text */}
              <div className="flex items-start gap-2 p-2.5 bg-muted/30 rounded-lg border border-border">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                    <ImageIcon className="h-3 w-3 text-primary" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground">Quick image insert</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Paste images directly with{" "}
                    <kbd className="px-1 py-0.5 text-xs bg-muted rounded">
                      Cmd+V
                    </kbd>{" "}
                    or{" "}
                    <kbd className="px-1 py-0.5 text-xs bg-muted rounded">
                      Ctrl+V
                    </kbd>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {/* Helper text */}
            {!requestChangesHasContent &&
              requestChangesFiles.length === 0 &&
              !isUploadingRequestChangesImage && (
                <p className="text-xs text-muted-foreground">
                  Add a comment, paste images, or attach files to request
                  changes
                </p>
              )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setRequestChangesSubIssue(null);
                  setRequestChangesFiles([]);
                  setRequestChangesHasContent(false);
                  if (requestChangesEditor) {
                    requestChangesEditor.commands.setContent("");
                  }
                }}
                disabled={isRequestingChanges}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRequestChanges}
                disabled={
                  isRequestingChanges ||
                  isUploadingRequestChangesImage ||
                  (!requestChangesHasContent &&
                    requestChangesFiles.length === 0)
                }
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {isRequestingChanges ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Requesting Changes...
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Request Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

//Wrap với React.memo và custom comparison function
export const IssueDetailModal = React.memo(
  IssueDetailModalComponent,
  (prevProps, nextProps) => {
    // Only re-render if these specific props change
    return (
      prevProps.isOpen === nextProps.isOpen &&
      prevProps.issue?.id === nextProps.issue?.id &&
      prevProps.forceEnableComments === nextProps.forceEnableComments &&
      prevProps.showAcceptanceIssues === nextProps.showAcceptanceIssues
      // Note: We don't compare onClose, onIssueUpdate, onIssueClick callbacks
      // as they're typically stable or we want to allow updates
    );
  }
);
