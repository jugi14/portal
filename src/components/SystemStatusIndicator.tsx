/**
 * System Status Indicator
 * 
 * Displays system health and helpful troubleshooting information
 * Shows in development mode or when errors occur
 */

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Terminal,
  Database,
  Zap,
  Users,
  Building2,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { usePermissions } from "../contexts/PermissionContext";
import { apiClient } from "../services/apiClient";

interface SystemStatus {
  api: boolean;
  database: boolean;
  teams: boolean;
  customers: boolean;
  userAccess: boolean;
}

export function SystemStatusIndicator() {
  const { user, session } = useAuth();
  const { userRole, accessibleTeams } = usePermissions();
  const [status, setStatus] = useState<SystemStatus>({
    api: false,
    database: false,
    teams: false,
    customers: false,
    userAccess: false,
  });
  const [checking, setChecking] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const checkSystemStatus = async () => {
    if (!session?.access_token) return;

    setChecking(true);
    const newStatus: SystemStatus = {
      api: false,
      database: false,
      teams: false,
      customers: false,
      userAccess: false,
    };

    try {
      // Check API health
      // CRITICAL: Ensure token is set in apiClient
      if (session.access_token) {
        const expiresAt = session.expires_at ? session.expires_at * 1000 : undefined;
        apiClient.setAccessToken(session.access_token, expiresAt);
      }

      // CRITICAL: Use apiClient instead of raw fetch
      const healthResult = await apiClient.get('/health');
      newStatus.api = healthResult.success;

      // Check database
      const dbResponse = await apiClient.get('/status');
      newStatus.database = dbResponse.success;

      // Check teams
      const teamsResponse = await apiClient.get('/teams/hierarchy');
      newStatus.teams = teamsResponse.success;

      // Check customers
      const customersResponse = await apiClient.get('/admin/customers');
      newStatus.customers = customersResponse.success;

      // Check user access
      newStatus.userAccess = !!user && !!userRole;
    } catch (error) {
      console.error('[SystemStatus] Check failed:', error);
    } finally {
      setStatus(newStatus);
      setChecking(false);
    }
  };

  useEffect(() => {
    if (user) {
      checkSystemStatus();
    }
  }, [user]);

  const runDebugCommand = () => {
    if (typeof window !== 'undefined' && (window as any).debugTeamLoading) {
      (window as any).debugTeamLoading.debug();
      (window as any).debugTeamLoading.suggestFixes();
    }
  };

  const allSystemsGo = Object.values(status).every(s => s);

  return (
    <Card className="border-muted">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4" />
            System Status
          </CardTitle>
          <Badge variant={allSystemsGo ? "default" : "destructive"} className="text-xs">
            {allSystemsGo ? "All Systems Operational" : "Issues Detected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Status Checks */}
        <div className="space-y-2">
          <StatusItem
            label="API Connection"
            status={status.api}
            icon={Zap}
          />
          <StatusItem
            label="Database"
            status={status.database}
            icon={Database}
          />
          <StatusItem
            label="Teams Loading"
            status={status.teams}
            icon={Users}
          />
          <StatusItem
            label="Customers"
            status={status.customers}
            icon={Building2}
          />
          <StatusItem
            label="User Access"
            status={status.userAccess}
            icon={CheckCircle2}
          />
        </div>

        {/* User Info */}
        <div className="pt-2 border-t space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Role:</span>
            <Badge variant="outline" className="text-xs">
              {userRole || 'Unknown'}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Teams:</span>
            <span className="font-medium">{accessibleTeams?.length || 0}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 border-t flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={checkSystemStatus}
            disabled={checking}
            className="w-full text-xs"
          >
            <RefreshCw className={`h-3 w-3 mr-2 ${checking ? 'animate-spin' : ''}`} />
            Recheck Status
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDebug(!showDebug)}
            className="w-full text-xs"
          >
            <Terminal className="h-3 w-3 mr-2" />
            {showDebug ? 'Hide' : 'Show'} Debug Info
          </Button>

          {showDebug && (
            <Alert className="mt-2">
              <Terminal className="h-4 w-4" />
              <AlertDescription className="text-xs space-y-2 mt-2">
                <p className="font-medium">Run in Browser Console:</p>
                <code className="block bg-muted p-2 rounded text-xs">
                  window.debugTeamLoading.debug()
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={runDebugCommand}
                  className="w-full text-xs mt-2"
                >
                  Run Debug Now
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Troubleshooting */}
        {!allSystemsGo && (
          <Alert variant="destructive" className="mt-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <p className="font-medium mb-1">Troubleshooting Steps:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                {!status.api && <li>Check your internet connection</li>}
                {!status.teams && <li>Contact admin to assign you to teams</li>}
                {!status.customers && <li>Admin needs to create customers</li>}
                {!status.userAccess && <li>Try logging out and back in</li>}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function StatusItem({
  label,
  status,
  icon: Icon,
}: {
  label: string;
  status: boolean;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs">{label}</span>
      </div>
      {status ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      ) : (
        <XCircle className="h-4 w-4 text-destructive" />
      )}
    </div>
  );
}
