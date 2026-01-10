import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePermissions, useHasPermission } from '../contexts/PermissionContext';

interface NavigationState {
  activeTab: string;
  navigationAttempts: number;
  isNavigating: boolean;
  error: string | null;
}

export function useAppNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userRole } = usePermissions();
  const hasManageCustomers = useHasPermission('manage_customers');
  
  const [navigationState, setNavigationState] = useState<NavigationState>({
    activeTab: 'dashboard',
    navigationAttempts: 0,
    isNavigating: false,
    error: null
  });

  // Determine active tab from current route with better logic
  const getActiveTab = useCallback(() => {
    const path = location.pathname;
    
    // Dashboard routes - NOW DEFAULT
    if (path === '/dashboard') return 'dashboard';
    if (path === '/') return 'dashboard';
    
    // Teams and team-related routes
    if (path === '/teams') return 'dashboard';
    if (path.startsWith('/teams/')) return 'team-detail';
    
    // Admin routes
    if (path.startsWith('/admin')) return 'admin';
    
    // Issues route
    if (path === '/issues') return 'issues';
    
    // Tasks route
    if (path.match(/^\/teams\/[^/]+\/tasks$/)) return 'tasks';
    
    // Default fallback to dashboard
    return 'dashboard';
  }, [location.pathname]);

  // Update active tab when route changes
  useEffect(() => {
    const newActiveTab = getActiveTab();
    setNavigationState(prev => ({
      ...prev,
      activeTab: newActiveTab,
      error: null
    }));
  }, [getActiveTab]);

  // Enhanced navigation with better error handling
  const handleTabChange = useCallback(async (tab: string) => {
    try {
      // Main navigation routes (sidebar level)
      const routes: Record<string, string> = {
        'dashboard': '/dashboard',
        'issues': '/issues',
        'admin': '/admin'
      };

      const targetRoute = routes[tab];
      
      // IMPORTANT: Skip if not a main navigation route
      // This allows AdminPage to handle its own internal navigation
      if (!targetRoute) {
        console.warn(`[Navigation] Ignoring unknown main route: ${tab} (likely internal admin nav)`);
        return;
      }

      // Skip navigation if already on the target route
      if (targetRoute === location.pathname) {
        console.log(`Already on route ${targetRoute}, skipping navigation`);
        return;
      }

      // Check permissions for admin routes
      if (tab === 'admin' && (!userRole || !['superadmin', 'admin', 'client_manager'].includes(userRole.role))) {
        throw new Error('Insufficient permissions to access admin panel');
      }

      setNavigationState(prev => ({
        ...prev,
        isNavigating: true,
        navigationAttempts: prev.navigationAttempts + 1,
        error: null
      }));

      // Perform navigation
      navigate(targetRoute);
      
      console.log(`[Navigation] Navigated to ${targetRoute}`);
      
    } catch (error) {
      console.error('[Navigation] Error:', error);
      setNavigationState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Navigation failed',
        isNavigating: false
      }));
    } finally {
      // Reset isNavigating flag immediately after navigation
      setTimeout(() => {
        setNavigationState(prev => ({
          ...prev,
          isNavigating: false
        }));
      }, 100);
    }
  }, [navigate, location.pathname, userRole, navigationState.navigationAttempts, navigationState.isNavigating]);

  // Reset navigation attempts periodically
  useEffect(() => {
    const resetTimer = setInterval(() => {
      setNavigationState(prev => ({
        ...prev,
        navigationAttempts: 0,
        error: null
      }));
    }, 30000); // Reset every 30 seconds

    return () => clearInterval(resetTimer);
  }, []);

  // Clear error after some time
  useEffect(() => {
    if (navigationState.error) {
      const errorTimer = setTimeout(() => {
        setNavigationState(prev => ({
          ...prev,
          error: null
        }));
      }, 5000);

      return () => clearTimeout(errorTimer);
    }
  }, [navigationState.error]);

  // Get navigation permissions for different tabs
  const getNavigationPermissions = useCallback(() => {
    const permissions = {
      'dashboard': true, // All authenticated users can access dashboard
      'organizations': true, // All authenticated users can view their organizations
      'issues': true, // All authenticated users can view issues
      'tasks': true, // All authenticated users can access tasks
      'admin': userRole && ['superadmin', 'admin', 'client_manager'].includes(userRole.role),
      'uuid-demo': true
    };

    return permissions;
  }, [userRole, hasManageCustomers]);

  return {
    activeTab: navigationState.activeTab,
    isNavigating: navigationState.isNavigating,
    navigationError: navigationState.error,
    navigationAttempts: navigationState.navigationAttempts,
    handleTabChange,
    getNavigationPermissions,
    canNavigateTo: (tab: string) => getNavigationPermissions()[tab as keyof ReturnType<typeof getNavigationPermissions>] || false
  };
}