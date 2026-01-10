/**
 * Kanban Board Settings Types
 * 
 * Type definitions for user-specific Kanban board personalization
 * including column visibility, order, width, and other preferences
 */

export interface KanbanBoardSettings {
  // Column configuration
  columnsOrder: string[]; // Array of state IDs in display order
  visibleColumns: string[]; // Array of visible state IDs
  collapsedColumns: string[]; // Array of collapsed/minimized state IDs
  customWidths: Record<string, number>; // state ID -> width in pixels
  
  // Display preferences
  hideEmptyColumns: boolean; // Auto-hide columns with no issues
  compactMode: boolean; // Use compact card layout
  showSubIssues: boolean; // Show sub-issue indicators
  
  // Filters and grouping
  filters?: {
    assignee?: string[];
    label?: string[];
    priority?: number[];
  };
  groupBy?: 'state' | 'assignee' | 'priority' | 'label';
  
  // Metadata
  lastOpen: string; // ISO timestamp
  version: number; // Settings schema version for migrations
}

export interface KanbanColumnConfig {
  id: string;
  name: string;
  visible: boolean;
  width?: number;
  collapsed?: boolean;
  order: number;
  issueCount?: number;
}

export interface KanbanSettingsUpdatePayload {
  columnsOrder?: string[];
  visibleColumns?: string[];
  collapsedColumns?: string[];
  customWidths?: Record<string, number>;
  hideEmptyColumns?: boolean;
  compactMode?: boolean;
  showSubIssues?: boolean;
  filters?: KanbanBoardSettings['filters'];
  groupBy?: KanbanBoardSettings['groupBy'];
}

export const DEFAULT_KANBAN_SETTINGS: Omit<KanbanBoardSettings, 'columnsOrder' | 'visibleColumns'> = {
  collapsedColumns: [],
  customWidths: {},
  hideEmptyColumns: false,
  compactMode: false,
  showSubIssues: true,
  lastOpen: new Date().toISOString(),
  version: 1,
};
