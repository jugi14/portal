/**
 * Vercel Serverless Function Entry Point
 * 
 * This file wraps the Hono app for Vercel deployment
 * It imports the app from src/server/index and wraps it with handle()
 */

import { handle } from "hono/vercel";
import app from "../src/server/index";

export default handle(app);

