# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Shevet Manager** — מערכת ניהול שבט צופים ישראלי. Full-stack Hebrew RTL web app for managing an Israeli scout troop.

## Commands

```bash
# Install dependencies
pnpm install

# Dev servers (both require PORT env var)
PORT=3000 pnpm --filter @workspace/api-server run dev
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/shevet-manager run dev

# DB push (Drizzle)
pnpm --filter @workspace/db run push-force

# Build all
pnpm run build

# Typecheck all
pnpm run typecheck

# Regenerate API client hooks + Zod schemas (Orval)
pnpm --filter @workspace/api-spec run generate
```

## Monorepo Structure

```
artifacts/
  api-server/       Express 5 + TypeScript backend (esbuild → dist/index.mjs)
  shevet-manager/   React + Vite + Tailwind frontend
lib/
  db/               Drizzle schema (37 tables) + migrations
  api-spec/         OpenAPI 3.1.0 spec + Orval codegen config
  api-zod/          Auto-generated Zod schemas (from Orval)
  api-client-react/ Auto-generated React Query hooks (from Orval)
```

## Architecture

### Backend (`artifacts/api-server/src/`)
- Entry: `index.ts` — requires `PORT` env var, seeds default admin user (`marcaz_boger`) on startup
- Routes: `routes/` — 22 modules mounted at `/api`
- DB: Drizzle ORM via `@workspace/db`, all in `lib/db/src/schema/`
- Auth: PIN-based two-step (name selection → PIN verify); role sent as `x-user-role` header on all mutations
- Logging: Pino + pino-http

### Frontend (`artifacts/shevet-manager/src/`)
- Routing: Wouter
- State: Zustand (`useAuth` store, key `shevet-auth` in localStorage)
- Data fetching: TanStack React Query
- API base: `import.meta.env.BASE_URL?.replace(/\/$/, "") || ""`; requires `PORT` + `BASE_PATH` env vars at build time
- Auth: `AuthUser { id, name, role }` — ProtectedRoute wrapper on all pages

### Database (`lib/db/src/schema/`)
Key tables: `scouts`, `tribe_users`, `events`, `attendance`, `attendance_sessions`, `budget_lines`, `annual_budget`, `procurement_orders`, `event_*` (12 event sub-tables), `activity_tracks`, `activities`, `next_year_assignments`, `tribe_schedule`, `permissions`, `settings`

### API Codegen
OpenAPI spec at `lib/api-spec/openapi.yaml` → Orval generates React Query hooks into `lib/api-client-react/src/generated/` and Zod schemas into `lib/api-zod/src/generated/`. Re-run codegen after changing the spec.

## Roles & Permissions

Roles: `marcaz_boger` | `marcaz_tzair` | `roshatz` | `roshgad` | `madrich` | `pael`

- `marcaz_boger` — full access, can lock/approve/release next-year assignments
- Per-section permissions stored in `permissions` table (role × section → canAccess)
- Event workspace tabs visibility controlled by staff role assignment per event

## Key Conventions

- **RTL everywhere**: `dir="rtl"` on HTML, Tailwind RTL utilities (pr/pl swapped)
- **Hebrew error messages** in toasts for all API errors
- **Role header**: `x-user-role: role || ""` on every mutation request
- **Numeric DB fields** (amounts) stored as strings, converted to floats in API responses
- **`gizra`** is the DB column name for "קבוצה/קבוצות" (do not rename)
- **Grade display**: `{ט,י,יא,יב}` → "שכבת X"; others → "כיתה X"
- **Excel imports** use SheetJS (`xlsx`), always show preview dialog before confirming

## Frontend Routes

```
/login                    Login (name search → PIN)
/dashboard                Numbered tiles (01–12) + tribal pulse stats
/hadracha/scouts          Scout DB (grade/battalion filter, medical/food tabs)
/hadracha/attendance      Attendance sessions + per-scout marking
/hadracha/activities      Activity submission workflow (טיוטה→הוגש→אושר)
/logistics/events         Event list
/logistics/events/:id     Event workspace (sidebar nav: משימות/רשומים/אוטובוסים/תפריט/פרטים)
/logistics/budget         Annual budget lines (Tzofinet format import)
/logistics/procurement    Purchase orders + file attachments
/management/staff         Staff tree (5 tabs incl. next-year planner)
/admin                    User management + permissions
/schedule                 Tribal calendar (color-coded by grade + event type)
/years                    Year archives
```

## Bus Auto-Assign Algorithm

```ts
reserveSpots = Math.max(0, Math.min(cap - 1, reserveForBogrim))
effectiveCap = Math.max(1, cap - reserveSpots)
```
Groups participants by grade/battalion; prevents zero-capacity buses.

## Next-Year Assignment Lock

Server-side `checkNotLocked(yearLabel, res)` blocks all mutations when locked. Flow: draft → lock → approve (+ optional release date) → release → activate (updates `scouts.role` + `tribe_users`). Only `marcaz_boger` sees assignments before release.
