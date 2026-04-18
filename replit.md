# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Shevet Manager — Israeli Scout tribe (שבט) management system with Hebrew RTL UI.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui

## Key Commands

```bash
# Start API server (dev)
pnpm --filter @workspace/api-server run dev

# Start frontend (dev)
pnpm --filter @workspace/shevet-manager run dev

# Push DB schema
pnpm --filter @workspace/db run push-force
```

## Architecture

### Routing (Frontend — `/artifacts/shevet-manager`)

```
/login                    → Login page — search bar always visible when DB users exist
/dashboard                → Redesigned numbered-tile hub (01-12) with live tribal pulse stats
/teams                    → Teams/Gizrot page — search + filter פעילים/חניכים/מדריכים by team

/hadracha                 → הדרכה section hub (3 tiles)
/hadracha/scouts          → Scout database with grades + tribe roles
/hadracha/attendance      → Attendance tracking
/hadracha/activities      → Activity submission (הגשת פעולות)

/logistics                → לוגיסטיקה section hub (3 tiles)
/logistics/events         → Event list
/logistics/events/:id     → Event workspace — sidebar nav + dashboard grid; auto-assign buses by שכבה/גדוד; simplified tasks (title+assignee+done); section visibility per staff role
/logistics/budget         → Annual budget with budget lines by category
/logistics/procurement    → Procurement orders, quotes, invoices

/management               → ניהול section hub (3 tiles)
/admin                    → User management + permissions
/management/staff         → Staffing tree (visual hierarchy by role/battalion/instructor)
/years                    → Year archive + knowledge preservation
```

### DB Tables

| Table | Purpose |
|---|---|
| `scouts` | Scout database (grade, grade_level, tribe_role, parent_phone) |
| `events` | Tribe events/מפעלים (type, dates, budget, responsible) |
| `event_tasks` | Per-event task list (done, priority, assignee) |
| `event_participants` | Event registrations linked to scouts |
| `event_buses` | Bus assignments per event |
| `event_menu` | Meal planning per event day |
| `budget_lines` | Budget lines from Tzofinet (category, account, budget, updated, execution, orders) |
| `activities` | Activity submissions with optional trackId |
| `activity_tracks` | Activity tracks/מסלולים created by מרכז בוגר |
| `procurement_orders` | Purchase orders + quotes (supplier, items detail) |
| `attendance` | Attendance records (linked to session, event, or date) |
| `attendance_sessions` | Named attendance sessions (title, date, type, battalion) |
| `budget` | One-off budget entries |
| `annual_budget` | Annual budget target |
| `event_deadlines` | Deadlines per event (title, date, responsible, completed) |
| `event_staff` | Event staff assignments — שכבגיסטים (userId, role, notes) |
| `tribe_schedule` | Tribal schedule entries (grade colors, type colors, multi-grade) |
| `tribe_users` | System users with roles, team assignment, grade |
| `permissions` | Role-based access control |
| `year_archives` | Year archive with highlights/knowledge |

### Scout Grade Structure

Individual grade levels for schedule: ד׳, ה׳, ו׳, ז׳, ח׳, ט׳, מדריכים, פעילים, ראש״גדים, ראש״צים, מרכזים, בוגרים, חופש/הדממה
DB values: dalet, hey, vav, zayin, chet, tet, madrichim, paelim, roshgadim, roshatzim, merkazim, bogrim, hofesh
Multi-grade: comma-separated (e.g. "dalet,hey,vav")

Tribe roles: ראשגד, מרכז צעיר, מדריך, פעיל, חניך

### Terminology
- UI uses "קבוצה/קבוצות" (NOT "גיזרה/גיזרות") — DB column `scouts.gizra` unchanged
- קבוצה = scout group with madrich; גדוד = battalion; שכבה = grade level; צוות = team of paelim

### Event Workspace Staff Section Visibility
- marcaz_boger/tzair, roshatz, roshgad → see ALL sections
- Staff members see sections mapped to their role (STAFF_ROLE_SECTIONS in event-workspace.tsx)
- Non-staff non-editors → dashboard only
- Auto-assign buses endpoint requires editor role (403 for unauthorized)

### Sidebar Navigation

Three main sections in sidebar (expandable when active):
1. **הדרכה** → scouts, attendance, activities
2. **לוגיסטיקה** → events, budget, procurement
3. **ניהול** → admin, years

### Auth

- `AuthUser { id, name, role }` — login fetches `/api/users`
- Roles: `marcaz_boger`, `marcaz_tzair`, `roshatz`, `roshgad`
- Zustand `useAuth` store

### API Patterns

```ts
const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
fetch(`${API_BASE}/api/endpoint`)
```

### Event Workspace Tabs

When entering an event via `/logistics/events/:id`:
- **משימות** — Checklist with priority (high/normal/low), assignee
- **רשומים** — Participants from scout database, bus assignment
- **אוטובוסים** — Bus management, capacity, driver, meeting point
- **תפריט** — Multi-day meal planning (breakfast/lunch/dinner/snack)
- **פרטים** — Full event details view

