// Permission and Role Types for Teifi Client Portal

export type Permission = 
  | 'view_issues' 
  | 'create_issues'
  | 'edit_issues'
  | 'delete_issues'
  | 'view_project_status'
  | 'manage_users'
  | 'manage_permissions'
  | 'access_linear_test'
  | 'view_analytics'
  | 'export_data'
  | 'manage_system'
  | 'manage_customers'
  | 'manage_teams'
  | 'view_admin'
  | 'access_all_customers'
  | 'manage_security';

export type Role = 
  | 'superadmin'
  | 'admin'
  | 'client_manager'
  | 'client_user'
  | 'tester'
  | 'viewer';

export interface UserRole {
  id: string;
  email: string;
  role: Role;
  permissions: Permission[];
  customerId?: string;
  customerName?: string;
  projects?: string[];
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  status?: 'active' | 'pending' | 'rejected';
  isPending?: boolean;
}

export interface RoleDefinition {
  role: Role;
  name: string;
  description: string;
  permissions: Permission[];
  color: string;
  icon: string;
}

// Default role configurations
export const ROLE_DEFINITIONS: Record<Role, RoleDefinition> = {
  superadmin: {
    role: 'superadmin',
    name: 'Super Administrator',
    description: 'Complete system access, manage all customers and global settings',
    permissions: [
      'view_issues', 'create_issues', 'edit_issues', 'delete_issues',
      'view_project_status', 'manage_users', 'manage_permissions',
      'access_linear_test', 'view_analytics', 'export_data',
      'manage_system', 'manage_customers',
      'manage_teams', 'view_admin', 'access_all_customers',
      'manage_security'
    ],
    color: 'purple',
    icon: 'Crown'
  },
  admin: {
    role: 'admin',
    name: 'Administrator',
    description: 'Manage users and customers within assigned scope',
    permissions: [
      'view_issues',
      'create_issues',
      'edit_issues',
      'delete_issues',
      'view_project_status',
      'manage_users',
      'manage_permissions',
      'access_linear_test',
      'view_analytics',
      'export_data',
      'manage_customers',
      'manage_teams',
      'view_admin'
      
    ],
    color: 'red',
    icon: 'Shield'
  },
  client_manager: {
    role: 'client_manager',
    name: 'Client Manager',
    description: 'Manage client team and oversee project issues',
    permissions: [
      'view_issues',
      'create_issues',
      'edit_issues',
      'delete_issues', // Can delete issues within their team
      'view_project_status',
      'view_analytics',
      'export_data',
      'manage_teams' // Can manage their own team
    ],
    color: 'blue',
    icon: 'Users'
  },
  client_user: {
    role: 'client_user',
    name: 'Client User',
    description: 'Standard client access for testing and issue reporting',
    permissions: [
      'view_issues',
      'create_issues',
      'edit_issues', // Can edit their own issues
      'view_project_status'
    ],
    color: 'green',
    icon: 'User'
  },
  tester: {
    role: 'tester',
    name: 'Tester',
    description: 'Specialized testing role with enhanced bug reporting capabilities',
    permissions: [
      'view_issues',
      'create_issues',
      'edit_issues', // Can edit issues to update test status
      'view_project_status',
      'access_linear_test'
    ],
    color: 'purple',
    icon: 'Bug'
  },
  viewer: {
    role: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to dashboard and project status',
    permissions: [
      'view_issues',
      'view_project_status'
    ],
    color: 'gray',
    icon: 'Eye'
  }
};

export interface PermissionCheckOptions {
  requireAll?: boolean; // If true, user must have ALL permissions. If false, user needs ANY permission
  customerId?: string; // Optional customer context check
  projectId?: string; // Optional project context check
}