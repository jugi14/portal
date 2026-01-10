/**
 * Linear API Rate Limit Handler
 * 
 * Handles 429 rate limit errors and implements exponential backoff
 * Linear rate limit: 1500 requests per hour
 */

interface RateLimitState {
  isLimited: boolean;
  resetAt: number | null;
  retryAfter: number | null;
  requestCount: number;
  windowStart: number;
}

class RateLimitHandler {
  private state: RateLimitState = {
    isLimited: false,
    resetAt: null,
    retryAfter: null,
    requestCount: 0,
    windowStart: Date.now()
  };
  
  private readonly MAX_REQUESTS_PER_HOUR = 1500;
  private readonly WINDOW_MS = 60 * 60 * 1000; // 1 hour
  private readonly WARNING_THRESHOLD = 0.8; // Warn at 80% usage
  
  // OPTIMIZATION: Debounce localStorage writes to prevent navigation blocking
  private saveDebounceTimer: NodeJS.Timeout | null = null;
  private readonly SAVE_DEBOUNCE_MS = 500; // Wait 500ms before saving
  
  constructor() {
    // Load state from localStorage
    this.loadState();
    
    // Reset counter every hour
    setInterval(() => this.resetWindow(), this.WINDOW_MS);
  }
  
  /**
   * Check if request can proceed
   */
  canMakeRequest(): boolean {
    // Check if rate limited
    if (this.state.isLimited) {
      const now = Date.now();
      if (this.state.resetAt && now < this.state.resetAt) {
        const remainingMs = this.state.resetAt - now;
        const remainingMin = Math.ceil(remainingMs / 60000);
        console.warn(`[RateLimit] Rate limited. Try again in ${remainingMin} minutes`);
        return false;
      } else {
        // Reset has passed
        this.clearRateLimit();
      }
    }
    
    // Check request count
    const now = Date.now();
    if (now - this.state.windowStart > this.WINDOW_MS) {
      this.resetWindow();
    }
    
    if (this.state.requestCount >= this.MAX_REQUESTS_PER_HOUR) {
      console.error('[RateLimit] Request limit reached for this hour');
      this.setRateLimit(this.WINDOW_MS);
      return false;
    }
    
    return true;
  }
  
  /**
   * Record a successful request
   * OPTIMIZATION: Uses debounced save to prevent blocking navigation
   */
  recordRequest(): void {
    this.state.requestCount++;
    
    // OPTIMIZATION: Debounce save to prevent blocking
    this.saveStateDebounced();
    
    // Warn if approaching limit
    const usage = this.state.requestCount / this.MAX_REQUESTS_PER_HOUR;
    if (usage >= this.WARNING_THRESHOLD && usage < this.WARNING_THRESHOLD + 0.05) {
      console.warn(
        `[RateLimit] API usage at ${(usage * 100).toFixed(0)}% (${this.state.requestCount}/${this.MAX_REQUESTS_PER_HOUR})`
      );
    }
  }
  
  /**
   * Handle 429 rate limit response
   */
  handle429(response: Response): void {
    console.error('[RateLimit] Rate limit exceeded (429)');
    
    // Check for Retry-After header
    const retryAfter = response.headers.get('Retry-After');
    const retryMs = retryAfter ? parseInt(retryAfter) * 1000 : this.WINDOW_MS;
    
    this.setRateLimit(retryMs);
    
    // Show user notification
    if (typeof window !== 'undefined') {
      const minutes = Math.ceil(retryMs / 60000);
      console.error(
        `[RateLimit] Rate limit exceeded. Please wait ${minutes} minute${minutes > 1 ? 's' : ''} before trying again.`
      );
    }
  }
  
  /**
   * Handle error that might be rate limit
   */
  handleError(error: any): boolean {
    if (error?.status === 429 || error?.message?.includes('rate limit')) {
      console.error('[RateLimit] Rate limit detected in error');
      this.setRateLimit(this.WINDOW_MS);
      return true;
    }
    return false;
  }
  
