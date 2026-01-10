/**
 * SidebarFooter Component
 * 
 * Bottom section with logout button
 * User info is in Header, so this only shows Sign Out
 */

import React from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

interface SidebarFooterProps {
  isCollapsed: boolean;
  onLogout: () => void;
}

export function SidebarFooter({ isCollapsed, onLogout }: SidebarFooterProps) {
  return (
    <div 
      className={`border-t border-sidebar-border bg-gradient-to-t from-muted/30 ${isCollapsed ? 'p-2' : 'p-3'}`} 
      data-sidebar-footer
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className={`
              w-full text-destructive hover:text-destructive hover:bg-destructive/10
              ${isCollapsed ? 'justify-center px-0' : 'justify-start gap-2'}
            `}
            data-sidebar-logout
          >
            <LogOut className="h-4 w-4" />
            {!isCollapsed && <span className="text-sm">Sign Out</span>}
          </Button>
        </TooltipTrigger>
        {isCollapsed && (
          <TooltipContent side="right">
            Sign Out
          </TooltipContent>
        )}
      </Tooltip>
    </div>
  );
}
