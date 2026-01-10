import { useState, useEffect, useCallback } from 'react';
import { LinearState } from '../services/linearTeamIssuesService';
import { toast } from 'sonner';

/**
 * Client Tasks Settings Hook - UAT Workflow 5-Column Config
 * 
 * Manages column visibility and settings for Client Tasks board
 * Independent storage from TeamIssuesKanban settings
 */

interface TasksSettings {
  visibleColumns: string[]; // Array of visible column IDs
  hideEmptyColumns: boolean;
  filterByLabel: boolean; // Filter issues by UAT/Client labels (default: false - show all)
}

interface ColumnConfig {
  id: string;
  name: string;
  isVisible: boolean;
  isEmpty: boolean;
  issueCount: number;
}

interface UseClientTasksSettingsOptions {
  teamId: string;
  columns: string[]; // UAT column IDs: 'client-review', 'blocked', 'done', 'released', 'failed-review'
  issuesByColumn: Record<string, any[]>;
  onSettingsChange?: (settings: TasksSettings) => void;
}

interface UseClientTasksSettingsReturn {
  settings: TasksSettings | null;
  columnConfigs: ColumnConfig[];
  loading: boolean;
  saving: boolean;
  hasUnsavedChanges: boolean;
  toggleColumnVisibility: (columnId: string) => void;
  showAllColumns: () => void;
  hideAllColumns: () => void;
  toggleHideEmptyColumns: () => void;
  toggleFilterByLabel: () => void;
  saveChanges: () => Promise<void>;
  getVisibleColumns: () => string[];
}

const DEFAULT_SETTINGS: TasksSettings = {
  visibleColumns: ['client-review', 'blocked', 'done', 'released', 'failed-review'], // UAT 5-column workflow
  hideEmptyColumns: false,
  filterByLabel: false, // Default: show all issues (filter disabled by default)
};

