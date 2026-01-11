/**
 * System Routes - Teifi Client Portal
 * 
 * Health checks, system status, migrations
 * 
 * @module systemRoutes
 */

import { Hono } from "hono";
import { supabase } from "../authHelpers";
import * as authHelpers from "../authHelpers";
import { adminHelpers } from "../helpers/adminHelpers";
import { migrationService } from "../services/migrationService";
import * as kv from "../kv_store";

export const systemRoutes = new Hono();

// ==================================================
// AUTHENTICATION
// ==================================================

/**
 * POST /auth/user-login
 * User login and permission setup - Schema V2.0
 * Creates/updates user record and returns permissions
 * REQUIRES: Authorization Bearer token
 */
systemRoutes.post("/auth/user-login", async (c) => {
  try {
    // Extract and validate access token
    const authHeader = c.req.header("Authorization");
    const accessToken = authHeader?.split(" ")[1];

    if (!accessToken) {
      console.error('[Auth] Missing authorization header');
      return c.json(
        { success: false, error: "No access token provided" },
        { status: 401 }
      );
    }

    // Use checkAuthPermissions helper for unified auth logic
    const authCheck = await authHelpers.checkAuthPermissions(accessToken);

    if (!authCheck.authorized || !authCheck.user) {
      console.error('[Auth] Authentication failed:', authCheck.error);
      return c.json(
        { success: false, error: authCheck.error || "Authentication failed" },
        { status: 401 }
      );
    }

    const { user, userPermissions, role, isSuperAdmin } = authCheck;
    const email = user.email || "";
    const name = user.user_metadata?.name || user.user_metadata?.full_name || email.split("@")[0];
    const avatar_url = user.user_metadata?.avatar_url || null;


    // Schema V2.0: Use user ID from auth (already validated by checkAuthPermissions)
    const userId = user.id;
    
    // Get or create user object in KV
    let userData = await kv.get(`user:${userId}`);
    const isNewUser = !userData;
    
    if (userData) {
      // Existing user - update
      
      userData.name = name;
      userData.avatar_url = avatar_url;
      userData.updatedAt = new Date().toISOString();
      userData.lastLoginAt = new Date().toISOString();
      // DO NOT update role here - it's managed by admin panel
      
      await kv.set(`user:${userId}`, userData);
    } else {
      // New user - create with role from authHelpers
      
      userData = {
        id: userId,
        email: email.toLowerCase(),
        name,
        avatar_url,
        role, // From authHelpers default role logic
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        metadata: { name }
      };
      
      await kv.set(`user:${userId}`, userData);
      await kv.set(`user:${userId}:customers`, []); // Initialize empty customer list
    }

    // Use role from KV (source of truth for existing users)
    const finalRole = userData.role;
    
    // Get permissions array from authHelpers (no duplication)
    const roleDefinition = authHelpers.ENHANCED_ROLE_DEFINITIONS[finalRole];
    const permissions = roleDefinition?.permissions || [];


    // Return standardized response (matches PermissionContext expectations)
    return c.json({
      success: true,
      data: {
        user: {
          id: userId,
          email: email.toLowerCase(),
          name,
          avatar_url,
          role: finalRole,
          status: userData.status || "active",
        },
        permission: {
          role: finalRole,
          status: userData.status || "active",
          customer_id: null, // Schema V2.0: customers handled via user:{id}:customers
        },
        permissions,
      },
      message: isNewUser ? "Welcome! Access granted." : "Welcome back!",
    });
  } catch (error) {
    console.error("[Auth] Login error:", error);
    return c.json(
      {
        success: false,
        error: "Authentication failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
});

// ==================================================
// HEALTH & STATUS
// ==================================================

/**
 * GET /health
 * Health check endpoint (no auth required)
 * Lightweight check without database queries to avoid auth issues
 */
systemRoutes.get("/health", async (c) => {
  try {
    // Lightweight KV check only - no database queries
    const timestamp = new Date().toISOString();
    
    // Quick KV availability test
    let kvAvailable = true;
    try {
      await kv.get("_health_check_ping");
      kvAvailable = true;
    } catch (e) {
      kvAvailable = false;
    }

    // Match HealthCheckResponse interface from frontend
    return c.json({
      success: true,
      message: "Server is healthy",
      timestamp,
      version: "2.1.0",
      environment: process.env.NODE_ENV || "production",
      services: {
        server: "operational",
        kv_store: kvAvailable ? "operational" : "degraded",
        endpoints: {
          auth: "available",
          admin: "available", 
          teams: "available",
          issues: "available"
        }
      },
    });
  } catch (error) {
    console.error("[System] Health check failed:", error);
    return c.json(
      {
        success: false,
        message: "Health check failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
});

/**
 * GET /status
 * System status endpoint (no auth required)
 */
systemRoutes.get("/status", async (c) => {
  return c.json({
    success: true,
    status: "online",
    version: "2.0.0",
    schema: "v2.0",
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: "available",
      admin: "available",
      teams: "available",
      issues: "available",
    },
  });
});

/**
 * GET /debug/kv/:key
 * Debug KV storage - get specific key value
 * Used by window.debugKVStorage() utility
 */
systemRoutes.get("/debug/kv/:key", async (c) => {
  try {
    const encodedKey = c.req.param("key");
    const key = decodeURIComponent(encodedKey);
    
    
    const value = await kv.get(key);
    
    if (!value) {
      return c.json({
        success: false,
        error: "Key not found"
      }, { status: 404 });
    }
    
    return c.json({
      success: true,
      key,
      value,
      type: Array.isArray(value) ? 'array' : typeof value
    });
    
  } catch (error) {
    console.error('[Debug] Get KV key error:', error);
    return c.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to get KV key" 
      },
      { status: 500 }
    );
  }
});

/**
 * PUT /debug/kv/:key
 * Debug KV storage - update specific key value
 * Used by window.cleanupKVStorage() utility to fix double-encoded data
 */
systemRoutes.put("/debug/kv/:key", async (c) => {
  try {
    const encodedKey = c.req.param("key");
    const key = decodeURIComponent(encodedKey);
    const { value } = await c.req.json();
    
    
    await kv.set(key, value);
    
    return c.json({
      success: true,
      key,
      message: "Key updated successfully"
    });
    
  } catch (error) {
    console.error('[Debug] Update KV key error:', error);
    return c.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to update KV key" 
      },
      { status: 500 }
    );
  }
});

/**
 * DELETE /debug/kv/:key
 * Debug KV storage - delete specific key
 * Used by window.cleanupKVStorage() utility
 */
systemRoutes.delete("/debug/kv/:key", async (c) => {
  try {
    const encodedKey = c.req.param("key");
    const key = decodeURIComponent(encodedKey);
    
    
    await kv.del(key);
    
    return c.json({
      success: true,
      key,
      message: "Key deleted successfully"
    });
    
  } catch (error) {
    console.error('[Debug] Delete KV key error:', error);
    return c.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to delete KV key" 
      },
      { status: 500 }
    );
  }
});

