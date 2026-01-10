import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Ship,
  MoreVertical,
  User,
  Calendar,
  ArrowRight,
  Filter,
  SortAsc,
  Eye,
  MessageSquare,
  ExternalLink
} from 'lucide-react';
import { LinearIssue } from '../services/linearTeamIssuesService';
import { LinearHelpers } from '../services/linear';

interface MobileKanbanViewProps {
  issues: {
    pendingReview: LinearIssue[];
    approved: LinearIssue[];
    released: LinearIssue[];
    needsInput: LinearIssue[];
    failedReview: LinearIssue[];
  };
  onIssueAction: (issueId: string, action: string) => void;
  onIssueSelect: (issue: LinearIssue) => void;
}

const COLUMN_CONFIGS = {
  pendingReview: {
    title: 'Pending Review',
    icon: Clock,
    color: 'bg-yellow-500',
    badgeColor: 'bg-yellow-100 text-yellow-800',
    count: 0
  },
  approved: {
    title: 'Approved',
    icon: CheckCircle,
    color: 'bg-green-500',
    badgeColor: 'bg-green-100 text-green-800',
    count: 0
  },
  released: {
    title: 'Released',
    icon: Ship,
    color: 'bg-blue-500',
    badgeColor: 'bg-blue-100 text-blue-800',
    count: 0
  },
  needsInput: {
    title: 'Needs Input',
    icon: AlertTriangle,
    color: 'bg-orange-500',
    badgeColor: 'bg-orange-100 text-orange-800',
    count: 0
  },
  failedReview: {
    title: 'Failed Review',
    icon: XCircle,
    color: 'bg-red-500',
    badgeColor: 'bg-red-100 text-red-800',
    count: 0
  }
};

