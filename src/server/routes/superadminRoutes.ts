/**
 * Superadmin Management Routes - Teifi Client Portal
 * 
 * KV-based superadmin management with full audit trail
 * Schema V2.0 - Dynamic superadmin list with security
 * 
 * SECURITY FEATURES:
 * - KV store for dynamic management
 * - Full audit trail (who, what, when, where)
 * - Cannot self-remove
 * - Cannot remove last superadmin
 * - Environment variable fallback
 * - 5-minute cache for performance
 * 
 * @module superadminRoutes
 */

import { Hono } from "hono";
import * as kv from "../kv_store";
import { authMiddleware, getSuperadminEmails } from "../authHelpers";

export const superadminRoutes = new Hono();

/**
 * Helper: Check if user is superadmin
 * Uses cached getSuperadminEmails from authHelpers (5-minute cache)
 */
async function checkIsSuperAdmin(email: string): Promise<boolean> {
  try {
    const superadmins = await getSuperadminEmails();
    return superadmins.includes(email.toLowerCase().trim());
  } catch (error) {
    console.error("[SuperadminRoutes] Error checking superadmin status:", error);
    return false;
  }
}

/**
 * POST /superadmin/initialize
 * CRITICAL: Initialize superadmin list (one-time setup)
 * 
 * Authorization: NO AUTH REQUIRED (only works if list is empty)
 * Security: Can only be called once when KV store is empty
 * Body: { emails: string[] }
 * Returns: Initialization confirmation
 */
superadminRoutes.post("/superadmin/initialize", async (c) => {
  try {
    // Check if superadmin list already exists
    const existingSuperadmins = await kv.get("superadmin:emails");
    
    if (existingSuperadmins && Array.isArray(existingSuperadmins) && existingSuperadmins.length > 0) {
      console.warn("[SuperadminRoutes] Initialization attempt when list already exists");
      return c.json(
        { success: false, error: "Superadmin list already initialized" },
        { status: 400 }
      );
    }
    
    const body = await c.req.json();
    const { emails } = body;
    
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return c.json(
        { success: false, error: "Invalid email list" },
        { status: 400 }
      );
    }
    
    // Normalize and validate emails
    const normalizedEmails = emails.map((email: string) => email.toLowerCase().trim());
    const validEmails = normalizedEmails.filter((email: string) => email.includes("@"));
    
    if (validEmails.length === 0) {
      return c.json(
        { success: false, error: "No valid emails provided" },
        { status: 400 }
      );
    }
    
    // Initialize list
    await kv.set("superadmin:emails", validEmails);
    
    // Initialize settings
    await kv.set("superadmin:settings", {
      enableDynamicSuperadmins: true,
      requireMFA: false,
      maxSuperadmins: 10,
      allowSelfRemoval: false
    });
    
    // Create audit log
    const auditKey = `audit:superadmin:initialize:${Date.now()}`;
    await kv.set(auditKey, {
      action: "superadmin_initialized",
      emails: validEmails,
      timestamp: new Date().toISOString(),
      count: validEmails.length
    });
    
    console.log(`[SuperadminRoutes] Initialized with ${validEmails.length} superadmins`);
    
    return c.json({
      success: true,
      data: {
        superadmins: validEmails,
        count: validEmails.length
      }
    });
  } catch (error) {
    console.error("[SuperadminRoutes] Error initializing:", error);
    return c.json(
      { success: false, error: "Failed to initialize superadmin list" },
      { status: 500 }
    );
  }
});

// CRITICAL: Apply auth middleware AFTER initialize endpoint
// This allows /initialize to work without auth (one-time setup)
superadminRoutes.use("*", authMiddleware);

/**
 * GET /superadmin/check
 * Check if current user is a superadmin
 * 
 * Authorization: Any authenticated user
 * Returns: Boolean indicating superadmin status
 */
superadminRoutes.get("/superadmin/check", async (c) => {
  try {
    const user = c.get("user");
    const userEmail = (user.email || "").toLowerCase().trim();
    
    // Check if current user is superadmin
    const isSuperAdmin = await checkIsSuperAdmin(userEmail);
    
    console.log(`[SuperadminRoutes] Check by ${userEmail}: ${isSuperAdmin}`);
    
    return c.json({
      success: true,
      data: { 
        isSuperAdmin,
        email: userEmail
      }
    });
  } catch (error) {
    console.error("[SuperadminRoutes] Error checking superadmin status:", error);
    return c.json(
      { success: false, error: "Failed to check superadmin status" },
      { status: 500 }
    );
  }
});

