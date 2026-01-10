/**
 * Secure Token Storage Service
 * 
 * Provides secure, session-scoped token storage with automatic expiration checking.
 * Replaces direct localStorage access to improve security posture.
 * 
 * Security Features:
 * - Session-scoped storage (cleared on browser/tab close)
 * - Automatic token expiration checking
 * - Centralized token access control
 * - Migration from localStorage to sessionStorage
 * 
 * Version: 1.0.0
 * Date: 2025-01-16
 */

export interface TokenData {
  token: string;
  expiresAt: number;
  issuedAt: number;
  isExpired: boolean;
}

class SecureTokenStorage {
  private readonly TOKEN_KEY = 'teifi_auth_token';
  private readonly EXPIRY_KEY = 'teifi_token_expiry';
  private readonly ISSUED_KEY = 'teifi_token_issued';
  private readonly OLD_TOKEN_KEY = 'teifi_access_token'; // For migration
  
  /**
   * Set authentication token with expiration
   * Stores in sessionStorage (session-scoped, more secure than localStorage)
   */
  setToken(token: string, expiresAt: number): void {
    try {
      const issuedAt = Date.now();
      
      // SECURITY WARNING: sessionStorage is vulnerable to XSS attacks
      // If an attacker injects malicious JavaScript, they can steal tokens
      // This is a known limitation of browser-based token storage
      // Mitigation: Strict CSP, XSS prevention, short token expiry
      sessionStorage.setItem(this.TOKEN_KEY, token);
      sessionStorage.setItem(this.EXPIRY_KEY, expiresAt.toString());
      sessionStorage.setItem(this.ISSUED_KEY, issuedAt.toString());
      
      // SECURITY: Do not log token information
      
      // Clear old localStorage token if exists (migration)
      this.clearOldToken();
    } catch (error) {
      console.error('[SecureToken] Failed to store token:', error);
    }
  }
  
  /**
   * Get authentication token
   * Returns null if token is expired or doesn't exist
   */
  getToken(): string | null {
    try {
      const token = sessionStorage.getItem(this.TOKEN_KEY);
      const expiryStr = sessionStorage.getItem(this.EXPIRY_KEY);
      
      if (!token || !expiryStr) {
        // Try to migrate from old localStorage
        const migratedToken = this.migrateFromLocalStorage();
        if (migratedToken) {
          return migratedToken;
        }
        return null;
      }
      
      const expiresAt = parseInt(expiryStr, 10);
      const now = Date.now();
      
      // Check if token expired
      if (now >= expiresAt) {
        console.warn('[SecureToken] Token expired, clearing');
        this.clearToken();
        return null;
      }
      
      // Warn if token expires soon (< 5 minutes)
      const timeToExpiry = expiresAt - now;
      if (timeToExpiry < 5 * 60 * 1000) {
        console.warn('[SecureToken] Token expires in', 
          Math.round(timeToExpiry / 1000 / 60), 'minutes - consider refreshing');
      }
      
      return token;
    } catch (error) {
      console.error('[SecureToken] Failed to retrieve token:', error);
      return null;
    }
  }
  
  /**
   * Get token data including metadata
   * NOTE: If this returns a TokenData object, the token is guaranteed to be valid
   * because getToken() already validated expiry and would have returned null if expired
   */
  getTokenData(): TokenData | null {
    try {
      // Read token directly without validation to get metadata
      const token = sessionStorage.getItem(this.TOKEN_KEY);
      const expiryStr = sessionStorage.getItem(this.EXPIRY_KEY);
      const issuedStr = sessionStorage.getItem(this.ISSUED_KEY);
      
      if (!token || !expiryStr || !issuedStr) {
        // Try migration from localStorage
        const migratedToken = this.migrateFromLocalStorage();
        if (migratedToken) {
          // Recursively call after migration
          return this.getTokenData();
        }
        return null;
      }
      
      const expiresAt = parseInt(expiryStr, 10);
      const issuedAt = parseInt(issuedStr, 10);
      const now = Date.now();
      
      // Check if token is expired
      if (now >= expiresAt) {
        console.warn('[SecureToken] Token expired, clearing');
        this.clearToken();
        return null;
      }
      
      return {
        token,
        expiresAt,
        issuedAt,
        isExpired: false, // Token is guaranteed valid at this point
      };
    } catch (error) {
      console.error('[SecureToken] Failed to get token data:', error);
      return null;
    }
  }
  
