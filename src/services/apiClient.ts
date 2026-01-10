/**
 * API Client V2 - Centralized HTTP Client
 * 
 * Clean, type-safe API client for Backend V2
 * Handles authentication, errors, and retries
 * 
 * Version: 2.1.0
 * Date: 2025-01-16
 */

import { projectId, publicAnonKey } from '../utils/supabase/info';
import { secureTokenStorage } from './secureTokenStorage';

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  source?: 'cache' | 'api' | 'kv' | string;
}

export interface APIError {
  success: false;
  error: string;
  code?: string;
  status?: number;
}

class APIClient {
  private baseURL: string;
  private accessToken: string | null = null;

  constructor() {
    // Auto-detect API URL based on environment
    const isDevelopment = import.meta.env.DEV;
    const customApiUrl = import.meta.env.VITE_API_BASE_URL;
    
    if (customApiUrl) {
      // Use custom API URL (for local development)
      this.baseURL = `${customApiUrl}/make-server-7f0d90fb`;
    } else if (isDevelopment) {
      // Development: use local backend
      this.baseURL = 'http://localhost:3001/make-server-7f0d90fb';
    } else {
      // Production: use Vercel serverless function or Supabase Functions
      // Vercel sẽ tự động route /make-server-7f0d90fb/* to /api/server.ts
      // Fallback to Supabase Functions if not on Vercel
      this.baseURL = `/make-server-7f0d90fb`;
    }
  }

  /**
   * Set authentication token with expiration
   * Uses secure sessionStorage (cleared on browser close)
   */
  setAccessToken(token: string | null, expiresAt?: number) {
    if (token) {
      // Use secure token storage with expiry
      const expiry = expiresAt || (Date.now() + 60 * 60 * 1000); // Default 1 hour
      secureTokenStorage.setToken(token, expiry);
      // SECURITY: Do not log token information
    } else {
      secureTokenStorage.clearToken();
      // SECURITY: Do not log token operations
    }
  }

  /**
   * Get current access token from secure storage
   * Automatically validates expiration
   * @deprecated Use secureTokenStorage.getToken() directly
   */
  getAccessToken(): string | null {
    return secureTokenStorage.getToken();
  }
  
  /**
   * Get current access token (alias for getAccessToken)
   * Automatically validates expiration
   */
  getToken(): string | null {
    return secureTokenStorage.getToken();
  }

  /**
   * Core request method with error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const startTime = Date.now();

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      // Add auth token from secure storage (validates expiry)
      const token = this.getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      // CRITICAL: Check if response has content before parsing
      const contentType = response.headers.get('content-type');
      const hasJsonContent = contentType?.includes('application/json');
      
      let data: any;
      
      // Try to parse response body
      try {
        const text = await response.text();
        
        // Only parse as JSON if content-type is JSON and text is not empty
        if (text && hasJsonContent) {
          data = JSON.parse(text);
        } else if (text) {
          // Non-JSON response - wrap in error structure
          data = {
            success: false,
            error: text || 'Server returned non-JSON response',
          };
        } else {
          // Empty response
          data = {
            success: false,
            error: 'Server returned empty response',
          };
        }
      } catch (parseError) {
        console.error(`[APIClient] Failed to parse response from ${endpoint}:`, parseError);
        return {
          success: false,
          error: 'Invalid response format from server',
          code: 'PARSE_ERROR',
        };
      }

      if (!response.ok) {
        console.error(
          `[APIClient] ${response.status} ${endpoint}`,
          data.error || data.message
        );
        
        return {
          success: false,
          error: data.error || `Request failed with status ${response.status}`,
          code: data.code,
        };
      }
      return data;
    } catch (error) {
      console.error(`[APIClient] Network error ${endpoint}:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
        code: 'NETWORK_ERROR',
      };
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'GET',
    });
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, body?: any): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, body?: any): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  /**
   * File upload request (for FormData)
   * CRITICAL: Does not set Content-Type - browser sets it with boundary
   */
  async upload<T>(endpoint: string, formData: FormData): Promise<APIResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    try {
      const headers: HeadersInit = {};

      // Add auth token from secure storage (validates expiry)
      const token = this.getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // CRITICAL: Do NOT set Content-Type for FormData
      // Browser automatically sets it with boundary parameter

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(
          `[APIClient] ${response.status} ${endpoint}`,
          data.error || data.message
        );
        
        return {
          success: false,
          error: data.error || `Upload failed with status ${response.status}`,
          code: data.code,
        };
      }

      return data;
    } catch (error) {
      console.error(`[APIClient] Upload error ${endpoint}:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
        code: 'UPLOAD_ERROR',
      };
    }
  }

  /**
   * Request with retry logic
   */
  async requestWithRetry<T>(
    endpoint: string,
    options: RequestInit = {},
    maxRetries = 3
  ): Promise<APIResponse<T>> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.request<T>(endpoint, options);
        
        if (result.success) {
          return result;
        }

        // Don't retry client errors (4xx)
        if (result.code === 'UNAUTHORIZED' || result.code === 'FORBIDDEN' || result.code === 'NOT_FOUND') {
          return result;
        }

        lastError = result;
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`[APIClient] Retry ${attempt}/${maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`[APIClient] Retry ${attempt}/${maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      error: lastError?.error || 'Request failed after retries',
      code: 'MAX_RETRIES_EXCEEDED',
    };
  }
}

// Export singleton instance
export const apiClient = new APIClient();

// Export for debugging
if (typeof window !== 'undefined') {
  (window as any).apiClient = apiClient;
}