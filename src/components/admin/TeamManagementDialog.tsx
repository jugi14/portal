import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Users,
  Save,
  X,
  AlertCircle,
  Zap,
  Info,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { adminService } from '../../services/adminService';

interface Team {
  id: string;
  organization_id: string;
  name: string;
  key: string;
  description?: string;
  linear_team_id?: string;
  linear_sync_enabled: boolean;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

interface TeamManagementDialogProps {
  team: Team | null;
  organizationId: string;
  organizationName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TeamManagementDialog({
  team,
  organizationId,
  organizationName,
  open,
  onOpenChange,
  onSuccess,
}: TeamManagementDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    key: '',
    description: '',
    linear_team_id: '',
    linear_sync_enabled: false,
    status: 'active' as 'active' | 'inactive',
  });

  // Load team data when editing
  useEffect(() => {
    if (team) {
      setFormData({
        name: team.name || '',
        key: team.key || '',
        description: team.description || '',
        linear_team_id: team.linear_team_id || '',
        linear_sync_enabled: team.linear_sync_enabled || false,
        status: team.status || 'active',
      });
    } else {
      // Reset for new team
      setFormData({
        name: '',
        key: '',
        description: '',
        linear_team_id: '',
        linear_sync_enabled: false,
        status: 'active',
      });
    }
  }, [team, open]);

  const handleSave = async () => {
    if (!formData.name || !formData.key) {
      toast.error('Team name and key are required');
      return;
    }

    setIsSaving(true);
    try {
      let result;
      
      if (team) {
        // Update existing team
        result = await adminService.updateTeam(organizationId, team.id, {
          name: formData.name,
          description: formData.description,
          linear_team_id: formData.linear_team_id || undefined,
          linear_sync_enabled: formData.linear_sync_enabled,
          status: formData.status,
        });
      } else {
        // Create new team
        result = await adminService.createTeam(organizationId, {
          name: formData.name,
          key: formData.key.toUpperCase(),
          description: formData.description,
          linear_team_id: formData.linear_team_id || undefined,
          linear_sync_enabled: formData.linear_sync_enabled,
        });
      }

      if (result.success) {
        toast.success(team ? 'Team updated successfully' : 'Team created successfully');
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(result.error || 'Failed to save team');
      }
    } catch (error) {
      console.error('Error saving team:', error);
      toast.error('Failed to save team');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>{team ? 'Edit Team' : 'Create New Team'}</DialogTitle>
              <DialogDescription>
                {team ? `Update team in ${organizationName}` : `Add a new team to ${organizationName}`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Team Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Guillevin Digital"
                  disabled={isSaving}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="key">Team Key *</Label>
                <Input
                  id="key"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value.toUpperCase() })}
                  placeholder="e.g., GD"
                  maxLength={4}
                  disabled={isSaving || !!team}
                  className="uppercase"
                />
                {!team && (
                  <p className="text-xs text-muted-foreground">
                    Short identifier (2-4 letters, cannot be changed later)
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Electrical Distribution Platform"
                rows={2}
                disabled={isSaving}
              />
            </div>
          </div>

          {/* Linear Integration */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-600" />
                <Label>Linear Integration (Optional)</Label>
              </div>
              <Switch
                checked={formData.linear_sync_enabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, linear_sync_enabled: checked })
                }
                disabled={isSaving}
              />
            </div>

            {formData.linear_sync_enabled && (
              <div className="space-y-2 pt-2">
                <Label htmlFor="linear_team_id">Linear Team ID</Label>
                <Input
                  id="linear_team_id"
                  value={formData.linear_team_id}
                  onChange={(e) =>
                    setFormData({ ...formData, linear_team_id: e.target.value })
                  }
                  placeholder="e.g., team_abc123..."
                  disabled={isSaving}
                />
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Enable this to sync issues with Linear. You'll need the Linear team ID from your
                    Linear workspace.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>

          {/* Status (only when editing) */}
          {team && (
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-0.5">
                <Label>Team Status</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive teams are hidden from issue assignment
                </p>
              </div>
              <Badge variant={formData.status === 'active' ? 'default' : 'secondary'}>
                {formData.status}
              </Badge>
            </div>
          )}

          {/* Validation Alert */}
          {(!formData.name || !formData.key) && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Team name and key are required fields
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !formData.name || !formData.key}
          >
            {isSaving ? (
              <>
                <div className="h-4 w-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {team ? 'Update Team' : 'Create Team'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
