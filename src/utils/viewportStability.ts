/**
 * Viewport Stability Utilities
 * 
 * Handles dynamic viewport changes across different mobile devices
 * - Visual Viewport API support
 * - Keyboard appearance detection
 * - Safe area calculations
 * - Layout shift prevention
 */

interface ViewportState {
  width: number;
  height: number;
  visualHeight: number;
  safeAreaTop: number;
  safeAreaBottom: number;
  safeAreaLeft: number;
  safeAreaRight: number;
  isKeyboardVisible: boolean;
  orientation: 'portrait' | 'landscape';
}

class ViewportStabilityManager {
  private state: ViewportState;
  private listeners: Set<(state: ViewportState) => void> = new Set();
  private resizeTimeout: number | null = null;
  private lastHeight: number = 0;

  constructor() {
    this.state = this.getCurrentState();
    this.init();
  }

  private init() {
    // Set initial CSS variables
    this.updateCSSVariables();

    // Listen to viewport changes
    if (typeof window !== 'undefined') {
      // Visual Viewport API (better than window resize)
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => this.handleViewportChange());
        window.visualViewport.addEventListener('scroll', () => this.handleViewportScroll());
      } else {
        // Fallback to window resize
        window.addEventListener('resize', () => this.handleWindowResize());
      }

      // Orientation change
      window.addEventListener('orientationchange', () => this.handleOrientationChange());

      // Focus events (keyboard detection)
      window.addEventListener('focusin', (e) => this.handleFocusIn(e));
      window.addEventListener('focusout', () => this.handleFocusOut());

