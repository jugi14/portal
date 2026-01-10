/**
 * Customer Service V2
 * 
 * Handles all customer-related API calls
 * Uses /admin/customers endpoints from API V2
 * Schema V2.0 - User > Customer > Team architecture
 * 
 * Version: 2.1.0
 * Date: 2025-10-11
 */

import { apiClient } from './apiClient';

export interface Customer {
  id: string;
  name: string;
  description?: string;
  contactEmail?: string;
  google_domain?: string;
  project?: string;
  epic?: string;
  environment?: string;
  status: string; // 'active' | 'inactive' | 'staging' | 'production'
  createdAt: string; // Schema V2.0: camelCase
  updatedAt?: string; // Schema V2.0: camelCase
  usersCount?: number; // Schema V2.0: camelCase
  teamsCount?: number; // Schema V2.0: camelCase
}

export interface CustomerWithDetails extends Customer {
  members: CustomerMember[];
  teams: CustomerTeam[];
}

export interface CustomerMember {
  userId: string; // Schema V2.0: camelCase
  email: string;
  name: string;
  role: string;
  status: string;
  assignedAt?: string; // Schema V2.0: camelCase
  assignedBy?: string; // Schema V2.0: camelCase
}

export interface CustomerTeam {
  id: string;
  name: string;
  key: string;
  description?: string;
  state?: string;
  membersCount?: number; // Schema V2.0: camelCase
}

export interface CreateCustomerRequest {
  name: string;
  description?: string;
  contactEmail?: string;
  google_domain?: string;
  project?: string;
  epic?: string;
  environment?: string;
  status?: string;
  metadata?: any;
}

export interface UpdateCustomerRequest {
  name?: string;
  description?: string;
  contactEmail?: string;
  google_domain?: string;
  project?: string;
  epic?: string;
  environment?: string;
  status?: string;
  metadata?: any;
}

