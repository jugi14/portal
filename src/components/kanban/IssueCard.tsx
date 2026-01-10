import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Eye,
  ExternalLink,
  MoreHorizontal,
  Loader2,
  GitBranch,
} from 'lucide-react';
import { LinearIssue } from '../../services/linearTeamIssuesService';
import { LinearHelpers } from '../../services/linear';
import { toast } from 'sonner';

interface IssueCardProps {
  issue: LinearIssue;
  stateId: string;
  isSyncing: boolean;
  isDragInProgress: boolean;
  onDragStart: (issue: LinearIssue, stateId: string) => void;
  onViewDetails: (issue: LinearIssue) => void;
}

/**
 * Priority color mapping
 */
const getPriorityColor = (priority?: number) => {
  switch (priority) {
    case 4:
      return 'bg-red-500'; // Urgent
    case 3:
      return 'bg-orange-500'; // High
    case 2:
      return 'bg-yellow-500'; // Medium
    case 1:
      return 'bg-green-500'; // Low
    default:
      return 'bg-gray-500'; // No priority
  }
};

/**
 * Priority label mapping
 */
const getPriorityLabel = (priority?: number, priorityLabel?: string) => {
  if (priorityLabel) return priorityLabel;

  switch (priority) {
    case 4:
      return 'Urgent';
    case 3:
      return 'High';
    case 2:
      return 'Medium';
    case 1:
      return 'Low';
    default:
      return 'None';
  }
};

/**
 * Format date to readable string
 */
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Issue Card Component
 * Displays a single issue card with all metadata, drag/drop support, and actions
 * 
 * PERFORMANCE: Memoized to prevent unnecessary re-renders
 * Re-renders only when issue data, sync state, or drag state changes
 */
