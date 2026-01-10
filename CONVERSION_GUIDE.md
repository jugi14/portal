# Hướng dẫn chuyển đổi từ Deno sang Node.js

## Các thay đổi cần thiết khi convert file:

### 1. Imports
- `"npm:hono"` → `"hono"`
- `"npm:@supabase/supabase-js"` → `"@supabase/supabase-js"`
- `"jsr:@supabase/supabase-js@2.49.8"` → `"@supabase/supabase-js"`
- `"https://esm.sh/@supabase/supabase-js@2"` → `"@supabase/supabase-js"`
- `"./file.tsx"` → `"./file"` (remove .tsx extension)
- `"./file.ts"` → `"./file"` (remove .ts extension)

### 2. Environment Variables
- `Deno.env.get("VAR")` → `process.env.VAR`
- `Deno.env.get("DENO_ENV")` → `process.env.NODE_ENV`

### 3. File Extensions
- `.tsx` → `.ts` (hoặc giữ nguyên nếu cần JSX)
- Đổi tên file từ `file.tsx` → `file.ts`

### 4. Server Entry Point
- `Deno.serve(app.fetch)` → Sử dụng `@hono/node-server`:
```typescript
import { serve } from "@hono/node-server";

serve({
  fetch: app.fetch,
  port: parseInt(process.env.PORT || "3001", 10),
});
```

### 5. Directory Structure
- Tạo `src/server/` với các thư mục:
  - `routes/` - cho các route files
  - `services/` - cho các service files
  - `methods/` - cho các method files
  - `helpers/` - cho các helper files

## Files đã convert:
- ✅ `kv_store.ts`
- ✅ `authHelpers.ts`
- ✅ `index.ts`
- ✅ `routes/systemRoutes.ts`

## Files cần convert:

### Routes (đặt trong `src/server/routes/`):
- [ ] `adminRoutes.tsx` → `adminRoutes.ts`
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

## Cách chạy server sau khi convert:

```bash
# Install dependencies
npm install

# Run server
npm run server

# Run server với watch mode (development)
npm run server:dev
```

## Environment Variables cần thiết:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LINEAR_API_KEY` (optional)
- `LINEAR_TEAM_ID` (optional)
- `LINEAR_WORKSPACE_ID` (optional)
- `SUPERADMIN_EMAILS_FALLBACK` (optional)
- `PORT` (default: 3001)

