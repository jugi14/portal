/**
 * Issue Hierarchy Counter Hook
 * 
 * Comprehensive counter system for tracking issues across all hierarchy levels
 * Supports:
 * - Total counts across all levels
 * - Per-level breakdown (parent, L1, L2, L3+)
 * - Per-state distribution
 * - Per-column aggregation
 * - Filtered vs Total counts
 * 
 * @module useIssueHierarchyCounter
 */

import { useMemo } from 'react';
import type { LinearIssue } from '../services/linearTeamIssuesService';

export interface HierarchyLevel {
  level: number;
  name: string;
  count: number;
  percentage: number;
}

export interface StateDistribution {
  state: string;
  count: number;
  percentage: number;
}

export interface ColumnStats {
  total: number;
  parents: number;
  subIssues: {
    level1: number;
    level2: number;
    level3Plus: number;
    total: number;
  };
  byState: Record<string, number>;
}

export interface HierarchyStats {
  // Overall counts
  totalIssues: number;
  totalParents: number;
  totalSubIssues: number;
  
  // Level breakdown
  levels: {
    parents: number;
    level1: number;      // Direct children
    level2: number;      // Grandchildren
    level3Plus: number;  // Great-grandchildren+
  };
  
  // Level details with percentages
  levelBreakdown: HierarchyLevel[];
  
  // State distribution
  stateDistribution: StateDistribution[];
  
  // Per-column stats
  byColumn: Record<string, ColumnStats>;
  
  // Visibility tracking
  visibleIssues: number;
  hiddenIssues: number;
  visibilityPercentage: number;
}

export interface UseIssueHierarchyCounterOptions {
  issuesByColumn: Record<string, LinearIssue[]>;
  visibleColumns?: string[];
  includeFiltered?: boolean;
}

/**
 * Calculate comprehensive hierarchy statistics
 */
