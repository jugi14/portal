import React, { useState, useEffect } from "react";
import {
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  Alert,
  AlertDescription,
} from "../components/ui/alert";
import {
  Shield,
  AlertTriangle,
} from "lucide-react";

// Import modular components
import { AdminOverview } from "../components/admin/AdminOverview";
import { AdminUsers } from "../components/admin/AdminUsers";
import { AdminCustomersModern } from "../components/admin/AdminCustomersModern";
import { AdminTeamsProduction } from "../components/admin/AdminTeamsProduction";

// CACHE BUSTING: Force component reload with timestamp
const ADMIN_VERSION = Date.now();
// PERFORMANCE: Force reload version tracking

export function AdminPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [forceUpdate, setForceUpdate] = useState(0);

  // Component lifecycle tracking removed for cleaner console output

  // Get active tab from URL, default to overview
  const getActiveTabFromUrl = () => {
    const path = location.pathname;
    if (path === "/admin" || path === "/admin/")
      return "overview";
    const segments = path.split("/");
    const lastSegment = segments[segments.length - 1];
    const validTabs = [
      "overview",
      "users",
      "customers",
      "teams",
    ];
    return validTabs.includes(lastSegment)
      ? lastSegment
      : "overview";
  };

  const [activeTab, setActiveTab] = useState(
    getActiveTabFromUrl(),
  );

  // Update tab when URL changes
  useEffect(() => {
    const newTab = getActiveTabFromUrl();
    // PERFORMANCE: URL changed, checking tab
    if (newTab !== activeTab) {
      // PERFORMANCE: Switching tab
      setActiveTab(newTab);
      // Force a re-render to ensure component updates
      setForceUpdate(prev => prev + 1);
    }
  }, [location.pathname]);
  
  // FORCE RELOAD: Clear all caches on mount
  useEffect(() => {
    // PERFORMANCE: Clearing admin caches
    
    // Clear sessionStorage admin cache
    const adminKeys = Object.keys(sessionStorage).filter(key => 
      key.includes('admin') || key.includes('customer') || key.includes('team')
    );
    adminKeys.forEach(key => sessionStorage.removeItem(key));
    
    // Force re-render after 100ms
    const timer = setTimeout(() => {
      setForceUpdate(prev => prev + 1);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Handle tab change - controlled by Header now
  const handleTabChange = (newTab: string) => {
    // PERFORMANCE: Tab change requested
    setActiveTab(newTab);
    const newPath =
      newTab === "overview" ? "/admin" : `/admin/${newTab}`;
    // PERFORMANCE: Navigating
    navigate(newPath);
  };

  return (
    <div className="w-full max-w-[1920px] mx-auto space-y-6">
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Content - Navigation is in Header, so just show active component */}
      <div className="w-full">
        {activeTab === 'overview' && (
          <AdminOverview key={`overview-${forceUpdate}`} onTabChange={handleTabChange} />
        )}

        {activeTab === 'users' && (
          <AdminUsers key={`users-${forceUpdate}`} />
        )}

        {activeTab === 'customers' && (
          <AdminCustomersModern key={`customers-${ADMIN_VERSION}-${forceUpdate}`} />
        )}

        {activeTab === 'teams' && (
          <AdminTeamsProduction key={`teams-${ADMIN_VERSION}-${forceUpdate}`} />
        )}
      </div>
    </div>
  );
}