/**
 * Team Issues Drag & Drop Utilities
 * Handles drag and drop functionality for the Kanban board
 */

import { LinearIssue } from "../services/linearTeamIssuesService";

export interface DragItem {
  type: "issue";
  issue: LinearIssue;
  sourceColumnId: string;
}

export interface DropResult {
  issueId: string;
  sourceColumnId: string;
  targetColumnId: string;
  newStateId: string;
}

export const DRAG_TYPES = {
  ISSUE: "issue",
} as const;

// Teifi Digital Client Portal - Column ID to Linear State mapping
export const COLUMN_TO_STATE_MAPPING = {
  //Pending Review -> Client Review state
  pendingReview: ["Client Review"],
  //Approved -> Release Ready state
  approved: ["Release Ready"],
  //Released -> Shipped state
  released: ["Shipped"],
  //Needs Input -> Client Blocked state
  needsInput: ["Client Blocked"],
  //Failed Review -> In Progress OR Canceled (with conditions)
  failedReview: ["In Progress", "Canceled"],
} as const;

/**
 * Validation result with detailed feedback
 */
export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  title?: string;
  suggestion?: string;
  severity?: "error" | "warning" | "info";
  actionable?: boolean;
}

/**
 *Check if all children of an issue are approved (state = "Client Review" or completed)
 *
 * @param issue - Parent issue to check
 * @returns true if all children are approved or if issue has no children
 */
export function areAllChildrenApproved(
  issue: LinearIssue,
): boolean {
  // If issue has no sub-issues, it's approved to move
  const subIssues = (issue as any).subIssues;
  if (!subIssues || subIssues.length === 0) {
    return true;
  }

  // Check if ALL sub-issues are in "Client Review" state (Approved)
  const allApproved = subIssues.every((subIssue: any) => {
    const stateName = subIssue.state?.name;
    const stateType = subIssue.state?.type;

    // Approved = "Client Review" or completed states
    return (
      stateName === "Client Review" || stateType === "completed"
    );
  });

  // PERFORMANCE: Validation check complete

  return allApproved;
}

/**
 * Get children not ready for release
 *
 * Business Rule: Ready for release = "Release Ready" OR completed states (Shipped)
 * 
 * Use Cases:
 * - Approve button (move to Release Ready): Only enable when count = 0
 * - Cycle rollover: Identify incomplete tasks to carry over
 * - Release planning: Count tasks not ready to ship
 *
 * @param issue - Parent issue to check
 * @returns Object with count and list of children not ready for release
 */
export function getChildrenNotReadyForRelease(issue: LinearIssue): {
  count: number;
  identifiers: string[];
} {
  const subIssues = (issue as any).subIssues;
  if (!subIssues || subIssues.length === 0) {
    return { count: 0, identifiers: [] };
  }

  // CRITICAL: "Release Ready" OR completed (Shipped) = ready for release
  // Workflow: Client Review → Release Ready → Shipped
  // If already shipped, it passed Release Ready stage
  const notReady = subIssues.filter((subIssue: any) => {
    const stateName = subIssue.state?.name;
    const stateType = subIssue.state?.type;
    // Ready = "Release Ready" OR completed states
    return !(stateName === "Release Ready" || stateType === "completed");
  });

  return {
    count: notReady.length,
    identifiers: notReady.map((si: any) => si.identifier),
  };
}

/**
 * DEPRECATED: Use getChildrenNotReadyForRelease() instead
 * Kept for backward compatibility during migration
 */
export function getUnapprovedChildren(issue: LinearIssue): {
  count: number;
  identifiers: string[];
} {
  return getChildrenNotReadyForRelease(issue);
}

/**
 * Validation with parent-child approval rules
 *
 * ️ NEW RULE: Parent issues cannot be moved until ALL children are approved
 */
