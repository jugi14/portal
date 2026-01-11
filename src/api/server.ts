/**
 * Vercel Serverless Function Entry Point (Source)
 * 
 * This file is the source for the serverless function
 * It will be bundled by esbuild into api/server.js
 */

import { handle } from "hono/vercel";
import app from "../server/index";

export default handle(app);

