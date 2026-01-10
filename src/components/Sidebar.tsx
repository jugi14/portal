/**
 * Sidebar Component - Main Navigation
 * 
 * Professional sidebar navigation for Teifi Client Portal
 * Supports desktop (collapsible) and mobile (sheet) modes
 * 
 * ARCHITECTURE:
 * - Component-based: Broken into focused sub-components
 * - Hook-based state: useSidebarTeams for team loading
 * - Clean separation: Each section is its own component
 * - Performance optimized: Memoization, smart caching
 * 
 * GUIDELINES COMPLIANCE:
 * - KISS: Simple, focused components (< 300 lines)
 * - DRY: Reused hooks and components
 * - Performance: Efficient rendering, caching
 * - NO EMOJIS: Clean professional code
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { ScrollArea } from './ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { useAuth } from '../contexts/AuthContext';
import { useHasPermission, usePermissions } from '../contexts/PermissionContext';
import { useSidebar } from '../contexts/SidebarContext';
import { toast } from 'sonner@2.0.3';

// Sub-components
// import { SidebarNavigation } from './sidebar/SidebarNavigation'; // MOVED TO HEADER
import { SidebarTeamList } from './sidebar/SidebarTeamList';
// import { SidebarFooter } from './sidebar/SidebarFooter'; // REMOVED: Sign out now in Header user menu

// Custom hook
import { useSidebarTeams } from './sidebar/useSidebarTeams';

// Types
import type { SidebarProps } from './sidebar/types';

export function Sidebar({ 
  onTabChange, 
  userRole: userRoleProp, 
  canNavigateTo, 
  isNavigating 
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [teamsNavOpen, setTeamsNavOpen] = useState(true); // Teams section always starts open
  const [useHierarchyView, setUseHierarchyView] = useState(true);

  const { user, logout } = useAuth();
  const { userRole, hasTeamAccess } = usePermissions();
  const { isCollapsed, toggleSidebar } = useSidebar();
  
  // Permissions
  const hasViewAdminPermission = useHasPermission('view_admin');

  // Load teams with custom hook
  const {
    teamHierarchy,
    flatTeams,
    expandedTeams,
    loadingTeams,
    teamsError,
    loadTeamsHierarchy,
    toggleTeam,
  } = useSidebarTeams();

  // Track location state to detect staleness
  const locationRef = useRef(location.pathname);

  // Update location ref when location changes
  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  // Force location sync on page visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const actualPath = window.location.pathname;
        const routerPath = location.pathname;

        if (actualPath !== routerPath) {
          // PERFORMANCE: Location mismatch - forcing sync
          navigate(actualPath, { replace: true });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [location.pathname, navigate]);

  // Handle navigation
  const handleNavigate = (path: string, label: string) => {
    // PERFORMANCE: Navigating to route

    // Admin routes are always allowed (protected by PermissionGate in routing)
    const isAdminRoute = path.startsWith('/admin');
    
    // Team navigation is always allowed (already filtered by hasTeamAccess)
    const isTeamRoute = path.startsWith('/teams/');
    
    // CRITICAL: Force reload for team navigation to clear all cache
    if (isTeamRoute) {
      // Extract current teamId from URL
      const currentMatch = location.pathname.match(/\/teams\/([^/?]+)/);
      const currentTeamId = currentMatch ? currentMatch[1] : null;
      
      // Extract target teamId from path
      const targetMatch = path.match(/\/teams\/([^/?]+)/);
      const targetTeamId = targetMatch ? targetMatch[1] : null;
      
      // PERFORMANCE: Team navigation detected
      
      // If navigating to DIFFERENT team, force full page reload
      if (currentTeamId && targetTeamId && currentTeamId !== targetTeamId) {
        // PERFORMANCE: Different team - forcing full page reload
        setMobileOpen(false);
        window.location.href = path;
        return;
      }
      
      // Same team or first load - use normal navigation
      navigate(path);
      setMobileOpen(false);
      return;
    }
    
    // Allow admin routes immediately
    if (isAdminRoute) {
      navigate(path);
      setMobileOpen(false);
      return;
    }
    
    // Check permissions for other routes
    if (canNavigateTo && !canNavigateTo(label.toLowerCase())) {
      toast.error(`Cannot navigate to ${label} at this time`);
      return;
    }

    navigate(path);

    if (onTabChange) {
      onTabChange(label.toLowerCase());
    }

    setMobileOpen(false);
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('[Sidebar] Logout error:', error);
      toast.error('Failed to logout');
    }
  };

  // Check if admin
  const isAdmin = userRole?.role === 'superadmin' || userRole?.role === 'admin';

  // Render sidebar content
  const renderSidebarContent = (forcedExpanded = false) => {
    const effectivelyCollapsed = forcedExpanded ? false : isCollapsed;

    return (
      <div className="h-full flex flex-col bg-sidebar border-r border-sidebar-border relative">
        {/* Collapse Toggle Button - REMOVED FROM HERE */}

        {/* Main Navigation Content - Teams Only */}
        <ScrollArea 
          className={`flex-1 py-4 ${effectivelyCollapsed ? 'px-2' : 'px-3'}`} 
          data-sidebar-scroll
        >
          {/* TEAMS NAVIGATION - Full sidebar dedicated to teams */}
          <SidebarTeamList
            isCollapsed={effectivelyCollapsed}
            isOpen={teamsNavOpen}
            onOpenChange={setTeamsNavOpen}
            teamHierarchy={teamHierarchy}
            flatTeams={flatTeams}
            expandedTeams={expandedTeams}
            loadingTeams={loadingTeams}
            teamsError={teamsError}
            useHierarchyView={useHierarchyView}
            onToggleView={() => setUseHierarchyView(!useHierarchyView)}
            onNavigate={(teamId, teamName) => handleNavigate(`/teams/${teamId}`, teamName)}
            onToggleTeam={toggleTeam}
            onRetry={loadTeamsHierarchy}
            hasTeamAccess={hasTeamAccess}
            isAdmin={isAdmin}
            hasViewAdminPermission={hasViewAdminPermission}
          />

          {/* NAVIGATION - Moved to Header: Dashboard + Admin tabs now in top header */}
        </ScrollArea>

        {/* Footer - Sign out removed: Now in Header user menu for consistent UX */}
      </div>
    );
  };

  return (
    <>
      {/* Mobile trigger */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden fixed top-4 left-4 z-[9999] bg-black/80 hover:bg-black/90 text-white border border-white/20 backdrop-blur-sm"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-72 z-[9998]" data-sidebar-mobile>
          {renderSidebarContent(true)}
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <aside
        className={`
          hidden md:flex flex-col
          fixed top-16 left-0 bottom-0 z-40
          bg-sidebar border-r border-border
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-16' : 'w-80'}
        `}
        data-sidebar-container
        data-collapsed={isCollapsed}
        data-navigating={isNavigating}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Sidebar Toggle Button - OUTSIDE sidebar for proper z-index stacking */}
      <div className="hidden md:block">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className={`
                  fixed top-20 z-[1000]
                  h-10 w-10 rounded-full
                  bg-primary text-primary-foreground
                  hover:bg-primary/90 hover:scale-110
                  shadow-lg hover:shadow-xl
                  transition-all duration-300 ease-out
                  border-2 border-primary-foreground/20
                  ${isCollapsed ? 'left-4' : 'left-[304px]'}
                `}
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-5 w-5" />
                ) : (
                  <ChevronLeft className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12}>
              <p>{isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </>
  );
}
