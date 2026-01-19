/**
 * Vercel Serverless Function Entry Point (Source)
 *
 * This file is the source for the serverless function
 * It will be bundled by esbuild into api/server.js
 */

import app from "../server/index";

// Export handler for Vercel Edge/Serverless
// Using Hono's native fetch handler instead of @hono/node-server/vercel
// This avoids body parsing issues with the node-server adapter
export default app.fetch;
