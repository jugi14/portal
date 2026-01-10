# 💻 Local Development Setup

## Mục tiêu

Backend chạy **hoàn toàn local** trên máy bạn, không phụ thuộc vào Supabase Functions. Supabase chỉ dùng cho **database** (PostgreSQL + KV Store).

## Architecture Local Development

```
┌─────────────────────────────────────────┐
│         Your Local Machine               │
│                                          │
│  ┌──────────────┐  ┌──────────────┐   │
│  │   Frontend   │  │   Backend     │   │
│  │   (Vite)     │  │  (Node.js)    │   │
│  │              │  │               │   │
│  │  Port: 5173  │─►│  Port: 3001   │   │
│  │              │  │  (LOCAL)      │   │
│  └──────────────┘  └───────┬───────┘   │
└────────────────────────────┼────────────┘
                              │
                              │ (API calls)
                              ▼
                    ┌─────────────────┐
                    │   Supabase      │
                    │   (Database)    │
                    │   (Cloud)       │
                    └─────────────────┘
```

## Setup Steps

### Bước 1: Tạo file `.env`

Tạo file `.env` ở root directory:

```env
# Supabase Database (REQUIRED - để lưu data)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Backend Server (Local)
PORT=3001

# Linear API (Optional)
LINEAR_API_KEY=your-linear-api-key
LINEAR_TEAM_ID=your-team-id
LINEAR_WORKSPACE_ID=your-workspace-id

# Superadmin (Optional)
SUPERADMIN_EMAILS_FALLBACK=admin@example.com

# API Base URL (Local Development)
VITE_API_BASE_URL=http://localhost:3001
```

**Lưu ý quan trọng:**
- `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY`: **BẮT BUỘC** - Backend cần để kết nối database
- `VITE_API_BASE_URL`: Set để frontend biết kết nối đến backend local

### Bước 2: Install Dependencies

```bash
npm install
```

### Bước 3: Start Development Servers

**Terminal 1 - Backend (Node.js):**
```bash
npm run server:dev
```

Output:
```
Starting Teifi Digital Client Portal Server...
Server ready at http://localhost:3001
```

**Terminal 2 - Frontend (Vite):**
```bash
npm run dev
```

Output:
```
VITE v6.3.5  ready in XXX ms
➜  Local:   http://localhost:5173/
```

### Bước 4: Verify Setup

**Test Backend:**
```bash
# Health check
curl http://localhost:3001/make-server-7f0d90fb/health

# Root endpoint
curl http://localhost:3001/
```

**Test Frontend:**
- Mở browser: `http://localhost:5173`
- Check browser console để xem API calls
- API calls sẽ đi đến: `http://localhost:3001/make-server-7f0d90fb/*`

## Cách hoạt động

### 1. Frontend → Backend

File `src/services/apiClient.ts` đã được config để:
- **Development**: Dùng `VITE_API_BASE_URL` hoặc `http://localhost:3001`
- **Production**: Dùng relative URL `/make-server-7f0d90fb`

### 2. Backend → Database

Backend kết nối đến Supabase database qua:
- `SUPABASE_URL`: Database URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key để có full access

### 3. Data Flow

```
User Action (Browser)
    ↓
Frontend (localhost:5173)
    ↓ HTTP Request
Backend (localhost:3001)
    ↓ Supabase Client
Supabase Database (Cloud)
    ↓ Response
Backend
    ↓ JSON Response
Frontend
    ↓ Update UI
User sees result
```

## Troubleshooting

### Backend không start:

**Error: "Port 3001 already in use"**
```bash
# Tìm process đang dùng port 3001
lsof -ti:3001

# Kill process
kill -9 $(lsof -ti:3001)

# Hoặc đổi PORT trong .env
PORT=3002
```

**Error: "SUPABASE_URL is required"**
- Check file `.env` đã có `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` chưa
- Check file `.env` ở root directory (không phải trong subfolder)

**Error: "Cannot find module"**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Frontend không connect được backend:

**CORS Error:**
- Check backend đang chạy: `curl http://localhost:3001/make-server-7f0d90fb/health`
- Check `ALLOWED_ORIGINS` trong `src/server/index.ts` có `http://localhost:5173` chưa

**404 Error:**
- Check `VITE_API_BASE_URL` trong `.env` đã set chưa
- Check backend đang chạy trên đúng port

**Network Error:**
- Check backend logs để xem có errors không
- Check firewall không block port 3001

### Database Connection Issues:

**Error: "Failed to initialize Supabase client"**
- Check `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` đúng chưa
- Check network có kết nối internet không (cần để connect Supabase)

**Error: "KV Store get error"**
- Check Supabase database có table `kv_store_7f0d90fb` chưa
- Check service role key có quyền access table không

## Development Workflow

### 1. Start Servers:
```bash
# Terminal 1
npm run server:dev

# Terminal 2  
npm run dev
```

### 2. Make Changes:
- Backend code: Edit files trong `src/server/`
- Frontend code: Edit files trong `src/`
- Auto-reload: Cả 2 servers đều có watch mode

### 3. Test:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3001/make-server-7f0d90fb/health`

### 4. Debug:
- Backend logs: Terminal 1
- Frontend logs: Browser console
- Network: Browser DevTools → Network tab

## Environment Variables Reference

### Required:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (backend only)
- `VITE_SUPABASE_URL` - Supabase URL (frontend)
- `VITE_SUPABASE_ANON_KEY` - Anon key (frontend)

### Optional:
- `PORT` - Backend port (default: 3001)
- `VITE_API_BASE_URL` - Custom API URL (default: http://localhost:3001)
- `LINEAR_API_KEY` - Linear API key
- `SUPERADMIN_EMAILS_FALLBACK` - Fallback superadmin emails

## Quick Commands

```bash
# Start both servers (requires 2 terminals)
npm run server:dev  # Terminal 1
npm run dev         # Terminal 2

# Test backend
curl http://localhost:3001/make-server-7f0d90fb/health

# Check if backend is running
lsof -ti:3001

# Kill backend
kill -9 $(lsof -ti:3001)
```

