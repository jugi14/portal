# Teifi Digital - Client Portal

> Professional client portal for UAT testing, bug reporting, and project management with Linear.app integration

---

## Overview

The Teifi Client Portal is a comprehensive web application designed for client user acceptance testing (UAT), bug reporting, and feature approval workflows. It provides a seamless interface between clients and development teams through deep Linear.app integration.

### Key Features

- **Client UAT Workflow** - 5-stage kanban board for feature testing and approval
- **Linear Integration** - Real-time sync with Linear teams and issues
- **Role-Based Access Control** - 6-tier permission system (superadmin to viewer)
- **Multi-Customer Support** - Manage multiple clients in one portal
- **Rich Text Editing** - TipTap editor with markdown support
- **File Attachments** - Image and document uploads for issues
- **Team Hierarchy** - Organize teams in parent-child relationships
- **Comprehensive Caching** - Multi-layer cache strategy for performance
- **Dark Mode** - Full dark/light theme support
- **Mobile Responsive** - Optimized for all devices

---

## Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS 4.0** - Styling
- **ShadCN/UI** - Component library
- **TipTap** - Rich text editor
- **React Router** - Navigation

### Backend
- **Supabase** - Backend as a service
- **Hono** - Edge Functions web server
- **PostgreSQL** - Database
- **Deno** - JavaScript runtime for edge functions

### Integrations
- **Linear.app** - Issue tracking
- **Supabase Storage** - File storage
- **Supabase Auth** - Authentication

---

## Quick Start

Get started in 5 minutes:

```bash
# Clone and install
git clone https://github.com/teifi-digital/client-portal.git
cd client-portal
npm install

# Configure environment
cp .env.example .env
cp supabase/functions/server/.env.example supabase/functions/server/.env
# Edit .env files with your credentials

# Initialize and run
npm run init:superadmin
npm run dev
```

For detailed setup instructions, see [QUICK_START.md](QUICK_START.md)

---

## Documentation

