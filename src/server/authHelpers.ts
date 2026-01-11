/**
 * Authentication Helpers - Teifi Client Portal
 * 
 * Centralized authentication, authorization, and role management
 * Schema V2.0 - Unified User > Customer > Team architecture
 * 
 * @module authHelpers
 */

import { createClient } from "@supabase/supabase-js";
import * as kv from "./kv_store";

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ==================================================
// ROLE HIERARCHY & PERMISSIONS
// ==================================================

export const ROLE_HIERARCHY = {
  superadmin: 100,
  admin: 80,
  client_manager: 60,
  client_user: 40,
  tester: 30,
  viewer: 10,
} as const;

export type Role = keyof typeof ROLE_HIERARCHY;

/**
 * REFACTORED: KV-based superadmin management with caching
 * Get superadmin emails from KV store with 5-minute cache
 * Falls back to environment variable if KV store fails
 */
export async function getSuperadminEmails(): Promise<string[]> {
  try {
    // Check cache first (5 minute TTL)
    const cacheKey = "system:superadmins:cache";
    
    // CRITICAL: Wrap kv.get() in try-catch to handle missing keys gracefully
    let cached;
    try {
      cached = await kv.get(cacheKey);
    } catch (cacheError) {
      // Cache key doesn't exist yet - this is OK, silently continue
      // No log needed - this is expected on first run
    }
    
    if (cached && typeof cached === 'object' && 'emails' in cached && 'timestamp' in cached) {
      const cacheAge = Date.now() - new Date(cached.timestamp as string).getTime();
      const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
      
      if (cacheAge < CACHE_TTL) {
        return cached.emails as string[];
      }
    }
    
    // Fetch from KV store
    let superadmins;
    try {
      superadmins = await kv.get("superadmin:emails");
    } catch (kvError) {
      // Main key doesn't exist - use fallback and auto-initialize
      const fallbackEmails = getFallbackSuperadmins();
      
      if (fallbackEmails.length > 0) {
        // Auto-initialize KV store with fallback
        try {
          await kv.set("superadmin:emails", fallbackEmails);
          console.log("[Auth] Auto-initialized superadmin list from fallback:", fallbackEmails.length, "emails");
        } catch (initError) {
          console.warn("[Auth] Failed to auto-initialize superadmin list:", initError);
        }
      }
      
      return fallbackEmails;
    }
    
    if (!superadmins || !Array.isArray(superadmins)) {
      console.warn("[Auth] No superadmin list in KV (invalid data), using fallback");
      return getFallbackSuperadmins();
    }
    
    // Update cache
    try {
      await kv.set(cacheKey, {
        emails: superadmins,
        timestamp: new Date().toISOString(),
        ttl: 5 * 60 * 1000
      });
    } catch (setCacheError) {
      // Cache update failed - not critical, silently continue
      // This is expected if cache table doesn't exist yet
    }
    
    return superadmins;
  } catch (error) {
    console.error("[Auth] Error fetching superadmin list:", error);
    return getFallbackSuperadmins();
  }
}

/**
 * Fallback superadmin list from environment variable
 * Used if KV store fails or is not initialized
 */
function getFallbackSuperadmins(): string[] {
  const fallback = process.env.SUPERADMIN_EMAILS_FALLBACK;
  
  if (fallback) {
    return fallback.split(",").map(email => email.trim().toLowerCase());
  }
  
  // No default fallback - KV store must be initialized
  console.error("[Auth] CRITICAL: No superadmin list in KV store and no fallback configured");
  return [];
}

// Teifi employee domains
const TEIFI_DOMAINS = ["@teifi.com", "@teifi.ca"];

// Default roles by domain
const DEFAULT_ROLES = {
  "@teifi.com": "admin",
  "@teifi.ca": "admin",
  default: "viewer",
} as const;

// ==================================================
// ROLE DEFINITIONS WITH PERMISSIONS
// ==================================================

