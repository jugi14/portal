import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Loader2, Chrome, Mail, Lock, Shield, Sparkles, ArrowRight, Check, Sun, Moon } from 'lucide-react';
import { validateEmail, validatePassword } from '../utils/inputValidation';

import teifiLogo from '../imports/svg-teifi-logo';

export function LoginPage() {
  const { signInWithGoogle, signInWithEmail, signInWithMagicLink } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<'google' | 'magic' | 'email' | null>(null);
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  const isLightMode = !isDarkMode;

  // Check URL parameters for OAuth errors
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const hasError = urlParams.get('error');
      
      if (hasError) {
        setError(`Authentication error: ${hasError}`);
      }
    }
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // SECURITY: Validate email and password before submission
    const emailValidation = validateEmail(email);
    const passwordValidation = validatePassword(password);
    
    if (!emailValidation.isValid) {
      setError(emailValidation.error || 'Invalid email');
      setEmailError(emailValidation.error || '');
      return;
    }
    
    if (!passwordValidation.isValid) {
      setError(passwordValidation.error || 'Invalid password');
      setPasswordError(passwordValidation.error || '');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      setEmailError('');
      setPasswordError('');
      await signInWithEmail(email, password);
    } catch (err: any) {
      console.error('Email sign-in error:', err);
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLinkSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // SECURITY: Validate email before sending magic link
    const emailValidation = validateEmail(email);
    
    if (!emailValidation.isValid) {
      setError(emailValidation.error || 'Invalid email address');
      setEmailError(emailValidation.error || '');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      setEmailError('');
      await signInWithMagicLink(email);
      setMagicLinkSent(true);
      setSuccess(`Magic link sent to ${email}!`);
    } catch (err: any) {
      console.error('Magic link error:', err);
      setError(err.message || 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  };

  // Unified Logo Component - CRITICAL: All paths must have display: block
  const renderLogo = (uniqueId: string) => {
    const logoFill = isLightMode ? '#0c0c0c' : '#ffffff';
    
    return (
      <svg 
        className="block w-full h-auto"
        viewBox="0 0 419 92" 
        fill="none"
        preserveAspectRatio="xMidYMid meet"
        style={{ maxWidth: '100%', height: 'auto' }}
      >
        <g clipPath={`url(#clip0_teifi_${uniqueId})`} style={{ display: 'block' }}>
          {/* Main "teifi" text */}
          <path d={teifiLogo.mainT1} fill={logoFill} style={{ display: 'block' }} />
          <path d={teifiLogo.mainE} fill={logoFill} style={{ display: 'block' }} />
          <path d={teifiLogo.mainI1} fill={logoFill} style={{ display: 'block' }} />
          <path d={teifiLogo.mainF} fill={logoFill} style={{ display: 'block' }} />
          <path d={teifiLogo.mainI2} fill={logoFill} style={{ display: 'block' }} />
          <path d={teifiLogo.mainI1Dot} fill={logoFill} style={{ display: 'block' }} />
          <path d={teifiLogo.mainI2Dot} fill={logoFill} style={{ display: 'block' }} />
          
          {/* "DIGITAL" text - CRITICAL: ALWAYS VISIBLE */}
          <path d={teifiLogo.digitalD} fill={logoFill} style={{ display: 'block' }} />
          <path d={teifiLogo.digitalI} fill={logoFill} style={{ display: 'block' }} />
          <path d={teifiLogo.digitalG} fill={logoFill} style={{ display: 'block' }} />
          <path d={teifiLogo.digitalI2} fill={logoFill} style={{ display: 'block' }} />
          <path d={teifiLogo.digitalT} fill={logoFill} style={{ display: 'block' }} />
          <path d={teifiLogo.digitalA} fill={logoFill} style={{ display: 'block' }} />
          <path d={teifiLogo.digitalL} fill={logoFill} style={{ display: 'block' }} />
          
          {/* Gradient dot */}
          <path d={teifiLogo.gradientDot} fill={`url(#paint0_linear_teifi_${uniqueId})`} style={{ display: 'block' }} />
        </g>
        <defs>
          <linearGradient id={`paint0_linear_teifi_${uniqueId}`} x1="276.741" y1="79" x2="496.628" y2="79" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00FFF3"/>
            <stop offset="0.02" stopColor="#00FCF3"/>
            <stop offset="0.48" stopColor="#0BC3FA"/>
            <stop offset="0.82" stopColor="#129FFE"/>
            <stop offset="1" stopColor="#1492FF"/>
          </linearGradient>
          <clipPath id={`clip0_teifi_${uniqueId}`}>
            <rect width="419" height="92" fill="white"/>
          </clipPath>
        </defs>
      </svg>
    );
  };

  return (
    <div className={`min-h-screen w-full flex flex-col lg:flex-row overflow-hidden bg-background login-page-light ${isLightMode ? 'light-professional' : ''}`}>
      {/* Theme Toggle Button - Fixed Position */}
      <div className="fixed top-6 right-6 z-50">
        <Button
          onClick={toggleDarkMode}
          variant="outline"
          size="icon"
          className="w-10 h-10 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Left Side - Branding & Features */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative bg-gradient-to-br from-[#f8fafc] via-[#ffffff] to-[#f1f5f9] dark:from-[#000000] dark:via-[#0a0a0a] dark:to-[#000000] overflow-hidden">
        {/* Background Orbs - Dark Mode Only */}
        {!isLightMode && (
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-[#1492FF]/20 to-[#00FFF3]/20 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-tl from-[#00FFF3]/20 to-[#1492FF]/20 rounded-full blur-3xl" />
          </div>
        )}
        
        {/* Subtle Grid Pattern */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `
            linear-gradient(rgba(20, 146, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(20, 146, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px'
        }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 lg:p-16 xl:p-20 w-full">
          {/* Logo & Title */}
          <div className="space-y-6">
            <div className="flex items-center">
              <div className="w-[320px]">
                {renderLogo('desktop')}
              </div>
            </div>
            
            <div className="space-y-2 max-w-md">
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                Teifi Portal
              </h1>
              <p className="text-sm lg:text-base leading-relaxed text-muted-foreground">
                Welcome! Share feedback or report any issues directly to Teifi's team.
              </p>
            </div>
          </div>

          {/* Features List */}
          <div className="space-y-4 max-w-xl">
            <div className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${isLightMode ? 'hover:bg-muted/50' : 'hover:bg-white/5'}`}>
              <div className={`flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-[#1492FF] to-[#00FFF3] flex items-center justify-center ${isLightMode ? 'shadow-md' : ''}`}>
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1 text-foreground">Sign in securely</h3>
                <p className="text-sm text-muted-foreground">Protected authentication with Google or email</p>
              </div>
            </div>

            <div className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${isLightMode ? 'hover:bg-muted/50' : 'hover:bg-white/5'}`}>
              <div className={`flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-[#1492FF] to-[#00FFF3] flex items-center justify-center ${isLightMode ? 'shadow-md' : ''}`}>
                <Check className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1 text-foreground">Describe your feedback or issue</h3>
                <p className="text-sm text-muted-foreground">Easy-to-use forms with file attachments</p>
              </div>
            </div>

            <div className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${isLightMode ? 'hover:bg-muted/50' : 'hover:bg-white/5'}`}>
              <div className={`flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-[#1492FF] to-[#00FFF3] flex items-center justify-center ${isLightMode ? 'shadow-md' : ''}`}>
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1 text-foreground">Track status in real time</h3>
                <p className="text-sm text-muted-foreground">Live updates on your reports and feedback</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground/80">
              Enterprise priority. Expert support.
            </p>
            <p className="text-xs text-muted-foreground">
              © 2025 Teifi Digital
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-background relative z-10">
        <div className={`w-full max-w-md space-y-6 sm:space-y-8 ${isLightMode ? 'p-8 rounded-2xl border border-border bg-white shadow-lg' : 'p-8'}`}>
          {/* Mobile Logo - Full Wordmark */}
          <div className="lg:hidden flex flex-col items-center mb-6">
            <div className="w-full max-w-[280px] min-w-[240px]">
              {renderLogo('mobile')}
            </div>
          </div>

          {/* Form Header */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Welcome back</h2>
            <p className="text-muted-foreground">
              Sign in to access your portal
            </p>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-600 dark:text-green-400">
              {success}
            </div>
          )}

          {/* Auth Options */}
          <div className="space-y-3 sm:space-y-4">
            {/* Google Sign In - Primary */}
            <Button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full h-12 bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-200 hover:border-[#1492FF] font-medium transition-all duration-200 hover:shadow-md dark:bg-white dark:hover:bg-gray-50 dark:text-gray-900"
            >
              {loading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Chrome className="mr-2 h-5 w-5" />
              )}
              <span>Continue with Google</span>
            </Button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className={`${isLightMode ? 'bg-white' : 'bg-background'} px-4 text-muted-foreground font-medium`}>
                  Or continue with
                </span>
              </div>
            </div>

            {/* Magic Link & Email/Password Options */}
            {!authMethod && (
              <div className="space-y-3">
                <Button
                  onClick={() => setAuthMethod('magic')}
                  variant="outline"
                  className="w-full h-12 hover:bg-muted hover:border-[#1492FF] transition-all duration-200"
                >
                  <Mail className="mr-2 h-5 w-5" />
                  <span>Magic Link</span>
                </Button>
                
                <Button
                  onClick={() => setAuthMethod('email')}
                  variant="outline"
                  className="w-full h-12 hover:bg-muted hover:border-[#1492FF] transition-all duration-200"
                >
                  <Lock className="mr-2 h-5 w-5" />
                  <span>Email & Password</span>
                </Button>
              </div>
            )}

            {/* Magic Link Form */}
            {authMethod === 'magic' && !magicLinkSent && (
              <form onSubmit={handleMagicLinkSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="magic-email" className="text-sm font-medium">Email address</Label>
                  <Input
                    id="magic-email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEmail(value);
                      setEmailError('');
                      if (value) {
                        const validation = validateEmail(value);
                        if (!validation.isValid) {
                          setEmailError(validation.error || '');
                        }
                      }
                    }}
                    className={`h-11 border-2 focus:border-[#1492FF] ${emailError ? 'border-destructive' : ''}`}
                    required
                  />
                  {emailError && <p className="text-xs text-destructive mt-1">{emailError}</p>}
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAuthMethod(null)}
                    className="flex-1 h-11"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1 h-11 bg-gradient-to-r from-[#1492FF] to-[#00FFF3] hover:opacity-90 text-white font-medium"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="mr-2 h-4 w-4" />
                    )}
                    Send Link
                  </Button>
                </div>
              </form>
            )}

            {/* Email/Password Form */}
            {authMethod === 'email' && (
              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEmail(value);
                      setEmailError('');
                      if (value) {
                        const validation = validateEmail(value);
                        if (!validation.isValid) {
                          setEmailError(validation.error || '');
                        }
                      }
                    }}
                    className={`h-11 border-2 focus:border-[#1492FF] ${emailError ? 'border-destructive' : ''}`}
                    required
                  />
                  {emailError && <p className="text-xs text-destructive mt-1">{emailError}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPassword(value);
                      setPasswordError('');
                    }}
                    className={`h-11 border-2 focus:border-[#1492FF] ${passwordError ? 'border-destructive' : ''}`}
                    required
                  />
                  {passwordError && <p className="text-xs text-destructive mt-1">{passwordError}</p>}
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAuthMethod(null)}
                    className="flex-1 h-11"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1 h-11 bg-gradient-to-r from-[#1492FF] to-[#00FFF3] hover:opacity-90 text-white font-medium"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="mr-2 h-4 w-4" />
                    )}
                    Sign In
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Terms */}
          <p className="text-center text-xs text-muted-foreground leading-relaxed">
            By continuing, you agree to our{' '}
            <a href="#" className="underline hover:text-primary transition-colors font-medium">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="underline hover:text-primary transition-colors font-medium">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}