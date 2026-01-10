import React, { useState, useCallback } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { ScrollArea } from "./ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { 
  Clock, 
  Eye,
  Package,
  Truck,
  Filter,
  EyeOff,
  MoreHorizontal,
  ArrowUp,
  AlertTriangle,
  MessageSquare,
  Paperclip,
  User,
  Ban,
  CheckCircle
} from "lucide-react";

const ITEM_TYPE = "KANBAN_ITEM";

// Standard 4-column Kanban workflow
export const KANBAN_COLUMNS = [
  {
    title: "Awaiting Input",
    status: "awaiting-input",
    icon: <Clock className="h-4 w-4 text-gray-600" />,
    color: "bg-gray-100",
    description: "Client Blocked",
    bgColor: "bg-gray-50",
    textColor: "text-gray-700"
  },
  {
    title: "Under Review", 
    status: "under-review",
    icon: <Eye className="h-4 w-4 text-blue-600" />,
    color: "bg-blue-100",
    description: "Client Review",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700"
  },
  {
    title: "Approved",
    status: "approved",
    icon: <CheckCircle className="h-4 w-4 text-green-600" />,
    color: "bg-green-100",
    description: "Release Ready",
    bgColor: "bg-green-50",
    textColor: "text-green-700"
  },
  {
    title: "Delivered",
    status: "delivered",
    icon: <Truck className="h-4 w-4 text-indigo-600" />,
    color: "bg-indigo-100",
    description: "Shipped",
    bgColor: "bg-indigo-50",
    textColor: "text-indigo-700"
  }
] as const;

// Types
export interface KanbanItem {
  id: string;
  identifier: string;
  title: string;
  status: typeof KANBAN_COLUMNS[number]['status'];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee?: {
    name: string;
    avatar?: string;
    initials: string;
  };
  epic?: string;
  progress?: number;
  commentsCount?: number;
  attachmentsCount?: number;
  dueDate?: string;
  tags?: string[];
  type?: 'bug' | 'feature' | 'task' | 'feedback';
}

export interface KanbanColumn {
  title: string;
  status: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  bgColor?: string;
  textColor?: string;
}

interface KanbanBoardProps {
  items: KanbanItem[];
  columns?: KanbanColumn[];
  onItemMove: (itemId: string, newStatus: string) => void;
  onItemClick?: (item: KanbanItem) => void;
  title?: string;
  className?: string;
  compact?: boolean;
}

interface DragItem {
  id: string;
  status: string;
  index: number;
}

