/// <reference types="vite/client" />

/**
 * Vite Environment Variables Type Definitions
 *
 * This file extends Vite's ImportMetaEnv to provide type safety for custom VITE_* variables.
 * Vite automatically provides: DEV, PROD, MODE, BASE_URL, SSR
 */
interface ImportMetaEnv {
  /**
   * Base URL for API requests
   * Example: http://localhost:3001/api
   */
  readonly VITE_API_BASE_URL?: string;
}
