# 🚀 Quick Start Guide

## Development Workflow

### 1. Setup Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env với các giá trị thực tế
# SUPABASE_URL=...
# SUPABASE_SERVICE_ROLE_KEY=...
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Servers

**Terminal 1 - Frontend:**
```bash
npm run dev
# Frontend: http://localhost:5173
```

**Terminal 2 - Backend:**
```bash
npm run server:dev
# Backend: http://localhost:3001
```

### 4. Test

- Frontend: Mở `http://localhost:5173`
- Backend Health: `curl http://localhost:3001/make-server-7f0d90fb/health`

## Luồng hoạt động

### Development:
```
Frontend (5173) → Backend (3001) → Supabase
```

### Production (Vercel):
```
Frontend (Static) → Vercel Serverless (/api/server.ts) → Supabase
```

## API Endpoints

Tất cả API endpoints có prefix: `/make-server-7f0d90fb`

Ví dụ:
- Health: `/make-server-7f0d90fb/health`
- Auth: `/make-server-7f0d90fb/auth/user-login`
- Teams: `/make-server-7f0d90fb/teams/my-teams`

## Troubleshooting

### Backend không start:
- Check PORT có bị conflict không
- Check `.env` file đã có chưa
- Check `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY`

### Frontend không connect backend:
- Check backend đang chạy: `curl http://localhost:3001/make-server-7f0d90fb/health`
- Check CORS settings
- Check browser console để xem errors

### CORS errors:
- Thêm frontend URL vào `ALLOWED_ORIGINS` trong `src/server/index.ts`