  /**
   * Set rate limit with retry time
   */
  private setRateLimit(retryMs: number): void {
    this.state.isLimited = true;
    this.state.resetAt = Date.now() + retryMs;
    this.state.retryAfter = retryMs;
    
    // CRITICAL: Save immediately (but only for rate limit state)
    this.saveStateImmediate();
  }
  
  /**
   * Clear rate limit
   */
  private clearRateLimit(): void {
    this.state.isLimited = false;
    this.state.resetAt = null;
    this.state.retryAfter = null;
    this.saveStateDebounced();
  }
  
  /**
   * Reset request window
   */
  private resetWindow(): void {
    this.state.requestCount = 0;
    this.state.windowStart = Date.now();
    this.saveStateDebounced();
  }
  
  /**
   * Get current usage stats
   */
  getStats() {
    return {
      requestCount: this.state.requestCount,
      maxRequests: this.MAX_REQUESTS_PER_HOUR,
      usage: (this.state.requestCount / this.MAX_REQUESTS_PER_HOUR * 100).toFixed(1),
      isLimited: this.state.isLimited,
      resetAt: this.state.resetAt,
      windowStart: this.state.windowStart
    };
  }

  
  /**
   * Save state to localStorage (DEBOUNCED)
   * OPTIMIZATION: Prevents blocking navigation with frequent localStorage writes
   */
  private saveStateDebounced(): void {
    // Clear existing timer
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    
    // Schedule save after debounce period
    this.saveDebounceTimer = setTimeout(() => {
      this.saveStateImmediate();
    }, this.SAVE_DEBOUNCE_MS);
  }
  
  /**
   * Save state to localStorage (IMMEDIATE)
   * Only used for critical state changes (rate limit triggered)
   */
  private saveStateImmediate(): void {
    try {
      localStorage.setItem('linear_rate_limit_state', JSON.stringify(this.state));
    } catch (error) {
      console.warn('[RateLimit] Failed to save state:', error);
    }
  }
  
  /**
   * Load state from localStorage
   */
  private loadState(): void {
    try {
      const saved = localStorage.getItem('linear_rate_limit_state');
      if (saved) {
        const state = JSON.parse(saved);
        const now = Date.now();
        
        // Check if reset time has passed
        if (state.resetAt && now >= state.resetAt) {
          state.isLimited = false;
          state.resetAt = null;
        }
        
        // Check if window has passed
        if (now - state.windowStart > this.WINDOW_MS) {
          state.requestCount = 0;
          state.windowStart = now;
        }
        
        this.state = state;
      }
    } catch (error) {
      console.warn('[RateLimit] Failed to load state:', error);
    }
  }
  
  /**
   * Reset all state (for testing)
   */
  reset(): void {
    this.state = {
      isLimited: false,
      resetAt: null,
      retryAfter: null,
      requestCount: 0,
      windowStart: Date.now()
    };
    this.saveStateImmediate();
  }
  
  /**
   * Flush pending saves (call before page unload)
   */
  flush(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
    this.saveStateImmediate();
  }
}

// Create singleton instance
const rateLimitHandlerInstance = new RateLimitHandler();

// Flush on page unload to save final state
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    rateLimitHandlerInstance.flush();
  });
}

// Export both default and named for backward compatibility
export const rateLimitHandler = rateLimitHandlerInstance;
export default rateLimitHandlerInstance;

/**
 * Fetch with rate limit protection
 * DEPRECATED: Use rateLimitHandler.canMakeRequest() directly
 * This is kept for backward compatibility
 */
export async function fetchWithRateLimit(
  url: string,
  options?: RequestInit
): Promise<Response> {
  // Check rate limit before making request
  if (!rateLimitHandlerInstance.canMakeRequest()) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }

  try {
    const response = await fetch(url, options);
    
    // Record successful request
    rateLimitHandlerInstance.recordRequest();
    
    // Handle 429 rate limit
    if (response.status === 429) {
      rateLimitHandlerInstance.handle429(response);
      throw new Error('Rate limit exceeded');
    }
    
    return response;
  } catch (error) {
    // Check if error is rate limit related
    rateLimitHandlerInstance.handleError(error);
    throw error;
  }
}
