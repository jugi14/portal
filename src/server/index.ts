/**
 * Teifi Digital Client Portal - Server Entry Point
 *
 * Schema V2.0 - Clean Architecture with Modular Routes
 *
 * Architecture:
 * - User > Customer > Team (Simple hierarchy)
 * - Role-based access control (6 roles)
 * - Linear.app integration with caching
 * - KV-based data storage
 *
 * Security:
 * - Whitelisted CORS origins
 * - httpOnly cookie authentication (planned)
 * - CSRF protection (planned)
 *
 * @version 2.1.2
 * @module index
 * @updated 2025-10-19 - Force recompile for GraphQL cycles fix
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";

// Import modular routes
import { systemRoutes } from "./routes/systemRoutes";
import { adminRoutes } from "./routes/adminRoutes";
import { userRoutes } from "./routes/userRoutes";
import { teamRoutes } from "./routes/teamRoutes";
import { linearRoutes } from "./routes/linearRoutes";
import { linearMaintenanceRoutes } from "./routes/linearMaintenanceRoutes";
import { issueRoutes } from "./routes/issueRoutes";
import { superadminRoutes } from "./routes/superadminRoutes";

// Initialize Hono app
const app = new Hono();

// ==================================================
// MIDDLEWARE SETUP
// ==================================================

// CORS - Whitelist specific origins for security
// SECURITY FIX: Changed from origin: "*" to whitelist per Guidelines.md
const ALLOWED_ORIGINS = [
  "http://localhost:5173", // Vite default
  "http://localhost:3000", // Alternative dev port
  "http://127.0.0.1:5173", // Localhost alternative
  "http://127.0.0.1:3000", // Localhost alternative
  "https://fwltshzniolrekqhtpgv.supabase.co", // Supabase hosted
  "https://dashboard.teifi.work", // Production domain
  // Vercel URLs (dynamic)
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ...(process.env.NEXT_PUBLIC_VERCEL_URL ? [`https://${process.env.NEXT_PUBLIC_VERCEL_URL}`] : []),
].filter(Boolean);

app.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow same-origin requests (no origin header)
      if (!origin) return origin;

      // Check if origin is in whitelist
      if (ALLOWED_ORIGINS.includes(origin)) {
        return origin;
      }

      // Log rejected origins for monitoring
      console.warn("[CORS] Rejected origin:", origin);
      return null;
    },
    allowMethods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
      "OPTIONS",
    ],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-CSRF-Token",
    ],
    exposeHeaders: ["Content-Length"],
    maxAge: 86400,
    credentials: true,
  }),
);

// Logger - Track all requests
app.use("*", logger(console.log));

// ==================================================
// MOUNT ROUTES
// ==================================================

const PREFIX = "/make-server-7f0d90fb";

// System routes (health, status, migrations) - No auth required
app.route(PREFIX, systemRoutes);

// Admin routes (users, customers, permissions) - Auth required
app.route(PREFIX, adminRoutes);

// User routes (team access, permissions) - Auth required
app.route(PREFIX, userRoutes);

// Team routes (hierarchy, access, assignments) - Auth required
app.route(PREFIX, teamRoutes);

// Linear routes (teams, issues, GraphQL) - Auth required
app.route(PREFIX, linearRoutes);

// Linear maintenance routes (cleanup, validation) - Auth required
app.route(PREFIX, linearMaintenanceRoutes);

// Issue routes (Linear issue management with caching) - Auth required
app.route(PREFIX, issueRoutes);

// Superadmin routes (KV-based management with audit trail) - Auth required
app.route(PREFIX, superadminRoutes);

// ==================================================
// DEBUG ROUTES (DEVELOPMENT ONLY)
// ==================================================

// Debug: Clear ownership cache
app.post(`${PREFIX}/debug/clear-ownership-cache`, async (c) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    
    // Delete ownership cache from KV
    const { error } = await supabase
      .from('kv_store_7f0d90fb')
      .delete()
      .eq('key', 'team_ownership_map:all');
    
    if (error) {
      console.error('[Debug] Error clearing ownership cache:', error);
      return c.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }
    
    console.log('[Debug] Ownership cache cleared successfully');
    
    return c.json({
      success: true,
      message: 'Ownership cache cleared',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Debug] Unexpected error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
});

// Debug: Inspect ownership data
app.get(`${PREFIX}/debug/ownership-data`, async (c) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    
    // Get all team ownership mappings
    const { data: ownershipData, error: ownershipError } = await supabase
      .from('kv_store_7f0d90fb')
      .select('key, value')
      .like('key', 'team:%:customer');
    
    if (ownershipError) {
      return c.json({
        success: false,
        error: ownershipError.message
      }, { status: 500 });
    }
    
    // Get cache status
    const { data: cacheData } = await supabase
      .from('kv_store_7f0d90fb')
      .select('key, value')
      .eq('key', 'team_ownership_map:all')
      .single();
    
    // Build ownership map for display
    const ownershipMap: Record<string, string> = {};
    if (ownershipData) {
      for (const row of ownershipData) {
        const teamId = row.key.replace('team:', '').replace(':customer', '');
        ownershipMap[teamId] = row.value;
      }
    }
    
    return c.json({
      success: true,
      data: {
        directMappings: ownershipData?.length || 0,
        ownershipMap,
        cacheExists: !!cacheData,
        cacheAge: cacheData?.value?.timestamp ? 
          Date.now() - cacheData.value.timestamp : null,
        rawData: ownershipData
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Debug] Error inspecting ownership data:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
});

// ==================================================
// ROOT & FALLBACK
// ==================================================

// Root endpoint
app.get("/", (c) => {
  return c.json({
    name: "Teifi Digital Client Portal API",
    version: "2.0.0",
    status: "operational",
    architecture: "Clean & Modular",
    endpoints: {
      system: `${PREFIX}/health`,
      admin: `${PREFIX}/admin/stats`,
      teams: `${PREFIX}/teams/my-teams`,
      linear: `${PREFIX}/linear/test`,
      issues: `${PREFIX}/issues/team/:teamId`,
      superadmin: `${PREFIX}/superadmin/list`,
    },
    documentation:
      "https://github.com/teifi-digital/client-portal",
    timestamp: new Date().toISOString(),
  });
});

// Fallback for unknown routes
app.all("*", (c) => {
  return c.json(
    {
      success: false,
      error: "Endpoint not found",
      path: c.req.path,
      method: c.req.method,
      available_prefixes: [PREFIX],
    },
    { status: 404 },
  );
});

// ==================================================
// START SERVER
// ==================================================

// Export app for Vercel serverless function
export default app;

// Only start server if not in Vercel environment
if (process.env.VERCEL !== '1') {
  const port = parseInt(process.env.PORT || "3001", 10);

  console.log("Starting Teifi Digital Client Portal Server...");
  console.log(`Server listening on port ${port}`);

  serve({
    fetch: app.fetch,
    port,
  }, (info) => {
    console.log(`Server ready at http://localhost:${info.port}`);
  });
}