export function MobileKanbanView({ issues, onIssueAction, onIssueSelect }: MobileKanbanViewProps) {
  const [activeColumn, setActiveColumn] = useState<keyof typeof issues>('pendingReview');
  const [sortBy, setSortBy] = useState<'updated' | 'priority' | 'title'>('updated');
  const [filterBy, setFilterBy] = useState<'all' | 'assigned' | 'unassigned'>('all');

  // Update column counts
  const columnConfigs = { ...COLUMN_CONFIGS };
  Object.keys(columnConfigs).forEach(key => {
    const columnKey = key as keyof typeof issues;
    columnConfigs[columnKey].count = issues[columnKey].length;
  });

  const sortIssues = (issueList: LinearIssue[]) => {
    return [...issueList].sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return (b.priority || 0) - (a.priority || 0);
        case 'title':
          return a.title.localeCompare(b.title);
        case 'updated':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });
  };

  const filterIssues = (issueList: LinearIssue[]) => {
    switch (filterBy) {
      case 'assigned':
        return issueList.filter(issue => issue.assignee);
      case 'unassigned':
        return issueList.filter(issue => !issue.assignee);
      case 'all':
      default:
        return issueList;
    }
  };

  const processedIssues = sortIssues(filterIssues(issues[activeColumn]));

  const getPriorityColor = (priority?: number) => {
    switch (priority) {
      case 4: return 'bg-red-500 text-white';
      case 3: return 'bg-orange-500 text-white';
      case 2: return 'bg-yellow-500 text-white';
      case 1: return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleQuickAction = (issue: LinearIssue, action: string) => {
    onIssueAction(issue.id, action);
    
    switch (action) {
      case 'approve':
        toast.success('Issue approved');
        break;
      case 'request-changes':
        toast.success('Changes requested');
        break;
      case 'provide-input':
        toast.info('Input dialog opened');
        break;
      default:
        break;
    }
  };

  const renderIssueCard = (issue: LinearIssue) => {
    const daysSinceUpdate = Math.floor(
      (new Date().getTime() - new Date(issue.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    return (
      <Card 
        key={issue.id} 
        className="mb-3 border-l-4 border-l-primary hover:shadow-md transition-shadow"
        onClick={() => onIssueSelect(issue)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-xs">
                  {issue.identifier}
                </Badge>
                {issue.priority !== undefined && (
                  <Badge className={`text-xs ${getPriorityColor(issue.priority)}`}>
                    {issue.priorityLabel || `P${issue.priority}`}
                  </Badge>
                )}
              </div>
              <CardTitle className="text-sm font-medium leading-tight line-clamp-2">
                {issue.title}
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                // Show action menu or perform quick action
                if (activeColumn === 'pendingReview') {
                  handleQuickAction(issue, 'approve');
                } else if (activeColumn === 'needsInput') {
                  handleQuickAction(issue, 'provide-input');
                }
              }}
              className="ml-2 h-8 w-8 p-0"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {issue.description && (
            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
              {LinearHelpers.stripMetadataFromDescription(issue.description)}
            </p>
          )}

          {/* Column-specific actions */}
          {activeColumn === 'pendingReview' && (
            <div className="flex gap-2 mb-3">
              <Button 
                size="sm" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleQuickAction(issue, 'approve');
                }}
                className="flex-1 text-xs h-8"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Approve
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  handleQuickAction(issue, 'request-changes');
                }}
                className="flex-1 text-xs h-8"
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                Changes
              </Button>
            </div>
          )}

          {activeColumn === 'needsInput' && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                handleQuickAction(issue, 'provide-input');
              }}
              className="w-full text-xs h-8 mb-3"
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              Provide Input
            </Button>
          )}

          {/* Issue footer */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <div className="flex items-center gap-2">
              {issue.assignee && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span className="truncate max-w-20">
                    {issue.assignee.name.split(' ')[0]}
                  </span>
                </div>
              )}
              {issue.estimate && (
                <Badge variant="secondary" className="text-xs">
                  {issue.estimate}h
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{daysSinceUpdate}d ago</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Mobile Header */}
      <div className="flex-shrink-0 p-4 border-b">
        <h2 className="text-lg font-semibold mb-3">Issues Dashboard</h2>
        
        {/* Column Tabs */}
        <Tabs value={activeColumn} onValueChange={(value) => setActiveColumn(value as keyof typeof issues)}>
          <TabsList className="grid w-full grid-cols-5 h-auto p-1">
            {Object.entries(columnConfigs).map(([key, config]) => {
              const IconComponent = config.icon;
              return (
                <TabsTrigger 
                  key={key} 
                  value={key}
                  className="flex flex-col gap-1 py-2 px-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <IconComponent className="h-3 w-3" />
                  <span className="text-xs leading-none">{config.title.split(' ')[0]}</span>
                  <Badge 
                    variant="secondary" 
                    className="text-xs h-4 min-w-[16px] px-1"
                  >
                    {config.count}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {/* Controls */}
      <div className="flex-shrink-0 p-4 border-b bg-muted/30">
        <div className="flex gap-2">
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="flex-1 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  Latest
                </div>
              </SelectItem>
              <SelectItem value="priority">
                <div className="flex items-center gap-2">
                  <SortAsc className="h-3 w-3" />
                  Priority
                </div>
              </SelectItem>
              <SelectItem value="title">
                <div className="flex items-center gap-2">
                  <SortAsc className="h-3 w-3" />
                  Title
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterBy} onValueChange={(value: any) => setFilterBy(value)}>
            <SelectTrigger className="flex-1 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <Filter className="h-3 w-3" />
                  All Issues
                </div>
              </SelectItem>
              <SelectItem value="assigned">
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3" />
                  Assigned
                </div>
              </SelectItem>
              <SelectItem value="unassigned">
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3" />
                  Unassigned
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Issues List */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4">
            {processedIssues.length === 0 ? (
              <div className="text-center py-12">
                <div className="p-4 bg-muted rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  {React.createElement(columnConfigs[activeColumn].icon, { 
                    className: "h-8 w-8 text-muted-foreground" 
                  })}
                </div>
                <h3 className="font-medium mb-2">No issues in {columnConfigs[activeColumn].title}</h3>
                <p className="text-sm text-muted-foreground">
                  {activeColumn === 'pendingReview' 
                    ? 'New issues will appear here for review'
                    : `Issues will appear here when moved to ${columnConfigs[activeColumn].title}`
                  }
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">
                    {columnConfigs[activeColumn].title}
                  </h3>
                  <Badge className={columnConfigs[activeColumn].badgeColor} variant="secondary">
                    {processedIssues.length} {processedIssues.length === 1 ? 'issue' : 'issues'}
                  </Badge>
                </div>
                
                {processedIssues.map(issue => renderIssueCard(issue))}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Quick Actions Footer */}
      <div className="flex-shrink-0 p-4 border-t bg-background">
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => {
              // Navigate to full desktop view
              window.location.href = `${window.location.pathname}?view=desktop`;
            }}
          >
            <Eye className="h-4 w-4 mr-2" />
            Desktop View
          </Button>
        </div>
      </div>
    </div>
  );
}