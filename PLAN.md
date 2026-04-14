# Nova Task — Implementation Plan

> A self-hosted, multi-user todo management PWA built with Vue 3 + Fastify + PostgreSQL.
> Design language mirrors Nova Code. All code must follow `/data-root/personal/CODING_CONVENTIONS.md`.

---

## Table of Contents

1. [Overview](#overview)
2. [Directory Structure](#directory-structure)
3. [Tech Stack](#tech-stack)
4. [Database Schema](#database-schema)
5. [API Routes](#api-routes)
6. [Frontend Architecture](#frontend-architecture)
7. [Feature Specifications](#feature-specifications)
8. [Implementation Phases](#implementation-phases)
9. [Agent Task Breakdown](#agent-task-breakdown)

---

## Overview

Nova Task is a self-hosted todo management web application. Key characteristics:

- **Multi-user** with admin role for the first registered user
- **Multiple lists** per user with icons, colors and categories
- **Tasks** with rich metadata: priority, due date/datetime, tags, description, subtasks (recursive nesting)
- **Done state** — done tasks are kept but visually separated (analogous to archived sessions in Nova Code)
- **Global search** across all lists and tasks
- **Full i18n** — English and German, selectable per user
- **Theme system** — exact Nova Code theme engine (12 presets + auto light/dark mode)
- **PWA** — installable, service worker, offline-capable
- **Admin panel** — user management, registration toggle

---

## Directory Structure

```
nova-task/
├── PLAN.md                         ← this file
├── app/
│   ├── Dockerfile                  ← 3-stage: dashboard-builder → api-builder → runtime
│   ├── docker-compose.yml          ← production (port 3080)
│   ├── dev.docker-compose.yaml     ← development with hot reload
│   ├── .env.example
│   ├── .dockerignore
│   ├── .gitignore
│   │
│   ├── api/                        ← Fastify + Prisma + TypeScript
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── Dockerfile.dev
│   │   ├── docker-entrypoint.dev.sh
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── src/
│   │       ├── index.ts            ← server bootstrap, plugin registration
│   │       ├── @types/
│   │       │   └── index.ts        ← shared types exported to dashboard
│   │       ├── classes/
│   │       │   ├── auth.ts         ← JWT, bcrypt, token helpers
│   │       │   ├── config.ts       ← env config, constants
│   │       │   └── database.ts     ← Prisma client, all DB query methods
│   │       └── routes/
│   │           ├── auth.ts         ← /api/auth/*
│   │           ├── lists.ts        ← /api/lists/*
│   │           ├── tasks.ts        ← /api/tasks/*
│   │           ├── tags.ts         ← /api/tags/*
│   │           ├── search.ts       ← /api/search
│   │           ├── settings.ts     ← /api/settings
│   │           ├── admin.ts        ← /api/admin/*
│   │           └── health.ts       ← /api/health (no auth)
│   │
│   └── dashboard/                  ← Vue 3 + Vite + Tailwind + PWA
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsconfig.app.json
│       ├── tsconfig.node.json
│       ├── vite.config.ts
│       ├── eslint.config.ts
│       ├── .prettierrc.json
│       ├── index.html
│       ├── env.d.ts
│       ├── public/                 ← favicon, PWA icons
│       └── src/
│           ├── main.ts
│           ├── App.vue
│           ├── sw.ts               ← PWA service worker
│           ├── @types/
│           │   └── index.ts        ← shared types (mirrors api/@types)
│           ├── assets/
│           │   └── css/
│           │       └── main.css    ← Tailwind v4 @theme + component classes
│           ├── classes/
│           │   ├── api.ts          ← Axios HTTP client, grouped API methods
│           │   └── router.ts       ← Vue Router, route definitions
│           ├── stores/
│           │   ├── auth.ts         ← auth state + login/logout
│           │   ├── lists.ts        ← list state + CRUD
│           │   ├── tasks.ts        ← task state + CRUD
│           │   └── tags.ts         ← tag state + CRUD
│           ├── lib/
│           │   ├── themes.ts       ← theme presets, applyTheme(), theme CSS vars
│           │   ├── i18n.ts         ← vue-i18n bootstrap, locale detection
│           │   └── utils.ts        ← date formatting, priority helpers, etc.
│           ├── locales/
│           │   ├── en.ts           ← English translations
│           │   └── de.ts           ← German translations
│           ├── components/
│           │   ├── layout/
│           │   │   ├── AppLayout.vue
│           │   │   ├── NavSidebar.vue      ← list navigation
│           │   │   ├── NavTopBar.vue
│           │   │   ├── PageHeader.vue
│           │   │   └── PageShell.vue
│           │   ├── task/
│           │   │   ├── TaskCard.vue
│           │   │   ├── TaskRow.vue         ← compact list-view row
│           │   │   ├── TaskDetailModal.vue ← create / edit task
│           │   │   ├── SubTaskList.vue
│           │   │   ├── SubTaskRow.vue
│           │   │   ├── PriorityBadge.vue
│           │   │   ├── DueDateBadge.vue
│           │   │   └── TagChip.vue
│           │   ├── list/
│           │   │   ├── ListCard.vue
│           │   │   └── ListEditModal.vue   ← create / edit list
│           │   └── shared/
│           │       ├── ConfirmModal.vue
│           │       ├── GlobalSearchModal.vue
│           │       ├── ColorPicker.vue
│           │       ├── IconPicker.vue      ← Material Icons picker
│           │       ├── TagChipsInput.vue
│           │       └── ApiOfflineBanner.vue
│           └── views/
│               ├── LoginView.vue
│               ├── SetupView.vue           ← first user registration
│               ├── HomeView.vue            ← dashboard: upcoming + overdue
│               ├── ListView.vue            ← single list task view
│               ├── AllTasksView.vue        ← all tasks across all lists
│               ├── SettingsView.vue        ← language, theme, change PW
│               └── AdminView.vue           ← user management + registration
```

---

## Tech Stack

### Backend (API)

| Package | Version | Purpose |
|---|---|---|
| fastify | ^5.3.2 | HTTP server |
| @fastify/cors | ^11.0.1 | CORS handling |
| @fastify/auth | ^5.0.2 | Auth middleware |
| @fastify/type-provider-typebox | ^5.1.0 | TypeBox schema validation |
| @sinclair/typebox | ^0.34.33 | Request/response schemas |
| @prisma/client | ^7.0.0 | Database ORM |
| @prisma/adapter-pg | ^7.4.2 | PostgreSQL adapter |
| prisma | ^7.0.0 | Schema + migrations (devDep) |
| pg | ^8.19.0 | PostgreSQL driver |
| jsonwebtoken | ^9.0.2 | JWT tokens |
| bcrypt | ^5.1.1 | Password hashing |
| uuid | ^11.1.0 | ID generation |
| typescript | ^5.8.3 | Type safety |
| ts-node-dev | ^2.0.0 | Dev hot reload |

### Frontend (Dashboard)

| Package | Version | Purpose |
|---|---|---|
| vue | ^3.5.13 | UI framework |
| vite | ^7.0.0 | Build tool |
| @vitejs/plugin-vue | ^5.2.4 | Vue plugin |
| tailwindcss | ^4.2.0 | Utility CSS |
| @tailwindcss/vite | ^4.2.0 | Tailwind Vite integration |
| vite-plugin-pwa | ^1.0.0 | PWA service worker |
| pinia | ^3.0.1 | State management |
| vue-router | ^4.5.0 | Client-side routing |
| vue-i18n | ^10.0.0 | Internationalization |
| axios | ^1.8.4 | HTTP client |
| dayjs | ^1.11.13 | Date manipulation |
| lucide-vue-next | ^0.575.0 | Icon set |
| vuedraggable | ^4.1.0 | Drag-and-drop reordering |
| clsx | ^2.1.1 | Conditional class names |
| tailwind-merge | ^3.5.0 | Tailwind class merging |
| vue-tsc | ^2.2.10 | TypeScript checking |

---

## Database Schema

```prisma
// prisma/schema.prisma

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Priority {
  NONE
  LOW
  MEDIUM
  HIGH
  URGENT
}

model User {
  id           String   @id @default(cuid())
  username     String   @unique
  passwordHash String
  isAdmin      Boolean  @default(false)
  createdAt    DateTime @default(now())

  // Preferences
  language   String  @default("en")  // "en" | "de"
  autoTheme  Boolean @default(true)
  darkTheme  String? // theme preset id
  lightTheme String? // theme preset id

  lists List[]
  tasks Task[]
  tags  Tag[]
}

model List {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  title     String
  icon      String?  // Material Icons ligature name, e.g. "check_circle"
  color     String?  // hex color, e.g. "#ff2d55"
  category  String?  // free-text category label for grouping lists
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tasks Task[]
}

model Task {
  id          String    @id @default(cuid())
  listId      String
  list        List      @relation(fields: [listId], references: [id], onDelete: Cascade)
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  title       String
  description String?   // plain text or markdown
  dueDate     DateTime?
  dueDateHasTime Boolean @default(false) // true = datetime; false = date only
  priority    Priority  @default(NONE)
  done        Boolean   @default(false)
  doneAt      DateTime?
  sortOrder   Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Subtask nesting (self-relation)
  parentTaskId String?
  parentTask   Task?   @relation("SubTasks", fields: [parentTaskId], references: [id], onDelete: Cascade)
  subTasks     Task[]  @relation("SubTasks")

  tags TaskTag[]
}

model Tag {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  name   String
  color  String? // hex color

  tasks TaskTag[]

  @@unique([userId, name])
}

model TaskTag {
  taskId String
  task   Task   @relation(fields: [taskId], references: [id], onDelete: Cascade)
  tagId  String
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([taskId, tagId])
}

// Key-value store for global app-wide settings
model AppSettings {
  key   String @id
  value String
}
```

### Key AppSettings entries

| key | default | description |
|---|---|---|
| `registrationEnabled` | `"true"` | Whether new user registration is open |

---

## API Routes

All routes except `/api/auth/*`, `/api/health` require a valid JWT bearer token in `Authorization` header.

### Auth — `/api/auth`

```
POST   /api/auth/register       — register a new user (checks registrationEnabled; first user = admin)
POST   /api/auth/login          — login, returns JWT
POST   /api/auth/validate       — validate token, returns { valid, username, isAdmin }
PATCH  /api/auth/password       — change own password (auth required)
```

### Lists — `/api/lists`

```
GET    /api/lists               — list all lists for authenticated user
POST   /api/lists               — create a list
PATCH  /api/lists/:id           — update a list (title, icon, color, category)
DELETE /api/lists/:id           — delete a list (cascades to tasks)
PATCH  /api/lists/reorder       — update sortOrder for multiple lists [{ id, sortOrder }]
```

### Tasks — `/api/tasks`

```
GET    /api/tasks               — list tasks (query: listId, parentTaskId, done, priority, tag)
GET    /api/tasks/:id           — get single task with subTasks and tags
POST   /api/tasks               — create a task
PATCH  /api/tasks/:id           — update a task (any field)
DELETE /api/tasks/:id           — delete a task (cascades subtasks)
PATCH  /api/tasks/:id/done      — toggle done state; sets/clears doneAt
PATCH  /api/tasks/reorder       — update sortOrder for multiple tasks [{ id, sortOrder }]
POST   /api/tasks/clear-completed — delete all done tasks in a list (body: { listId })
```

### Tags — `/api/tags`

```
GET    /api/tags                — list all tags for authenticated user
POST   /api/tags                — create a tag
PATCH  /api/tags/:id            — update a tag (name, color)
DELETE /api/tags/:id            — delete a tag (removes TaskTag joins)
```

### Search — `/api/search`

```
GET    /api/search?q=           — search tasks and lists by title/description
                                  optional query params: listId, done, priority, tagId
```

### Settings — `/api/settings`

```
GET    /api/settings            — get user preferences
PATCH  /api/settings            — update user preferences (language, autoTheme, darkTheme, lightTheme)
```

### Admin — `/api/admin` (requires `isAdmin: true`)

```
GET    /api/admin/users         — list all users
PATCH  /api/admin/users/:id     — edit user (isAdmin flag; cannot demote self)
DELETE /api/admin/users/:id     — delete user and all their data (cannot delete self)
GET    /api/admin/settings      — get global AppSettings
PATCH  /api/admin/settings      — update global AppSettings (e.g. registrationEnabled)
```

### Health — `/api/health`

```
GET    /api/health              — unauthenticated health check; returns { ok: true, needsSetup }
                                  needsSetup = true when zero users exist (triggers SetupView)
```

---

## Frontend Architecture

### Router

| Route | View | Auth | Notes |
|---|---|---|---|
| `/login` | LoginView | public | redirect to `/` if already authed |
| `/setup` | SetupView | public | only reachable when `needsSetup: true` |
| `/` | HomeView | required | dashboard: upcoming + overdue tasks |
| `/list/:id` | ListView | required | all tasks in a specific list |
| `/tasks` | AllTasksView | required | all tasks across all lists |
| `/settings` | SettingsView | required | user settings |
| `/admin` | AdminView | admin | redirects non-admin to `/` |

### Pinia Stores

#### `auth.ts`
```
State:   token, username, isAdmin, validated
Actions: login(), logout(), validate(), changePassword()
```

#### `lists.ts`
```
State:   lists: List[]
Actions: fetchLists(), createList(), updateList(), deleteList(), reorderLists()
Getters: listById(id), listsByCategory
```

#### `tasks.ts`
```
State:   tasks: Task[], tasksByListId: Record<string, Task[]>
Actions: fetchTasks(listId?), fetchTask(id), createTask(), updateTask(),
         deleteTask(), toggleDone(id), reorderTasks()
Getters: topLevelTasks(listId), subTasksOf(taskId), doneTasks(listId), activeTasks(listId)
         overdueTasks, upcomingTasks (due in next 7 days)
```

#### `tags.ts`
```
State:   tags: Tag[]
Actions: fetchTags(), createTag(), updateTag(), deleteTag()
Getters: tagById(id)
```

### API Client (`classes/api.ts`)

All grouped API methods using Axios with JWT interceptor and health tracking:

```ts
// ---------------------------------- Auth ----------------------------------
authApi.register(username, password)
authApi.login(username, password)       → { token }
authApi.validate()                      → { valid, username, isAdmin }
authApi.changePassword(current, next)

// ---------------------------------- Lists ----------------------------------
listApi.list()                          → List[]
listApi.create(payload)                 → List
listApi.update(id, payload)             → List
listApi.delete(id)
listApi.reorder(items)

// ---------------------------------- Tasks ----------------------------------
taskApi.list(params?)                   → Task[]
taskApi.get(id)                         → Task  (with subTasks, tags)
taskApi.create(payload)                 → Task
taskApi.update(id, payload)             → Task
taskApi.delete(id)
taskApi.toggleDone(id)                  → Task
taskApi.reorder(items)

// ---------------------------------- Tags ----------------------------------
tagApi.list()                           → Tag[]
tagApi.create(payload)                  → Tag
tagApi.update(id, payload)              → Tag
tagApi.delete(id)

// ---------------------------------- Search ----------------------------------
searchApi.search(q, params?)            → { lists: List[], tasks: Task[] }

// ---------------------------------- Settings ----------------------------------
settingsApi.get()                       → UserSettings
settingsApi.update(payload)

// ---------------------------------- Admin ----------------------------------
adminApi.listUsers()                    → User[]
adminApi.updateUser(id, payload)
adminApi.deleteUser(id)
adminApi.getSettings()                  → AppSettings
adminApi.updateSettings(payload)

// ---------------------------------- Health ----------------------------------
healthApi.check()                       → { ok: boolean, needsSetup: boolean }
```

---

## Feature Specifications

### 1. Auth & First-User Admin

- `POST /api/auth/register`: count all users before insert; if count === 0, set `isAdmin: true`
- `GET /api/health` returns `needsSetup: true` when user count is 0 — frontend redirects to `/setup`
- Registration can be disabled via `AppSettings.registrationEnabled = "false"` — API returns 403
- JWT payload: `{ userId, username, isAdmin }`
- Token stored in `localStorage`, sent as `Authorization: Bearer <token>`

### 2. Lists

- Each list belongs to a user; users cannot see each other's lists
- Fields: `title` (required), `icon` (Material Icons name, optional), `color` (hex, optional), `category` (string, optional)
- Category is a free-text grouping label — the sidebar groups lists by category
- Lists are user-sortable via drag-and-drop (vuedraggable); `sortOrder` field persisted
- Deleting a list cascades to all its tasks
- List card shows: title, icon, color accent, task count, done count

### 3. Tasks

- Fields: `title` (required), `description` (optional), `dueDate` (optional), `dueDateHasTime` flag, `priority` (NONE/LOW/MEDIUM/HIGH/URGENT), `tags` (many-to-many), `done`, `doneAt`
- Tasks belong to a list and a user
- Tasks within a list are sortable via drag-and-drop
- Subtasks: a task can have a `parentTaskId`; UI renders subtasks nested under parent
  - Subtasks are fetched together with parent (recursive)
  - Max recommended nesting depth: 3 levels (enforced in UI, not API)
  - Subtask `done` state is independent from parent
  - Completing all subtasks does NOT auto-complete parent (by design)

### 4. Done / Archive System

- `PATCH /api/tasks/:id/done` toggles `done` boolean and sets/clears `doneAt`
- In ListView: active tasks (done=false) shown first, then a collapsible "Completed" section below (analogous to nova-code's archived sessions panel)
- Done tasks are NOT deleted; they stay in the list and can be un-done
- Bulk clear: "Clear completed" action removes all done tasks in a list

### 5. Priority

| Value | Color | Badge |
|---|---|---|
| NONE | — | no badge |
| LOW | text-muted | low |
| MEDIUM | warning | medium |
| HIGH | primary (orange) | high |
| URGENT | destructive | urgent |

### 6. Tags

- Tags are per-user (shared across all lists)
- Each tag has a name and optional hex color
- Tasks can have multiple tags
- Tags displayed as colored chips
- Tags are also filterable in ListView and AllTasksView

### 7. Due Dates

- `dueDateHasTime: false` → display date only (e.g. "Apr 15")
- `dueDateHasTime: true` → display date + time (e.g. "Apr 15, 14:30")
- Overdue: due date is past + task not done → shown in red with alert icon
- Due today: shown in warning color
- Due soon (≤ 3 days): shown in slightly highlighted state

### 8. Global Search

- `GET /api/search?q=<term>` — searches:
  - List titles (case-insensitive `ilike`)
  - Task titles and descriptions (case-insensitive `ilike`)
- Results grouped: matching lists, then matching tasks (with their list name)
- Frontend: `GlobalSearchModal.vue` opened via keyboard shortcut (`Ctrl+K` / `Cmd+K`) or nav button
- Results are clickable — navigate to the list or open task detail

### 9. i18n — vue-i18n

- Locale stored in `User.language` (persisted to DB), fallback to `navigator.language`
- Supported locales: `en` (English), `de` (German)
- All UI strings must be in both locale files
- Locale files live in `src/locales/en.ts` and `src/locales/de.ts`
- Date formatting uses `dayjs` locale — automatically switches with app locale
- Translation key structure:
  ```ts
  {
    nav: { lists, allTasks, settings, admin, search },
    auth: { login, register, username, password, ... },
    list: { new, edit, delete, category, icon, color, ... },
    task: { new, edit, delete, done, undone, title, description, dueDate, priority, tags, subtasks, ... },
    priority: { none, low, medium, high, urgent },
    settings: { language, theme, password, ... },
    admin: { users, registration, ... },
    common: { save, cancel, delete, confirm, search, loading, ... }
  }
  ```

### 10. Theme System

Exact port of Nova Code's theme engine:

- 12 preset themes: Deep Space, Carbon, Terminal Green, Midnight Violet, Ember, Bloodline, OLED, Infrared, Cloud, Cream, Frost, Sakura
- CSS custom properties on `:root`: `--color-bg`, `--color-surface`, `--color-card`, `--color-border`, `--color-input`, `--color-primary`, `--color-primary-hover`, `--color-success`, `--color-warning`, `--color-destructive`, `--color-text-primary`, `--color-text-muted`, `--color-info`, `--color-fg`
- `lib/themes.ts`: theme definitions + `applyTheme(theme)` function
- Auto-theme: watches `prefers-color-scheme` and swaps between user's chosen dark/light preset
- User preference (`autoTheme`, `darkTheme`, `lightTheme`) saved to DB via settings API
- On app load: fetch settings → apply theme

### 11. PWA

- `vite-plugin-pwa` with `injectManifest` strategy
- Service worker (`src/sw.ts`): cache-first for assets, network-first for API
- Web app manifest: name "Nova Task", `display: standalone`, theme color from primary color
- App icons: 192×192, 512×512 (PNG)
- Installable on mobile and desktop

### 12. Admin Panel

**User Management**:
- Table of all users: username, isAdmin, createdAt, action buttons
- Actions per user: toggle admin, delete user
- Cannot delete or demote yourself (API + UI guard)

**Registration Toggle**:
- Toggle switch for `registrationEnabled` AppSettings
- When disabled, `/api/auth/register` returns 403 and frontend shows "Registration disabled"

---

## Implementation Phases

### Phase 1 — Project Scaffold

Set up the full project skeleton: all config files, Docker setup, empty source files.

**Deliverables:**
- `app/api/` — package.json, tsconfig.json, Dockerfile.dev, docker-entrypoint.dev.sh
- `app/dashboard/` — package.json, tsconfig.json, vite.config.ts, eslint.config.ts, .prettierrc.json, index.html, env.d.ts
- `app/Dockerfile` — 3-stage build (dashboard-builder → api-builder → runtime)
- `app/docker-compose.yml` — production with postgres service (port 3080)
- `app/dev.docker-compose.yaml` — development with hot reload volumes
- `app/.env.example`

**Docker notes:**
- Runtime image: `node:24-slim`
- Expose port `3000` internally; compose maps to `3080`
- Volumes: `~/.nova-task/config:/config`, `~/.nova-task/data:/data-root`
- Network: `nova-task`
- PostgreSQL: `postgres:17`
- `HOME=/config` in runtime container

### Phase 2 — Backend Foundation

Implement the complete API backend.

**Deliverables:**

`prisma/schema.prisma` — full schema as defined above

`src/classes/config.ts`:
```ts
// Environment variables with defaults and validation
export const config = {
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: process.env.JWT_SECRET!,
  database: { url: process.env.DATABASE_URL! }
};
```

`src/classes/auth.ts`:
```ts
// JWT sign/verify helpers
// bcrypt hash/compare helpers
// jwtPreHandler for Fastify (validates Bearer token, attaches user to request)
// adminPreHandler (requires isAdmin on request.user)
```

`src/classes/database.ts`:
- Prisma client instance
- Methods for every DB operation (listed by domain):
  - Users: countUsers(), findUserByUsername(), createUser(), updateUser(), deleteUser(), listUsers()
  - Lists: listLists(userId), findList(id, userId), createList(), updateList(), deleteList(), reorderLists()
  - Tasks: listTasks(params), findTask(id), createTask(), updateTask(), deleteTask(), toggleDone(), reorderTasks()
  - Tags: listTags(userId), createTag(), updateTag(), deleteTag()
  - Search: searchTasksAndLists(userId, q, params)
  - Settings: getUserSettings(userId), updateUserSettings(), getAppSettings(), updateAppSettings()

`src/routes/auth.ts` — all auth endpoints
`src/routes/lists.ts` — all list endpoints
`src/routes/tasks.ts` — all task endpoints
`src/routes/tags.ts` — all tag endpoints
`src/routes/search.ts` — search endpoint
`src/routes/settings.ts` — user settings endpoints
`src/routes/admin.ts` — admin endpoints (adminPreHandler guard)
`src/routes/health.ts` — health check

`src/index.ts` — Fastify bootstrap:
- Register CORS (allow all origins in dev)
- Register all route plugins
- Serve static dashboard from `../dashboard/dist` in production
- `fastify.listen({ port, host: '0.0.0.0' })`

### Phase 3 — Frontend Foundation

Implement all non-feature-specific frontend infrastructure.

**Deliverables:**

`src/assets/css/main.css` — Tailwind v4 `@theme` block with all CSS custom properties + all component classes (`.button`, `.field`, `.modal-wrap`, `.modal-panel`, `.modal-header`, `.modal-body`, `.modal-footer`, `.list-view`, `.list-item`, `.grid-view`, `.grid-item`, `.tab-navigation`, `.button-select`)

`src/lib/themes.ts` — 12 theme presets, `applyTheme()`, `getDefaultTheme()`, `watchAutoTheme()`

`src/lib/i18n.ts` — vue-i18n setup, locale detection from user settings or browser

`src/locales/en.ts` + `src/locales/de.ts` — complete translations for all keys

`src/lib/utils.ts` — `formatDueDate()`, `isDueToday()`, `isOverdue()`, `isDueSoon()`, `priorityColor()`, `priorityLabel()`

`src/@types/index.ts` — all shared TypeScript interfaces:
```ts
interface User { id, username, isAdmin, createdAt, language, autoTheme, darkTheme, lightTheme }
interface List { id, userId, title, icon?, color?, category?, sortOrder, createdAt, updatedAt, taskCount?, doneCount? }
interface Task { id, listId, userId, title, description?, dueDate?, dueDateHasTime, priority, done, doneAt?, sortOrder, createdAt, updatedAt, parentTaskId?, subTasks?: Task[], tags: Tag[] }
interface Tag { id, userId, name, color? }
interface UserSettings { language, autoTheme, darkTheme, lightTheme }
interface AppSettings { registrationEnabled: boolean }
type Priority = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
```

`src/classes/api.ts` — complete Axios client with all API method groups

`src/classes/router.ts` — all routes with auth guards:
- Navigation guard: check `authStore.validated`; if not, call `validate()`; if still not valid, redirect to `/login` (or `/setup` if `needsSetup`)
- Admin guard: redirect non-admin away from `/admin`

`src/stores/auth.ts` + `src/stores/lists.ts` + `src/stores/tasks.ts` + `src/stores/tags.ts`

`src/main.ts` — app bootstrap: createApp, Pinia, Router, i18n, mount

`src/App.vue` — root component: theme initialization, API health check, conditional layout

`src/sw.ts` — service worker for PWA

### Phase 4 — Layout Components

**Deliverables:**

`components/layout/AppLayout.vue` — main shell with sidebar + top bar + `<router-view>`

`components/layout/NavSidebar.vue`:
- App logo / title at top
- Lists grouped by category
- Active list highlighted
- "All Tasks" link at top
- Search button (opens GlobalSearchModal)
- Bottom: Settings, Admin (if admin)
- Collapsible on mobile

`components/layout/NavTopBar.vue`:
- Current view title
- Search button (mobile)
- User menu (logout, settings link)

`components/layout/PageHeader.vue` — slot-based header with title + actions

`components/layout/PageShell.vue` — page container with consistent padding

`components/shared/ApiOfflineBanner.vue` — banner shown when API is unreachable

`components/shared/ConfirmModal.vue` — generic confirmation dialog

`components/shared/GlobalSearchModal.vue`:
- Opens with Ctrl+K / Cmd+K
- Text input with debounced search
- Results: lists section + tasks section
- Click list → navigate to `/list/:id`
- Click task → open TaskDetailModal for that task

`components/shared/ColorPicker.vue` — color swatch grid with custom input

`components/shared/IconPicker.vue`:
- Grid of commonly used Material Icons (curated list: check_circle, star, work, home, shopping_cart, favorite, school, fitness_center, travel_explore, code, book, lightbulb, etc.)
- Search/filter input
- Selected icon preview with `<span class="material-icons">`

`components/shared/TagChipsInput.vue` — autocomplete tag input, creates new tags inline

### Phase 5 — Task & List Components

**Deliverables:**

`components/task/PriorityBadge.vue` — colored badge, accepts `priority` prop

`components/task/DueDateBadge.vue` — date display, color-coded (overdue=destructive, today=warning, upcoming=muted)

`components/task/TagChip.vue` — colored pill badge for a tag

`components/task/TaskRow.vue` — compact row for list view:
- Checkbox (done toggle)
- Title (strikethrough if done)
- Priority badge, due date, tag chips
- Subtask count indicator
- Edit button (opens TaskDetailModal)
- Context menu: edit, delete, move to list

`components/task/SubTaskRow.vue` — like TaskRow but indented, no subtask expand

`components/task/SubTaskList.vue` — renders SubTaskRows + inline "Add subtask" input

`components/task/TaskCard.vue` — card variant for potential future grid view

`components/task/TaskDetailModal.vue` — full create/edit form:
- Title input (required)
- Description textarea
- Due date picker (date or datetime based on toggle)
- Priority select
- Tag chips input (with autocomplete)
- Subtask section (SubTaskList)
- Move to list select
- Save / Cancel / Delete buttons

`components/list/ListCard.vue` — card showing list info + task counts

`components/list/ListEditModal.vue`:
- Title input
- Category input (with suggestions from existing categories)
- Color picker
- Icon picker
- Save / Cancel / Delete buttons

### Phase 6 — Views

**Deliverables:**

`views/LoginView.vue`:
- Username + password form
- Login button
- Registration link (if registration enabled)
- Error display
- Redirect to `/` on success

`views/SetupView.vue`:
- "Create your account" header
- Username + password form
- First user = admin (shown as info text)
- Redirect to `/` on success

`views/HomeView.vue` — dashboard:
- "Overdue" section: tasks past due date, sorted by due date ascending
- "Due Today" section
- "Due This Week" section
- Each task shown as TaskRow with list name badge
- Empty state when no upcoming tasks

`views/ListView.vue`:
- Page header: list icon + color + title + category + edit button
- Filter bar: priority filter, tag filter, sort (by date / by priority / manual)
- Drag-and-drop reordering (vuedraggable) for active tasks
- Active tasks → sorted by sortOrder
- "Add task" inline input at top of list
- Completed section: collapsible "Completed (N)" → shows done tasks chronologically
- "Clear completed" button in completed section
- Empty state for empty list

`views/AllTasksView.vue`:
- All tasks across all lists, grouped by list
- Filter bar: same as ListView
- No drag-and-drop (cross-list reorder not supported at this stage)

`views/SettingsView.vue` — tabbed layout:
- **Appearance tab**: theme picker (same grid of theme cards as Nova Code), auto-theme toggle
- **Language tab**: language selector (EN / DE) with live locale switch
- **Security tab**: change password form (current password + new password + confirm)

`views/AdminView.vue` — admin only:
- **Users tab**: table of all users with username, isAdmin badge, createdAt, actions
  - Toggle admin button (not on self)
  - Delete button with confirm modal (not on self)
- **Settings tab**: registration toggle switch

---

## Agent Task Breakdown

Each agent task below is self-contained and can be implemented independently (after its phase's prerequisites are met).

---

### Agent Task 1 — Project Scaffold

**Input:** PLAN.md (this file), nova-code structure as reference  
**Output:** Full project skeleton with all config files, no business logic yet

Create the following files exactly:

**`app/api/package.json`** — devDependencies: typescript, ts-node-dev, prisma, @types/node, @types/bcrypt, @types/jsonwebtoken; dependencies: fastify, @fastify/cors, @fastify/auth, @fastify/type-provider-typebox, @fastify/static, @sinclair/typebox, @prisma/client, @prisma/adapter-pg, pg, jsonwebtoken, bcrypt, uuid; scripts: dev, build, start, typecheck

**`app/api/tsconfig.json`** — same as nova-code: commonjs, ESNext, strict: true, noImplicitAny: true, outDir: build, esModuleInterop: true, resolveJsonModule: true

**`app/dashboard/package.json`** — dependencies: vue, vue-router, pinia, vue-i18n, axios, dayjs, lucide-vue-next, vuedraggable, clsx, tailwind-merge, tailwindcss, @tailwindcss/vite, vite-plugin-pwa; devDependencies: vite, @vitejs/plugin-vue, vue-tsc, typescript, eslint, prettier; scripts: dev, build, type-check, lint, format

**`app/dashboard/vite.config.ts`** — Vue + Tailwind + PWA plugins; alias `@` to `./src`; server port 8080

**`app/dashboard/tsconfig.json`** + `tsconfig.app.json` + `tsconfig.node.json`

**`app/dashboard/eslint.config.ts`** + `app/dashboard/.prettierrc.json`

**`app/dashboard/index.html`** — includes Material Icons CDN link: `<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">`

**`app/Dockerfile`** — 3-stage:
1. `dashboard-builder`: `FROM node:22` → install dashboard deps → `npm run build`
2. `api-builder`: `FROM node:24` → install api deps → `prisma generate` → `tsc`
3. `runtime`: `FROM node:24-slim` → copy built assets → `HOME=/config` → `EXPOSE 3000`

**`app/docker-compose.yml`**:
```yaml
services:
  nova-task:
    build: .
    ports: ["3080:3000"]
    env_file: .env
    volumes:
      - ~/.nova-task/config:/config
    depends_on: [postgres]
    networks: [nova-task]
  postgres:
    image: postgres:17
    environment:
      POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
    volumes: [nova-task-postgres-data:/var/lib/postgresql/data]
    networks: [nova-task]
volumes:
  nova-task-postgres-data:
networks:
  nova-task:
```

**`app/dev.docker-compose.yaml`** — development with host-mounted src volumes and Dockerfile.dev files for both api and dashboard

**`app/.env.example`**:
```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change_me
POSTGRES_DB=nova_task
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}
JWT_SECRET=change_this_to_a_long_random_string
PORT=3000
UID=1000
GID=1000
```

---

### Agent Task 2 — Backend: Prisma Schema + Database Class

**Input:** PLAN.md, Agent Task 1 output  
**Prerequisites:** Agent Task 1 complete

Create:
- `app/api/prisma/schema.prisma` — exact schema from this plan
- `app/api/src/classes/config.ts` — env config with validation (throw on missing JWT_SECRET)
- `app/api/src/classes/auth.ts` — JWT helpers (sign, verify), bcrypt helpers (hash, compare), `jwtPreHandler` fastify hook, `adminPreHandler` fastify hook
- `app/api/src/classes/database.ts` — full Database class with Prisma client + all methods organized in sections matching CODING_CONVENTIONS.md

The database.ts must export a singleton `db` instance.

Section structure in database.ts:
```
// -------------------------------------------------- Users --------------------------------------------------
// -------------------------------------------------- Lists --------------------------------------------------
// -------------------------------------------------- Tasks --------------------------------------------------
// -------------------------------------------------- Tags --------------------------------------------------
// -------------------------------------------------- Search --------------------------------------------------
// -------------------------------------------------- Settings --------------------------------------------------
```

All methods follow: `async listXxx()`, `async findXxx(id)`, `async createXxx(payload)`, `async updateXxx(id, data)`, `async deleteXxx(id)`

---

### Agent Task 3 — Backend: All Route Files

**Input:** PLAN.md, Agent Task 2 output  
**Prerequisites:** Agent Task 2 complete

Create all route files. Each route file exports an `async function xRoutes(fastify: FastifyInstance)`.

Route comment pattern: `// ---- METHOD /api/path — description`

Use TypeBox schemas for request body validation on POST/PATCH routes.

`src/routes/health.ts`:
```ts
// GET /api/health — health check; needsSetup = (userCount === 0)
```

`src/routes/auth.ts`:
```ts
// POST /api/auth/register — create account; first user = admin; check registrationEnabled
// POST /api/auth/login — returns JWT
// POST /api/auth/validate — validate token, returns { valid, username, isAdmin }
// PATCH /api/auth/password — change own password (requires auth)
```

`src/routes/lists.ts`, `src/routes/tasks.ts`, `src/routes/tags.ts`, `src/routes/search.ts`, `src/routes/settings.ts`, `src/routes/admin.ts` — all as specified in API Routes section

`src/index.ts` — bootstrap:
- Fastify instance with logger
- Register `@fastify/cors`
- Decorate fastify with auth methods
- Register all route plugins
- In production: register `@fastify/static` to serve `../dashboard/dist`
- `fastify.listen({ port: config.port, host: '0.0.0.0' })`

`src/@types/index.ts` — all shared type interfaces

---

### Agent Task 4 — Frontend: CSS, Themes, i18n, Utils, Types

**Input:** PLAN.md, nova-code `main.css` and `themes.ts` as reference  
**Prerequisites:** Agent Task 1 complete

Create:
- `src/assets/css/main.css` — full Tailwind v4 with `@import "tailwindcss"`, `@theme` block with all Nova Code CSS custom properties, all component classes
- `src/lib/themes.ts` — exact 12-theme array from Nova Code, `applyTheme()`, `getThemeById()`, `watchAutoTheme()`
- `src/lib/i18n.ts` — vue-i18n createI18n with lazy locale loading from `locales/`
- `src/locales/en.ts` — complete English translations (all keys from Feature Spec section 9)
- `src/locales/de.ts` — complete German translations
- `src/lib/utils.ts` — date/priority utilities
- `src/@types/index.ts` — all TypeScript interfaces

---

### Agent Task 5 — Frontend: API Client + Stores + Router

**Input:** PLAN.md, Agent Task 4 output  
**Prerequisites:** Agent Task 4 complete

Create:
- `src/classes/api.ts` — Axios client with JWT interceptor; all API method groups
- `src/stores/auth.ts` — token, username, isAdmin, validated state; login, logout, validate, changePassword
- `src/stores/lists.ts` — lists array, all CRUD actions, getters: listById, listsByCategory
- `src/stores/tasks.ts` — tasks state, all CRUD actions, getters: topLevelTasks, subTasksOf, doneTasks, activeTasks, overdueTasks, upcomingTasks
- `src/stores/tags.ts` — tags array, all CRUD actions
- `src/classes/router.ts` — all routes with auth navigation guard; sets document title per route
- `src/main.ts` — createApp with Pinia + Router + i18n; mount to `#app`
- `src/sw.ts` — minimal service worker for PWA
- `src/App.vue` — root: apply theme on mount, check API health, show `<RouterView>`

---

### Agent Task 6 — Frontend: Layout Components

**Input:** PLAN.md, Agent Task 5 output, nova-code layout components as design reference  
**Prerequisites:** Agent Task 5 complete

Create all layout and shared components as specified in Phase 4.

Key design requirements:
- Same color palette as nova-code (via CSS custom properties)
- Same button classes: `class="button"`, `class="button is-primary"`, `class="button is-destructive"`
- Same modal structure: `modal-wrap` → `modal-backdrop` + `modal-panel` → `modal-header` + `modal-body` + `modal-footer`
- Same sidebar style: fixed width, border-right border-border
- Inter font for sans, Cascadia Code for mono

NavSidebar must:
- Show lists grouped by category (categories as collapsible section headers)
- Show "All Tasks" at top of list
- Show task count badge per list
- Active list highlighted with primary color
- Keyboard shortcut hint for search (Ctrl+K)

GlobalSearchModal must:
- Debounce search input 300ms
- Show spinner while loading
- Group results: "Lists" header + list results, "Tasks" header + task results
- Each task result shows the list name
- No results state

---

### Agent Task 7 — Frontend: Task Components

**Input:** PLAN.md, Agent Task 6 output  
**Prerequisites:** Agent Task 6 complete

Create all task-related components as specified in Phase 5.

`TaskDetailModal.vue` implementation notes:
- Props: `{ isOpen: boolean, task?: Task, listId?: string, parentTaskId?: string }`
- Emit: `{ (e: 'close'): void, (e: 'saved', task: Task): void, (e: 'deleted', taskId: string): void }`
- On open: populate form from `task` prop (edit) or empty (create)
- Due date picker: native `<input type="date">` or `<input type="datetime-local">` toggled by "Include time" checkbox
- Priority: `<select>` or button group
- Tags: TagChipsInput component
- Subtasks section (shown only for non-subtask tasks): SubTaskList component
- Delete confirmation uses ConfirmModal

`SubTaskList.vue`:
- Shows existing subtasks as SubTaskRows with checkbox + title + done toggle + delete
- "Add subtask" row at bottom: inline input + save on Enter / blur
- Passes `parentTaskId` when creating subtasks via API

`TaskRow.vue` — primary task display component:
- Left: circle checkbox (done toggle), with strikethrough on title when done
- Middle: title, then tag chips row (if tags), then due date + priority badges
- Right: subtask count chip (if has subtasks), edit pencil icon button
- Entire row clickable → opens TaskDetailModal
- Done rows: opacity-60, strikethrough title

---

### Agent Task 8 — Frontend: List Components + All Views

**Input:** PLAN.md, Agent Task 7 output  
**Prerequisites:** Agent Task 7 complete

Create remaining components and all views.

`ListEditModal.vue`:
- Category input with datalist autocomplete from existing categories
- ColorPicker embedded
- IconPicker embedded
- On delete: ConfirmModal with warning about cascading task deletion

`views/ListView.vue` — the primary task view, most complex:
- Fetch list + tasks on mount (`route.params.id`)
- Watch `route.params.id` for list navigation
- Filter bar: priority multi-select, tag multi-select, sort select
- vuedraggable for task reordering (emits `reorder` which calls `taskApi.reorder()`)
- Inline "Add task" at top: title input, press Enter → `taskApi.create()` → add to top of list
- Active tasks section
- Completed section: `<details>` or manual toggle, shows done tasks + "Clear completed" button

`views/HomeView.vue`:
- On mount: fetch all tasks + lists
- Compute: overdue, dueToday, dueThisWeek
- Each section is collapsible
- Task rows show list name as small badge

`views/SettingsView.vue`:
- Fetch current settings on mount
- Theme section: grid of theme cards (show preview with mini color swatches), click to apply immediately
- Language section: radio or select, applying changes locale immediately
- Password section: form with current + new + confirm fields

`views/AdminView.vue`:
- Admin-only: redirect if not admin
- Users table with vuedraggable or standard table
- Registration toggle — PATCH to `/api/admin/settings`

`views/LoginView.vue` + `views/SetupView.vue` — auth pages (no layout wrapper, full-screen centered card)

---

### Agent Task 9 — PWA Icons + Final Wiring

**Input:** PLAN.md, all previous agent outputs  
**Prerequisites:** All previous tasks complete

- Generate or place placeholder PWA icons at `public/icon-192.png` and `public/icon-512.png`
- Wire `vite.config.ts` PWA manifest: name "Nova Task", short_name "Nova Task", theme_color "#ff2d55" (primary), background_color = dark bg color
- Verify `src/sw.ts` service worker registers correctly
- Verify Material Icons CDN link in `index.html`
- Create `app/api/docker-entrypoint.sh` (production: chown /config to UID/GID, then start node)
- Create `app/api/Dockerfile.dev` + `app/dashboard/Dockerfile.dev` for dev compose
- Final check: all route files imported in `src/index.ts`, all stores imported in `src/main.ts`, all views registered in router

---

## Development Workflow

### Local Development (Docker)

```bash
cd app
cp .env.example .env
# Edit .env with your values

docker compose -f dev.docker-compose.yaml up
# API: http://localhost:3001 (with hot reload)
# Dashboard: http://localhost:8080 (with HMR)
```

### Local Development (Native)

```bash
# Terminal 1: postgres
docker run -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=nova_task -p 5432:5432 postgres:17

# Terminal 2: API
cd app/api
npm install
npx prisma migrate dev
npm run dev

# Terminal 3: Dashboard
cd app/dashboard
npm install
npm run dev
```

### Production

```bash
cd app
cp .env.example .env
# Edit .env

docker compose up -d
# App: http://localhost:3080
```

---

## Coding Conventions Checklist

All code must follow `/data-root/personal/CODING_CONVENTIONS.md`. Key rules:

- [ ] Boolean local UI refs prefixed with `b`: `bSaving`, `bMenuOpen`, `bLoading`
- [ ] No abbreviations: `response` not `res`, `request` not `req` in route comments
- [ ] Import order: node_modules → components → stores → classes/api → types
- [ ] Section headers in all files: `// -------------------------------------------------- SectionName --------------------------------------------------`
- [ ] Sub-group headers: `// --- create ---`, `// --- delete ---`
- [ ] Vue SFC order: imports → props → emits → stores → data → computed → watchers → methods → lifecycle
- [ ] Always braces on control flow: `if (x) { }` never `if (x) doX()`
- [ ] `import type` for type-only imports
- [ ] `defineProps<...>()` + `withDefaults()` pattern
- [ ] Route comments: `// ---- GET /api/resource — description`
- [ ] PascalCase: types, interfaces, components
- [ ] camelCase: variables, functions, methods
- [ ] UPPER_SNAKE_CASE or PascalCase: constants
