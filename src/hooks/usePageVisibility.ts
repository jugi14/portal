import { useEffect, useState, useRef } from 'react';

/**
 * Page Visibility Hook
 * 
 * Tracks page visibility state and provides callbacks for when page becomes visible/hidden
 * Useful for:
 * - Pausing/resuming animations
 * - Stopping/starting timers
 * - Optimizing performance when tab is hidden
 */
export function usePageVisibility(
  onVisible?: () => void,
  onHidden?: () => void
) {
  const [isVisible, setIsVisible] = useState(!document.hidden);
  const onVisibleRef = useRef(onVisible);
  const onHiddenRef = useRef(onHidden);

  // Keep refs updated
  useEffect(() => {
    onVisibleRef.current = onVisible;
    onHiddenRef.current = onHidden;
  }, [onVisible, onHidden]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsVisible(visible);

      if (visible) {
        console.log('[Visibility] Page is now visible');
        // Clear the hidden timestamp when page becomes visible
        sessionStorage.removeItem('tab_hidden_at');
        onVisibleRef.current?.();
      } else {
        console.log('[Visibility] Page is now hidden');
        // Set timestamp when page becomes hidden
        sessionStorage.setItem('tab_hidden_at', Date.now().toString());
        onHiddenRef.current?.();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial state
    handleVisibilityChange();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isVisible;
}

/**
 * Focus Management Hook
 * 
 * Tracks window focus state
 */
export function useWindowFocus(
  onFocus?: () => void,
  onBlur?: () => void
) {
  const [isFocused, setIsFocused] = useState(document.hasFocus());
  const onFocusRef = useRef(onFocus);
  const onBlurRef = useRef(onBlur);

  useEffect(() => {
    onFocusRef.current = onFocus;
    onBlurRef.current = onBlur;
  }, [onFocus, onBlur]);

  useEffect(() => {
    const handleFocus = () => {
      console.log('[Focus] Window focused');
      setIsFocused(true);
      onFocusRef.current?.();
    };

    const handleBlur = () => {
      console.log('[Focus] Window blurred');
      setIsFocused(false);
      onBlurRef.current?.();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  return isFocused;
}

/**
 * Activity Tracker Hook
 * 
 * Tracks user activity and detects inactivity
 */
export function useActivityTracker(
  inactivityTimeout: number = 30 * 60 * 1000 // 30 minutes default
) {
  const [isActive, setIsActive] = useState(true);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const updateActivity = () => {
      setLastActivity(Date.now());
      setIsActive(true);

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new inactivity timeout
      timeoutRef.current = setTimeout(() => {
        console.log('[Activity] User inactive for', inactivityTimeout / 1000, 'seconds');
        setIsActive(false);
      }, inactivityTimeout);
    };

    // Activity events
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      window.addEventListener(event, updateActivity);
    });

    // Initialize
    updateActivity();

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [inactivityTimeout]);

  return {
    isActive,
    lastActivity,
    timeSinceLastActivity: Date.now() - lastActivity,
  };
}
