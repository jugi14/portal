import React, { ReactNode } from 'react';
import { Permission, Role, PermissionCheckOptions } from '../types/permissions';
import { usePermissions } from '../contexts/PermissionContext';
import { Alert, AlertDescription } from './ui/alert';
import { Lock, UserX } from 'lucide-react';

interface PermissionGateProps {
  permission?: Permission | Permission[];
  role?: Role | Role[];
  options?: PermissionCheckOptions;
  children: ReactNode;
  fallback?: ReactNode;
  showError?: boolean;
  errorTitle?: string;
  errorMessage?: string;
}

export function PermissionGate({
  permission,
  role,
  options,
  children,
  fallback,
  showError = false,
  errorTitle = 'Access Denied',
  errorMessage = 'You do not have permission to view this content.'
}: PermissionGateProps) {
  const { hasPermission, hasRole, userRole, loading } = usePermissions();

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Check permissions
  let hasAccess = true;

  if (permission) {
    hasAccess = hasAccess && hasPermission(permission, options);
  }

  if (role) {
    hasAccess = hasAccess && hasRole(role);
  }

  // If user has access, render children
  if (hasAccess) {
    return <>{children}</>;
  }

  // If fallback provided, render it
  if (fallback) {
    return <>{fallback}</>;
  }

  // If showError is true, render error message
  if (showError) {
    return (
      <Alert className="border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive">
        <Lock className="h-4 w-4" />
        <AlertDescription>
          <div className="font-medium mb-1">{errorTitle}</div>
          <div className="text-sm">{errorMessage}</div>
          {userRole && (
            <div className="text-xs mt-2 opacity-75">
              Current role: {userRole.role} | Required: {permission ? String(permission) : String(role)}
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // Default: render nothing
  return null;
}

// Specialized components for common use cases
interface AdminOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
  showError?: boolean;
}

export function AdminOnly({ children, fallback, showError }: AdminOnlyProps) {
  return (
    <PermissionGate
      role="admin"
      fallback={fallback}
      showError={showError}
      errorTitle="Admin Access Required"
      errorMessage="This feature is only available to administrators."
    >
      {children}
    </PermissionGate>
  );
}

// Admin or SuperAdmin only
export function AdminOrSuperAdminOnly({ children, fallback, showError }: AdminOnlyProps) {
  return (
    <PermissionGate
      role={['admin', 'superadmin']}
      fallback={fallback}
      showError={showError}
      errorTitle="Admin Access Required"
      errorMessage="This feature is only available to administrators and super administrators."
    >
      {children}
    </PermissionGate>
  );
}

interface ClientManagerOrAboveProps {
  children: ReactNode;
  fallback?: ReactNode;
  showError?: boolean;
}

export function ClientManagerOrAbove({ children, fallback, showError }: ClientManagerOrAboveProps) {
  return (
    <PermissionGate
      role={['admin', 'client_manager']}
      fallback={fallback}
      showError={showError}
      errorTitle="Manager Access Required"
      errorMessage="This feature requires client manager or administrator privileges."
    >
      {children}
    </PermissionGate>
  );
}

interface CanCreateIssuesProps {
  children: ReactNode;
  fallback?: ReactNode;
  showError?: boolean;
}

export function CanCreateIssues({ children, fallback, showError }: CanCreateIssuesProps) {
  return (
    <PermissionGate
      permission="create_issues"
      fallback={fallback}
      showError={showError}
      errorTitle="Issue Creation Not Permitted"
      errorMessage="You do not have permission to create issues."
    >
      {children}
    </PermissionGate>
  );
}

interface CanManageUsersProps {
  children: ReactNode;
  fallback?: ReactNode;
  showError?: boolean;
}

export function CanManageUsers({ children, fallback, showError }: CanManageUsersProps) {
  return (
    <PermissionGate
      permission="manage_users"
      fallback={fallback}
      showError={showError}
      errorTitle="User Management Not Permitted"
      errorMessage="You do not have permission to manage users."
    >
      {children}
    </PermissionGate>
  );
}