export const customerServiceV2 = {
  /**
   * Get all customers
   */
  async getAll(): Promise<Customer[]> {
    const response = await apiClient.get<{ customers: Customer[]; count: number }>('/admin/customers');
    
    if (!response.success) {
      console.error('[CustomerService] Failed to fetch customers:', response.error);
      return [];
    }
    
    // Backend returns { success: true, data: { customers: [...], count: N } }
    return response.data?.customers || [];
  },

  /**
   * Get customer by ID with details
   */
  async getById(customerId: string): Promise<CustomerWithDetails | null> {
    const response = await apiClient.get<CustomerWithDetails>(`/admin/customers/${customerId}`);
    
    if (!response.success) {
      console.error(`[CustomerService] Failed to fetch customer ${customerId}:`, response.error);
      return null;
    }
    
    return response.data || null;
  },

  /**
   * Create new customer
   */
  async create(customerData: CreateCustomerRequest): Promise<Customer | null> {
    const response = await apiClient.post<Customer>('/admin/customers', customerData);
    
    if (!response.success) {
      console.error('[CustomerService] Failed to create customer:', response.error);
      throw new Error(response.error || 'Failed to create customer');
    }
    
    return response.data || null;
  },

  /**
   * Update customer
   */
  async update(customerId: string, updates: UpdateCustomerRequest): Promise<Customer | null> {
    const response = await apiClient.put<Customer>(`/admin/customers/${customerId}`, updates);
    
    if (!response.success) {
      console.error(`[CustomerService] Failed to update customer ${customerId}:`, response.error);
      throw new Error(response.error || 'Failed to update customer');
    }
    
    return response.data || null;
  },

  /**
   * Delete customer
   */
  async delete(customerId: string): Promise<boolean> {
    const response = await apiClient.delete(`/admin/customers/${customerId}`);
    
    if (!response.success) {
      console.error(`[CustomerService] Failed to delete customer ${customerId}:`, response.error);
      throw new Error(response.error || 'Failed to delete customer');
    }
    
    return true;
  },

  /**
   * Add user to customer
   */
  async addUser(customerId: string, userId: string): Promise<boolean> {
    const response = await apiClient.post(`/admin/customers/${customerId}/users`, { userId });
    
    if (!response.success) {
      console.error(`[CustomerService] Failed to add user to customer:`, response.error);
      throw new Error(response.error || 'Failed to add user');
    }
    
    return true;
  },

  /**
   * Remove user from customer
   */
  async removeUser(customerId: string, userId: string): Promise<boolean> {
    const response = await apiClient.delete(`/admin/customers/${customerId}/users/${userId}`);
    
    if (!response.success) {
      console.error(`[CustomerService] Failed to remove user from customer:`, response.error);
      throw new Error(response.error || 'Failed to remove user');
    }
    
    return true;
  },

  /**
   * Get customer members
   * Returns all users assigned to this customer
   */
  async getMembers(customerId: string): Promise<CustomerMember[]> {
    const response = await apiClient.get<{ members: CustomerMember[] }>(
      `/admin/customers/${customerId}/members`
    );
    
    if (!response.success) {
      console.error(`[CustomerService] Failed to fetch members for customer ${customerId}:`, response.error);
      return [];
    }
    
    return response.data?.members || [];
  },

  /**
   * Add member to customer
   * Assigns user to customer for team access
   */
  async addMember(customerId: string, userId: string): Promise<boolean> {
    const response = await apiClient.post(
      `/admin/customers/${customerId}/members`,
      { userId }
    );
    
    if (!response.success) {
      console.error(`[CustomerService] Failed to add member to customer:`, response.error);
      throw new Error(response.error || 'Failed to add member');
    }
    
    return true;
  },

  /**
   * Remove member from customer
   * Removes user assignment from customer
   */
  async removeMember(customerId: string, userId: string): Promise<boolean> {
    const response = await apiClient.delete(
      `/admin/customers/${customerId}/members/${userId}`
    );
    
    if (!response.success) {
      console.error(`[CustomerService] Failed to remove member from customer:`, response.error);
      throw new Error(response.error || 'Failed to remove member');
    }
    
    return true;
  },

  /**
   * Get customer teams (FIXED endpoint)
   * Returns all Linear teams assigned to this customer
   */
  async getTeams(customerId: string): Promise<CustomerTeam[]> {
    const response = await apiClient.get(
      `/admin/customers/${customerId}/teams`
    );
    
    console.log(`[CustomerService] RAW RESPONSE:`, JSON.stringify(response, null, 2));
    console.log(`[CustomerService] response.data:`, response.data);
    console.log(`[CustomerService] response.data?.teams:`, response.data?.teams);
    
    if (!response.success) {
      console.error(`[CustomerService] Failed to fetch teams for customer ${customerId}:`, response.error);
      return [];
    }
    
    // Backend returns: { success: true, data: { teams: [...], count: N } }
    const teams = response.data?.teams || [];
    console.log(`[CustomerService] Fetched ${teams.length} teams:`, teams);
    console.log(`[CustomerService] First team:`, teams[0]);
    
    return teams;
  },

  /**
   * Assign team to customer
   * Assigns a Linear team to this customer
   */
  async assignTeam(customerId: string, linearTeamId: string): Promise<boolean> {
    const response = await apiClient.post(
      `/admin/customers/${customerId}/teams`,
      { linearTeamId }
    );
    
    if (!response.success) {
      console.error(`[CustomerService] Failed to assign team to customer:`, response.error);
      throw new Error(response.error || 'Failed to assign team');
    }
    
    return true;
  },

  /**
   * Remove team from customer
   * Removes a Linear team assignment from this customer
   */
  async removeTeam(customerId: string, linearTeamId: string): Promise<boolean> {
    const response = await apiClient.delete(
      `/admin/customers/${customerId}/teams/${linearTeamId}`
    );
    
    if (!response.success) {
      console.error(`[CustomerService] Failed to remove team from customer:`, response.error);
      throw new Error(response.error || 'Failed to remove team');
    }
    
    return true;
  },

  /**
   * Get team members for a specific customer team
   * Returns members assigned to a team within a customer context
   */
  async getTeamMembers(customerId: string, teamId: string): Promise<CustomerMember[]> {
    const response = await apiClient.get<{ members: CustomerMember[]; count: number }>(
      `/admin/customers/${customerId}/teams/${teamId}/members`
    );
    
    if (!response.success) {
      console.error(`[CustomerService] Failed to fetch team members:`, response.error);
      return [];
    }
    
    return response.data?.members || [];
  },
};