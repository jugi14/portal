/// <reference types="vite/client" />

/**
 * Vite Environment Variables Type Definitions
 * 
 * This file provides TypeScript type definitions for Vite's import.meta.env
 * All environment variables prefixed with VITE_ are exposed to the client
 */

interface ImportMetaEnv {
  /**
   * Development mode flag (automatically set by Vite)
   * true in development, false in production
   */
  readonly DEV: boolean;
  
  /**
   * Production mode flag (automatically set by Vite)
   * true in production, false in development
   */
  readonly PROD: boolean;
  
  /**
   * Base URL for API requests
   * Example: http://localhost:54321/api
   */
  readonly VITE_API_BASE_URL?: string;
  
  /**
   * Backend port for local development
   * Example: 54321
   */
  readonly VITE_BACKEND_PORT?: string;
  
  /**
   * Supabase project URL
   * Example: https://xxxxx.supabase.co
   */
  readonly VITE_SUPABASE_URL?: string;
  
  /**
   * Supabase anonymous/public key
   */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  
  /**
   * Mode: 'development' | 'production' | 'test'
   */
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

