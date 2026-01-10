import { useState, useEffect } from 'react';
import { adminService } from '../services/adminService';
import { useAuth } from '../contexts/AuthContext';

export interface CustomerPermissions {
  role: string;
  customerId: string; // Schema V2.0: camelCase
  customer_id?: string; // Backward compatibility
  permissions: {
    canManageMembers: boolean;
    canManageTeams: boolean;
    canViewTeams: boolean;
    canViewMembers: boolean;
    canEditCustomer: boolean;
    canDeleteCustomer: boolean;
    canAssignTeams: boolean;
    canRemoveTeams: boolean;
    canViewIssues: boolean;
    canCreateIssues: boolean;
    canEditIssues: boolean;
    canDeleteIssues: boolean;
    canManagePermissions: boolean;
    canAccessAllCustomers: boolean;
  };
  isSuperadmin: boolean; // Schema V2.0: camelCase
  isAdmin: boolean; // Schema V2.0: camelCase
  isTeifiUser: boolean; // Schema V2.0: camelCase
  hasAccess?: boolean; // Schema V2.0: camelCase
  assignedAt?: string; // Schema V2.0: camelCase
  // Backward compatibility
  is_superadmin?: boolean;
  is_admin?: boolean;
  is_teifi_user?: boolean;
  has_access?: boolean;
  assigned_at?: string;
  customer: {
    id: string;
    name: string;
    status: string;
  } | null;
}

interface UseCustomerPermissionsResult {
  permissions: CustomerPermissions | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to check current user's role and permissions in a specific customer
 * 
 * Usage:
 * ```tsx
 * const { permissions, loading, error } = useCustomerPermissions(customerId);
 * 
 * if (loading) return <Spinner />;
 * if (error) return <Error message={error} />;
 * 
 * // Use permissions to conditionally render UI
 * {permissions?.permissions.canManageMembers && (
 *   <Button onClick={handleAddMember}>Add Member</Button>
 * )}
 * ```
 */
export function useCustomerPermissions(
  customerId: string | undefined,
  options?: {
    enabled?: boolean; // Default: true
    refetchOnMount?: boolean; // Default: true
  }
): UseCustomerPermissionsResult {
  const { session } = useAuth();
  const [permissions, setPermissions] = useState<CustomerPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const enabled = options?.enabled !== false;
  const refetchOnMount = options?.refetchOnMount !== false;

  const fetchPermissions = async () => {
    // Don't fetch if disabled or no customer ID or no session
    if (!enabled || !customerId || !session?.access_token) {
      setLoading(false);
      return;
    }

    console.log(`🔐 [useCustomerPermissions] Fetching permissions for customer: ${customerId}`);
    setLoading(true);
    setError(null);

    try {
      // Set access token
      adminService.setAccessToken(session.access_token);

      // Fetch permissions
      const result = await adminService.getMyRoleInCustomer(customerId);

      if (result.success && result.data) {
        console.log(`[useCustomerPermissions] Got permissions:`, result.data);
        setPermissions(result.data);
        setError(null);
      } else {
        console.error(`[useCustomerPermissions] Failed to get permissions:`, result.error);
        setError(result.error || 'Failed to check permissions');
        setPermissions(null);
      }
    } catch (err) {
      console.error(`[useCustomerPermissions] Error:`, err);
      setError(err instanceof Error ? err.message : 'Failed to check permissions');
      setPermissions(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount and when dependencies change
  useEffect(() => {
    if (refetchOnMount) {
      fetchPermissions();
    }
  }, [customerId, session?.access_token, enabled, refetchOnMount]);

  return {
    permissions,
    loading,
    error,
    refetch: fetchPermissions,
  };
}

/**
 * Helper function to check if user has specific permission
 * 
 * Usage:
 * ```tsx
 * const { permissions } = useCustomerPermissions(customerId);
 * const canEdit = hasPermission(permissions, 'canEditCustomer');
 * ```
 */
export function hasPermission(
  permissions: CustomerPermissions | null,
  permission: keyof CustomerPermissions['permissions']
): boolean {
  return permissions?.permissions[permission] ?? false;
}

/**
 * Helper function to check if user has any of the specified permissions
 * 
 * Usage:
 * ```tsx
 * const canManage = hasAnyPermission(permissions, ['canManageMembers', 'canManageTeams']);
 * ```
 */
export function hasAnyPermission(
  permissions: CustomerPermissions | null,
  permissionList: Array<keyof CustomerPermissions['permissions']>
): boolean {
  return permissionList.some(p => hasPermission(permissions, p));
}

/**
 * Helper function to check if user has all of the specified permissions
 * 
 * Usage:
 * ```tsx
 * const canFullyManage = hasAllPermissions(permissions, ['canManageMembers', 'canManageTeams']);
 * ```
 */
export function hasAllPermissions(
  permissions: CustomerPermissions | null,
  permissionList: Array<keyof CustomerPermissions['permissions']>
): boolean {
  return permissionList.every(p => hasPermission(permissions, p));
}

/**
 * Helper function to check if user is admin or superadmin
 * Schema V2.0: Support both camelCase and snake_case
 */
export function isAdminOrSuperAdmin(permissions: CustomerPermissions | null): boolean {
  return (permissions?.isAdmin || permissions?.is_admin) === true || 
         (permissions?.isSuperadmin || permissions?.is_superadmin) === true;
}

/**
 * Helper function to check if user has access to customer
 */
export function hasCustomerAccess(permissions: CustomerPermissions | null): boolean {
  // If hasAccess is explicitly false, deny (check both camelCase and snake_case)
  if ((permissions?.hasAccess ?? permissions?.has_access) === false) return false;
  
  // Superadmin and admin always have access
  if (isAdminOrSuperAdmin(permissions)) return true;
  
  // Otherwise check if role is not 'none'
  return permissions?.role !== 'none';
}