      // Page visibility (handle background/foreground)
      document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
    }
  }

  private getCurrentState(): ViewportState {
    if (typeof window === 'undefined') {
      return {
        width: 0,
        height: 0,
        visualHeight: 0,
        safeAreaTop: 0,
        safeAreaBottom: 0,
        safeAreaLeft: 0,
        safeAreaRight: 0,
        isKeyboardVisible: false,
        orientation: 'portrait',
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const visualHeight = window.visualViewport?.height || height;

    // Detect keyboard visibility
    const isKeyboardVisible = visualHeight < height * 0.75;

    // Get safe area insets
    const computedStyle = getComputedStyle(document.documentElement);
    const safeAreaTop = this.parseSafeArea(computedStyle.getPropertyValue('--safe-area-top'));
    const safeAreaBottom = this.parseSafeArea(computedStyle.getPropertyValue('--safe-area-bottom'));
    const safeAreaLeft = this.parseSafeArea(computedStyle.getPropertyValue('--safe-area-left'));
    const safeAreaRight = this.parseSafeArea(computedStyle.getPropertyValue('--safe-area-right'));

    // Detect orientation
    const orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';

    return {
      width,
      height,
      visualHeight,
      safeAreaTop,
      safeAreaBottom,
      safeAreaLeft,
      safeAreaRight,
      isKeyboardVisible,
      orientation,
    };
  }

  private parseSafeArea(value: string): number {
    if (!value) return 0;
    const match = value.match(/(\d+(\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  }

  private updateCSSVariables() {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const { height, visualHeight, isKeyboardVisible } = this.state;

    // Calculate accurate vh unit (1% of viewport height)
    const vh = visualHeight * 0.01;
    root.style.setProperty('--vh-unit', `${vh}px`);
    root.style.setProperty('--visual-viewport-height', `${visualHeight}px`);

    // Set safe area insets
    root.style.setProperty('--safe-area-top', `${this.state.safeAreaTop}px`);
    root.style.setProperty('--safe-area-bottom', `${this.state.safeAreaBottom}px`);
    root.style.setProperty('--safe-area-left', `${this.state.safeAreaLeft}px`);
    root.style.setProperty('--safe-area-right', `${this.state.safeAreaRight}px`);

    // Toggle keyboard visibility class
    if (isKeyboardVisible) {
      document.body.classList.add('keyboard-visible');
    } else {
      document.body.classList.remove('keyboard-visible');
    }

    // Log viewport changes (debugging)
    if (process.env.NODE_ENV === 'development') {
      console.log('[Viewport] Updated:', {
        height,
        visualHeight,
        vh,
        isKeyboardVisible,
      });
    }
  }

  private handleViewportChange() {
    const newState = this.getCurrentState();
    
    // Detect significant changes
    const heightChanged = Math.abs(newState.visualHeight - this.state.visualHeight) > 50;
    
    if (heightChanged) {
      this.state = newState;
      this.updateCSSVariables();
      this.notifyListeners();
    }
  }

  private handleViewportScroll() {
    // Update scroll position for fixed elements
    if (window.visualViewport) {
      const scrollY = window.visualViewport.offsetTop;
      document.documentElement.style.setProperty('--viewport-scroll-y', `${scrollY}px`);
    }
  }

  private handleWindowResize() {
    // Debounce resize events
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }

    this.resizeTimeout = window.setTimeout(() => {
      this.handleViewportChange();
    }, 100);
  }

  private handleOrientationChange() {
    // Wait for orientation change to complete
    setTimeout(() => {
      this.state = this.getCurrentState();
      this.updateCSSVariables();
      this.notifyListeners();
    }, 300);
  }

  private handleFocusIn(e: FocusEvent) {
    const target = e.target as HTMLElement;
    
    // Check if focused element is an input
    if (target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    )) {
      // Keyboard likely appeared
      setTimeout(() => {
        const newState = this.getCurrentState();
        if (newState.isKeyboardVisible !== this.state.isKeyboardVisible) {
          this.state = newState;
          this.updateCSSVariables();
          this.notifyListeners();
        }
      }, 300); // Wait for keyboard animation
    }
  }

  private handleFocusOut() {
    // Keyboard likely dismissed
    setTimeout(() => {
      const newState = this.getCurrentState();
      if (newState.isKeyboardVisible !== this.state.isKeyboardVisible) {
        this.state = newState;
        this.updateCSSVariables();
        this.notifyListeners();
      }
    }, 300);
  }

  private handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      // Page became visible - recalculate viewport
      this.state = this.getCurrentState();
      this.updateCSSVariables();
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }

  /**
   * Subscribe to viewport changes
   */
  public subscribe(listener: (state: ViewportState) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current viewport state
   */
  public getState(): ViewportState {
    return { ...this.state };
  }

  /**
   * Lock body scroll (for modals)
   */
  public lockScroll() {
    if (typeof document === 'undefined') return;

    // Save current scroll position
    const scrollY = window.scrollY;
    document.body.style.top = `-${scrollY}px`;
    document.body.classList.add('modal-open');

    // Store scroll position for restoration
    document.body.dataset.scrollY = scrollY.toString();
  }

  /**
   * Unlock body scroll (close modal)
   */
  public unlockScroll() {
    if (typeof document === 'undefined') return;

    const scrollY = document.body.dataset.scrollY;
    document.body.classList.remove('modal-open');
    document.body.style.top = '';

    // Restore scroll position
    if (scrollY) {
      window.scrollTo(0, parseInt(scrollY, 10));
      delete document.body.dataset.scrollY;
    }
  }

  /**
   * Calculate available content height
   */
  public getContentHeight(headerHeight: number = 0, footerHeight: number = 0): number {
    const { visualHeight, safeAreaTop, safeAreaBottom } = this.state;
    return visualHeight - headerHeight - footerHeight - safeAreaTop - safeAreaBottom;
  }

  /**
   * Check if device is in landscape mode
   */
  public isLandscape(): boolean {
    return this.state.orientation === 'landscape';
  }

  /**
   * Check if keyboard is visible
   */
  public isKeyboardVisible(): boolean {
    return this.state.isKeyboardVisible;
  }

  /**
   * Get device type based on width
   */
  public getDeviceType(): 'small' | 'medium' | 'large' | 'tablet' | 'desktop' {
    const { width } = this.state;
    
    if (width < 375) return 'small';      // iPhone SE, small Android
    if (width < 390) return 'medium';     // iPhone 12/13, medium Android
    if (width < 768) return 'large';      // iPhone 14 Pro Max, large Android
    if (width < 1024) return 'tablet';    // iPad, tablets
    return 'desktop';
  }

  /**
   * Force viewport recalculation
   */
  public refresh() {
    this.state = this.getCurrentState();
    this.updateCSSVariables();
    this.notifyListeners();
  }
}

// Singleton instance
export const viewportStability = new ViewportStabilityManager();

/**
 * React Hook for viewport state
 */
export function useViewportStability() {
  if (typeof window === 'undefined') {
    return {
      width: 0,
      height: 0,
      visualHeight: 0,
      safeAreaTop: 0,
      safeAreaBottom: 0,
      safeAreaLeft: 0,
      safeAreaRight: 0,
      isKeyboardVisible: false,
      orientation: 'portrait' as const,
      deviceType: 'desktop' as const,
      isLandscape: false,
      lockScroll: () => {},
      unlockScroll: () => {},
      getContentHeight: () => 0,
    };
  }

  const [state, setState] = React.useState(viewportStability.getState());

  React.useEffect(() => {
    const unsubscribe = viewportStability.subscribe((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, []);

  return {
    ...state,
    deviceType: viewportStability.getDeviceType(),
    isLandscape: viewportStability.isLandscape(),
    lockScroll: () => viewportStability.lockScroll(),
    unlockScroll: () => viewportStability.unlockScroll(),
    getContentHeight: (headerHeight?: number, footerHeight?: number) =>
      viewportStability.getContentHeight(headerHeight, footerHeight),
  };
}

// Import React for hook
import React from 'react';