export function useClientTasksSettings({
  teamId,
  columns,
  issuesByColumn,
  onSettingsChange,
}: UseClientTasksSettingsOptions): UseClientTasksSettingsReturn {
  // State management
  const [settings, setSettings] = useState<TasksSettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<TasksSettings | null>(null);
  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Storage key - separate from Issues board
  const storageKey = `client_tasks_settings_${teamId}`;

  // Column name mapping - UAT workflow
  const columnNames: Record<string, string> = {
    'client-review': 'Pending Review',
    'blocked': 'Blocked/Needs Input',
    'done': 'Approved',
    'released': 'Released',
    'failed-review': 'Failed Review',
  };

  // Load settings from localStorage
  const loadSettings = useCallback(() => {
    try {
      setLoading(true);
      
      const stored = localStorage.getItem(storageKey);
      let loadedSettings: TasksSettings;

      if (stored) {
        loadedSettings = JSON.parse(stored);
        // Removed verbose log - loaded from storage
        
        // MIGRATION: Detect old column config and reset to UAT workflow
        const hasOldColumns = loadedSettings.visibleColumns.some(col => 
          col === 'to-do' || col === 'in-progress'
        );
        
        if (hasOldColumns) {
          // Removed verbose log - migration detected
          loadedSettings = { ...DEFAULT_SETTINGS };
          localStorage.setItem(storageKey, JSON.stringify(loadedSettings));
          // Removed verbose log - migration complete
        }
        
        // Ensure all UAT columns are present
        const requiredColumns = ['client-review', 'blocked', 'done', 'released', 'failed-review'];
        const missingColumns = requiredColumns.filter(col => !loadedSettings.visibleColumns.includes(col));
        
        if (missingColumns.length > 0) {
          // Removed verbose log - adding missing columns
          loadedSettings.visibleColumns = [...new Set([...loadedSettings.visibleColumns, ...missingColumns])];
          localStorage.setItem(storageKey, JSON.stringify(loadedSettings));
        }
      } else {
        loadedSettings = { ...DEFAULT_SETTINGS };
        // Only log in verbose/debug mode
      }
      
      // ALWAYS read filterByLabel from global setting (admin-controlled)
      const globalFilter = localStorage.getItem('teifi_uat_filter_default');
      loadedSettings.filterByLabel = globalFilter !== null ? globalFilter === 'true' : false;

      setSettings(loadedSettings);
      setOriginalSettings(loadedSettings);
      setHasUnsavedChanges(false);
      
      setLoading(false);
    } catch (error) {
      console.error('[ClientTasksSettings] Load error:', error);
      setSettings({ ...DEFAULT_SETTINGS });
      setOriginalSettings({ ...DEFAULT_SETTINGS });
      setLoading(false);
    }
  }, [storageKey]);

  // Initialize on mount - only load once per teamId
  useEffect(() => {
    loadSettings();
  }, [teamId]);

  // Update column configs when settings or issues change
  useEffect(() => {
    if (!settings) return;

    const configs: ColumnConfig[] = columns.map((columnId) => {
      const issueCount = issuesByColumn[columnId]?.length || 0;
      return {
        id: columnId,
        name: columnNames[columnId] || columnId,
        isVisible: settings.visibleColumns.includes(columnId),
        isEmpty: issueCount === 0,
        issueCount,
      };
    });

    setColumnConfigs(configs);
  }, [settings, columns, issuesByColumn]);

  // OPTIMIZED: Notify parent when settings change (memoized callback, no unstable deps)
  useEffect(() => {
    if (settings && onSettingsChange) {
      onSettingsChange(settings);
      // Removed verbose log - settings updated
    }
    // PERFORMANCE: Only re-run when settings object identity changes
    // Do NOT include onSettingsChange to avoid re-triggering on parent re-renders
  }, [settings]);

  // Check for unsaved changes
  useEffect(() => {
    if (!settings || !originalSettings) {
      setHasUnsavedChanges(false);
      return;
    }

    const hasChanges =
      JSON.stringify(settings.visibleColumns.sort()) !==
        JSON.stringify(originalSettings.visibleColumns.sort()) ||
      settings.hideEmptyColumns !== originalSettings.hideEmptyColumns ||
      settings.filterByLabel !== originalSettings.filterByLabel;

    setHasUnsavedChanges(hasChanges);
  }, [settings, originalSettings]);

  // Toggle column visibility
  const toggleColumnVisibility = useCallback(
    (columnId: string) => {
      setSettings((prev) => {
        if (!prev) return prev;

        const isCurrentlyVisible = prev.visibleColumns.includes(columnId);
        const newVisibleColumns = isCurrentlyVisible
          ? prev.visibleColumns.filter((id) => id !== columnId)
          : [...prev.visibleColumns, columnId];

        return {
          ...prev,
          visibleColumns: newVisibleColumns,
        };
      });
    },
    []
  );

  // Show all columns
  const showAllColumns = useCallback(() => {
    setSettings((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        visibleColumns: [...columns],
      };
    });
  }, [columns]);

  // Hide all columns
  const hideAllColumns = useCallback(() => {
    setSettings((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        visibleColumns: [],
      };
    });
  }, []);

  // Toggle hide empty columns
  const toggleHideEmptyColumns = useCallback(() => {
    setSettings((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        hideEmptyColumns: !prev.hideEmptyColumns,
      };
    });
  }, []);

  // Toggle filter by label - DISABLED (admin-controlled via global setting)
  const toggleFilterByLabel = useCallback(() => {
    console.warn('[ClientTasksSettings] toggleFilterByLabel is disabled - filter is controlled by admin globally');
    toast.info('UAT filter is controlled by admin settings');
  }, []);

  // Save changes to localStorage
  const saveChanges = useCallback(async () => {
    if (!settings || !hasUnsavedChanges) return;

    try {
      setSaving(true);

      // Save to localStorage
      localStorage.setItem(storageKey, JSON.stringify(settings));
      
      // Update original settings
      setOriginalSettings(settings);
      setHasUnsavedChanges(false);

      // Removed verbose log - saved to storage
      toast.success('UAT settings saved');

      setSaving(false);
    } catch (error) {
      console.error('[ClientTasksSettings] Save error:', error);
      toast.error('Failed to save settings');
      setSaving(false);
      throw error;
    }
  }, [settings, hasUnsavedChanges, storageKey]);

  // Get visible columns based on settings
  const getVisibleColumns = useCallback((): string[] => {
    if (!settings) return columns;

    let visibleCols = columns.filter((id) =>
      settings.visibleColumns.includes(id)
    );

    // Apply hide empty filter
    if (settings.hideEmptyColumns) {
      visibleCols = visibleCols.filter((id) => {
        const issueCount = issuesByColumn[id]?.length || 0;
        return issueCount > 0;
      });
    }

    return visibleCols;
  }, [settings, columns, issuesByColumn]);

  return {
    settings,
    columnConfigs,
    loading,
    saving,
    hasUnsavedChanges,
    toggleColumnVisibility,
    showAllColumns,
    hideAllColumns,
    toggleHideEmptyColumns,
    toggleFilterByLabel,
    saveChanges,
    getVisibleColumns,
  };
}