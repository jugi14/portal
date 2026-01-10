import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { Loader2, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { apiClient } from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';

interface Team {
  id: string;
  name: string;
  key: string;
  description?: string;
}

interface SimpleTeamSelectorProps {
  organizationId: string;
  organizationName: string;
}

export function SimpleTeamSelector({ organizationId, organizationName }: SimpleTeamSelectorProps) {
  const { session } = useAuth();
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [savedTeams, setSavedTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // Set access token
  useEffect(() => {
    if (session?.access_token) {
      apiClient.setAccessToken(session.access_token);
    }
  }, [session?.access_token]);

  // Load saved teams on mount
  useEffect(() => {
    if (session?.access_token) {
      loadSavedTeams();
    }
  }, [organizationId, session?.access_token]);

  const loadSavedTeams = async () => {
    try {
      setLoadingSaved(true);
      // Updated: Use /admin/customers instead of /organizations
      const response = await apiClient.get<{ teams: Team[] }>(`/admin/customers/${organizationId}/teams`);
      
      if (response.success && response.data?.teams) {
        setSavedTeams(response.data.teams);
        // Pre-select saved teams
        const savedIds = new Set(response.data.teams.map((t: Team) => t.id));
        setSelectedTeamIds(savedIds);
      } else {
        console.error('Error loading saved teams:', response.error);
      }
    } catch (error) {
      console.error('Error loading saved teams:', error);
    } finally {
      setLoadingSaved(false);
    }
  };

  const fetchAllTeams = async () => {
    if (!session?.access_token) {
      toast.error('Authentication required');
      return;
    }
    
    try {
      setLoading(true);
      
      // Use apiClient for Linear teams
      const response = await apiClient.get<{ hierarchy: any[] }>('/linear/teams/hierarchy?admin=true');

      if (response.success && response.data?.hierarchy) {
        // Flatten hierarchy to get all teams
        const flattenTeams = (teams: any[]): Team[] => {
          const flat: Team[] = [];
          teams.forEach(team => {
            flat.push({
              id: team.id,
              name: team.name,
              key: team.key,
              description: team.description,
            });
            if (team.children && team.children.length > 0) {
              flat.push(...flattenTeams(team.children));
            }
          });
          return flat;
        };

        const teams = flattenTeams(result.data.hierarchy);
        setAllTeams(teams);
        toast.success(`Fetched ${teams.length} teams from Linear`);
      } else {
        toast.error(result.error || 'Failed to fetch teams');
        console.error('[SimpleTeamSelector] Failed to fetch teams:', result.error);
      }
    } catch (error) {
      console.error('[SimpleTeamSelector] Error fetching teams:', error);
      toast.error('Failed to fetch teams from Linear');
    } finally {
      setLoading(false);
    }
  };

  const toggleTeam = (teamId: string) => {
    const newSelected = new Set(selectedTeamIds);
    if (newSelected.has(teamId)) {
      newSelected.delete(teamId);
    } else {
      newSelected.add(teamId);
    }
    setSelectedTeamIds(newSelected);
  };

  const saveSelectedTeams = async () => {
    const teamsToSave = allTeams.filter(t => selectedTeamIds.has(t.id));
    
    if (teamsToSave.length === 0) {
      toast.error('Please select at least one team');
      return;
    }

    if (!session?.access_token) {
      toast.error('Authentication required');
      return;
    }

    try {
      setSaving(true);
      // Use apiClient for saving teams
      const response = await apiClient.post(
        `/admin/customers/${organizationId}/linear/save-teams`,
        {
          selectedTeams: teamsToSave.map(t => ({
            id: t.id,
            name: t.name,
            key: t.key,
          })),
        }
      );

      if (response.success) {
        toast.success(`Saved ${teamsToSave.length} teams for ${organizationName}`);
        setSavedTeams(teamsToSave);
      } else {
        toast.error(result.error || 'Failed to save teams');
      }
    } catch (error) {
      console.error('Error saving teams:', error);
      toast.error('Failed to save teams');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Saved Teams */}
      {loadingSaved ? (
        <Card>
          <CardContent className="p-6 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : savedTeams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Teams</CardTitle>
            <CardDescription>
              {savedTeams.length} team{savedTeams.length !== 1 ? 's' : ''} configured for {organizationName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {savedTeams.map(team => (
                <Badge key={team.id} variant="secondary" className="flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  {team.name} ({team.key})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fetch Teams from Linear */}
      <Card>
        <CardHeader>
          <CardTitle>Fetch Teams from Linear</CardTitle>
          <CardDescription>
            Load all available teams from the Linear workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={fetchAllTeams} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Fetching Teams...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Fetch Teams from Linear
              </>
            )}
          </Button>

          <div className="text-xs text-muted-foreground flex items-start gap-2">
            <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>
              Teams are fetched from the system-wide Linear integration using the configured LINEAR_API_KEY environment variable.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Team Selection */}
      {allTeams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Teams</CardTitle>
            <CardDescription>
              Choose which teams to enable for {organizationName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {allTeams.map(team => (
                <div
                  key={team.id}
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => toggleTeam(team.id)}
                >
                  <Checkbox
                    checked={selectedTeamIds.has(team.id)}
                    onCheckedChange={() => toggleTeam(team.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{team.name}</p>
                      <Badge variant="outline" className="text-xs">
                        {team.key}
                      </Badge>
                    </div>
                    {team.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {team.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {selectedTeamIds.size} of {allTeams.length} teams selected
              </div>
              <Button onClick={saveSelectedTeams} disabled={saving || selectedTeamIds.size === 0}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Save Selected Teams
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
