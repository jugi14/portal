/**
 * SUPERADMIN MANAGEMENT SERVICE - Schema v2.0
 * 
 * REFACTORED: Dynamic superadmin management via KV store
 * - No hardcoded emails
 * - Uses apiClient for authentication
 * - Full audit trail
 * - Caching support
 * 
 * Version: 2.0.0
 * Date: 2025-10-15
 */

import { apiClient } from './apiClient';

/**
 * Get complete superadmin list from KV store
 * Uses apiClient for authenticated requests with caching
 */
export async function getSuperAdminEmails(): Promise<string[]> {
  try {
    const response = await apiClient.get<{ superadmins: string[] }>('/superadmin/list');

    if (!response.success) {
      console.warn('[SuperadminService] Failed to fetch superadmin list');
      return [];
    }

    return response.data?.superadmins || [];
  } catch (error) {
    console.error('[SuperadminService] Error fetching superadmins:', error);
    return [];
  }
}

/**
 * Initialize superadmin list (one-time setup, no auth required)
 * Only works when KV store is empty
 */
export async function initializeSuperadmins(emails: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await apiClient.post('/superadmin/initialize', { emails });

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to initialize superadmins'
      };
    }
    return { success: true };
  } catch (error) {
    console.error('[SuperadminService] Error initializing superadmins:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Add email to superadmin list (requires existing superadmin auth)
 */
export async function addSuperAdmin(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await apiClient.post('/superadmin/add', { email });

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to add superadmin'
      };
    }
    return { success: true };
  } catch (error) {
    console.error('[SuperadminService] Error adding superadmin:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Remove email from superadmin list (requires existing superadmin auth)
 */
export async function removeSuperAdmin(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await apiClient.delete(`/superadmin/remove/${encodeURIComponent(email)}`);

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to remove superadmin'
      };
    }
    return { success: true };
  } catch (error) {
    console.error('[SuperadminService] Error removing superadmin:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check if email is a superadmin (checks KV store)
 */
export async function isSuperAdmin(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  
  try {
    const allSuperadmins = await getSuperAdminEmails();
    return allSuperadmins.some(sa => sa.toLowerCase() === normalizedEmail);
  } catch (error) {
    console.error('[SuperadminService] Error checking superadmin status:', error);
    return false;
  }
}

/**
 * Get audit trail for superadmin changes
 * 
 * PERFORMANCE: Backend uses 5-minute cache and limits to 100 most recent logs
 */
export async function getSuperadminAuditTrail(): Promise<any[]> {
  try {
    const response = await apiClient.get<{ 
      logs: any[];
      count: number;
      total?: number;
      cached?: boolean;
    }>('/superadmin/audit');

    if (!response.success) {
      console.warn('[SuperadminService] Failed to fetch audit trail');
      return [];
    }

    // Backend now returns 'logs' instead of 'auditTrail'
    const logs = response.data?.logs || [];
    
    if (response.data?.cached) {
    }
    
    if (response.data?.total && response.data.total > response.data.count) {
    }

    return logs;
  } catch (error) {
    console.error('[SuperadminService] Error fetching audit trail:', error);
    return [];
  }
}
