# 🚀 Local Development - Quick Start

## Setup nhanh (3 bước)

### 1. Tạo file `.env`

```bash
cp .env.example .env
```

Edit `.env` và điền:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key
- `VITE_SUPABASE_URL` - Supabase URL (cho frontend)
- `VITE_SUPABASE_ANON_KEY` - Anon key (cho frontend)
- `VITE_API_BASE_URL=http://localhost:3001` - **QUAN TRỌNG**: Set để frontend biết backend local

### 2. Install dependencies

```bash
npm install
```

### 3. Start development

**Option A: Chạy riêng biệt (2 terminals)**

```bash
# Terminal 1: Backend
npm run server:dev

# Terminal 2: Frontend
npm run dev
```

**Option B: Chạy cùng lúc (1 terminal)**

```bash
npm run dev:all
```

## Verify

### Backend:
```bash
curl http://localhost:3001/make-server-7f0d90fb/health
```

### Frontend:
- Mở: `http://localhost:5173`
- Check browser console → Network tab
- API calls sẽ đi đến: `http://localhost:3001/make-server-7f0d90fb/*`

## Lưu ý quan trọng

### ✅ Backend chạy HOÀN TOÀN LOCAL:
- Backend API: `http://localhost:3001` (trên máy bạn)
- Không phụ thuộc Supabase Functions
- Code backend chạy trực tiếp trên máy bạn

### ⚠️ Supabase Database vẫn cần:
- Backend cần kết nối Supabase để lưu/đọc data
- `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` là **BẮT BUỘC**
- Database vẫn ở cloud (Supabase), nhưng API logic chạy local

### 🔧 Environment Variables:

**Bắt buộc:**
- `SUPABASE_URL` - Để backend connect database
- `SUPABASE_SERVICE_ROLE_KEY` - Để backend có quyền đọc/ghi
- `VITE_SUPABASE_URL` - Để frontend connect Supabase Auth
- `VITE_SUPABASE_ANON_KEY` - Để frontend có quyền cơ bản
- `VITE_API_BASE_URL=http://localhost:3001` - **QUAN TRỌNG**: Để frontend biết backend local

**Optional:**
- `PORT=3001` - Backend port (default: 3001)
- `LINEAR_API_KEY` - Nếu dùng Linear integration
- `SUPERADMIN_EMAILS_FALLBACK` - Fallback superadmin emails

## Troubleshooting

### Backend không start:
```bash
# Check port có bị chiếm không
lsof -ti:3001

# Kill process nếu cần
kill -9 $(lsof -ti:3001)
```

### Frontend không connect backend:
1. Check backend đang chạy: `curl http://localhost:3001/make-server-7f0d90fb/health`
2. Check `.env` có `VITE_API_BASE_URL=http://localhost:3001` chưa
3. Check browser console để xem errors

### CORS errors:
- Backend đã whitelist `http://localhost:5173`
- Nếu vẫn lỗi, check `ALLOWED_ORIGINS` trong `src/server/index.ts`

## Development Workflow

1. **Start servers**: `npm run dev:all` hoặc 2 terminals riêng
2. **Edit code**: 
   - Backend: `src/server/`
   - Frontend: `src/`
3. **Auto-reload**: Cả 2 đều có watch mode
4. **Test**: 
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:3001/make-server-7f0d90fb/health`

## Next Steps

Sau khi setup xong, bạn có thể:
- Develop backend API hoàn toàn local
- Test changes ngay lập tức
- Debug dễ dàng với logs local
- Không cần deploy để test backend changes

