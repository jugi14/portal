/**
 * Kanban Board Settings Service
 *
 * Manages user-specific Kanban board personalization including:
 * - Column visibility, order, and width
 * - Display preferences (compact mode, hide empty, etc.)
 * - Filters and grouping
 *
 * Implements dual-layer storage:
 * - LocalStorage: Instant feedback, cached settings
 * - Backend KV: Persistent cross-device settings
 */

import { apiClient } from "./apiClient";
import { createClient } from "../utils/supabase/client";
import type {
  KanbanBoardSettings,
  KanbanSettingsUpdatePayload,
  KanbanColumnConfig,
} from "../types/kanban";

class KanbanSettingsService {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Get authorization headers with user access token
   */
  private async getHeaders(): Promise<Record<string, string>> {
    const {
      data: { session },
    } = await this.supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error(
        "No active session - user must be logged in",
      );
    }

    return {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Get localStorage key for team settings
   */
  private getLocalStorageKey(teamId: string): string {
    return `kanban_settings_${teamId}`;
  }

  /**
   * Get settings from localStorage (instant, cached)
   */
  private getLocalSettings(
    teamId: string,
  ): KanbanBoardSettings | null {
    try {
      const key = this.getLocalStorageKey(teamId);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const settings = JSON.parse(cached);
      return settings;
    } catch (error) {
      console.error(
        "[Kanban Settings] localStorage read error:",
        error,
      );
      return null;
    }
  }

  /**
   * Save settings to localStorage (instant feedback)
   */
  private saveLocalSettings(
    teamId: string,
    settings: KanbanBoardSettings,
  ): void {
    try {
      const key = this.getLocalStorageKey(teamId);
      localStorage.setItem(key, JSON.stringify(settings));
    } catch (error) {
      console.error(
        "[Kanban Settings] localStorage write error:",
        error,
      );
    }
  }

  /**
   * Delete settings from localStorage
   */
  private deleteLocalSettings(teamId: string): void {
    try {
      const key = this.getLocalStorageKey(teamId);
      localStorage.removeItem(key);
    } catch (error) {
      console.error(
        "[Kanban Settings] localStorage delete error:",
        error,
      );
    }
  }

  /**
   * Get user's Kanban settings for a team
   *
   *ALWAYS fetches from backend first for cross-device sync
   * Only uses localStorage as fallback if backend fails
   *CRITICAL: Never throws, always returns settings or null
   */
  async getSettings(
    teamId: string,
  ): Promise<KanbanBoardSettings | null> {
    const requestId = Math.random().toString(36).substr(2, 6);

    //VALIDATION: Check teamId
    if (
      !teamId ||
      teamId === "undefined" ||
      teamId === "null"
    ) {
      console.warn(
        `️ [${requestId}] Invalid teamId provided:`,
        teamId,
      );
      return null;
    }
    try {
      // Get authorization headers with user access token
      const headers = await this.getHeaders();

      //ALWAYS fetch from backend first (don't read localStorage yet)
      console.log(
        `[${requestId}] Fetching from backend (ignoring localStorage)...`,
      );

      const response = await apiClient.get(`/user/teams/${teamId}/kanban-settings`);

      if (!response.ok) {
        if (response.status === 404) {
          console.log(
            `ℹ️ [${requestId}] No backend settings found (404)`,
          );
          // Clear stale localStorage
          this.deleteLocalSettings(teamId);
          return null;
        }
        if (response.status === 401) {
          console.warn(`️ [${requestId}] Unauthorized (401)`);
          return null;
        }
        // For other errors, throw to use localStorage fallback
        throw new Error(
          `HTTP ${response.status}: ${response.statusText}`,
        );
      }

      const result = await response.json();

      if (!result.success) {
        console.warn(
          `️ [${requestId}] Backend returned success=false:`,
          result.error,
        );
        throw new Error(
          result.error ||
            "Backend returned unsuccessful response",
        );
      }

      const backendSettings = result.data;

      // If no backend settings, return null (don't use localStorage)
      if (!backendSettings) {
        this.deleteLocalSettings(teamId);
        return null;
      }

      //SUCCESS: Update localStorage with fresh backend settings
      this.saveLocalSettings(teamId, backendSettings);
      return backendSettings;
    } catch (error) {
      //FALLBACK: Only now try localStorage as last resort
      console.error(
        `[${requestId}] Backend fetch failed:`,
        error,
      );
      const localSettings = this.getLocalSettings(teamId);

      if (localSettings) {
        console.warn(
          `️ [${requestId}] Using STALE localStorage as fallback (backend unavailable)`,
        );
        return localSettings;
      }

      // Ultimate fallback: return null, let hook build initial settings
      return null;
    }
  }

  /**
   * Save user's Kanban settings for a team
   *
   * Updates localStorage immediately, then syncs to backend
   */
  async saveSettings(
    teamId: string,
    settings: KanbanBoardSettings,
  ): Promise<boolean> {
    const requestId = Math.random().toString(36).substr(2, 6);
    // Immediate localStorage update for instant feedback
    this.saveLocalSettings(teamId, settings);

    try {
      // Get authorization headers with user access token
      const headers = await this.getHeaders();

      // Sync to backend
      const response = await apiClient.put(`/user/teams/${teamId}/kanban-settings`, settings);

      if (!response.success) {
        throw new Error(response.error || "Failed to update settings");
      }

      const result = response;

      if (!result.success) {
        throw new Error(
          result.error || "Failed to save settings",
        );
      }
      return true;
    } catch (error) {
      console.error(
        `[${requestId}] Error saving to backend:`,
        error,
      );
      // Settings already saved to localStorage, so UI will persist
      return false; // Indicate backend save failed
    }
  }

  /**
   * Update specific settings (partial update)
   */
  async updateSettings(
    teamId: string,
    updates: KanbanSettingsUpdatePayload,
  ): Promise<boolean> {
    const requestId = Math.random().toString(36).substr(2, 6);
    // Get current settings
    const currentSettings = await this.getSettings(teamId);

    if (!currentSettings) {
      console.warn(
        `️ [${requestId}] No current settings to update`,
      );
      return false;
    }

    // Merge updates
    const newSettings: KanbanBoardSettings = {
      ...currentSettings,
      ...updates,
      lastOpen: new Date().toISOString(),
    };

    // Save merged settings
    return this.saveSettings(teamId, newSettings);
  }

  /**
   * Reset settings to defaults
   */
  async resetSettings(teamId: string): Promise<boolean> {
    const requestId = Math.random().toString(36).substr(2, 6);
    // Delete from localStorage
    this.deleteLocalSettings(teamId);

    try {
      // Delete from backend
      const response = await apiClient.delete(`/user/teams/${teamId}/kanban-settings`);

      if (!response.success) {
        throw new Error(response.error || "Failed to delete settings");
      }

      const result = response;

      if (!result.success) {
        throw new Error(
          result.error || "Failed to reset settings",
        );
      }
      return true;
    } catch (error) {
      console.error(
        `[${requestId}] Error resetting settings:`,
        error,
      );
      return false;
    }
  }

  /**
   * Utility: Build initial settings from team states
   */
  buildInitialSettings(
    states: Array<{ id: string; name: string }>,
  ): KanbanBoardSettings {
    const stateIds = states.map((s) => s.id);

    return {
      columnsOrder: stateIds,
      visibleColumns: stateIds, // All visible by default
      collapsedColumns: [],
      customWidths: {},
      hideEmptyColumns: false,
      compactMode: false,
      showSubIssues: true,
      lastOpen: new Date().toISOString(),
      version: 1,
    };
  }

  /**
   * Utility: Get column configs from settings and states
   */
  getColumnConfigs(
    settings: KanbanBoardSettings | null,
    states: Array<{ id: string; name: string; color?: string }>,
    issuesByState: Record<string, any[]>,
  ): KanbanColumnConfig[] {
    const columnsOrder =
      settings?.columnsOrder || states.map((s) => s.id);
    const visibleColumns =
      settings?.visibleColumns || states.map((s) => s.id);
    const customWidths = settings?.customWidths || {};
    const collapsedColumns = settings?.collapsedColumns || [];

    return columnsOrder
      .map((stateId, index) => {
        const state = states.find((s) => s.id === stateId);
        if (!state) return null;

        return {
          id: state.id,
          name: state.name,
          visible: visibleColumns.includes(state.id),
          width: customWidths[state.id],
          collapsed: collapsedColumns.includes(state.id),
          order: index,
          issueCount: issuesByState[state.id]?.length || 0,
        };
      })
      .filter(
        (config): config is KanbanColumnConfig =>
          config !== null,
      );
  }
}

export const kanbanSettingsService =
  new KanbanSettingsService();