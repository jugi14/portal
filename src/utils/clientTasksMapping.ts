/**
 * Client Tasks Mapping Utilities
 *
 * Provides state mapping logic and column configuration for UAT Kanban board
 */

import { LinearState } from "../services/linearTeamIssuesService";

// Client-friendly column types (UAT workflow)
export type ClientColumn =
  | "client-review"
  | "blocked"
  | "done"
  | "released"
  | "archived"
  | "canceled";

export interface ClientColumnConfig {
  id: ClientColumn;
  title: string;
  description: string;
  color: string;
  allowIssueCreation: boolean;
  allowApproval: boolean;
}

/**
 * UAT Column Configuration for Client Portal
 *
 * Complete workflow:
 * - Client Review (Pending Review) -> Approve -> Done (Approved)
 * - Client Review (Pending Review) -> Request Changes -> Back to In Progress (for developer to fix)
 * - Client Review (Pending Review) -> Needs Input -> Blocked (waiting for client)
 * - Done (Approved) -> Release -> Released (Shipped)
 * - Archived: Duplicate/rejected/failed issues (NOT for request changes)
 * - Canceled: Explicitly canceled issues (separate column)
 */
export const CLIENT_COLUMNS: ClientColumnConfig[] = [
  {
    id: "client-review",
    title: "Pending Review",
    description: "Ready for your review and feedback",
    color: "#3b82f6",
    allowIssueCreation: true,
    allowApproval: true,
  },
  {
    id: "blocked",
    title: "Blocked/Needs Input",
    description: "Waiting for information or client feedback",
    color: "#f59e0b",
    allowIssueCreation: false,
    allowApproval: false,
  },
  {
    id: "done",
    title: "Approved",
    description: "Approved and completed",
    color: "#10b981",
    allowIssueCreation: false,
    allowApproval: false,
  },
  {
    id: "released",
    title: "Released",
    description: "Shipped to production",
    color: "#8b5cf6",
    allowIssueCreation: false,
    allowApproval: false,
  },
  {
    id: "canceled",
    title: "Canceled",
    description: "Canceled issues",
    color: "#ef4444",
    allowIssueCreation: false,
    allowApproval: false,
  },
  {
    id: "archived",
    title: "Archived",
    description: "Rejected, failed, or duplicate issues",
    color: "#64748b",
    allowIssueCreation: false,
    allowApproval: false,
  },
];

/**
 * Map Linear State to Client Column
 *
 * STRICT MATCHING ONLY - No fallback!
 * Only maps states that explicitly match defined criteria.
 * Issues that don't match any rule will be filtered out (not displayed).
 *
 * NAME-BASED MATCHING STRATEGY:
 * All mappings are based on state NAME, not type.
 * This ensures explicit control over which states are displayed.
 *
 * PRIORITY ORDER (specific names checked in sequence):
 * 1. Shipped/Released states → Released
 * 2. Client Review state → Pending Review
 * 3. Duplicate/Rejected/Failed states → Archived
 * 4. Canceled states → Canceled
 * 5. Release Ready states → Approved
 * 6. Blocked/Waiting states → Blocked
 *
 * @param state - Linear workflow state
 * @returns Mapped client column ID or null if no match
 */
export const mapStateToClientColumn = (
  state: LinearState
): ClientColumn | null => {
  const stateName = state.name.toLowerCase();
  const stateType = state.type;

  // Priority 1: Shipped/Released states → Released
  if (
    stateName.includes("shipped") ||
    stateName.includes("released") ||
    stateName.includes("live") ||
    stateName.includes("deployed")
  ) {
    return "released";
  }

  // Priority 2: Client Review states → Pending Review
  if (
    stateName.includes("client review") ||
    stateName.includes("client-review")
  ) {
    return "client-review";
  }

  // Priority 3: Duplicate/Rejected/Failed states → Archived
  if (
    stateName.includes("duplicate") ||
    stateName.includes("rejected") ||
    stateName.includes("failed")
  ) {
    return "archived";
  }

  // Priority 4: Canceled states → Canceled
  if (
    stateType === "canceled" ||
    stateName.includes("canceled") ||
    stateName.includes("cancelled")
  ) {
    return "canceled";
  }

  // Priority 5: Release Ready states → Approved
  if (
    stateName.includes("release ready") ||
    stateName.includes("ready for release") ||
    stateName.includes("ready to release") ||
    stateName.includes("approved")
  ) {
    return "done";
  }

  // Priority 6: Blocked/Waiting states → Blocked
  if (
    stateName.includes("blocked") ||
    stateName.includes("waiting") ||
    stateName.includes("hold") ||
    stateName.includes("paused")
  ) {
    return "blocked";
  }

  // NO FALLBACK - Return null if no match
  // Issue will be filtered out and not displayed
  return null;
};

/**
 * Calculate distribution statistics
 */
export const calculateDistribution = (
  issuesByColumn: Record<ClientColumn, any[]>
): {
  total: number;
  "client-review": number;
  blocked: number;
  done: number;
  released: number;
  archived: number;
  canceled: number;
  percentages: Record<ClientColumn, number>;
} => {
  const total = Object.values(issuesByColumn).reduce(
    (sum, issues) => sum + issues.length,
    0
  );

  const distribution = {
    total,
    "client-review": issuesByColumn["client-review"]?.length || 0,
    blocked: issuesByColumn["blocked"]?.length || 0,
    done: issuesByColumn["done"]?.length || 0,
    released: issuesByColumn["released"]?.length || 0,
    archived: issuesByColumn["archived"]?.length || 0,
    canceled: issuesByColumn["canceled"]?.length || 0,
    percentages: {} as Record<ClientColumn, number>,
  };

  // Calculate percentages
  CLIENT_COLUMNS.forEach((col) => {
    distribution.percentages[col.id] =
      total > 0
        ? Math.round(((issuesByColumn[col.id]?.length || 0) / total) * 100)
        : 0;
  });

  return distribution;
};

/**
 * Log detailed distribution report
 * NOTE: Logging removed for production - use dev tools if needed
 */
export const logDistributionReport = (
  _issuesByColumn: Record<ClientColumn, any[]>
): void => {
  // Distribution calculation still available for debugging if needed
  // const distribution = calculateDistribution(issuesByColumn);
  // Use browser DevTools to inspect issuesByColumn directly
};
