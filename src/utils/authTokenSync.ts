/**
 *Auth Token Synchronization Utility
 *
 * Ensures access token is properly synced between:
 * - Supabase Auth Session
 * - API Client
 * - Local Storage
 *
 * Fixes 401 Unauthorized errors from missing/stale tokens
 *
 * Version: 1.0.0
 * Date: 2025-10-10
 */

import { supabase } from "./supabase/client";
import { apiClient } from "../services/apiClient";

interface TokenSyncStatus {
  hasSupabaseSession: boolean;
  hasAccessToken: boolean;
  hasApiClientToken: boolean;
  tokenMatch: boolean;
  expiresAt?: number;
  isExpired?: boolean;
  userId?: string;
  userEmail?: string;
}

class AuthTokenSyncManager {
  private syncInterval: number | null = null;
  private lastSyncTime: number = 0;

  /**
   *Diagnostic: Check current auth token status
   */
  async checkTokenStatus(): Promise<TokenSyncStatus> {
    try {
      // Get Supabase session
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      const supabaseToken = session?.access_token;
      const apiClientToken = apiClient.getAccessToken();

      const status: TokenSyncStatus = {
        hasSupabaseSession: !!session,
        hasAccessToken: !!supabaseToken,
        hasApiClientToken: !!apiClientToken,
        tokenMatch: supabaseToken === apiClientToken,
        expiresAt: session?.expires_at,
        isExpired: session?.expires_at
          ? Date.now() / 1000 > session.expires_at
          : undefined,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
      };

      return status;
    } catch (error) {
      console.error(
        "[AuthTokenSync] Error checking token status:",
        error,
      );
      return {
        hasSupabaseSession: false,
        hasAccessToken: false,
        hasApiClientToken: false,
        tokenMatch: false,
      };
    }
  }

  /**
   *Sync access token from Supabase to API Client
   */
  async syncToken(): Promise<boolean> {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error(
          "[AuthTokenSync] Error getting session:",
          error,
        );
        return false;
      }

      if (!session?.access_token) {
        apiClient.setAccessToken(null);
        return false;
      }

      // Check if token is expired
      const isExpired =
        session.expires_at &&
        Date.now() / 1000 > session.expires_at;
      if (isExpired) {
        const {
          data: { session: newSession },
          error: refreshError,
        } = await supabase.auth.refreshSession();

        if (refreshError || !newSession) {
          console.error(
            "[AuthTokenSync] Failed to refresh token:",
            refreshError,
          );
          apiClient.setAccessToken(null);
          return false;
        }

        apiClient.setAccessToken(newSession.access_token);
        this.lastSyncTime = Date.now();
        return true;
      }

      // Set token in API client
      apiClient.setAccessToken(session.access_token);
      this.lastSyncTime = Date.now();
      return true;
    } catch (error) {
      console.error(
        "[AuthTokenSync] Error syncing token:",
        error,
      );
      return false;
    }
  }

  /**
   *Force token refresh and sync
   */
  async forceRefreshAndSync(): Promise<boolean> {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.refreshSession();

      if (error || !session) {
        console.error(
          "[AuthTokenSync] Failed to refresh session:",
          error,
        );
        apiClient.setAccessToken(null);
        return false;
      }

      apiClient.setAccessToken(session.access_token);
      this.lastSyncTime = Date.now();
      return true;
    } catch (error) {
      console.error(
        "[AuthTokenSync] Error force-refreshing token:",
        error,
      );
      return false;
    }
  }

  /**
   *Start automatic token sync (every 5 minutes)
   */
  startAutoSync(intervalMinutes: number = 5) {
    if (this.syncInterval) {
      return;
    }

    // Initial sync
    this.syncToken();

    // Set up periodic sync
    this.syncInterval = window.setInterval(
      () => {
        this.syncToken();
      },
      intervalMinutes * 60 * 1000,
    );
  }

  /**
   *Stop automatic token sync
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   *Clear all auth data
   */
  async clearAuth() {
    try {
      await supabase.auth.signOut();
      apiClient.setAccessToken(null);
      sessionStorage.removeItem("current_session");
      sessionStorage.removeItem("auth_initialized");
      return true;
    } catch (error) {
      console.error(
        "[AuthTokenSync] Error clearing auth:",
        error,
      );
      return false;
    }
  }

  /**
   *Get detailed diagnostic report
   */
  async getDiagnosticReport(): Promise<string> {
    const status = await this.checkTokenStatus();

    let report = "\n═══════════════════════════════════════\n";
    report += "AUTH TOKEN DIAGNOSTIC REPORT\n";
    report += "═══════════════════════════════════════\n\n";

    report += `Supabase Session: ${status.hasSupabaseSession ? "Present" : "Missing"}\n`;
    report += `Access Token: ${status.hasAccessToken ? "Present" : "Missing"}\n`;
    report += `API Client Token: ${status.hasApiClientToken ? "Present" : "Missing"}\n`;
    report += `Token Sync: ${status.tokenMatch ? "Synced" : "Out of Sync"}\n`;

    if (status.expiresAt) {
      const expiresDate = new Date(status.expiresAt * 1000);
      report += `Expires At: ${expiresDate.toLocaleString()}\n`;
      report += `Status: ${status.isExpired ? "EXPIRED" : "Valid"}\n`;
    }

    if (status.userEmail) {
      report += `User: ${status.userEmail}\n`;
    }

    report += "\n";

    // Recommendations
    if (!status.hasSupabaseSession) {
      report +=
        "️ ISSUE: No active session. Please sign in again.\n";
    } else if (!status.hasApiClientToken) {
      report +=
        "️ ISSUE: Token not synced to API client. Run: authTokenSync.syncToken()\n";
    } else if (!status.tokenMatch) {
      report +=
        "️ ISSUE: Token mismatch. Run: authTokenSync.forceRefreshAndSync()\n";
    } else if (status.isExpired) {
      report +=
        "️ ISSUE: Token expired. Run: authTokenSync.forceRefreshAndSync()\n";
    } else {
      report +=
        "All checks passed! Auth is working correctly.\n";
    }

    report += "\n═══════════════════════════════════════\n";

    return report;
  }

  /**
   *Quick fix for common auth issues
   */
  async quickFix(): Promise<void> {
    const status = await this.checkTokenStatus();

    if (!status.hasSupabaseSession) {
      // SECURITY: No session - please sign in
      return;
    }

    if (status.isExpired) {
      await this.forceRefreshAndSync();
    } else if (
      !status.hasApiClientToken ||
      !status.tokenMatch
    ) {
      await this.syncToken();
    }

    // Verify fix worked
    const newStatus = await this.checkTokenStatus();
    if (
      newStatus.hasApiClientToken &&
      newStatus.tokenMatch &&
      !newStatus.isExpired
    ) {
      console.log("[AuthTokenSync] Token synced successfully");
    }
  }
}

// Export singleton instance
export const authTokenSync = new AuthTokenSyncManager();

//Browser console utilities
if (typeof window !== "undefined") {
  (window as any).authTokenSync = authTokenSync;

  // Quick helpers
  (window as any).checkAuth = () =>
    authTokenSync.getDiagnosticReport().then(console.log);
  (window as any).fixAuth = () => authTokenSync.quickFix();
  (window as any).refreshAuth = () =>
    authTokenSync.forceRefreshAndSync();
}