/**
 * GET /superadmin/list
 * Get all superadmin emails
 * 
 * Authorization: Any authenticated user (returns list only if user is superadmin)
 * Returns: Array of superadmin email addresses or empty array
 * 
 * SECURITY NOTE: This endpoint is accessible to all authenticated users
 * to prevent circular dependency (need list to check if superadmin).
 * However, it only returns the actual list if the requester is a superadmin.
 * 
 * PERFORMANCE: Uses 5-minute cache via getSuperadminEmails()
 */
superadminRoutes.get("/superadmin/list", async (c) => {
  try {
    const user = c.get("user");
    const userEmail = (user.email || "").toLowerCase().trim();
    
    // OPTIMIZED: Get cached superadmin list (5-minute TTL)
    const superadmins = await getSuperadminEmails();
    
    // Check if current user is superadmin
    const isSuperAdmin = superadmins.includes(userEmail);
    
    if (!isSuperAdmin) {
      // Return empty array for non-superadmins (not an error)
      console.log(`[SuperadminRoutes] Non-superadmin ${userEmail} checked list - returning empty`);
      return c.json({
        success: true,
        data: { 
          superadmins: [],
          count: 0,
          isSuperAdmin: false
        }
      });
    }
    
    // Return full list for superadmins
    console.log(`[SuperadminRoutes] List fetched by superadmin ${userEmail}, count: ${superadmins.length}`);
    
    return c.json({
      success: true,
      data: { 
        superadmins,
        count: superadmins.length,
        isSuperAdmin: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[SuperadminRoutes] Error fetching list:", error);
    return c.json(
      { success: false, error: "Failed to fetch superadmin list" },
      { status: 500 }
    );
  }
});

/**
 * POST /superadmin/add
 * Add new superadmin email
 * 
 * Authorization: Requires superadmin access
 * Body: { email: string, reason?: string }
 * Returns: Added email confirmation
 */
superadminRoutes.post("/superadmin/add", async (c) => {
  try {
    const user = c.get("user");
    
    // Check if current user is superadmin
    const isSuperAdmin = await checkIsSuperAdmin(user.email || "");
    
    if (!isSuperAdmin) {
      console.warn(`[SuperadminRoutes] Unauthorized add attempt by ${user.email}`);
      return c.json(
        { success: false, error: "Superadmin access required" },
        { status: 403 }
      );
    }
    
    const body = await c.req.json();
    const { email, reason } = body;
    
    // Validate email
    if (!email || typeof email !== 'string' || !email.includes("@")) {
      return c.json(
        { success: false, error: "Invalid email address" },
        { status: 400 }
      );
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    
    // Get current superadmin list
    const superadmins = await kv.get("superadmin:emails") || [];
    
    // Check if already exists
    if (superadmins.includes(normalizedEmail)) {
      return c.json(
        { success: false, error: "Email already in superadmin list" },
        { status: 400 }
      );
    }
    
    // Add to list
    const updatedList = [...superadmins, normalizedEmail];
    await kv.set("superadmin:emails", updatedList);
    
    // Create audit log
    const auditKey = `audit:superadmin:add:${Date.now()}`;
    await kv.set(auditKey, {
      action: "superadmin_added",
      email: normalizedEmail,
      addedBy: user.email,
      timestamp: new Date().toISOString(),
      ip: c.req.header("x-forwarded-for") || "unknown",
      userAgent: c.req.header("user-agent"),
      reason: reason || null
    });
    
    // Clear caches
    await kv.mdel(["system:superadmins:cache", "system:superadmin:audit:cache"]);
    
    console.log(`[SuperadminRoutes] Added: ${normalizedEmail} by ${user.email}`);
    
    return c.json({
      success: true,
      data: { 
        email: normalizedEmail,
        addedBy: user.email,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("[SuperadminRoutes] Error adding superadmin:", error);
    return c.json(
      { success: false, error: "Failed to add superadmin" },
      { status: 500 }
    );
  }
});

/**
 * DELETE /superadmin/remove/:email
 * Remove superadmin email
 * 
 * Authorization: Requires superadmin access
 * Restrictions:
 * - Cannot remove self
 * - Cannot remove last superadmin
 * Returns: Removal confirmation
 */
superadminRoutes.delete("/superadmin/remove/:email", async (c) => {
  try {
    const user = c.get("user");
    
    // Check if current user is superadmin
    const isSuperAdmin = await checkIsSuperAdmin(user.email || "");
    
    if (!isSuperAdmin) {
      console.warn(`[SuperadminRoutes] Unauthorized remove attempt by ${user.email}`);
      return c.json(
        { success: false, error: "Superadmin access required" },
        { status: 403 }
      );
    }
    
    const emailToRemove = decodeURIComponent(c.req.param("email")).toLowerCase().trim();
    
    // Prevent self-removal
    if (emailToRemove === user.email?.toLowerCase()) {
      console.warn(`[SuperadminRoutes] Self-removal attempt by ${user.email}`);
      return c.json(
        { success: false, error: "Cannot remove yourself from superadmin list" },
        { status: 400 }
      );
    }
    
    // Get current superadmin list
    const superadmins = await kv.get("superadmin:emails") || [];
    
    // Check if exists
    if (!superadmins.includes(emailToRemove)) {
      return c.json(
        { success: false, error: "Email not in superadmin list" },
        { status: 404 }
      );
    }
    
    // Prevent removing last superadmin
    if (superadmins.length === 1) {
      console.warn(`[SuperadminRoutes] Attempt to remove last superadmin by ${user.email}`);
      return c.json(
        { success: false, error: "Cannot remove last superadmin" },
        { status: 400 }
      );
    }
    
    // Remove from list
    const updatedList = superadmins.filter((e: string) => e !== emailToRemove);
    await kv.set("superadmin:emails", updatedList);
    
    // Create audit log
    const auditKey = `audit:superadmin:remove:${Date.now()}`;
    await kv.set(auditKey, {
      action: "superadmin_removed",
      email: emailToRemove,
      removedBy: user.email,
      timestamp: new Date().toISOString(),
      ip: c.req.header("x-forwarded-for") || "unknown",
      userAgent: c.req.header("user-agent")
    });
    
    // Clear caches
    await kv.mdel(["system:superadmins:cache", "system:superadmin:audit:cache"]);
    
    console.log(`[SuperadminRoutes] Removed: ${emailToRemove} by ${user.email}`);
    
    return c.json({
      success: true,
      data: { 
        email: emailToRemove,
        removedBy: user.email,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("[SuperadminRoutes] Error removing superadmin:", error);
    return c.json(
      { success: false, error: "Failed to remove superadmin" },
      { status: 500 }
    );
  }
});

/**
 * GET /superadmin/audit
 * Get superadmin audit trail
 * 
 * Authorization: Requires superadmin access
 * Returns: Array of audit log entries (sorted newest first, max 100)
 * 
 * PERFORMANCE OPTIMIZED:
 * - Uses mget() to batch fetch logs (1 query instead of N)
 * - 5-minute cache for audit trail
 * - Limits to 100 most recent logs
 */
superadminRoutes.get("/superadmin/audit", async (c) => {
  try {
    const user = c.get("user");
    
    // Check if current user is superadmin
    const isSuperAdmin = await checkIsSuperAdmin(user.email || "");
    
    if (!isSuperAdmin) {
      console.warn(`[SuperadminRoutes] Unauthorized audit access by ${user.email}`);
      return c.json(
        { success: false, error: "Superadmin access required" },
        { status: 403 }
      );
    }
    
    // Check cache first (5 minute TTL)
    const cacheKey = "system:superadmin:audit:cache";
    const cached = await kv.get(cacheKey);
    
    if (cached && typeof cached === 'object' && 'logs' in cached && 'timestamp' in cached) {
      const cacheAge = Date.now() - new Date(cached.timestamp as string).getTime();
      const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
      
      if (cacheAge < CACHE_TTL) {
        console.log(`[SuperadminRoutes] Audit cache hit by ${user.email}`);
        return c.json({
          success: true,
          data: { 
            logs: cached.logs,
            count: (cached.logs as any[]).length,
            cached: true
          }
        });
      }
    }
    
    // PERFORMANCE FIX: Batch fetch all audit logs using mget()
    const auditKeys = await kv.getByPrefix("audit:superadmin:");
    
    if (!auditKeys || auditKeys.length === 0) {
      console.log(`[SuperadminRoutes] No audit logs found`);
      return c.json({
        success: true,
        data: { 
          logs: [],
          count: 0
        }
      });
    }
    
    // Use mget() to fetch all logs in ONE query instead of N queries
    const logs = await kv.mget(auditKeys);
    
    // Filter out null values and sort by timestamp (newest first)
    const validLogs = logs
      .filter((log): log is NonNullable<typeof log> => log !== null)
      .sort((a: any, b: any) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    
    // Limit to 100 most recent logs for performance
    const limitedLogs = validLogs.slice(0, 100);
    
    // Update cache
    await kv.set(cacheKey, {
      logs: limitedLogs,
      timestamp: new Date().toISOString(),
      ttl: 5 * 60 * 1000
    });
    
    console.log(`[SuperadminRoutes] Audit fetched by ${user.email}, count: ${limitedLogs.length} (total: ${validLogs.length})`);
    
    return c.json({
      success: true,
      data: { 
        logs: limitedLogs,
        count: limitedLogs.length,
        total: validLogs.length,
        cached: false
      }
    });
  } catch (error) {
    console.error("[SuperadminRoutes] Error fetching audit:", error);
    return c.json(
      { success: false, error: "Failed to fetch audit trail" },
      { status: 500 }
    );
  }
});
