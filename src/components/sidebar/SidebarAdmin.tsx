/**
 * SidebarAdmin Component
 * 
 * Admin navigation section (Overview, Customers, Users, Teams, System)
 * Only visible to users with admin permissions
 */

import React from 'react';
import { 
  LayoutDashboard,
  Building2,
  Users,
  Kanban,
  Database,
  ChevronDown,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { useLocation } from 'react-router-dom';

interface SidebarAdminProps {
  isCollapsed: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (path: string, tab: string) => void;
  hasManageUsersPermission: boolean;
  hasManageCustomersPermission: boolean;
}

export function SidebarAdmin({
  isCollapsed,
  isOpen,
  onOpenChange,
  onNavigate,
  hasManageUsersPermission,
  hasManageCustomersPermission,
}: SidebarAdminProps) {
  const location = useLocation();

  return (
    <Collapsible 
      open={isCollapsed ? false : isOpen} 
      onOpenChange={isCollapsed ? undefined : onOpenChange}
    >
      {!isCollapsed && (
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between h-7 px-2 mb-2 text-xs font-semibold text-muted-foreground/80 hover:text-foreground hover:bg-transparent"
            data-sidebar-section-header
          >
            <span className="tracking-wider uppercase text-[10px]">Admin</span>
            {isOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        </CollapsibleTrigger>
      )}
      
      <CollapsibleContent className="space-y-1 mb-3">
        {/* Overview */}
        <Button
          variant={location.pathname === '/admin' ? 'secondary' : 'ghost'}
          className={`
            w-full justify-start gap-3 h-10
            ${location.pathname === '/admin' 
              ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary' 
              : 'text-foreground hover:bg-muted'
            }
            transition-all duration-200
          `}
          onClick={() => onNavigate('/admin', 'Admin')}
          data-sidebar-nav-item
        >
          <LayoutDashboard className="h-4 w-4" />
          <span className="text-sm">Overview</span>
        </Button>

        {/* Customers */}
        {hasManageCustomersPermission && (
          <Button
            variant={location.pathname.includes('/admin/customers') ? 'secondary' : 'ghost'}
            className={`
              w-full justify-start gap-3 h-10
              ${location.pathname.includes('/admin/customers') 
                ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary' 
                : 'text-foreground hover:bg-muted'
              }
              transition-all duration-200
            `}
            onClick={() => onNavigate('/admin/customers', 'Customers')}
            data-sidebar-nav-item
          >
            <Building2 className="h-4 w-4" />
            <span className="text-sm">Customers</span>
          </Button>
        )}

        {/* Users */}
        {hasManageUsersPermission && (
          <Button
            variant={location.pathname.includes('/admin/users') ? 'secondary' : 'ghost'}
            className={`
              w-full justify-start gap-3 h-10
              ${location.pathname.includes('/admin/users') 
                ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary' 
                : 'text-foreground hover:bg-muted'
              }
              transition-all duration-200
            `}
            onClick={() => onNavigate('/admin/users', 'Users')}
            data-sidebar-nav-item
          >
            <Users className="h-4 w-4" />
            <span className="text-sm">Users</span>
          </Button>
        )}

        {/* Teams */}
        {hasManageCustomersPermission && (
          <Button
            variant={location.pathname.includes('/admin/teams') ? 'secondary' : 'ghost'}
            className={`
              w-full justify-start gap-3 h-10
              ${location.pathname.includes('/admin/teams') 
                ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary' 
                : 'text-foreground hover:bg-muted'
              }
              transition-all duration-200
            `}
            onClick={() => onNavigate('/admin/teams', 'Teams')}
            data-sidebar-nav-item
          >
            <Kanban className="h-4 w-4" />
            <span className="text-sm">Teams</span>
          </Button>
        )}

        {/* Activity */}
        {hasManageUsersPermission && (
          <Button
            variant={location.pathname.includes('/admin/activity') ? 'secondary' : 'ghost'}
            className={`
              w-full justify-start gap-3 h-10
              ${location.pathname.includes('/admin/activity') 
                ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary' 
                : 'text-foreground hover:bg-muted'
              }
              transition-all duration-200
            `}
            onClick={() => onNavigate('/admin/activity', 'Activity')}
            data-sidebar-nav-item
          >
            <Activity className="h-4 w-4" />
            <span className="text-sm">Activity</span>
          </Button>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}