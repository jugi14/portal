/**
 * Initialize Superadmin List - One-time Setup
 * 
 * This script initializes the superadmin list in KV store
 * Run this if you see errors about missing superadmin:emails key
 * 
 * Usage:
 *   deno run --allow-net --allow-env tests/manual/initializeSuperadmins.ts
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables");
  Deno.exit(1);
}

const SERVER_URL = `${SUPABASE_URL}/functions/v1/make-server-7f0d90fb`;

async function initializeSuperadmins() {
  console.log("[Init] Initializing superadmin list...");
  
  // Default superadmin emails - CHANGE THESE TO YOUR ACTUAL SUPERADMINS
  const superadminEmails = [
    "admin@teifi.com",
    "superadmin@teifi.com"
  ];
  
  console.log("[Init] Superadmin emails to initialize:", superadminEmails);
  
  try {
    const response = await fetch(`${SERVER_URL}/superadmin/initialize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        emails: superadminEmails
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log("[Init] SUCCESS: Superadmin list initialized");
      console.log("[Init] Result:", result);
    } else {
      if (result.error && result.error.includes("already initialized")) {
        console.log("[Init] INFO: Superadmin list already initialized");
        console.log("[Init] This is normal - no action needed");
      } else {
        console.error("[Init] ERROR:", result.error);
      }
    }
  } catch (error) {
    console.error("[Init] Failed to initialize superadmin list:", error);
    Deno.exit(1);
  }
}

console.log("=".repeat(60));
console.log("SUPERADMIN INITIALIZATION SCRIPT");
console.log("=".repeat(60));
console.log("");

await initializeSuperadmins();

console.log("");
console.log("=".repeat(60));
console.log("INITIALIZATION COMPLETE");
console.log("=".repeat(60));
