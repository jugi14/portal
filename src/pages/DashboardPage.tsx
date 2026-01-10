/**
 * Dashboard Page - Professional Team Overview
 * 
 * Design: Clean, modern dashboard matching Teifi Digital branding
 * Performance: Optimized with React.memo, memoization, and efficient rendering
 * 
 * Features:
 * - Team list with search and view modes (grid/list)
 * - Responsive design for mobile and desktop
 * - Real-time team access from PermissionContext
 * 
 * Follows Guidelines.md:
 * - KISS: Simple, focused components
 * - DRY: Reusable components and hooks
 * - Performance: Memoization, caching, lazy rendering
 * - Maintainability: Clean code, clear separation
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { TeamGridSkeleton } from '../components/ui/skeleton-library';
import { Search, Grid3x3, List, Building2 } from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import { TeamListItem } from '../components/dashboard/TeamListItem';
import { TeamGridCard } from '../components/dashboard/TeamGridCard';
import { usePermissions } from '../contexts/PermissionContext';

interface AccessibleTeam {
  id: string;
  name: string;
  key: string;
  description?: string;
  children?: AccessibleTeam[];
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { loading: permissionsLoading } = usePermissions();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // Data fetching with custom hook (DRY principle)
  const { loading, teams } = useDashboardData();

  // Memoized team click handler (Performance optimization)
  const handleTeamClick = useCallback((teamId: string) => {
    navigate(`/teams/${teamId}?tab=tasks`);
  }, [navigate]);

  // Memoized filtered teams (Performance optimization)
  const filteredTeams = useMemo(() => {
    if (!searchQuery) return teams;
    
    const query = searchQuery.toLowerCase();
    return teams.filter(team => 
      team.name.toLowerCase().includes(query) ||
      team.key.toLowerCase().includes(query) ||
      team.description?.toLowerCase().includes(query)
    );
  }, [teams, searchQuery]);

  // Memoized view mode handlers (Performance optimization)
  const setGridView = useCallback(() => setViewMode('grid'), []);
  const setListView = useCallback(() => setViewMode('list'), []);

  // Show loading skeleton while permissions OR teams are loading
  const isInitialLoading = permissionsLoading || loading;
  
  if (isInitialLoading) {
    return (
      <div className="h-full overflow-auto">
        <div className="container mx-auto p-6 space-y-6 max-w-7xl">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-muted animate-pulse rounded" />
            <div className="h-4 w-96 bg-muted animate-pulse rounded" />
          </div>
          <TeamGridSkeleton teams={6} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="container mx-auto p-6 space-y-6 max-w-7xl">
        {/* Page Header */}
        <div className="space-y-1">
          <h1>Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your teams and project statistics
          </p>
        </div>

        {/* Teams Section */}
        <Card className="border-border/50">
          <CardHeader className="space-y-1">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle>Teams</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Manage and navigate team hierarchies, view progress, and track deliverables
                  </p>
                </div>
                
                {/* Actions - Desktop */}
                <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                  {/* Search */}
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search teams..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>

                  {/* View Toggle */}
                  <div className="flex items-center border border-border rounded-lg overflow-hidden">
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={setGridView}
                      className="rounded-none h-9 px-3"
                      aria-label="Grid view"
                    >
                      <Grid3x3 className="h-4 w-4" />
                    </Button>
                    <div className="w-px h-5 bg-border" />
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={setListView}
                      className="rounded-none h-9 px-3"
                      aria-label="List view"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Actions - Mobile */}
              <div className="flex md:hidden flex-col gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search teams..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>

                <div className="flex items-center border border-border rounded-lg overflow-hidden self-start">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={setGridView}
                    className="rounded-none h-9 px-3"
                    aria-label="Grid view"
                  >
                    <Grid3x3 className="h-4 w-4" />
                  </Button>
                  <div className="w-px h-5 bg-border" />
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={setListView}
                    className="rounded-none h-9 px-3"
                    aria-label="List view"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {filteredTeams.length === 0 ? (
              <div className="text-center py-16">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                </div>
                <h3 className="mb-2">
                  {searchQuery ? 'No teams found' : 'No teams available'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {searchQuery 
                    ? 'Try adjusting your search query'
                    : 'You don\'t have access to any teams yet. Contact your administrator to get assigned.'}
                </p>
              </div>
            ) : viewMode === 'list' ? (
              <div className="space-y-1">
                {filteredTeams.map(team => (
                  <TeamListItem
                    key={team.id}
                    team={team}
                    level={0}
                    onTeamClick={handleTeamClick}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTeams.map(team => (
                  <TeamGridCard
                    key={team.id}
                    team={team}
                    onClick={handleTeamClick}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}