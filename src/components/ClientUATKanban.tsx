/**
 * Client UAT Kanban - User Acceptance Testing Board
 * 
 * Complete 5-column UAT workflow:
 * - Pending Review: Tasks ready for client review
 * - Blocked/Needs Input: Tasks waiting for information or client feedback
 * - Approved: Approved and completed tasks
 * - Released: Shipped to production
 * - Archived: Rejected/failed/duplicate (reference-only)
 * - Canceled: Explicitly canceled issues
 * 
 * Logic is separated into modules:
 * - utils/clientTasksMapping.ts: Mapping logic
 * - hooks/useClientTaskActions.ts: Action handlers
 * - components/ClientTaskCard.tsx: Task card UI
 * - components/ClientKanbanColumn.tsx: Column UI
 * 
 * Note: Drag & drop disabled - tasks move via approve/reject buttons to enforce review workflow
 * 
 * Follows principles: KISS, DRY, Single Responsibility
 */

import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { EditorContent } from '@tiptap/react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Label } from './ui/label';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Loader2,
  Filter,
  XCircle,
  Ban,
  FileText,
  Circle,
  GitBranch,
  AlertTriangle,
  MessageSquare,
  Paperclip,
  X,
  Bold,
  Italic,
  List,
  ListOrdered,
  Code,
  Heading2,
  Rocket,
} from 'lucide-react';
import { toast } from 'sonner';
import { MobileUATView } from './MobileUATView';

// Import business logic từ các module đã tách
import {
  CLIENT_COLUMNS,
  ClientColumn,
  mapStateToClientColumn,
  logDistributionReport,
} from '../utils/clientTasksMapping';
import { useClientTaskActions } from '../hooks/useClientTaskActions';
import { ClientKanbanColumn } from './ClientKanbanColumn';

import {
  LinearIssue,
  LinearTeam,
  LinearState,
  LinearMutations,
} from '../services/linearTeamIssuesService';
import { linearTeamConfigService } from '../services/linearTeamConfigService';
import { apiClient } from '../services/apiClient';
import { globalCache } from '../services/cacheService';
import { useAuth } from '../contexts/AuthContext';
import { IssueDetailModal } from './IssueDetailModal';
import { IssueCreationTemplate } from './IssueCreationTemplate';
import { CreateAcceptanceIssueModal } from './CreateAcceptanceIssueModal';
import { KanbanColumnVisibilityPanel } from './KanbanColumnVisibilityPanel';
import { useClientTasksSettings } from '../hooks/useClientTasksSettings';
import { KanbanViewModeSelector } from './KanbanViewModeSelector';
import { useIssueHierarchyCounter } from '../hooks/useIssueHierarchyCounter';
import { HierarchyStatsSummary } from './IssueHierarchyIndicator';
import { CompactHierarchyStats } from './HierarchyStatsPanel';

interface ClientTasksKanbanRef {
  refresh: () => Promise<void>;
}

// Extended LinearIssue with original sub-issue count
interface ClientLinearIssue extends LinearIssue {
  _originalSubIssueCount?: number;
}

interface ClientTasksKanbanProps {
  teamId: string;
  customerId?: string;
  onIssuesUpdate?: (totalCount: number) => void;
  onTasksUpdate?: (totalCount: number) => void;
  onError?: (error: string) => void;
  
  // View Mode Control
  viewMode?: 'compact' | 'normal' | 'wide';
  onViewModeChange?: (mode: 'compact' | 'normal' | 'wide') => void;
  customEnabled?: boolean;
  onCustomToggle?: (enabled: boolean) => void;
  customWidth?: number;
  onCustomWidthChange?: (width: number) => void;
  viewModeEnabled?: boolean;
}

