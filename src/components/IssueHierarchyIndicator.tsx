/**
 * Issue Hierarchy Indicator Component
 * 
 * Simplified visual indicators for issue hierarchy
 * ICONS: Only 2 icons used - Circle (parent) + GitBranch (sub-issues)
 */

import React from 'react';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { 
  GitBranch, 
  Circle
} from 'lucide-react';
import type { LinearIssue } from '../services/linearTeamIssuesService';

interface IssueHierarchyIndicatorProps {
  issue: LinearIssue;
  variant?: 'badge' | 'icon' | 'full' | 'compact';
  showTooltip?: boolean;
}

export function IssueHierarchyIndicator({ 
  issue, 
  variant = 'badge',
  showTooltip = true 
}: IssueHierarchyIndicatorProps) {
  const breakdown = issue._hierarchyBreakdown;
  const totalDescendants = issue._originalSubIssueCount || 0;
  
  // Determine hierarchy level
  const hierarchyLevel = issue.parent ? 1 : 0; // 0 = parent, 1+ = child
  
  if (!breakdown && !issue.parent) {
    // Root issue with no children
    return null;
  }
  
  const renderBadge = () => {
    if (breakdown && totalDescendants > 0) {
      // Parent issue with children - Use GitBranch icon (simplified)
      return (
        <Badge 
          variant="secondary"
          className="!bg-blue-50 !text-blue-700 !border-blue-200 dark:!bg-blue-950 dark:!text-blue-300 dark:!border-blue-800 !text-xs !px-1.5 !py-0.5 !gap-1"
        >
          <GitBranch className="w-3 h-3" />
          <span>+{totalDescendants}</span>
        </Badge>
      );
    }
    
    if (issue.parent) {
      // Sub-issue (child)
      return (
        <Badge 
          variant="outline"
          className="!bg-purple-50 !text-purple-700 !border-purple-200 dark:!bg-purple-950 dark:!text-purple-300 dark:!border-purple-800 !text-xs !px-1.5 !py-0.5 !gap-1"
        >
          <GitBranch className="w-3 h-3" />
          <span>Sub</span>
        </Badge>
      );
    }
    
    return null;
  };
  
  const renderCompact = () => {
    if (breakdown && totalDescendants > 0) {
      // Compact parent badge - icon + number only
      return (
        <Badge 
          variant="secondary"
          className="!bg-blue-50 !text-blue-700 !border-blue-200 dark:!bg-blue-950 dark:!text-blue-300 dark:!border-blue-800 !text-xs !px-1.5 !py-0.5 !gap-1 !flex !items-center"
        >
          <GitBranch className="w-3 h-3" />
          <span>+{totalDescendants}</span>
        </Badge>
      );
    }
    
    if (issue.parent) {
      // Compact sub-issue badge - icon only
      return (
        <Badge 
          variant="outline"
          className="!bg-purple-50 !text-purple-700 !border-purple-200 dark:!bg-purple-950 dark:!text-purple-300 dark:!border-purple-800 !text-xs !px-1.5 !py-0.5 !flex !items-center"
        >
          <GitBranch className="w-3 h-3" />
        </Badge>
      );
    }
    
    return null;
  };
  
  const renderIcon = () => {
    if (breakdown && totalDescendants > 0) {
      return <Circle className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
    
    if (issue.parent) {
      return <GitBranch className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
    }
    
    return <Circle className="w-4 h-4 text-gray-400" />;
  };
  
  const renderFull = () => {
    return (
      <div className="flex items-center gap-2">
        {renderIcon()}
        {renderBadge()}
      </div>
    );
  };
  
  const getTooltipContent = () => {
    if (breakdown && totalDescendants > 0) {
      const levels: string[] = [];
      if ((breakdown.level1 ?? 0) > 0) levels.push(`${breakdown.level1} direct children`);
      if ((breakdown.level2 ?? 0) > 0) levels.push(`${breakdown.level2} grandchildren`);
      if ((breakdown.level3Plus ?? 0) > 0) levels.push(`${breakdown.level3Plus} great-grandchildren`);
      
      return (
        <div className="text-xs space-y-1">
          <div className="font-semibold">Hierarchy Breakdown:</div>
          {levels.map((level, i) => (
            <div key={i}>• {level}</div>
          ))}
          {breakdown.byState && Object.keys(breakdown.byState).length > 0 && (
            <>
              <div className="font-semibold mt-2">By State:</div>
              {Object.entries(breakdown.byState).map(([state, count]) => (
                <div key={state}>• {state}: {count}</div>
              ))}
            </>
          )}
        </div>
      );
    }
    
    if (issue.parent) {
      return (
        <div className="text-xs">
          <div className="font-semibold">Sub-task</div>
          <div>Parent: {issue.parent.identifier}</div>
        </div>
      );
    }
    
    return <div className="text-xs">Root issue (no children)</div>;
  };
  
  const content = variant === 'badge' ? renderBadge() : 
                  variant === 'icon' ? renderIcon() : 
                  variant === 'compact' ? renderCompact() :
                  renderFull();
  
  if (!showTooltip || !content) {
    return content;
  }
  
  return (
    <TooltipProvider delayDuration={1000}>
      <Tooltip>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Hierarchy Stats Summary Component
 * Simplified to show: X parents • Y sub-tasks (no breakdown by level)
 */
interface HierarchyStatsSummaryProps {
  totalParents: number;
  level1: number;
  level2: number;
  level3Plus: number;
  compact?: boolean;
}

export function HierarchyStatsSummary({
  totalParents,
  level1,
  level2,
  level3Plus,
  compact = false,
}: HierarchyStatsSummaryProps) {
  const totalSub = level1 + level2 + level3Plus;
  
  if (compact) {
    return (
      <div className="flex items-center !gap-2 !text-sm">
        <span className="text-muted-foreground">{totalParents} parent{totalParents !== 1 ? 's' : ''}</span>
        {totalSub > 0 && (
          <>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">{totalSub} sub-task{totalSub !== 1 ? 's' : ''}</span>
          </>
        )}
      </div>
    );
  }
  
  return (
    <div className="flex flex-wrap items-center !gap-3 !text-sm">
      {/* Parent issues - Circle icon */}
      <div className="flex items-center !gap-2">
        <Circle className="!w-4 !h-4 text-blue-600 dark:text-blue-400" />
        <span className="font-medium">{totalParents}</span>
        <span className="text-muted-foreground">parent{totalParents !== 1 ? 's' : ''}</span>
      </div>
      
      {/* Sub-issues - Single GitBranch icon for ALL levels */}
      {totalSub > 0 && (
        <>
          <span className="text-muted-foreground">•</span>
          <div className="flex items-center !gap-2">
            <GitBranch className="!w-4 !h-4 text-purple-600 dark:text-purple-400" />
            <span className="font-medium">{totalSub}</span>
            <span className="text-muted-foreground">sub-task{totalSub !== 1 ? 's' : ''}</span>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Hierarchy Level Indicator (for column headers)
 * Simplified to use GitBranch icon only
 */
interface ColumnHierarchyIndicatorProps {
  level1: number;
  level2: number;
  level3Plus: number;
}

export function ColumnHierarchyIndicator({
  level1,
  level2,
  level3Plus,
}: ColumnHierarchyIndicatorProps) {
  const total = level1 + level2 + level3Plus;
  
  if (total === 0) return null;
  
  return (
    <TooltipProvider delayDuration={1000}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="text-xs">
            <GitBranch className="w-3 h-3 mr-1" />
            {total}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="text-xs space-y-1">
            <div className="font-semibold">Sub-tasks in this column:</div>
            {level1 > 0 && <div>• Level 1: {level1}</div>}
            {level2 > 0 && <div>• Level 2: {level2}</div>}
            {level3Plus > 0 && <div>• Level 3+: {level3Plus}</div>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
