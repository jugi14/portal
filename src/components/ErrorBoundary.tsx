import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { AlertTriangle, RefreshCw, Bug, Copy } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  context?: string; // Add context for better debugging
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    retryCount: 0
  };

  public static getDerivedStateFromError(error: Error): State {
    // Generate unique error ID for tracking
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return { hasError: true, error, errorId, retryCount: 0 };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const context = this.props.context || 'Unknown';
    const errorReport = {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      errorId: this.state.errorId
    };

    console.error('🚨 ErrorBoundary caught an error:', errorReport);
    
    // Log to console for development
    if (process.env.NODE_ENV === 'development') {
      console.group('Error Boundary Details');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Context:', context);
      console.groupEnd();
    }
    
    // Show toast notification
    toast.error(`Application Error in ${context}`, {
      description: error.message,
      duration: 5000,
    });
    
    this.setState({
      error,
      errorInfo,
    });
  }

  private handleRetry = () => {
    const newRetryCount = this.state.retryCount + 1;
    
    if (newRetryCount > 3) {
      toast.error('Too many retry attempts. Please reload the page.');
      return;
    }
    
    console.log(`Retrying... Attempt ${newRetryCount}`);
    toast.info(`Retrying... (${newRetryCount}/3)`);
    
    this.setState({ 
      hasError: false, 
      error: undefined, 
      errorInfo: undefined,
      retryCount: newRetryCount
    });
  };

  private handleReload = () => {
    toast.info('Reloading application...');
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  private handleCopyError = () => {
    const errorDetails = {
      errorId: this.state.errorId,
      error: this.state.error?.message,
      stack: this.state.error?.stack,
      context: this.props.context,
      timestamp: new Date().toISOString(),
      url: window.location.href
    };
    
    navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2))
      .then(() => {
        toast.success('Error details copied to clipboard');
      })
      .catch(() => {
        toast.error('Failed to copy error details');
      });
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/20">
          <Card className="w-full max-w-2xl shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-destructive">
                  <div className="p-2 rounded-full bg-destructive/10">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <div>Something went wrong</div>
                    {this.props.context && (
                      <div className="text-sm font-normal text-muted-foreground">
                        in {this.props.context}
                      </div>
                    )}
                  </div>
                </CardTitle>
                {this.state.errorId && (
                  <Badge variant="outline" className="text-xs">
                    ID: {this.state.errorId.split('_')[1]}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">
                  An unexpected error occurred while loading this component. 
                  This might be a temporary issue that can be resolved by retrying.
                </p>
                
                {this.state.error && (
                  <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg text-left">
                    <div className="flex items-start gap-3">
                      <Bug className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-destructive mb-1">
                          Error Details:
                        </p>
                        <p className="text-sm font-mono text-destructive/80 break-words">
                          {this.state.error.message}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap gap-3 justify-center">
                <Button 
                  onClick={this.handleRetry} 
                  variant="outline" 
                  size="sm"
                  disabled={this.state.retryCount >= 3}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again {this.state.retryCount > 0 && `(${this.state.retryCount}/3)`}
                </Button>
                
                <Button onClick={this.handleReload} size="sm">
                  Reload Page
                </Button>
                
                <Button 
                  onClick={this.handleCopyError} 
                  variant="outline" 
                  size="sm"
                  className="text-muted-foreground"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Error
                </Button>
              </div>

              <div className="text-center text-xs text-muted-foreground">
                <p>If this problem persists, please contact support with the error ID above.</p>
              </div>
              
              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <details className="mt-6">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                    Developer Information (Click to expand)
                  </summary>
                  <div className="mt-3 space-y-3">
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-xs font-medium mb-2">Error Stack:</p>
                      <pre className="text-xs overflow-auto whitespace-pre-wrap">
                        {this.state.error?.stack}
                      </pre>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-xs font-medium mb-2">Component Stack:</p>
                      <pre className="text-xs overflow-auto whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}