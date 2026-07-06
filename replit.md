# Staff Portal — Sharbazher Education Directorate

A Kurdish-language staff management portal for the Sharbazher Education Directorate. Built as a pnpm monorepo with a React + Vite frontend, Express API backend, PostgreSQL database, and real-time chat via Socket.IO.

## Stack

- **Frontend:** React 19 + Vite + Tailwind CSS + shadcn/ui (`artifacts/staff-portal`)
- **Backend:** Express 5 + Socket.IO (`artifacts/api-server`)
- **Database:** PostgreSQL via Drizzle ORM (`lib/db`)
- **Auth:** Express session (bcrypt password hashing)
- **Language:** Kurdish (Sorani, RTL)

## Running the project

Both services start automatically via their configured workflows:

| Service | Workflow | Port |
|---|---|---|
| Staff Portal (frontend) | `artifacts/staff-portal: web` | 5173 |
| API Server (backend) | `artifacts/api-server: API Server` | 8080 |

To start manually:
```bash
# Install deps (first time)
pnpm install

# Push DB schema
cd lib/db && pnpm exec drizzle-kit push

# Seed sample data
npx tsx scripts/src/seed.ts

# Start frontend
pnpm --filter @workspace/staff-portal run dev

# Start backend
pnpm --filter @workspace/api-server run dev
```

## Default login credentials

After seeding, use any of these accounts (password: `changeme123`):

| Username | Role |
|---|---|
| `aram.hassan` | Super Admin |
| `karwan.jamal` | Super Admin |
| `sara.karim` | فەرمانبەر (Staff) |

## Environment variables

- `SESSION_SECRET` — required for Express session (already configured as a secret)
- `DATABASE_URL` — provided automatically by Replit's built-in PostgreSQL

## Features

- Staff management (CRUD, profile photos, signatures)
- Departments and roles
- Document tracking with file uploads
- Real-time chat between staff
- Kurdish UI (RTL)

## User preferences

(none yet)
