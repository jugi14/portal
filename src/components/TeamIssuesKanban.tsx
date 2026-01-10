import React, { forwardRef, useImperativeHandle, useCallback } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { RefreshCw, Filter, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { KanbanBoardSkeleton } from './ui/skeleton-library';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { IssueDetailModal } from './IssueDetailModal';
import { useKanbanSettings } from '../hooks/useKanbanSettings';
import { KanbanColumnVisibilityPanel } from './KanbanColumnVisibilityPanel';
import { KanbanViewModeSelector, ViewMode } from './KanbanViewModeSelector';
import { useTeamIssuesData } from '../hooks/useTeamIssuesData';
import { useTeamIssuesDragDrop } from '../hooks/useTeamIssuesDragDrop';
import { useTeamIssueActions } from '../hooks/useTeamIssueActions';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionContext';
import { KanbanColumn } from './kanban/KanbanColumn';
import { LinearIssue, LinearState } from '../services/linearTeamIssuesService';
import { LinearHelpers } from '../services/linear';

interface TeamIssuesKanbanRef {
  refresh: () => Promise<void>;
}

interface TeamIssuesKanbanProps {
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
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  customEnabled?: boolean;
  onCustomToggle?: (enabled: boolean) => void;
  customWidth?: number;
  onCustomWidthChange?: (width: number) => void;
  viewModeEnabled?: boolean;
}

/**
 * Team Issues Kanban Board Component
 * 
 * Main kanban board for managing team issues with:
 * - Dynamic columns based on Linear workflow states
 * - Drag & drop for moving issues between states
 * - Column visibility and filtering settings
 * - Real-time synchronization with Linear API
 * - Sub-issue tracking and progress indicators
 */
export const TeamIssuesKanban = forwardRef<TeamIssuesKanbanRef, TeamIssuesKanbanProps>(
  (
    {
      teamId,
      customerId,
      onIssuesUpdate,
      onStatsUpdate,
      onError,
      viewMode = 'normal',
      onViewModeChange,
      customEnabled = false,
      onCustomToggle,
      customWidth = 280,
      onCustomWidthChange,
      viewModeEnabled = false,
    },
    ref
  ) => {
    const { session } = useAuth();
    const { userRole } = usePermissions();

    // Custom hooks for data, drag/drop, and actions
    const {
      issues,
      teamConfig,
      columns,
      issuesByState,
      loading,
      refreshing,
      error,
      currentTeamId,
      initializeKanban,
      refreshIssues,
      updateIssueInState,
      moveIssueOptimistically,
      revertIssueMove,
    } = useTeamIssuesData({ teamId, onIssuesUpdate, onError });

    const {
      syncingIssues,
      dragInProgress,
      handleDragStart,
      handleDragOver,
      handleDragLeave,
      handleDrop,
      clearAllDragStates,
    } = useTeamIssuesDragDrop({
      columns,
      currentTeamId,
      moveIssueOptimistically,
      revertIssueMove,
      refreshIssues,
      userRole,
    });

    const {
      selectedIssue,
      commentText,
      addingComment,
      handleApprove,
      handleRequestChanges,
      handleProvideInput,
      submitComment,
      setSelectedIssue,
      setCommentText,
    } = useTeamIssueActions({
      currentTeamId,
      refreshIssues,
    });

    // Kanban settings with backend persistence
    const {
      settings,
      columnConfigs,
      loading: settingsLoading,
      saving: settingsSaving,
      hasUnsavedChanges,
      toggleColumnVisibility,
      showAllColumns,
      hideAllColumns,
      toggleHideEmptyColumns,
      saveChanges,
    } = useKanbanSettings({
      teamId: currentTeamId || '',
      states: columns,
      issuesByState,
      onSettingsChange: (newSettings) => {
        // Settings updated
      },
    });

    // Issue detail modal state
    const [detailModalIssue, setDetailModalIssue] = React.useState<LinearIssue | null>(null);

    /**
     * Get visible columns based on user settings
     */
    const getVisibleColumns = useCallback((): LinearState[] => {
      if (!settings || settingsLoading) {
        return columns;
      }

      let visible = columns.filter((col) => settings.visibleColumns.includes(col.id));

      if (settings.hideEmptyColumns) {
        visible = visible.filter((col) => {
          const issueCount = issuesByState[col.id]?.length || 0;
          return issueCount > 0;
        });
      }

      visible.sort((a, b) => {
        const aIndex = settings.columnsOrder.indexOf(a.id);
        const bIndex = settings.columnsOrder.indexOf(b.id);
        return aIndex - bIndex;
      });

      return visible;
    }, [columns, issuesByState, settings, settingsLoading]);

    const visibleColumns = getVisibleColumns();

    /**
     * Handle issue update from detail modal
     */
    const handleIssueUpdate = useCallback(
      async (updatedIssue: LinearIssue) => {
        updateIssueInState(updatedIssue);
      },
      [updateIssueInState]
    );

    /**
     * Handle viewing issue details
     */
    const handleViewIssueDetails = useCallback((issue: LinearIssue) => {
      setDetailModalIssue(issue);
    }, []);

    // Listen for issue updates (approve, comment, sub-issue created, etc.)
    React.useEffect(() => {
      const handleIssueUpdated = async (event: Event) => {
        const customEvent = event as CustomEvent;
        const { issueId, teamId: eventTeamId, action } = customEvent.detail || {};
        
        console.log('[TeamIssuesKanban] Issue updated event:', {
          issueId,
          eventTeamId,
          currentTeamId,
          action
        });
        
        // CRITICAL FIX: Always reload on sub-issue creation
        // Don't check teamId because Linear team ID !== Database team UUID
        // This ensures board updates when sub-issues are created
        console.log('[TeamIssuesKanban] Refreshing board after issue update');
        await refreshIssues();
        
        // If modal is open, also update the modal issue data
        if (detailModalIssue && detailModalIssue.id === issueId) {
          // Find updated issue in refreshed data
          const updatedIssue = Object.values(issuesByState)
            .flat()
            .find(i => i.id === issueId);
          
          if (updatedIssue) {
            setDetailModalIssue(updatedIssue);
          }
        }
      };

      window.addEventListener('linear-issue-updated', handleIssueUpdated);
      
      return () => {
        window.removeEventListener('linear-issue-updated', handleIssueUpdated);
      };
    }, [currentTeamId, refreshIssues, detailModalIssue, issuesByState]);

    // Expose refresh method to parent
    useImperativeHandle(
      ref,
      () => ({
        refresh: refreshIssues,
      }),
      [refreshIssues]
    );

    // Loading state
    if ((loading && !issues.length && !error && !refreshing) || settingsLoading) {
      return (
        <div className="h-full">
          <KanbanBoardSkeleton columnCount={5} cardsPerColumn={3} />
        </div>
      );
    }

    // Error state
    if (error) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Failed to Load Issues</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={initializeKanban}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col">
        {/* Action Bar */}
        <div className="team-action-bar flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4 px-3 sm:px-4 py-3 rounded-lg border border-border bg-card sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">Issues Board</h2>
                {issues.length > 0 && (
                  <Badge variant="secondary" className="sm:hidden text-xs">
                    {issues.length}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {visibleColumns.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {visibleColumns.length} {visibleColumns.length === 1 ? 'column' : 'columns'}{' '}
                    visible
                  </span>
                )}
                {settings?.hideEmptyColumns && (
                  <>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      Auto-hiding empty
                    </span>
                    <span className="text-xs text-muted-foreground sm:hidden">Auto-hide</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {/* Total issues count (desktop only) */}
            {issues.length > 0 && (
              <div className="hidden sm:flex px-3 py-1.5 rounded-md bg-muted/50 border border-border">
                <span className="text-xs font-medium text-muted-foreground">Total Issues:</span>
                <span className="ml-1.5 text-sm font-semibold text-foreground">
                  {issues.length}
                </span>
              </div>
            )}

            {/* View Mode Selector */}
            {viewModeEnabled && onViewModeChange && onCustomToggle && (
              <KanbanViewModeSelector
                viewMode={viewMode}
                onViewModeChange={onViewModeChange}
                customEnabled={customEnabled}
                onCustomToggle={onCustomToggle}
                customWidth={customWidth}
                onCustomWidthChange={onCustomWidthChange}
              />
            )}

            {/* Refresh button */}
            <Button
              variant="outline"
              size="sm"
              onClick={refreshIssues}
              disabled={refreshing}
              className="flex-1 sm:flex-none"
            >
              <RefreshCw className={`h-4 w-4 sm:mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            {/* Column Visibility Panel */}
            {!settingsLoading && settings && columnConfigs.length > 0 ? (
              <KanbanColumnVisibilityPanel
                columns={columnConfigs}
                hideEmptyColumns={settings.hideEmptyColumns}
                onToggleColumn={toggleColumnVisibility}
                onShowAll={showAllColumns}
                onHideAll={hideAllColumns}
                onToggleHideEmpty={toggleHideEmptyColumns}
                onSave={async () => {
                  try {
                    await saveChanges();
                    toast.success('Settings saved successfully');
                  } catch (error) {
                    toast.error('Failed to save settings');
                    console.error('[TeamIssuesKanban] Save error:', error);
                  }
                }}
                saving={settingsSaving}
                hasUnsavedChanges={hasUnsavedChanges}
              />
            ) : (
              <Button variant="outline" size="sm" disabled={true} className="gap-2">
                <Filter className="h-4 w-4" />
                Columns
                {settingsLoading && <RefreshCw className="h-3 w-3 ml-1 animate-spin" />}
              </Button>
            )}
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex gap-6 overflow-x-auto pb-6 flex-1 min-h-0">
          {visibleColumns.length > 0 ? (
            visibleColumns.map((state) => (
              <KanbanColumn
                key={state.id}
                state={state}
                issues={issuesByState[state.id] || []}
                syncingIssues={syncingIssues}
                dragInProgress={dragInProgress}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onViewDetails={handleViewIssueDetails}
              />
            ))
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No columns visible</p>
                <p className="text-sm">Use the Columns menu to show columns</p>
              </div>
            </div>
          )}
        </div>

        {/* Comment Dialog */}
        <Dialog open={!!selectedIssue} onOpenChange={() => setSelectedIssue(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Provide Input</DialogTitle>
              <DialogDescription>
                Provide feedback for this issue that needs input
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedIssue && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{selectedIssue.identifier}</Badge>
                    <Badge className="text-xs bg-orange-500 text-white">Needs Input</Badge>
                  </div>
                  <h4 className="font-medium">{selectedIssue.title}</h4>
                  {selectedIssue.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {LinearHelpers.stripMetadataFromDescription(selectedIssue.description)}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="comment">Your input or feedback</Label>
                <Textarea
                  id="comment"
                  placeholder="Provide additional information, clarification, or feedback..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedIssue(null)}>
                  Cancel
                </Button>
                <Button onClick={submitComment} disabled={!commentText.trim() || addingComment}>
                  {addingComment && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Submit Input
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Issue Detail Modal */}
        <IssueDetailModal
          issue={detailModalIssue}
          isOpen={!!detailModalIssue}
          onClose={() => setDetailModalIssue(null)}
          onIssueUpdate={handleIssueUpdate}
          onIssueClick={(issue) => {
            setDetailModalIssue(issue);
          }}
          showAcceptanceIssues={true}
        />
      </div>
    );
  }
);

TeamIssuesKanban.displayName = 'TeamIssuesKanban';