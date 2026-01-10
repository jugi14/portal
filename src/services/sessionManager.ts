/**
 * Central Session Manager
 *
 * Coordinates session state across the entire application:
 * - Auth state persistence
 * - Permission caching
 * - Service state management
 * - Page visibility handling
 * - Cache invalidation
 *
 * This ensures consistent behavior when users switch tabs/windows
 */

interface SessionState {
  initialized: boolean;
  authChecked: boolean;
  permissionsLoaded: boolean;
  servicesInitialized: boolean;
  lastActivity: number;
  sessionStartTime: number;
  visibilityChangeCount: number;
}

interface CachedData {
  auth: any;
  permissions: any;
  organizations: any;
  teams: any;
  [key: string]: any;
}

class SessionManager {
  private state: SessionState;
  private cache: CachedData;
  private listeners: Map<string, Set<(data: any) => void>>;
  private visibilityHandlers: Set<(visible: boolean) => void>;
  private activityTimer: NodeJS.Timeout | null = null;
  private warningTimer: NodeJS.Timeout | null = null;
  private warningShown: boolean = false;

  // Session timeout: 12 hours (full work day + overtime)
  private readonly SESSION_TIMEOUT = 12 * 60 * 60 * 1000;

  // Inactivity timeout: 2 hours (realistic for work breaks, meetings, lunch)
  private readonly INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000;

  // Warning before timeout: 5 minutes before inactivity timeout
  private readonly INACTIVITY_WARNING =
    (2 * 60 - 5) * 60 * 1000; // 1h 55m

  // Cache TTL: 5 minutes (for most data)
  private readonly CACHE_TTL = 5 * 60 * 1000;

  // Cache TTL: 1 hour (for static data like teams structure)
  private readonly CACHE_TTL_LONG = 60 * 60 * 1000;

  constructor() {
    this.state = this.loadState();
    this.cache = this.loadCache();
    this.listeners = new Map();
    this.visibilityHandlers = new Set();

    // Initialize visibility tracking
    this.initializeVisibilityTracking();

    // Initialize activity tracking
    this.initializeActivityTracking();

    // PERFORMANCE: SessionManager initialized
  }

