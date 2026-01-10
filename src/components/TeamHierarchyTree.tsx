/**
 * 🌳 Team Hierarchy Tree Component
 * 
 * Reusable component để hiển thị Linear Team Hierarchy với parent-child relationships.
 * Có thể dùng trong Sidebar, Admin panel, hoặc bất kỳ đâu cần show team structure.
 * 
 * Features:
 * - Recursive rendering (unlimited depth)
 * - Expand/collapse functionality
 * - Custom render functions
 * - Permission filtering
 * - Loading & empty states
 * 
 * Version: 1.0.0
 * Date: 2025-10-11
 */

import React, { useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { 
  ChevronDown, 
  ChevronRight,
  Network,
  Kanban,
  Folder,
  FolderOpen
} from "lucide-react";

export interface TeamNode {
  id: string;
  name: string;
  key?: string;
  description?: string;
  color?: string;
  icon?: string;
  level: number;
  childCount?: number;
  totalDescendants?: number;
  children?: TeamNode[];
  parentId?: string | null; // Schema V2.0: camelCase
  parentName?: string | null; // Schema V2.0: camelCase
  membersCount?: number; // Schema V2.0: camelCase
  customersCount?: number; // Schema V2.0: camelCase
  // Backward compatibility
  parent_id?: string | null;
  parent_name?: string | null;
  members_count?: number;
  customers_count?: number;
  [key: string]: any; // Allow additional properties
}

export interface TeamHierarchyTreeProps {
  /** Team hierarchy data (array of root teams) */
  teams: TeamNode[];
  
  /** Custom renderer for each team node */
  renderTeam?: (team: TeamNode, depth: number) => React.ReactNode;
  
  /** Filter function to determine which teams to show */
  filterTeam?: (team: TeamNode) => boolean;
  
  /** Callback when team is clicked */
  onTeamClick?: (team: TeamNode) => void;
  
  /** ID of currently selected team */
  selectedTeamId?: string | null;
  
  /** Show expand/collapse buttons */
  collapsible?: boolean;
  
  /** Default expanded state */
  defaultExpanded?: boolean;
  
  /** Show child count badges */
  showChildCount?: boolean;
  
  /** Show team key badges */
  showTeamKey?: boolean;
  
  /** Icon type: 'network' | 'folder' | 'kanban' */
  iconType?: 'network' | 'folder' | 'kanban';
  
  /** Indent size per level (in pixels) */
  indentSize?: number;
  
  /** Custom class names */
  className?: string;
  
  /** Show visual tree lines */
  showTreeLines?: boolean;
}

export function TeamHierarchyTree({
  teams,
  renderTeam,
  filterTeam,
  onTeamClick,
  selectedTeamId = null,
  collapsible = true,
  defaultExpanded = true,
  showChildCount = true,
  showTeamKey = true,
  iconType = 'network',
  indentSize = 16,
  className = '',
  showTreeLines = true,
}: TeamHierarchyTreeProps) {
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>(() => {
    // Auto-expand all teams by default if defaultExpanded is true
    if (defaultExpanded) {
      const expanded: Record<string, boolean> = {};
      const markExpanded = (teams: TeamNode[]) => {
        teams.forEach(team => {
          if (team.children && team.children.length > 0) {
            expanded[team.id] = true;
            markExpanded(team.children);
          }
        });
      };
      markExpanded(teams);
      return expanded;
    }
    return {};
  });

  const toggleExpanded = (teamId: string) => {
    setExpandedTeams(prev => ({
      ...prev,
      [teamId]: !prev[teamId]
    }));
  };

  const getIcon = (team: TeamNode, hasChildren: boolean) => {
    const isExpanded = expandedTeams[team.id];
    
    switch (iconType) {
      case 'folder':
        return hasChildren 
          ? (isExpanded ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />)
          : <Kanban className="h-4 w-4" />;
      
      case 'kanban':
        return <Kanban className="h-4 w-4" />;
      
      case 'network':
      default:
        return hasChildren 
          ? <Network className="h-4 w-4" /> 
          : <Kanban className="h-4 w-4" />;
    }
  };

  const renderNode = (team: TeamNode, depth: number): React.ReactNode => {
    // Apply filter if provided
    if (filterTeam && !filterTeam(team)) {
      return null;
    }

    const isExpanded = expandedTeams[team.id] !== false; // Default expanded
    const hasChildren = team.children && team.children.length > 0;
    const isSelected = selectedTeamId === team.id;
    const indent = depth * indentSize;

    // Filter accessible children
    const accessibleChildren = hasChildren
      ? team.children!.filter(child => !filterTeam || filterTeam(child))
      : [];

    // Custom renderer if provided
    if (renderTeam) {
      return (
        <div key={team.id}>
          {renderTeam(team, depth)}
          {/* Still render children recursively */}
          {isExpanded && accessibleChildren.length > 0 && (
            <div className={showTreeLines ? "ml-2 border-l border-border/50" : ""}>
              {accessibleChildren.map(child => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // Default rendering
    return (
      <div key={team.id} className="space-y-1">
        <div 
          className="flex items-center gap-1 group relative"
          style={{ paddingLeft: `${indent}px` }}
        >
          {/* Expand/collapse button */}
          {collapsible && accessibleChildren.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-primary/10 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(team.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
          )}

          {/* Spacer for leaf nodes or non-collapsible */}
          {(!collapsible || accessibleChildren.length === 0) && depth > 0 && (
            <div className="w-6 flex-shrink-0" />
          )}

          {/* Team button */}
          <Button
            variant={isSelected ? "secondary" : "ghost"}
            className={`
              flex-1 justify-start gap-2 h-9 px-2
              ${isSelected 
                ? "bg-primary/10 text-primary font-medium border-l-2 border-primary" 
                : "text-foreground hover:bg-muted"
              }
              transition-all duration-200
            `}
            onClick={() => onTeamClick?.(team)}
          >
            {/* Icon */}
            {getIcon(team, accessibleChildren.length > 0)}

            {/* Team name */}
            <span className="truncate text-sm">{team.name}</span>

            {/* Key badge */}
            {showTeamKey && team.key && (
              <Badge variant="outline" className="ml-auto text-xs h-5 px-1.5">
                {team.key}
              </Badge>
            )}

            {/* Child count badge */}
            {showChildCount && accessibleChildren.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">
                {accessibleChildren.length}
              </Badge>
            )}

            {/* Member count (if available) */}
            {/* Schema V2.0: Support both camelCase and snake_case */}
            {((team.membersCount ?? team.members_count) !== undefined && 
              (team.membersCount ?? team.members_count)! > 0) && (
              <Badge variant="outline" className="ml-1 text-xs h-5 px-1.5">
                {team.membersCount ?? team.members_count} members
              </Badge>
            )}
          </Button>
        </div>

        {/* Render children */}
        {isExpanded && accessibleChildren.length > 0 && (
          <div className={showTreeLines ? "ml-2 border-l border-border/50" : ""}>
            {accessibleChildren.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!teams || teams.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {teams.map(team => renderNode(team, 0))}
    </div>
  );
}

/**
 * 🎨 Compact variant - smaller padding and text
 */
export function TeamHierarchyTreeCompact(props: TeamHierarchyTreeProps) {
  return (
    <div className="text-sm">
      <TeamHierarchyTree 
        {...props} 
        indentSize={12}
        className="space-y-0.5"
      />
    </div>
  );
}

/**
 * 📋 Flat list variant - no hierarchy, just list all teams
 */
export function TeamFlatList({
  teams,
  filterTeam,
  onTeamClick,
  selectedTeamId,
  showTeamKey = true,
  className = '',
}: Pick<TeamHierarchyTreeProps, 'teams' | 'filterTeam' | 'onTeamClick' | 'selectedTeamId' | 'showTeamKey' | 'className'>) {
  // Flatten hierarchy
  const flattenTeams = (teams: TeamNode[]): TeamNode[] => {
    const flat: TeamNode[] = [];
    const traverse = (teams: TeamNode[]) => {
      teams.forEach(team => {
        flat.push(team);
        if (team.children) {
          traverse(team.children);
        }
      });
    };
    traverse(teams);
    return flat;
  };

  const flatTeams = flattenTeams(teams).filter(team => !filterTeam || filterTeam(team));

  return (
    <div className={`space-y-1 ${className}`}>
      {flatTeams.map(team => {
        const isSelected = selectedTeamId === team.id;
        return (
          <Button
            key={team.id}
            variant={isSelected ? "secondary" : "ghost"}
            className={`
              w-full justify-start gap-3 h-10 px-3
              ${isSelected 
                ? "bg-primary/10 text-primary font-medium border-l-2 border-primary" 
                : "text-foreground hover:bg-muted"
              }
              transition-all duration-200
            `}
            onClick={() => onTeamClick?.(team)}
          >
            <Kanban className="h-4 w-4 flex-shrink-0" />
            <span className="truncate text-sm">{team.name}</span>
            {showTeamKey && team.key && (
              <Badge variant="outline" className="ml-auto text-xs h-5">
                {team.key}
              </Badge>
            )}
          </Button>
        );
      })}
    </div>
  );
}

/**
 * Stats summary for hierarchy
 */
export function TeamHierarchyStats({ teams }: { teams: TeamNode[] }) {
  const getTotalTeamsAndDepth = (teams: TeamNode[]): { total: number; maxDepth: number } => {
    let total = 0;
    let maxDepth = 0;

    const traverse = (teams: TeamNode[], depth: number) => {
      teams.forEach(team => {
        total++;
        maxDepth = Math.max(maxDepth, depth);
        if (team.children) {
          traverse(team.children, depth + 1);
        }
      });
    };

    traverse(teams, 1);
    return { total, maxDepth };
  };

  const { total, maxDepth } = getTotalTeamsAndDepth(teams);
  const rootCount = teams.length;

  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <div>
        <span className="font-medium">{total}</span> teams
      </div>
      <div>
        <span className="font-medium">{rootCount}</span> root
      </div>
      <div>
        <span className="font-medium">{maxDepth}</span> max depth
      </div>
    </div>
  );
}