// Compact Issue Card Component
function IssueCard({ 
  item, 
  index, 
  onClick,
  compact = false 
}: { 
  item: KanbanItem; 
  index: number; 
  onClick?: (item: KanbanItem) => void;
  compact?: boolean;
}) {
  const [{ isDragging }, drag] = useDrag({
    type: ITEM_TYPE,
    item: { id: item.id, status: item.status, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-400';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <ArrowUp className="h-3 w-3 text-red-600" />;
      case 'high': return <AlertTriangle className="h-3 w-3 text-orange-600" />;
      default: return null;
    }
  };

  const getTypeIcon = (type?: string) => {
    const baseClass = "h-3 w-3 flex-shrink-0";
    switch (type) {
      case 'bug': return <AlertTriangle className={`${baseClass} text-red-500`} />;
      case 'feature': return <Package className={`${baseClass} text-blue-500`} />;
      case 'task': return <CheckCircle className={`${baseClass} text-green-500`} />;
      case 'feedback': return <MessageSquare className={`${baseClass} text-purple-500`} />;
      default: return <Package className={`${baseClass} text-gray-500`} />;
    }
  };

  return (
    <div
      ref={drag}
      className={`
        bg-white border border-gray-200 rounded-lg shadow-sm cursor-pointer group
        transition-all duration-200 hover:shadow-md hover:border-gray-300
        ${isDragging ? 'opacity-50 scale-105 z-50' : ''}
        ${compact ? 'p-3' : 'p-4'}
      `}
      onClick={() => onClick?.(item)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs font-medium text-gray-500 truncate">
            {item.identifier}
          </span>
          {item.type && (
            <div className="flex-shrink-0">
              {getTypeIcon(item.type)}
            </div>
          )}
          {(item.priority === 'urgent' || item.priority === 'high') && (
            <div className="flex-shrink-0">
              {getPriorityIcon(item.priority)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${getPriorityColor(item.priority)}`} />
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Title */}
      <h4 className={`font-medium text-gray-900 leading-tight mb-2 ${compact ? 'text-sm line-clamp-2' : 'text-sm line-clamp-3'}`}>
        {item.title}
      </h4>

      {/* Epic/Category */}
      {item.epic && (
        <div className="flex items-center gap-1 mb-3">
          <Package className="h-3 w-3 text-gray-500" />
          <span className="text-xs text-gray-600 truncate">{item.epic}</span>
        </div>
      )}

      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {item.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs px-1 py-0">
              {tag}
            </Badge>
          ))}
          {item.tags.length > 2 && (
            <Badge variant="secondary" className="text-xs px-1 py-0">
              +{item.tags.length - 2}
            </Badge>
          )}
        </div>
      )}

      {/* Progress Bar */}
      {item.progress !== undefined && item.progress > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Progress</span>
            <span className="text-xs font-medium text-gray-700">{item.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div 
              className="bg-primary h-1.5 rounded-full transition-all duration-300" 
              style={{ width: `${item.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {item.commentsCount !== undefined && item.commentsCount > 0 && (
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3 text-gray-500" />
              <span className="text-xs text-gray-600">{item.commentsCount}</span>
            </div>
          )}
          {item.attachmentsCount !== undefined && item.attachmentsCount > 0 && (
            <div className="flex items-center gap-1">
              <Paperclip className="h-3 w-3 text-gray-500" />
              <span className="text-xs text-gray-600">{item.attachmentsCount}</span>
            </div>
          )}
        </div>
        
        {item.assignee && (
          <Tooltip>
            <TooltipTrigger>
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {item.assignee.initials}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <p>{item.assignee.name}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

// Kanban Column Component
function KanbanColumn({
  column,
  items,
  onDrop,
  onItemClick,
  compact = false
}: {
  column: KanbanColumn;
  items: KanbanItem[];
  onDrop: (itemId: string, targetStatus: string) => void;
  onItemClick?: (item: KanbanItem) => void;
  compact?: boolean;
}) {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ITEM_TYPE,
    drop: (item: DragItem) => {
      if (item.status !== column.status) {
        onDrop(item.id, column.status);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  const getColumnStats = () => {
    const total = items.length;
    const urgent = items.filter(item => item.priority === 'urgent').length;
    const high = items.filter(item => item.priority === 'high').length;
    return { total, urgent, high };
  };

  const stats = getColumnStats();

  return (
    <div
      ref={drop}
      className={`
        flex flex-col h-full transition-all duration-200
        ${compact ? 'min-w-80 max-w-80' : 'min-w-96 max-w-96'} 
        flex-shrink-0
        ${isOver && canDrop ? 'transform scale-102' : ''}
      `}
    >
      <div className={`
        flex-1 h-full flex flex-col bg-white border-2 rounded-lg shadow-sm transition-all
        ${isOver && canDrop ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}
      `}>
        {/* Column Header */}
        <div className={`
          px-4 py-4 border-b border-gray-100 
          ${isOver && canDrop ? 'bg-primary/10' : column.bgColor || 'bg-gray-50'}
        `}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 min-w-0">
              {column.icon}
              <div>
                <h3 className={`font-bold text-base ${column.textColor || 'text-gray-900'}`}>
                  {column.title}
                </h3>
                <p className="text-xs text-gray-600 mt-1">{column.description}</p>
              </div>
            </div>
            <Badge variant="secondary" className="ml-2">
              {stats.total}
            </Badge>
          </div>
          
          {(stats.urgent > 0 || stats.high > 0) && (
            <div className="flex items-center gap-3 text-xs">
              {stats.urgent > 0 && (
                <div className="flex items-center gap-1">
                  <ArrowUp className="h-3 w-3 text-red-500" />
                  <span className="text-red-600 font-medium">
                    {stats.urgent} urgent
                  </span>
                </div>
              )}
              {stats.high > 0 && (
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-orange-500" />
                  <span className="text-orange-600 font-medium">
                    {stats.high} high
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Items Area */}
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className={`p-4 space-y-3 ${compact ? 'min-h-96' : 'min-h-[500px]'}`}>
              {items.map((item, index) => (
                <IssueCard
                  key={item.id}
                  item={item}
                  index={index}
                  onClick={onItemClick}
                  compact={compact}
                />
              ))}
              
              {items.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                  <Package className="h-8 w-8 mb-2" />
                  <p className="text-sm">No items</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

// Main 4-Column Kanban Board Component
export function KanbanBoard({
  items,
  columns = KANBAN_COLUMNS,
  onItemMove,
  onItemClick,
  title,
  className = "",
  compact = false
}: KanbanBoardProps) {
  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    columns.reduce((acc, col) => ({ ...acc, [col.status]: true }), {})
  );

  const handleDrop = useCallback((itemId: string, newStatus: string) => {
    onItemMove(itemId, newStatus);
  }, [onItemMove]);

  const visibleColumnsList = columns.filter(col => visibleColumns[col.status]);

  return (
    <TooltipProvider>
      <DndProvider backend={HTML5Backend}>
        <div className={`h-full flex flex-col ${className}`}>
          {/* Header with Title and Column Filters */}
          {(title || columns.length > 4) && (
            <div className="flex-shrink-0 space-y-4 p-4">
              {title && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{title}</h2>
                </div>
              )}
              
              {/* Column Visibility Controls - only show if more than standard 4 columns */}
              {columns.length > 4 && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-gray-600" />
                        <span className="font-medium text-sm">Columns</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {columns.map((column) => (
                          <Button
                            key={column.status}
                            variant={visibleColumns[column.status] ? "default" : "outline"}
                            size="sm"
                            onClick={() => setVisibleColumns(prev => ({
                              ...prev,
                              [column.status]: !prev[column.status]
                            }))}
                            className="text-xs"
                          >
                            {visibleColumns[column.status] ? (
                              <>
                                {column.icon}
                                <span className="ml-1">{column.title}</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="h-3 w-3" />
                                <span className="ml-1">{column.title}</span>
                              </>
                            )}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* 4-Column Kanban Board */}
          <div className="flex-1 min-h-0 mx-4 mb-4">
            <div className="bg-gray-50 rounded-lg p-4 h-full">
              <ScrollArea className="w-full h-full">
                <div className="flex gap-4 pb-4 h-full min-w-max">
                  {visibleColumnsList.map((column) => {
                    const columnItems = items.filter(item => item.status === column.status);
                    return (
                      <KanbanColumn
                        key={column.status}
                        column={column}
                        items={columnItems}
                        onDrop={handleDrop}
                        onItemClick={onItemClick}
                        compact={compact}
                      />
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </DndProvider>
    </TooltipProvider>
  );
}