/**
 * Auth Type Definitions - Type-Safe Login Flow
 * 
 * Centralized type definitions for authentication system
 * Per Guidelines.md: DRY Principle, Type Safety, Maintainability
 */

import { User, Session } from '@supabase/supabase-js';

// Auth Context Interface
export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// Auth Provider Props
export interface AuthProviderProps {
  children: React.ReactNode;
}

// Auth Method Types
export type AuthMethod = 'google' | 'magic' | 'email' | null;

// Login Form State
export interface LoginFormState {
  email: string;
  password: string;
  magicLinkSent: boolean;
  loading: boolean;
  error: string | null;
  success: string | null;
  authMethod: AuthMethod;
}

// OAuth Callback Debug Info
export interface OAuthDebugInfo {
  url: string;
  hash: string;
  search: string;
  timestamp: string;
  projectId?: string;
}

// OAuth Callback Status
export type OAuthCallbackStatus = 
  | 'processing'
  | 'exchanging'
  | 'setup'
  | 'success'
  | 'error';

// OAuth Callback State
export interface OAuthCallbackState {
  status: OAuthCallbackStatus;
  message: string;
  debugInfo: OAuthDebugInfo | null;
  error: string | null;
  showSetupInstructions: boolean;
}

// Backend User Login Response
export interface UserLoginResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    user: {
      id: string;
      email: string;
      name?: string;
    };
    permission: {
      role: string;
      status: string;
      customer_id?: string;
    };
  };
}

// OAuth Error Types
export type OAuthErrorType = 
  | 'config_error'
  | 'expired_code'
  | 'exchange_error'
  | 'timeout_error'
  | 'unknown_error';

export interface OAuthError {
  type: OAuthErrorType;
  message: string;
  shouldShowSetup: boolean;
  shouldAutoRedirect: boolean;
}

// Helper type guards
export function isConfigError(errorMessage: string): boolean {
  const msg = errorMessage.toLowerCase();
  return (
    msg.includes('provider') ||
    msg.includes('not enabled') ||
    msg.includes('invalid_request') ||
    msg.includes('invalid_client') ||
    msg.includes('unauthorized') ||
    msg.includes('redirect')
  );
}

export function isExpiredCodeError(errorMessage: string): boolean {
  const msg = errorMessage.toLowerCase();
  return (
    msg.includes('expired') ||
    msg.includes('invalid code') ||
    msg.includes('already used')
  );
}

// Constants
export const AUTH_ROUTES = {
  LOGIN: '/login',
  CALLBACK: '/auth/callback',
  DASHBOARD: '/',
} as const;

export const AUTH_STORAGE_KEYS = {
  SESSION: 'current_session',
  INITIALIZED: 'auth_initialized',
  ACCESS_TOKEN: 'access_token',
} as const;

export const AUTH_TIMEOUTS = {
  INITIALIZATION: 10000, // 10 seconds
  OAUTH_EXCHANGE: 30000, // 30 seconds
  REDIRECT_PRIMARY: 500, // 500ms
  REDIRECT_FALLBACK: 2000, // 2 seconds
  WELCOME_TOAST_RESET: 10000, // 10 seconds
} as const;