  /**
   * Load session state from storage
   */
  private loadState(): SessionState {
    const stored = sessionStorage.getItem("session_state");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // PERFORMANCE: Session state restored
        return parsed;
      } catch (e) {
        // SECURITY: Failed to parse session state
      }
    }

    // Default state
    return {
      initialized: false,
      authChecked: false,
      permissionsLoaded: false,
      servicesInitialized: false,
      lastActivity: Date.now(),
      sessionStartTime: Date.now(),
      visibilityChangeCount: 0,
    };
  }

  /**
   * Save session state to storage
   */
  private saveState(): void {
    try {
      sessionStorage.setItem(
        "session_state",
        JSON.stringify(this.state),
      );
    } catch (e) {
      console.error(
        "[SessionManager] Failed to save state:",
        e,
      );
    }
  }

  /**
   * Load cache from storage
   */
  private loadCache(): CachedData {
    const stored = sessionStorage.getItem("session_cache");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);

        // NEVER restore location state - React Router manages this
        // Preserving location causes stale navigation state
        delete parsed.location;

        // Only log on successful restoration (production-ready)
        return parsed;
      } catch (e) {
        console.warn(
          "[SessionManager] Failed to parse stored cache",
        );
      }
    }

    return {
      auth: null,
      permissions: null,
      organizations: null,
      teams: null,
    };
  }

  /**
   * Save cache to storage
   */
  private saveCache(): void {
    try {
      // Create a copy without location state
      const cacheToSave = { ...this.cache };
      delete cacheToSave.location;

      sessionStorage.setItem(
        "session_cache",
        JSON.stringify(cacheToSave),
      );
    } catch (e) {
      console.error(
        "[SessionManager] Failed to save cache:",
        e,
      );
    }
  }

  /**
   * Initialize page visibility tracking
   */
  private initializeVisibilityTracking(): void {
    if (typeof document === "undefined") return;

    document.addEventListener("visibilitychange", () => {
      const isVisible = !document.hidden;

      if (isVisible) {
        this.state.visibilityChangeCount++;
        this.handlePageVisible();
      } else {
        this.handlePageHidden();
      }

      this.saveState();

      // Notify all visibility handlers
      this.visibilityHandlers.forEach((handler) =>
        handler(isVisible),
      );
    });
  }

  /**
   * Initialize activity tracking
   */
  private initializeActivityTracking(): void {
    if (typeof window === "undefined") return;

    const updateActivity = () => {
      this.state.lastActivity = Date.now();
      this.saveState();

      // Reset warning flag on activity
      this.warningShown = false;

      // Reset warning timer
      if (this.warningTimer) {
        clearTimeout(this.warningTimer);
      }

      // Reset inactivity timer
      if (this.activityTimer) {
        clearTimeout(this.activityTimer);
      }

      // Set warning timer (5 minutes before timeout)
      this.warningTimer = setTimeout(() => {
        if (!this.warningShown) {
          console.log(
            "️ [SessionManager] Session will timeout in 5 minutes due to inactivity",
          );
          this.emit("session:warning", {
            reason: "inactivity",
            timeRemaining: 5 * 60 * 1000, // 5 minutes
          });
          this.warningShown = true;
        }
      }, this.INACTIVITY_WARNING);

      // Set timeout timer (2 hours of inactivity)
      this.activityTimer = setTimeout(() => {
        console.log(
          "[SessionManager] Session inactive for 2 hours",
        );
        this.handleInactiveSession();
      }, this.INACTIVITY_TIMEOUT);
    };

    // Track various user activities
    [
      "mousemove",
      "keydown",
      "click",
      "scroll",
      "touchstart",
    ].forEach((event) => {
      window.addEventListener(event, updateActivity, {
        passive: true,
      });
    });

    // Initial activity update
    updateActivity();
  }

  /**
   * Handle page becoming visible
   * Preserve state but NEVER preserve location - React Router manages routing
   */
  private handlePageVisible(): void {
    const now = Date.now();
    const timeSinceActivity = now - this.state.lastActivity;
    const hoursSinceActivity =
      Math.round((timeSinceActivity / (60 * 60 * 1000)) * 10) /
      10;

    console.log(
      "[SessionManager] Page visible (inactive for",
      hoursSinceActivity,
      "h)",
    );

    // Don't clear session even if expired - auth system handles actual logout
    if (this.isSessionExpired()) {
      const sessionAge =
        Math.round(
          ((now - this.state.sessionStartTime) /
            (60 * 60 * 1000)) *
            10,
        ) / 10;

      // Only log if session is significantly long (16+ hours)
      if (sessionAge >= 16) {
        console.log(
          "[SessionManager] Extended session:",
          sessionAge,
          "h - state preserved",
        );
        console.log(
          "[SessionManager] Consider refreshing if experiencing issues",
        );
      }
    }

    // Remove any cached location state - let React Router sync from window.location
    if (this.cache.location) {
      console.log(
        "[SessionManager] Removing cached location state",
      );
      delete this.cache.location;
      this.saveCache();
    }

    // Always update activity when page becomes visible
    this.state.lastActivity = Date.now();
    this.saveState();

    console.log(
      "[SessionManager] State preserved, activity updated, location cleared",
    );
  }

  /**
   * Handle page becoming hidden
   * Preserve state but NEVER preserve location
   */
  private handlePageHidden(): void {
    console.log(
      "[SessionManager] Page hidden - preserving state (excluding location)",
    );

    // Ensure location is never cached
    if (this.cache.location) {
      delete this.cache.location;
    }

    // Save current state
    this.saveState();
    this.saveCache();

    // Mark when page was hidden
    sessionStorage.setItem(
      "page_hidden_at",
      Date.now().toString(),
    );
  }

  /**
   * Handle inactive session
   */
  private handleInactiveSession(): void {
    const inactiveHours =
      Math.round(
        ((Date.now() - this.state.lastActivity) /
          (60 * 60 * 1000)) *
          10,
      ) / 10;

    // Only log if inactivity is significant (3+ hours)
    if (inactiveHours >= 3) {
      console.log(
        `ℹ️ [SessionManager] Extended inactivity: ${inactiveHours}h - session preserved`,
      );
    }

    // Emit session timeout event (UI can show reconnect dialog)
    this.emit("session:timeout", {
      reason: "inactivity",
      duration: Date.now() - this.state.lastActivity,
    });

    // DON'T clear session immediately - let auth system handle it
    // This prevents data loss if user just left tab open
  }

  /**
   * Check if session has exceeded recommended time
   *
   * Session is considered "long" after 12 hours of total session time,
   * NOT based on inactivity (that's handled separately)
   *
   * Note: This is advisory only - auth system controls actual session validity
   */
  public isSessionExpired(): boolean {
    const now = Date.now();
    const sessionAge = now - this.state.sessionStartTime;
    const isExpired = sessionAge > this.SESSION_TIMEOUT;

    // No logging here - only log in handlePageVisible if session is 16+ hours

    return isExpired;
  }

  /**
   * Check if session should be preserved
   *FIX: Always preserve session if app was initialized - don't check expiry
   * This prevents reload when user switches apps and returns
   */
  public shouldPreserveSession(): boolean {
    const appInitialized =
      sessionStorage.getItem("app_initialized") === "true";
    const sessionPreserved =
      sessionStorage.getItem("session_preserved") === "true";

    //SIMPLIFIED: Just check if initialized, ignore expiry
    // Expiry is handled by auth system, not by forcing reload
    const shouldPreserve = appInitialized && sessionPreserved;

    console.log("[SessionManager] shouldPreserveSession():", {
      appInitialized,
      sessionPreserved,
      shouldPreserve,
    });

    return shouldPreserve;
  }

  /**
   * Mark session as initialized
   */
  public markInitialized(
    component: "auth" | "permissions" | "services" | "all",
  ): void {
    switch (component) {
      case "auth":
        this.state.authChecked = true;
        break;
      case "permissions":
        this.state.permissionsLoaded = true;
        break;
      case "services":
        this.state.servicesInitialized = true;
        break;
      case "all":
        this.state.initialized = true;
        this.state.authChecked = true;
        this.state.permissionsLoaded = true;
        this.state.servicesInitialized = true;
        break;
    }

    sessionStorage.setItem("app_initialized", "true");
    sessionStorage.setItem("session_preserved", "true");

    this.saveState();

    console.log(
      `[SessionManager] Marked ${component} as initialized`,
    );
  }

  /**
   * Cache data with TTL
   * NEVER cache location - React Router manages routing
   */
  public cacheData(
    key: string,
    data: any,
    longTTL: boolean = false,
  ): void {
    // Prevent caching location state
    if (key === "location" || key.includes("location")) {
      console.warn(
        "[SessionManager] Ignoring attempt to cache location state",
      );
      return;
    }

    this.cache[key] = {
      data,
      timestamp: Date.now(),
      ttl: longTTL ? this.CACHE_TTL_LONG : this.CACHE_TTL,
    };

    this.saveCache();

    console.log(
      "[SessionManager] Cached",
      key,
      "(TTL:",
      longTTL ? "1h" : "5m",
      ")",
    );
  }

  /**
   * Get cached data if valid
   */
  public getCachedData(key: string): any | null {
    const cached = this.cache[key];

    if (!cached) {
      return null;
    }

    const now = Date.now();
    const age = now - cached.timestamp;

    if (age > cached.ttl) {
      console.log(
        `⏱️ [SessionManager] Cache expired for ${key} (age: ${Math.round(age / 1000)}s)`,
      );
      delete this.cache[key];
      this.saveCache();
      return null;
    }

    console.log(
      `[SessionManager] Cache hit for ${key} (age: ${Math.round(age / 1000)}s)`,
    );
    return cached.data;
  }

  /**
   * Invalidate cached data
   */
  public invalidateCache(key?: string): void {
    if (key) {
      delete this.cache[key];
      console.log(
        `️ [SessionManager] Invalidated cache for ${key}`,
      );
    } else {
      this.cache = {
        auth: null,
        permissions: null,
        organizations: null,
        teams: null,
      };
      console.log("️ [SessionManager] Invalidated all cache");
    }

    this.saveCache();
  }

  /**
   * Clear session completely
   */
  public clearSession(): void {
    console.log("️ [SessionManager] Clearing session");

    // Clear timers
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
      this.activityTimer = null;
    }

    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }

    this.state = {
      initialized: false,
      authChecked: false,
      permissionsLoaded: false,
      servicesInitialized: false,
      lastActivity: Date.now(),
      sessionStartTime: Date.now(),
      visibilityChangeCount: 0,
    };

    this.cache = {
      auth: null,
      permissions: null,
      organizations: null,
      teams: null,
    };

    // SECURITY: Clear only app-specific cache, preserve Supabase auth state
    // DO NOT use sessionStorage.clear() as it breaks OAuth PKCE flow
    sessionStorage.removeItem('session');
    sessionStorage.removeItem('auth_initialized');

    // Emit clear event
    this.emit("session:cleared", {});

    // Reset warning flag
    this.warningShown = false;
  }

  /**
   * Extend session (reset inactivity timer)
   * Useful when showing "session about to expire" warning
   */
  public extendSession(): void {
    console.log("[SessionManager] Session extended by user");

    // Update last activity
    this.state.lastActivity = Date.now();
    this.saveState();

    // Reset warning
    this.warningShown = false;

    // Clear existing timers
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
    }

    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
    }

    // Set new warning timer
    this.warningTimer = setTimeout(() => {
      if (!this.warningShown) {
        console.log(
          "️ [SessionManager] Session will timeout in 5 minutes due to inactivity",
        );
        this.emit("session:warning", {
          reason: "inactivity",
          timeRemaining: 5 * 60 * 1000,
        });
        this.warningShown = true;
      }
    }, this.INACTIVITY_WARNING);

    // Set new timeout timer
    this.activityTimer = setTimeout(() => {
      console.log(
        "️ [SessionManager] Session inactive for 2 hours",
      );
      this.handleInactiveSession();
    }, this.INACTIVITY_TIMEOUT);

    console.log(
      "[SessionManager] Session extended - timeout reset to 2 hours",
    );
  }

  /**
   * Subscribe to session events
   */
  public on(
    event: string,
    callback: (data: any) => void,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Emit session event
   */
  private emit(event: string, data: any): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  /**
   * Subscribe to visibility changes
   */
  public onVisibilityChange(
    callback: (visible: boolean) => void,
  ): () => void {
    this.visibilityHandlers.add(callback);

    return () => {
      this.visibilityHandlers.delete(callback);
    };
  }

  /**
   * Get session info
   */
  public getSessionInfo() {
    return {
      ...this.state,
      timeSinceStart: Date.now() - this.state.sessionStartTime,
      timeSinceActivity: Date.now() - this.state.lastActivity,
      isExpired: this.isSessionExpired(),
      cacheKeys: Object.keys(this.cache).filter(
        (key) => this.cache[key] !== null,
      ),
    };
  }

  /**
   * Export session for debugging
   */
  public exportSession() {
    return {
      state: this.state,
      cache: Object.keys(this.cache).reduce((acc, key) => {
        const cached = this.cache[key];
        if (cached) {
          acc[key] = {
            hasData: !!cached.data,
            timestamp: cached.timestamp,
            age: Date.now() - cached.timestamp,
            ttl: cached.ttl,
          };
        }
        return acc;
      }, {} as any),
      storage: {
        app_initialized: sessionStorage.getItem(
          "app_initialized",
        ),
        session_preserved: sessionStorage.getItem(
          "session_preserved",
        ),
        page_hidden_at:
          sessionStorage.getItem("page_hidden_at"),
      },
    };
  }
}

