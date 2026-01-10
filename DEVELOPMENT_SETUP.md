# 🚀 Development Setup Guide

## Luồng hoạt động hiện tại

### Architecture:

```
┌─────────────────┐         ┌──────────────────┐
│   Frontend      │         │   Backend         │
│   (Vite + React)│  ────►  │   (Node.js + Hono)│
│   Port: 5173    │         │   Port: 3001      │
└─────────────────┘         └──────────────────┘
        │                            │
        │                            │
        └──────────┬─────────────────┘
                   │
                   ▼
        ┌──────────────────┐
        │   Supabase        │
        │   (Database + KV) │
        └──────────────────┘
```

### Components:

1. **Frontend** (`src/`):
   - React app với Vite
   - Chạy trên port 5173 (development)
   - Kết nối đến backend API

2. **Backend** (`src/server/`):
   - Node.js server với Hono framework
   - Chạy trên port 3001 (development)
   - API prefix: `/make-server-7f0d90fb`

3. **Database**:
   - Supabase (PostgreSQL + KV Store)

## Development Setup

### Bước 1: Install Dependencies

```bash
npm install
```

### Bước 2: Tạo file `.env`

Tạo file `.env` ở root directory:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Linear (optional)
LINEAR_API_KEY=your-linear-api-key
LINEAR_TEAM_ID=your-team-id
LINEAR_WORKSPACE_ID=your-workspace-id

# Server
PORT=3001

# Superadmin (optional)
SUPERADMIN_EMAILS_FALLBACK=admin@example.com,superadmin@example.com
```

**Lưu ý:** 
- `VITE_*` variables được expose cho frontend
- Các variables khác chỉ dùng cho backend

### Bước 3: Chạy Development

#### Terminal 1: Frontend
```bash
npm run dev
```
Frontend sẽ chạy tại: `http://localhost:5173`

#### Terminal 2: Backend
```bash
npm run server:dev
```
Backend sẽ chạy tại: `http://localhost:3001`

### Bước 4: Cấu hình Frontend API URL

File `src/services/apiClient.ts` hiện đang dùng Supabase Functions URL. Để dùng local backend:

**Option 1: Environment Variable (Recommended)**

Tạo file `.env.local`:
```env
VITE_API_BASE_URL=http://localhost:3001
```

Update `apiClient.ts`:
```typescript
constructor() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 
    `https://${projectId}.supabase.co/functions/v1/make-server-7f0d90fb`;
  this.baseURL = `${apiBaseUrl}/make-server-7f0d90fb`;
}
```

**Option 2: Hardcode cho development**

Tạm thời thay đổi trong `apiClient.ts`:
```typescript
constructor() {
  // Development: use local backend
  this.baseURL = 'http://localhost:3001/make-server-7f0d90fb';
  
  // Production: use Supabase Functions
  // this.baseURL = `https://${projectId}.supabase.co/functions/v1/make-server-7f0d90fb`;
}
```

## Testing

### Test Backend:
```bash
# Health check
curl http://localhost:3001/make-server-7f0d90fb/health

# Root endpoint
curl http://localhost:3001/
```

### Test Frontend:
- Mở browser: `http://localhost:5173`
- Check console để xem API calls

## Troubleshooting

### Backend không start:
- Check PORT có bị conflict không
- Check environment variables đã set chưa
- Check `node_modules` đã install chưa

### Frontend không connect được backend:
- Check CORS settings trong `src/server/index.ts`
- Check API URL trong `apiClient.ts`
- Check backend đang chạy không

### CORS errors:
- Thêm frontend URL vào `ALLOWED_ORIGINS` trong `src/server/index.ts`