export const ENHANCED_ROLE_DEFINITIONS = {
  superadmin: {
    name: "Super Administrator",
    role: "superadmin" as Role,
    description: "Complete system access, manage all customers and global settings",
    permissions: [
      "view_issues",
      "create_issues",
      "edit_issues",
      "delete_issues",
      "view_project_status",
      "manage_users",
      "manage_permissions",
      "access_linear_test",
      "view_analytics",
      "export_data",
      "manage_system",
      "manage_customers",
      "manage_teams",
      "view_admin",
      "access_all_customers",
      "manage_security",
    ],
  },
  admin: {
    name: "Administrator",
    role: "admin" as Role,
    description: "Manage users and customers within assigned scope",
    permissions: [
      "view_issues",
      "create_issues",
      "edit_issues",
      "delete_issues",
      "view_project_status",
      "manage_users",
      "manage_permissions",
      "access_linear_test",
      "view_analytics",
      "export_data",
      "manage_customers",
      "manage_teams",
      "view_admin",
    ],
  },
  client_manager: {
    name: "Client Manager",
    role: "client_manager" as Role,
    description: "Manage team members and view analytics",
    permissions: [
      "view_issues",
      "create_issues",
      "edit_issues",
      "view_project_status",
      "manage_permissions",
      "view_analytics",
    ],
  },
  client_user: {
    name: "Client User",
    role: "client_user" as Role,
    description: "Create and manage own issues",
    permissions: [
      "view_issues",
      "create_issues",
      "edit_issues",
      "view_project_status",
    ],
  },
  tester: {
    name: "Tester",
    role: "tester" as Role,
    description: "Test features and report bugs",
    permissions: [
      "view_issues",
      "create_issues",
      "view_project_status",
    ],
  },
  viewer: {
    name: "Viewer",
    role: "viewer" as Role,
    description: "View-only access to assigned projects",
    permissions: ["view_issues", "view_project_status"],
  },
};

// ==================================================
// UTILITY FUNCTIONS
// ==================================================

/**
 * REFACTORED: Get default role based on user email domain (async)
 */
export async function getDefaultRole(email: string): Promise<Role> {
  if (await isSuperAdminUser(email)) return "superadmin";
  if (email.includes("@teifi.com")) return DEFAULT_ROLES["@teifi.com"] as Role;
  if (email.includes("@teifi.ca")) return DEFAULT_ROLES["@teifi.ca"] as Role;
  return DEFAULT_ROLES.default as Role;
}

/**
 * Check if user has specific permission
 */
export function hasPermission(
  userRole: Role,
  permission: string,
  isSuperAdmin = false,
): boolean {
  if (isSuperAdmin || userRole === "superadmin") return true;

  const roleDefinition = ENHANCED_ROLE_DEFINITIONS[userRole];
  return roleDefinition?.permissions.includes(permission) || false;
}

/**
 * Check if user has required role level
 */
export function hasRoleLevel(userRole: Role, requiredRole: Role): boolean {
  if (userRole === "superadmin") return true;

  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
}

/**
 * REFACTORED: Check if user is superadmin (KV-based with cache)
 * @param email User email to check
 * @returns Promise<boolean>
 */
export async function isSuperAdminUser(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const superadmins = await getSuperadminEmails();
  return superadmins.includes(normalizedEmail);
}

/**
 * Check if user is Teifi employee
 */
export function isTeifiUser(email: string): boolean {
  return TEIFI_DOMAINS.some(domain => email.includes(domain));
}

// ==================================================
// AUTHENTICATION MIDDLEWARE
// ==================================================

/**
 * Enhanced auth check with automatic permissions
 */
