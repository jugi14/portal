/**
 * Token Refresh Service
 * 
 * Automatically refreshes authentication tokens before they expire.
 * Prevents users from being logged out due to expired tokens.
 * 
 * Features:
 * - Auto-refresh tokens 5 minutes before expiry
 * - Graceful error handling with retry logic
 * - Integration with Supabase auth
 * - Event notifications for refresh success/failure
 * 
 * Version: 1.0.0
 * Date: 2025-01-16
 */

import { supabase } from '../utils/supabase/client';
import { secureTokenStorage } from './secureTokenStorage';
import { toast } from 'sonner@2.0.3';

export type RefreshEventType = 'success' | 'failure' | 'scheduled';

export interface RefreshEvent {
  type: RefreshEventType;
  timestamp: number;
  expiresAt?: number;
  error?: string;
}

class TokenRefreshService {
  private refreshTimer: NodeJS.Timeout | null = null;
  private isRefreshing = false;
  private retryCount = 0;
  private readonly MAX_RETRIES = 3;
  private readonly REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
  private readonly RETRY_DELAY_MS = 30 * 1000; // 30 seconds
  
  // Event listeners for refresh events
  private eventListeners: ((event: RefreshEvent) => void)[] = [];
  
  /**
   * Schedule automatic token refresh
   * Refreshes token 5 minutes before expiry
   */
  scheduleRefresh(expiresAt: number): void {
    // Clear existing timer
    this.cancelRefresh();
    
    const now = Date.now();
    const timeToRefresh = expiresAt - this.REFRESH_BEFORE_EXPIRY_MS - now;
    
    if (timeToRefresh <= 0) {
      // Token expires in less than 5 minutes - refresh immediately
      // SECURITY: Do not log token information
      this.refreshToken();
      return;
    }
    
    // SECURITY: Do not log token timing information
    
    this.refreshTimer = setTimeout(() => {
      this.refreshToken();
    }, timeToRefresh);
    
    this.emitEvent({
      type: 'scheduled',
      timestamp: Date.now(),
      expiresAt,
    });
  }
  
  /**
   * Manually trigger token refresh
   * Returns true if refresh successful, false otherwise
   */
  async refreshToken(): Promise<boolean> {
    if (this.isRefreshing) {
      // SECURITY: Do not log token operations
      return false;
    }
    
    this.isRefreshing = true;
    
    try {
      // SECURITY: Do not log token operations
      
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        throw error;
      }
      
      if (!data.session) {
        throw new Error('No session returned from refresh');
      }
      
      // Update stored token with new expiry
      const expiresAt = data.session.expires_at 
        ? data.session.expires_at * 1000 
        : Date.now() + (60 * 60 * 1000); // Default 1 hour
      
      secureTokenStorage.setToken(data.session.access_token, expiresAt);
      
      // Schedule next refresh
      this.scheduleRefresh(expiresAt);
      
      // Reset retry count on success
      this.retryCount = 0;
      
      // SECURITY: Do not log token operations
      
      this.emitEvent({
        type: 'success',
        timestamp: Date.now(),
        expiresAt,
      });
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[TokenRefresh] Refresh failed:', errorMessage);
      
      this.emitEvent({
        type: 'failure',
        timestamp: Date.now(),
        error: errorMessage,
      });
      
      // Retry logic
      if (this.retryCount < this.MAX_RETRIES) {
        this.retryCount++;
        // SECURITY: Do not log token operations
        
        setTimeout(() => {
          this.refreshToken();
        }, this.RETRY_DELAY_MS);
      } else {
        console.error('[TokenRefresh] Max retries reached, token refresh failed');
        toast.error('Session expired. Please sign in again.');
        
        // Clear token to force re-login
        secureTokenStorage.clearToken();
      }
      
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }
  
  /**
   * Check if token needs refresh and trigger if necessary
   * Returns true if token is valid (or refreshed successfully)
   */
  async ensureValidToken(): Promise<boolean> {
    const tokenData = secureTokenStorage.getTokenData();
    
    if (!tokenData) {
      // SECURITY: Do not log token information
      return false;
    }
    
    const timeToExpiry = tokenData.expiresAt - Date.now();
    
    // If token expires in less than 5 minutes, refresh it
    if (timeToExpiry < this.REFRESH_BEFORE_EXPIRY_MS) {
      // SECURITY: Do not log token information
      return await this.refreshToken();
    }
    
    // Token is still valid
    return true;
  }
  
  /**
   * Cancel scheduled refresh
   */
  cancelRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
      // SECURITY: Do not log token operations
    }
  }
  
  /**
   * Stop all refresh operations
   */
  stop(): void {
    this.cancelRefresh();
    this.isRefreshing = false;
    this.retryCount = 0;
    // SECURITY: Do not log token operations
  }
  
  /**
   * Get refresh status
   */
  getStatus(): {
    isRefreshing: boolean;
    hasScheduledRefresh: boolean;
    retryCount: number;
    timeToRefresh?: number;
  } {
    return {
      isRefreshing: this.isRefreshing,
      hasScheduledRefresh: this.refreshTimer !== null,
      retryCount: this.retryCount,
      timeToRefresh: this.refreshTimer ? undefined : undefined, // Would need to track this separately
    };
  }
  
  /**
   * Add event listener for refresh events
   */
  addEventListener(listener: (event: RefreshEvent) => void): void {
    this.eventListeners.push(listener);
  }
  
  /**
   * Remove event listener
   */
  removeEventListener(listener: (event: RefreshEvent) => void): void {
    this.eventListeners = this.eventListeners.filter(l => l !== listener);
  }
  
  /**
   * Emit refresh event to all listeners
   */
  private emitEvent(event: RefreshEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[TokenRefresh] Event listener error:', error);
      }
    });
  }
}

// Export singleton instance
export const tokenRefreshService = new TokenRefreshService();

// Export class for testing
export { TokenRefreshService };