export function useIssueHierarchyCounter({
  issuesByColumn,
  visibleColumns,
  includeFiltered = true,
}: UseIssueHierarchyCounterOptions): HierarchyStats {
  
  return useMemo(() => {
    // PERFORMANCE: Early return for empty data (avoid calculation on initial renders)
    const totalColumns = Object.keys(issuesByColumn).length;
    const hasAnyIssues = totalColumns > 0 && 
      Object.values(issuesByColumn).some(issues => issues.length > 0);
    
    if (!hasAnyIssues) {
      // Return zero stats without logging (avoid console spam on initial renders)
      return {
        totalIssues: 0,
        totalParents: 0,
        totalSubIssues: 0,
        levelBreakdown: [
          { level: 0, name: 'Parents', count: 0, percentage: 0 },
          { level: 1, name: 'Level 1 (Direct Children)', count: 0, percentage: 0 },
          { level: 2, name: 'Level 2 (Grandchildren)', count: 0, percentage: 0 },
          { level: 3, name: 'Level 3+ (Great-grandchildren+)', count: 0, percentage: 0 },
        ],
        stateDistribution: [],
        columnStats: {},
        visibleIssues: 0,
        hiddenIssues: 0,
        visibilityPercentage: 0,
      };
    }
    
    console.log('[HierarchyCounter] Calculating comprehensive stats...');
    
    // Initialize counters
    let totalParents = 0;
    let totalLevel1 = 0;
    let totalLevel2 = 0;
    let totalLevel3Plus = 0;
    
    const stateCounter: Record<string, number> = {};
    const columnStats: Record<string, ColumnStats> = {};
    
    // Process each column
    Object.entries(issuesByColumn).forEach(([column, issues]) => {
      const columnStat: ColumnStats = {
        total: 0,
        parents: 0,
        subIssues: {
          level1: 0,
          level2: 0,
          level3Plus: 0,
          total: 0,
        },
        byState: {},
      };
      
      issues.forEach((issue) => {
        // Count parent
        columnStat.parents += 1;
        totalParents += 1;
        
        // Get hierarchy breakdown
        const breakdown = issue._hierarchyBreakdown;
        
        if (breakdown) {
          // Count by level
          columnStat.subIssues.level1 += breakdown.level1;
          columnStat.subIssues.level2 += breakdown.level2;
          columnStat.subIssues.level3Plus += breakdown.level3Plus;
          columnStat.subIssues.total += breakdown.total;
          
          totalLevel1 += breakdown.level1;
          totalLevel2 += breakdown.level2;
          totalLevel3Plus += breakdown.level3Plus;
          
          // Count by state
          Object.entries(breakdown.byState).forEach(([state, count]) => {
            columnStat.byState[state] = (columnStat.byState[state] || 0) + count;
            stateCounter[state] = (stateCounter[state] || 0) + count;
          });
        }
        
        // Total for this column
        columnStat.total = columnStat.parents + columnStat.subIssues.total;
      });
      
      columnStats[column] = columnStat;
    });
    
    // Calculate totals
    const totalSubIssues = totalLevel1 + totalLevel2 + totalLevel3Plus;
    const totalIssues = totalParents + totalSubIssues;
    
    // Calculate level breakdown with percentages
    const levelBreakdown: HierarchyLevel[] = [
      {
        level: 0,
        name: 'Parents',
        count: totalParents,
        percentage: totalIssues > 0 ? (totalParents / totalIssues) * 100 : 0,
      },
      {
        level: 1,
        name: 'Level 1 (Direct Children)',
        count: totalLevel1,
        percentage: totalIssues > 0 ? (totalLevel1 / totalIssues) * 100 : 0,
      },
      {
        level: 2,
        name: 'Level 2 (Grandchildren)',
        count: totalLevel2,
        percentage: totalIssues > 0 ? (totalLevel2 / totalIssues) * 100 : 0,
      },
      {
        level: 3,
        name: 'Level 3+ (Great-grandchildren+)',
        count: totalLevel3Plus,
        percentage: totalIssues > 0 ? (totalLevel3Plus / totalIssues) * 100 : 0,
      },
    ];
    
    // Calculate state distribution
    const stateDistribution: StateDistribution[] = Object.entries(stateCounter)
      .map(([state, count]) => ({
        state,
        count,
        percentage: totalSubIssues > 0 ? (count / totalSubIssues) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
    
    // Calculate visibility
    const visibleColumnsSet = new Set(visibleColumns || Object.keys(issuesByColumn));
    const visibleIssues = Object.entries(columnStats)
      .filter(([column]) => visibleColumnsSet.has(column))
      .reduce((sum, [, stats]) => sum + stats.total, 0);
    
    const hiddenIssues = totalIssues - visibleIssues;
    const visibilityPercentage = totalIssues > 0 ? (visibleIssues / totalIssues) * 100 : 0;
    
    // Log compact summary (single line for production readability)
    if (totalIssues > 0) {
      console.log(
        `[HierarchyCounter] ${totalIssues} total (Parents: ${totalParents}, L1: ${totalLevel1}, L2: ${totalLevel2}, L3+: ${totalLevel3Plus}) | Visible: ${visibleIssues} (${visibilityPercentage.toFixed(1)}%)`
      );
    }
    
    return {
      totalIssues,
      totalParents,
      totalSubIssues,
      levels: {
        parents: totalParents,
        level1: totalLevel1,
        level2: totalLevel2,
        level3Plus: totalLevel3Plus,
      },
      levelBreakdown,
      stateDistribution,
      byColumn: columnStats,
      visibleIssues,
      hiddenIssues,
      visibilityPercentage,
    };
  }, [issuesByColumn, visibleColumns, includeFiltered]);
}

/**
 * Format hierarchy stats for display
 */
export function formatHierarchyStats(stats: HierarchyStats): string {
  const parts: string[] = [];
  
  parts.push(`${stats.totalParents} parent${stats.totalParents !== 1 ? 's' : ''}`);
  
  if (stats.totalSubIssues > 0) {
    const breakdown: string[] = [];
    if (stats.levels.level1 > 0) breakdown.push(`${stats.levels.level1} L1`);
    if (stats.levels.level2 > 0) breakdown.push(`${stats.levels.level2} L2`);
    if (stats.levels.level3Plus > 0) breakdown.push(`${stats.levels.level3Plus} L3+`);
    
    parts.push(`${stats.totalSubIssues} sub-task${stats.totalSubIssues !== 1 ? 's' : ''} (${breakdown.join(', ')})`);
  }
  
  return parts.join(' • ');
}

/**
 * Format short hierarchy stats (compact version)
 */
export function formatHierarchyStatsShort(stats: HierarchyStats): string {
  if (stats.totalSubIssues === 0) {
    return `${stats.totalParents} task${stats.totalParents !== 1 ? 's' : ''}`;
  }
  
  return `${stats.totalParents} • ${stats.totalSubIssues} sub`;
}

/**
 * Get color for hierarchy level
 */
export function getHierarchyLevelColor(level: number): string {
  const colors = {
    0: 'text-blue-600 dark:text-blue-400',      // Parents
    1: 'text-purple-600 dark:text-purple-400',  // Level 1
    2: 'text-pink-600 dark:text-pink-400',      // Level 2
    3: 'text-orange-600 dark:text-orange-400',  // Level 3+
  };
  
  return colors[level as keyof typeof colors] || colors[3];
}

/**
 * Get badge variant for hierarchy level
 */
export function getHierarchyLevelBadge(level: number): 'default' | 'secondary' | 'outline' {
  const variants = {
    0: 'default',    // Parents
    1: 'secondary',  // Level 1
    2: 'secondary',  // Level 2
    3: 'outline',    // Level 3+
  };
  
  return variants[level as keyof typeof variants] || 'outline';
}