export const ClientUATKanban = forwardRef<ClientTasksKanbanRef, ClientTasksKanbanProps>(
  ({ 
    teamId, 
    customerId, 
    onIssuesUpdate, 
    onTasksUpdate,
    onError,
    viewMode = 'normal',
    onViewModeChange,
    customEnabled = false,
    onCustomToggle,
    customWidth = 280,
    onCustomWidthChange,
    viewModeEnabled = false,
  }, ref) => {
    const { session } = useAuth();
    const [issues, setIssues] = useState<ClientLinearIssue[]>([]);
    const [teamConfig, setTeamConfig] = useState<LinearTeam | null>(null);
    const [columns, setColumns] = useState<LinearState[]>([]);
    const [issuesByColumn, setIssuesByColumn] = useState<Record<ClientColumn, ClientLinearIssue[]>>({
      'client-review': [],
      'blocked': [],
      'done': [],
      'released': [],
      'archived': [],
      'canceled': [],
    });
    
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [detailModalIssue, setDetailModalIssue] = useState<LinearIssue | null>(null);
    const [showAcceptanceModal, setShowAcceptanceModal] = useState(false);
    const [activeUATCycle, setActiveUATCycle] = useState<{ id: string; name: string } | undefined>(undefined);
    
    // Comprehensive Counter State
    const [counters, setCounters] = useState<{
      totalParents: number;
      totalSubIssues: number;
      totalItems: number;
      byColumn: Record<ClientColumn, {
        parents: number;
        subIssues: number;
        total: number;
      }>;
    }>({
      totalParents: 0,
      totalSubIssues: 0,
      totalItems: 0,
      byColumn: {
        'client-review': { parents: 0, subIssues: 0, total: 0 },
        'blocked': { parents: 0, subIssues: 0, total: 0 },
        'done': { parents: 0, subIssues: 0, total: 0 },
        'released': { parents: 0, subIssues: 0, total: 0 },
        'archived': { parents: 0, subIssues: 0, total: 0 },
        'canceled': { parents: 0, subIssues: 0, total: 0 },
      }
    });

    // Load team data
    const loadTeamData = useCallback(async (forceRefresh = false) => {
      // Validate teamId
      if (!teamId || typeof teamId !== 'string') {
        const error = 'Invalid team ID';
        console.error('[ClientUATKanban] Invalid teamId:', teamId);
        setError(error);
        setLoading(false);
        if (onError) onError(error);
        return;
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(teamId)) {
        const error = `Invalid team ID format: ${teamId}`;
        console.error('[ClientUATKanban] Invalid UUID format:', teamId);
        setError(error);
        setLoading(false);
        if (onError) onError(error);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        console.log('[ClientUATKanban] Loading team data for:', teamId, forceRefresh ? '(FORCE REFRESH)' : '(cached OK)');

        // Load team configuration with force refresh flag
        const config = await linearTeamConfigService.getTeamConfig(teamId, forceRefresh);
        if (!config) {
          throw new Error('Failed to load team configuration');
        }
        setTeamConfig(config);
        setColumns(config.states);

        // Load issues using by-state endpoint
        const response = await apiClient.get(`/linear/teams/${teamId}/issues-by-state`);
        
        if (!response.success || !response.data) {
          if (response.error && response.error.includes('not found in Linear workspace')) {
            throw new Error('Team not found in Linear. It may have been deleted or you don\'t have access.');
          }
          throw new Error(response.error || 'Failed to load team issues');
        }
        
        const allIssues = response.data.states.flatMap((s: any) => s.issues || []);
        
        // CRITICAL: Backend SHOULD already return only root/parent issues
        // This filter is a safety check - it should NOT filter anything if backend works correctly
        const parentOnlyIssues = allIssues.filter((issue: LinearIssue) => {
          // Only show issues WITHOUT parent (root/parent issues)
          const hasNoParent = !issue.parent?.id;
          return hasNoParent;
        });
        
        const filteredCount = allIssues.length - parentOnlyIssues.length;
        if (filteredCount > 0) {
          console.log(`[ClientUATMapping] Loaded ${allIssues.length} issues, filtered to ${parentOnlyIssues.length} parent issues (hiding ${filteredCount} sub-issues)`);
        }
        
        // Show ALL parent issues (no label filtering)
        const clientIssues = parentOnlyIssues;
        console.log(`[ClientUATKanban] Showing all ${clientIssues.length} parent issues`);
        
        // Map issues with preserved metadata from backend
        const filteredIssues: ClientLinearIssue[] = clientIssues.map((issue: LinearIssue): ClientLinearIssue => {
          // CRITICAL: Preserve _originalSubIssueCount from backend (true count from Linear API)
          // This is the REAL number of direct children, regardless of state
          const originalSubIssueCount = (issue as any)._originalSubIssueCount ?? issue.subIssues?.length ?? 0;
          
          // Show all sub-issues (no filtering)
          const allSubIssues = issue.subIssues || [];
          
          // Preserve hierarchy breakdown from backend, or create default
          let hierarchyBreakdown;
          if ((issue as any)._hierarchyBreakdown) {
            // Use backend breakdown (accurate count across all states)
            hierarchyBreakdown = (issue as any)._hierarchyBreakdown;
          } else {
            // Fallback: Create minimal breakdown
            hierarchyBreakdown = {
              level1: allSubIssues.length,
              level2: 0,
              level3Plus: 0,
              byState: {} as Record<string, number>,
              total: allSubIssues.length,
            };
          }
          
          // Return issue with PRESERVED _originalSubIssueCount from backend
          // This ensures kanban cards show correct sub-issue count
          return {
            ...issue,
            subIssues: allSubIssues,
            _originalSubIssueCount: originalSubIssueCount, // PRESERVE from backend
            _hierarchyBreakdown: hierarchyBreakdown, // PRESERVE from backend
          };
        });
        
        console.log(`[ClientUATMapping] Showing ${filteredIssues.length} parent issues with all sub-issues`);
        setIssues(filteredIssues);

        // Group issues by client column (STRICT MATCHING - no fallback)
        const grouped: Record<ClientColumn, LinearIssue[]> = {
          'client-review': [],
          'blocked': [],
          'done': [],
          'released': [],
          'archived': [],
          'canceled': [],
        };

        // Initialize counters
        let totalSubIssues = 0;
        let skippedIssuesCount = 0;
        const columnCounts: typeof counters.byColumn = {
          'client-review': { parents: 0, subIssues: 0, total: 0 },
          'blocked': { parents: 0, subIssues: 0, total: 0 },
          'done': { parents: 0, subIssues: 0, total: 0 },
          'released': { parents: 0, subIssues: 0, total: 0 },
          'archived': { parents: 0, subIssues: 0, total: 0 },
          'canceled': { parents: 0, subIssues: 0, total: 0 },
        };
        
        filteredIssues.forEach((issue: ClientLinearIssue) => {
          const column = mapStateToClientColumn(issue.state);
          
          // STRICT: Skip issues that don't match any column rule
          if (column === null) {
            skippedIssuesCount++;
            return;
          }
          
          grouped[column].push(issue);
          
          // Count parent
          columnCounts[column].parents += 1;
          
          // Count filtered sub-issues (already filtered by client labels)
          const filteredSubCount = issue._originalSubIssueCount || 0;
          if (filteredSubCount > 0) {
            totalSubIssues += filteredSubCount;
            columnCounts[column].subIssues += filteredSubCount;
          }
          
          // Total = parents + filtered sub-issues
          columnCounts[column].total = columnCounts[column].parents + columnCounts[column].subIssues;
        });

        setIssuesByColumn(grouped);
        setCounters({
          totalParents: filteredIssues.length,
          totalSubIssues: totalSubIssues,
          totalItems: filteredIssues.length + totalSubIssues,
          byColumn: columnCounts
        });

        // Log distribution
        logDistributionReport(grouped);

        setLoading(false);
      } catch (err) {
        console.error('[ClientUATKanban] Load error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load tasks';
        setError(errorMessage);
        if (onError) onError(errorMessage);
        setLoading(false);
      }
    }, [teamId, onError]);

    // Initialize on mount
    useEffect(() => {
      loadTeamData();
    }, [loadTeamData]);
    
    // Listen for global issue updates
    useEffect(() => {
      const handleIssueUpdate = (event: CustomEvent) => {
        const { issueId, teamId: updatedTeamId, action } = event.detail;
        
        // CRITICAL FIX: Always reload on sub-issue creation
        // Don't check teamId because Linear team ID !== Database team UUID
        // This ensures board updates when sub-issues are created
        console.log(`[ClientUATKanban] Received ${action} event for issue ${issueId}, reloading...`);
        loadTeamData();
      };
      
      window.addEventListener('linear-issue-updated', handleIssueUpdate as EventListener);
      return () => {
        window.removeEventListener('linear-issue-updated', handleIssueUpdate as EventListener);
      };
    }, [teamId, loadTeamData]);

    // Refresh function
    const refreshIssues = useCallback(async () => {
      setRefreshing(true);
      try {
        // CRITICAL: Clear all cache for this team before reloading
        console.log('[ClientUATKanban] Clearing cache for team:', teamId);
        globalCache.invalidatePattern(`team-config:${teamId}`);
        globalCache.invalidatePattern(`team:${teamId}`);
        globalCache.invalidatePattern(`issues:${teamId}`);
        
        // Reload data with fresh API calls
        await loadTeamData(true);
        toast.success('Tasks refreshed successfully');
      } catch (err) {
        toast.error('Failed to refresh tasks');
      } finally {
        setRefreshing(false);
      }
    }, [teamId, loadTeamData]);
    
    // OPTIMIZED: Update single issue without full reload
    const handleIssueUpdate = useCallback((updatedIssue: LinearIssue) => {
      console.log('[ClientUATKanban] Optimized update for:', updatedIssue.identifier);
      
      // Update in local state without API call
      setIssues(prevIssues => 
        prevIssues.map(issue => 
          issue.id === updatedIssue.id ? { ...issue, ...updatedIssue } : issue
        )
      );
      
      // Update in issuesByColumn
      setIssuesByColumn(prevColumns => {
        const newColumns = { ...prevColumns };
        
        // Find and update issue in correct column
        Object.keys(newColumns).forEach(colKey => {
          const column = colKey as ClientColumn;
          newColumns[column] = newColumns[column].map(issue =>
            issue.id === updatedIssue.id ? { ...issue, ...updatedIssue } : issue
          );
        });
        
        return newColumns;
      });
      
      // If modal is showing this issue, update modal state
      if (detailModalIssue?.id === updatedIssue.id) {
        setDetailModalIssue(updatedIssue);
      }
    }, [detailModalIssue]);

    // Expose refresh method via ref
    useImperativeHandle(ref, () => ({
      refresh: refreshIssues,
    }));

    // Use refactored hooks
    const {
      handleApprove,
      handleRequestChanges,
      requestChangesIssue,
      requestChangesEditor,
      requestChangesFiles,
      isRequestingChanges,
      handleRequestChangesFileSelect,
      handleRequestChangesRemoveFile,
      handleSubmitRequestChanges,
      handleCancelRequestChanges,
      handleAddIssue,
      submitIssueModal,
      handleCloseSubmitIssueModal,
      handleSubmitIssue,
      creatingIssue,
    } = useClientTaskActions({
      teamId: teamId || '',
      columns,
      onRefresh: refreshIssues,
    });
    
    // Handler to open Acceptance Issue Modal for group tasks
    const handleCreateGroupTask = useCallback(() => {
      setShowAcceptanceModal(true);
    }, []);

    // Handler to create acceptance issue with UAT + Acceptance labels
    const handleCreateAcceptanceIssue = useCallback(async (issueData: any) => {
      try {
        if (!teamConfig) {
          toast.error('Team configuration not loaded');
          return;
        }

        // Find or create UAT and Acceptance labels
        const uatLabel = teamConfig.labels?.find((l: any) => l.name === 'UAT');
        const acceptanceLabel = teamConfig.labels?.find((l: any) => l.name === 'Acceptance');
        
        const labelIds: string[] = [];
        if (uatLabel) labelIds.push(uatLabel.id);
        if (acceptanceLabel) labelIds.push(acceptanceLabel.id);

        // Find Client Review state
        const clientReviewState = columns.find(s => s.name === 'Client Review');
        if (!clientReviewState) {
          toast.error('Client Review state not found');
          return;
        }

        // Create issue with labels and in Client Review state
        const createParams = {
          teamId: teamId || '',
          title: issueData.title,
          description: issueData.description,
          priority: issueData.priority,
          stateId: clientReviewState.id,
          labelIds: labelIds.length > 0 ? labelIds : undefined,
          cycleId: activeUATCycle?.id || issueData.cycleId,
        };

        console.log('[ClientUATKanban] Creating acceptance issue:', createParams);

        // Use LinearMutations to create issue (now static import)
        const newIssue = await LinearMutations.createIssue(createParams);

        console.log('[ClientUATKanban] Acceptance issue created:', newIssue.identifier);

        // Upload pasted images and update description with image URLs
        if (issueData.pastedImages && issueData.pastedImages.length > 0) {
          try {
            console.log('[ClientUATKanban] Uploading pasted images to content:', issueData.pastedImages.length);
            
            const uploadResult = await LinearMutations.uploadFilesToIssue(newIssue.id, issueData.pastedImages);
            
            if (uploadResult?.attachments?.length > 0) {
              // Build markdown with image URLs
              const imageMarkdown = uploadResult.attachments.map((att: any) => {
                const fileName = att.title || att.filename || 'Image';
                const fileUrl = att.url;
                return `![${fileName}](${fileUrl})`;
              }).join('\n\n');
              
              // Update description with images
              const updatedDescription = issueData.description + '\n\n' + imageMarkdown;
              
              await LinearMutations.updateIssue({
                issueId: newIssue.id,
                description: updatedDescription 
              });
              
              console.log('[ClientUATKanban] Description updated with', uploadResult.attachments.length, 'images');
            }
          } catch (imageError) {
            console.error('[ClientUATKanban] Failed to upload pasted images:', imageError);
            toast.warning('Issue created but pasted images failed to upload');
          }
        }
        
        // Upload manual file attachments
        if (issueData.files && issueData.files.length > 0) {
          try {
            await LinearMutations.uploadFilesToIssue(newIssue.id, issueData.files);
            toast.success(`Acceptance issue created with ${issueData.files.length} attachment(s)!`);
          } catch (uploadError) {
            console.error('[ClientUATKanban] Upload failed:', uploadError);
            toast.warning('Issue created but attachments failed to upload');
          }
        } else {
          toast.success('Acceptance issue created successfully!');
        }

        // Refresh issues to show new issue
        await refreshIssues();
      } catch (error) {
        console.error('[ClientUATKanban] Failed to create acceptance issue:', error);
        toast.error('Failed to create acceptance issue');
        throw error;
      }
    }, [teamConfig, columns, teamId, activeUATCycle, refreshIssues]);

    // Client Tasks Settings
    const clientColumnIds = CLIENT_COLUMNS.map(c => c.id);
    
    const handleSettingsChange = useCallback((newSettings: any) => {
      const visibleCols = newSettings.visibleColumns;
      
      // Calculate total count including sub-issues
      const visibleTasksCount = visibleCols.reduce((sum: number, colId: string) => {
        const columnCounters = counters.byColumn[colId as ClientColumn];
        return sum + (columnCounters?.total || 0);
      }, 0);
      
      if (onTasksUpdate) onTasksUpdate(visibleTasksCount);
      if (onIssuesUpdate) onIssuesUpdate(visibleTasksCount);
    }, [issuesByColumn, counters, onTasksUpdate, onIssuesUpdate]);
    
    const {
      settings: tasksSettings,
      columnConfigs: tasksColumnConfigs,
      loading: settingsLoading,
      saving: settingsSaving,
      hasUnsavedChanges,
      toggleColumnVisibility,
      showAllColumns,
      hideAllColumns,
      toggleHideEmptyColumns,
      toggleFilterByLabel,
      saveChanges,
      getVisibleColumns,
    } = useClientTasksSettings({
      teamId: teamId || '',
      columns: clientColumnIds,
      issuesByColumn,
      onSettingsChange: handleSettingsChange,
    });
    
    // Compute hierarchy statistics
    const hierarchyStats = useIssueHierarchyCounter({
      issuesByColumn: issuesByColumn as Record<string, LinearIssue[]>,
      visibleColumns: tasksSettings?.visibleColumns || clientColumnIds,
      includeFiltered: true,
    });

    // Loading state
    if (loading || settingsLoading) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">
              {loading ? 'Loading UAT tasks...' : 'Loading settings...'}
            </p>
          </div>
        </div>
      );
    }

    // Error state
    if (error) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <XCircle className="h-12 w-12 text-red-500 mx-auto" />
            <div>
              <h3 className="font-semibold mb-2">Failed to Load UAT Tasks</h3>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={loadTeamData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Get visible columns
    const visibleColumnIds = getVisibleColumns();
    const visibleColumns = CLIENT_COLUMNS.filter(col => visibleColumnIds.includes(col.id));
    
    // Calculate total visible tasks (parents + sub-issues)
    const totalVisibleTasks = visibleColumns.reduce((sum, column) => {
      const columnCounters = counters.byColumn[column.id];
      return sum + (columnCounters?.total || 0);
    }, 0);

    // Prepare data for mobile view - always prepare to avoid conditional hooks
    const mobileColumns = CLIENT_COLUMNS.map(col => ({
      ...col,
      tasks: (issuesByColumn[col.id] || []).map(issue => ({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        state: issue.state,
        labels: issue.labels || { nodes: [] }, // Ensure labels is connection object
        assigneeNames: issue.assignees?.nodes?.map(a => a.name) || [],
        subIssueCount: issue._originalSubIssueCount || 0,
        createdAt: issue.createdAt,
      }))
    }));

    return (
      <div className="h-full flex flex-col">
        {/* Action Bar - Desktop only via CSS */}
        <div className="hidden md:block team-action-bar mb-4 px-3 sm:px-4 py-3 rounded-lg border border-border bg-card sticky top-0 z-10 shadow-sm">
          {/* Row 1: Title + Main Actions */}
          <div className="flex items-center justify-between gap-3 mb-3">
            {/* Left: Title + Badge */}
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-base font-semibold text-foreground">
                UAT Board
              </h2>
              {totalVisibleTasks > 0 && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  {totalVisibleTasks}
                </Badge>
              )}
            </div>

            {/* Right: Primary Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Refresh button */}
              <Button
                variant="outline"
                size="sm"
                onClick={refreshIssues}
                disabled={refreshing}
                className="hidden sm:flex"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
              
              {/* Mobile refresh (icon only) */}
              <Button
                variant="outline"
                size="sm"
                onClick={refreshIssues}
                disabled={refreshing}
                className="sm:hidden"
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                />
              </Button>

              {/* Column Visibility Panel */}
              {!settingsLoading && tasksSettings && tasksColumnConfigs.length > 0 ? (
                <KanbanColumnVisibilityPanel
                  columns={tasksColumnConfigs}
                  hideEmptyColumns={tasksSettings.hideEmptyColumns}
                  filterByLabel={tasksSettings.filterByLabel}
                  onToggleColumn={toggleColumnVisibility}
                  onShowAll={showAllColumns}
                  onHideAll={hideAllColumns}
                  onToggleHideEmpty={toggleHideEmptyColumns}
                  onSave={async () => {
                    try {
                      await saveChanges();
                      toast.success('UAT settings saved');
                    } catch (error) {
                      toast.error('Failed to save settings');
                    }
                  }}
                  saving={settingsSaving}
                  hasUnsavedChanges={hasUnsavedChanges}
                  viewMode={viewMode}
                  onViewModeChange={onViewModeChange}
                  customEnabled={customEnabled}
                  onCustomToggle={onCustomToggle}
                  customWidth={customWidth}
                  onCustomWidthChange={onCustomWidthChange}
                />
              ) : null}
            </div>
          </div>
        </div>

        {/* Main Content - Mobile View or Desktop Kanban */}
        {/* Always render both to avoid conditional hook calls, hide with CSS */}
        <div className="md:hidden">
          <MobileUATView
            columns={mobileColumns}
            tasks={mobileColumns.flatMap(c => c.tasks)}
            onTaskClick={(task) => {
              const fullIssue = issues.find(i => i.id === task.id);
              if (fullIssue) setDetailModalIssue(fullIssue);
            }}
          />
        </div>

        <div 
          className="md:flex hidden gap-4 overflow-x-auto pb-4 flex-1"
          style={{
            '--kanban-column-width': customEnabled ? `${customWidth}px` : 
              viewMode === 'compact' ? '260px' :
              viewMode === 'wide' ? '380px' : '320px'
          } as React.CSSProperties}
        >
          {visibleColumns.length > 0 ? (
            visibleColumns.map((column) => (
              <ClientKanbanColumn
                key={column.id}
                column={column}
                issues={issuesByColumn[column.id]}
                counters={counters.byColumn[column.id]}
                viewMode={viewMode}
                customEnabled={customEnabled}
                customWidth={customWidth}
                onViewDetails={setDetailModalIssue}
                onRequestChanges={handleRequestChanges}
                onAddIssue={handleAddIssue}
                onCreateGroupTask={handleCreateGroupTask}
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

        {/* Issue Detail Modal */}
        <IssueDetailModal
          issue={detailModalIssue}
          isOpen={!!detailModalIssue}
          onClose={() => setDetailModalIssue(null)}
          onIssueUpdate={handleIssueUpdate}
          onIssueClick={(issue) => setDetailModalIssue(issue)}
          forceEnableComments={true}
          showAcceptanceIssues={true}
        />

        {/* Issue Creation Template Modal */}
        <IssueCreationTemplate
          isOpen={submitIssueModal.isOpen}
          onClose={handleCloseSubmitIssueModal}
          onSubmit={handleSubmitIssue}
          teamId={teamId}
          workflowStates={(() => {
            // CRITICAL: Only pass UAT workflow states, sorted in correct order
            // "Client Review" MUST be first for proper default state
            const uatStateNames = ['Client Review', 'Client Blocked', 'Release Ready', 'Shipped', 'Canceled'];
            const filteredStates = columns.filter(state => uatStateNames.includes(state.name));
            
            // Sort to ensure Client Review is first
            return filteredStates.sort((a, b) => {
              const indexA = uatStateNames.indexOf(a.name);
              const indexB = uatStateNames.indexOf(b.name);
              return indexA - indexB;
            });
          })()}
          teamMembers={teamConfig?.members || []}
        />

        {/* Create Acceptance Issue Modal - For Group Tasks */}
        <CreateAcceptanceIssueModal
          isOpen={showAcceptanceModal}
          onClose={() => setShowAcceptanceModal(false)}
          onSubmit={handleCreateAcceptanceIssue}
          teamId={teamId || ''}
          activeUATCycle={activeUATCycle}
        />

        {/* Request Changes Dialog */}
        <Dialog 
          open={!!requestChangesIssue} 
          onOpenChange={(open) => {
            if (!open) handleCancelRequestChanges();
          }}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="px-6 py-4 border-b border-border">
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Request Changes - {requestChangesIssue?.identifier}
              </DialogTitle>
              <DialogDescription>
                Describe what changes are needed. A comment will be added and the task moved back to To Do.
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Markdown Editor */}
              <div className="space-y-2">
                <Label htmlFor="request-changes-editor">
                  Changes Needed <span className="text-destructive">*</span>
                </Label>
                
                {/* Toolbar */}
                <div className="flex items-center gap-1 p-2 border border-border rounded-t-lg bg-muted/30">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => requestChangesEditor?.chain().focus().toggleBold().run()}
                    disabled={!requestChangesEditor || isRequestingChanges}
                    className={`h-8 w-8 p-0 ${requestChangesEditor?.isActive('bold') ? 'bg-primary/10 text-primary' : ''}`}
                  >
                    <Bold className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => requestChangesEditor?.chain().focus().toggleItalic().run()}
                    disabled={!requestChangesEditor || isRequestingChanges}
                    className={`h-8 w-8 p-0 ${requestChangesEditor?.isActive('italic') ? 'bg-primary/10 text-primary' : ''}`}
                  >
                    <Italic className="h-4 w-4" />
                  </Button>
                  <div className="w-px h-6 bg-border mx-1" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => requestChangesEditor?.chain().focus().toggleHeading({ level: 2 }).run()}
                    disabled={!requestChangesEditor || isRequestingChanges}
                    className={`h-8 w-8 p-0 ${requestChangesEditor?.isActive('heading', { level: 2 }) ? 'bg-primary/10 text-primary' : ''}`}
                  >
                    <Heading2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => requestChangesEditor?.chain().focus().toggleBulletList().run()}
                    disabled={!requestChangesEditor || isRequestingChanges}
                    className={`h-8 w-8 p-0 ${requestChangesEditor?.isActive('bulletList') ? 'bg-primary/10 text-primary' : ''}`}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => requestChangesEditor?.chain().focus().toggleOrderedList().run()}
                    disabled={!requestChangesEditor || isRequestingChanges}
                    className={`h-8 w-8 p-0 ${requestChangesEditor?.isActive('orderedList') ? 'bg-primary/10 text-primary' : ''}`}
                  >
                    <ListOrdered className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => requestChangesEditor?.chain().focus().toggleCodeBlock().run()}
                    disabled={!requestChangesEditor || isRequestingChanges}
                    className={`h-8 w-8 p-0 ${requestChangesEditor?.isActive('codeBlock') ? 'bg-primary/10 text-primary' : ''}`}
                  >
                    <Code className="h-4 w-4" />
                  </Button>
                </div>

                {/* Editor */}
                <div className="border border-t-0 border-border rounded-b-lg bg-background overflow-hidden">
                  {requestChangesEditor ? (
                    <EditorContent editor={requestChangesEditor} />
                  ) : (
                    <div className="min-h-[200px] p-4 flex items-center justify-center text-muted-foreground">
                      Loading editor...
                    </div>
                  )}
                </div>
              </div>

              {/* File Attachments */}
              <div className="space-y-2">
                <Label htmlFor="request-changes-file-upload">Attachments (Optional)</Label>
                <div className="space-y-3">
                  {requestChangesFiles.length > 0 && (
                    <div className="space-y-2">
                      {requestChangesFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border"
                        >
                          <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRequestChangesRemoveFile(index)}
                            disabled={isRequestingChanges}
                            className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload Button */}
                  <div>
                    <input
                      type="file"
                      id="request-changes-file-upload"
                      className="hidden"
                      multiple
                      aria-label="Attach files"
                      onChange={handleRequestChangesFileSelect}
                      disabled={isRequestingChanges}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('request-changes-file-upload')?.click()}
                      disabled={isRequestingChanges}
                      className="w-full"
                    >
                      <Paperclip className="h-4 w-4 mr-2" />
                      Attach Files
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="bg-muted/50 border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold">What happens next:</span>
                </p>
                <ul className="text-xs text-muted-foreground mt-2 space-y-1 ml-4 list-disc">
                  <li>Your comment will be added to the issue</li>
                  <li>The task will be moved to "To Do" for revision</li>
                  <li>The development team will be notified</li>
                </ul>
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleCancelRequestChanges}
                disabled={isRequestingChanges}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitRequestChanges}
                disabled={isRequestingChanges}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {isRequestingChanges ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Request Changes
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Issue Creation Modal for Group Tasks and Acceptance Issues */}
        {submitIssueModal.isOpen && (
          <IssueCreationTemplate
            isOpen={submitIssueModal.isOpen}
            onClose={handleCloseSubmitIssueModal}
            onSubmit={handleSubmitIssue}
            teamId={teamId}
            workflowStates={columns}
            teamMembers={teamConfig?.members?.nodes || []}
          />
        )}
      </div>
    );
  }
);

ClientUATKanban.displayName = 'ClientUATKanban';