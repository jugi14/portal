import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { 
  Building2, 
  Users, 
  Link as LinkIcon, 
  Activity,
  Shield,
  AlertCircle,
  CheckCircle,
  XCircle,
  MessageSquare,
  LayoutGrid,
  Eye,
  Filter,
  Settings
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner@2.0.3";
import { apiClient } from "../../services/apiClient";
import { adminService } from "../../services/adminService";
import { globalCache, CACHE_STRATEGIES as cacheStrategies } from "../../services/cacheService";
import { useAdminStats, useAdminUsers, useAdminCustomers } from "../../hooks/useCache";

type LinearTeam = {
  id: string;
  name: string;
  key: string;
  description?: string;
};

interface AdminOverviewProps {
  onTabChange?: (tab: string) => void;
}

// Feature toggle settings type
type FeatureToggles = {
  issueComments: boolean;
  kanbanViewModeSelector: boolean;
};

export function AdminOverview({ onTabChange }: AdminOverviewProps = {}) {
  const { session } = useAuth();
  
  const isTokenSet = React.useRef(false);
  const isFetchingTeams = React.useRef(false);
  
  const [linearTeams, setLinearTeams] = useState<LinearTeam[]>([]);
  const [featureToggles, setFeatureToggles] = useState<FeatureToggles>({
    issueComments: false,
    kanbanViewModeSelector: true,
  });
  
  // PERFORMANCE: Parallel loading - all hooks load simultaneously
  const { 
    data: stats, 
    loading: statsLoading, 
    error: statsError, 
    refresh: refreshStats 
  } = useAdminStats({ enabled: !!session?.access_token });
  
  const { 
    data: users, 
    loading: usersLoading, 
    error: usersError, 
    refresh: refreshUsers 
  } = useAdminUsers({ enabled: !!session?.access_token });
  
  const { 
    data: customers, 
    loading: customersLoading, 
    error: customersError, 
    refresh: refreshCustomers 
  } = useAdminCustomers({ enabled: !!session?.access_token });

  // PERFORMANCE: Memoize loading/error states
  const loading = useMemo(() => 
    usersLoading || customersLoading,
    [usersLoading, customersLoading]
  );
  
  const error = useMemo(() => 
    usersError || customersError,
    [usersError, customersError]
  );

  const fetchLinearTeams = useCallback(async (useCache = true) => {
    const CACHE_KEY = 'admin:linear_teams';
    
    if (isFetchingTeams.current) {
      return;
    }
    
    if (useCache) {
      const cachedTeams = globalCache.get<LinearTeam[]>(CACHE_KEY);
      if (cachedTeams) {
        setLinearTeams(cachedTeams);
        return;
      }
    }

    try {
      if (!session?.access_token) return;
      
      isFetchingTeams.current = true;

      // Set access token
      if (session.access_token) {
        const expiresAt = session.expires_at ? session.expires_at * 1000 : undefined;
        apiClient.setAccessToken(session.access_token, expiresAt);
      }

      const result = await apiClient.get<{ teams: LinearTeam[] }>('/linear/teams');

      if (result.success && result.data?.teams) {
        const teams = result.data.teams.map((team: any) => ({
          id: team.id,
          name: team.name,
          key: team.key,
          description: team.description
        }));
        setLinearTeams(teams);
        globalCache.set(CACHE_KEY, teams, 3600000); // 1 hour
      }
    } catch (error) {
      console.error('[AdminOverview] Error fetching Linear teams:', error);
    } finally {
      isFetchingTeams.current = false;
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (session?.access_token && !isTokenSet.current) {
      // SECURITY: Do not log token operations
      adminService.setAccessToken(session.access_token);
      isTokenSet.current = true;
      fetchLinearTeams();
    }
  }, [session?.access_token, fetchLinearTeams]);

  // Load feature toggles from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('admin_feature_toggles');
    if (saved) {
      try {
        const toggles = JSON.parse(saved);
        setFeatureToggles(toggles);
        
        // Sync with old localStorage keys for backward compatibility
        localStorage.setItem('teifi_enable_comments', String(toggles.issueComments ?? false));
        localStorage.setItem('teifi_enable_view_mode', String(toggles.kanbanViewModeSelector ?? true));
      } catch (error) {
        console.error('[AdminOverview] Error parsing feature toggles:', error);
      }
    } else {
      // Initialize from old keys if new toggles don't exist
      const oldViewMode = localStorage.getItem('teifi_enable_view_mode') === 'true';
      const oldComments = localStorage.getItem('teifi_enable_comments') === 'true';
      
      const initialToggles = {
        issueComments: oldComments,
        kanbanViewModeSelector: oldViewMode !== false, // Default true if not set
      };
      
      setFeatureToggles(initialToggles);
      localStorage.setItem('admin_feature_toggles', JSON.stringify(initialToggles));
    }
  }, []);

  // Save feature toggles to localStorage
  const updateFeatureToggle = useCallback((key: keyof FeatureToggles, value: boolean) => {
    const updated = { ...featureToggles, [key]: value };
    setFeatureToggles(updated);
    localStorage.setItem('admin_feature_toggles', JSON.stringify(updated));
    
    // Special handling for different toggles with backward compatibility
    if (key === 'issueComments') {
      localStorage.setItem('teifi_enable_comments', String(value));
      window.dispatchEvent(new CustomEvent('teifi_comments_toggle', { detail: { enabled: value } }));
      toast.success(value ? 'Comments enabled' : 'Comments disabled');
    } else if (key === 'kanbanViewModeSelector') {
      localStorage.setItem('teifi_enable_view_mode', String(value));
      window.dispatchEvent(new CustomEvent('teifi_view_mode_toggle', { detail: { enabled: value } }));
      toast.success(value ? 'View mode selector enabled' : 'View mode selector disabled');
    } else {
      toast.success(`Feature "${key}" ${value ? 'enabled' : 'disabled'}`);
    }
  }, [featureToggles]);

  // PERFORMANCE: Memoize unassigned teams calculation
  const unassignedTeams = useMemo(() => {
    const assignedTeamIds = (customers || []).flatMap(c => c.customer_teams.map(ct => ct.linear_team_id));
    return linearTeams.filter(team => !assignedTeamIds.includes(team.id));
  }, [customers, linearTeams]);

  // PERFORMANCE: Memoize team assignments count
  const teamAssignmentsCount = useMemo(() => 
    (customers || []).flatMap(c => c.customer_teams).length,
    [customers]
  );

  // PERFORMANCE: Memoize active customers count
  const activeCustomersCount = useMemo(() => 
    (customers || []).filter(c => c.status === 'active').length,
    [customers]
  );

  // PERFORMANCE: Memoize active users count
  const activeUsersCount = useMemo(() => 
    (users || []).filter(u => u.status === 'active').length,
    [users]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards - 2 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customers Card */}
        <Card className="relative overflow-hidden border-l-4 border-l-[#1492ff]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#1492ff]/10 to-transparent rounded-full -mr-16 -mt-16" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#1492ff]/10 rounded-lg">
                  <Building2 className="h-5 w-5 text-[#1492ff]" />
                </div>
                <CardTitle className="text-sm">Customers</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl">{activeCustomersCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Active customers</p>
          </CardContent>
        </Card>

        {/* Users Card */}
        <Card className="relative overflow-hidden border-l-4 border-l-green-500">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/10 to-transparent rounded-full -mr-16 -mt-16" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
                <CardTitle className="text-sm">Users</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl">{activeUsersCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Active users</p>
          </CardContent>
        </Card>
      </div>

      {/* Alert for unassigned Linear teams */}
      {unassignedTeams.length > 0 && (
        <Alert className="border-[#1492ff]/20 bg-[#1492ff]/5">
          <LinkIcon className="h-4 w-4 text-[#1492ff]" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm">
              <strong>{unassignedTeams.length}</strong> Linear team{unassignedTeams.length !== 1 ? 's' : ''} not assigned to any customer
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onTabChange?.('teams')}
              className="text-[#1492ff] border-[#1492ff]/30 hover:bg-[#1492ff]/10"
            >
              View Teams
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Feature Toggles Section */}
      <Card className="border-l-4 border-l-cyan-500">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Settings className="h-5 w-5 text-cyan-600" />
            </div>
            <CardTitle>Feature Toggles</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Issue Comments Toggle */}
          <div className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="issue-comments" className="cursor-pointer">
                  Issue Comments
                </Label>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Enable or disable commenting functionality on issues. When disabled, users won't see the comments section in issue details.
              </p>
            </div>
            <div className="flex items-center gap-2 ml-4 flex-shrink-0">
              <Switch
                id="issue-comments"
                checked={featureToggles.issueComments}
                onCheckedChange={(checked) => updateFeatureToggle('issueComments', checked)}
              />
              {featureToggles.issueComments ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <Badge 
                variant={featureToggles.issueComments ? "default" : "secondary"}
                className={`text-xs ${featureToggles.issueComments ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}`}
              >
                {featureToggles.issueComments ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </div>

          {/* Kanban View Mode Selector Toggle */}
          <div className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="kanban-view-mode" className="cursor-pointer">
                  Kanban View Mode Selector
                </Label>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Enable or disable view mode selector (Compact/Normal/Wide) on Issues and Tasks boards. When enabled, users can change column widths with preset modes or custom slider.
              </p>
            </div>
            <div className="flex items-center gap-2 ml-4 flex-shrink-0">
              <Switch
                id="kanban-view-mode"
                checked={featureToggles.kanbanViewModeSelector}
                onCheckedChange={(checked) => updateFeatureToggle('kanbanViewModeSelector', checked)}
              />
              {featureToggles.kanbanViewModeSelector ? (
                <CheckCircle className="h-5 w-5 text-[#1492ff]" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <Badge 
                variant={featureToggles.kanbanViewModeSelector ? "default" : "secondary"}
                className={`text-xs ${featureToggles.kanbanViewModeSelector ? 'bg-[#1492ff] text-white' : 'bg-red-100 text-red-800 border-red-200'}`}
              >
                {featureToggles.kanbanViewModeSelector ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}