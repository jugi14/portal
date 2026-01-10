# Teifi Client Portal - Local Development Setup Guide

> Complete guide to set up and run the Teifi Client Portal on your local machine

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Installation Steps](#installation-steps)
4. [Running the Application](#running-the-application)
5. [Project Structure](#project-structure)
6. [Common Issues & Troubleshooting](#common-issues--troubleshooting)
7. [Development Workflow](#development-workflow)

---

## Prerequisites

Before starting, ensure you have the following installed:

### Required Software

| Software | Minimum Version | Purpose |
|----------|----------------|---------|
| **Node.js** | 18.0.0+ | JavaScript runtime |
| **npm** or **yarn** | 8.0.0+ / 1.22.0+ | Package manager |
| **Git** | 2.0.0+ | Version control |
| **Supabase CLI** | Latest | Local Supabase development (optional) |

### Accounts Required

1. **Supabase Account** - For backend, database, and auth
   - Sign up at: https://supabase.com
   - Create a new project

2. **Linear Account** - For issue tracking integration
   - Sign up at: https://linear.app
   - Create API key with read/write permissions

### Check Installations

```bash
# Verify Node.js version
node --version  # Should be 18.0.0 or higher

# Verify npm version
npm --version   # Should be 8.0.0 or higher

# Verify Git
git --version
```

---

## Environment Variables

### Overview

The application requires **2 environment files**:

1. **Frontend** (`.env` in root directory)
2. **Backend** (`.env` in `/supabase/functions/server/`)

### 1. Frontend Environment Variables

Create a `.env` file in the **root directory**:

```bash
# .env (root directory)

#############################################
# SUPABASE CONFIGURATION
#############################################

# Supabase Project URL
# Format: https://[project-id].supabase.co
# Where to find: Supabase Dashboard > Settings > API
VITE_SUPABASE_URL=https://your-project-id.supabase.co

# Supabase Anonymous Key (Public)
# Safe to expose in frontend
# Where to find: Supabase Dashboard > Settings > API > Project API keys > anon public
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

#############################################
# LINEAR API CONFIGURATION
#############################################

# Linear API Key
# Where to get: Linear Settings > API > Personal API keys > Create key
# Permissions needed: Read issues, Read teams, Write issues, Write comments
VITE_LINEAR_API_KEY=lin_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

#############################################
# APPLICATION CONFIGURATION
#############################################

# Application Environment
# Options: development, staging, production
VITE_APP_ENV=development

# API Base URL (for local development)
# Points to local Supabase Edge Functions
VITE_API_BASE_URL=http://localhost:54321/functions/v1

# Enable debug logging
# Options: true, false
VITE_DEBUG_MODE=true
```

### 2. Backend Environment Variables

Create a `.env` file in `/supabase/functions/server/`:

```bash
# /supabase/functions/server/.env

#############################################
# SUPABASE BACKEND CONFIGURATION
#############################################

# Supabase Project URL
SUPABASE_URL=https://your-project-id.supabase.co

# Supabase Anonymous Key
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase Service Role Key (CRITICAL - KEEP SECRET)
# Where to find: Supabase Dashboard > Settings > API > service_role (secret)
# WARNING: Never commit this to version control
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase Database Direct Connection URL
# Where to find: Supabase Dashboard > Settings > Database > Connection string > URI
SUPABASE_DB_URL=postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres

#############################################
# LINEAR API CONFIGURATION
#############################################

# Linear API Key (same as frontend)
LINEAR_API_KEY=lin_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

#############################################
# OAUTH CONFIGURATION (Optional)
#############################################

# Google OAuth (if using social login)
# Where to get: Google Cloud Console > APIs & Services > Credentials
CLIENT_ID=your-google-client-id.apps.googleusercontent.com
CLIENT_SECRET=your-google-client-secret
CLIENT_TOKEN=your-oauth-token

#############################################
# SERVER CONFIGURATION
#############################################

# Port for local Supabase Edge Functions
PORT=54321

# Environment
NODE_ENV=development
```

### Environment Variable Checklist

Before proceeding, ensure you have:

- [ ] Created `.env` in root directory
- [ ] Created `.env` in `/supabase/functions/server/`
- [ ] Added all required Supabase credentials
- [ ] Added Linear API key with correct permissions
- [ ] **NOT** committed `.env` files to Git (check `.gitignore`)
- [ ] Verified all URLs use correct project ID

---

## Installation Steps

### Step 1: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/teifi-digital/client-portal.git

# Navigate to project directory
cd client-portal
```

### Step 2: Install Dependencies

```bash
# Install frontend dependencies
npm install

# Or using yarn
yarn install
```

**Expected output:**
```
added 1247 packages in 45s
```

### Step 3: Verify Environment Files

```bash
# Check frontend .env exists
ls -la .env

# Check backend .env exists
ls -la supabase/functions/server/.env

# Verify no .env files are tracked by Git
git status
```

**Important:** `.env` files should be listed in `.gitignore` and never committed.

### Step 4: Initialize Database Schema

The application uses a pre-configured KV store table. No migrations needed.

```bash
# The kv_store_7f0d90fb table is created automatically by Supabase
# No manual database setup required
```

### Step 5: Initialize Superadmin (First Time Setup)

```bash
# Run superadmin initialization script
npm run init:superadmin

# Or manually via Node
node tests/manual/initializeSuperadmins.ts
```

**This script will:**
- Create initial superadmin entries in KV store
- Set up default permissions
- Initialize system configuration

---

## Running the Application

### Development Mode (Recommended)

```bash
# Start development server
npm run dev

# Or using yarn
yarn dev
```

**Expected output:**
```
VITE v4.5.0  ready in 1234 ms

➜  Local:   http://localhost:5173/
➜  Network: http://192.168.1.100:5173/
```

**Application will be available at:** http://localhost:5173/

### Running Backend Server (Supabase Edge Functions)

In a **separate terminal window**:

```bash
# Navigate to backend directory
cd supabase/functions/server

# Install Deno (if not installed)
curl -fsSL https://deno.land/x/install/install.sh | sh

# Run server locally
deno run --allow-net --allow-env --allow-read index.tsx
```

**Expected output:**
```
[Server] Starting Hono server on port 54321...
[Server] CORS enabled
[Server] Routes registered: /make-server-7f0d90fb/*
```

**Backend will be available at:** http://localhost:54321/functions/v1/

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Project Structure

```
client-portal/
├── .env                          # Frontend environment variables
├── src/
│   ├── App.tsx                   # Main application component
│   ├── components/               # React components
│   │   ├── ui/                   # ShadCN UI components
│   │   ├── admin/                # Admin-specific components
│   │   ├── dashboard/            # Dashboard components
│   │   └── ...
│   ├── contexts/                 # React contexts (Auth, Permissions, etc.)
│   ├── hooks/                    # Custom React hooks
│   ├── pages/                    # Page components
│   ├── services/                 # API and business logic
│   │   ├── linear/               # Linear API integration
│   │   ├── cacheService.ts       # Global cache layer
│   │   └── ...
│   ├── types/                    # TypeScript type definitions
│   └── utils/                    # Utility functions
├── supabase/
│   └── functions/
│       └── server/
│           ├── .env              # Backend environment variables
│           ├── index.tsx         # Hono server entrypoint
│           ├── kv_store.tsx      # KV store utilities (protected)
│           └── ...
├── styles/                       # CSS files
├── public/                       # Static assets
└── tests/                        # Test files
```

---

## Common Issues & Troubleshooting

### Issue 1: Environment Variables Not Loading

**Symptom:**
```
Error: VITE_SUPABASE_URL is not defined
```

**Solution:**
```bash
# 1. Verify .env file exists in root directory
ls -la .env

# 2. Restart development server
# CTRL+C to stop, then:
npm run dev

# 3. Check .env has VITE_ prefix for all frontend variables
# CORRECT: VITE_SUPABASE_URL=...
# WRONG:   SUPABASE_URL=...
```

---

### Issue 2: Supabase Connection Failed

**Symptom:**
```
Error: Failed to connect to Supabase
```

**Solution:**
```bash
# 1. Verify Supabase URL format
# Should be: https://[project-id].supabase.co
# NOT: https://supabase.co/dashboard/project/[project-id]

# 2. Check Supabase project is running
# Visit Supabase Dashboard > check project status

# 3. Verify API keys are correct
# Copy fresh keys from Supabase Dashboard > Settings > API

# 4. Check network connection
curl https://your-project-id.supabase.co/rest/v1/
```

---

### Issue 3: Linear API Authentication Failed

**Symptom:**
```
Error: Linear API returned 401 Unauthorized
```

**Solution:**
```bash
# 1. Verify Linear API key format
# Should start with: lin_api_

# 2. Check API key permissions
# Required: Read issues, Read teams, Write issues, Write comments

# 3. Test API key manually
curl -H "Authorization: YOUR_LINEAR_API_KEY" \
     https://api.linear.app/graphql \
     -d '{"query": "{ viewer { id name } }"}'

# 4. Regenerate API key if needed
# Linear Settings > API > Personal API keys > Create new key
```

---

### Issue 4: Database Table Not Found

**Symptom:**
```
Error: relation "kv_store_7f0d90fb" does not exist
```

**Solution:**
```bash
# The KV store table should be created automatically
# If not, create it manually in Supabase SQL Editor:

CREATE TABLE IF NOT EXISTS kv_store_7f0d90fb (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

# Create index for better performance
CREATE INDEX IF NOT EXISTS idx_kv_store_key ON kv_store_7f0d90fb(key);
```

---

### Issue 5: Backend Server Not Responding

**Symptom:**
```
Error: Failed to fetch from /api/teams
Network error
```

**Solution:**
```bash
# 1. Verify backend server is running
# Check terminal for Deno server logs

# 2. Check backend .env file exists
ls -la supabase/functions/server/.env

# 3. Verify backend URL in frontend .env
# Should match: http://localhost:54321/functions/v1

# 4. Check CORS is enabled
# Backend should log: "[Server] CORS enabled"

# 5. Restart backend server
# CTRL+C in backend terminal, then restart:
deno run --allow-net --allow-env --allow-read index.tsx
```

---

### Issue 6: Superadmin Access Denied

**Symptom:**
```
Error: Access denied - insufficient permissions
```

**Solution:**
```bash
# 1. Initialize superadmins
npm run init:superadmin

# 2. Verify your email is in superadmin list
# Check Supabase > Table Editor > kv_store_7f0d90fb
# Key: superadmin:emails
# Should contain your email address

# 3. Clear auth cache and re-login
# Logout > Clear browser cache > Login again

# 4. Check user role in PermissionContext
# Should be: "superadmin"
```

---

### Issue 7: Cache Not Clearing

**Symptom:**
```
Seeing old data after updates
Cache shows stale information
```

**Solution:**
```bash
# 1. Force clear all caches
npm run cache:clear

# 2. Or use manual script
node tests/manual/forceClearCache.ts

# 3. Clear browser storage
# DevTools > Application > Storage > Clear site data

# 4. Clear Linear cache specifically
node tests/manual/clearLinearCache.ts

# 5. Restart development server with fresh state
```

---

## Development Workflow

### Daily Development

```bash
# 1. Pull latest changes
git pull origin main

# 2. Install new dependencies (if any)
npm install

# 3. Start development server
npm run dev

# 4. Start backend server (separate terminal)
cd supabase/functions/server
deno run --allow-net --allow-env --allow-read index.tsx
```

### Before Committing

```bash
# 1. Run linting
npm run lint

# 2. Check for XSS vulnerabilities
npm run check:xss

# 3. Verify no .env files are staged
git status | grep ".env"  # Should return nothing

# 4. Test critical flows
# - Login/logout
# - View teams
# - Create/edit issues
# - Admin functions
```

### Testing Locally

```bash
# Run manual tests
npm run test:manual

# Test file upload
node tests/manual/testFileUpload.ts

# Verify superadmin security
node tests/manual/verifySuperadminSecurity.ts
```

---

## Environment-Specific Configuration

### Development

```bash
# .env
VITE_APP_ENV=development
VITE_DEBUG_MODE=true
VITE_API_BASE_URL=http://localhost:54321/functions/v1
```

### Staging

```bash
# .env
VITE_APP_ENV=staging
VITE_DEBUG_MODE=false
VITE_API_BASE_URL=https://staging-project-id.supabase.co/functions/v1
```

### Production

```bash
# .env
VITE_APP_ENV=production
VITE_DEBUG_MODE=false
VITE_API_BASE_URL=https://your-project-id.supabase.co/functions/v1
```

---

## Security Checklist

Before deploying or committing:

- [ ] `.env` files are in `.gitignore`
- [ ] No API keys or secrets in code
- [ ] `SUPABASE_SERVICE_ROLE_KEY` never exposed to frontend
- [ ] All user inputs are validated
- [ ] No `innerHTML` with user data
- [ ] No token information in console logs
- [ ] CORS properly configured
- [ ] Production environment variables use strong secrets

---

## Useful Commands

### Development

```bash
npm run dev                  # Start development server
npm run build                # Build for production
npm run preview              # Preview production build
npm run lint                 # Run ESLint
```

### Cache Management

```bash
npm run cache:clear          # Clear all caches
npm run cache:linear         # Clear Linear cache only
```

### Testing

```bash
npm run test:manual          # Run manual tests
npm run check:xss            # Check for XSS vulnerabilities
```

### Database

```bash
npm run init:superadmin      # Initialize superadmins
npm run db:reset             # Reset database (use with caution)
```

---

## Additional Resources

- **Guidelines**: See `/guidelines/Guidelines.md` for coding standards
- **Documentation**: Visit `/pages/DocumentationPage.tsx` or `/documentation` route
- **API Endpoints**: See `/docs/api/endpoints.json`
- **Supabase Docs**: https://supabase.com/docs
- **Linear API Docs**: https://developers.linear.app/docs

---

## Getting Help

### Common Resources

1. **Check Documentation** - `/documentation` route in app
2. **Review Guidelines** - `/guidelines/Guidelines.md`
3. **Search Issues** - GitHub Issues tab
4. **Check Console** - Browser DevTools console for errors

### Error Reporting

When reporting issues, include:

1. Error message (full stack trace)
2. Steps to reproduce
3. Environment details (OS, browser, Node version)
4. Screenshots if UI-related
5. Browser console logs

---

## Quick Start Checklist

For first-time setup:

- [ ] Node.js 18+ installed
- [ ] Supabase account created
- [ ] Linear account with API key
- [ ] Repository cloned
- [ ] `.env` files created (both frontend and backend)
- [ ] All environment variables filled
- [ ] Dependencies installed (`npm install`)
- [ ] Superadmin initialized (`npm run init:superadmin`)
- [ ] Development server running (`npm run dev`)
- [ ] Backend server running (Deno)
- [ ] Application accessible at http://localhost:5173/
- [ ] Can login successfully
- [ ] Dashboard loads with teams

---

**Last Updated**: January 2025  
**Version**: 2.0  
**Maintained by**: Teifi Digital Development Team

**Need help?** Contact support@teifi.com