const IssueCardComponent: React.FC<IssueCardProps> = ({
  issue,
  stateId,
  isSyncing,
  isDragInProgress,
  onDragStart,
  onViewDetails,
}) => {
  // Get labels
  const labels =
    issue.labels && 'nodes' in issue.labels
      ? issue.labels.nodes
      : Array.isArray(issue.labels)
        ? issue.labels
        : [];

  // Check if parent issue with sub-issues
  // CRITICAL: Use _originalSubIssueCount from backend for accurate count
  const actualSubIssueCount =
    (issue as any)._originalSubIssueCount ?? (issue as any).subIssues?.length ?? 0;
  const hasSubIssues = actualSubIssueCount > 0;

  // Sub-issues progress calculation
  const subIssuesProgress = hasSubIssues
    ? (() => {
        const subIssues = (issue as any).subIssues || [];
        const completedCount = subIssues.filter(
          (sub: any) => sub.state?.type === 'completed'
        ).length;
        const totalCount = actualSubIssueCount; // Use accurate count from backend
        const percentage =
          totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        const allCompleted = completedCount === totalCount && totalCount > 0;

        return { subIssues, completedCount, totalCount, percentage, allCompleted };
      })()
    : null;

  return (
    <Card
      className={`!mb-2.5 hover:shadow-md transition-all duration-200 !border !border-border !bg-muted/20 issues-kanban-card-compact ${
        hasSubIssues ? 'has-sub-issues !border-l-4 !border-l-primary/40' : ''
      } ${
        (issue as any).parent
          ? '!border-l-4 !border-l-purple-400 dark:!border-l-purple-600 !pl-1'
          : ''
      } ${isSyncing ? 'opacity-75 ring-1 ring-blue-200' : ''} ${
        isDragInProgress ? 'opacity-60 cursor-not-allowed ring-1 ring-orange-200' : ''
      }`}
      draggable={!isDragInProgress && !isSyncing}
      onDragStart={(e) => {
        if (isDragInProgress || isSyncing) {
          e.preventDefault();
          toast.info('Please wait, operation in progress', { duration: 1500 });
          return;
        }

        onDragStart(issue, stateId);
        e.currentTarget.classList.add('dragging');
      }}
      onDragEnd={(e) => {
        e.currentTarget.classList.remove('dragging');
      }}
      onClick={() => onViewDetails(issue)}
    >
      <CardHeader className="!p-3 !pb-2">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center !gap-2 !mb-2 flex-wrap">
              {/* Sub-issue badge */}
              {(issue as any).parent && (
                <Badge
                  variant="secondary"
                  className="!text-xs !px-2 !py-0.5 !h-5 !bg-purple-100 !text-purple-700 !border-purple-300 dark:!bg-purple-900/30 dark:!text-purple-400 dark:!border-purple-700"
                >
                  <GitBranch className="h-3 w-3 mr-0.5" />
                  Sub-task
                </Badge>
              )}

              <Badge variant="outline" className="!text-xs !px-2 !py-0.5 !h-5 flex items-center !gap-0">
                {issue.identifier}
              </Badge>

              {/* Priority badge */}
              {issue.priority !== undefined && (
                <Badge
                  className={`!text-xs !px-2 !py-0.5 !h-5 ${getPriorityColor(issue.priority)} text-white`}
                >
                  {getPriorityLabel(issue.priority, issue.priorityLabel)}
                </Badge>
              )}

              {/* Parent issue - sub-issues progress badge */}
              {!((issue as any).parent) && subIssuesProgress && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="secondary"
                        className={`!text-xs !px-2 !py-0.5 !h-5 sub-issue-badge ${
                          subIssuesProgress.allCompleted
                            ? '!bg-green-100 !text-green-700 !border-green-300 dark:!bg-green-900/30 dark:!text-green-400 dark:!border-green-700'
                            : '!bg-primary/10 !text-primary !border-primary/20'
                        }`}
                      >
                        <GitBranch className="h-3 w-3 mr-0.5" />
                        {subIssuesProgress.completedCount}/{subIssuesProgress.totalCount}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold">
                          Sub-issues: {subIssuesProgress.completedCount} of{' '}
                          {subIssuesProgress.totalCount} completed ({subIssuesProgress.percentage}%)
                        </p>
                        <div className="space-y-0.5 mt-2">
                          {subIssuesProgress.subIssues.slice(0, 5).map((sub: any, idx: number) => (
                            <div
                              key={sub.id}
                              className="sub-issue-tooltip-item flex items-center gap-1.5 text-xs"
                            >
                              {sub.state?.type === 'completed' ? (
                                <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
                              ) : sub.state?.type === 'started' ? (
                                <Clock className="h-3 w-3 text-blue-500 shrink-0" />
                              ) : (
                                <AlertTriangle className="h-3 w-3 text-orange-500 shrink-0" />
                              )}
                              <span className="font-medium">{sub.identifier}</span>
                              <span className="text-muted-foreground truncate">{sub.title}</span>
                            </div>
                          ))}
                          {subIssuesProgress.subIssues.length > 5 && (
                            <span className="text-xs text-muted-foreground pl-5">
                              +{subIssuesProgress.subIssues.length - 5} more sub-tasks
                            </span>
                          )}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Drag in progress indicator */}
              {isDragInProgress && !isSyncing && (
                <Badge
                  variant="secondary"
                  className="!text-xs !px-2 !py-0.5 !h-5 animate-pulse !bg-orange-100 !text-orange-800"
                >
                  <Clock className="h-2.5 w-2.5 mr-0.5" />
                  Processing...
                </Badge>
              )}

              {/* Syncing indicator */}
              {isSyncing && (
                <Badge variant="secondary" className="!text-xs !px-2 !py-0.5 !h-5 animate-pulse">
                  <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" />
                  Syncing...
                </Badge>
              )}
            </div>

            <CardTitle className="!text-sm !leading-snug break-words overflow-wrap-anywhere !m-0">
              {issue.title}
            </CardTitle>
          </div>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 shrink-0 h-5 w-5 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-2.5 w-2.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onViewDetails(issue)}>
                <Eye className="h-3 w-3 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open(issue.url, '_blank')}>
                <ExternalLink className="h-3 w-3 mr-2" />
                Open in Linear
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="!px-3 !pt-0 !pb-3">
        {/* Parent issue info for sub-tasks */}
        {(issue as any).parent && (
          <div className="!mb-2 !p-1.5 rounded !bg-purple-50 dark:!bg-purple-900/20 !border !border-purple-200 dark:!border-purple-800">
            <div className="flex items-center !gap-1">
              <span className="!text-xs !text-purple-700 dark:!text-purple-400">
                Parent:
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="!text-xs !px-2 !py-0.5 !h-5 cursor-help !border-purple-300 dark:!border-purple-700"
                    >
                      {(issue as any).parent.identifier}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs font-medium">{(issue as any).parent.title}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        )}

        {/* Description */}
        {issue.description && (
          <p className="!text-xs text-muted-foreground !mb-2 line-clamp-2">
            {LinearHelpers.stripMetadataFromDescription(issue.description)}
          </p>
        )}

        {/* Labels */}
        {labels.length > 0 && (
          <div className="flex flex-wrap !gap-2 !mb-2">
            {labels.map((label) => (
              <Badge
                key={label.id}
                variant="outline"
                className="!text-xs !px-2 !py-0.5 !h-5"
                style={{
                  borderColor: label.color,
                  color: label.color,
                }}
              >
                {label.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Project */}
        {issue.project && (
          <div className="flex items-center !gap-2 !mb-2">
            <Badge variant="secondary" className="!text-xs !px-2 !py-0.5 !h-5">
              {issue.project.name}
            </Badge>
          </div>
        )}

        {/* Sub-issues progress bar */}
        {!((issue as any).parent) && subIssuesProgress && (
          <div className="!mb-2 sub-issue-progress">
            <div className="flex items-center justify-between !mb-1">
              <span className="!text-xs text-muted-foreground flex items-center !gap-1">
                <GitBranch className="h-3 w-3" />
                Sub-tasks
              </span>
              <span
                className={`!text-xs ${
                  subIssuesProgress.completedCount === subIssuesProgress.totalCount
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-muted-foreground'
                }`}
              >
                {subIssuesProgress.completedCount}/{subIssuesProgress.totalCount}
              </span>
            </div>
            <Progress
              value={subIssuesProgress.percentage}
              className={`h-1.5 sub-issue-progress-bar ${
                subIssuesProgress.percentage >= 75 ? 'high-completion' : ''
              } ${subIssuesProgress.completedCount === subIssuesProgress.totalCount ? 'completed' : ''}`}
            />
          </div>
        )}

        {/* Footer with assignee and metadata */}
        <div className="flex items-center justify-between !gap-2 !text-xs !min-h-[24px] !pt-1.5 border-t">
          <div className="flex items-center !gap-2">
            {issue.assignee && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Avatar className="!h-5 !w-5">
                      <AvatarImage src={issue.assignee.avatarUrl} />
                      <AvatarFallback className="!text-xs">
                        {issue.assignee.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>{issue.assignee.name}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {issue.estimate && (
              <Badge variant="secondary" className="!text-xs !px-2 !py-0.5 !h-5">
                {issue.estimate}h
              </Badge>
            )}
          </div>
          <div className="!text-xs text-muted-foreground">{formatDate(issue.updatedAt)}</div>
        </div>
      </CardContent>
    </Card>
  );
};

export const IssueCard = React.memo(IssueCardComponent);