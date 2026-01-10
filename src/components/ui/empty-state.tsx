import React from 'react';
import { Button } from './button';
import { cn } from './utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'ghost';
  };
  className?: string;
}

export function EmptyState({ 
  icon, 
  title, 
  description, 
  action, 
  className 
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center space-y-4 py-12", 
      className
    )}>
      {icon && (
        <div className="text-muted-foreground">
          {icon}
        </div>
      )}
      
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && (
          <p className="text-muted-foreground max-w-md">
            {description}
          </p>
        )}
      </div>
      
      {action && (
        <Button 
          variant={action.variant || 'outline'} 
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}