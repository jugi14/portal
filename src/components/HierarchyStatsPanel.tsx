/**
 * Hierarchy Stats Panel Component
 * 
 * Comprehensive visualization of issue hierarchy statistics
 * Shows breakdowns by level, state, and column
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Button } from './ui/button';
import { 
  ChevronDown, 
  ChevronUp,
  GitBranch,
  Circle,
  BarChart3,
  Eye,
  EyeOff
} from 'lucide-react';
import type { HierarchyStats } from '../hooks/useIssueHierarchyCounter';

interface HierarchyStatsPanelProps {
  stats: HierarchyStats;
  defaultExpanded?: boolean;
}

export function HierarchyStatsPanel({ 
  stats, 
  defaultExpanded = false 
}: HierarchyStatsPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  // SIMPLIFIED: Only 2 icons - Circle (parents) and GitBranch (all sub-tasks)
  const levelIcons = {
    0: <Circle className="w-4 h-4" />,
    1: <GitBranch className="w-4 h-4" />,
    2: <GitBranch className="w-4 h-4" />,
    3: <GitBranch className="w-4 h-4" />,
  };
  
  const levelColors = {
    0: 'text-blue-600 dark:text-blue-400',
    1: 'text-purple-600 dark:text-purple-400',
    2: 'text-pink-600 dark:text-pink-400',
    3: 'text-orange-600 dark:text-orange-400',
  };
  
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Hierarchy Overview</CardTitle>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-8"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-1" />
                Hide
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-1" />
                Show Details
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Summary Stats - Following exact layout from screenshot */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Total Issues - Sum of all issues across all hierarchy levels */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-1">Total Issues</div>
            <div className="text-2xl font-bold">{stats.totalIssues}</div>
          </div>
          
          {/* Parents - Top-level parent issues */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-1">Parents</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.totalParents}
            </div>
          </div>
          
          {/* Sub-tasks - All sub-issues across all levels */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-1">Sub-tasks</div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.totalSubIssues}
            </div>
          </div>
          
          {/* % Visible - Shows visible count and percentage */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              {stats.visibilityPercentage === 100 ? (
                <Eye className="w-3 h-3" />
              ) : (
                <EyeOff className="w-3 h-3" />
              )}
              % Visible
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.visibleIssues}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {stats.visibilityPercentage.toFixed(0)}%
            </div>
          </div>
        </div>
        
        {expanded && (
          <>
            {/* Level Breakdown */}
            <div className="space-y-2">
              <div className="text-sm font-semibold mb-3">Level Breakdown</div>
              
              {stats.levelBreakdown.map((level) => (
                <div key={level.level} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={levelColors[level.level as keyof typeof levelColors]}>
                        {levelIcons[level.level as keyof typeof levelIcons]}
                      </span>
                      <span className="font-medium">{level.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{level.count}</span>
                      <span className="text-xs text-muted-foreground">
                        ({level.percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <Progress 
                    value={level.percentage} 
                    className="h-2"
                  />
                </div>
              ))}
            </div>
            
            {/* State Distribution */}
            {stats.stateDistribution.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-semibold mb-3">Sub-tasks by State</div>
                
                <div className="grid grid-cols-2 gap-2">
                  {stats.stateDistribution.map((item) => (
                    <div 
                      key={item.state}
                      className="bg-muted/30 rounded-lg p-2 flex items-center justify-between"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-medium truncate max-w-[120px]">
                          {item.state}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {item.percentage.toFixed(0)}%
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {item.count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Column Stats */}
            <div className="space-y-2">
              <div className="text-sm font-semibold mb-3">Per Column Breakdown</div>
              
              <div className="space-y-2">
                {Object.entries(stats.byColumn)
                  .filter(([, columnStats]) => columnStats.total > 0)
                  .map(([column, columnStats]) => (
                    <div 
                      key={column}
                      className="bg-muted/20 rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">
                          {column.replace('-', ' ')}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {columnStats.total} total
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div className="text-center">
                          <div className="text-blue-600 dark:text-blue-400 font-bold">
                            {columnStats.parents}
                          </div>
                          <div className="text-[10px] text-muted-foreground">Parents</div>
                        </div>
                        
                        {(columnStats.subIssues?.level1 ?? 0) > 0 && (
                          <div className="text-center">
                            <div className="text-purple-600 dark:text-purple-400 font-bold">
                              {columnStats.subIssues?.level1 ?? 0}
                            </div>
                            <div className="text-[10px] text-muted-foreground">L1</div>
                          </div>
                        )}
                        
                        {(columnStats.subIssues?.level2 ?? 0) > 0 && (
                          <div className="text-center">
                            <div className="text-pink-600 dark:text-pink-400 font-bold">
                              {columnStats.subIssues?.level2 ?? 0}
                            </div>
                            <div className="text-[10px] text-muted-foreground">L2</div>
                          </div>
                        )}
                        
                        {(columnStats.subIssues?.level3Plus ?? 0) > 0 && (
                          <div className="text-center">
                            <div className="text-orange-600 dark:text-orange-400 font-bold">
                              {columnStats.subIssues?.level3Plus ?? 0}
                            </div>
                            <div className="text-[10px] text-muted-foreground">L3+</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact Hierarchy Stats (for inline display)
 */
interface CompactHierarchyStatsProps {
  stats: HierarchyStats;
  onClick?: () => void;
}

export function CompactHierarchyStats({ 
  stats, 
  onClick 
}: CompactHierarchyStatsProps) {
  return (
    <div 
      className={`inline-flex items-center gap-2 text-sm ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-1">
        <Circle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        <span className="font-medium">{stats.totalParents}</span>
      </div>
      
      {stats.totalSubIssues > 0 && (
        <>
          <span className="text-muted-foreground">•</span>
          <div className="flex items-center gap-1">
            <GitBranch className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span className="font-medium">{stats.totalSubIssues}</span>
            <span className="text-xs text-muted-foreground">
              (L1:{stats.levels?.level1 ?? 0}
              {(stats.levels?.level2 ?? 0) > 0 && `, L2:${stats.levels.level2}`}
              {(stats.levels?.level3Plus ?? 0) > 0 && `, L3+:${stats.levels.level3Plus}`})
            </span>
          </div>
        </>
      )}
      
      {stats.hiddenIssues > 0 && (
        <>
          <span className="text-muted-foreground">•</span>
          <div className="flex items-center gap-1 text-muted-foreground">
            <EyeOff className="w-3.5 h-3.5" />
            <span className="text-xs">{stats.hiddenIssues} hidden</span>
          </div>
        </>
      )}
    </div>
  );
}