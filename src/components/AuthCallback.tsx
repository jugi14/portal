import React, { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase/client';
import { projectId } from '../utils/supabase/info';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { AlertTriangle, ExternalLink, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { OAuthDebugInfo, OAuthCallbackStatus } from '../types/auth';
import { isConfigError, isExpiredCodeError, AUTH_ROUTES, AUTH_TIMEOUTS } from '../types/auth';

export function AuthCallback() {
  const [status, setStatus] = useState<string>('Processing authentication...');
  const [debugInfo, setDebugInfo] = useState<OAuthDebugInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSetupInstructions, setShowSetupInstructions] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    const handleAuthCallback = async () => {
      try {
        const currentUrl = window.location.href;
        const hash = window.location.hash;
        const search = window.location.search;
        
        console.log('[AuthCallback] OAuth callback started');

        if (!mounted) return;

        setDebugInfo({
          url: currentUrl,
          hash: hash || 'Empty',
          search: search || 'Empty',
          timestamp: new Date().toISOString(),
          projectId
        });

        // Parse URL parameters
        const urlParams = new URLSearchParams(search);
        const code = urlParams.get('code');
        const errorParam = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');
        
        // Check for OAuth errors from provider
        if (errorParam) {
          console.error('[AuthCallback] OAuth error from provider:', {
            error: errorParam,
            description: errorDescription
          });
          
          if (!mounted) return;
          setError(`OAuth Error: ${errorDescription || errorParam}`);
          setShowSetupInstructions(true);
          return;
        }
        
        if (code) {
          console.log('[AuthCallback] PKCE flow detected - processing code');
          
          if (!mounted) return;
          setStatus('Exchanging OAuth code for session...');
          
          try {
            console.log('[AuthCallback] Calling exchangeCodeForSession');
            const startTime = Date.now();
            
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            
            const duration = Date.now() - startTime;
            console.log(`[AuthCallback] Exchange completed in ${duration}ms`);
            
            if (!mounted) return;
            
            if (exchangeError) {
              console.error('[AuthCallback] Exchange error:', exchangeError);
              
              const errorMsg = exchangeError.message;
              const isConfig = isConfigError(errorMsg);
              const isExpired = isExpiredCodeError(errorMsg);
              
              if (isExpired) {
                setError('OAuth code expired or already used. Please try signing in again.');
                setTimeout(() => {
                  if (mounted) {
                    window.location.href = AUTH_ROUTES.LOGIN;
                  }
                }, AUTH_TIMEOUTS.REDIRECT_FALLBACK);
              } else {
                setError(`OAuth exchange failed: ${errorMsg}${isConfig ? ' (Likely configuration issue)' : ''}`);
              }
              
              setShowSetupInstructions(isConfig);
              return;
            }
            
            if (!data?.session) {
              console.error('[AuthCallback] No session returned from code exchange');
              setError('No session created from OAuth code. Please check Supabase configuration.');
              setShowSetupInstructions(true);
              return;
            }
            
            const { session } = data;
            console.log('[AuthCallback] Session created successfully');
            
            setStatus('Setting up your account...');
            
            // Call backend to setup user permissions
            try {
              console.log('[AuthCallback] Calling /auth/user-login');
              
              // CRITICAL: Ensure token is set in apiClient
              if (session.access_token) {
                const expiresAt = session.expires_at ? session.expires_at * 1000 : undefined;
                apiClient.setAccessToken(session.access_token, expiresAt);
              }

              // CRITICAL: Use apiClient instead of raw fetch
              const result = await apiClient.post('/auth/user-login', {});
              
              if (!mounted) return;
              
              if (result.success) {
                console.log('[AuthCallback] User setup successful');
                setStatus('Success! Redirecting to dashboard...');
              } else {
                console.warn('[AuthCallback] Backend setup failed:', result.error);
                setStatus('Redirecting to dashboard...');
              }
            } catch (backendError) {
              console.warn('[AuthCallback] Backend setup error:', backendError);
              setStatus('Redirecting to dashboard...');
            }
            
            // SECURITY: Clear only app-specific cache, preserve Supabase auth state
            // DO NOT use sessionStorage.clear() as it deletes OAuth PKCE verifier
            console.log('[AuthCallback] Clearing app-specific cache');
            sessionStorage.removeItem('session');
            sessionStorage.removeItem('auth_initialized');
            localStorage.removeItem('app_last_init');
            
            // Redirect to home
            console.log('[AuthCallback] Scheduling redirect');
            
            setTimeout(() => {
              if (mounted) {
                console.log('[AuthCallback] Executing redirect');
                window.location.href = AUTH_ROUTES.DASHBOARD;
              }
            }, AUTH_TIMEOUTS.REDIRECT_PRIMARY);
            
            // Fallback redirect
            setTimeout(() => {
              if (mounted && window.location.pathname === AUTH_ROUTES.CALLBACK) {
                console.warn('[AuthCallback] Primary redirect failed, forcing redirect');
                window.location.replace(AUTH_ROUTES.DASHBOARD);
              }
            }, AUTH_TIMEOUTS.REDIRECT_FALLBACK);
            
          } catch (err) {
            if (!mounted) return;
            
            console.error('[AuthCallback] Exception during code exchange:', err);
            setError(err instanceof Error ? err.message : 'Unknown error during authentication');
            setShowSetupInstructions(true);
          }
          
        } else {
          // No code parameter - hash-based flow or direct access
          console.log('[AuthCallback] No code parameter - checking for hash-based flow');
          
          if (!mounted) return;
          setStatus('Checking for session...');
          
          // Wait for Supabase to auto-process hash
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (!mounted) return;
          
          if (sessionError || !session) {
            console.error('[AuthCallback] No session found');
            setError('No authentication session found. Please try logging in again.');
            setTimeout(() => {
              if (mounted) window.location.href = `${AUTH_ROUTES.LOGIN}?error=no_session`;
            }, 2000);
            return;
          }
          
          console.log('[AuthCallback] Hash-based session found');
          setStatus('Redirecting to dashboard...');
          setTimeout(() => {
            if (mounted) window.location.href = AUTH_ROUTES.DASHBOARD;
          }, AUTH_TIMEOUTS.REDIRECT_PRIMARY);
        }
        
      } catch (error) {
        if (!mounted) return;
        
        console.error('[AuthCallback] Critical error:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
        setShowSetupInstructions(true);
      }
    };

    handleAuthCallback();
    
    return () => {
      mounted = false;
    };
  }, []);

  // Error/Setup Instructions UI
  if (error || showSetupInstructions) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
        <Card className="max-w-3xl w-full shadow-2xl">
          <CardHeader className="border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-xl">
                  Authentication Error
                </CardTitle>
                <CardDescription>
                  There was a problem with the authentication process
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription className="text-sm">
                  <strong>Error:</strong> {error}
                </AlertDescription>
              </Alert>
            )}

            {showSetupInstructions && (
              <div className="bg-muted/50 border rounded-lg p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base mb-2">
                      Authentication Service Unavailable
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      We are experiencing technical difficulties with the sign-in service. Please try again later or contact support if the problem persists.
                    </p>
                  </div>
                </div>
              </div>
            )}



            {/* Troubleshooting Tips */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3 border">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Quick Solutions
              </h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold mt-0.5">•</span>
                  <span><strong>Connection issues:</strong> Check your internet connection and try signing in again.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold mt-0.5">•</span>
                  <span><strong>Link expired:</strong> Authentication links expire after 10 minutes. Click "Back to Login" to get a fresh link.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold mt-0.5">•</span>
                  <span><strong>Browser problems:</strong> Try clearing your cookies and cache, or use a private/incognito window.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold mt-0.5">•</span>
                  <span><strong>Still not working?</strong> Contact our support team for assistance.</span>
                </li>
              </ul>
            </div>

            <div className="flex gap-3 pt-2">
              <Button 
                onClick={() => window.location.href = AUTH_ROUTES.LOGIN}
                variant="outline"
                className="flex-1"
                size="lg"
              >
                Back to Login
              </Button>
              <Button 
                onClick={() => window.location.reload()}
                className="flex-1"
                size="lg"
              >
                Try Again
              </Button>
            </div>
            
            <div className="text-center pt-2">
              <p className="text-xs text-muted-foreground">
                Need help? Contact support at <a href="mailto:support@teifi.digital" className="text-primary hover:underline">support@teifi.digital</a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading UI
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
      <div className="text-center max-w-md mx-auto p-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-6" />
        <h2 className="mb-3">Authentication in Progress</h2>
        <p className="text-muted-foreground mb-4">{status}</p>
        <div className="text-xs text-muted-foreground/60">
          Please wait while we complete your sign-in...
        </div>
      </div>
    </div>
  );
}
