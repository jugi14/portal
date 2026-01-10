/**
 * ADMIN HELPER UTILITIES - Schema v2.0
 * 
 * Admin-specific utility functions that don't fit into CRUD patterns:
 * - Activity logging
 * - Dashboard statistics
 * - Role definitions
 * - Permission checking utilities
 * 
 * These are NOT CRUD operations, but helper/utility functions.
 */

import * as kv from "../kv_store";

export class AdminHelpers {
  
  /**
   * Get dashboard statistics
   */
  async getDashboardStats(supabase: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log('[AdminHelpers] Fetching dashboard stats...');
      
      // Get user count from Supabase Auth
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      const userCount = authUsers?.users?.length || 0;
      
      // Get customer count
      const customerKeys = await kv.getByPrefix('customer:');
      const customerCount = customerKeys.filter((key: string) => !key.includes(':')).length;
      
      // Get team count
      const teamKeys = await kv.getByPrefix('linear_teams:');
      const teamCount = teamKeys.length;
      
      // Get recent activity count
      const activityKeys = await kv.getByPrefix('admin_activity:');
      const recentActivityCount = activityKeys.slice(0, 10).length;
      
      const stats = {
        users: userCount,
        customers: customerCount,
        teams: teamCount,
        recentActivity: recentActivityCount,
        timestamp: new Date().toISOString()
      };
      
      console.log('[AdminHelpers] Dashboard stats:', stats);
      
      return {
        success: true,
        data: { stats }
      };
    } catch (error) {
      console.error('[AdminHelpers] Get dashboard stats error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch dashboard stats'
      };
    }
  }
  
  /**
   *Get activity logs
   */
  async getActivityLogs(options: { limit?: number; offset?: number } = {}): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log('[AdminHelpers] Fetching activity logs...');
      
      const { limit = 50, offset = 0 } = options;
      
      // Get all activity log keys
      const logKeys = await kv.getByPrefix('admin_activity:');
      
      // Sort by timestamp (keys are prefixed with timestamp)
      const sortedKeys = logKeys.sort().reverse();
      
      // Apply pagination
      const paginatedKeys = sortedKeys.slice(offset, offset + limit);
      
      // Load activity logs
      const logs = [];
      for (const key of paginatedKeys) {
        const log = await kv.get(key);
        if (log) {
          logs.push(log);
        }
      }
      
      console.log(`[AdminHelpers] Retrieved ${logs.length} activity logs`);
      
      return {
        success: true,
        data: {
          logs,
          total: logKeys.length,
          limit,
          offset
        }
      };
    } catch (error) {
      console.error('[AdminHelpers] Get activity logs error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch activity logs'
      };
    }
  }
  
  /**
   *Get role definitions
   */
  async getRoleDefinitions(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log('[AdminHelpers] Fetching role definitions...');
      
      const roleDefinitions = {
        superadmin: {
          name: 'Super Administrator',
          description: 'Complete system access, manage all customers and global settings',
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
            'manage_system',
            'manage_customers',
            'manage_teams',
            'view_admin',
            'access_all_customers',
            'manage_security',
          ],
        },
        admin: {
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
            'view_admin',
          ],
        },
        client_manager: {
          name: 'Client Manager',
          description: 'Manage client team and oversee project issues',
          permissions: [
            'view_issues',
            'create_issues',
            'edit_issues',
            'delete_issues',
            'view_project_status',
            'view_analytics',
            'export_data',
            'manage_teams',
          ],
        },
        client_user: {
          name: 'Client User',
          description: 'Standard client access for testing and issue reporting',
          permissions: [
            'view_issues',
            'create_issues',
            'edit_issues',
            'view_project_status',
          ],
        },
        tester: {
          name: 'Tester',
          description: 'Specialized testing role with enhanced bug reporting capabilities',
          permissions: [
            'view_issues',
            'create_issues',
            'edit_issues',
            'view_project_status',
            'access_linear_test',
          ],
        },
        viewer: {
          name: 'Viewer',
          description: 'Read-only access to dashboard and project status',
          permissions: ['view_issues', 'view_project_status'],
        },
      };
      
      console.log('[AdminHelpers] Role definitions retrieved');
      
      return {
        success: true,
        data: { roles: roleDefinitions }
      };
    } catch (error) {
      console.error('[AdminHelpers] Get role definitions error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch role definitions'
      };
    }
  }
  
  /**
   *Get member permissions within customer
   * Returns user's role and permissions in a specific customer context
   */
  async getMemberPermissions(
    customerId: string,
    userId: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(`[AdminHelpers] Getting permissions for user ${userId} in customer ${customerId}`);
      
      // Check if user is a member of this customer
      const customerMembers = await kv.get(`customer:${customerId}:members`) || [];
      
      if (!customerMembers.includes(userId)) {
        return {
          success: false,
          error: 'User is not a member of this customer'
        };
      }
      
      // Get user object to get their role
      const userObj = await kv.get(`user:${userId}`);
      
      if (!userObj) {
        return {
          success: false,
          error: 'User not found'
        };
      }
      
      // Get membership details
      const membership = await kv.get(`customer:${customerId}:member:${userId}`);
      
      // Get role definitions
      const rolesResult = await this.getRoleDefinitions();
      const roleDefinitions = rolesResult.data?.roles || {};
      const rolePermissions = roleDefinitions[userObj.role]?.permissions || [];
      
      return {
        success: true,
        data: {
          user_id: userId,
          customer_id: customerId,
          role: userObj.role,
          permissions: rolePermissions,
          assigned_at: membership?.assigned_at,
          assigned_by: membership?.assigned_by
        }
      };
    } catch (error) {
      console.error('[AdminHelpers] Get member permissions error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get member permissions'
      };
    }
  }
  
  /**
   * ️ Update member permissions (role) within customer
   */
  async updateMemberPermissions(
    customerId: string,
    userId: string,
    newRole: string,
    updatedBy: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(`[AdminHelpers] Updating role for user ${userId} in customer ${customerId} to ${newRole}`);
      
      // Verify customer membership
      const customerMembers = await kv.get(`customer:${customerId}:members`) || [];
      
      if (!customerMembers.includes(userId)) {
        return {
          success: false,
          error: 'User is not a member of this customer'
        };
      }
      
      // Update user's role
      const userObj = await kv.get(`user:${userId}`);
      
      if (!userObj) {
        return {
          success: false,
          error: 'User not found'
        };
      }
      
      userObj.role = newRole;
      userObj.updated_at = new Date().toISOString();
      userObj.updated_by = updatedBy;
      
      await kv.set(`user:${userId}`, userObj);
      
      // Update membership record
      const membership = await kv.get(`customer:${customerId}:member:${userId}`) || {};
      membership.role_updated_at = new Date().toISOString();
      membership.role_updated_by = updatedBy;
      await kv.set(`customer:${customerId}:member:${userId}`, membership);
      
      console.log(`[AdminHelpers] Role updated successfully`);
      
      return {
        success: true,
        data: {
          message: 'Member permissions updated successfully',
          user_id: userId,
          customer_id: customerId,
          new_role: newRole
        }
      };
    } catch (error) {
      console.error('[AdminHelpers] Update member permissions error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update member permissions'
      };
    }
  }
  
  /**
   *Get customer permission matrix
   * Returns all members with their roles and permissions
   */
  async getOrganizationPermissionMatrix(customerId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(`[AdminHelpers] Getting permission matrix for customer ${customerId}`);
      
      const customer = await kv.get(`customer:${customerId}`);
      
      if (!customer) {
        return {
          success: false,
          error: 'Customer not found'
        };
      }
      
      const memberIds = await kv.get(`customer:${customerId}:members`) || [];
      
      // Get role definitions
      const rolesResult = await this.getRoleDefinitions();
      const roleDefinitions = rolesResult.data?.roles || {};
      
      // Build permission matrix
      const members = [];
      
      for (const userId of memberIds) {
        const userObj = await kv.get(`user:${userId}`);
        const membership = await kv.get(`customer:${customerId}:member:${userId}`);
        
        if (userObj) {
          const rolePermissions = roleDefinitions[userObj.role]?.permissions || [];
          
          members.push({
            user_id: userId,
            email: userObj.email,
            name: userObj.metadata?.name || userObj.email.split('@')[0],
            role: userObj.role,
            permissions: rolePermissions,
            assigned_at: membership?.assigned_at,
            assigned_by: membership?.assigned_by
          });
        }
      }
      
      console.log(`[AdminHelpers] Permission matrix retrieved for ${members.length} members`);
      
      return {
        success: true,
        data: {
          customer_id: customerId,
          customer_name: customer.name,
          members,
          roles: roleDefinitions
        }
      };
    } catch (error) {
      console.error('[AdminHelpers] Get permission matrix error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get permission matrix'
      };
    }
  }
  
  /**
   *Check user permission
   */
  async checkUserPermission(
    userId: string,
    permission: string,
    customerId?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const userObj = await kv.get(`user:${userId}`);
      
      if (!userObj) {
        return {
          success: false,
          error: 'User not found'
        };
      }
      
      // Get role definitions
      const rolesResult = await this.getRoleDefinitions();
      const roleDefinitions = rolesResult.data?.roles || {};
      
      // Superadmin has all permissions
      if (userObj.role === 'superadmin') {
        return {
          success: true,
          data: {
            hasPermission: true,
            reason: 'superadmin_role'
          }
        };
      }
      
      // Check role-based permissions
      const rolePermissions = roleDefinitions[userObj.role]?.permissions || [];
      const hasPermission = rolePermissions.includes(permission);
      
      return {
        success: true,
        data: {
          hasPermission,
          role: userObj.role,
          permission,
          reason: hasPermission ? 'role_permission' : 'no_permission'
        }
      };
    } catch (error) {
      console.error('[AdminHelpers] Check user permission error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check user permission'
      };
    }
  }
  
  /**
   *Get user's role in customer
   */
  async getMyRoleInCustomer(
    userId: string,
    userEmail: string,
    customerId: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(`[AdminHelpers] Getting role for user ${userEmail} in customer ${customerId}`);
      
      // Use shared superadmin check from authHelpers
      const { isSuperAdminUser } = await import("../authHelpers");
      const isSuperAdmin = await isSuperAdminUser(userEmail);
      
      if (isSuperAdmin) {
        return {
          success: true,
          data: {
            role: 'superadmin',
            isMember: true,
            canManage: true
          }
        };
      }
      
      // Check if user is member of customer
      const customerMembers = await kv.get(`customer:${customerId}:members`) || [];
      const isMember = customerMembers.includes(userId);
      
      if (!isMember) {
        return {
          success: true,
          data: {
            role: null,
            isMember: false,
            canManage: false
          }
        };
      }
      
      // Get user's role
      const userObj = await kv.get(`user:${userId}`);
      
      if (!userObj) {
        return {
          success: false,
          error: 'User not found'
        };
      }
      
      const canManage = userObj.role === 'superadmin' || userObj.role === 'admin' || userObj.role === 'client_manager';
      
      return {
        success: true,
        data: {
          role: userObj.role,
          isMember: true,
          canManage
        }
      };
    } catch (error) {
      console.error('[AdminHelpers] Get my role in customer error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get role in customer'
      };
    }
  }
  
  /**
   *Get team members with permissions
   * (Helper for team member management in customer context)
   */
  async getTeamMembersWithPermissions(
    customerId: string,
    teamId: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(`[AdminHelpers] Getting team members with permissions for team ${teamId} in customer ${customerId}`);
      
      // Verify customer exists
      const customer = await kv.get(`customer:${customerId}`);
      if (!customer) {
        return {
          success: false,
          error: 'Customer not found'
        };
      }
      
      // Verify team exists
      const team = await kv.get(`linear_teams:${teamId}`);
      if (!team) {
        return {
          success: false,
          error: 'Team not found'
        };
      }
      
      // Get team members
      const teamMemberIds = await kv.get(`team:${teamId}:members`) || [];
      
      // Get role definitions
      const rolesResult = await this.getRoleDefinitions();
      const roleDefinitions = rolesResult.data?.roles || {};
      
      // Build member list with permissions
      const members = [];
      
      for (const userId of teamMemberIds) {
        const userObj = await kv.get(`user:${userId}`);
        const membership = await kv.get(`team:${teamId}:member:${userId}`);
        
        if (userObj) {
          const rolePermissions = roleDefinitions[userObj.role]?.permissions || [];
          
          members.push({
            user_id: userId,
            email: userObj.email,
            name: userObj.metadata?.name || userObj.email.split('@')[0],
            role: userObj.role,
            status: userObj.status,
            permissions: rolePermissions,
            assigned_at: membership?.assigned_at,
            assigned_by: membership?.assigned_by
          });
        }
      }
      
      console.log(`[AdminHelpers] Found ${members.length} team members with permissions`);
      
      return {
        success: true,
        data: {
          members,
          count: members.length
        }
      };
    } catch (error) {
      console.error('[AdminHelpers] Get team members with permissions error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get team members with permissions'
      };
    }
  }
  
  /**
   *Add member to team (with customer validation)
   */
  async addMemberToTeam(
    customerId: string,
    teamId: string,
    userId: string,
    assignedBy: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(`[AdminHelpers] Adding user ${userId} to team ${teamId} in customer ${customerId}`);
      
      // Verify user is member of customer
      const customerMembers = await kv.get(`customer:${customerId}:members`) || [];
      
      if (!customerMembers.includes(userId)) {
        return {
          success: false,
          error: 'User must be a member of the customer first'
        };
      }
      
      // Verify team is assigned to customer
      const customerTeams = await kv.get(`customer:${customerId}:teams`) || [];
      
      if (!customerTeams.includes(teamId)) {
        return {
          success: false,
          error: 'Team must be assigned to customer first'
        };
      }
      
      // Add user to team
      const teamMembers = await kv.get(`team:${teamId}:members`) || [];
      
      if (teamMembers.includes(userId)) {
        return {
          success: false,
          error: 'User is already a member of this team'
        };
      }
      
      teamMembers.push(userId);
      await kv.set(`team:${teamId}:members`, teamMembers);
      
      // Create membership record
      const membership = {
        user_id: userId,
        team_id: teamId,
        customer_id: customerId,
        assigned_at: new Date().toISOString(),
        assigned_by: assignedBy
      };
      await kv.set(`team:${teamId}:member:${userId}`, membership);
      
      // Add team to user's teams list
      const userTeams = await kv.get(`user:${userId}:teams`) || [];
      if (!userTeams.includes(teamId)) {
        userTeams.push(teamId);
        await kv.set(`user:${userId}:teams`, userTeams);
      }
      
      console.log(`[AdminHelpers] User added to team successfully`);
      
      return {
        success: true,
        data: {
          message: 'Member added to team successfully',
          membership
        }
      };
    } catch (error) {
      console.error('[AdminHelpers] Add member to team error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add member to team'
      };
    }
  }
  
  /**
   *Remove member from team
   */
  async removeMemberFromTeam(
    customerId: string,
    teamId: string,
    userId: string,
    removedBy: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(`[AdminHelpers] Removing user ${userId} from team ${teamId} in customer ${customerId}`);
      
      // Remove from team members list
      const teamMembers = await kv.get(`team:${teamId}:members`) || [];
      const updatedMembers = teamMembers.filter((id: string) => id !== userId);
      await kv.set(`team:${teamId}:members`, updatedMembers);
      
      // Delete membership record
      await kv.del(`team:${teamId}:member:${userId}`);
      
      // Remove from user's teams list
      const userTeams = await kv.get(`user:${userId}:teams`) || [];
      const updatedUserTeams = userTeams.filter((id: string) => id !== teamId);
      await kv.set(`user:${userId}:teams`, updatedUserTeams);
      
      console.log(`[AdminHelpers] User removed from team successfully`);
      
      return {
        success: true,
        data: {
          message: 'Member removed from team successfully'
        }
      };
    } catch (error) {
      console.error('[AdminHelpers] Remove member from team error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove member from team'
      };
    }
  }
}

// Export singleton instance
export const adminHelpers = new AdminHelpers();
