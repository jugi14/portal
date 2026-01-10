/**
 * SidebarTeamList Component
 * 
 * Renders teams navigation section with hierarchy and flat view support
 * CRITICAL: Shows only accessible teams based on user permissions
 */

import React from 'react';
import { 
  Kanban, 
  FolderTree, 
  Layers, 
  Bug, 
  RefreshCw, 
  Settings,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { TeamHierarchyNode } from './types';
import { SidebarTeamItem } from './SidebarTeamItem';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner@2.0.3';

/**
 * TeamListSkeleton - Skeleton loading state for team list
 * Mimics the structure of real team items for smooth loading UX
 * Matches the design: customer groups with nested team items
 */
function TeamListSkeleton({ isCollapsed }: { isCollapsed: boolean }) {
  if (isCollapsed) {
    return (
      <div className="space-y-2 px-2" data-sidebar-skeleton>
        {/* Collapsed skeleton - just icon placeholders */}
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-3" data-sidebar-skeleton>
      {/* Customer group 1 skeleton */}
      <div className="space-y-1">
        {/* Customer group header with folder icon */}
        <div className="flex items-center gap-2 px-2 py-2">
          <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
          <Skeleton className="h-4 w-24" />
          <div className="flex-1" />
          <Skeleton className="h-3 w-3 rounded" />
        </div>
        
        {/* Team items under customer group */}
        <div className="pl-4 space-y-1">
          {/* Team item 1 */}
          <div className="flex items-center gap-2 px-2 py-2.5 rounded-md">
            <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          
          {/* Team item 2 */}
          <div className="flex items-center gap-2 px-2 py-2.5 rounded-md">
            <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-10 rounded-full" />
          </div>
        </div>
      </div>

      {/* Customer group 2 skeleton (optional, for variety) */}
      <div className="space-y-1">
        {/* Customer group header */}
        <div className="flex items-center gap-2 px-2 py-2">
          <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
          <Skeleton className="h-4 w-20" />
          <div className="flex-1" />
          <Skeleton className="h-3 w-3 rounded" />
        </div>
        
        {/* Team item under customer group */}
        <div className="pl-4 space-y-1">
          <div className="flex items-center gap-2 px-2 py-2.5 rounded-md">
            <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface SidebarTeamListProps {
  isCollapsed: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  teamHierarchy: TeamHierarchyNode[];
  flatTeams: TeamHierarchyNode[];
  expandedTeams: Record<string, boolean>;
  loadingTeams: boolean;
  teamsError: string | null;
  useHierarchyView: boolean;
  onToggleView: () => void;
  onNavigate: (teamId: string, teamName: string) => void;
  onToggleTeam: (teamId: string) => void;
  onRetry: () => void;
  hasTeamAccess: (teamId: string) => boolean;
  isAdmin: boolean;
  hasViewAdminPermission: boolean;
}

export function SidebarTeamList({
  isCollapsed,
  isOpen,
  onOpenChange,
  teamHierarchy,
  flatTeams,
  expandedTeams,
  loadingTeams,
  teamsError,
  useHierarchyView,
  onToggleView,
  onNavigate,
  onToggleTeam,
  onRetry,
  hasTeamAccess,
  isAdmin,
  hasViewAdminPermission,
}: SidebarTeamListProps) {
  const location = useLocation();

  // Render team hierarchy recursively
  const renderTeamHierarchy = (team: TeamHierarchyNode, depth = 0): React.ReactNode => {
    const hasDirectAccess = isAdmin || hasTeamAccess(team.id);
    const hasChildren = team.children && team.children.length > 0;
    
    // Filter accessible children
    const accessibleChildren = hasChildren 
      ? team.children!.filter(child => {
          const childHasAccess = isAdmin || hasTeamAccess(child.id);
          const childHasAccessibleDescendants = child.children && child.children.length > 0;
          return childHasAccess || childHasAccessibleDescendants;
        })
      : [];
    
    const shouldShow = hasDirectAccess || accessibleChildren.length > 0;
    
    if (!shouldShow) {
      return null;
    }

    const isExpanded = expandedTeams[team.id] !== false;
    const isActive = location.pathname.includes(`/teams/${team.id}`);

    return (
      <SidebarTeamItem
        key={team.id}
        team={team}
        depth={depth}
        isActive={isActive}
        isExpanded={isExpanded}
        hasAccessibleChildren={accessibleChildren.length > 0}
        onNavigate={onNavigate}
        onToggleExpand={onToggleTeam}
        onRenderChildren={renderTeamHierarchy}
      />
    );
  };

  // Render flat list of teams
  const renderFlatTeams = () => {
    const accessibleTeamsList = flatTeams.filter(team => 
      isAdmin || hasTeamAccess(team.id)
    );

    if (accessibleTeamsList.length === 0) {
      return null;
    }

    return (
      <div className="space-y-1">
        {accessibleTeamsList.map(team => {
          const isActive = location.pathname.includes(`/teams/${team.id}`);
          return (
            <Button
              key={team.id}
              variant={isActive ? "secondary" : "ghost"}
              className={`
                w-full justify-start gap-3 h-10 px-3
                ${isActive 
                  ? "bg-primary/10 text-primary font-medium border-l-2 border-primary" 
                  : "text-foreground hover:bg-muted hover:text-foreground"
                }
                transition-all duration-200
              `}
              onClick={() => onNavigate(team.id, team.name)}
            >
              <Kanban className="h-4 w-4 flex-shrink-0" />
              <span className="truncate text-sm">{team.name}</span>
              {team.key && (
                <Badge variant="outline" className="ml-auto text-xs h-5">
                  {team.key}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>
    );
  };

  return (
    <Collapsible 
      open={isCollapsed ? false : isOpen} 
      onOpenChange={isCollapsed ? undefined : onOpenChange}
    >
      {!isCollapsed && (
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-2 w-full mb-2">
            <Button
              variant="ghost"
              className="flex-1 justify-between h-7 px-2 text-xs font-semibold text-muted-foreground/80 hover:text-foreground hover:bg-transparent"
              data-sidebar-section-header
            >
              <span className="tracking-wider uppercase text-[10px]">Your Teams</span>
              {isOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>

            {/* View toggle - hierarchy vs flat */}
            {teamHierarchy.length > 0 && !loadingTeams && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-primary/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleView();
                }}
                title={useHierarchyView ? "Switch to flat view" : "Switch to hierarchy view"}
              >
                {useHierarchyView ? (
                  <FolderTree className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </Button>
            )}
          </div>
        </CollapsibleTrigger>
      )}
      
      <CollapsibleContent className="space-y-1 mb-3 max-h-[85vh] overflow-y-auto">
        {loadingTeams ? (
          <TeamListSkeleton isCollapsed={isCollapsed} />
        ) : teamsError ? (
          <div className="px-3 py-4 text-center" data-sidebar-empty-state>
            <Bug className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground mb-3">{teamsError}</p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={onRetry}
              className="text-xs gap-2"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </Button>
          </div>
        ) : useHierarchyView && teamHierarchy.length > 0 ? (
          <div className="space-y-1">
            {teamHierarchy.map(rootTeam => renderTeamHierarchy(rootTeam, 0))}
          </div>
        ) : flatTeams.length > 0 ? (
          renderFlatTeams()
        ) : (
          <div className="px-3 py-4 text-center space-y-2" data-sidebar-empty-state>
            <div className="p-3 bg-muted/50 rounded-lg inline-block">
              <Kanban className="h-8 w-8 mx-auto text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">
                No teams assigned
              </p>
              <p className="text-xs text-muted-foreground">
                {isAdmin 
                  ? 'Create teams in Admin panel' 
                  : 'Contact your admin for team access'}
              </p>
            </div>
            {isAdmin && hasViewAdminPermission && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Navigate to Teams admin page
                  onNavigate('/admin/teams', 'Manage Teams');
                }}
                className="text-xs mt-2 gap-1.5"
                title="Go to Teams management page"
              >
                <Settings className="h-3 w-3" />
                Manage Teams
              </Button>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}