| Document | Description |
|----------|-------------|
| [QUICK_START.md](QUICK_START.md) | 5-minute setup guide |
| [SETUP_GUIDE.md](SETUP_GUIDE.md) | Complete installation guide |
| [Guidelines.md](guidelines/Guidelines.md) | Development guidelines and best practices |
| [/documentation](http://localhost:5173/documentation) | In-app documentation (after running) |

---

## Project Structure

```
client-portal/
├── src/
│   ├── components/          # React components
│   │   ├── ui/              # ShadCN components
│   │   ├── admin/           # Admin panel components
│   │   ├── dashboard/       # Dashboard components
│   │   └── ...
│   ├── contexts/            # React contexts (Auth, Permissions, Theme)
│   ├── hooks/               # Custom React hooks
│   ├── pages/               # Page components
│   ├── services/            # API services and business logic
│   │   ├── linear/          # Linear API integration
│   │   └── ...
│   ├── types/               # TypeScript definitions
│   └── utils/               # Utility functions
├── supabase/
│   └── functions/
│       └── server/          # Backend Hono server
│           ├── .env         # Backend environment variables
│           └── ...
├── styles/                  # CSS files
├── tests/                   # Test files
└── guidelines/              # Development documentation
```

---

## Architecture

### Frontend Architecture

```
┌─────────────────────────────────────────┐
│           REACT APPLICATION             │
├─────────────────────────────────────────┤
│  Contexts (Auth, Permissions, Theme)    │
│  ├── AuthContext                        │
│  ├── PermissionContext                  │
│  ├── SidebarContext                     │
│  └── ThemeContext                       │
├─────────────────────────────────────────┤
│  Service Layer                          │
│  ├── linearTeamService                  │
│  ├── linearTeamIssuesService            │
│  ├── customerServiceV2                  │
│  ├── userServiceV2                      │
│  └── cacheService (multi-layer)         │
├─────────────────────────────────────────┤
│  Components (Pages, UI, Admin)          │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│          BACKEND (Hono Server)          │
├─────────────────────────────────────────┤
│  Routes (Teams, Users, Customers, etc.) │
├─────────────────────────────────────────┤
│  Supabase (Auth, DB, Storage)           │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│         LINEAR.APP API                  │
└─────────────────────────────────────────┘
```

### Permission System

```
Superadmin (Full system access)
  ↓
Admin (Manage users & customers)
  ↓
Client Manager (Manage customer teams)
  ↓
Client User (View & test features)
  ↓
Tester (Limited testing)
  ↓
Viewer (Read-only)
```

### UAT Workflow

```
Development Complete
  ↓
Pending Review (Client tests)
  ↓
[Approved] → Released
  OR
[Changes Needed] → Blocked/Needs Input → Back to Pending Review
  OR
[Canceled] → Failed Review
```

---

## Core Principles

### KISS (Keep It Simple, Stupid)
- Simple solutions are easier to maintain
- Use straightforward, readable code
- Minimize complexity

### DRY (Don't Repeat Yourself)
- Single source of truth
- Use existing contexts and services
- Extract repeated logic into hooks

### Performance
- Multi-layer caching strategy
- React.memo for list components
- Optimize re-renders
- Lazy loading

### Maintainability
- TypeScript strict mode
- < 500 lines per file
- Self-documenting code
- Comprehensive error handling

---

## Environment Variables

### Required Variables

**Frontend (.env)**
```bash
VITE_SUPABASE_URL=              # Supabase project URL
VITE_SUPABASE_ANON_KEY=         # Supabase anon key
VITE_LINEAR_API_KEY=            # Linear API key
VITE_APP_ENV=development        # Environment
VITE_API_BASE_URL=              # Backend URL
```

**Backend (supabase/functions/server/.env)**
```bash
SUPABASE_URL=                   # Supabase project URL
SUPABASE_ANON_KEY=              # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=      # Supabase service role key (CRITICAL)
SUPABASE_DB_URL=                # Database connection string
LINEAR_API_KEY=                 # Linear API key
```

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for complete environment configuration.

---

## Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Linear account with API key

### Running Locally

```bash
# Frontend
npm run dev

# Backend (separate terminal)
cd supabase/functions/server
deno run --allow-net --allow-env --allow-read index.tsx
```

### Building for Production

```bash
npm run build
npm run preview
```

### Testing

```bash
npm run test:manual          # Manual tests
npm run check:xss            # Security scan
```

---

## Security

### Critical Security Rules

1. **NO** `innerHTML` with user input (XSS prevention)
2. **NO** logging of token information
3. **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` to frontend
4. **ALWAYS** validate user input
5. **USE** secure token storage

See [Guidelines.md](guidelines/Guidelines.md) for complete security guidelines.

---

## Performance

### Caching Strategy

- **In-Memory Cache** - Fastest, lost on refresh
- **sessionStorage** - Per-tab, survives refresh
- **localStorage** - Persistent across sessions
- **Server-side Cache** - Shared across clients

### Cache TTL Reference

| Data Type | TTL | Reason |
|-----------|-----|--------|
| User Permissions | 0 | Always fresh |
| Team List | 5 min | Frequent updates |
| Team Details | 10 min | Moderate changes |
| Linear Teams | 30 min | Slow-changing |
| Workflows | 30 min | Rarely changes |

---

## Contributing

### Before Committing

- [ ] Follow [Guidelines.md](guidelines/Guidelines.md)
- [ ] Run `npm run lint`
- [ ] Run `npm run check:xss`
- [ ] Test critical flows
- [ ] No `.env` files in commits
- [ ] No emojis in code

### Code Style

- **Components**: PascalCase
- **Hooks**: camelCase with `use` prefix
- **Constants**: UPPER_SNAKE_CASE
- **Files**: < 500 lines
- **Functions**: < 50 lines

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Environment vars not loading | Restart dev server |
| Supabase connection failed | Check URL format |
| Linear API 401 | Verify API key |
| Backend not responding | Check backend terminal |
| Cache showing old data | Run `npm run cache:clear` |

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed troubleshooting.

---

## Useful Commands

```bash
# Development
npm run dev                  # Start dev server
npm run build                # Production build
npm run preview              # Preview production build

# Cache Management
npm run cache:clear          # Clear all caches
npm run cache:linear         # Clear Linear cache

# Testing
npm run test:manual          # Manual tests
npm run check:xss            # XSS vulnerability scan

# Database
npm run init:superadmin      # Initialize superadmins
```

---

## Support

### Resources

- **Documentation**: http://localhost:5173/documentation (after running)
- **Guidelines**: [Guidelines.md](guidelines/Guidelines.md)
- **Setup Guide**: [SETUP_GUIDE.md](SETUP_GUIDE.md)
- **Quick Start**: [QUICK_START.md](QUICK_START.md)

### Getting Help

- Email: support@teifi.com
- GitHub Issues: [Create Issue](https://github.com/teifi-digital/client-portal/issues)

---

## License

Proprietary - Teifi Digital  
Copyright 2025 Teifi Digital. All rights reserved.

---

## Changelog

### Version 2.0 (January 2025)
- Complete rewrite with TypeScript
- Multi-layer caching system
- Role-based permission system
- Client UAT workflow
- Dark mode support
- Mobile optimization

### Version 1.0 (2024)
- Initial release
- Basic Linear integration
- Simple kanban board

---

**Maintained by**: Teifi Digital Development Team  
**Last Updated**: January 2025  
**Status**: Production Ready
