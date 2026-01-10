/**
 * Client Columns Type Definitions
 * 
 * SINGLE SOURCE OF TRUTH for UAT workflow columns
 * Per Guidelines.md: DRY Principle - Don't Repeat Yourself
 */

// UAT Workflow Column IDs (CONST - never change)
export const UAT_COLUMN_IDS = [
  'client-review',
  'blocked', 
  'done',
  'released',
  'failed-review',
] as const;

// Type-safe column ID
export type UATColumnId = typeof UAT_COLUMN_IDS[number];

// Column display names (for UI)
export const UAT_COLUMN_NAMES: Record<UATColumnId, string> = {
  'client-review': 'Pending Review',
  'blocked': 'Blocked/Needs Input',
  'done': 'Approved',
  'released': 'Released',
  'failed-review': 'Failed Review',
} as const;

// Column descriptions (for tooltips)
export const UAT_COLUMN_DESCRIPTIONS: Record<UATColumnId, string> = {
  'client-review': 'Ready for your review and feedback',
  'blocked': 'Waiting for information or client feedback',
  'done': 'Approved and completed',
  'released': 'Shipped to production',
  'failed-review': 'Rejected, canceled, or duplicate',
} as const;

// Mobile View Types
export interface ClientTaskCardData {
  id: string;
  identifier: string;
  title: string;
  state: {
    id: string;
    name: string;
    color?: string;
  };
  labels: {
    nodes: Array<{
      id: string;
      name: string;
      color?: string;
    }>;
  };
  assigneeNames: string[];
  subIssueCount: number;
  createdAt: string;
}

export interface ClientTaskColumn {
  id: UATColumnId;
  title: string;
  description?: string;
  tasks: ClientTaskCardData[];
}

// Validation helper
export function isValidUATColumn(columnId: string): columnId is UATColumnId {
  return UAT_COLUMN_IDS.includes(columnId as UATColumnId);
}

// Get all column IDs as array
export function getUATColumnIds(): readonly UATColumnId[] {
  return UAT_COLUMN_IDS;
}

// Get column name safely
export function getUATColumnName(columnId: UATColumnId): string {
  return UAT_COLUMN_NAMES[columnId];
}

// Get column description safely
export function getUATColumnDescription(columnId: UATColumnId): string {
  return UAT_COLUMN_DESCRIPTIONS[columnId];
}

// OLD COLUMN IDs (DEPRECATED - for migration detection only)
export const DEPRECATED_COLUMN_IDS = [
  'to-do',
  'in-progress',
] as const;

export type DeprecatedColumnId = typeof DEPRECATED_COLUMN_IDS[number];

// Check if settings have deprecated columns
export function hasDeprecatedColumns(columnIds: string[]): boolean {
  return columnIds.some(id => 
    DEPRECATED_COLUMN_IDS.includes(id as DeprecatedColumnId)
  );
}

/**
 * Usage Examples:
 * 
 * // Good - Type-safe
 * const defaultColumns: UATColumnId[] = [...UAT_COLUMN_IDS];
 * const columnName = getUATColumnName('client-review'); // 'Pending Review'
 * 
 * // Good - Validation
 * if (isValidUATColumn(someId)) {
 *   const name = UAT_COLUMN_NAMES[someId]; // Type-safe!
 * }
 * 
 * // Good - Migration detection
 * const settings = loadFromStorage();
 * if (hasDeprecatedColumns(settings.visibleColumns)) {
 *   migrateToUATWorkflow();
 * }
 */