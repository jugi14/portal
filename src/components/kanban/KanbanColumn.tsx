import React from 'react';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { LinearIssue, LinearState } from '../../services/linearTeamIssuesService';
import { IssueCard } from './IssueCard';
import {
  CheckCircle,
  Clock,
  XCircle,
  Pause,
  ArrowRight,
} from 'lucide-react';

interface KanbanColumnProps {
  state: LinearState;
  issues: LinearIssue[];
  syncingIssues: Set<string>;
  dragInProgress: Set<string>;
  onDragStart: (issue: LinearIssue, stateId: string) => void;
  onDragOver: (event: React.DragEvent, stateId: string) => void;
  onDragLeave: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent, stateId: string) => void;
  onViewDetails: (issue: LinearIssue) => void;
}

/**
 * Icon mapping by state type
 */
const getStateIcon = (stateType: string) => {
  switch (stateType) {
    case 'started':
      return Clock;
    case 'completed':
      return CheckCircle;
    case 'canceled':
      return XCircle;
    case 'backlog':
      return Pause;
    default:
      return ArrowRight;
  }
};

/**
 * Color mapping by state type
 */
const getStateColor = (stateType: string) => {
  switch (stateType) {
    case 'started':
      return '#3b82f6'; // blue
    case 'completed':
      return '#10b981'; // green
    case 'canceled':
      return '#ef4444'; // red
    case 'backlog':
      return '#6b7280'; // gray
    default:
      return '#8b5cf6'; // purple
  }
};

/**
 * Kanban Column Component
 * Displays a single column with header and issue cards
 * 
 * PERFORMANCE: Memoized to prevent unnecessary re-renders
 * Re-renders only when state, issues array, or sync/drag sets change
 */
const KanbanColumnComponent: React.FC<KanbanColumnProps> = ({
  state,
  issues,
  syncingIssues,
  dragInProgress,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onViewDetails,
}) => {
  const IconComponent = getStateIcon(state.type);
  const stateColor = state.color || getStateColor(state.type);

  return (
    <div
      className="flex-1 kanban-column-compact bg-muted/20 rounded-lg border border-border transition-all duration-200 kanban-drop-zone"
      onDragOver={(e) => onDragOver(e, state.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, state.id)}
    >
      <div className="p-3">
        {/* Column Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full" style={{ backgroundColor: stateColor }}>
              <IconComponent className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">{state.name}</h3>
              {state.description && (
                <p className="text-xs text-muted-foreground line-clamp-1">{state.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-xs px-2 py-0.5 h-5">
              {issues.length}
            </Badge>
          </div>
        </div>

        {/* Column Content */}
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="pr-3">
            {issues.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground border-2 border-dashed border-muted rounded-lg">
                <IconComponent className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No issues</p>
                <p className="text-xs mt-1 opacity-75">Drop issues here to move them</p>
              </div>
            ) : (
              issues.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  stateId={state.id}
                  isSyncing={syncingIssues.has(issue.id)}
                  isDragInProgress={dragInProgress.has(issue.id)}
                  onDragStart={onDragStart}
                  onViewDetails={onViewDetails}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export const KanbanColumn = React.memo(KanbanColumnComponent);