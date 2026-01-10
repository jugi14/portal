import { ChevronRight, Home, Building2, Shield, Users, Activity, Link, Settings } from "lucide-react";
import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiClient } from "../services/apiClient";

interface BreadcrumbProps {
  activeTab: string;
}

interface TeamData {
  id: string;
  name: string;
  key: string;
}

export function Breadcrumb({ activeTab }: BreadcrumbProps) {
  const { teamId } = useParams<{ teamId: string }>();
  const { session } = useAuth();
  const location = useLocation();
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [loadingTeam, setLoadingTeam] = useState(false);

  // Get admin sub-route if we're on admin page
  const getAdminSubRoute = () => {
    if (activeTab === 'admin') {
      const path = location.pathname;
      const segments = path.split('/').filter(s => s);
      
      // Handle /admin (base) or /admin/ cases
      if (segments.length === 1 && segments[0] === 'admin') {
        return 'overview';
      }
      
      // Handle /admin/subpage cases
      if (segments.length >= 2 && segments[0] === 'admin') {
        const subRoute = segments[1];
        const validTabs = ['overview', 'users', 'organizations', 'activity', 'linear', 'system', 'api-test', 'route-test'];
        return validTabs.includes(subRoute) ? subRoute : 'overview';
      }
    }
    return null;
  };

  // Load team data when on team detail or tasks page
  useEffect(() => {
    if ((activeTab === 'team-detail' || activeTab === 'tasks') && teamId && session?.access_token) {
      loadTeamData();
    }
  }, [activeTab, teamId, session?.access_token]);

  const loadTeamData = async () => {
    if (!teamId || !session?.access_token || loadingTeam) return;
    
    setLoadingTeam(true);
    try {
      // CRITICAL: Ensure token is set in apiClient
      if (session.access_token) {
        const expiresAt = session.expires_at ? session.expires_at * 1000 : undefined;
        apiClient.setAccessToken(session.access_token, expiresAt);
      }
      
      // Check if it's a UUID - if so, try to get team by ID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(teamId);
      
      if (isUUID) {
        // CRITICAL: Use apiClient instead of raw fetch
        const result = await apiClient.get<{ team: any }>(`/linear/teams/${teamId}/config`);

        if (result.success && result.data?.team) {
          const team = result.data.team;
          setTeamData({ id: team.id, name: team.name, key: team.key });
        }
      } else {
        // For legacy keys, search in hierarchy
        const result = await apiClient.get<{ hierarchy: any[] }>('/linear/teams/hierarchy');

        if (result.success && result.data?.hierarchy) {
          // Find the specific team in the hierarchy by key
          const findTeam = (teams: any[], targetKey: string): TeamData | null => {
            for (const team of teams) {
              if (team.key === targetKey || team.id === targetKey) {
                return { id: team.id, name: team.name, key: team.key };
              }
              if (team.children) {
                const found = findTeam(team.children, targetKey);
                if (found) return found;
              }
            }
            return null;
          };

          const team = findTeam(result.data.hierarchy, teamId);
          if (team) {
            setTeamData(team);
          }
        }
      }
    } catch (error) {
      console.error('Error loading team data for breadcrumb:', error);
    } finally {
      setLoadingTeam(false);
    }
  };
  
  const getBreadcrumbTitle = (tab: string) => {
    if (tab === 'team-detail' && teamData) {
      // Always show Issues Dashboard since that's our only view now
      return `${teamData.name} - Issues Dashboard`;
    }

    if (tab === 'tasks' && teamData) {
      return `${teamData.name} - Tasks`;
    }

    if (tab === 'admin') {
      const subRoute = getAdminSubRoute();
      if (subRoute && subRoute !== 'overview') {
        const adminTitles = {
          users: "User Management",
          organizations: "Organization Management", 
          activity: "Activity Logs",
          linear: "Linear Integration",
          system: "System Maintenance",
          "api-test": "API Test Suite",
          "route-test": "Route Testing"
        };
        return adminTitles[subRoute as keyof typeof adminTitles] || "Admin Dashboard";
      }
    }
    
    const titles = {
      teams: "Teams",
      issues: "Issues Dashboard",
      dashboard: "Dashboard",
      "tasks": "Tasks",
      report: "Report New Issue", 
      testing: "Testing Checklist",
      help: "Help & Support",
      "access-management": "Access Management",
      admin: "Admin Dashboard"
    };
    
    return titles[tab as keyof typeof titles] || "Teams";
  };

  const getBreadcrumbDescription = (tab: string) => {
    if (tab === 'team-detail' && teamData) {
      if (location.pathname.includes('/issues')) {
        return `Client review dashboard and issue tracking for team ${teamData.key}`;
      }
      return `Detailed view and management for team ${teamData.key}`;
    }

    if (tab === 'tasks' && teamData) {
      return `Track task progress, manage assignments, and monitor completion for team ${teamData.key}`;
    }

    if (tab === 'admin') {
      const subRoute = getAdminSubRoute();
      if (subRoute && subRoute !== 'overview') {
        const adminDescriptions = {
          users: "Manage user accounts, roles, and permissions",
          organizations: "Manage client organizations and Linear integrations",
          activity: "View system activity logs and user actions",
          linear: "Configure Linear API integration and monitor health",
          system: "Perform system maintenance and cleanup operations",
          "api-test": "Test API endpoints and monitor system connectivity",
          "route-test": "Test application routing and navigation"
        };
        return adminDescriptions[subRoute as keyof typeof adminDescriptions] || "Administrative controls and system management";
      }
    }
    
    const descriptions = {
      teams: "Manage your teams and track project progress across all Linear workspaces",
      issues: "Manage and track issues across all projects and teams",
      welcome: "Your starting point for testing and issue management",
      dashboard: "Overview of your testing activities and quick actions",
      "tasks": "Track tasks, manage assignments, and monitor progress",
      report: "Report a new bug or issue", 
      testing: "Execute test cases and validate features",
      help: "Access documentation and support resources",
      "access-management": "Manage user roles and permissions for the UAT portal",
      admin: "Administrative controls and system management"
    };
    
    return descriptions[tab as keyof typeof descriptions] || "Manage your teams and track project progress across all Linear workspaces";
  };

  const getAdminIcon = (subRoute: string | null) => {
    if (!subRoute || subRoute === 'overview') return Shield;
    const icons = {
      users: Users,
      organizations: Building2,
      activity: Activity,
      linear: Link,
      system: Settings,
      "api-test": Activity,
      "route-test": Link
    };
    return icons[subRoute as keyof typeof icons] || Shield;
  };

  const renderBreadcrumbNavigation = () => {
    if (activeTab === 'team-detail') {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Home className="h-3.5 w-3.5" />
          <span className="text-xs">UAT Portal</span>
          <ChevronRight className="h-3.5 w-3.5" />
          {loadingTeam ? (
            <span className="text-foreground text-xs">Loading...</span>
          ) : teamData ? (
            <span className="text-foreground flex items-center gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" />
              {teamData.name}
            </span>
          ) : (
            <span className="text-foreground text-xs">Team Details</span>
          )}
        </div>
      );
    }

    if (activeTab === 'uat') {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Home className="h-4 w-4" />
          <span>UAT Portal</span>
          <ChevronRight className="h-4 w-4" />
          {loadingTeam ? (
            <span className="text-foreground font-medium">Loading...</span>
          ) : teamData ? (
            <>
              <span className="text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {teamData.name}
              </span>
              <ChevronRight className="h-4 w-4" />
              <span className="text-foreground font-medium">UAT Tracking</span>
            </>
          ) : (
            <span className="text-foreground font-medium">UAT Tracking</span>
          )}
        </div>
      );
    }

    if (activeTab === 'admin') {
      const subRoute = getAdminSubRoute();
      const AdminIcon = getAdminIcon(subRoute);
      
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Home className="h-3.5 w-3.5" />
          <span className="text-xs">UAT Portal</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-muted-foreground text-xs">Admin</span>
          {subRoute && subRoute !== 'overview' && (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-foreground flex items-center gap-1.5 text-xs">
                <AdminIcon className="h-3.5 w-3.5" />
                {getBreadcrumbTitle(activeTab)}
              </span>
            </>
          )}
          {(!subRoute || subRoute === 'overview') && (
            <>
              <ChevronRight className="h-4 w-4" />
              <span className="text-foreground font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Overview
              </span>
            </>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Home className="h-4 w-4" />
        <span>UAT Portal</span>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">{getBreadcrumbTitle(activeTab)}</span>
      </div>
    );
  };

  return (
    <div className="mb-6">
      {/* Breadcrumb navigation */}
      <div className="mb-2">
        {renderBreadcrumbNavigation()}
      </div>
      
      {/* Page title */}
      <div className="flex items-center gap-3">
        {activeTab === 'team-detail' && teamData && (
          <Users className="h-5 w-5 text-primary" />
        )}
        {activeTab === 'admin' && (() => {
          const subRoute = getAdminSubRoute();
          const AdminIcon = getAdminIcon(subRoute);
          return <AdminIcon className="h-5 w-5 text-primary" />;
        })()}
        <h1 className="text-xl">
          {getBreadcrumbTitle(activeTab)}
        </h1>
      </div>
    </div>
  );
}