/**
 * Team List Item Component
 * 
 * Professional team list item with clean design
 * Optimized with React.memo to prevent unnecessary re-renders
 * 
 * Features:
 * - Clean, minimal design matching Teifi branding
 * - Hover states and smooth transitions
 * - Team badge display
 * - Sub-team support with recursive rendering
 * 
 * Follows KISS and Performance principles from Guidelines.md
 */

import React, { memo } from 'react';
import { Badge } from '../ui/badge';
import { Circle } from 'lucide-react';

interface TeamListItemProps {
  team: {
    id: string;
    name: string;
    key: string;
    description?: string;
    children?: any[];
  };
  level: number;
  onTeamClick: (teamId: string) => void;
}

const TeamListItemComponent = ({ team, level, onTeamClick }: TeamListItemProps) => {
  const hasChildren = team.children && team.children.length > 0;

  return (
    <div>
      <button
        onClick={() => onTeamClick(team.id)}
        className="w-full text-left hover:bg-accent/50 rounded-md transition-colors group p-3"
        style={{ paddingLeft: `${level * 1.5 + 0.75}rem` }}
      >
        <div className="flex items-center gap-3">
          {/* Team Icon */}
          <div className="flex-shrink-0 w-8 h-8 rounded-md bg-muted flex items-center justify-center">
            <Circle className="h-3 w-3 fill-muted-foreground text-muted-foreground" />
          </div>

          {/* Team Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {team.name}
              </span>
              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                {team.key}
              </Badge>
            </div>
          </div>
        </div>
      </button>

      {/* Render children recursively */}
      {hasChildren && (
        <div>
          {team.children!.map(child => (
            <TeamListItem
              key={child.id}
              team={child}
              level={level + 1}
              onTeamClick={onTeamClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Memoize to prevent unnecessary re-renders
export const TeamListItem = memo(TeamListItemComponent);