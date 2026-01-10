# 📋 Tóm Tắt Luồng Hoạt Động

## 🏗️ Kiến Trúc Tổng Quan

```
User → Frontend (React) → Backend (Node.js) → Supabase Database
```

## 📦 Components

### Frontend (`src/`)
- **React App** chạy trên port 5173
- Gọi API đến Backend
- Quản lý UI và state

### Backend (`src/server/`)
- **Node.js Server** chạy trên port 3001 (local)
- Xử lý business logic
- Kết nối Supabase Database
- API prefix: `/make-server-7f0d90fb`

### Database
- **Supabase** (PostgreSQL + KV Store)
- Lưu trữ: Users, Customers, Teams, Permissions

## 🔄 Luồng Request Điển Hình

### 1. User Login:
```
Browser → Frontend → POST /auth/user-login
  → Backend verify token
  → Backend lấy user từ KV Store
  → Backend trả về user + permissions
  → Frontend lưu token + update UI
```

### 2. Get Teams:
```
Browser → Frontend → GET /user/teams
  → Backend check auth
  → Backend lấy user's customers
  → Backend lấy teams từ customers
  → Backend check team membership
  → Backend trả về accessible teams
  → Frontend render teams
```

### 3. Create Issue:
```
Browser → Frontend → POST /issues/create
  → Backend check auth + team access
  → Backend gọi Linear API
  → Backend lưu cache vào KV Store
  → Backend trả về issue data
  → Frontend update UI
```

## 🛠️ Development Setup

### Local Development:
```bash
# Terminal 1: Backend
npm run server:dev    # http://localhost:3001

# Terminal 2: Frontend  
npm run dev           # http://localhost:5173
```

### Hoặc chạy cả 2:
```bash
npm run dev:all
```

## 🌐 Production (Vercel)

- **Frontend**: Static build → Vercel CDN
- **Backend**: Serverless function → `/api/server.ts`
- **API Routes**: `/make-server-7f0d90fb/*` → Vercel serverless

## 📁 Cấu Trúc Code

```
src/
├── server/              # Backend
│   ├── index.ts        # Entry point
│   ├── routes/         # API endpoints
│   ├── services/       # Business logic
│   ├── methods/        # Data operations
│   └── helpers/        # Utilities
├── services/           # Frontend services
│   └── apiClient.ts    # API client (auto-detect URL)
└── ...                 # Frontend code
```

## 🔐 Security Flow

1. User login → Supabase Auth → Get access token
2. Frontend lưu token (sessionStorage)
3. Mỗi API request → Gửi token trong header
4. Backend verify token → Check permissions
5. Backend trả về data nếu authorized

## 💾 Data Storage

- **KV Store** (Supabase table `kv_store_7f0d90fb`):
  - `user:{userId}` → User data
  - `customer:{customerId}` → Customer data
  - `customer:{customerId}:teams` → Team assignments
  - `user:{userId}:customers` → User's customers
  - `linear_teams:{teamId}` → Linear team cache

## 🎯 Key Points

1. **Backend Local**: Chạy hoàn toàn trên máy bạn (port 3001)
2. **Database Cloud**: Supabase (chỉ để lưu data)
3. **Auto-detect**: Frontend tự động biết kết nối đến đâu
4. **Modular**: Code được tổ chức rõ ràng, dễ maintain

## 🚀 Quick Commands

```bash
# Development
npm run dev:all        # Chạy cả frontend + backend

# Backend only
npm run server:dev     # Backend với watch mode

# Frontend only
npm run dev            # Frontend với hot reload

# Production build
npm run build          # Build frontend
```

## 📊 Request Lifecycle

```
1. User action (click, submit, etc.)
   ↓
2. Frontend component calls service
   ↓
3. Service calls apiClient
   ↓
4. apiClient makes HTTP request to Backend
   ↓
5. Backend route handler processes request
   ↓
6. Backend calls service/method
   ↓
7. Service queries/updates Supabase
   ↓
8. Backend returns JSON response
   ↓
9. Frontend updates state/UI
   ↓
10. User sees result
```

---

**Tóm lại**: Frontend (React) → Backend (Node.js) → Database (Supabase)

Tất cả chạy local trong development, deploy lên Vercel trong production.