export function isValidDrop(
  sourceColumnId: string,
  targetColumnId: string,
  issue: LinearIssue,
  userRole?: string,
): ValidationResult {
  // PERFORMANCE: Validating drop

  // Only prevent dropping on the same column
  if (sourceColumnId === targetColumnId) {
    // PERFORMANCE: Same column
    return {
      isValid: false,
      reason: "Issue is already in this column",
      title: "No Change Needed",
      severity: "info",
      actionable: false,
    };
  }

  //NEW: Check if parent has unapproved children
  const subIssues = (issue as any).subIssues;
  if (subIssues && subIssues.length > 0) {
    const allApproved = areAllChildrenApproved(issue);

    if (!allApproved) {
      const unapproved = getUnapprovedChildren(issue);

      // SECURITY: Parent has unapproved children

      return {
        isValid: false,
        reason: `This issue has ${unapproved.count} unapproved sub-task${unapproved.count > 1 ? "s" : ""}`,
        title: "Cannot Move Parent Issue",
        suggestion: `Please approve all sub-tasks first: ${unapproved.identifiers.slice(0, 3).join(", ")}${unapproved.count > 3 ? "..." : ""}`,
        severity: "error",
        actionable: true,
      };
    }
  }

  // Allow all other moves - free drag & drop
  // PERFORMANCE: Validation passed
  return {
    isValid: true,
  };
}

/**
 * Gets the appropriate state ID for a column
 */
export function getStateIdForColumn(
  columnId: string,
  teamStates: Array<{ id: string; name: string; type: string }>,
): string | null {
  const stateNames =
    COLUMN_TO_STATE_MAPPING[
      columnId as keyof typeof COLUMN_TO_STATE_MAPPING
    ];

  if (!stateNames) {
    return null;
  }

  // Find exact matching state by name (for Client Portal precision)
  for (const stateName of stateNames) {
    const state = teamStates.find((s) => s.name === stateName);

    if (state) {
      return state.id;
    }
  }

  // Fallback to partial matching for legacy support
  for (const stateName of stateNames) {
    const state = teamStates.find(
      (s) =>
        s.name
          .toLowerCase()
          .includes(stateName.toLowerCase()) ||
        stateName.toLowerCase().includes(s.name.toLowerCase()),
    );

    if (state) {
      return state.id;
    }
  }

  // Fallback to state type mapping
  const typeMapping: Record<string, string> = {
    pendingReview: "triage",
    approved: "completed",
    released: "completed",
    needsInput: "backlog",
    failedReview: "canceled",
  };

  const targetType = typeMapping[columnId];
  if (targetType) {
    const state = teamStates.find((s) => s.type === targetType);
    if (state) {
      return state.id;
    }
  }

  return null;
}

/**
 * SECURITY: Escapes HTML to prevent XSS attacks
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Creates a drag preview element
 * SECURITY: All user data is properly escaped to prevent XSS
 */
export function createDragPreview(
  issue: LinearIssue,
): HTMLElement {
  const preview = document.createElement("div");
  preview.className =
    "bg-white border shadow-lg rounded-lg p-3 max-w-xs opacity-90";

  // SECURITY: Use textContent instead of innerHTML to prevent XSS
  const container = document.createElement("div");

  // Top row: identifier and priority
  const topRow = document.createElement("div");
  topRow.className = "flex items-center gap-2 mb-2";

  const identifierSpan = document.createElement("span");
  identifierSpan.className =
    "text-xs bg-gray-100 px-2 py-1 rounded";
  identifierSpan.textContent = issue.identifier; // Safe: textContent escapes HTML

  const prioritySpan = document.createElement("span");
  prioritySpan.className = "text-xs font-medium";
  prioritySpan.textContent = getPriorityLabel(issue.priority); // Safe: controlled data

  topRow.appendChild(identifierSpan);
  topRow.appendChild(prioritySpan);

  // Title
  const titleDiv = document.createElement("div");
  titleDiv.className = "font-medium text-sm line-clamp-2";
  titleDiv.textContent = issue.title; // Safe: textContent escapes HTML

  // Status
  const statusDiv = document.createElement("div");
  statusDiv.className = "text-xs text-gray-500 mt-1";
  statusDiv.textContent = "Moving...";

  // Assemble preview
  container.appendChild(topRow);
  container.appendChild(titleDiv);
  container.appendChild(statusDiv);
  preview.appendChild(container);

  return preview;
}

/**
 * Provides drag feedback
 */
