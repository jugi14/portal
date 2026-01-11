/**
 * Vercel Serverless Function Entry Point (Source)
 *
 * This file is the source for the serverless function
 * It will be bundled by esbuild into api/server.js
 */

import { handle } from "@hono/node-server/vercel";
import app from "../server/index";

// Export handler for Vercel using @hono/node-server/vercel adapter
// This properly converts Vercel's request format to Hono's expected format
export default handle(app);
