# Quick Start Guide

> Get the Teifi Client Portal running in 5 minutes

---

## Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Linear API key

---

## Setup Steps

### 1. Clone & Install

```bash
# Clone repository
git clone https://github.com/teifi-digital/client-portal.git
cd client-portal

# Install dependencies
npm install
```

### 2. Configure Environment

```bash
# Copy environment templates
cp .env.example .env
cp supabase/functions/server/.env.example supabase/functions/server/.env

# Edit .env files with your credentials
# See SETUP_GUIDE.md for detailed instructions
```

### 3. Required Environment Variables

**Frontend (.env)**
```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_LINEAR_API_KEY=lin_api_your-key
VITE_APP_ENV=development
VITE_API_BASE_URL=http://localhost:54321/functions/v1
```

**Backend (supabase/functions/server/.env)**
```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_DB_URL=postgresql://postgres:password@db.project-id.supabase.co:5432/postgres
LINEAR_API_KEY=lin_api_your-key
```

### 4. Initialize Database

```bash
# Initialize superadmin
npm run init:superadmin
```

### 5. Run Application

**Terminal 1 - Frontend:**
```bash
npm run dev
# Opens at http://localhost:5173
```

**Terminal 2 - Backend:**
```bash
cd supabase/functions/server
deno run --allow-net --allow-env --allow-read index.tsx
# Runs at http://localhost:54321
```

---

## First Login

1. Navigate to http://localhost:5173
2. Sign up with your email
3. Login with credentials
4. Verify dashboard loads

---

## Troubleshooting

### Issue: Environment variables not loading
**Solution:** Restart dev server after editing .env

### Issue: Supabase connection failed
**Solution:** Check VITE_SUPABASE_URL format: `https://[project-id].supabase.co`

### Issue: Linear API 401 error
**Solution:** Verify LINEAR_API_KEY starts with `lin_api_`

### Issue: Backend not responding
**Solution:** Check backend terminal for errors, verify PORT=54321

---

## Next Steps

- Read [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed setup
- Review [Guidelines.md](guidelines/Guidelines.md) for coding standards
- Check [Documentation](http://localhost:5173/documentation) in app

---

## Common Commands

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run lint             # Run linting
npm run cache:clear      # Clear all caches
npm run check:xss        # Check for XSS vulnerabilities
```

---

**Need help?** See [SETUP_GUIDE.md](SETUP_GUIDE.md) or contact support@teifi.com
