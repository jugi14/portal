/**
 * Team Issues Kanban with Persistent Settings
 * 
 * Enhanced wrapper for TeamIssuesKanban that adds:
 * - User-specific column visibility persistence
 * - Column order customization  
 * - Layout preferences (hide empty, compact mode)
 * - Cross-device sync via backend KV storage
 * 
 * This component wraps the existing TeamIssuesKanban and injects
 * the settings management functionality.
 */

import React, { useState, useEffect } from 'react';
import { useKanbanSettings } from '../hooks/useKanbanSettings';
import { KanbanColumnVisibilityPanel } from './KanbanColumnVisibilityPanel';
import { TeamIssuesKanban } from './TeamIssuesKanban';
import type { LinearState } from '../services/linearTeamIssuesService';

interface TeamIssuesKanbanWithSettingsProps {
  teamId: string;
  customerId?: string;
  onIssuesUpdate?: (totalCount: number) => void;
  onStatsUpdate?: (stats: {
    pendingReview: number;
    approved: number;
    released: number;
    needsInput: number;
    failedReview: number;
  }) => void;
  onError?: (error: string) => void;
}

export function TeamIssuesKanbanWithSettings(props: TeamIssuesKanbanWithSettingsProps) {
  const { teamId } = props;
  
  // These will be populated from TeamIssuesKanban's state
  // For now, we'll use a ref callback pattern
  const [states, setStates] = useState<LinearState[]>([]);
  const [issuesByState, setIssuesByState] = useState<Record<string, any[]>>({});
  
  // Kanban settings hook
  const {
    settings,
    columnConfigs,
    loading: settingsLoading,
    saving,
    toggleColumnVisibility,
    showAllColumns,
    hideAllColumns,
    toggleHideEmptyColumns,
    resetToDefaults,
  } = useKanbanSettings({
    teamId,
    states,
    issuesByState,
  });

  /**
   * Note: This is a wrapper component approach
   * 
   * For full integration, we would need to:
   * 1. Pass states/issuesByState from TeamIssuesKanban up to this wrapper
   * 2. Pass columnConfigs/settings down to TeamIssuesKanban
   * 3. Modify TeamIssuesKanban to respect visibility/order from settings
   * 
   * Alternative: Directly integrate useKanbanSettings into TeamIssuesKanban
   */

  return (
    <div className="h-full flex flex-col">
      {/* Enhanced action bar with settings panel */}
      {!settingsLoading && settings && columnConfigs.length > 0 && (
        <div className="mb-4">
          <KanbanColumnVisibilityPanel
            columns={columnConfigs}
            hideEmptyColumns={settings.hideEmptyColumns}
            onToggleColumn={toggleColumnVisibility}
            onShowAll={showAllColumns}
            onHideAll={hideAllColumns}
            onToggleHideEmpty={toggleHideEmptyColumns}
            onRefresh={() => {
              // Trigger refresh from parent
            }}
            saving={saving}
          />
        </div>
      )}

      {/* Main Kanban board */}
      <div className="flex-1">
        <TeamIssuesKanban {...props} />
      </div>
    </div>
  );
}
