/**
 * Manual Linear Cache Cleanup Utility
 * 
 * Usage: Run in browser console to clear Linear cache
 * 
 * Instructions:
 * 1. Open browser DevTools console
 * 2. Run: clearLinearCache()
 * 3. Wait for confirmation
 * 4. Reload page
 */

declare global {
  interface Window {
    clearLinearCache: () => Promise<void>;
    forceResyncLinear: () => Promise<void>;
  }
}

/**
 * Clear all Linear-related cache from KV store
 */
window.clearLinearCache = async function() {
  console.log('[Linear Cache Clear] Starting manual cache clear...');
  
  try {
    // Get project ID from URL or config
    const projectId = (window as any).SUPABASE_PROJECT_ID || 
                     'qcifqncdwjyjlbxjkxdv'; // Default project ID
    
    // Get access token from session
    const sessionStr = sessionStorage.getItem('session');
    if (!sessionStr) {
      console.error('[Linear Cache Clear] No session found. Please login first.');
      return;
    }
    
    const session = JSON.parse(sessionStr);
    const accessToken = session.access_token;
    
    if (!accessToken) {
      console.error('[Linear Cache Clear] No access token found.');
      return;
    }
    
    console.log('[Linear Cache Clear] Calling clear-cache endpoint...');
    
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-7f0d90fb/linear/clear-cache`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('[Linear Cache Clear] SUCCESS!', result);
      console.log(`[Linear Cache Clear] Deleted ${result.deletedKeys} cache entries`);
      console.log('[Linear Cache Clear] Cleared prefixes:', result.clearedPrefixes);
      
      // Clear local cache too
      console.log('[Linear Cache Clear] Clearing localStorage cache...');
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('linear') || key.includes('team'))) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`[Linear Cache Clear] Removed: ${key}`);
      });
      
      console.log('[Linear Cache Clear] COMPLETE! Reload page to fetch fresh data.');
      
      // Auto reload after 2 seconds
      setTimeout(() => {
        console.log('[Linear Cache Clear] Auto-reloading page...');
        window.location.reload();
      }, 2000);
      
    } else {
      console.error('[Linear Cache Clear] Failed:', result);
      console.error('[Linear Cache Clear] Error:', result.error);
    }
    
  } catch (error) {
    console.error('[Linear Cache Clear] Exception:', error);
  }
};

/**
 * Force resync Linear teams from API
 */
window.forceResyncLinear = async function() {
  console.log('[Linear Resync] Starting force resync...');
  
  try {
    // First clear cache
    await window.clearLinearCache();
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get project ID
    const projectId = (window as any).SUPABASE_PROJECT_ID || 
                     'qcifqncdwjyjlbxjkxdv';
    
    // Get access token
    const sessionStr = sessionStorage.getItem('session');
    if (!sessionStr) {
      console.error('[Linear Resync] No session found.');
      return;
    }
    
    const session = JSON.parse(sessionStr);
    const accessToken = session.access_token;
    
    console.log('[Linear Resync] Calling sync-hierarchy endpoint...');
    
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-7f0d90fb/linear/sync-hierarchy`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('[Linear Resync] SUCCESS!', result);
      console.log('[Linear Resync] Synced teams:', result.data);
      console.log('[Linear Resync] COMPLETE! Reloading page...');
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } else {
      console.error('[Linear Resync] Failed:', result);
    }
    
  } catch (error) {
    console.error('[Linear Resync] Exception:', error);
  }
};

console.log(`
=================================================
LINEAR CACHE UTILITIES LOADED
=================================================

Available commands:

1. clearLinearCache()
   - Clears all Linear cache from KV store
   - Clears localStorage Linear cache
   - Auto-reloads page

2. forceResyncLinear()
   - Clears cache + force resync from Linear API
   - Fetches fresh data from Linear
   - Auto-reloads page

Usage:
  > clearLinearCache()
  > forceResyncLinear()

=================================================
`);

export {};
