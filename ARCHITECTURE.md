# 🏗️ Architecture Overview

## Luồng hoạt động hiện tại

### Development Mode:

```
┌─────────────────────────────────────────────────────────┐
│                    Developer Machine                     │
│                                                          │
│  ┌──────────────┐              ┌──────────────┐         │
│  │   Frontend   │              │   Backend    │         │
│  │   (Vite)     │              │  (Node.js)   │         │
│  │              │              │              │         │
│  │  Port: 5173  │  ────────►  │  Port: 3001  │         │
│  │              │              │              │         │
│  │  React App   │              │  Hono Server │         │
│  └──────────────┘              └──────┬───────┘         │
│                                        │                 │
└────────────────────────────────────────┼─────────────────┘
                                          │
                                          ▼
                                ┌─────────────────┐
                                │   Supabase      │
                                │   (Database)    │
                                └─────────────────┘
```

### Production Mode (Vercel):

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel Platform                      │
│                                                          │
│  ┌──────────────┐              ┌──────────────┐         │
│  │   Frontend   │              │   Backend    │         │
│  │   (Static)   │              │ (Serverless) │         │
│  │              │              │              │         │
│  │  /           │  ────────►  │ /api/server │         │
│  │              │              │              │         │
│  │  Build/      │              │  Hono App    │         │
│  └──────────────┘              └──────┬───────┘         │
│                                        │                 │
└────────────────────────────────────────┼─────────────────┘
                                          │
                                          ▼
                                ┌─────────────────┐
                                │   Supabase      │
                                │   (Database)    │
                                └─────────────────┘
```

## Components

### 1. Frontend (`src/`)
- **Framework**: React + Vite
- **Port (Dev)**: 5173
- **Build Output**: `build/` folder
- **API Client**: `src/services/apiClient.ts`
  - Auto-detects environment
  - Development: `http://localhost:3001`
  - Production: `/make-server-7f0d90fb` (relative URL)

### 2. Backend (`src/server/`)
- **Framework**: Hono (Node.js)
- **Port (Dev)**: 3001
- **Entry Point**: 
  - Development: `src/server/index.ts` (standalone server)
  - Production: `api/server.ts` (Vercel serverless wrapper)
- **API Prefix**: `/make-server-7f0d90fb`

### 3. Database
- **Provider**: Supabase
- **Storage**: PostgreSQL + KV Store (table: `kv_store_7f0d90fb`)

## Request Flow

### Development:
```
Browser → Frontend (5173) → Backend (3001) → Supabase
```

### Production:
```
Browser → Vercel CDN → Frontend (Static) → Vercel Serverless (/api/server) → Supabase
```

## File Structure

```
project-root/
├── api/
│   └── server.ts              # Vercel serverless entry
├── src/
│   ├── server/                # Backend code
│   │   ├── index.ts          # Main server (exports app)
│   │   ├── routes/           # Route handlers
│   │   ├── services/         # Business logic
│   │   ├── methods/          # Data methods
│   │   └── helpers/          # Utilities
│   ├── services/             # Frontend services
│   └── ...                   # Frontend code
├── vercel.json               # Vercel config
├── package.json
└── vite.config.ts
```

## Environment Variables

### Development (.env):
```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
PORT=3001
```

### Production (Vercel):
- Set trong Vercel Dashboard
- `VITE_*` variables: Exposed to frontend
- Other variables: Backend only

## API Routing

### Development:
- Backend: `http://localhost:3001/make-server-7f0d90fb/*`
- Frontend calls: `http://localhost:3001/make-server-7f0d90fb/*`

### Production:
- Backend: `https://your-app.vercel.app/make-server-7f0d90fb/*`
- Vercel routes: `/make-server-7f0d90fb/*` → `/api/server.ts`
- Frontend calls: `/make-server-7f0d90fb/*` (relative URL)

## Key Features

1. **Auto-detection**: Frontend tự động detect environment
2. **CORS**: Whitelist-based CORS protection
3. **Serverless**: Backend chạy như Vercel serverless function
4. **Type-safe**: Full TypeScript support
5. **Modular**: Clean architecture với separation of concerns

