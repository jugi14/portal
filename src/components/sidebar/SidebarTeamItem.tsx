/**
 * SidebarTeamItem Component
 * 
 * Renders a single team item in the sidebar with hierarchy support
 * Handles nested teams with expand/collapse functionality
 */

import React from 'react';
import { Kanban, Network, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { TeamHierarchyNode } from './types';

interface SidebarTeamItemProps {
  team: TeamHierarchyNode;
  depth: number;
  isActive: boolean;
  isExpanded: boolean;
  hasAccessibleChildren: boolean;
  onNavigate: (teamId: string, teamName: string) => void;
  onToggleExpand: (teamId: string) => void;
  onRenderChildren: (team: TeamHierarchyNode, depth: number) => React.ReactNode;
}

export function SidebarTeamItem({
  team,
  depth,
  isActive,
  isExpanded,
  hasAccessibleChildren,
  onNavigate,
  onToggleExpand,
  onRenderChildren,
}: SidebarTeamItemProps) {
  const indent = depth * 16;

  return (
    <div className="space-y-1">
      <div 
        className="flex items-center gap-1 group relative"
        style={{ paddingLeft: `${indent}px` }}
      >
        {/* Expand/collapse button for parents */}
        {hasAccessibleChildren && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-primary/10 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(team.id);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </Button>
        )}

        {/* Spacer for leaf nodes */}
        {!hasAccessibleChildren && depth > 0 && (
          <div className="w-6 flex-shrink-0" />
        )}

        {/* Team navigation button */}
        <Button
          variant={isActive ? "secondary" : "ghost"}
          className={`
            flex-1 justify-start gap-2 h-9 px-2
            ${isActive 
              ? "bg-primary/10 text-primary font-medium border-l-2 border-primary" 
              : "text-foreground hover:bg-muted hover:text-foreground"
            }
            transition-all duration-200
          `}
          onClick={() => onNavigate(team.id, team.name)}
        >
          {/* Icon - Network for parents, Kanban for leaf */}
          {hasAccessibleChildren ? (
            <Network className="h-4 w-4 flex-shrink-0" />
          ) : (
            <Kanban className="h-4 w-4 flex-shrink-0" />
          )}

          {/* Team name */}
          <span className="truncate text-sm">{team.name}</span>

          {/* Key badge */}
          {team.key && (
            <Badge variant="outline" className="ml-auto text-xs h-5 px-1.5">
              {team.key}
            </Badge>
          )}

          {/* Child count for parent teams */}
          {hasAccessibleChildren && (
            <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">
              {team.children?.length || 0}
            </Badge>
          )}
        </Button>
      </div>

      {/* Render children recursively */}
      {isExpanded && hasAccessibleChildren && team.children && (
        <div className="ml-2 border-l border-border/50">
          {team.children.map(child => onRenderChildren(child, depth + 1))}
        </div>
      )}
    </div>
  );
}
