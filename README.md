# Teifi Digital Client Portal

Client portal application built with React, Node.js, and Supabase.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account

### Installation

1. **Clone and install dependencies:**
```bash
npm install
```

2. **Setup environment variables:**
```bash
cp .env.example .env
# Edit .env with your actual values
```

3. **Start development servers:**
```bash
# Option 1: Run both frontend and backend together
npm run dev:all

# Option 2: Run separately (2 terminals)
npm run server:dev  # Terminal 1: Backend (port 3001)
npm run dev         # Terminal 2: Frontend (port 5173)
```

## 📁 Project Structure

```
├── src/
│   ├── server/          # Backend (Node.js + Hono)
│   │   ├── index.ts     # Server entry point
│   │   ├── routes/      # API routes
│   │   ├── services/    # Business logic
│   │   ├── methods/     # Data operations
│   │   └── helpers/     # Utilities
│   ├── components/       # React components
│   ├── services/         # Frontend services
│   └── ...
├── api/                  # Vercel serverless function
├── package.json
└── vercel.json          # Vercel configuration
```

## 🔧 Development

### Backend (Node.js)
- **Location**: `src/server/`
- **Port**: 3001 (local)
- **API Prefix**: `/make-server-7f0d90fb`

### Frontend (React + Vite)
- **Location**: `src/`
- **Port**: 5173 (local)

### Environment Variables

Required variables (see `.env.example`):
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key
- `VITE_SUPABASE_URL` - Supabase URL (frontend)
- `VITE_SUPABASE_ANON_KEY` - Anon key (frontend)
- `VITE_API_BASE_URL` - Backend API URL (local: `http://localhost:3001`)

## 🚢 Deployment

### Vercel

1. Push code to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel Dashboard
4. Deploy

The project is configured for Vercel with:
- Frontend: Static build
- Backend: Serverless function (`/api/server.ts`)

## 📚 Documentation

- **Coding Guidelines**: `src/guidelines/Guidelines.md`
- **Deprecated Code**: `src/supabase/README.md` (Deno backend - no longer used)

## 🛠️ Scripts

- `npm run dev` - Start frontend dev server
- `npm run server` - Start backend server
- `npm run server:dev` - Start backend with watch mode
- `npm run dev:all` - Start both frontend and backend
- `npm run build` - Build for production

## 🔐 Security

- Never commit `.env` file
- Use `.env.example` as template
- Backend secrets are not exposed to frontend
- CORS is whitelist-based (not `*`)

## 📝 License

Private project - All rights reserved