/**
 * GET /debug/kv-all
 * Debug KV storage - get all keys
 * Used by window.cleanupKVStorage() utility
 */
systemRoutes.get("/debug/kv-all", async (c) => {
  try {
    
    // Get all keys with common prefixes
    const prefixes = ['user:', 'customer:', 'team:', 'linear_', 'user_permissions:', 'admin_'];
    const allKeys: string[] = [];
    
    for (const prefix of prefixes) {
      const keys = await kv.getByPrefix(prefix);
      if (Array.isArray(keys)) {
        allKeys.push(...keys.map(k => typeof k === 'string' ? k : k.key || '').filter(Boolean));
      }
    }
    
    // Remove duplicates
    const uniqueKeys = [...new Set(allKeys)];
    
    
    return c.json({
      success: true,
      keys: uniqueKeys,
      count: uniqueKeys.length
    });
    
  } catch (error) {
    console.error('[Debug] Get all keys error:', error);
    return c.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to get all keys" 
      },
      { status: 500 }
    );
  }
});

/**
 * GET /debug/kv-check
 * Debug KV storage - check specific key structure
 * For debugging Admin Teams sync issues
 */
systemRoutes.get("/debug/kv-check", async (c) => {
  try {
    const key = c.req.query("key") || "linear_teams:all";
    
    
    const rawValue = await kv.get(key);
    
    let parsed = rawValue;
    let valueType = typeof rawValue;
    let parseError = null;
    
    // Try parsing if string
    if (typeof rawValue === 'string') {
      try {
        parsed = JSON.parse(rawValue);
      } catch (err) {
        parseError = err instanceof Error ? err.message : 'Parse error';
        console.error('[Debug] Failed to parse:', err);
      }
    }
    
    return c.json({
      success: true,
      key,
      exists: !!rawValue,
      rawType: valueType,
      rawPreview: typeof rawValue === 'string' 
        ? rawValue.substring(0, 200) + '...'
        : rawValue,
      parsed: parsed ? {
        type: typeof parsed,
        hasTeams: !!parsed?.teams,
        teamsCount: parsed?.teams?.length || 0,
        teamsPreview: parsed?.teams?.slice(0, 2) || [],
        hasHierarchy: !!parsed?.hierarchy,
        hierarchyCount: parsed?.hierarchy?.length || 0,
        keys: parsed ? Object.keys(parsed) : []
      } : null,
      parseError
    });
    
  } catch (error) {
    console.error('[Debug] KV check error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
});

// ==================================================
// MIGRATIONS
// ==================================================

/**
 * POST /migrate/schema-v2
 * Run schema v2 migration (superadmin only)
 */
systemRoutes.post("/migrate/schema-v2", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json(
        { success: false, error: "Missing authorization header" },
        { status: 401 },
      );
    }

    const accessToken = authHeader.split(" ")[1];
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (!user || error) {
      return c.json(
        { success: false, error: "Authentication failed" },
        { status: 401 },
      );
    }

    // Use shared superadmin check from authHelpers
    const { isSuperAdminUser } = await import("../authHelpers");
    const isSuperAdmin = await isSuperAdminUser(user.email || "");

    if (!isSuperAdmin) {
      return c.json(
        { success: false, error: "Superadmin access required" },
        { status: 403 },
      );
    }


    const result = await migrationService.migrateToSchemaV2();

    if (!result.success) {
      return c.json(
        { success: false, error: result.error },
        { status: 500 },
      );
    }

    return c.json({
      success: true,
      message: "Schema v2 migration completed successfully",
      data: result.data,
    });
  } catch (error) {
    console.error("[Migration] Migration failed:", error);
    return c.json(
      { success: false, error: "Migration failed" },
      { status: 500 },
    );
  }
});

