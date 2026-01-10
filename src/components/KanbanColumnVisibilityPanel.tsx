/**
 * Kanban Column Visibility Panel
 * 
 * UI component for managing column visibility, based on Teifi Digital design
 * Features:
 * - Columns dropdown with visibility controls
 * - Hide Empty Columns checkbox
 * - Show All / Hide All buttons
 * - Individual column visibility toggles with issue counts
 * - Manual Save button with unsaved changes indicator
 * - View Mode controls (Compact, Normal, Wide)
 * - Custom Width toggle and input
 */

import React from 'react';
import { Eye, EyeOff, Filter, RefreshCw, Settings2, Save, Check, Maximize2, Minimize2, Square } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Badge } from './ui/badge';
import type { KanbanColumnConfig } from '../types/kanban';

interface KanbanColumnVisibilityPanelProps {
  columns: KanbanColumnConfig[];
  hideEmptyColumns: boolean;
  filterByLabel?: boolean;
  togglingFilter?: boolean;
  onToggleColumn: (stateId: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  onToggleHideEmpty: () => void;
  onToggleFilterByLabel?: () => void;
  onSave?: () => void;
  saving?: boolean;
  hasUnsavedChanges?: boolean;
  // View Mode props
  viewMode?: 'compact' | 'normal' | 'wide';
  onViewModeChange?: (mode: 'compact' | 'normal' | 'wide') => void;
  customEnabled?: boolean;
  onCustomToggle?: () => void;
  customWidth?: number;
  onCustomWidthChange?: (width: number) => void;
}

export function KanbanColumnVisibilityPanel({
  columns,
  hideEmptyColumns,
  filterByLabel,
  togglingFilter = false,
  onToggleColumn,
  onShowAll,
  onHideAll,
  onToggleHideEmpty,
  onToggleFilterByLabel,
  onSave,
  saving = false,
  hasUnsavedChanges = false,
  // View Mode props
  viewMode,
  onViewModeChange,
  customEnabled,
  onCustomToggle,
  customWidth,
  onCustomWidthChange,
}: KanbanColumnVisibilityPanelProps) {
  const visibleCount = columns.filter(c => c.visible).length;
  const totalCount = columns.length;

  return (
    <div className="flex items-center gap-2">
      {/* Column Visibility Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Columns
            {visibleCount < totalCount && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {visibleCount}/{totalCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[360px]">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Column Visibility
          </DropdownMenuLabel>
          
          <DropdownMenuSeparator />
          
          {/* Hide Empty Columns Toggle */}
          <div className="px-2 py-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <Checkbox
                checked={hideEmptyColumns}
                onCheckedChange={onToggleHideEmpty}
                className="h-4 w-4"
              />
              <span className="text-sm group-hover:text-foreground transition-colors">
                Hide Empty Columns
              </span>
            </label>
          </div>

          <DropdownMenuSeparator />

          {/* Show All / Hide All Buttons */}
          <div className="px-2 py-2 flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onShowAll}
              className="flex-1 gap-2 h-8"
            >
              <Eye className="h-3.5 w-3.5" />
              Show All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onHideAll}
              className="flex-1 gap-2 h-8"
            >
              <EyeOff className="h-3.5 w-3.5" />
              Hide All
            </Button>
          </div>

          {/* View Mode Section */}
          {viewMode !== undefined && onViewModeChange && (
            <>
              <DropdownMenuSeparator />
              
              <div className="px-2 py-2">
                <div className="text-xs text-muted-foreground mb-2">
                  Column Width
                </div>
                
                {/* View Mode Buttons */}
                <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewModeChange('compact')}
                    className={`flex-1 h-8 px-2 text-xs gap-1.5 ${
                      viewMode === 'compact'
                        ? 'bg-background shadow-sm'
                        : 'hover:bg-background/50'
                    }`}
                    title="Compact view (260px)"
                  >
                    <Minimize2 className="h-3 w-3" />
                    Compact
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewModeChange('normal')}
                    className={`flex-1 h-8 px-2 text-xs gap-1.5 ${
                      viewMode === 'normal'
                        ? 'bg-background shadow-sm'
                        : 'hover:bg-background/50'
                    }`}
                    title="Normal view (320px)"
                  >
                    <Square className="h-3 w-3" />
                    Normal
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewModeChange('wide')}
                    className={`flex-1 h-8 px-2 text-xs gap-1.5 ${
                      viewMode === 'wide'
                        ? 'bg-background shadow-sm'
                        : 'hover:bg-background/50'
                    }`}
                    title="Wide view (380px)"
                  >
                    <Maximize2 className="h-3 w-3" />
                    Wide
                  </Button>
                </div>
              </div>
            </>
          )}

          <DropdownMenuSeparator />

          {/* Individual Columns */}
          <div className="px-2 py-1">
            <div className="text-xs text-muted-foreground mb-2 px-2">
              Individual Columns ({totalCount})
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {columns.map((column) => (
                <DropdownMenuItem
                  key={column.id}
                  onClick={(e) => {
                    e.preventDefault();
                    onToggleColumn(column.id);
                  }}
                  className="flex items-center justify-between gap-2 cursor-pointer px-2 py-2"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {column.visible ? (
                      <Eye className="h-4 w-4 text-primary flex-shrink-0" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    
                    {/* Column color indicator (if available from state) */}
                    <div 
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ 
                        backgroundColor: column.visible 
                          ? 'var(--color-primary)' 
                          : 'var(--color-muted-foreground)' 
                      }}
                    />
                    
                    <span className={`text-sm truncate ${
                      column.visible 
                        ? 'text-foreground font-medium' 
                        : 'text-muted-foreground'
                    }`}>
                      {column.name}
                    </span>
                  </div>
                  
                  {/* Issue count badge */}
                  <Badge 
                    variant={column.issueCount > 0 ? "secondary" : "outline"}
                    className="ml-auto flex-shrink-0 h-5 min-w-[24px] justify-center"
                  >
                    {column.issueCount}
                  </Badge>
                </DropdownMenuItem>
              ))}
            </div>
          </div>

          {/* Save Button Section */}
          {onSave && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-2">
                <Button
                  variant={hasUnsavedChanges ? "default" : "outline"}
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    onSave();
                  }}
                  disabled={saving || !hasUnsavedChanges}
                  className="w-full gap-2"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : hasUnsavedChanges ? (
                    <>
                      <Save className="h-4 w-4" />
                      Save Changes
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Saved
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Status Indicators */}
      <div className="flex items-center gap-1.5">
        {/* Auto-hide indicator (if active) */}
        {hideEmptyColumns && (
          <Badge variant="outline" className="gap-1.5">
            <Settings2 className="h-3 w-3" />
            <span className="hidden sm:inline">Auto-hide</span>
          </Badge>
        )}
        
        {/* Unsaved changes indicator */}
        {hasUnsavedChanges && !saving && (
          <Badge variant="outline" className="gap-1.5 border-warning text-warning">
            <div className="h-2 w-2 rounded-full bg-warning animate-pulse" />
            <span className="hidden sm:inline">Unsaved</span>
          </Badge>
        )}
        
        {/* Saving indicator */}
        {saving && (
          <Badge variant="secondary" className="gap-1.5">
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span className="hidden sm:inline">Saving...</span>
          </Badge>
        )}
      </div>
    </div>
  );
}