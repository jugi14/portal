import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase/client';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { apiClient } from '../services/apiClient';
import { tokenRefreshService } from '../services/tokenRefreshService';
import { secureTokenStorage } from '../services/secureTokenStorage';
import type { AuthContextType, AuthProviderProps, UserLoginResponse } from '../types/auth';
import { AUTH_STORAGE_KEYS, AUTH_TIMEOUTS } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Prevent duplicate welcome toasts
  const welcomeToastShownRef = useRef(false);
  
  // Track if auth was already initialized to prevent re-checks on tab switch
  const authInitializedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    let initializationTimeout: NodeJS.Timeout;

    const initializeAuth = async () => {
      try {
        // Skip re-initialization if already done (for tab switches)
        if (authInitializedRef.current && sessionStorage.getItem('auth_initialized') === 'true') {
          console.log('[Auth] Using cached auth state - no re-check needed');
          
          // Check if we have stored session in sessionStorage
          const storedSession = sessionStorage.getItem(AUTH_STORAGE_KEYS.SESSION);
          if (storedSession) {
            try {
              const sessionMetadata = JSON.parse(storedSession);
              
              // SECURITY: Reconstruct full session with access_token from secureTokenStorage
              // Session metadata in sessionStorage does NOT contain access_token
              // We get it from separate secure storage
              const tokenData = secureTokenStorage.getTokenData();
              
              if (tokenData && !tokenData.isExpired) {
                const fullSession = {
                  ...sessionMetadata,
                  access_token: tokenData.token,
                  // Ensure expires_at is present
                  expires_at: sessionMetadata.expires_at
                };
                
                setSession(fullSession);
                setUser(sessionMetadata?.user ?? null);
                setLoading(false);
                setIsInitialLoad(false);
                return;
              }
            } catch (e) {
              console.warn('[Auth] Failed to parse stored session, re-checking');
            }
          }
        }
        
        // Add timeout to auth initialization
        initializationTimeout = setTimeout(() => {
          if (mounted) {
            console.warn('[Auth] Initialization timeout');
            setLoading(false);
            setIsInitialLoad(false);
          }
        }, AUTH_TIMEOUTS.INITIALIZATION);

        // First, get the current session
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('[Auth] Error getting initial session:', error);
        }

        if (mounted) {
          clearTimeout(initializationTimeout);
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
          
          // Mark auth as initialized and cache session
          authInitializedRef.current = true;
          sessionStorage.setItem(AUTH_STORAGE_KEYS.INITIALIZED, 'true');
          if (session) {
            // SECURITY: Store session metadata only, NOT the access_token
            // access_token is stored separately in secureTokenStorage
            const sessionMetadata = {
              user: session.user,
              expires_at: session.expires_at
              // access_token deliberately omitted for security
            };
            sessionStorage.setItem(AUTH_STORAGE_KEYS.SESSION, JSON.stringify(sessionMetadata));
            
            // Set token with expiration for secure storage + auto-refresh
            const expiresAt = session.expires_at ? session.expires_at * 1000 : Date.now() + (60 * 60 * 1000);
            apiClient.setAccessToken(session.access_token, expiresAt);
            
            // Schedule automatic token refresh
            tokenRefreshService.scheduleRefresh(expiresAt);
          } else {
            apiClient.setAccessToken(null);
          }

          // Ensure initial load flag is cleared after a short delay
          setTimeout(() => {
            setIsInitialLoad(false);
          }, 1000);
        }

      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          clearTimeout(initializationTimeout);
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Set global auth state for services
        (window as any).__auth_state__ = { session, user: session?.user };
        
        // Sync access token to API client with expiration
        if (session?.access_token) {
          const expiresAt = session.expires_at ? session.expires_at * 1000 : Date.now() + (60 * 60 * 1000);
          apiClient.setAccessToken(session.access_token, expiresAt);
          
          // Schedule automatic token refresh
          tokenRefreshService.scheduleRefresh(expiresAt);
        } else {
          apiClient.setAccessToken(null);
          
          // Stop token refresh on logout
          tokenRefreshService.stop();
        }
        
        // Cache session for tab switches
        if (session) {
          // SECURITY: Store session metadata only, NOT the access_token
          const sessionMetadata = {
            user: session.user,
            expires_at: session.expires_at
            // access_token deliberately omitted for security
          };
          sessionStorage.setItem(AUTH_STORAGE_KEYS.SESSION, JSON.stringify(sessionMetadata));
          sessionStorage.setItem(AUTH_STORAGE_KEYS.INITIALIZED, 'true');
        } else {
          sessionStorage.removeItem(AUTH_STORAGE_KEYS.SESSION);
          sessionStorage.removeItem(AUTH_STORAGE_KEYS.INITIALIZED);
        }

        // Handle auth events with proper deduplication
        if (event === 'INITIAL_SESSION') {
          // SECURITY: Do not log session information
          setIsInitialLoad(false); // Mark initial load as complete
          // Never show welcome toast for initial session restoration
        } else if (event === 'SIGNED_IN' && session) {
          // SECURITY: Do not log user email
          // Only show welcome toast for actual sign-ins, not session restoration
          // Use ref to prevent duplicate toasts across re-renders
          if (!isInitialLoad && !welcomeToastShownRef.current) {
            toast.success(`Welcome back, ${session.user.email}!`);
            welcomeToastShownRef.current = true;
            
            // Reset flag to allow new logins
            setTimeout(() => {
              welcomeToastShownRef.current = false;
            }, AUTH_TIMEOUTS.WELCOME_TOAST_RESET);
          }
        } else if (event === 'SIGNED_OUT') {
          toast.info('You have been signed out');
          welcomeToastShownRef.current = false;
          sessionStorage.removeItem(AUTH_STORAGE_KEYS.SESSION);
          sessionStorage.removeItem(AUTH_STORAGE_KEYS.INITIALIZED);
          authInitializedRef.current = false;
        }
      }
    });

    return () => {
      mounted = false;
      if (initializationTimeout) {
        clearTimeout(initializationTimeout);
      }
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Setup user permissions via Backend V2 Clean Architecture
   * Backend expects access_token in Authorization header only
   */
  const setupUserPermissions = async (user: User): Promise<void> => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('[Auth] No session available for permission setup');
        return;
      }
      
      // CRITICAL: Ensure token is set in apiClient
      if (session.access_token) {
        const expiresAt = session.expires_at ? session.expires_at * 1000 : undefined;
        apiClient.setAccessToken(session.access_token, expiresAt);
      }

      // CRITICAL: Use apiClient instead of raw fetch
      const result = await apiClient.post<UserLoginResponse['data']>('/auth/user-login', {});

      if (!result.success || !result.data) {
        console.error('[Auth] Permission setup failed:', result.error);
        return;
      }
      
    } catch (error) {
      console.error('[Auth] Error setting up permissions:', error);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const currentOrigin = window.location.origin;
      const redirectUrl = `${currentOrigin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('Error signing in with Google:', error.message);
        throw error;
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const { data: { session }, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[Auth] Error signing in with email:', error.message);
        throw error;
      }
    } catch (error) {
      console.error('Email sign-in error:', error);
      throw error;
    }
  };

  const signInWithMagicLink = async (email: string) => {
    try {
      const currentOrigin = window.location.origin;
      const redirectUrl = `${currentOrigin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
          shouldCreateUser: true,
        }
      });

      if (error) {
        console.error('[Auth] Error sending magic link:', error.message);
        throw error;
      }
    } catch (error) {
      console.error('Magic link error:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      // CRITICAL: Use apiClient instead of raw fetch
      // Note: Signup uses publicAnonKey, which apiClient will use if no token is set
      const result = await apiClient.post('/auth/signup', { email, password, name });

      if (!result.success) {
        throw new Error(result.error || 'Sign up failed');
      }

      await signInWithEmail(email, password);

    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  };



  const signOut = async (): Promise<void> => {
    try {
      setUser(null);
      setSession(null);
      welcomeToastShownRef.current = false;
      
      sessionStorage.removeItem(AUTH_STORAGE_KEYS.SESSION);
      sessionStorage.removeItem(AUTH_STORAGE_KEYS.INITIALIZED);
      authInitializedRef.current = false;
      
      import('../services/apiClient').then(({ apiClient }) => {
        apiClient.setAccessToken(null);
      });
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('[Auth] SignOut error:', error.message);
      }
      setTimeout(() => {
        window.location.href = '/login';
      }, 100);
      
    } catch (error) {
      console.error('[AuthContext] Sign-out error:', error);
      setTimeout(() => {
        window.location.href = '/login';
      }, 100);
    }
  };

  const value = {
    user,
    session,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signInWithMagicLink,
    signUp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};