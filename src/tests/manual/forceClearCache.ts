/**
 * Manual Test: Force Clear Cache
 * 
 * Force clear all application caches for testing
 */

export async function forceClearCache() {
  console.log('[ForceClearCache] Clearing all caches...');
  
  // Clear localStorage
  const localStorageKeys = Object.keys(localStorage);
  localStorageKeys.forEach(key => localStorage.removeItem(key));
  console.log(`[ForceClearCache] Cleared ${localStorageKeys.length} localStorage entries`);
  
  // Clear sessionStorage
  const sessionStorageKeys = Object.keys(sessionStorage);
  sessionStorageKeys.forEach(key => sessionStorage.removeItem(key));
  console.log(`[ForceClearCache] Cleared ${sessionStorageKeys.length} sessionStorage entries`);
  
  // Clear browser caches if available
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log(`[ForceClearCache] Cleared ${cacheNames.length} browser caches`);
  }
  
  console.log('[ForceClearCache] All caches cleared successfully');
  
  return {
    success: true,
    cleared: {
      localStorage: localStorageKeys.length,
      sessionStorage: sessionStorageKeys.length,
      browserCaches: 'caches' in window ? (await caches.keys()).length : 0
    }
  };
}

if (typeof window !== 'undefined') {
  (window as any).forceClearCache = forceClearCache;
}
