import React from 'react';
import { cn } from './utils';

interface LoadingProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'dots' | 'pulse' | 'bars';
  text?: string;
  fullScreen?: boolean;
}

export function Loading({ 
  className, 
  size = 'md', 
  variant = 'default', 
  text,
  fullScreen = false 
}: LoadingProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl'
  };

  const LoadingSpinner = () => (
    <div className={cn(
      "animate-spin rounded-full border-2 border-primary/20 border-t-primary",
      sizeClasses[size],
      className
    )} />
  );

  const LoadingDots = () => (
    <div className="flex space-x-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            "rounded-full bg-primary animate-pulse",
            size === 'sm' ? 'h-1 w-1' : 
            size === 'md' ? 'h-2 w-2' :
            size === 'lg' ? 'h-3 w-3' : 'h-4 w-4'
          )}
          style={{
            animationDelay: `${i * 0.2}s`,
            animationDuration: '1.4s'
          }}
        />
      ))}
    </div>
  );

  const LoadingPulse = () => (
    <div className={cn(
      "rounded-full bg-primary animate-pulse",
      sizeClasses[size],
      className
    )} />
  );

  const LoadingBars = () => (
    <div className="flex space-x-1 items-end">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            "bg-primary animate-pulse",
            size === 'sm' ? 'w-1 h-4' : 
            size === 'md' ? 'w-1.5 h-6' :
            size === 'lg' ? 'w-2 h-8' : 'w-3 h-12'
          )}
          style={{
            animationDelay: `${i * 0.15}s`,
            animationDuration: '1.2s'
          }}
        />
      ))}
    </div>
  );

  const renderSpinner = () => {
    switch (variant) {
      case 'dots':
        return <LoadingDots />;
      case 'pulse':
        return <LoadingPulse />;
      case 'bars':
        return <LoadingBars />;
      default:
        return <LoadingSpinner />;
    }
  };

  const content = (
    <div className={cn(
      "flex flex-col items-center justify-center space-y-2",
      fullScreen && "min-h-screen"
    )}>
      {renderSpinner()}
      {text && (
        <p className={cn(
          "text-muted-foreground animate-pulse",
          textSizeClasses[size]
        )}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
}

// Specialized loading components
export function PageLoading({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
      <div className="text-center space-y-4">
        <div className="relative">
          <Loading size="xl" variant="default" />
          {/* Add subtle glow effect */}
          <div className="absolute inset-0 animate-ping">
            <Loading size="xl" className="opacity-20" />
          </div>
        </div>
        {text && (
          <div className="space-y-2">
            <p className="text-lg font-medium text-foreground animate-pulse">
              {text}
            </p>
            <div className="flex justify-center">
              <div className="flex space-x-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-primary rounded-full animate-bounce"
                    style={{
                      animationDelay: `${i * 0.2}s`,
                      animationDuration: '1s'
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ComponentLoading({ text }: { text?: string }) {
  return (
    <div className="flex items-center justify-center p-8">
      <Loading size="md" text={text} />
    </div>
  );
}

export function InlineLoading({ text }: { text?: string }) {
  return (
    <div className="flex items-center space-x-2">
      <Loading size="sm" />
      {text && <span className="text-sm text-muted-foreground">{text}</span>}
    </div>
  );
}

export function ButtonLoading() {
  return <Loading size="sm" className="mr-2" />;
}