import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useParams,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import {
  PermissionProvider,
  usePermissions,
} from "./contexts/PermissionContext";
import { SidebarProvider, useSidebar } from "./contexts/SidebarContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAppNavigation } from "./hooks/useAppNavigation";
import { useSessionPersistence, useSmartInitialization } from "./hooks/useSessionPersistence";
import { usePageVisibility } from "./hooks/usePageVisibility";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { DashboardPage } from "./pages/DashboardPage";
import { AdminPage } from "./pages/AdminPage";
import { TeamDetailPageWithTabs } from "./pages/TeamDetailPageWithTabs";
import { DocumentationPage } from "./pages/DocumentationPage";
import { LoginPage } from "./components/LoginPage";
import { AuthCallback } from "./components/AuthCallback";
import { PermissionGate } from "./components/PermissionGate";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LegacyRouteRedirect } from "./components/LegacyRouteRedirect";
import { PageLoading } from "./components/ui/loading";
import { Button } from "./components/ui/button";
import { Toaster } from "./components/ui/sonner";
import { AlertTriangle } from "lucide-react";
import { CacheClearBanner } from "./components/CacheClearBanner";

// Force rebuild: mutations.ts functions restored (v1.0.1)

// Import utilities
import { initializationService } from "./services/initializationService";
import { sessionManager } from "./services/sessionManager";
import { linearCache } from "./services/linearCacheService";

// Production utilities (always loaded)
import { checkVersionAndReload } from "./utils/versionCheck";
import "./utils/authTokenSync";
import "./utils/rateLimitHandler";

// Protected Route Component with Enhanced Error Handling
function ProtectedRoute(
{
  children,
  context,
}: {
  children: React.ReactNode;
  context?: string;
}) {
  const { user, loading } = useAuth();

  // Show enhanced loading while checking auth
  if (loading) {
    return <PageLoading text="Checking authentication..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Layout Component with Sidebar and Header
function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    activeTab,
    isNavigating,
    navigationError,
    handleTabChange,
    canNavigateTo,
  } = useAppNavigation();
  const { isCollapsed } = useSidebar();

  return (
    <ErrorBoundary context="Application Layout">
      <div className="min-h-screen bg-background">
        <ErrorBoundary context="Header Component">
          <Header />
        </ErrorBoundary>

        <ErrorBoundary context="Sidebar Navigation">
          <Sidebar
            activeTab={activeTab}
            onTabChange={handleTabChange}
            canNavigateTo={canNavigateTo}
            isNavigating={isNavigating}
          />
        </ErrorBoundary>

        <main 
          className={`
            fixed top-16 bottom-0 right-0
            flex flex-col bg-background
            transition-all duration-300 ease-in-out
            ${isCollapsed ? 'left-0 md:left-16' : 'left-0 md:left-80'}
          `}
        >
          <div className="flex-1 overflow-y-auto overflow-x-hidden w-full">
            <ErrorBoundary context="Page Content">
              {navigationError && (
                <div className="px-4 md:px-6 w-full max-w-[1920px] mx-auto pt-4">
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-4">
                    <p className="text-sm text-destructive">
                      Navigation Error: {navigationError}
                    </p>
                  </div>
                </div>
              )}
              <div className="w-full max-w-[1920px] mx-auto px-4 md:px-6 py-6 box-border">
                {children}
              </div>
            </ErrorBoundary>
          </div>
        </main>

        <Toaster />
      </div>
    </ErrorBoundary>
  );
}

// Wrapper component to force re-mount TeamDetailPageWithTabs when teamId changes
function TeamDetailPageWrapper() {
  const { teamId } = useParams<{ teamId: string }>();
  const location = useLocation();
  
  // REMOVED: Reload logic moved to Sidebar.tsx to avoid triple reload
  // Now just clear caches when component mounts
  useEffect(() => {
    if (teamId) {
      // PERFORMANCE: Clearing caches for team
      
      // Clear Linear cache service (memory + localStorage)
      linearCache.clearTeamCache(teamId);
      
      // Clear sessionStorage
      sessionStorage.removeItem(`team-issues-${teamId}`);
      sessionStorage.removeItem(`team-config-${teamId}`);
    }
  }, [teamId]);
  
  // Key prop forces React to unmount/remount component when teamId changes
  // This ensures clean state reset when navigating between teams
  return <TeamDetailPageWithTabs key={teamId} />;
}

// Wrapper component to force re-mount AdminPage when navigating from other pages
function AdminPageWrapper() {
  // AdminPage handles its own internal routing
  // No need to force re-mount on path changes
  return <AdminPage />;
}

