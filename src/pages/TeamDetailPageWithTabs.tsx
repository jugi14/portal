import React, { useState, useCallback, useRef } from "react";
import {
  useParams,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  ListChecks,
  Kanban,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner@2.0.3";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import {
  Alert,
  AlertDescription,
} from "../components/ui/alert";
import { PageLoading } from "../components/ui/loading";
import { TeamIssuesKanban } from "../components/TeamIssuesKanban";
import { ClientUATKanban } from "../components/ClientUATKanban";
import { useTeamAccess } from "../hooks/useTeamAccess";
import { ViewMode } from "../components/KanbanViewModeSelector";

export function TeamDetailPageWithTabs() {
  const { teamId: rawTeamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const teamId = React.useMemo(() => {
    if (!rawTeamId) return undefined;

    // Extract UUID from corrupted format (e.g., "uuid.extra-data")
    const cleaned = rawTeamId.split(".")[0];

    // Validate UUID format (8-4-4-4-12)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(cleaned)) {
      console.error(
        "[TeamDetailPage] Invalid teamId format:",
        rawTeamId,
      );
      return undefined;
    }

    if (cleaned !== rawTeamId) {
      console.warn(
        "[TeamDetailPage] Cleaned corrupted teamId:",
        {
          original: rawTeamId,
          cleaned,
        },
      );
    }

    return cleaned;
  }, [rawTeamId]);

  // Get active tab from URL or default to 'tasks'
  const urlTab = searchParams.get("tab") || "tasks";
  const [activeTab, setActiveTab] = useState(urlTab);

  // Track last known filter setting
  const lastFilterSettingRef = useRef<boolean | null>(null);
  
  // Sync activeTab with URL changes and handle Tasks refresh
  React.useEffect(() => {
    setActiveTab(urlTab);
    
    // Auto-refresh Tasks tab when switching to it IF filter setting changed
    if (urlTab === 'tasks' && tasksKanbanRef.current) {
      const currentFilterSetting = localStorage.getItem('teifi_uat_filter_default') === 'true';
      
      // If this is first check, just store the value
      if (lastFilterSettingRef.current === null) {
        lastFilterSettingRef.current = currentFilterSetting;
        return;
      }
      
      // If setting changed since last time on this tab, refresh
      if (lastFilterSettingRef.current !== currentFilterSetting) {
        lastFilterSettingRef.current = currentFilterSetting;
        tasksKanbanRef.current?.refresh();
      }
    }
  }, [urlTab]);

  // Track when teamId changes
  React.useEffect(() => {
    // REMOVED: Reload logic moved to Sidebar.tsx to avoid triple reload
    // Now just track current team for reference
    if (teamId) {
      sessionStorage.setItem('last_viewed_team', teamId);
    }
  }, [teamId]);

  // Team access verification
  const {
    hasAccess,
    loading: accessLoading,
    isChecking,
    teamName,
    customerId,
  } = useTeamAccess(teamId);

  // Shared state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuesCount, setIssuesCount] = useState<number>(0);
  const [tasksCount, setTasksCount] = useState<number>(0);

  // Refs for refreshing kanban boards
  const issuesKanbanRef = useRef<{
    refresh: () => Promise<void>;
  }>(null);
  const tasksKanbanRef = useRef<{
    refresh: () => Promise<void>;
  }>(null);

  // View Mode Settings (shared across both tabs)
  const [viewModeEnabled, setViewModeEnabled] = useState(() => {
    // Check admin toggle first for centralized settings
    const adminToggles = localStorage.getItem("admin_feature_toggles");
    if (adminToggles) {
      try {
        const toggles = JSON.parse(adminToggles);
        const enabled = toggles.kanbanViewModeSelector ?? true;
        return enabled;
      } catch (e) {
        console.error('[TeamDetailPage] Failed to parse admin toggles:', e);
      }
    }
    // Fallback to old key - default TRUE if not set
    const oldValue = localStorage.getItem("teifi_enable_view_mode");
    const enabled = oldValue === null ? true : oldValue === "true";
    return enabled;
  });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem("teifi_kanban_view_mode") ||
      "normal") as ViewMode;
  });
  const [customEnabled, setCustomEnabled] = useState(() => {
    return (
      localStorage.getItem("teifi_kanban_custom_width") ===
      "true"
    );
  });
  const [customWidth, setCustomWidth] = useState(() => {
    const saved = localStorage.getItem(
      "teifi_kanban_custom_width_value",
    );
    return saved ? parseInt(saved, 10) : 280;
  });

  // Listen for view mode toggle events from admin
  React.useEffect(() => {
    const handleViewModeToggle = (event: CustomEvent) => {
      setViewModeEnabled(event.detail.enabled);
      // Also update old localStorage for backward compatibility
      localStorage.setItem("teifi_enable_view_mode", String(event.detail.enabled));
    };

    window.addEventListener(
      "teifi_view_mode_toggle",
      handleViewModeToggle as EventListener,
    );
    return () => {
      window.removeEventListener(
        "teifi_view_mode_toggle",
        handleViewModeToggle as EventListener,
      );
    };
  }, []);

  // Handlers
  const handleGoBack = useCallback(() => {
    navigate("/teams");
  }, [navigate]);

  const handleTabChange = useCallback(
    (value: string) => {
      setActiveTab(value);
      setSearchParams({ tab: value });
      // Clear any errors when switching tabs
      setError(null);
    },
    [setSearchParams],
  );

  const handleIssuesUpdate = useCallback((count: number) => {
    setIssuesCount(count);
  }, []);

  const handleTasksUpdate = useCallback((count: number) => {
    setTasksCount(count);
  }, []);

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    setIsLoading(false);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing || isLoading) return;

    setIsRefreshing(true);
    setError(null);

    try {
      // Refresh the active tab's kanban board
      if (activeTab === "issues" && issuesKanbanRef.current) {
        await issuesKanbanRef.current.refresh();
        toast.success("Issues refreshed successfully");
      } else if (
        activeTab === "tasks" &&
        tasksKanbanRef.current
      ) {
        await tasksKanbanRef.current.refresh();
        toast.success("Tasks refreshed successfully");
      }
    } catch (error) {
      console.error("Failed to refresh:", error);
      toast.error(`Failed to refresh ${activeTab}`);
      setError(`Failed to refresh ${activeTab}`);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, isLoading, activeTab]);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("teifi_kanban_view_mode", mode);
    toast.success(`View mode changed to ${mode}`);
  }, []);

  const handleCustomToggle = useCallback((enabled: boolean) => {
    setCustomEnabled(enabled);
    localStorage.setItem(
      "teifi_kanban_custom_width",
      String(enabled),
    );
    toast.success(
      enabled
        ? "Custom width enabled"
        : "Custom width disabled",
    );
  }, []);

  const handleCustomWidthChange = useCallback(
    (width: number) => {
      setCustomWidth(width);
      localStorage.setItem(
        "teifi_kanban_custom_width_value",
        String(width),
      );
    },
    [],
  );

  // Calculate column width based on view mode
  const getColumnWidth = () => {
    if (customEnabled) return `${customWidth}px`;
    switch (viewMode) {
      case "compact":
        return "240px";
      case "wide":
        return "360px";
      case "normal":
      default:
        return "280px";
    }
  };

  // CRITICAL FIX: Show loading while checking OR still checking access
  // Don't show "Access Denied" until permissions fully loaded AND checked
  if (accessLoading || isChecking) {
    return <PageLoading text="Checking team access..." />;
  }

  // Only show "Access Denied" AFTER loading AND checking complete
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-150px)] p-4">
        <Alert variant="destructive" className="max-w-md">
          <ShieldAlert className="h-5 w-5" />
          <AlertDescription className="ml-2">
            <div className="space-y-2">
              <p className="font-semibold">Access Denied</p>
              <p className="text-sm">
                You don't have permission to view this team.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGoBack}
                className="mt-3"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Teams
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!teamId) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-150px)] p-4">
        <Alert variant="destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertDescription className="ml-2">
            Invalid team ID
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-12 px-4 md:px-6 flex-shrink-0">
          <TabsTrigger
            value="tasks"
            className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
          >
            <ListChecks className="h-4 w-4" />
            Tasks
            {tasksCount > 0 && (
              <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                {tasksCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="issues"
            className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
          >
            <Kanban className="h-4 w-4" />
            Issues
            {issuesCount > 0 && (
              <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                {issuesCount}
              </span>
            )}
          </TabsTrigger>
          
          {/* Help Button - Links to UAT Workflow documentation */}
          <div className="ml-auto flex items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/documentation?doc=client-uat-workflow')}
              className="gap-2 h-8"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">UAT Guide</span>
            </Button>
          </div>
        </TabsList>

        {/* Error Display */}
        {error && (
          <div className="px-4 md:px-6 pt-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="ml-2">
                {error}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Issues Tab - ALWAYS RENDERED to prevent hook ordering issues */}
        <TabsContent
          value="issues"
          className="flex-1 overflow-auto m-0 data-[state=inactive]:hidden"
        >
          <div
            className="p-4 md:p-6 h-full"
            style={
              {
                "--kanban-column-width": getColumnWidth(),
              } as React.CSSProperties
            }
          >
            <div className="h-full min-h-[calc(100vh-150px)]">
              {/* Always render to maintain consistent hook ordering */}
              <TeamIssuesKanban
                ref={issuesKanbanRef}
                teamId={teamId}
                customerId={customerId}
                onIssuesUpdate={handleIssuesUpdate}
                onError={handleError}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                customEnabled={customEnabled}
                onCustomToggle={handleCustomToggle}
                customWidth={customWidth}
                onCustomWidthChange={handleCustomWidthChange}
                viewModeEnabled={viewModeEnabled}
              />
            </div>
          </div>
        </TabsContent>

        {/* ALWAYS RENDERED to prevent hook ordering issues */}
        <TabsContent
          value="tasks"
          className="flex-1 overflow-auto m-0 data-[state=inactive]:hidden"
        >
          <div
            className="p-4 md:p-6 h-full"
            style={
              {
                "--kanban-column-width": getColumnWidth(),
              } as React.CSSProperties
            }
          >
            <div className="h-full min-h-[calc(100vh-150px)]">
              <ClientUATKanban
                ref={tasksKanbanRef}
                teamId={teamId}
                customerId={customerId}
                onTasksUpdate={handleTasksUpdate}
                onError={handleError}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                customEnabled={customEnabled}
                onCustomToggle={handleCustomToggle}
                customWidth={customWidth}
                onCustomWidthChange={handleCustomWidthChange}
                viewModeEnabled={viewModeEnabled}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}