/**
 * Admin Service V2
 * 
 * Unified admin service using V2 sub-services:
 * - userServiceV2 for user operations
 * - customerServiceV2 for customer operations  
 * - teamServiceV2 for team operations
 * 
 * Version: 2.0.0
 * Date: 2025-10-10
 * 
 * Migrated to Schema 2.0 with clean API V2 integration
 */

import { userServiceV2, type User, type CreateUserRequest, type UpdateUserRequest } from './userServiceV2';
import { customerServiceV2, type Customer, type CreateCustomerRequest, type UpdateCustomerRequest, type CustomerWithDetails } from './customerServiceV2';
import { teamServiceV2, type Team, type CreateTeamRequest, type UpdateTeamRequest } from './teamServiceV2';
import { apiClient } from './apiClient';

// Re-export types for backward compatibility
export type { User, CreateUserRequest, UpdateUserRequest };
export type { Customer, CreateCustomerRequest, UpdateCustomerRequest, CustomerWithDetails };
export type { Team, CreateTeamRequest, UpdateTeamRequest };

// Additional types
export interface CustomerCreateInput extends CreateCustomerRequest {}
export interface CustomerUpdateInput extends UpdateCustomerRequest {}
export interface CustomerDetails extends CustomerWithDetails {}

export interface ActivityLog {
  id: string;
  userId: string; // Schema V2.0: camelCase
  action: string;
  details: any;
  createdAt: string; // Schema V2.0: camelCase
}

export interface AdminStats {
  customers: number;
  users: number;
  teamAssignments: number;
  activityLogs: number;
}

/**
 * Admin Service Class - Delegates to V2 services
 */
export class AdminService {
  private accessToken: string | null = null;

  constructor() {
    // No need for baseUrl - handled by apiClient
  }

  setAccessToken(token: string) {
    this.accessToken = token;
    // Update token in apiClient
    apiClient.setAccessToken(token);
  }

  // ==========================================
  // USER OPERATIONS - Delegate to userServiceV2
  // ==========================================

  async getUsers(filters?: { role?: string; customerId?: string }): Promise<{ success: boolean; data?: { users: User[] }; error?: string }> {
    try {
      const users = await userServiceV2.getAll(filters);
      return {
        success: true,
        data: { users }
      };
    } catch (error) {
      console.error('[AdminService] Get users error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get users'
      };
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    return userServiceV2.getById(userId);
  }

  async createUser(userData: CreateUserRequest): Promise<User> {
    const user = await userServiceV2.create(userData);
    if (!user) {
      throw new Error('Failed to create user');
    }
    return user;
  }

  async updateUser(userId: string, updates: UpdateUserRequest): Promise<User> {
    const user = await userServiceV2.update(userId, updates);
    if (!user) {
      throw new Error('Failed to update user');
    }
    return user;
  }

  async deleteUser(userId: string): Promise<void> {
    await userServiceV2.delete(userId);
  }

  // ==========================================
  // CUSTOMER OPERATIONS - Delegate to customerServiceV2
  // ==========================================

  async getCustomers(): Promise<Customer[]> {
    return customerServiceV2.getAll();
  }

  async getCustomerById(customerId: string): Promise<CustomerWithDetails | null> {
    return customerServiceV2.getById(customerId);
  }

  async createCustomer(customerData: CreateCustomerRequest): Promise<Customer> {
    const customer = await customerServiceV2.create(customerData);
    if (!customer) {
      throw new Error('Failed to create customer');
    }
    return customer;
  }

  async updateCustomer(customerId: string, updates: UpdateCustomerRequest): Promise<Customer> {
    const customer = await customerServiceV2.update(customerId, updates);
    if (!customer) {
      throw new Error('Failed to update customer');
    }
    return customer;
  }

  async deleteCustomer(customerId: string): Promise<void> {
    await customerServiceV2.delete(customerId);
  }

  async addUserToCustomer(customerId: string, userId: string): Promise<void> {
    await customerServiceV2.addUser(customerId, userId);
  }

  async removeUserFromCustomer(customerId: string, userId: string): Promise<void> {
    await customerServiceV2.removeUser(customerId, userId);
  }

  /**
   * Get customer members
   */
  async getCustomerMembers(customerId: string): Promise<{ success: boolean; members?: any[]; error?: string }> {
    try {
      const response = await apiClient.get(`/admin/customers/${customerId}/members`);
      return {
        success: response.success,
        members: response.data?.members || [],
        error: response.error
      };
    } catch (error) {
      console.error('[AdminService] Get customer members error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get customer members'
      };
    }
  }

  /**
   * Add member to customer
   */
  async addCustomerMember(customerId: string, userId: string, role: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiClient.post(`/admin/customers/${customerId}/members`, {
        userId, // FIX: Backend expects 'userId' not 'user_id'
        role
      });
      return {
        success: response.success,
        error: response.error
      };
    } catch (error) {
      console.error('[AdminService] Add customer member error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add customer member'
      };
    }
  }

