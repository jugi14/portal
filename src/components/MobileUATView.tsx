/**
 * Mobile UAT View - Column Selector + Task List
 * 
 * Mobile-first design with:
 * - Column selector buttons (not kanban)
 * - Vertical task list
 * - Compact card layout
 * - Filter controls
 * 
 * Follows Teifi Digital brand guidelines
 */

import React, { useState, useMemo } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Clock,
  AlertCircle,
  CheckCircle,
  Rocket,
  XCircle,
  ChevronDown,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import type { ClientTaskColumn, ClientTaskCardData } from '../types/clientColumns';

interface MobileUATViewProps {
  columns: ClientTaskColumn[];
  tasks: ClientTaskCardData[];
  onTaskClick: (task: ClientTaskCardData) => void;
}

const COLUMN_ICONS = {
  'client-review': Clock,
  'blocked': AlertCircle,
  'done': CheckCircle,
  'released': Rocket,
  'failed-review': XCircle,
};

const COLUMN_COLORS = {
  'client-review': 'bg-[#1492ff] text-white border-[#1492ff]',
  'blocked': 'bg-background text-foreground border-border hover:bg-muted',
  'done': 'bg-background text-foreground border-border hover:bg-muted',
  'released': 'bg-background text-foreground border-border hover:bg-muted',
  'failed-review': 'bg-background text-foreground border-border hover:bg-muted',
};

export function MobileUATView({ columns, tasks, onTaskClick }: MobileUATViewProps) {
  const [selectedColumnId, setSelectedColumnId] = useState<string>('client-review');
  const [sortBy, setSortBy] = useState<string>('latest');
  const [filterBy, setFilterBy] = useState<string>('all');

  // Get tasks for selected column
  const selectedColumnTasks = useMemo(() => {
    const column = columns.find(c => c.id === selectedColumnId);
    if (!column) return [];
    
    let filtered = column.tasks || [];

    // Apply filters
    if (filterBy === 'has-subtasks') {
      filtered = filtered.filter(t => (t.subIssueCount || 0) > 0);
    } else if (filterBy === 'no-subtasks') {
      filtered = filtered.filter(t => (t.subIssueCount || 0) === 0);
    }

    // Apply sorting
    if (sortBy === 'latest') {
      filtered = [...filtered].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else if (sortBy === 'oldest') {
      filtered = [...filtered].sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }

    return filtered;
  }, [columns, selectedColumnId, sortBy, filterBy]);

  // Count total tasks and sub-tasks
  const totalTasks = selectedColumnTasks.length;
  const totalSubTasks = selectedColumnTasks.reduce((sum, t) => sum + (t.subIssueCount || 0), 0);

  return (
    <div className="mobile-uat-view h-full flex flex-col">
      {/* Header */}
      <div className="mobile-uat-header sticky top-0 z-20 bg-card border-b border-border">
        <div className="p-4 pb-3">
          <h2 className="font-manrope text-lg mb-3">UAT Tasks</h2>

          {/* Column Selector */}
          <div className="space-y-2">
            {columns.map((column) => {
              const Icon = COLUMN_ICONS[column.id as keyof typeof COLUMN_ICONS] || Clock;
              const isSelected = column.id === selectedColumnId;
              const colorClass = isSelected ? COLUMN_COLORS['client-review'] : COLUMN_COLORS[column.id as keyof typeof COLUMN_COLORS];

              return (
                <button
                  key={column.id}
                  onClick={() => setSelectedColumnId(column.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all ${colorClass}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{column.title}</span>
                  </div>
                  <Badge variant="secondary" className={isSelected ? 'bg-white/20 text-white border-white/30' : ''}>
                    {column.tasks?.length || 0}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 pb-3 flex gap-2">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterBy} onValueChange={setFilterBy}>
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="has-subtasks">Has Sub-tasks</SelectItem>
              <SelectItem value="no-subtasks">No Sub-tasks</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="px-4 pb-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{totalTasks} tasks</span>
          {totalSubTasks > 0 && <span>+{totalSubTasks} sub-tasks</span>}
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {selectedColumnTasks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No tasks in this column</p>
          </div>
        ) : (
          selectedColumnTasks.map((task) => (
            <MobileTaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface MobileTaskCardProps {
  task: ClientTaskCardData;
  onClick: () => void;
}

function MobileTaskCard({ task, onClick }: MobileTaskCardProps) {
  const isClientReview = task.labels?.nodes?.some(l => 
    l.name.toLowerCase().includes('client') && l.name.toLowerCase().includes('review')
  );

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card border-2 border-border rounded-xl p-4 hover:border-primary/50 transition-colors"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground font-medium">
            {task.identifier}
          </span>
          {task.subIssueCount && task.subIssueCount > 0 && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200 text-xs px-2 py-0">
              {task.subIssueCount}
            </Badge>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium mb-3 line-clamp-2">
        {task.title}
      </h3>

      {/* Footer */}
      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
        {isClientReview && (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 px-2 py-0">
            Client Review
          </Badge>
        )}
        
        {task.assigneeNames && task.assigneeNames.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-xs">
              +{task.assigneeNames.length}
            </span>
          </div>
        )}
        
        {task.createdAt && (
          <span>
            {new Date(task.createdAt).toLocaleDateString('en-US', { 
              month: '2-digit', 
              day: '2-digit', 
              year: 'numeric' 
            })}
          </span>
        )}
      </div>
    </button>
  );
}