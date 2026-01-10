import { useEffect, useRef } from 'react';

/**
 * Session Persistence Hook
 * 
 * Prevents unnecessary re-initialization and reloads when:
 * - Switching browser tabs
 * - Returning to the app after being away
 * - Page regains focus
 * 
 * Uses Page Visibility API to intelligently manage app state
 */
export function useSessionPersistence() {
  const lastActivityRef = useRef<number>(Date.now());
  const isInitializedRef = useRef<boolean>(false);
  const visibilityChangeCountRef = useRef<number>(0);

  useEffect(() => {
    // Mark as initialized on first mount
    isInitializedRef.current = true;
    
    // INCREASED: Session timeout (2 hours of inactivity) - matches sessionManager
    // This prevents unnecessary session expiry when user switches to other apps
    const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours (was 30 minutes)
    
    // Update last activity timestamp
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
      sessionStorage.setItem('last_activity', Date.now().toString());
    };

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is now hidden - track silently
        sessionStorage.setItem('tab_hidden_at', Date.now().toString());
      } else {
        // Tab is now visible
        visibilityChangeCountRef.current++;
        
        const hiddenAt = sessionStorage.getItem('tab_hidden_at');
        const now = Date.now();
        
        if (hiddenAt) {
          // Check if session expired during hidden period
          const lastActivity = sessionStorage.getItem('last_activity');
          if (lastActivity) {
            const inactiveDuration = now - parseInt(lastActivity);
            
            if (inactiveDuration > SESSION_TIMEOUT) {
              const hoursInactive = Math.round(inactiveDuration / (60 * 60 * 1000) * 10) / 10;
              console.warn(`[Session] Session inactive for ${hoursInactive}h (timeout: ${SESSION_TIMEOUT / (60 * 60 * 1000)}h)`);
            }
          }
          
          // Always update activity when page becomes visible
          // This keeps session alive if user is actively switching back to app
          updateActivity();
        }
      }
    };

    // Handle page focus
    const handleFocus = () => {
      // Track activity silently (no log spam)
      updateActivity();
    };

    // Handle page blur
    const handleBlur = () => {
      // Track activity silently (no log spam)
      updateActivity();
    };

    // Handle beforeunload
    const handleBeforeUnload = () => {
      // Save state silently
      updateActivity();
      sessionStorage.setItem('app_initialized', 'true');
      sessionStorage.setItem('session_preserved', 'true');
    };

    // Activity trackers
    const handleUserActivity = () => {
      updateActivity();
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Track user activity
    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);

    // Initialize session markers
    updateActivity();
    sessionStorage.setItem('app_initialized', 'true');

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
    };
  }, []);

  return {
    isInitialized: isInitializedRef.current,
    lastActivity: lastActivityRef.current,
    visibilityChangeCount: visibilityChangeCountRef.current,
  };
}

/**
 * Smart Initialization Hook
 * 
 * Skips re-initialization when:
 * - App was recently initialized (within session)
 * - User is just switching tabs
 * - Session is still valid
 */
export function useSmartInitialization() {
  const shouldSkipInit = () => {
    // Check if app was already initialized in this session
    const appInitialized = sessionStorage.getItem('app_initialized');
    const sessionPreserved = sessionStorage.getItem('session_preserved');
    const lastInit = sessionStorage.getItem('last_init_time');
    
    if (appInitialized === 'true' && sessionPreserved === 'true') {
      // Check how long ago it was initialized
      if (lastInit) {
        const timeSinceInit = Date.now() - parseInt(lastInit);
        
        // INCREASED: Session age check (2 hours) - matches sessionManager
        const MAX_SESSION_AGE = 2 * 60 * 60 * 1000; // 2 hours (was 30 minutes)
        
        if (timeSinceInit < MAX_SESSION_AGE) {
          // Session still valid - skip init silently
          return true;
        }
      }
    }
    
    return false;
  };

  const markInitialized = () => {
    sessionStorage.setItem('app_initialized', 'true');
    sessionStorage.setItem('session_preserved', 'true');
    sessionStorage.setItem('last_init_time', Date.now().toString());
  };

  return {
    shouldSkipInit: shouldSkipInit(),
    markInitialized,
  };
}

/**
 * Session Status Monitor
 * 
 * Console utility to check session status
 */
export function showSessionStatus() {
  const appInitialized = sessionStorage.getItem('app_initialized');
  const sessionPreserved = sessionStorage.getItem('session_preserved');
  const lastActivity = sessionStorage.getItem('last_activity');
  const tabHiddenAt = sessionStorage.getItem('tab_hidden_at');
  const lastInitTime = sessionStorage.getItem('last_init_time');
  
  console.group('[Session Status]');
  console.log('App Initialized:', appInitialized === 'true' ? 'YES' : 'NO');
  console.log('Session Preserved:', sessionPreserved === 'true' ? 'YES' : 'NO');
  
  if (lastActivity) {
    const timeSinceActivity = Date.now() - parseInt(lastActivity);
    console.log('Last Activity:', `${Math.round(timeSinceActivity / 1000)}s ago`);
  }
  
  if (tabHiddenAt) {
    const hiddenDuration = Date.now() - parseInt(tabHiddenAt);
    console.log('Tab Hidden:', `${Math.round(hiddenDuration / 1000)}s ago`);
  }
  
  if (lastInitTime) {
    const timeSinceInit = Date.now() - parseInt(lastInitTime);
    console.log('Initialized:', `${Math.round(timeSinceInit / 1000)}s ago`);
  }
  
  console.log('Page Visibility:', document.hidden ? 'Hidden' : 'Visible');
  console.log('Page Focused:', document.hasFocus() ? 'Yes' : 'No');
  console.groupEnd();
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).showSessionStatus = showSessionStatus;
}
