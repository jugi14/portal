/**
 * Client Kanban Column Component
 * 
 * Render một column trong kanban board với header, badges và cards
 * Tách riêng để dễ customize layout mà không ảnh hưởng logic
 * 
 * Note: Drag & drop disabled - tasks move via approve/reject buttons
 */

import React from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Clock, Ban, CheckCircle, Rocket, XCircle, Plus, Archive } from 'lucide-react';
import { LinearIssue } from '../services/linearTeamIssuesService';
import { ClientColumn, ClientColumnConfig } from '../utils/clientTasksMapping';
import { ClientTaskCard } from './ClientTaskCard';

export interface ClientKanbanColumnProps {
  column: ClientColumnConfig;
  issues: LinearIssue[];
  counters: {
    parents: number;
    subIssues: number;
    total: number;
  };
  viewMode: 'compact' | 'normal' | 'wide';
  customEnabled: boolean;
  customWidth: number;
  onViewDetails: (issue: LinearIssue) => void;
  onRequestChanges: (issue: LinearIssue) => void;
  onAddIssue: (issue: LinearIssue) => void;
  onCreateGroupTask?: () => void;
}

/**
 * Get column width based on view mode
 */
const getColumnWidth = (
  viewMode: 'compact' | 'normal' | 'wide',
  customEnabled: boolean,
  customWidth: number
): string => {
  if (customEnabled && customWidth) {
    return `${customWidth}px`;
  }
  
  switch (viewMode) {
    case 'compact':
      return '260px';
    case 'wide':
      return '380px';
    case 'normal':
    default:
      return '320px';
  }
};

/**
 * Get icon for column based on column ID
 */
const getColumnIcon = (columnId: ClientColumn): React.ReactNode => {
  switch (columnId) {
    case 'client-review':
      return <Clock className="h-5 w-5" />;
    case 'blocked':
      return <Ban className="h-5 w-5" />;
    case 'done':
      return <CheckCircle className="h-5 w-5" />;
    case 'released':
      return <Rocket className="h-5 w-5" />;
    case 'archived':
      return <Archive className="h-5 w-5" />;
    case 'canceled':
      return <XCircle className="h-5 w-5" />;
    default:
      return null;
  }
};

/**
 * Client Kanban Column
 * 
 * Features:
 * - Click to view task details
 * - Auto-calculate width based on view mode
 * - Show parent + sub-issue breakdown
 * - Empty state
 * 
 * Note: Drag & drop disabled - tasks move via approve/reject buttons
 */
export const ClientKanbanColumn: React.FC<ClientKanbanColumnProps> = ({
  column,
  issues,
  counters,
  viewMode,
  customEnabled,
  customWidth,
  onViewDetails,
  onRequestChanges,
  onAddIssue,
  onCreateGroupTask,
}) => {
  const columnWidth = getColumnWidth(viewMode, customEnabled, customWidth);

  return (
    <div
      key={column.id}
      className="flex-shrink-0 bg-muted/20 rounded-lg border border-border kanban-column-unified kanban-column-wrapper transition-all duration-200"
      style={{ width: columnWidth, minWidth: columnWidth, maxWidth: columnWidth }}
    >
      {/* Column Header */}
      <div
        className="kanban-column-header p-4 border-b border-border"
        style={{ borderTopColor: column.color, borderTopWidth: '3px' }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div style={{ color: column.color }}>
              {getColumnIcon(column.id)}
            </div>
            <h3 className="font-semibold">{column.title}</h3>
          </div>
          {/* Enhanced counter badge - Main shows total children, Secondary shows parents */}
          <div className="flex items-center gap-1.5">
            {/* Main badge shows total sub-issues (children) */}
            <Badge variant="secondary" className="text-xs font-semibold">
              {counters.subIssues}
            </Badge>
            {/* Secondary badge shows parent count */}
            {counters.parents > 0 && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                +{counters.parents}
              </Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {column.description}
          {/* Show detailed breakdown */}
          {(counters.parents > 0 || counters.subIssues > 0) && (
            <span className="block mt-1 text-[10px] opacity-70">
              {counters.subIssues} child{counters.subIssues !== 1 ? 'ren' : ''}
              {counters.parents > 0 && ` • ${counters.parents} parent${counters.parents !== 1 ? 's' : ''}`}
              {counters.total > 0 && ` • ${counters.total} total`}
            </span>
          )}
        </p>
      </div>
      
      {/* New Group Task button for Pending Review column */}
      {(() => {
        return column.id === 'client-review' && onCreateGroupTask && (
          <div className="px-4 py-3">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onCreateGroupTask();
              }}
              className="w-full h-8 py-2 text-xs hover:bg-primary/10 hover:text-primary hover:border-primary transition-all"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Group Task
            </Button>
          </div>
        );
      })()}

      {/* Column Content */}
      <ScrollArea className="h-[calc(100vh-280px)]">
        <div className="kanban-column-cards p-3">
          {issues.length === 0 ? (
            <div className="kanban-column-empty text-center py-8 text-muted-foreground">
              <div className="opacity-30 mb-2" style={{ color: column.color }}>
                {getColumnIcon(column.id)}
              </div>
              <p className="text-sm">No tasks</p>
            </div>
          ) : (
            issues.map((issue) => (
              <ClientTaskCard
                key={issue.id}
                issue={issue}
                column={column}
                onClick={() => onViewDetails(issue)}
                onRequestChanges={(e) => {
                  e.stopPropagation();
                  onRequestChanges(issue);
                }}
                onAddIssue={(e) => {
                  e.stopPropagation();
                  onAddIssue(issue);
                }}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};