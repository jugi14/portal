/**
 * Vercel Serverless Function Entry Point
 *
 * This file wraps the Node.js server for Vercel deployment
 * Vercel expects a default export that handles requests
 */

import { handle } from "hono/vercel";
import app from "../src/server/index";

// Export for Vercel serverless function
export default handle(app);
