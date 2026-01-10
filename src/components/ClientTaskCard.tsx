/**
 * Client Task Card - Compact kanban card
 * 
 * Features:
 * - Click to view details
 * - Highlight when in Client Review
 * - Show hierarchy indicator
 * - Action buttons for Client Review column
 * - Visual badge for parent issues with sub-issues
 * 
 * Note: Drag & drop disabled - tasks move via approve/reject buttons
 * 
 * PERFORMANCE: Memoized to prevent unnecessary re-renders
 * Re-renders only when issue data or column config changes
 */
import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Badge } from './ui/badge';
import {
  Calendar,
  GitBranch,
} from 'lucide-react';
import { LinearIssue } from '../services/linearTeamIssuesService';
import { ClientColumnConfig } from '../utils/clientTasksMapping';
import { IssueHierarchyIndicator } from './IssueHierarchyIndicator';

export interface ClientTaskCardProps {
  issue: LinearIssue;
  column: ClientColumnConfig;
  onClick: () => void;
  onRequestChanges: (e: React.MouseEvent) => void;
  onAddIssue: (e: React.MouseEvent) => void;
}

/**
 * Client Task Card - Compact kanban card
 * 
 * Features:
 * - Click to view details
 * - Highlight when in Client Review
 * - Show hierarchy indicator
 * - Action buttons for Client Review column
 * - Visual badge for parent issues with sub-issues
 * 
 * Note: Drag & drop disabled - tasks move via approve/reject buttons
 * 
 * PERFORMANCE: Memoized to prevent unnecessary re-renders
 * Re-renders only when issue data or column config changes
 */
const ClientTaskCardComponent: React.FC<ClientTaskCardProps> = ({
  issue,
  column,
  onClick,
  onRequestChanges,
  onAddIssue,
}) => {
  // Check if this issue is in Client Review column
  const isInClientReview = column.id === 'client-review';
  
  // Check if issue has sub-issues
  // CRITICAL: Use _originalSubIssueCount from backend (accurate direct children count)
  // Fallback to subIssues array length if count not available
  const subIssueCount = (issue as any)._originalSubIssueCount ?? issue.subIssues?.length ?? 0;
  const hasSubIssues = subIssueCount > 0;
  
  // Extract labels (support both GraphQL nodes format and flat array)
  const labels =
    issue.labels && 'nodes' in issue.labels
      ? issue.labels.nodes
      : Array.isArray(issue.labels)
        ? issue.labels
        : [];
  
  return (
    <Card
      key={`${issue.id}-${column.id}`}
      className={`!mb-2.5 hover:shadow-md transition-all duration-200 !border !border-border !bg-muted/20 cursor-pointer issues-kanban-card-compact !border-l-4`}
      style={{
        borderLeftColor: column.color,
      }}
      onClick={onClick}
    >
      <CardHeader className="!p-3 !pb-2">
        {/* Top row: Identifier + Sub-issue count */}
        <div className="flex items-center !gap-2 !mb-2 flex-wrap">
          <Badge variant="outline" className="!text-xs !px-2 !py-0.5 !h-5 flex items-center !gap-0">
            {issue.identifier}
          </Badge>
          
          {/* Parent Issue Badge - GitBranch icon (simplified) */}
          {hasSubIssues && (
            <Badge 
              variant="secondary" 
              className="!text-xs !px-2 !py-0.5 !h-5 !bg-blue-50 dark:!bg-blue-950 !text-blue-700 dark:!text-blue-300 !border-blue-200 dark:!border-blue-800 flex items-center !gap-1"
            >
              <GitBranch className="h-3 w-3" />
              <span>{subIssueCount}</span>
            </Badge>
          )}
        </div>
        
        {/* Title - Prominent */}
        <CardTitle className="!text-sm !leading-snug break-words overflow-wrap-anywhere !m-0">
          {issue.title}
        </CardTitle>
      </CardHeader>

      <CardContent className="!px-3 !pt-0 !pb-3">
        {/* All metadata in one compact row: Status + Hierarchy + Date */}
        <div className="issue-card-metadata flex items-center !gap-2 flex-wrap !text-xs !min-h-[24px]">
          {/* Status badge - Compact */}
          <Badge
            variant="secondary"
            className="!text-xs !px-2 !py-0.5 !h-5 flex items-center !gap-0"
            style={{
              backgroundColor: `${issue.state.color}20`,
              color: issue.state.color,
              borderColor: issue.state.color,
            }}
          >
            {issue.state.name}
          </Badge>

          {/* Hierarchy indicator - Inline compact */}
          <div className="flex-shrink-0">
            <IssueHierarchyIndicator 
              issue={issue}
              variant="compact"
              showTooltip={true}
            />
          </div>

          {/* Created date - Inline */}
          {issue.createdAt && (
            <div className="created-date flex items-center !gap-1 text-muted-foreground flex-shrink-0 !h-5">
              <Calendar className="h-3 w-3" />
              <span className="whitespace-nowrap">{new Date(issue.createdAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const ClientTaskCard = React.memo(ClientTaskCardComponent);