/**
 * 🧑 User Service V2
 * 
 * Handles all user-related API calls
 * Uses /admin/users endpoints from API V2
 * 
 * Version: 2.0.0
 * Date: 2025-10-10
 */

import { apiClient, APIResponse } from './apiClient';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'superadmin' | 'admin' | 'client_manager' | 'client_user' | 'tester' | 'viewer';
  customers: string[];
  teams: string[];
  createdAt: string; // ✅ Schema V2.0: camelCase
  updatedAt?: string; // ✅ Schema V2.0: camelCase
  isActive: boolean; // ✅ Schema V2.0: camelCase
  metadata?: Record<string, any>;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  role: string;
  password: string;
  customers: string[];
}

export interface UpdateUserRequest {
  name?: string;
  role?: string;
  customers?: string[];
  teams?: string[];
  isActive?: boolean; // ✅ Schema V2.0: camelCase
}

export const userServiceV2 = {
  /**
   * Get all users
   */
  async getAll(filters?: { role?: string; customerId?: string }): Promise<User[]> {
    const params = new URLSearchParams();
    if (filters?.role) params.set('role', filters.role);
    if (filters?.customerId) params.set('customerId', filters.customerId);
    
    const queryString = params.toString();
    const endpoint = `/admin/users${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiClient.get<{ users: User[]; count: number }>(endpoint);
    
    if (!response.success) {
      console.error('[UserService] Failed to fetch users:', response.error);
      return [];
    }
    
    // Backend returns { success: true, data: { users: [...], count: N } }
    return response.data?.users || [];
  },

  /**
   * Get user by ID
   */
  async getById(userId: string): Promise<User | null> {
    const response = await apiClient.get<User>(`/admin/users/${userId}`);
    
    if (!response.success) {
      console.error(`[UserService] Failed to fetch user ${userId}:`, response.error);
      return null;
    }
    
    return response.data || null;
  },

  /**
   * Create new user
   */
  async create(userData: CreateUserRequest): Promise<User | null> {
    const response = await apiClient.post<User>('/admin/users', userData);
    
    if (!response.success) {
      console.error('[UserService] Failed to create user:', response.error);
      throw new Error(response.error || 'Failed to create user');
    }
    
    return response.data || null;
  },

  /**
   * Update user
   */
  async update(userId: string, updates: UpdateUserRequest): Promise<User | null> {
    const response = await apiClient.put<User>(`/admin/users/${userId}`, updates);
    
    if (!response.success) {
      console.error(`[UserService] Failed to update user ${userId}:`, response.error);
      throw new Error(response.error || 'Failed to update user');
    }
    
    return response.data || null;
  },

  /**
   * Delete user
   */
  async delete(userId: string): Promise<boolean> {
    const response = await apiClient.delete(`/admin/users/${userId}`);
    
    if (!response.success) {
      console.error(`[UserService] Failed to delete user ${userId}:`, response.error);
      throw new Error(response.error || 'Failed to delete user');
    }
    
    return true;
  },
};