  /**
   * Check if token is valid (exists and not expired)
   */
  isValid(): boolean {
    return this.getToken() !== null;
  }
  
  /**
   * Check if token will expire soon (within specified minutes)
   */
  expiresWithin(minutes: number): boolean {
    try {
      const expiryStr = sessionStorage.getItem(this.EXPIRY_KEY);
      if (!expiryStr) return true; // Consider it expired if no expiry info
      
      const expiresAt = parseInt(expiryStr, 10);
      const now = Date.now();
      const timeToExpiry = expiresAt - now;
      
      return timeToExpiry <= (minutes * 60 * 1000);
    } catch (error) {
      return true; // Assume expired on error
    }
  }
  
  /**
   * Get time remaining until token expires (in milliseconds)
   */
  getTimeToExpiry(): number | null {
    try {
      const expiryStr = sessionStorage.getItem(this.EXPIRY_KEY);
      if (!expiryStr) return null;
      
      const expiresAt = parseInt(expiryStr, 10);
      const timeRemaining = expiresAt - Date.now();
      
      return timeRemaining > 0 ? timeRemaining : 0;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Clear token from storage
   */
  clearToken(): void {
    try {
      sessionStorage.removeItem(this.TOKEN_KEY);
      sessionStorage.removeItem(this.EXPIRY_KEY);
      sessionStorage.removeItem(this.ISSUED_KEY);
      // SECURITY: Do not log token operations
    } catch (error) {
      console.error('[SecureToken] Failed to clear token:', error);
    }
  }
  
  /**
   * Migrate token from old localStorage to new sessionStorage
   * PRIVATE: Called automatically by getToken() if needed
   */
  private migrateFromLocalStorage(): string | null {
    try {
      const oldToken = localStorage.getItem(this.OLD_TOKEN_KEY);
      if (!oldToken) return null;
      
      // SECURITY: Do not log token operations during migration
      
      // Set token with reasonable default expiry (1 hour)
      // Real expiry will be updated when session is validated
      const defaultExpiry = Date.now() + (60 * 60 * 1000);
      this.setToken(oldToken, defaultExpiry);
      
      // Don't clear old token yet - let AuthContext handle it after validation
      
      return oldToken;
    } catch (error) {
      console.error('[SecureToken] Migration failed:', error);
      return null;
    }
  }
  
  /**
   * Clear old localStorage token (migration cleanup)
   */
  private clearOldToken(): void {
    try {
      if (localStorage.getItem(this.OLD_TOKEN_KEY)) {
        localStorage.removeItem(this.OLD_TOKEN_KEY);
        // SECURITY: Do not log token operations
      }
    } catch (error) {
      // Silent fail - not critical
    }
  }
  
  /**
   * Get token information for debugging
   */
  getDebugInfo(): {
    hasToken: boolean;
    isExpired: boolean;
    expiresIn?: string;
    issuedAt?: string;
  } {
    const tokenData = this.getTokenData();
    
    if (!tokenData) {
      return {
        hasToken: false,
        isExpired: true,
      };
    }
    
    const now = Date.now();
    const timeToExpiry = tokenData.expiresAt - now;
    const isExpired = timeToExpiry <= 0;
    
    return {
      hasToken: true,
      isExpired,
      expiresIn: isExpired 
        ? 'expired' 
        : `${Math.round(timeToExpiry / 1000 / 60)} minutes`,
      issuedAt: new Date(tokenData.issuedAt).toISOString(),
    };
  }
}

// Export singleton instance
export const secureTokenStorage = new SecureTokenStorage();

// Export class for testing
export { SecureTokenStorage };
