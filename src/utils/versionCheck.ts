/**
 * Version Check & Cache Busting
 * 
 * Ensures users always run the latest code by detecting version mismatches
 * and forcing a hard reload when necessary
 */

// Update this version when making critical fixes that require cache clearing
const CURRENT_VERSION = '2.1.2'; // CRITICAL FIX: Force cache clear for GraphQL validation errors
const VERSION_KEY = 'app_version';

/**
 * Check if app version has changed and force reload if needed
 */
export function checkVersionAndReload(): void {
  const storedVersion = localStorage.getItem(VERSION_KEY);
  
  if (!storedVersion) {
    // First time running - store version
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
    // PERFORMANCE: App initialized
    return;
  }
  
  if (storedVersion !== CURRENT_VERSION) {
    // PERFORMANCE: Version mismatch detected - performing cache-busting reload
    
    // Update version first
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
    
    // Clear service workers if any
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(reg => reg.unregister());
      });
    }
    
    // Force hard reload (bypass cache)
    setTimeout(() => {
      window.location.reload();
    }, 500);
  } else {
    console.log(`[VersionCheck] Version ${CURRENT_VERSION} - up to date`);
  }
}

/**
 * Get current app version
 */
export function getAppVersion(): string {
  return CURRENT_VERSION;
}

/**
 * Force clear all caches and reload
 */
export function forceClearCacheAndReload(): void {
  console.log('[VersionCheck] Force clearing all caches...');
  
  // Clear localStorage except auth data
  const authData = localStorage.getItem('supabase.auth.token');
  localStorage.clear();
  if (authData) {
    localStorage.setItem('supabase.auth.token', authData);
  }
  localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
  
  // SECURITY: Clear only app-specific cache, preserve Supabase auth state
  // DO NOT use sessionStorage.clear() as it breaks OAuth PKCE flow
  sessionStorage.removeItem('session');
  sessionStorage.removeItem('auth_initialized');
  
  // Clear service workers
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(reg => reg.unregister());
    });
  }
  
  // Clear cache storage
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }
  
  console.log('[VersionCheck] All caches cleared - reloading...');
  
  // Force hard reload
  setTimeout(() => {
    window.location.reload();
  }, 500);
}

// Add to window for debugging
if (typeof window !== 'undefined') {
  (window as any).appVersion = getAppVersion;
  (window as any).forceClearCache = forceClearCacheAndReload;
}