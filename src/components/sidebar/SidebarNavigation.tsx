/**
 * SidebarNavigation Component
 * 
 * Core navigation section (Dashboard)
 * Clean, simple navigation items
 */

import React from 'react';
import { LayoutDashboard, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

interface SidebarNavigationProps {
  isCollapsed: boolean;
  activeTab: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (path: string, tab: string) => void;
}

export function SidebarNavigation({
  isCollapsed,
  activeTab,
  isOpen,
  onOpenChange,
  onNavigate,
}: SidebarNavigationProps) {
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
            <span className="tracking-wider uppercase text-[10px]">Navigation</span>
            {isOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        </CollapsibleTrigger>
      )}
      
      <CollapsibleContent className="space-y-1 mb-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={activeTab === 'dashboard' ? 'secondary' : 'ghost'}
              className={`
                w-full h-10
                ${isCollapsed ? 'justify-center px-0' : 'justify-start gap-3'}
                ${activeTab === 'dashboard' 
                  ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary' 
                  : 'text-foreground hover:bg-muted'
                }
                transition-all duration-200
              `}
              onClick={() => onNavigate('/', 'Dashboard')}
              data-sidebar-nav-item
            >
              <LayoutDashboard className="h-4 w-4" />
              {!isCollapsed && <span className="text-sm">Dashboard</span>}
            </Button>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right">
              Dashboard
            </TooltipContent>
          )}
        </Tooltip>
      </CollapsibleContent>
    </Collapsible>
  );
}
