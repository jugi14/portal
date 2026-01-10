# 📋 Tóm tắt Luồng Hoạt Động

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Application                          │
│                                                          │
│  ┌──────────────┐              ┌──────────────┐        │
│  │   Frontend   │              │   Backend    │        │
│  │  (React)    │  ─────────►  │  (Node.js)   │        │
│  │  Port: 5173 │              │  Port: 3001   │        │
│  └──────────────┘              └──────┬───────┘        │
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
- **Tech**: React + Vite + TypeScript
- **Port**: 5173 (dev)
- **Chức năng**: UI, user interactions, state management
- **API Client**: `src/services/apiClient.ts`
  - Tự động detect environment
  - Development: `http://localhost:3001`
  - Production: `/make-server-7f0d90fb`

### 2. Backend (`src/server/`)
- **Tech**: Node.js + Hono + TypeScript
- **Port**: 3001 (dev) hoặc Vercel Serverless (production)
- **Chức năng**: API endpoints, business logic, authentication
- **Structure**:
  - `routes/` - API endpoints
  - `services/` - Business logic (Linear, migrations)
  - `methods/` - Data operations (users, teams, customers)
  - `helpers/` - Utilities

### 3. Database
- **Provider**: Supabase (PostgreSQL)
- **Storage**: 
  - PostgreSQL tables
  - KV Store: `kv_store_7f0d90fb` table

## Request Flow

### Development:
```
User → Browser → Frontend (5173) → Backend (3001) → Supabase Database
```

### Production (Vercel):
```
User → Browser → Vercel CDN → Frontend (Static) → Vercel Serverless → Supabase Database
```

## Data Flow Example: User Login

```
1. User nhập credentials
   ↓
2. Frontend gọi: POST /make-server-7f0d90fb/auth/user-login
   ↓
3. Backend nhận request
   ↓
4. Backend verify token với Supabase Auth
   ↓
5. Backend lấy/update user data từ KV Store (Supabase)
   ↓
6. Backend trả về user info + permissions
   ↓
7. Frontend lưu token + update UI
```

## Data Flow Example: Get Teams

```
1. User mở Teams page
   ↓
2. Frontend gọi: GET /make-server-7f0d90fb/user/teams
   ↓
3. Backend check authentication
   ↓
4. Backend lấy user's customers từ KV: user:{userId}:customers
   ↓
5. Backend lấy teams từ KV: customer:{customerId}:teams
   ↓
6. Backend check team-level membership
   ↓
7. Backend trả về accessible teams
   ↓
8. Frontend render teams list
```

## Key Features

### Authentication Flow:
- User login → Supabase Auth → Backend verify → KV Store (user data)
- Token-based authentication
- Role-based permissions (6 roles)

### Data Storage:
- **KV Store** (Supabase table): Users, Customers, Teams, Permissions
- **PostgreSQL**: Supabase Auth, KV Store table
- **Caching**: Linear teams, issues, configs

### API Structure:
- Prefix: `/make-server-7f0d90fb`
- Routes:
  - `/auth/*` - Authentication
  - `/admin/*` - Admin operations
  - `/user/*` - User operations
  - `/teams/*` - Team management
  - `/linear/*` - Linear integration
  - `/issues/*` - Issue management

## Development vs Production

### Development:
- Frontend: `npm run dev` → `http://localhost:5173`
- Backend: `npm run server:dev` → `http://localhost:3001`
- API: `http://localhost:3001/make-server-7f0d90fb/*`

### Production (Vercel):
- Frontend: Static build → Vercel CDN
- Backend: Serverless function → `/api/server.ts`
- API: `https://your-app.vercel.app/make-server-7f0d90fb/*`

## Environment Detection

### Frontend (`apiClient.ts`):
```typescript
if (VITE_API_BASE_URL) → Use custom URL
else if (development) → http://localhost:3001
else → /make-server-7f0d90fb (relative)
```

### Backend (`index.ts`):
```typescript
if (VERCEL === '1') → Export app for serverless
else → Start standalone server on PORT
```

## Security

- **CORS**: Whitelist-based (không phải `*`)
- **Authentication**: Bearer token từ Supabase Auth
- **Authorization**: Role-based (6 roles)
- **Environment Variables**: Backend secrets không expose cho frontend

## Summary

**Frontend** → Gọi API → **Backend** → Query/Update → **Supabase Database**

- Frontend: UI và user interactions
- Backend: Business logic và API
- Database: Data storage (Supabase)

Tất cả chạy local trong development, deploy lên Vercel trong production.