// Create singleton instance
export const sessionManager = new SessionManager();

// Expose to window for debugging
if (typeof window !== "undefined") {
  (window as any).sessionManager = sessionManager;
  (window as any).showSession = () => {
    console.group("Session Manager Status");
    const info = sessionManager.getSessionInfo();
    const sessionHours =
      Math.round(
        (info.timeSinceStart / (60 * 60 * 1000)) * 10,
      ) / 10;
    const inactiveMinutes =
      Math.round((info.timeSinceActivity / (60 * 1000)) * 10) /
      10;
    const warningMinutes = Math.round(
      2 * 60 - 5 - inactiveMinutes,
    );

    if (inactiveMinutes >= 115) {
      console.log(
        "️ WARNING: Session will expire in 5 minutes!",
      );
    } else if (inactiveMinutes >= 60) {
      console.log(
        `ℹ️ Warning in ${warningMinutes}m (at 115m inactive)`,
      );
    } else {
      console.log(
        `Session healthy (warning in ${115 - inactiveMinutes}m)`,
      );
    }

    console.log(
      "Visibility Changes:",
      info.visibilityChangeCount,
    );
    console.log(
      "Session Expired:",
      info.isExpired ? "️ YES" : "NO",
    );
    console.log("Cached Keys:", info.cacheKeys);
    console.groupEnd();

    console.log("\nTips:");
    console.log(
      "  • sessionManager.extendSession() - Extend session by 2 hours",
    );
    console.log(
      "  • sessionManager.clearSession() - Clear session manually",
    );
    console.log(
      "  • sessionManager.getSessionInfo() - Get detailed info",
    );

    return sessionManager.exportSession();
  };

  // Helper for extending session
  (window as any).extendSession = () => {
    sessionManager.extendSession();
    console.log("Session extended! Timeout reset to 2 hours.");
  };
}