export function provideDragFeedback(
  isValid: boolean,
  sourceColumn: string,
  targetColumn: string,
): { message: string; type: "success" | "warning" | "error" } {
  if (!isValid) {
    return {
      message: "This move is not allowed",
      type: "error",
    };
  }

  const messages: Record<string, string> = {
    // From Pending Review (Client Review state)
    "pendingReview-approved":
      "Approve for release → Release Ready",
    "pendingReview-failedReview":
      "Request changes → In Progress for rework",
    "pendingReview-needsInput":
      "Mark as needs input → Client Blocked",

    // From Approved (Release Ready state)
    "approved-released": "Mark as shipped → Shipped",
    "approved-failedReview": "Reject approval → In Progress",

    // From Needs Input (Client Blocked state)
    "needsInput-pendingReview":
      "Submit for review → Client Review",

    // From Failed Review (In Progress/Canceled state)
    "failedReview-pendingReview":
      "Resubmit for review → Client Review",
    "failedReview-needsInput":
      "Request more input → Client Blocked",
  };

  const key = `${sourceColumn}-${targetColumn}`;
  return {
    message: messages[key] || `Move to ${targetColumn}`,
    type: "success",
  };
}

/**
 * Animates the drag operation
 */
export function animateDragOperation(
  element: HTMLElement,
  type: "start" | "end" | "success" | "error",
): void {
  const animations = {
    start: "dragging scale-105 rotate-2",
    end: "transition-all duration-200",
    success: "animate-pulse bg-green-50 border-green-200",
    error: "animate-pulse bg-red-50 border-red-200",
  };

  // Remove existing animation classes
  Object.values(animations).forEach((classes) => {
    classes
      .split(" ")
      .forEach((cls) => element.classList.remove(cls));
  });

  // Add new animation classes
  const classes = animations[type].split(" ");
  classes.forEach((cls) => element.classList.add(cls));

  // Auto-remove temporary animation classes
  if (type === "success" || type === "error") {
    setTimeout(() => {
      classes.forEach((cls) => element.classList.remove(cls));
    }, 2000);
  }
}

/**
 * Helper to get priority label
 */
function getPriorityLabel(priority?: number): string {
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
}

/**
 * Batches multiple drag operations for performance
 */
export class DragOperationBatcher {
  private operations: DropResult[] = [];
  private timeout: NodeJS.Timeout | null = null;

  constructor(
    private onBatchExecute: (
      operations: DropResult[],
    ) => Promise<void>,
    private batchDelay: number = 100,
  ) {}

  addOperation(operation: DropResult): void {
    this.operations.push(operation);

    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    this.timeout = setTimeout(() => {
      this.executeBatch();
    }, this.batchDelay);
  }

  private async executeBatch(): Promise<void> {
    if (this.operations.length === 0) return;

    const operationsToExecute = [...this.operations];
    this.operations = [];

    // Emit batch start event
    this.emitBatchEvent("batch_start", {
      batchSize: operationsToExecute.length,
    });

    try {
      await this.onBatchExecute(operationsToExecute);

      // Emit batch complete event
      this.emitBatchEvent("batch_complete", {
        batchSize: operationsToExecute.length,
        completedCount: operationsToExecute.length,
      });
    } catch (error) {
      console.error(
        "Failed to execute batch operations:",
        error,
      );

      // Emit batch error event
      this.emitBatchEvent("batch_complete", {
        batchSize: operationsToExecute.length,
        completedCount: 0,
      });

      // Re-add failed operations for retry
      this.operations.unshift(...operationsToExecute);
    }
  }

  private emitBatchEvent(
    type: "batch_start" | "batch_complete",
    data: any,
  ) {
    const event = new CustomEvent(`dragdrop:${type}`, {
      detail: {
        id: crypto.randomUUID(),
        type,
        timestamp: Date.now(),
        ...data,
      },
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(event);
    }
  }

  cancel(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    this.operations = [];
  }
}

/**
 * Keyboard navigation support for accessibility
 */
export function handleKeyboardNavigation(
  event: KeyboardEvent,
  issue: LinearIssue,
  currentColumn: string,
  onMove: (issueId: string, newColumn: string) => void,
): boolean {
  if (
    !["ArrowLeft", "ArrowRight", "Enter", " "].includes(
      event.key,
    )
  ) {
    return false;
  }

  event.preventDefault();

  const columns = [
    "pendingReview",
    "needsInput",
    "approved",
    "released",
    "failedReview",
  ];
  const currentIndex = columns.indexOf(currentColumn);

  if (currentIndex === -1) return false;

  switch (event.key) {
    case "ArrowLeft":
      if (currentIndex > 0) {
        onMove(issue.id, columns[currentIndex - 1]);
      }
      return true;

    case "ArrowRight":
      if (currentIndex < columns.length - 1) {
        onMove(issue.id, columns[currentIndex + 1]);
      }
      return true;

    case "Enter":
    case " ":
      // Trigger context menu or default action
      return true;

    default:
      return false;
  }
}