### Budget Lines (Tzofinet Format)

Columns: category (סעיף תקציבי), description (חשבון), accountCode, allocatedAmount (תקציב), updatedBudget (עדכון תקציב), spentAmount (ביצוע בפועל), openOrders (הזמנות רכש), totalExecution (סה"כ ביצוע), notes
Grouped by category with collapsible sections
Summary cards: income, expenses, balance, actual execution
Import from Tzofinet Excel (auto-detects format) or generic Excel

### Procurement

Order types: הזמנה / הצעת מחיר / חשבונית
Statuses: ממתין → אושר → הוזמן → נמסר / בוטל
Fields: supplier, contact, items detail, quote notes, approved by
File attachments: PDF/Excel/image stored as base64 in `fileData` column (up to 5MB)

### Attendance Sessions

Named sessions instead of bare date-picking:
- Create session: title, date, type (regular/special/camp/training/ceremony), battalion
- Mark attendance per session: נוכח / איחר / נעדר
- Session list view → drill-in to mark

### Budget Lines Excel Import

Two formats supported:
1. **Tzofinet format**: Auto-detected by "סעיף תקציבי" header; parses all columns (unit, category, account, budget, updated, execution, orders, total, notes)
2. **Generic format**: Maps Hebrew headers (קטגוריה/סעיף, תיאור, תקציב, הוצאה, שנה שעברה, הערות)
Import replaces existing data for the year. Preview dialog before confirming.

### Staffing Tree

Visual hierarchy page at /management/staff:
- Tabs: צוות מובל (moadal), הדרכה ד-ח (chanichim), צוות ט (tet), צוות פעילים (paelim), שנה הבאה (next-year)
- Moadal: Two-wing org chart (הדרכה / פעילים) with מרכזים, ראשגדים, ראשצים
- Chanichim: Grade ד-ח scouts organized by battalion/instructor
- Tet: Grade ט scouts with course instructors
- Paelim: Team view (from tribe_users.team) + gizra view toggle; shows ראשצ banner
- Next Year: Assignment planner for grade ט→madrich, י-יא→pael; archive viewer for past years
- Excel import: Multi-sheet שיבוצים parser (צוות מוביל, הדרכה ד-ה, הדרכה ו-ח, צוותי פעילים) + generic format
- tribe_users now has `team`, `grade`, and `scoutId` fields for team assignment tracking
- Drag-drop: All tabs support drag-drop for reassigning users/scouts between battalions/teams
- Sync: POST /api/users/sync-staff-to-scouts — creates scout records for paelim, links scoutId, matches roshatz to teams
- Team CRUD: Add/rename/delete teams in פעילים tab; batch rename/delete via POST /api/users/rename-team and /api/users/clear-team

### Scout Import (3 File Formats)

1. **Main list** (ניסיון_לאתר): שם פרטי, שם משפחה, מין, שם בית הספר, שכבה, גדוד → upsert mode
2. **Medical** (בעיות_רפואיות): Detected by "אלרגיות ומחלות" header; multi-row per scout aggregated → auto-merge mode
3. **Food** (העדפות_מזון): Detected by "העדפות מזון" without "שם בית הספר" → auto-merge mode

### Activity Submission (הגשת פעולות)

**Tracks (מסלולים)**: Container concept for grouping activities
- מרכז בוגר creates tracks (e.g., "מסלול ערכי", "מסלול הכשרה")
- מרכז צעיר sends requirements to ראשגדים per track
- ראשגדים and מדריכים create activities linked to tracks
- DB: `activity_tracks` table (id, title, description, gradeLevel, createdBy, status)
- `activities.trackId` links activities to tracks

Types: פעולה, טיול, ערב, שבתון, אירוע מיוחד
Grade levels: חניכים ד-ו, חניכים ז-ט, פעילים י-יב, מדריכים, כלל השבט
Statuses: טיוטה → הוגש → אושר / הערות / נדחה

### Tribal Schedule (לוז שבטי)

Color-coded calendar at /schedule:
- **Grade colors**: Each grade level has a distinct color (sky=ד-ו, emerald=ז-ח, amber=ט, rose=פעילים, indigo=מדריכים, violet=כלל השבט)
- **Type colors**: Each event type has its own color (orange=מפעל, purple=שבטי, fuchsia=ישיבה, yellow=הכשרה, teal=פעולה, red=מחנה, cyan=טיול, pink=חג)
- **Multi-grade support**: Events can belong to multiple grade levels (stored as comma-separated in gradeLevel field)
- **Grade filter bar**: Click grade chips to filter calendar by grade level
- **Event deadlines**: Create deadline tables per event (מפעל) — deadlines appear on the calendar with red markers
- **Deadline table**: Dialog for CRUD of deadlines per event; shows status (ממתין/באיחור/הושלם), checkbox completion
- API auth: Deadline mutation routes require `x-user-role` header (marcaz_boger/marcaz_tzair only)
- DB: `event_deadlines` table (eventId FK → events, title, date, responsiblePerson, completed)