export async function checkAuthPermissions(
  accessToken: string,
  requiredPermission?: string,
  requiredRole?: Role,
) {
  try {
    // Get user from token
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (!user || error) {
      return {
        authorized: false,
        user: null,
        userPermissions: null,
        role: 'viewer' as Role,
        error: error?.message || "Authentication failed",
        isSuperAdmin: false,
      };
    }

    // Normalize email for consistent checks
    const userEmail = (user.email || "").toLowerCase().trim();

    // PERFORMANCE: Run all async calls in parallel
    const [userObj, defaultRole, isSuperAdminByEmail] = await Promise.all([
      kv.get(`user:${user.id}`),
      getDefaultRole(userEmail),
      isSuperAdminUser(userEmail),
    ]);
    const isTeifi = isTeifiUser(userEmail); // Synchronous

    // Schema V2.0: Auto-create user object if not exists
    if (!userObj) {
      const name = user.user_metadata?.name || user.user_metadata?.full_name || userEmail.split('@')[0];
      
      userObj = {
        id: user.id,
        email: userEmail,
        role: defaultRole,
        status: "active", // All users auto-active
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { name }
      };
      
      await kv.set(`user:${user.id}`, userObj);
      await kv.set(`user:${user.id}:customers`, []); // Initialize empty customer list
      
      console.log(
        `[Auth] Created ${defaultRole} user: ${userEmail} (${
          isSuperAdminByEmail ? "superadmin" : isTeifi ? "Teifi admin" : "customer user"
        })`,
      );
    } else {
      // Override role for designated superadmins
      if (isSuperAdminByEmail && userObj.role !== "superadmin") {
        console.log(
          `[Auth] Correcting role for superadmin ${userEmail}: ${userObj.role} -> superadmin`,
        );
        userObj.role = "superadmin";
        userObj.status = "active";
        userObj.updatedAt = new Date().toISOString();
        await kv.set(`user:${user.id}`, userObj);
      }
      
      // AUTO-ACTIVATE ALL PENDING USERS
      if (userObj.status === "pending") {
        console.log(
          `[Auth] Auto-activating user ${userEmail}: pending -> active`,
        );
        userObj.status = "active";
        userObj.updatedAt = new Date().toISOString();
        await kv.set(`user:${user.id}`, userObj);
        
        console.log(`[Auth] User ${userEmail} activated successfully (role: ${defaultRole})`);
      }
    }

    // Determine final role BEFORE checking status
    const userRole = (isSuperAdminByEmail ? "superadmin" : userObj.role) as Role;
    const isSuperAdmin = userRole === "superadmin" || isSuperAdminByEmail;

    // Check if user is active
    if (userObj.status !== "active") {
      console.error(
        `[Auth] Authentication failed for ${userEmail}: Status=${userObj.status}, Role=${userRole}, IsTeifi=${isTeifi}, IsSuperAdmin=${isSuperAdmin}`
      );
      return {
        authorized: false,
        user,
        userPermissions: userObj,
        role: userRole,
        error: `Account status: ${userObj.status}. Please contact an administrator.`,
        isSuperAdmin,
      };
    }
    
    console.log(`[Auth] Authentication successful for ${userEmail}: Role=${userRole}, Status=${userObj.status}`);

    // Check required permission
    if (requiredPermission && !hasPermission(userRole, requiredPermission, isSuperAdmin)) {
      return {
        authorized: false,
        user,
        userPermissions: userObj,
        role: userRole,
        error: `Missing required permission: ${requiredPermission}`,
        isSuperAdmin,
      };
    }

    // Check required role level
    if (requiredRole && !hasRoleLevel(userRole, requiredRole)) {
      return {
        authorized: false,
        user,
        userPermissions: userObj,
        role: userRole,
        error: `Insufficient role level. Required: ${requiredRole}, Current: ${userRole}`,
        isSuperAdmin,
      };
    }

    return {
      authorized: true,
      user,
      userPermissions: userObj,
      role: userRole,
      isSuperAdmin,
      error: null,
    };
  } catch (error) {
    console.error("[Auth] Authentication error:", error);
    return {
      authorized: false,
      user: null,
      userPermissions: null,
      role: 'viewer' as Role,
      error: "Authentication failed",
      isSuperAdmin: false,
    };
  }
}

/**
 * Auth middleware for Hono routes
 * PERFORMANCE: Cache auth check within the same request to avoid duplicate calls
 */
export async function authMiddleware(c: any, next: any) {
  // PERFORMANCE: Check if auth already done in this request
  const cachedAuth = c.get("_authCheck");
  if (cachedAuth) {
    // Reuse cached auth result
    c.set("user", cachedAuth.user);
    c.set("userPermissions", cachedAuth.userPermissions);
    c.set("role", cachedAuth.role);
    c.set("isSuperAdmin", cachedAuth.isSuperAdmin);
    await next();
    return;
  }

  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(
      { success: false, error: "Missing or invalid authorization header" },
      { status: 401 },
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const authCheck = await checkAuthPermissions(accessToken);

  if (!authCheck.authorized) {
    return c.json(
      { success: false, error: authCheck.error || "Unauthorized" },
      { status: 401 },
    );
  }

  // Cache auth result for this request
  c.set("_authCheck", authCheck);

  // Attach user info to context
  c.set("user", authCheck.user);
  c.set("userPermissions", authCheck.userPermissions);
  c.set("role", authCheck.role);
  c.set("isSuperAdmin", authCheck.isSuperAdmin);

  await next();
}

/**
 * Admin-only middleware
 */
export async function adminMiddleware(c: any, next: any) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(
      { success: false, error: "Missing or invalid authorization header" },
      { status: 401 },
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const authCheck = await checkAuthPermissions(accessToken, "manage_users");

  if (!authCheck.authorized) {
    return c.json(
      { success: false, error: authCheck.error || "Admin access required" },
      { status: 403 },
    );
  }

  // Attach user info to context
  c.set("user", authCheck.user);
  c.set("userPermissions", authCheck.userPermissions);
  c.set("role", authCheck.role);
  c.set("isSuperAdmin", authCheck.isSuperAdmin);

  await next();
}

export { supabase };

