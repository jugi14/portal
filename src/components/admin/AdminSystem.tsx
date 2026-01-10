import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import { ScrollArea } from "../ui/scroll-area";
import { 
  Settings, 
  Database as DatabaseIcon, 
  Server, 
  Activity,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Zap,
  Shield,
  Monitor,
  HardDrive,
  Network,
  Clock,
  Trash2
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { adminService } from "../../services/adminService";
import { apiClient } from "../../services/apiClient";
import { toast } from "sonner@2.0.3";
import { useSystemHealth, cacheStrategies } from "../../hooks/useCache";
import { globalCache, cachePerformance, CACHE_STRATEGIES } from "../../services/cacheService";
import { CachePerformanceInsights } from "./CachePerformanceInsights";
import { AdminPermissionTest } from "./AdminPermissionTest";
// Testing components removed during cleanup

interface SystemHealth {
  database: 'healthy' | 'warning' | 'error';
  server: 'healthy' | 'warning' | 'error';
  cache: 'healthy' | 'warning' | 'error';
  linear: 'healthy' | 'warning' | 'error';
}

interface SystemStats {
  uptime: string;
  totalRequests: number;
  cacheHitRate: number;
  activeUsers: number;
  memoryUsage: number;
  responseTime: number;
}

export function AdminSystem() {
  const { session } = useAuth();
  
  // OPTIMIZED: Use ref to prevent re-renders on token updates
  const isTokenSet = React.useRef(false);
  
  // Data Management States
  const [isCleaningData, setIsCleaningData] = useState(false);
  
  // Feature Toggles
  const [commentsEnabled, setCommentsEnabled] = useState(() => {
    return localStorage.getItem('teifi_enable_comments') === 'true';
  });
  
  const [viewModeEnabled, setViewModeEnabled] = useState(() => {
    return localStorage.getItem('teifi_enable_view_mode') === 'true';
  });
  
  // Use cache hook for system health data - only enable when session exists
  const { 
    data: systemData, 
    loading, 
    error, 
    refresh: refreshSystemHealth 
  } = useSystemHealth({ enabled: !!session?.access_token });

  // OPTIMIZED: Memoize system health and stats to prevent recalculation
  const systemHealth = React.useMemo(() => systemData?.health || {
    database: 'healthy' as const,
    server: 'healthy' as const,
    cache: 'healthy' as const,
    linear: 'healthy' as const
  }, [systemData?.health]);
  
  const systemStats = React.useMemo(() => systemData?.stats || {
    uptime: '0h 0m',
    totalRequests: 0,
    cacheHitRate: 0,
    activeUsers: 0,
    memoryUsage: 0,
    responseTime: 0
  }, [systemData?.stats]);

  // OPTIMIZED: Set token only once
  useEffect(() => {
    if (session?.access_token && !isTokenSet.current) {
      // SECURITY: Do not log token operations
      adminService.setAccessToken(session.access_token);
      isTokenSet.current = true;
    }
  }, [session?.access_token]);

  const getHealthIcon = (status: SystemHealth[keyof SystemHealth]) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return <Info className="h-5 w-5 text-gray-600" />;
    }
  };

  const getHealthColor = (status: SystemHealth[keyof SystemHealth]) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleRefresh = async () => {
    await refreshSystemHealth();
    toast.success('System information refreshed');
  };

  const clearCache = async () => {
    CACHE_STRATEGIES.CLEAR_ALL_CACHE();
    toast.success('Cache cleared successfully');
    await refreshSystemHealth(); // Refresh stats
  };

  const handleCleanupCache = async () => {
    // Cleanup expired cache entries
    globalCache.cleanup();
    toast.success('Expired cache entries cleaned up');
    await refreshSystemHealth(); // Refresh stats
  };

  const handleDataCleanup = async () => {
    setIsCleaningData(true);
    try {
      // CRITICAL: Use apiClient instead of raw fetch
      const result = await apiClient.post('/initialize/cleanup-data', {});
      
      if (result.success) {
        toast.success('Data cleanup completed successfully');
      } else {
        throw new Error(result.error || 'Cleanup failed');
      }
    } catch (error) {
      console.error('[AdminSystem] Data cleanup error:', error);
      toast.error(`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCleaningData(false);
    }
  };

  const handleClearLinearCache = async () => {
    if (!confirm('This will clear ALL Linear-related cache data. Teams will be resynced from Linear API. Continue?')) {
      return;
    }

    setIsCleaningData(true);
    try {
      console.log('[AdminSystem] Clearing Linear cache...');

      // CRITICAL: Ensure token is set in apiClient
      if (session?.access_token) {
        const expiresAt = session.expires_at ? session.expires_at * 1000 : undefined;
        apiClient.setAccessToken(session.access_token, expiresAt);
      }

      // CRITICAL: Use apiClient instead of raw fetch
      const result = await apiClient.post<{ deletedKeys: number }>('/linear/clear-cache', {});
      
      if (result.success) {
        toast.success(`Linear cache cleared! Deleted ${result.data?.deletedKeys || 0} keys.`);
        console.log('[AdminSystem] Linear cache cleared:', result);
        
        // Force reload to fetch fresh data
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        throw new Error(result.error || 'Failed to clear Linear cache');
      }
    } catch (error) {
      console.error('[AdminSystem] Clear Linear cache error:', error);
      toast.error(`Failed to clear Linear cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCleaningData(false);
    }
  };

  const handleToggleComments = () => {
    const newValue = !commentsEnabled;
    setCommentsEnabled(newValue);
    localStorage.setItem('teifi_enable_comments', String(newValue));
    toast.success(newValue ? 'Comments enabled' : 'Comments disabled');
    
    // Dispatch event to notify IssueDetailModal
    window.dispatchEvent(new CustomEvent('teifi_comments_toggle', { 
      detail: { enabled: newValue } 
    }));
  };

  const handleToggleViewMode = () => {
    const newValue = !viewModeEnabled;
    setViewModeEnabled(newValue);
    localStorage.setItem('teifi_enable_view_mode', String(newValue));
    toast.success(newValue ? 'View mode selector enabled' : 'View mode selector disabled');
    
    // Dispatch event to notify TeamIssuesOnlyPage
    window.dispatchEvent(new CustomEvent('teifi_view_mode_toggle', { 
      detail: { enabled: newValue } 
    }));
  };



  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Actions */}
      <div className="flex justify-end gap-2 mb-6">
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DatabaseIcon className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium">Database</span>
              </div>
              {getHealthIcon(systemHealth.database)}
            </div>
            <div className="mt-2">
              <Badge className={getHealthColor(systemHealth.database)}>
                {systemHealth.database}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium">Server</span>
              </div>
              {getHealthIcon(systemHealth.server)}
            </div>
            <div className="mt-2">
              <Badge className={getHealthColor(systemHealth.server)}>
                {systemHealth.server}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-purple-600" />
                <span className="text-sm font-medium">Cache</span>
              </div>
              {getHealthIcon(systemHealth.cache)}
            </div>
            <div className="mt-2">
              <Badge className={getHealthColor(systemHealth.cache)}>
                {systemHealth.cache}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-orange-600" />
                <span className="text-sm font-medium">Linear</span>
              </div>
              {getHealthIcon(systemHealth.linear)}
            </div>
            <div className="mt-2">
              <Badge className={getHealthColor(systemHealth.linear)}>
                {systemHealth.linear}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Response Time</span>
                <Badge variant="outline">{systemStats.responseTime}ms</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Cache Hit Rate</span>
                <Badge variant="outline">{systemStats.cacheHitRate}%</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Requests</span>
                <Badge variant="outline">{systemStats.totalRequests.toLocaleString()}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Memory Usage</span>
                <Badge variant="outline">{systemStats.memoryUsage}%</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Uptime</span>
                <Badge variant="outline">{systemStats.uptime}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Active Users</span>
                <Badge variant="outline">{systemStats.activeUsers}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Online Now</span>
                <Badge variant="outline" className="bg-green-100 text-green-800">
                  Live
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Last Deployment</span>
                <Badge variant="outline">2h ago</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">System Version</span>
                <Badge variant="outline">v1.2.3</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            System Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium">Cache Management</h4>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  onClick={handleCleanupCache}
                  className="w-full justify-start"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Cleanup Expired Cache
                </Button>
                <Button 
                  variant="outline" 
                  onClick={clearCache}
                  className="w-full justify-start text-orange-700 border-orange-300 hover:bg-orange-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All Cache
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Data Management</h4>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  onClick={handleDataCleanup}
                  disabled={isCleaningData}
                  className="w-full justify-start text-purple-700 border-purple-300 hover:bg-purple-50"
                >
                  {isCleaningData ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <DatabaseIcon className="h-4 w-4 mr-2" />
                  )}
                  {isCleaningData ? 'Cleaning...' : 'Clean Old Data'}
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={handleClearLinearCache}
                  disabled={isCleaningData}
                  className="w-full justify-start text-blue-700 border-blue-300 hover:bg-blue-50"
                >
                  {isCleaningData ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Clear Linear Cache
                </Button>

              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">System Diagnostics</h4>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  onClick={() => window.open('/admin/api-test', '_blank')}
                  className="w-full justify-start"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  API Health Check
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleRefresh}
                  className="w-full justify-start"
                >
                  <Monitor className="h-4 w-4 mr-2" />
                  System Status Check
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Feature Toggles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Comments Toggle */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <h4 className="font-medium">Issue Comments</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Enable or disable commenting functionality on issues. When disabled, users won't see the comments section in issue details.
                </p>
              </div>
              <Button
                variant={commentsEnabled ? "default" : "outline"}
                onClick={handleToggleComments}
                className="ml-4"
              >
                {commentsEnabled ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Enabled
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Disabled
                  </>
                )}
              </Button>
            </div>

            {/* Kanban View Mode Selector Toggle */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <h4 className="font-medium">Kanban View Mode Selector</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Enable or disable view mode selector (Compact/Normal/Wide) on Issues and Tasks boards. When enabled, users can change column widths with preset modes or custom slider.
                </p>
              </div>
              <Button
                variant={viewModeEnabled ? "default" : "outline"}
                onClick={handleToggleViewMode}
                className="ml-4"
              >
                {viewModeEnabled ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Enabled
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Disabled
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Linear Team Hierarchy Sync moved to Admin → Teams → Linear Sync tab */}

      {/* System Connection Status */}
      <Card className="flex-1 min-h-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            System Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              System connection testing has been streamlined. Core connectivity is monitored through the system health metrics above.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Admin Permission Testing */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Role & Permission Testing</h3>
        </div>
        <AdminPermissionTest />
      </div>

      {/* System Information */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>System Monitoring:</strong> This dashboard provides real-time insight into system health, 
          performance metrics, and cache efficiency. Use the management tools to optimize system performance.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">
            {error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}