/**
 * GET /migrate/status
 * Check migration status
 */
systemRoutes.get("/migrate/status", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json(
        { success: false, error: "Missing authorization header" },
        { status: 401 },
      );
    }

    const accessToken = authHeader.split(" ")[1];
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (!user || error) {
      return c.json(
        { success: false, error: "Authentication failed" },
        { status: 401 },
      );
    }

    // Get migration status from KV
    const migrationStatus = await kv.get("migration_status");

    return c.json({
      success: true,
      data: {
        current_schema: "v2.0",
        migration_completed: true,
        last_migration: migrationStatus || null,
      },
    });
  } catch (error) {
    console.error("[Migration] Get status failed:", error);
    return c.json(
      { success: false, error: "Failed to get migration status" },
      { status: 500 },
    );
  }
});

// ==================================================
// SYSTEM DIAGNOSTICS (Admin only)
// ==================================================

/**
 * GET /diagnostics
 * Get system diagnostics
 */
systemRoutes.get("/diagnostics", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json(
        { success: false, error: "Missing authorization header" },
        { status: 401 },
      );
    }

    const accessToken = authHeader.split(" ")[1];
    const authCheck = await authHelpers.checkAuthPermissions(accessToken);

    if (!authCheck.authorized || !authCheck.user) {
      return c.json(
        { success: false, error: "Authentication failed" },
        { status: 401 },
      );
    }

    // Check admin permission (from authCheck)
    const { role } = authCheck;
    if (role !== "admin" && role !== "superadmin") {
      return c.json(
        { success: false, error: "Admin access required" },
        { status: 403 },
      );
    }

    // Schema V2.0: Get diagnostics data
    const usersCount = await kv.getByPrefix("user:");
    const customersCount = await kv.getByPrefix("customer:");
    const teamsCount = await kv.getByPrefix("team:");

    return c.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        kv_storage: {
          users: usersCount.length,
          customers: customersCount.length,
          teams: teamsCount.length,
        },
        database: {
          connected: true,
        },
        schema_version: "v2.0",
      },
    });
  } catch (error) {
    console.error("[System] Diagnostics failed:", error);
    return c.json(
      { success: false, error: "Failed to get diagnostics" },
      { status: 500 },
    );
  }
});

