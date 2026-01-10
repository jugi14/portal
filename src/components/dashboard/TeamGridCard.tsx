/**
 * Team Grid Card Component
 * 
 * Professional grid card for team display
 * Optimized with React.memo for grid view performance
 * 
 * Features:
 * - Clean card design with hover effects
 * - Team badge and metadata display
 * - Sub-team count indicator
 * - Responsive layout
 * 
 * Follows KISS and Performance principles from Guidelines.md
 */

import React, { memo } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Circle, FolderTree } from 'lucide-react';

interface TeamGridCardProps {
  team: {
    id: string;
    name: string;
    key: string;
    description?: string;
    children?: any[];
  };
  onClick: (teamId: string) => void;
}

const TeamGridCardComponent = ({ team, onClick }: TeamGridCardProps) => {
  const hasChildren = team.children && team.children.length > 0;

  return (
    <Card 
      className="hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group"
      onClick={() => onClick(team.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Team Icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-md bg-muted flex items-center justify-center">
            {hasChildren ? (
              <FolderTree className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Circle className="h-4 w-4 fill-muted-foreground text-muted-foreground" />
            )}
          </div>

          {/* Team Info */}
          <div className="flex-1 min-w-0">
            <div className="space-y-1">
              <h3 className="truncate">{team.name}</h3>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                  {team.key}
                </Badge>
                {hasChildren && (
                  <span className="text-xs text-muted-foreground">
                    {team.children.length} sub-team{team.children.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            {team.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                {team.description}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Memoize to prevent re-renders when parent updates
export const TeamGridCard = memo(TeamGridCardComponent);