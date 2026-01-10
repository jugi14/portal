import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Button } from './ui/button';
import { getAppVersion } from '../utils/versionCheck';

/**
 * Cache Clear Banner
 * 
 * Shows notification when app version changes, prompting user to hard refresh.
 * Automatically hides after successful reload or manual dismissal.
 */
export function CacheClearBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    const currentVersion = getAppVersion();
    const storedVersion = localStorage.getItem('app_version');
    
    // Show banner if version mismatch detected
    if (storedVersion && storedVersion !== currentVersion) {
      setShowBanner(true);
      
      // Auto-refresh after 10 seconds
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            handleRefresh();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(countdownInterval);
    }
  }, []);

  const handleRefresh = () => {
    // Force hard refresh to clear cache
    window.location.reload();
  };

  const handleDismiss = () => {
    setShowBanner(false);
    // Update stored version to prevent banner showing again
    localStorage.setItem('app_version', getAppVersion());
  };

  if (!showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-orange-500 text-white shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">App Update Available</p>
              <p className="text-sm text-white/90">
                A new version is available. Please refresh to get the latest features and fixes.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              className="bg-white text-orange-600 hover:bg-orange-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Now ({countdown}s)
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-white hover:bg-orange-600"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
