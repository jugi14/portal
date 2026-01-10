/**
 * Professional Skeleton Loading Library - Teifi Client Portal
 * 
 * Comprehensive skeleton components optimized for:
 * - Dark & Light modes
 * - Mobile & Desktop responsive
 * - Smooth shimmer animations
 * - Accessible loading states
 * 
 * GUIDELINES COMPLIANCE:
 * - KISS: Simple, focused skeleton components
 * - DRY: Reusable skeleton patterns
 * - Performance: GPU-accelerated animations
 * - NO EMOJIS: Clean professional code
 */

import React from 'react';
import { cn } from './utils';
import { Skeleton } from './skeleton';

/**
 * KANBAN CARD SKELETON
 * Used for: Team Issues Kanban, Client UAT Kanban
 * Responsive: Mobile stacks, Desktop grid
 */
export function KanbanCardSkeleton({ className }: { className?: string }) {
  return (
    <div 
      className={cn(
        "rounded-lg border bg-card p-4 space-y-3",
        "animate-pulse",
        className
      )}
      data-skeleton-type="kanban-card"
    >
      {/* Header: ID Badge + Title */}
      <div className="flex items-start gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-4 flex-1" />
      </div>
      
      {/* Description lines */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      
      {/* Footer: Assignee + Priority + Status */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * KANBAN COLUMN SKELETON
 * Complete column with header and multiple cards
 */
export function KanbanColumnSkeleton({ 
  cardCount = 3,
  className 
}: { 
  cardCount?: number;
  className?: string;
}) {
  return (
    <div 
      className={cn(
        "flex flex-col gap-4 p-4 rounded-xl",
        "bg-muted/30 border border-border",
        "min-w-[280px] md:min-w-[320px]",
        className
      )}
      data-skeleton-type="kanban-column"
    >
      {/* Column Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-6 w-8 rounded-full" />
      </div>
      
      {/* Cards */}
      <div className="space-y-3">
        {Array.from({ length: cardCount }).map((_, i) => (
          <KanbanCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/**
 * FULL KANBAN BOARD SKELETON
 * Multiple columns side by side
 */
export function KanbanBoardSkeleton({ 
  columnCount = 4,
  cardsPerColumn = 3,
  className 
}: { 
  columnCount?: number;
  cardsPerColumn?: number;
  className?: string;
}) {
  return (
    <div 
      className={cn(
        "flex gap-4 overflow-x-auto pb-4",
        "px-4 md:px-6",
        className
      )}
      data-skeleton-type="kanban-board"
    >
      {Array.from({ length: columnCount }).map((_, i) => (
        <KanbanColumnSkeleton 
          key={i} 
          cardCount={cardsPerColumn}
        />
      ))}
    </div>
  );
}

/**
 * DASHBOARD STAT CARD SKELETON
 * Used for: Dashboard stats, Team overview cards
 */
export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div 
      className={cn(
        "rounded-lg border bg-card p-6 space-y-3",
        "animate-pulse",
        className
      )}
      data-skeleton-type="stat-card"
    >
      {/* Icon + Label */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      
      {/* Value */}
      <Skeleton className="h-8 w-20" />
      
      {/* Trend indicator */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

/**
 * DASHBOARD STATS GRID SKELETON
 */
export function StatsGridSkeleton({ 
  cardCount = 4,
  className 
}: { 
  cardCount?: number;
  className?: string;
}) {
  return (
    <div 
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4",
        className
      )}
      data-skeleton-type="stats-grid"
    >
      {Array.from({ length: cardCount }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * TABLE ROW SKELETON
 * Used for: Issue tables, User tables, Team lists
 */
export function TableRowSkeleton({ 
  columns = 5,
  className 
}: { 
  columns?: number;
  className?: string;
}) {
  return (
    <tr 
      className={cn("border-b", className)}
      data-skeleton-type="table-row"
    >
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <Skeleton className={cn(
            "h-4",
            i === 0 ? "w-16" : // ID column
            i === 1 ? "w-full" : // Title column
            i === columns - 1 ? "w-20" : // Action column
            "w-24" // Other columns
          )} />
        </td>
      ))}
    </tr>
  );
}

/**
 * FULL TABLE SKELETON
 */
export function TableSkeleton({ 
  rows = 5,
  columns = 5,
  showHeader = true,
  className 
}: { 
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
}) {
  return (
    <div 
      className={cn(
        "w-full border rounded-lg overflow-hidden",
        className
      )}
      data-skeleton-type="table"
    >
      <table className="w-full">
        {showHeader && (
          <thead className="bg-muted/50">
            <tr>
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="p-4 text-left">
                  <Skeleton className="h-4 w-20" />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * LIST ITEM SKELETON
 * Used for: Sidebar teams, Search results
 */
export function ListItemSkeleton({ className }: { className?: string }) {
  return (
    <div 
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg",
        "animate-pulse",
        className
      )}
      data-skeleton-type="list-item"
    >
      <Skeleton className="h-8 w-8 rounded" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-5 w-12 rounded-full" />
    </div>
  );
}

/**
 * LIST SKELETON
 */
export function ListSkeleton({ 
  items = 5,
  className 
}: { 
  items?: number;
  className?: string;
}) {
  return (
    <div 
      className={cn("space-y-2", className)}
      data-skeleton-type="list"
    >
      {Array.from({ length: items }).map((_, i) => (
        <ListItemSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * SIDEBAR SKELETON
 * Full sidebar with sections
 */
export function SidebarSkeleton({ className }: { className?: string }) {
  return (
    <div 
      className={cn(
        "w-full h-full p-4 space-y-6",
        className
      )}
      data-skeleton-type="sidebar"
    >
      {/* User Profile */}
      <div className="flex items-center gap-3 p-3 rounded-lg border">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      
      {/* Navigation Sections */}
      {[1, 2, 3].map((section) => (
        <div key={section} className="space-y-2">
          {/* Section Header */}
          <Skeleton className="h-3 w-24 ml-2" />
          
          {/* Section Items */}
          <div className="space-y-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 p-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * HEADER SKELETON
 */
export function HeaderSkeleton({ className }: { className?: string }) {
  return (
    <header 
      className={cn(
        "flex items-center justify-between p-4 border-b",
        "bg-card",
        className
      )}
      data-skeleton-type="header"
    >
      {/* Logo */}
      <Skeleton className="h-8 w-32" />
      
      {/* Navigation */}
      <div className="hidden md:flex items-center gap-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
      </div>
      
      {/* User Actions */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>
    </header>
  );
}

/**
 * FORM SKELETON
 * Used for: Create/Edit dialogs
 */
export function FormSkeleton({ 
  fields = 4,
  className 
}: { 
  fields?: number;
  className?: string;
}) {
  return (
    <div 
      className={cn("space-y-6", className)}
      data-skeleton-type="form"
    >
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
      
      {/* Actions */}
      <div className="flex items-center gap-3 pt-4">
        <Skeleton className="h-10 w-24 rounded-md" />
        <Skeleton className="h-10 w-24 rounded-md" />
      </div>
    </div>
  );
}

/**
 * MODAL SKELETON
 * Full modal with header, content, footer
 */
export function ModalSkeleton({ className }: { className?: string }) {
  return (
    <div 
      className={cn(
        "rounded-lg border bg-card shadow-lg",
        "w-full max-w-2xl mx-auto",
        className
      )}
      data-skeleton-type="modal"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-8 rounded" />
      </div>
      
      {/* Content */}
      <div className="p-6 space-y-6">
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="flex items-center justify-end gap-3 p-6 border-t bg-muted/20">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}

/**
 * TEAM CARD SKELETON
 * Used for: Dashboard team cards, Team list
 */
export function TeamCardSkeleton({ className }: { className?: string }) {
  return (
    <div 
      className={cn(
        "rounded-lg border bg-card p-6 space-y-4",
        "animate-pulse",
        className
      )}
      data-skeleton-type="team-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded" />
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t">
        {[1, 2, 3].map((i) => (
          <div key={i} className="text-center space-y-2">
            <Skeleton className="h-6 w-12 mx-auto" />
            <Skeleton className="h-3 w-16 mx-auto" />
          </div>
        ))}
      </div>
      
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    </div>
  );
}

/**
 * TEAM GRID SKELETON
 */
export function TeamGridSkeleton({ 
  teams = 6,
  className 
}: { 
  teams?: number;
  className?: string;
}) {
  return (
    <div 
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",
        className
      )}
      data-skeleton-type="team-grid"
    >
      {Array.from({ length: teams }).map((_, i) => (
        <TeamCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * ISSUE DETAIL SKELETON
 * Full issue detail modal content
 */
export function IssueDetailSkeleton({ className }: { className?: string }) {
  return (
    <div 
      className={cn("space-y-6", className)}
      data-skeleton-type="issue-detail"
    >
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <Skeleton className="h-7 w-3/4" />
      </div>
      
      {/* Description */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="space-y-2 p-4 rounded-lg border bg-muted/20">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </div>
      
      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          <Skeleton className="h-5 w-24" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
        
        {/* Right Column */}
        <div className="space-y-4">
          <Skeleton className="h-5 w-24" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
      
      {/* Sub-issues Table */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <TableSkeleton rows={3} columns={4} showHeader />
      </div>
    </div>
  );
}

/**
 * PAGE SKELETON
 * Full page layout with header and content
 */
export function PageSkeleton({ className }: { className?: string }) {
  return (
    <div 
      className={cn("min-h-screen flex flex-col", className)}
      data-skeleton-type="page"
    >
      <HeaderSkeleton />
      
      <div className="flex flex-1">
        <aside className="hidden md:block w-64 border-r">
          <SidebarSkeleton />
        </aside>
        
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-24" />
            </div>
            
            {/* Title */}
            <Skeleton className="h-8 w-64" />
            
            {/* Stats */}
            <StatsGridSkeleton />
            
            {/* Content */}
            <div className="space-y-4">
              <Skeleton className="h-6 w-48" />
              <KanbanBoardSkeleton />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * COMPACT SKELETON
 * Minimal skeleton for small spaces
 */
export function CompactSkeleton({ 
  lines = 2,
  className 
}: { 
  lines?: number;
  className?: string;
}) {
  return (
    <div 
      className={cn("space-y-2", className)}
      data-skeleton-type="compact"
    >
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={cn(
            "h-3",
            i === lines - 1 ? "w-2/3" : "w-full"
          )} 
        />
      ))}
    </div>
  );
}
