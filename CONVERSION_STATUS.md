# Trạng thái chuyển đổi từ Deno sang Node.js

## ✅ Đã hoàn thành:

### Core Infrastructure:
1. ✅ `src/server/kv_store.ts` - KV store helper
2. ✅ `src/server/authHelpers.ts` - Authentication helpers
3. ✅ `src/server/index.ts` - Main server entry point với @hono/node-server
4. ✅ `src/server/routes/systemRoutes.ts` - System routes
5. ✅ `src/server/routes/adminRoutes.ts` - Admin routes
6. ✅ `package.json` - Đã thêm @hono/node-server và tsx

## ⏳ Cần chuyển đổi tiếp:

### Routes (đặt trong `src/server/routes/`):
- [ ] `userRoutes.tsx` → `userRoutes.ts`
- [ ] `teamRoutes.tsx` → `teamRoutes.ts`
- [ ] `linearRoutes.tsx` → `linearRoutes.ts`
- [ ] `linearMaintenanceRoutes.tsx` → `linearMaintenanceRoutes.ts`
- [ ] `issueRoutes.tsx` → `issueRoutes.ts`
- [ ] `superadminRoutes.tsx` → `superadminRoutes.ts`

### Services (đặt trong `src/server/services/`):
- [ ] `linearTeamService.tsx` → `linearTeamService.ts`
- [ ] `linearTeamIssuesService.tsx` → `linearTeamIssuesService.ts`
- [ ] `migrationService.tsx` → `migrationService.ts`

### Methods (đặt trong `src/server/methods/`):
- [ ] `userMethodsV2.tsx` → `userMethodsV2.ts`
- [ ] `teamMethodsV2.tsx` → `teamMethodsV2.ts`
- [ ] `customerMethodsV2.tsx` → `customerMethodsV2.ts`

### Helpers (đặt trong `src/server/helpers/`):
- [ ] `adminHelpers.tsx` → `adminHelpers.ts`
- [ ] `linearGraphQL.tsx` → `linearGraphQL.ts`

## Cách chuyển đổi nhanh:

### Bước 1: Copy file
```bash
cp src/supabase/functions/server/[filename].tsx src/server/[directory]/[filename].ts
```

### Bước 2: Thay đổi imports
Tìm và thay thế tất cả:
- `"npm:hono"` → `"hono"`
- `"npm:@supabase/supabase-js"` → `"@supabase/supabase-js"`
- `"jsr:@supabase/supabase-js@2.49.8"` → `"@supabase/supabase-js"`
- `"https://esm.sh/@supabase/supabase-js@2"` → `"@supabase/supabase-js"`
- `"./file.tsx"` → `"../file"` (điều chỉnh path tương đối)
- `Deno.env.get("VAR")` → `process.env.VAR`
- `Deno.env.get("DENO_ENV")` → `process.env.NODE_ENV`

### Bước 3: Kiểm tra imports tương đối
Đảm bảo các import paths đúng với cấu trúc thư mục mới:
- Routes import từ `../kv_store`, `../authHelpers`, `../methods/...`, `../services/...`, `../helpers/...`
- Services import từ `../kv_store`, `../authHelpers`
- Methods import từ `../kv_store`, `../authHelpers`
- Helpers import từ `../kv_store`

## Cấu trúc thư mục mới:

```
src/server/
├── index.ts                 # Main entry point
├── kv_store.ts              # KV store helper
├── authHelpers.ts           # Auth helpers
├── routes/                  # Route files
│   ├── systemRoutes.ts      ✅
│   ├── adminRoutes.ts       ✅
│   ├── userRoutes.ts        ⏳
│   ├── teamRoutes.ts        ⏳
│   ├── linearRoutes.ts      ⏳
│   ├── linearMaintenanceRoutes.ts ⏳
│   ├── issueRoutes.ts       ⏳
│   └── superadminRoutes.ts  ⏳
├── services/                # Service files
│   ├── linearTeamService.ts ⏳
│   ├── linearTeamIssuesService.ts ⏳
│   └── migrationService.ts     ⏳
├── methods/                 # Method files
│   ├── userMethodsV2.ts     ⏳
│   ├── teamMethodsV2.ts     ⏳
│   └── customerMethodsV2.ts ⏳
└── helpers/                 # Helper files
    ├── adminHelpers.ts      ⏳
    └── linearGraphQL.ts     ⏳
```

## Sau khi convert xong:

1. **Install dependencies:**
```bash
npm install
```

2. **Chạy server:**
```bash
npm run server
# hoặc development mode:
npm run server:dev
```

3. **Kiểm tra:**
- Server chạy trên port 3001 (hoặc PORT env var)
- Health check: `GET http://localhost:3001/make-server-7f0d90fb/health`

## Lưu ý quan trọng:

1. **Environment Variables:** Đảm bảo có file `.env` với:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `LINEAR_API_KEY` (optional)
   - `PORT` (default: 3001)

2. **TypeScript:** Cần cấu hình `tsconfig.json` để hỗ trợ Node.js và ESM nếu cần

3. **Testing:** Sau khi convert, test từng endpoint để đảm bảo không có lỗi runtime

