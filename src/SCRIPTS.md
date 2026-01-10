# NPM Scripts Reference

> Complete reference for all available npm scripts in the Teifi Client Portal

---

## Development Scripts

### `npm run dev`
Start the development server with hot reload.

```bash
npm run dev
```

**Output:**
```
VITE v4.5.0 ready in 1234 ms
➜ Local:   http://localhost:5173/
```

**Use when:** Daily development work

---

### `npm run build`
Build the application for production.

```bash
npm run build
```

**Output:**
```
vite v4.5.0 building for production...
✓ 1247 modules transformed.
dist/index.html                  0.45 kB
dist/assets/index-a1b2c3d4.js   234.56 kB
```

**Use when:** Preparing for deployment

---

### `npm run preview`
Preview the production build locally.

```bash
npm run preview
```

**Output:**
```
➜ Local:   http://localhost:4173/
```

**Use when:** Testing production build before deployment

---

## Linting & Code Quality

### `npm run lint`
Run ESLint on the codebase.

```bash
npm run lint
```

**Checks:**
- Code style violations
- TypeScript errors
- React hooks rules
- Import order

**Use when:** Before committing code

---

### `npm run lint:fix`
Auto-fix linting issues.

```bash
npm run lint:fix
```

**Fixes:**
- Auto-fixable ESLint rules
- Import sorting
- Code formatting

**Use when:** Cleaning up code style issues

---

### `npm run check:xss`
Scan for XSS vulnerabilities.

```bash
npm run check:xss
```

**Checks for:**
- `innerHTML` with user input
- `dangerouslySetInnerHTML` usage
- Unsafe DOM manipulation

**Use when:** Before committing security-sensitive code

---

## Cache Management

### `npm run cache:clear`
Clear all application caches.

```bash
npm run cache:clear
```

**Clears:**
- In-memory cache (globalCache)
- sessionStorage
- localStorage
- Browser cache

**Use when:** 
- Seeing stale data
- After major updates
- Debugging cache issues

---

### `npm run cache:linear`
Clear Linear-specific caches.

```bash
npm run cache:linear
```

**Clears:**
- Linear team cache
- Linear issue cache
- Linear workflow cache

**Use when:** Linear data is out of sync

---

## Database & Initialization

### `npm run init:superadmin`
Initialize superadmin accounts.

```bash
npm run init:superadmin
```

**Actions:**
- Creates superadmin entries in KV store
- Sets up default permissions
- Initializes system configuration

**Use when:** 
- First-time setup
- Adding new superadmin emails

---

### `npm run db:reset`
Reset database to initial state.

```bash
npm run db:reset
```

**WARNING:** This will delete all data!

**Actions:**
- Clears all KV store data
- Resets user assignments
- Clears customer data

**Use when:** Starting fresh (development only)

---

## Testing Scripts

### `npm run test:manual`
Run manual test suite.

```bash
npm run test:manual
```

**Runs:**
- File upload tests
- Superadmin security tests
- Permission tests

**Use when:** Testing critical functionality manually

---

### `npm run test:upload`
Test file upload functionality.

```bash
npm run test:upload
```

**Tests:**
- File upload to Supabase Storage
- File size limits
- File type validation

**Use when:** Debugging file upload issues

---

### `npm run test:security`
Verify security configurations.

```bash
npm run test:security
```

**Checks:**
- Superadmin access control
- Token security
- Permission boundaries

**Use when:** Auditing security settings

---

## Type Checking

### `npm run type-check`
Run TypeScript type checking.

```bash
npm run type-check
```

**Checks:**
- TypeScript compilation errors
- Type mismatches
- Missing type definitions

**Use when:** Before committing TypeScript changes

---

## Cleanup Scripts

### `npm run clean`
Clean build artifacts.

```bash
npm run clean
```

**Removes:**
- `dist/` directory
- `node_modules/.cache/`
- `.vite/` cache

**Use when:** 
- Build errors
- Starting fresh build

---

### `npm run clean:install`
Clean install dependencies.

```bash
npm run clean:install
```

**Actions:**
1. Removes `node_modules/`
2. Removes `package-lock.json`
3. Runs `npm install`

**Use when:** Dependency issues

---

## Deployment Scripts

### `npm run deploy:staging`
Deploy to staging environment.

```bash
npm run deploy:staging
```

**Actions:**
1. Runs build
2. Runs tests
3. Deploys to staging

**Use when:** Testing before production

---

### `npm run deploy:production`
Deploy to production environment.

