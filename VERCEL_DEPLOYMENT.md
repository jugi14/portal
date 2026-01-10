# 🚀 Vercel Deployment Guide

## Architecture trên Vercel

```
┌─────────────────────────────────────┐
│         Vercel Platform              │
│                                       │
│  ┌──────────────┐  ┌──────────────┐ │
│  │   Frontend   │  │   Backend     │ │
│  │   (Static)   │  │ (Serverless)  │ │
│  │              │  │               │ │
│  │  /           │  │ /api/server.ts│ │
│  └──────────────┘  └──────────────┘ │
│         │                 │          │
└─────────┼─────────────────┼──────────┘
          │                 │
          ▼                 ▼
    ┌──────────┐    ┌──────────┐
    │  Vercel  │    │ Supabase │
    │   CDN    │    │ Database │
    └──────────┘    └──────────┘
```

## Setup cho Vercel

### Bước 1: Cài đặt Vercel CLI (optional)

```bash
npm i -g vercel
```

### Bước 2: Cấu hình Vercel

File `vercel.json` đã được tạo với cấu hình:
- Frontend: Static build từ Vite
- Backend: Serverless function tại `/api/server.ts`
- Routes: `/make-server-7f0d90fb/*` → `/api/server.ts`

### Bước 3: Environment Variables trên Vercel

Vào Vercel Dashboard → Project Settings → Environment Variables, thêm:

```
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Linear (optional)
LINEAR_API_KEY=your-linear-api-key
LINEAR_TEAM_ID=your-team-id
LINEAR_WORKSPACE_ID=your-workspace-id

# Superadmin (optional)
SUPERADMIN_EMAILS_FALLBACK=admin@example.com
```

**Lưu ý:** 
- `VITE_*` variables cần set cho cả Production, Preview, và Development
- Các variables khác chỉ cần Production

### Bước 4: Update Frontend API URL

File `src/services/apiClient.ts` cần được update để tự động detect API URL:

```typescript
constructor() {
  // Auto-detect API URL based on environment
  const isDevelopment = import.meta.env.DEV;
  const customApiUrl = import.meta.env.VITE_API_BASE_URL;
  
  if (customApiUrl) {
    // Use custom API URL (for local development)
    this.baseURL = `${customApiUrl}/make-server-7f0d90fb`;
  } else if (isDevelopment) {
    // Development: use local backend
    this.baseURL = 'http://localhost:3001/make-server-7f0d90fb';
  } else {
    // Production: use Vercel serverless function
    // Vercel sẽ tự động route /make-server-7f0d90fb/* to /api/server.ts
    this.baseURL = `/make-server-7f0d90fb`;
  }
}
```

### Bước 5: Update CORS Settings

Update `src/server/index.ts` để thêm Vercel domain:

```typescript
const ALLOWED_ORIGINS = [
  "http://localhost:5173", // Development
  "http://localhost:3000", // Development alternative
  "https://fwltshzniolrekqhtpgv.supabase.co", // Supabase hosted
  "https://dashboard.teifi.work", // Production domain
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null, // Vercel preview
  process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null, // Vercel production
].filter(Boolean);
```

### Bước 6: Deploy

#### Option 1: Vercel CLI
```bash
vercel
```

#### Option 2: Git Integration
1. Push code lên GitHub/GitLab
2. Connect repository với Vercel
3. Vercel sẽ auto-deploy

#### Option 3: Vercel Dashboard
1. Vào Vercel Dashboard
2. Click "New Project"
3. Import repository
4. Deploy

### Bước 7: Verify Deployment

Sau khi deploy, test các endpoints:

```bash
# Health check
curl https://your-app.vercel.app/make-server-7f0d90fb/health

# Root endpoint
curl https://your-app.vercel.app/
```

## Cấu trúc Files cho Vercel

```
project-root/
├── api/
│   └── server.ts          # Vercel serverless function entry
├── src/
│   ├── server/            # Backend code
│   │   ├── index.ts       # Main server (exported for Vercel)
│   │   └── ...
│   └── ...                # Frontend code
├── vercel.json            # Vercel configuration
├── package.json
└── vite.config.ts
```

## Important Notes

### 1. Serverless Function Limits:
- **Timeout**: 30 seconds (có thể tăng lên 60s với Pro plan)
- **Memory**: 1024 MB default
- **Cold Start**: Có thể có delay lần đầu

### 2. Environment Variables:
- Production: Set trong Vercel Dashboard
- Preview: Có thể override cho từng branch
- Development: Dùng `.env.local`

### 3. API Routes:
- Tất cả routes `/make-server-7f0d90fb/*` sẽ được route đến `/api/server.ts`
- Vercel tự động handle routing

### 4. Build Process:
- Frontend: `npm run build` → `build/` folder
- Backend: Vercel tự động detect và build TypeScript

## Troubleshooting

### Function timeout:
- Tăng `maxDuration` trong `vercel.json`
- Optimize code để giảm execution time

### CORS errors:
- Check `ALLOWED_ORIGINS` trong server code
- Thêm Vercel domain vào whitelist

### Environment variables không work:
- Check variable names (case-sensitive)
- Check scope (Production/Preview/Development)
- Restart deployment sau khi thay đổi

### Build errors:
- Check `package.json` scripts
- Check TypeScript errors
- Check missing dependencies

## Production Checklist

- [ ] Environment variables đã set trên Vercel
- [ ] CORS settings đã update với Vercel domain
- [ ] Frontend API URL đã config đúng
- [ ] Health check endpoint hoạt động
- [ ] Authentication flow hoạt động
- [ ] Database connections hoạt động
- [ ] Linear API integration hoạt động (nếu có)

