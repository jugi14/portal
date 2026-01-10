import React from 'react';
import { useCustomerPermissions, CustomerPermissions, hasPermission } from '../hooks/useCustomerPermissions';
import { AlertTriangle, Lock } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Skeleton } from './ui/skeleton';

interface PermissionGuardProps {
  customerId: string;
  permission: keyof CustomerPermissions['permissions'];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showError?: boolean;
  loadingFallback?: React.ReactNode;
}

/**
 * PermissionGuard Component
 * 
 * Conditionally renders children based on user's permissions in a customer
 * 
 * Usage:
 * ```tsx
 * <PermissionGuard 
 *   customerId={customerId} 
 *   permission="canManageMembers"
 *   showError
 * >
 *   <Button onClick={handleAddMember}>Add Member</Button>
 * </PermissionGuard>
 * ```
 */
export function PermissionGuard({
  customerId,
  permission,
  children,
  fallback = null,
  showError = false,
  loadingFallback,
}: PermissionGuardProps) {
  const { permissions, loading, error } = useCustomerPermissions(customerId);

  // Show loading state
  if (loading) {
    if (loadingFallback) return <>{loadingFallback}</>;
    
    // Default loading skeleton
    return (
      <div className="w-full">
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  // Show error state if requested
  if (error && showError) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to check permissions: {error}
        </AlertDescription>
      </Alert>
    );
  }

  // Check permission
  if (!hasPermission(permissions, permission)) {
    if (showError) {
      return (
        <Alert variant="destructive" className="mb-4">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to perform this action.
          </AlertDescription>
        </Alert>
      );
    }
    
    return <>{fallback}</>;
  }

  // User has permission - render children
  return <>{children}</>;
}

interface MultiPermissionGuardProps {
  customerId: string;
  permissions: Array<keyof CustomerPermissions['permissions']>;
  mode?: 'any' | 'all'; // Default: 'any'
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showError?: boolean;
  loadingFallback?: React.ReactNode;
}

/**
 * MultiPermissionGuard Component
 * 
 * Conditionally renders children based on multiple permissions
 * 
 * Usage:
 * ```tsx
 * <MultiPermissionGuard 
 *   customerId={customerId} 
 *   permissions={['canManageMembers', 'canManageTeams']}
 *   mode="any"
 *   showError
 * >
 *   <Button>Manage</Button>
 * </MultiPermissionGuard>
 * ```
 */
export function MultiPermissionGuard({
  customerId,
  permissions: permissionList,
  mode = 'any',
  children,
  fallback = null,
  showError = false,
  loadingFallback,
}: MultiPermissionGuardProps) {
  const { permissions, loading, error } = useCustomerPermissions(customerId);

  // Show loading state
  if (loading) {
    if (loadingFallback) return <>{loadingFallback}</>;
    
    return (
      <div className="w-full">
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  // Show error state if requested
  if (error && showError) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to check permissions: {error}
        </AlertDescription>
      </Alert>
    );
  }

  // Check permissions based on mode
  const hasRequiredPermissions = mode === 'any'
    ? permissionList.some(p => hasPermission(permissions, p))
    : permissionList.every(p => hasPermission(permissions, p));

  if (!hasRequiredPermissions) {
    if (showError) {
      return (
        <Alert variant="destructive" className="mb-4">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to perform this action.
          </AlertDescription>
        </Alert>
      );
    }
    
    return <>{fallback}</>;
  }

  // User has required permissions - render children
  return <>{children}</>;
}

interface RoleGuardProps {
  customerId: string;
  allowedRoles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showError?: boolean;
  loadingFallback?: React.ReactNode;
}

/**
 * RoleGuard Component
 * 
 * Conditionally renders children based on user's role
 * 
 * Usage:
 * ```tsx
 * <RoleGuard 
 *   customerId={customerId} 
 *   allowedRoles={['admin', 'superadmin', 'client_manager']}
 *   showError
 * >
 *   <AdminPanel />
 * </RoleGuard>
 * ```
 */
export function RoleGuard({
  customerId,
  allowedRoles,
  children,
  fallback = null,
  showError = false,
  loadingFallback,
}: RoleGuardProps) {
  const { permissions, loading, error } = useCustomerPermissions(customerId);

  // Show loading state
  if (loading) {
    if (loadingFallback) return <>{loadingFallback}</>;
    
    return (
      <div className="w-full">
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  // Show error state if requested
  if (error && showError) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to check role: {error}
        </AlertDescription>
      </Alert>
    );
  }

  // Check if user's role is in allowed roles
  const hasAllowedRole = permissions?.role && allowedRoles.includes(permissions.role);

  if (!hasAllowedRole) {
    if (showError) {
      return (
        <Alert variant="destructive" className="mb-4">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            Your role ({permissions?.role || 'unknown'}) does not have access to this feature.
            Required roles: {allowedRoles.join(', ')}
          </AlertDescription>
        </Alert>
      );
    }
    
    return <>{fallback}</>;
  }

  // User has allowed role - render children
  return <>{children}</>;
}

/**
 * Higher-order component to wrap components with permission check
 * 
 * Usage:
 * ```tsx
 * const ProtectedButton = withPermission(
 *   Button,
 *   'canManageMembers',
 *   { showError: true }
 * );
 * 
 * <ProtectedButton customerId={customerId} onClick={handleClick}>
 *   Add Member
 * </ProtectedButton>
 * ```
 */
export function withPermission<P extends { customerId: string }>(
  Component: React.ComponentType<P>,
  permission: keyof CustomerPermissions['permissions'],
  options?: {
    fallback?: React.ReactNode;
    showError?: boolean;
    loadingFallback?: React.ReactNode;
  }
) {
  return function PermissionWrappedComponent(props: P) {
    return (
      <PermissionGuard
        customerId={props.customerId}
        permission={permission}
        fallback={options?.fallback}
        showError={options?.showError}
        loadingFallback={options?.loadingFallback}
      >
        <Component {...props} />
      </PermissionGuard>
    );
  };
}