  /**
   * Remove member from customer
   */
  async removeCustomerMember(customerId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiClient.delete(`/admin/customers/${customerId}/members/${userId}`);
      return {
        success: response.success,
        error: response.error
      };
    } catch (error) {
      console.error('[AdminService] Remove customer member error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove customer member'
      };
    }
  }

  /**
   * Add member to customer with object param (wrapper for addCustomerMember)
   */
  async addMemberToCustomer(params: { customerId: string; userId: string; email: string; role: string }): Promise<{ success: boolean; error?: string }> {
    return this.addCustomerMember(params.customerId, params.userId, params.role);
  }

  /**
   * Remove member from customer (wrapper for removeCustomerMember)
   */
  async removeMemberFromCustomer(customerId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    return this.removeCustomerMember(customerId, userId);
  }

  /**
   * Update member role
   */
  async updateMemberRole(params: { customerId: string; userId: string; newRole: string }): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiClient.put(`/admin/customers/${params.customerId}/members/${params.userId}`, {
        role: params.newRole
      });
      return {
        success: response.success,
        error: response.error
      };
    } catch (error) {
      console.error('[AdminService] Update member role error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update member role'
      };
    }
  }

  // ==========================================
  // TEAM OPERATIONS - Delegate to teamServiceV2
  // ==========================================

  async getTeams(): Promise<Team[]> {
    const hierarchy = await teamServiceV2.getHierarchy();
    // Flatten hierarchy to simple array
    const flattenTeams = (teams: any[]): Team[] => {
      return teams.flatMap(team => [
        team,
        ...(team.children ? flattenTeams(team.children) : [])
      ]);
    };
    return flattenTeams(hierarchy);
  }

  async getTeamById(teamId: string): Promise<Team | null> {
    return teamServiceV2.getById(teamId);
  }

  async createTeam(teamData: CreateTeamRequest): Promise<Team> {
    const team = await teamServiceV2.create(teamData);
    if (!team) {
      throw new Error('Failed to create team');
    }
    return team;
  }

  async updateTeam(teamId: string, updates: UpdateTeamRequest): Promise<Team> {
    const team = await teamServiceV2.update(teamId, updates);
    if (!team) {
      throw new Error('Failed to update team');
    }
    return team;
  }

  async deleteTeam(teamId: string): Promise<void> {
    await teamServiceV2.delete(teamId);
  }

  async addMemberToTeam(teamId: string, userId: string): Promise<void> {
    await teamServiceV2.addMember(teamId, userId);
  }

  async removeMemberFromTeam(teamId: string, userId: string): Promise<void> {
    await teamServiceV2.removeMember(teamId, userId);
  }

  async getTeamMembers(teamId: string): Promise<User[]> {
    return teamServiceV2.getMembers(teamId);
  }

  /**
   * Get teams assigned to a customer
   */
  async getCustomerTeams(customerId: string): Promise<Team[]> {
    // Use customerServiceV2 for proper endpoint
    return customerServiceV2.getTeams(customerId);
  }

  /**
   * Assign team to customer
   */
  async assignTeamToCustomer(customerId: string, teamData: { linearTeamId: string; linearTeamName: string }): Promise<void> {
    // Schema V2.0: camelCase parameters
    // Call customerServiceV2.assignTeam with just the team ID
    await customerServiceV2.assignTeam(customerId, teamData.linearTeamId);
  }

  /**
   * Remove team from customer
   */
  async removeTeamFromCustomer(customerId: string, linearTeamId: string): Promise<void> {
    await customerServiceV2.removeTeam(customerId, linearTeamId);
  }

  /**
   * Get members assigned to a specific team within a customer
   */
  async getCustomerTeamMembers(customerId: string, teamId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await apiClient.get(`/admin/customers/${customerId}/teams/${teamId}/members`);
      return {
        success: response.success,
        data: response.data,
        error: response.error
      };
    } catch (error) {
      console.error('[AdminService] Get team members error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get team members'
      };
    }
  }

  /**
   * Add member to a specific team within a customer
   */
  async addMemberToCustomerTeam(customerId: string, teamId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiClient.post(`/admin/customers/${customerId}/teams/${teamId}/members`, {
        userId
      });
      return {
        success: response.success,
        error: response.error
      };
    } catch (error) {
      console.error('[AdminService] Add member to team error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add member to team'
      };
    }
  }

  /**
   * Remove member from a specific team within a customer
   */
  async removeMemberFromCustomerTeam(customerId: string, teamId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiClient.delete(`/admin/customers/${customerId}/teams/${teamId}/members/${userId}`);
      return {
        success: response.success,
        error: response.error
      };
    } catch (error) {
      console.error('[AdminService] Remove member from team error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove member from team'
      };
    }
  }

  // ==========================================
  // ACTIVITY LOGS
  // ==========================================

  async getActivityLogs(limit = 50, offset = 0): Promise<ActivityLog[]> {
    const response = await apiClient.get<ActivityLog[]>(
      `/admin/activity?limit=${limit}&offset=${offset}`
    );

    if (!response.success) {
      console.error('[AdminService] Failed to fetch activity logs:', response.error);
      return [];
    }

    return response.data || [];
  }

  // ==========================================
  // DASHBOARD STATS
  // ==========================================

  async getDashboardStats(): Promise<AdminStats> {
    const response = await apiClient.get<AdminStats>('/admin/dashboard');

    if (!response.success) {
      console.error('[AdminService] Failed to fetch dashboard stats:', response.error);
      return {
        customers: 0,
        users: 0,
        teamAssignments: 0,
        activityLogs: 0,
      };
    }

    return response.data || {
      customers: 0,
      users: 0,
      teamAssignments: 0,
      activityLogs: 0,
    };
  }

  // ==========================================
  // BACKWARD COMPATIBILITY ALIASES
  // ==========================================

  // Old organization methods -> customer methods
  async getOrganizations() {
    return this.getCustomers();
  }

  async getOrganizationById(orgId: string) {
    return this.getCustomerById(orgId);
  }

  async createOrganization(orgData: CreateCustomerRequest) {
    return this.createCustomer(orgData);
  }

  async updateOrganization(orgId: string, updates: UpdateCustomerRequest) {
    return this.updateCustomer(orgId, updates);
  }

  async deleteOrganization(orgId: string) {
    return this.deleteCustomer(orgId);
  }

  async addUserToOrganization(orgId: string, userId: string) {
    return this.addUserToCustomer(orgId, userId);
  }

  async removeUserFromOrganization(orgId: string, userId: string) {
    return this.removeUserFromCustomer(orgId, userId);
  }
}

// Export singleton instance
export const adminService = new AdminService();
