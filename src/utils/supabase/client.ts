import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

// Construct the Supabase URL from project ID
const supabaseUrl = `https://${projectId}.supabase.co`;
const supabaseAnonKey = publicAnonKey;

// Export the configured client instance
export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // FIX: Disable auto-detection to prevent race condition with AuthCallback
    // We manually handle OAuth callback in /components/AuthCallback.tsx
    detectSessionInUrl: false,
    flowType: 'pkce'
  },
});

// Export a function to create client (for compatibility with utility files)
export function createClient() {
  return supabase;
}

// Export to window for debugging
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
}