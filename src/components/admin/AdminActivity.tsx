import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Alert, AlertDescription } from "../ui/alert";
import { ScrollArea } from "../ui/scroll-area";
import { 
  Activity, 
  User, 
  Building2, 
  UserPlus, 
  UserMinus, 
  Edit, 
  Trash2, 
  RefreshCw,
  Download,
  Filter,
  Clock,
  AlertTriangle
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { adminService, ActivityLog } from "../../services/adminService";
import { toast } from "sonner@2.0.3";
import { useAdminActivityLogs } from "../../hooks/useCache";

const ACTION_ICONS = {
  'create_user': UserPlus,
  'update_user': Edit,
  'delete_user': UserMinus,
  'approve_user': User,
  'reject_user': User,
  'create_customer': Building2,
  'update_customer': Edit,
  'delete_customer': Trash2,
  'assign_team': Building2,
  'remove_team': Trash2,
  'login': User,
  'logout': User,
  'default': Activity
};

const ACTION_COLORS = {
  'create_user': 'text-green-600',
  'update_user': 'text-blue-600', 
  'delete_user': 'text-red-600',
  'approve_user': 'text-green-600',
  'reject_user': 'text-red-600',
  'create_customer': 'text-green-600',
  'update_customer': 'text-blue-600',
  'delete_customer': 'text-red-600',
  'assign_team': 'text-blue-600',
  'remove_team': 'text-red-600',
  'login': 'text-blue-600',
  'logout': 'text-gray-600',
  'default': 'text-gray-600'
};

export function AdminActivity() {
  const { session } = useAuth();
  
  // OPTIMIZED: Use ref to prevent re-renders on token updates
  const isTokenSet = React.useRef(false);
  
  const [activityFilter, setActivityFilter] = useState({
    action: 'all',
    search: '',
    limit: 50
  });

  // Use cache hook for activity logs - only enable when session exists
  const { 
    data: activityLogs, 
    loading, 
    error, 
    refresh: refreshActivityLogs 
  } = useAdminActivityLogs(activityFilter.limit);

  // OPTIMIZED: Set token only once
  useEffect(() => {
    if (session?.access_token && !isTokenSet.current) {
      // SECURITY: Do not log token operations
      adminService.setAccessToken(session.access_token);
      isTokenSet.current = true;
    }
  }, [session?.access_token]);

  const handleRefresh = async () => {
    await refreshActivityLogs();
    toast.success('Activity logs refreshed');
  };

  const handleExport = () => {
    const csvContent = [
      ['Timestamp', 'User ID', 'Action', 'Details'].join(','),
      ...filteredActivityLogs.map(log => [
        new Date(log.created_at).toISOString(),
        log.user_id,
        log.action,
        JSON.stringify(log.details)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Activity logs exported');
  };

  // OPTIMIZED: Memoize helper functions
  const formatDate = React.useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }, []);

  const getActionIcon = React.useCallback((action: string) => {
    const IconComponent = ACTION_ICONS[action as keyof typeof ACTION_ICONS] || ACTION_ICONS.default;
    return IconComponent;
  }, []);

  const getActionColor = React.useCallback((action: string) => {
    return ACTION_COLORS[action as keyof typeof ACTION_COLORS] || ACTION_COLORS.default;
  }, []);

  const formatActionDetails = (action: string, details: any) => {
    if (!details) return 'No details available';
    
    try {
      const detailsObj = typeof details === 'string' ? JSON.parse(details) : details;
      
      switch (action) {
        case 'create_user':
          return `Created user: ${detailsObj.email || detailsObj.user_email || 'Unknown'}`;
        case 'update_user':
          return `Updated user: ${detailsObj.email || detailsObj.user_email || 'Unknown'}`;
        case 'delete_user':
          return `Deleted user: ${detailsObj.email || detailsObj.user_email || 'Unknown'}`;
        case 'create_customer':
          return `Created customer: ${detailsObj.name || detailsObj.customer_name || 'Unknown'}`;
        case 'update_customer':
          return `Updated customer: ${detailsObj.name || detailsObj.customer_name || 'Unknown'}`;
        case 'delete_customer':
          return `Deleted customer: ${detailsObj.name || detailsObj.customer_name || 'Unknown'}`;
        case 'assign_team':
          return `Assigned team: ${detailsObj.team_name || 'Unknown'} to ${detailsObj.customer_name || 'Unknown'}`;
        case 'remove_team':
          return `Removed team: ${detailsObj.team_name || 'Unknown'} from ${detailsObj.customer_name || 'Unknown'}`;
        default:
          return JSON.stringify(detailsObj, null, 2);
      }
    } catch (e) {
      return String(details);
    }
  };

  // OPTIMIZED: Memoize filtered activity logs
  const filteredActivityLogs = React.useMemo(() => {
    if (!activityLogs) return [];
    
    return activityLogs.filter(log => {
      const matchesAction = activityFilter.action === 'all' || log.action === activityFilter.action;
      const matchesSearch = activityFilter.search === '' || 
        log.action.toLowerCase().includes(activityFilter.search.toLowerCase()) ||
        log.user_id.toLowerCase().includes(activityFilter.search.toLowerCase()) ||
        formatActionDetails(log.action, log.details).toLowerCase().includes(activityFilter.search.toLowerCase());
      
      return matchesAction && matchesSearch;
    });
  }, [activityLogs, activityFilter.action, activityFilter.search]);

  // OPTIMIZED: Memoize unique actions
  const uniqueActions = React.useMemo(() => {
    if (!activityLogs) return [];
    return [...new Set(activityLogs.map(log => log.action))];
  }, [activityLogs]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Actions */}
      <div className="flex justify-end">
        <div className="flex gap-2">
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-lg font-semibold">{(activityLogs || []).length}</div>
                <div className="text-sm text-muted-foreground">Total Activities</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-lg font-semibold">
                  {(activityLogs || []).filter(log => {
                    const logDate = new Date(log.created_at);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return logDate >= today;
                  }).length}
                </div>
                <div className="text-sm text-muted-foreground">Today</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-purple-600" />
              <div>
                <div className="text-lg font-semibold">
                  {new Set((activityLogs || []).map(log => log.user_id)).size}
                </div>
                <div className="text-sm text-muted-foreground">Active Users</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-orange-600" />
              <div>
                <div className="text-lg font-semibold">{uniqueActions.length}</div>
                <div className="text-sm text-muted-foreground">Action Types</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Filters */}
      <div className="flex flex-wrap gap-4 p-4 bg-muted/30 rounded-lg">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search activities..."
            value={activityFilter.search}
            onChange={(e) => setActivityFilter(prev => ({ ...prev, search: e.target.value }))}
          />
        </div>
        <Select 
          value={activityFilter.action} 
          onValueChange={(value) => setActivityFilter(prev => ({ ...prev, action: value }))}
        >
          <SelectTrigger className="w-[180px]" style={{ position: 'relative', zIndex: 1 }}>
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {uniqueActions.map((action) => (
              <SelectItem key={action} value={action}>
                {action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select 
          value={activityFilter.limit.toString()} 
          onValueChange={(value) => setActivityFilter(prev => ({ ...prev, limit: parseInt(value) }))}
        >
          <SelectTrigger className="w-[120px]" style={{ position: 'relative', zIndex: 1 }}>
            <SelectValue placeholder="Limit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25 logs</SelectItem>
            <SelectItem value="50">50 logs</SelectItem>
            <SelectItem value="100">100 logs</SelectItem>
            <SelectItem value="200">200 logs</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Activity Table */}
      <Card className="flex-1 min-h-0">
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredActivityLogs.map((log) => {
                  const IconComponent = getActionIcon(log.action);
                  const iconColor = getActionColor(log.action);
                  
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {formatDate(log.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <IconComponent className={`h-4 w-4 ${iconColor}`} />
                          <Badge variant="outline" className="text-xs">
                            {log.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-xs">{log.user_id}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm max-w-md">
                        <div className="truncate" title={formatActionDetails(log.action, log.details)}>
                          {formatActionDetails(log.action, log.details)}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredActivityLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No activity logs found</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Help Text */}
      <Alert>
        <Activity className="h-4 w-4" />
        <AlertDescription>
          <strong>Activity Monitoring:</strong> This log tracks all administrative actions including user management, 
          customer changes, and system operations. Use filters to find specific events or export data for analysis.
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