function MainApp() {
  const { user, loading } = useAuth();
  const { userRole, loading: permissionsLoading } = usePermissions();
  
  // Track page visibility - preserve state when tab is hidden/visible
  const isPageVisible = usePageVisibility(
    () => {
      // Page became visible - state preserved, no auto-refresh
      // Manual refresh available via UI if needed
    },
    () => {
      // Page became hidden - preserving state
    }
  );

  if (loading) {
    return (
      <ErrorBoundary context="Application Authentication">
        <PageLoading text="Authenticating..." />
      </ErrorBoundary>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          !user ? <LoginPage /> : <Navigate to="/" replace />
        }
      />
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route
        path="/"
        element={
          <ProtectedRoute context="Dashboard">
            <AppLayout>
              <DashboardPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute context="Dashboard">
            <AppLayout>
              <DashboardPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/teams/:teamId"
        element={
          <ProtectedRoute context="Team Detail">
            <AppLayout>
              <TeamDetailPageWrapper />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/teams/:teamId/issues"
        element={
          <ProtectedRoute context="Legacy Route Redirect">
            <LegacyRouteRedirect />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/*"
        element={
          <ProtectedRoute context="Admin Panel">
            <AppLayout>
              <PermissionGate
                permission="manage_users"
                showError
              >
                <AdminPageWrapper />
              </PermissionGate>
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/documentation"
        element={
          <ProtectedRoute context="Documentation">
            <AppLayout>
              <DocumentationPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  // CRITICAL: Check version and force reload if changed (cache busting)
  useEffect(() => {
    checkVersionAndReload();
  }, []);
  
  useEffect(() => {
    document.title = 'Teifi Digital | Feedback & Issues';
  }, []);
  
  // Disable caching for admin pages
  useEffect(() => {
    if (window.location.pathname.startsWith('/admin')) {
      const metaTags = [
        { name: 'Cache-Control', content: 'no-cache, no-store, must-revalidate' },
        { name: 'Pragma', content: 'no-cache' },
        { name: 'Expires', content: '0' }
      ];
      
      metaTags.forEach(({ name, content }) => {
        let meta = document.querySelector(`meta[http-equiv="${name}"]`);
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('http-equiv', name);
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', content);
      });
      
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(reg => reg.unregister());
        });
      }
    }
  }, []);
  
  // CRITICAL: Skip initialization for auth callback route to prevent race conditions
  const isAuthCallback = window.location.pathname === '/auth/callback';
  
  // Session persistence - prevent unnecessary reloads on tab switch
  useSessionPersistence();
  const { shouldSkipInit, markInitialized } = useSmartInitialization();
  
  // Smart initialization with Session Manager
  const [appInitialized, setAppInitialized] = useState(() => {
    if (isAuthCallback) {
      return true;
    }
    
    // Check session manager first (prevents duplicate init)
    if (sessionManager.shouldPreserveSession()) {
      return true;
    }
    
    // Check localStorage cache (within 5 minutes)
    const lastInit = localStorage.getItem("app_last_init");
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const cachedInit = lastInit && parseInt(lastInit) > fiveMinutesAgo;
    
    return cachedInit || false;
  });
  const [initError, setInitError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState("Starting application...");

  useEffect(() => {
    if (isAuthCallback) {
      return;
    }
    
    // Early return if already initialized
    if (appInitialized) {
      return;
    }
    
    // Quick restore if session preserved
    if (shouldSkipInit || sessionManager.shouldPreserveSession()) {
      markInitialized();
      sessionManager.markInitialized('all');
      setAppInitialized(true);
      return;
    }
    
    // Debounced initialization to prevent race conditions
    let initCancelled = false;
    
    const initApp = async () => {
      if (initCancelled) return;
      
      try {
        setLoadingMessage('Connecting to services...');

        // Initialize services
        const initResult = await initializationService.initializeWithFallback();

        if (initCancelled) return;

        // PERFORMANCE: Initialization complete

        // Cache successful initialization
        localStorage.setItem("app_last_init", Date.now().toString());
        
        markInitialized();
        sessionManager.markInitialized('all');

        setAppInitialized(true);
      } catch (error) {
        if (initCancelled) return;
        
        console.error('[Init] Initialization error:', error);
        setLoadingMessage("Initialization failed");
        setInitError(error instanceof Error ? error.message : 'Initialization failed');
      }
    };

    const initTimeout = setTimeout(initApp, 50);
    
    return () => {
      initCancelled = true;
      clearTimeout(initTimeout);
    };
  }, []); // Run once on mount only

  if (initError) {
    return (
      <ErrorBoundary context="Application Initialization">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center space-y-4">
            <div className="text-destructive">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
              <h2 className="text-xl font-semibold">
                Initialization Failed
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                {initError}
              </p>
            </div>
            <Button onClick={() => window.location.reload()}>
              Reload Application
            </Button>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  if (!appInitialized) {
    return <PageLoading text={loadingMessage} />;
  }

  return (
    <ErrorBoundary>
      <CacheClearBanner />
      <ThemeProvider>
        <Router>
          <AuthProvider>
            <PermissionProvider>
              <SidebarProvider>
                <MainApp />
              </SidebarProvider>
            </PermissionProvider>
          </AuthProvider>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}