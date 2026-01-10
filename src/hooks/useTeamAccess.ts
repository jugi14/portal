import { useState, useEffect } from 'react';
import { usePermissions } from '../contexts/PermissionContext';

export interface TeamAccessResult {
  hasAccess: boolean;
  accessType: 'customer-level' | null;
  role?: string;
  teamName?: string;
  customerId?: string;
}

interface UseTeamAccessOptions {
  onAccessDenied?: () => void;
}

/**
 * SIMPLIFIED: Check team access using PermissionContext
 * 
 * Customer-level access: User → Customer → Teams (all)
 */
export function useTeamAccess(
  teamId: string | undefined,
  customerId?: string | undefined,
  options?: UseTeamAccessOptions
) {
  const { userRole, hasTeamAccess, loading: permissionsLoading, accessibleTeams } = usePermissions();
  
  // Use null to differentiate "not checked" vs "denied"
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [teamName, setTeamName] = useState<string>('');
  const [teamsLoaded, setTeamsLoaded] = useState(false);

  const onAccessDenied = options?.onAccessDenied;

  const checkAccess = () => {
    if (!teamId) {
      return;
    }

    // Removed verbose log - checking access
    
    // CRITICAL: Check if user is admin FIRST (skip accessibleTeams check)
    const isAdmin = userRole?.role === 'admin' || userRole?.role === 'superadmin';
    
    // For regular users: WAIT for accessibleTeams to load
    // If not admin and accessibleTeams not loaded yet → keep null state
    if (!isAdmin && !teamsLoaded) {
      // Removed verbose log - waiting for teams
      setHasAccess(null); // Keep checking state
      return;
    }
    
    // Now safe to check access
    const access = isAdmin || hasTeamAccess(teamId);

    // Removed verbose log - access result

    setHasAccess(access);

    // Only call onAccessDenied AFTER complete check
    if (!access && teamsLoaded && onAccessDenied) {
      // Removed verbose log - calling callback
      onAccessDenied();
    }
  };

  // Track when accessibleTeams finish loading
  useEffect(() => {
    const isAdmin = userRole?.role === 'admin' || userRole?.role === 'superadmin';
    
    // Admins don't need to wait for accessibleTeams
    if (isAdmin) {
      setTeamsLoaded(true);
      return;
    }
    
    // Regular users: Wait for permissionsLoading = false AND accessibleTeams exists
    if (!permissionsLoading) {
      // Give a small delay for accessibleTeams to populate
      const timer = setTimeout(() => {
        setTeamsLoaded(true);
        // Removed verbose log - teams loaded
      }, 100); // 100ms delay to ensure state sync
      
      return () => clearTimeout(timer);
    }
  }, [permissionsLoading, userRole, accessibleTeams]);

  // Check access when teams loaded
  useEffect(() => {
    if (!teamId) {
      setHasAccess(null);
      return;
    }

    if (permissionsLoading) {
      // Set to null while loading (not false!)
      setHasAccess(null);
      return;
    }

    // Only check when teams loaded (or admin)
    if (teamsLoaded) {
      checkAccess();
    }
  }, [teamId, permissionsLoading, teamsLoaded, hasTeamAccess]);

  return {
    hasAccess: hasAccess ?? false, // Return false only if explicitly denied
    accessType: hasAccess ? ('customer-level' as const) : null,
    role: userRole?.role,
    teamName,
    customerId,
    loading: permissionsLoading || !teamsLoaded, // Wait for BOTH permissions AND teams
    isChecking: hasAccess === null, // Explicit "checking" state
    error: null,
    refetch: checkAccess,
  };
}

/**
 * Synchronous helper to check if user has customer-level access
 */
export function hasCustomerLevelAccess(accessType: 'customer-level' | null): boolean {
  return accessType === 'customer-level';
}

/**
 * Synchronous helper to check if user has any access
 */
export function hasAnyAccess(accessType: 'customer-level' | null): boolean {
  return accessType !== null;
}