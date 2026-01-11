# Teifi Digital Client Portal

Client portal application built with React, Node.js, Hono, and Supabase.

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Architecture Overview](#-architecture-overview)
- [Project Structure](#-project-structure)
- [Development](#-development)
- [Deployment](#-deployment)
- [Environment Variables](#-environment-variables)
- [Scripts](#-scripts)
- [Documentation](#-documentation)

## 🚀 Quick Start

### Prerequisites

- **Node.js** 24.x (required for Vercel deployment)
- **npm** or **yarn**
- **Supabase** account (for database)
- **Linear.app** account (for issue tracking)

### Installation

1. **Clone repository:**
```bash
git clone <repository-url>
cd TEIFI_PORTAL_2026
```

2. **Install dependencies:**
```bash
npm install
```

3. **Setup environment variables:**
```bash
cp .env.example .env
# Edit .env with your actual values (see Environment Variables section)
```

4. **Start development servers:**
```bash
# Option 1: Run both frontend and backend together (recommended)
npm run dev:all

# Option 2: Run separately (2 terminals)
npm run server:dev  # Terminal 1: Backend (port 3001)
npm run dev         # Terminal 2: Frontend (port 5173)
```

5. **Access application:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001/api

## 🏗️ Architecture Overview

### High-Level Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Frontend      │         │    Backend       │         │   External      │
│   (React+Vite)  │◄───────►│  (Node.js+Hono)  │◄───────►│   Services      │
│   Port: 5173    │  HTTP   │   Port: 3001     │  API    │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
                                      │                            │
                                      │                            │
                                      ▼                            ▼
                              ┌─────────────────┐         ┌─────────────────┐
                              │   Supabase      │         │   Linear.app     │
                              │   (Database)    │         │   (Issues)       │
                              └─────────────────┘         └─────────────────┘
```

### Application Flow

1. **Authentication Flow:**
   - User logs in via Supabase Auth (Google OAuth)
   - Frontend receives access token
   - Token is stored in `apiClient` and sent with all API requests
   - Backend validates token via `authMiddleware`

2. **API Request Flow:**
   - Frontend calls `apiClient.get/post/put/delete()`
   - Request goes to `/api/*` endpoint
   - Backend routes handle request via Hono framework
   - Authentication & authorization checked via middleware
   - Business logic executed in services/methods
   - Response returned to frontend

3. **Data Storage:**
   - **Supabase Database**: User authentication, KV store table
   - **KV Store** (Supabase table): User data, customer data, team assignments, cache
   - **Linear.app API**: Issue tracking, team management

### Technology Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- React Router (routing)
- Tailwind CSS + shadcn/ui (UI components)
- Supabase JS Client (authentication)

**Backend:**
- Node.js 20
- Hono (web framework)
- TypeScript
- Supabase JS (database access)
- Linear.app GraphQL API

**Deployment:**
- Vercel (frontend + serverless functions)
- Supabase (database)

## 📁 Project Structure

```
TEIFI_PORTAL_2026/
├── api/                          # Vercel serverless function
│   ├── server.js                 # Bundled serverless function (auto-generated)
│   └── tsconfig.json             # TypeScript config for API
│
├── src/
│   ├── api/
│   │   └── server.ts             # Vercel entry point (source)
│   │
│   ├── server/                   # Backend (Node.js + Hono)
│   │   ├── index.ts              # Server entry point & route mounting
│   │   ├── authHelpers.ts        # Authentication & authorization logic
│   │   ├── kv_store.ts           # KV store interface (Supabase table)
│   │   │
│   │   ├── routes/               # API route handlers
│   │   │   ├── systemRoutes.ts   # System endpoints (health, debug)
│   │   │   ├── adminRoutes.ts    # Admin operations
│   │   │   ├── userRoutes.ts     # User management
│   │   │   ├── teamRoutes.ts     # Team management
│   │   │   ├── linearRoutes.ts   # Linear.app integration
│   │   │   ├── issueRoutes.ts    # Issue operations
│   │   │   ├── linearMaintenanceRoutes.ts  # Linear maintenance
│   │   │   └── superadminRoutes.ts         # Superadmin operations
│   │   │
│   │   ├── services/             # Business logic services
│   │   │   ├── linearTeamService.ts        # Linear team operations
│   │   │   ├── linearTeamIssuesService.ts  # Linear issue operations
│   │   │   └── migrationService.ts         # Data migration
│   │   │
│   │   ├── methods/              # Data operations (CRUD)
│   │   │   ├── userMethodsV2.ts  # User CRUD
│   │   │   ├── customerMethodsV2.ts  # Customer CRUD
│   │   │   └── teamMethodsV2.ts  # Team CRUD
│   │   │
│   │   └── helpers/              # Utility functions
│   │       ├── adminHelpers.ts  # Admin utilities
│   │       └── linearGraphQL.ts  # GraphQL queries/fragments
│   │
│   ├── components/               # React components
│   │   ├── admin/               # Admin components
│   │   ├── issue-detail/        # Issue detail components
│   │   ├── kanban/              # Kanban board components
│   │   ├── sidebar/             # Sidebar components
│   │   └── ui/                  # Reusable UI components
│   │
│   ├── services/                # Frontend services
│   │   ├── apiClient.ts         # HTTP client for API calls
│   │   ├── adminService.ts      # Admin operations
│   │   ├── customerServiceV2.ts # Customer operations
│   │   ├── userServiceV2.ts     # User operations
│   │   ├── teamServiceV2.ts     # Team operations
│   │   └── linearCacheService.ts # Linear data caching
│   │
│   ├── contexts/                # React contexts
│   │   ├── AuthContext.tsx      # Authentication state
│   │   ├── PermissionContext.tsx # Permission & role state
│   │   ├── SidebarContext.tsx   # Sidebar state
│   │   └── ThemeContext.tsx     # Theme state
│   │
│   ├── hooks/                   # Custom React hooks
│   ├── pages/                   # Page components
│   ├── types/                   # TypeScript type definitions
│   ├── utils/                   # Utility functions
│   └── styles/                  # CSS files
│
├── scripts/
│   └── build-server.js          # Esbuild script for bundling server
│
├── build/                        # Frontend build output (generated)
├── package.json                  # Dependencies & scripts
├── vercel.json                   # Vercel deployment config
├── tsconfig.json                 # TypeScript config
└── vite.config.ts               # Vite config
```

## 🔧 Development

### Local Development Setup

**Development runs in 2 separate processes:**

1. **Backend Server** (`src/server/`)
   - Runs on port **3001**
   - API prefix: `/api`
   - Hot reload with `tsx watch`
   - Connects to remote Supabase database

2. **Frontend Server** (`src/`)
   - Runs on port **5173** (Vite dev server)
   - Hot module replacement (HMR)
   - Proxies API calls to backend

### API Endpoints

All API endpoints are prefixed with `/api`:

- `/api/system/*` - System endpoints
- `/api/admin/*` - Admin operations
- `/api/users/*` - User management
- `/api/teams/*` - Team management
- `/api/linear/*` - Linear.app integration
- `/api/issues/*` - Issue operations
- `/api/superadmin/*` - Superadmin operations

### Authentication & Authorization

**Flow:**
1. User authenticates via Supabase Auth (Google OAuth)
2. Frontend receives `access_token`
3. Token is sent in `Authorization: Bearer <token>` header
4. Backend validates token via `authMiddleware`
5. User permissions checked based on role hierarchy

**Role Hierarchy:**
- `superadmin` (100) - Full system access
- `admin` (80) - Manage users & customers
- `client_manager` (60) - Manage team members
- `client_user` (40) - Create/edit issues
- `tester` (30) - Test & report bugs
- `viewer` (10) - Read-only access

### Data Flow

**User > Customer > Team Hierarchy:**
- Users belong to Customers
- Customers have Teams assigned
- Teams are from Linear.app
- Issues belong to Teams

**Storage:**
- **Supabase Auth**: User authentication
- **KV Store** (Supabase table): All application data
- **Linear.app**: Issue tracking & team data

## 🚢 Deployment

### Vercel Deployment

**Build Process:**
1. Frontend: `vite build` → outputs to `build/`
2. Backend: `esbuild` bundles `src/api/server.ts` → `api/server.js`
3. Vercel deploys:
   - Frontend as static files
   - Backend as serverless function

**Configuration:**
- `vercel.json` configures:
  - Rewrites: `/api/*` → `/api/server.js`
  - Functions: `api/server.js` with 30s max duration
  - SPA routing: `/*` → `/index.html`

**Environment Variables on Vercel:**
Set these in Vercel Dashboard → Settings → Environment Variables:

**Backend Variables:**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (backend only)
- `LINEAR_API_KEY` - Linear.app API key
- `LINEAR_TEAM_ID` - Default Linear team ID
- `LINEAR_WORKSPACE_ID` - Linear workspace ID
- `SUPERADMIN_EMAILS_FALLBACK` - Fallback superadmin emails (comma-separated)

**Frontend Variables:**
- `VITE_API_BASE_URL` - Leave empty for production (uses relative `/api`)

**Note:** Do NOT set `PORT` or `VITE_API_BASE_URL` on Vercel (handled automatically)

### Build Output

- **Frontend**: Static files in `build/` directory
- **Backend**: Bundled serverless function `api/server.js` (~180KB minified)
  - Contains entire backend codebase
  - Auto-generated by esbuild (do not edit directly)

## 🔐 Environment Variables

### Local Development (`.env`)

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Backend Server (Local Development Only)
PORT=3001
VITE_API_BASE_URL=http://localhost:3001/api

# Linear.app Configuration
LINEAR_API_KEY=your-linear-api-key
LINEAR_TEAM_ID=your-team-id
LINEAR_WORKSPACE_ID=your-workspace-id

# Superadmin Fallback
SUPERADMIN_EMAILS_FALLBACK=admin@example.com,admin2@example.com
```

### Variable Explanation

- **`SUPABASE_URL`** & **`SUPABASE_SERVICE_ROLE_KEY`**: Backend database access
- **`PORT`**: Backend server port (local only, not needed on Vercel)
- **`VITE_API_BASE_URL`**: Backend API URL (local: `http://localhost:3001/api`, production: empty/relative)
- **`LINEAR_*`**: Linear.app API configuration
- **`SUPERADMIN_EMAILS_FALLBACK`**: Fallback superadmin list if KV store fails

**Note:** Supabase client configuration is hardcoded in `src/utils/supabase/info.tsx` and does not use environment variables.

## 🛠️ Scripts

### Development

```bash
npm run dev              # Start frontend dev server (port 5173)
npm run server:dev       # Start backend with watch mode (port 3001)
npm run dev:all          # Start both frontend and backend (concurrently)
```

### Build

```bash
npm run build            # Build frontend + bundle backend
npm run build:server     # Bundle backend only (esbuild)
```

### Production

```bash
npm start                # Start backend server (production mode)
```

## 📚 Documentation

- **Coding Guidelines**: `src/guidelines/Guidelines.md`
  - Development best practices
  - Code style guidelines
  - Architecture patterns
  - Security guidelines

## 🔍 Key Concepts

### KV Store

The application uses a Supabase table (`kv_store_7f0d90fb`) as a key-value store for:
- User data (`user:{userId}`)
- Customer data (`customer:{customerId}`)
- Team assignments (`team:{teamId}:customer`)
- Cache data (`linear:issue-detail:{issueId}`)
- System data (`superadmin:emails`)

### Caching Strategy

**Server-side caching:**
- Issue details: 120 seconds TTL
- Team hierarchy: 30 seconds TTL
- Ownership mappings: 5 minutes TTL

**Client-side caching:**
- Linear data cached in memory
- Session data in sessionStorage
- Auth state preserved across tabs

### API Client

All frontend API calls go through `apiClient` service:
- Automatically adds `Authorization` header
- Handles token refresh
- Centralized error handling
- Environment-aware base URL

## 🐛 Troubleshooting

### Backend not starting
- Check `.env` file exists and has required variables
- Verify `PORT` is not in use: `lsof -i :3001`
- Check Supabase credentials are correct

### API calls failing
- Verify backend is running on port 3001
- Check `VITE_API_BASE_URL` in `.env`
- Check browser console for CORS errors
- Verify authentication token is valid

### Build errors
- Run `npm install` to ensure dependencies are installed
- Check TypeScript errors: `npm run build`
- Verify all environment variables are set

## 📝 License

Private project - All rights reserved
