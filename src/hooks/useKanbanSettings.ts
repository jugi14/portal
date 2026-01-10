/**
 * useKanbanSettings Hook
 * 
 * React hook for managing Kanban board settings with:
 * - Instant localStorage updates for responsive UI
 * - Background sync to backend for persistence
 * - Automatic restoration on mount
 * - Column visibility, order, width management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { kanbanSettingsService } from '../services/kanbanSettingsService';
import type { 
  KanbanBoardSettings, 
  KanbanSettingsUpdatePayload,
  KanbanColumnConfig 
} from '../types/kanban';

interface UseKanbanSettingsOptions {
  teamId: string;
  states: Array<{ id: string; name: string; color?: string }>;
  issuesByState: Record<string, any[]>;
  onSettingsChange?: (settings: KanbanBoardSettings) => void;
}

interface UseKanbanSettingsReturn {
  settings: KanbanBoardSettings | null;
  columnConfigs: KanbanColumnConfig[];
  loading: boolean;
  saving: boolean;
  hasUnsavedChanges: boolean;
  
  // Column visibility
  toggleColumnVisibility: (stateId: string) => Promise<void>;
  showAllColumns: () => Promise<void>;
  hideAllColumns: () => Promise<void>;
  setVisibleColumns: (stateIds: string[]) => Promise<void>;
  
  // Column order
  reorderColumns: (newOrder: string[]) => Promise<void>;
  
  // Column width
  setColumnWidth: (stateId: string, width: number) => Promise<void>;
  
  // Preferences
  toggleHideEmptyColumns: () => Promise<void>;
  toggleCompactMode: () => Promise<void>;
  
  // Reset
  resetToDefaults: () => Promise<void>;
  
  // Manual sync
  syncToBackend: () => Promise<void>;
  saveChanges: () => Promise<void>;
}

export function useKanbanSettings(
  options: UseKanbanSettingsOptions
): UseKanbanSettingsReturn {
  const { teamId, states, issuesByState, onSettingsChange } = options;
  
  const [settings, setSettings] = useState<KanbanBoardSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Track if we need to sync to backend
  const pendingSyncRef = useRef(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Load settings on mount
   * INFINITE LOOP FIX: onSettingsChange removed from dependencies
   * Callback functions should NOT trigger re-loads
   * SMART FIX: Track states.length to re-load when columns are populated
   */
  useEffect(() => {
    const loadSettings = async () => {
      // CRITICAL FIX: Only load if we have valid teamId and states
      if (!teamId || states.length === 0) {
        console.log('[useKanbanSettings] Skipping load - missing teamId or states');
        setLoading(false);
        return;
      }

      console.log('[useKanbanSettings] Loading settings for team:', teamId);
      console.log('[useKanbanSettings] Available states:', states.map(s => s.id).join(', '));
      setLoading(true);
      
      try {
        // ALWAYS fetch from backend first
        const loadedSettings = await kanbanSettingsService.getSettings(teamId);
        
        if (loadedSettings) {
          setSettings(loadedSettings);
          setHasUnsavedChanges(false); // Loaded settings are saved
          console.log('[useKanbanSettings] Settings loaded from backend:', {
            columnsCount: loadedSettings.columnsOrder?.length,
            visibleCount: loadedSettings.visibleColumns?.length,
            hideEmptyColumns: loadedSettings.hideEmptyColumns,
            visibleColumns: loadedSettings.visibleColumns
          });
          
          // Trigger callback immediately with loaded settings
          if (onSettingsChange) {
            console.log('📢 [useKanbanSettings] Notifying parent of loaded settings');
            onSettingsChange(loadedSettings);
          }
        } else {
          // Build initial settings from states
          const initialSettings = kanbanSettingsService.buildInitialSettings(states);
          setSettings(initialSettings);
          setHasUnsavedChanges(true); // New settings need to be saved
          console.log('📋 [useKanbanSettings] Using initial default settings (no backend data)');
        }
      } catch (error) {
        console.error('[useKanbanSettings] Error loading settings:', error);
        // Fallback to initial settings - NEVER throw, just log and use defaults
        const initialSettings = kanbanSettingsService.buildInitialSettings(states);
        setSettings(initialSettings);
        setHasUnsavedChanges(true); // Fallback settings need to be saved
        console.log('[useKanbanSettings] Using fallback initial settings due to error');
      } finally {
        setLoading(false);
        console.log('🏁 [useKanbanSettings] Loading complete');
      }
    };

    // Always attempt to load, but handle missing data gracefully
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, states.length]); // Track states.length to re-run when columns are populated

  /**
   * Debounced sync to backend
   */
  const scheduleSyncToBackend = useCallback(() => {
    if (!settings) return;

    // Clear existing timeout
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Schedule new sync after 1 second of no changes
    pendingSyncRef.current = true;
    syncTimeoutRef.current = setTimeout(async () => {
      if (pendingSyncRef.current && settings) {
        console.log('[useKanbanSettings] Syncing to backend...');
        setSaving(true);
        await kanbanSettingsService.saveSettings(teamId, settings);
        setSaving(false);
        pendingSyncRef.current = false;
      }
    }, 1000);
  }, [settings, teamId]);

  /**
   * Update settings helper - marks as unsaved and updates localStorage
   */
  const updateSettings = useCallback(async (updates: KanbanSettingsUpdatePayload) => {
    if (!settings) return;

    const newSettings: KanbanBoardSettings = {
      ...settings,
      ...updates,
      lastOpen: new Date().toISOString()
    };

    // Immediate UI update
    setSettings(newSettings);
    onSettingsChange?.(newSettings);

    // Save to localStorage immediately
    kanbanSettingsService['saveLocalSettings'](teamId, newSettings);

    // Mark as having unsaved changes
    setHasUnsavedChanges(true);
    
    console.log('[useKanbanSettings] Settings changed - marked as unsaved');

    // REMOVED: Auto-sync to backend
    // Users will click Save button to sync manually
  }, [settings, teamId, onSettingsChange]);

  /**
   * Column visibility controls
   */
  const toggleColumnVisibility = useCallback(async (stateId: string) => {
    if (!settings) return;

    const isVisible = settings.visibleColumns.includes(stateId);
    const newVisibleColumns = isVisible
      ? settings.visibleColumns.filter(id => id !== stateId)
      : [...settings.visibleColumns, stateId];

    await updateSettings({ visibleColumns: newVisibleColumns });
  }, [settings, updateSettings]);

  const showAllColumns = useCallback(async () => {
    if (!settings) return;
    await updateSettings({ 
      visibleColumns: settings.columnsOrder 
    });
  }, [settings, updateSettings]);

  const hideAllColumns = useCallback(async () => {
    await updateSettings({ visibleColumns: [] });
  }, [updateSettings]);

  const setVisibleColumns = useCallback(async (stateIds: string[]) => {
    await updateSettings({ visibleColumns: stateIds });
  }, [updateSettings]);

  /**
   * Column order
   */
  const reorderColumns = useCallback(async (newOrder: string[]) => {
    await updateSettings({ columnsOrder: newOrder });
  }, [updateSettings]);

  /**
   * Column width
   */
  const setColumnWidth = useCallback(async (stateId: string, width: number) => {
    if (!settings) return;
    
    const newCustomWidths = {
      ...settings.customWidths,
      [stateId]: width
    };

    await updateSettings({ customWidths: newCustomWidths });
  }, [settings, updateSettings]);

  /**
   * Preferences
   */
  const toggleHideEmptyColumns = useCallback(async () => {
    if (!settings) return;
    await updateSettings({ hideEmptyColumns: !settings.hideEmptyColumns });
  }, [settings, updateSettings]);

  const toggleCompactMode = useCallback(async () => {
    if (!settings) return;
    await updateSettings({ compactMode: !settings.compactMode });
  }, [settings, updateSettings]);

  /**
   * Reset to defaults
   */
  const resetToDefaults = useCallback(async () => {
    console.log('[useKanbanSettings] Resetting to defaults');
    setSaving(true);
    
    const success = await kanbanSettingsService.resetSettings(teamId);
    
    if (success) {
      const initialSettings = kanbanSettingsService.buildInitialSettings(states);
      setSettings(initialSettings);
      setHasUnsavedChanges(false); // Reset clears unsaved changes
      onSettingsChange?.(initialSettings);
    }
    
    setSaving(false);
  }, [teamId, states, onSettingsChange]);

  /**
   * Manual sync to backend
   */
  const syncToBackend = useCallback(async () => {
    if (!settings) return;
    
    console.log('[useKanbanSettings] Manual sync to backend');
    setSaving(true);
    try {
      const success = await kanbanSettingsService.saveSettings(teamId, settings);
      if (success) {
        setHasUnsavedChanges(false);
        console.log('[useKanbanSettings] Settings saved successfully');
      }
    } catch (error) {
      console.error('[useKanbanSettings] Failed to save settings:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [settings, teamId]);

  /**
   * Save changes (alias for syncToBackend for better API naming)
   */
  const saveChanges = useCallback(async () => {
    await syncToBackend();
  }, [syncToBackend]);

  /**
   * Get column configs
   */
  const columnConfigs = settings
    ? kanbanSettingsService.getColumnConfigs(settings, states, issuesByState)
    : [];

  /**
   * Cleanup
   */
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  return {
    settings,
    columnConfigs,
    loading,
    saving,
    hasUnsavedChanges,
    
    toggleColumnVisibility,
    showAllColumns,
    hideAllColumns,
    setVisibleColumns,
    
    reorderColumns,
    setColumnWidth,
    
    toggleHideEmptyColumns,
    toggleCompactMode,
    
    resetToDefaults,
    syncToBackend,
    saveChanges
  };
}
