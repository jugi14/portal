import React from 'react';
import { Maximize2, Minimize2, Square } from 'lucide-react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Slider } from './ui/slider';

export type ViewMode = 'compact' | 'normal' | 'wide';

interface KanbanViewModeSelectorProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  customEnabled: boolean;
  onCustomToggle: (enabled: boolean) => void;
  customWidth?: number;
  onCustomWidthChange?: (width: number) => void;
}

export function KanbanViewModeSelector({
  viewMode,
  onViewModeChange,
  customEnabled,
  onCustomToggle,
  customWidth = 280,
  onCustomWidthChange,
}: KanbanViewModeSelectorProps) {
  return (
    <div className="kanban-view-mode-selector flex items-center gap-2 flex-wrap">
      {/* Preset Buttons - Disabled when Custom is enabled */}
      <div className="flex items-center gap-2">
        <Button
          variant={viewMode === 'compact' && !customEnabled ? 'default' : 'outline'}
          size="sm"
          onClick={() => onViewModeChange('compact')}
          disabled={customEnabled}
          className="gap-2"
        >
          <Minimize2 className="h-4 w-4" />
          Compact
        </Button>

        <Button
          variant={viewMode === 'normal' && !customEnabled ? 'default' : 'outline'}
          size="sm"
          onClick={() => onViewModeChange('normal')}
          disabled={customEnabled}
          className="gap-2"
        >
          <Square className="h-4 w-4" />
          Normal
        </Button>

        <Button
          variant={viewMode === 'wide' && !customEnabled ? 'default' : 'outline'}
          size="sm"
          onClick={() => onViewModeChange('wide')}
          disabled={customEnabled}
          className="gap-2"
        >
          <Maximize2 className="h-4 w-4" />
          Wide
        </Button>
      </div>

      {/* Custom Toggle */}
      <div className="flex items-center gap-2 ml-2 pl-2 border-l">
        <Label htmlFor="custom-width" className="text-sm">
          Custom:
        </Label>
        <Switch
          id="custom-width"
          checked={customEnabled}
          onCheckedChange={onCustomToggle}
        />
      </div>

      {/* Custom Width Slider - Only show when Custom is enabled */}
      {customEnabled && (
        <div className="flex items-center gap-2 ml-2 pl-2 border-l min-w-[180px]">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {customWidth}px
          </span>
          {onCustomWidthChange && (
            <Slider
              value={[customWidth]}
              onValueChange={([value]) => onCustomWidthChange(value)}
              min={200}
              max={400}
              step={10}
              className="w-28"
            />
          )}
        </div>
      )}
    </div>
  );
}