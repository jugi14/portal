import React from 'react';
import { Calendar, User, Clock, Hash, Tag } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import type { LinearIssue } from '../../services/linearTeamIssuesService';
import { formatDate, getPriorityLabel } from './utils';

interface IssueMetadataProps {
  issue: LinearIssue;
}

export function IssueMetadata({ issue }: IssueMetadataProps) {
  return (
    <div className="space-y-3">
      {issue.assignee && (
        <div className="flex items-center gap-3">
          <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Avatar className="h-6 w-6">
              <AvatarImage src={issue.assignee.avatarUrl || undefined} />
              <AvatarFallback className="text-xs">
                {issue.assignee.name?.substring(0, 2).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-foreground truncate">
              {issue.assignee.name || 'Unassigned'}
            </span>
          </div>
        </div>
      )}

      {issue.createdAt && (
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm text-muted-foreground">
            Created {formatDate(issue.createdAt)}
          </span>
        </div>
      )}

      {issue.updatedAt && (
        <div className="flex items-center gap-3">
          <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm text-muted-foreground">
            Updated {formatDate(issue.updatedAt)}
          </span>
        </div>
      )}

      {issue.estimate !== undefined && issue.estimate !== null && (
        <div className="flex items-center gap-3">
          <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm text-muted-foreground">
            Estimate: {issue.estimate} {issue.estimate === 1 ? 'point' : 'points'}
          </span>
        </div>
      )}

      {issue.labels && issue.labels.nodes && issue.labels.nodes.length > 0 && (
        <div className="flex items-start gap-3">
          <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="flex flex-wrap gap-1.5 flex-1">
            {issue.labels.nodes.map((label: any) => (
              <Badge
                key={label.id}
                variant="outline"
                className="text-xs px-2 py-0.5"
                style={{
                  borderColor: `#${label.color}40`,
                  backgroundColor: `#${label.color}10`,
                  color: `#${label.color}`,
                }}
              >
                {label.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
