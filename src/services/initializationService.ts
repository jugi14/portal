/**
 * Initialization Service
 * Handles app startup, cleanup, and health check endpoints
 */

import { projectId, publicAnonKey } from '../utils/supabase/info';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

interface HealthCheckResponse {
  success: boolean;
  message: string;
  timestamp: string;
  version: string;
  environment: string;
  services: {
    server: string;
    kv_store: string;
    endpoints?: Record<string, string>;
  };
}

interface CleanupResponse {
  removedCustomers: number;
  preservedCustomers: number;
  removedCustomerNames: string[];
  removedTeamEntries: number;
  timestamp: string;
  note?: string;
}



class InitializationService {
  private baseUrl: string;
  private defaultHeaders: HeadersInit;

  constructor() {
    this.baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-7f0d90fb`;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${publicAnonKey}`
    };
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      console.log(`[Init] API Request: ${options.method || 'GET'} ${url}`);

      const response = await fetch(url, {
        headers: this.defaultHeaders,
        ...options,
      });

      console.log(`[Init] Response status: ${response.status} ${response.statusText}`);

      const data = await response.json();
      
      if (!response.ok) {
        console.error(`[Init] API Error ${response.status}:`, data);
        return {
          success: false,
          error: data.error || `HTTP ${response.status}: ${response.statusText}`
        };
      }

      console.log(`[Init] API Response:`, data);

      return {
        success: data.success !== false,
        data: data.data || data,
        message: data.message,
        timestamp: data.timestamp,
        error: data.error
      };
    } catch (error) {
      // Log network issues as info rather than error (offline mode is expected)
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.log('[Init] Server connection unavailable - will use offline mode');
        console.log('[Init] This is normal if:');
        console.log('[Init] - Server is not deployed yet');
        console.log('[Init] - Network is offline');
        console.log('[Init] - Running in development without backend');
        console.log('[Init] App will function using cached data and local state.');
      } else {
        // Only log unexpected errors
        console.warn('[Init] API request failed:', error);
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection unavailable'
      };
    }
  }

  /**
   * Public health check for app initialization (no auth required)
   */
  async healthCheck(): Promise<ApiResponse<HealthCheckResponse>> {
    return this.makeRequest<HealthCheckResponse>('/health');
  }

  /**
   * Clean up old data (removes all customers except Guillevin)
   * @deprecated No longer used - cleanup handled manually via Admin panel
   */
  async cleanupData(): Promise<ApiResponse<CleanupResponse>> {
    console.warn('[Init] cleanupData is deprecated and no longer supported');
    return {
      success: false,
      error: 'Cleanup endpoint has been removed. Use Admin panel for manual cleanup.'
    };
  }



  /**
   * Initialize application with all required setup
   */
  async initializeApp(): Promise<ApiResponse<{
    health: HealthCheckResponse;
    cleanup?: CleanupResponse;
  }>> {
    try {
      console.log('[Init] Starting application initialization...');

      // 1. Health check first
      const healthResult = await this.healthCheck();
      if (!healthResult.success) {
        // Return error instead of throwing - let caller handle fallback
        console.log('[Init] Health check unsuccessful, returning error for fallback handling');
        return {
          success: false,
          error: healthResult.error || 'Health check failed'
        };
      }

      // 2. Optional cleanup - DEPRECATED, skipped
      // Cleanup is now handled manually via Admin panel if needed
      const shouldCleanup = localStorage.getItem('app-init-cleanup') === 'true';
      if (shouldCleanup) {
        console.log('[Init] Cleanup flag detected but cleanup is deprecated - removing flag');
        localStorage.removeItem('app-init-cleanup');
      }

      console.log('[Init] Application initialization completed successfully');

      return {
        success: true,
        data: {
          health: healthResult.data!,
        },
        message: 'Application initialized successfully'
      };

    } catch (error) {
      console.warn('[Init] Application initialization encountered error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Initialization failed'
      };
    }
  }

  /**
   * Quick health check with fallback for connectivity issues
   */
  async quickHealthCheck(): Promise<boolean> {
    try {
      const result = await this.healthCheck();
      return result.success;
    } catch (error) {
      console.warn('Quick health check failed, assuming offline mode:', error);
      return false;
    }
  }

  /**
   * Initialize with robust fallback strategy
   * Gracefully handles offline mode without excessive error logging
   */
  async initializeWithFallback(): Promise<{
    success: boolean;
    mode: 'online' | 'offline' | 'partial';
    data?: any;
    error?: string;
  }> {
    try {
      // Try full online initialization
      const result = await this.initializeApp();
      
      if (result.success) {
        console.log('[Init] Application initialized successfully (online mode)');
        return {
          success: true,
          mode: 'online',
          data: result.data
        };
      }

      // Try health check only
      console.log('[Init] Full initialization failed, trying health check only...');
      
      const healthResult = await this.healthCheck();
      if (healthResult.success) {
        console.log('[Init] Health check successful (partial mode)');
        return {
          success: true,
          mode: 'partial',
          data: { health: healthResult.data }
        };
      }

      // Final fallback - offline mode (this is OK, not an error)
      console.log('[Init] Server unavailable, running in offline mode (cached data will be used)');
      return {
        success: true,
        mode: 'offline',
        data: { 
          message: 'Running in offline mode',
          note: 'Using cached data and local state'
        }
      };

    } catch (error) {
      // Only log as warning since offline mode is acceptable
      console.warn('[Init] Initialization fallback to offline mode:', error);
      return {
        success: true, // Changed from false - offline mode is a valid state
        mode: 'offline',
        error: error instanceof Error ? error.message : 'Running in offline mode'
      };
    }
  }

  /**
   * Schedule cleanup for next app start
   */
  scheduleCleanup(): void {
    localStorage.setItem('app-init-cleanup', 'true');
    console.log('Data cleanup scheduled for next app initialization');
  }

  /**
   * Cancel scheduled cleanup
   */
  cancelScheduledCleanup(): void {
    localStorage.removeItem('app-init-cleanup');
    console.log('Scheduled cleanup cancelled');
  }

  /**
   * Check if cleanup is scheduled
   */
  isCleanupScheduled(): boolean {
    return localStorage.getItem('app-init-cleanup') === 'true';
  }
}

// Export singleton instance
export const initializationService = new InitializationService();

// Export types for use in components
export type {
  ApiResponse,
  HealthCheckResponse,
  CleanupResponse
};