```bash
npm run deploy:production
```

**WARNING:** Deploys to live production!

**Actions:**
1. Runs all tests
2. Builds for production
3. Deploys to production

**Use when:** Ready for production release

---

## Development Workflow Scripts

### Daily Development Workflow

```bash
# 1. Pull latest changes
git pull origin main

# 2. Install any new dependencies
npm install

# 3. Clear caches (if needed)
npm run cache:clear

# 4. Start development
npm run dev
```

### Before Committing Workflow

```bash
# 1. Run linting
npm run lint

# 2. Run type checking
npm run type-check

# 3. Check for XSS vulnerabilities
npm run check:xss

# 4. Run manual tests
npm run test:manual

# 5. Commit if all pass
git add .
git commit -m "Your commit message"
```

### Debugging Workflow

```bash
# 1. Clear all caches
npm run cache:clear

# 2. Clean install dependencies
npm run clean:install

# 3. Restart development server
npm run dev

# 4. Check browser console for errors
```

---

## Script Combinations

### Fresh Start (Clean Everything)

```bash
npm run clean
npm run clean:install
npm run cache:clear
npm run init:superadmin
npm run dev
```

### Pre-Deployment Check

```bash
npm run lint
npm run type-check
npm run check:xss
npm run test:manual
npm run build
npm run preview
```

### Performance Audit

```bash
npm run build
# Check dist/ folder size
du -sh dist/

# Analyze bundle
npx vite-bundle-visualizer
```

---

## Custom Scripts Setup

To add custom scripts, edit `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx",
    "lint:fix": "eslint . --ext ts,tsx --fix",
    "check:xss": "ts-node scripts/checkXSS.ts",
    "cache:clear": "ts-node tests/manual/forceClearCache.ts",
    "cache:linear": "ts-node tests/manual/clearLinearCache.ts",
    "init:superadmin": "ts-node tests/manual/initializeSuperadmins.ts",
    "test:manual": "ts-node tests/manual/runAllTests.ts",
    "test:upload": "ts-node tests/manual/testFileUpload.ts",
    "test:security": "ts-node tests/manual/verifySuperadminSecurity.ts"
  }
}
```

---

## Environment-Specific Scripts

### Development Environment

```json
{
  "scripts": {
    "dev": "vite --mode development",
    "build:dev": "vite build --mode development"
  }
}
```

### Staging Environment

```json
{
  "scripts": {
    "dev:staging": "vite --mode staging",
    "build:staging": "vite build --mode staging"
  }
}
```

### Production Environment

```json
{
  "scripts": {
    "build:prod": "vite build --mode production",
    "preview:prod": "vite preview --mode production"
  }
}
```

---

## Script Flags & Options

### Vite Dev Server Flags

```bash
# Custom port
npm run dev -- --port 3000

# Custom host
npm run dev -- --host 0.0.0.0

# Open browser automatically
npm run dev -- --open

# Enable HTTPS
npm run dev -- --https
```

### Build Flags

```bash
# Watch mode
npm run build -- --watch

# Source maps
npm run build -- --sourcemap

# No minification (debugging)
npm run build -- --minify false
```

### ESLint Flags

```bash
# Check specific files
npm run lint -- src/components/**/*.tsx

# Output to file
npm run lint -- --output-file lint-results.txt

# Ignore warnings
npm run lint -- --quiet
```

---

## Troubleshooting Scripts

### Script Not Found

**Error:**
```
npm ERR! missing script: cache:clear
```

**Solution:**
Check `package.json` scripts section. Add missing script.

---

### Permission Denied

**Error:**
```
EACCES: permission denied
```

**Solution:**
```bash
# Fix permissions
chmod +x scripts/*.ts

# Or run with sudo (not recommended)
sudo npm run script-name
```

---

### Port Already in Use

**Error:**
```
Port 5173 is already in use
```

**Solution:**
```bash
# Kill process on port
lsof -ti:5173 | xargs kill -9

# Or use different port
npm run dev -- --port 3000
```

---

## Quick Reference Table

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `npm run dev` | Start dev server | Daily development |
| `npm run build` | Production build | Before deployment |
| `npm run lint` | Code quality check | Before commit |
| `npm run check:xss` | Security scan | Before commit |
| `npm run cache:clear` | Clear caches | Debugging |
| `npm run init:superadmin` | Setup admin | First-time setup |
| `npm run test:manual` | Manual tests | Testing features |

---

**Last Updated**: January 2025  
**Maintained by**: Teifi Digital Development Team
