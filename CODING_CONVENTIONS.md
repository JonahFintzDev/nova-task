# Coding Conventions

This document describes project-wide conventions for code style, structure, and naming. It is intended for human developers and automated agents (e.g. AI assistants, linters, code generators) to keep the codebase consistent.

---

## 1. Imports

### 1.1 Grouping order

Imports must be grouped in the following order, with a comment header for each group:

1. **`// node_modules`** — Third-party packages (Vue, vue-router, axios, etc.).
2. **`// components`** — Local Vue components (e.g. `@/components/...`). Omit if the file has no component imports.
3. **`// stores`** — Pinia stores (e.g. `@/stores/...`). Omit if unused.
4. **`// classes`** or **`// api`** — Project API/class modules (e.g. `@/classes/api`). Use the label that fits the module (e.g. `api` when importing API clients).
5. **`// types`** — Type-only imports. Use `import type { ... }` for types/interfaces.

Within each group, keep a single blank line only when it improves readability (e.g. between logical subgroups). Do not add blank lines between every import.

### 1.2 Type imports

- Use `import type { X, Y } from '...'` for types and interfaces.
- Do not mix type and value imports in the same statement when using `import type`.

### 1.3 Path aliases

- Use `@/` for dashboard src (e.g. `@/components/...`, `@/stores/...`, `@/classes/api`, `@/@types/index`).
- Use relative paths for same-package references (e.g. `../classes/database` in API code).

---

## 2. Variable and property naming

### 2.1 Boolean prefix `b`

- **Local boolean state (e.g. `ref<boolean>`):** Prefix with `b` so booleans are obvious at a glance.
  - Examples: `bMenuOpen`, `bUserMenuOpen`, `bLoading`, `bSaving`, `bIsLoading`, `bShowDirPicker`, `bNeedsSetup`, `bCursorAuthenticated`, `bEnterToSend`.
- **Non-boolean refs:** Do not use the `b` prefix (e.g. `automationToDelete` for an object, `triggeringId` for string | null).
- **API/backend fields and DTOs:** Follow existing API naming (e.g. `enabled`, `needsSetup`); the `b` prefix is for **local UI/component state** in the dashboard.

### 2.2 General naming

- **Variables, functions, methods:** `camelCase`.
- **Types, interfaces, classes, components (PascalCase file names):** `PascalCase`.
- **Constants (true constants, not refs):** `UPPER_SNAKE_CASE` or `PascalCase` for config objects (e.g. `WORKSPACE_COLORS`, `AGENT_OPTIONS`, `intervalPresets`).
- **Private or internal module members:** Prefix with `_` when appropriate (e.g. `_prisma`).

### 2.3 No truncated names

- Do not abbreviate or truncate variable names. Use full, readable names.
  - Prefer: `response`, `workspace`, `request`, `configuration`, `identifier`.
  - Avoid: `res`, `ws`, `req`, `config`, `id` (unless `id` is the domain term, e.g. a primary key field).

---

## 3. Vue single-file components (SFC)

Use `<script setup lang="ts">`. Structure the script block with the following sections in order.

### 3.1 Section order

1. **Imports** — Already covered above (node_modules → components → stores → classes/api → types).
2. **Props** — `// -------------------------------------------------- Props --------------------------------------------------`  
   - `defineProps<...>()` and, if used, `withDefaults(...)`.
3. **Emits** — Immediately after props: `defineEmits<...>()`.
4. **Store / router (if any)** — Optional: `// -------------------------------------------------- Store --------------------------------------------------` for `useXStore()`, `useRoute()`, `useRouter()` when they are the main “injected” deps. Alternatively, these can live at the top of Data.
5. **Refs** — `// -------------------------------------------------- Refs --------------------------------------------------`  
   - All `ref(...)`, `reactive(...)`, and module-level state used by the component.
6. **Computed** — `// -------------------------------------------------- Computed --------------------------------------------------`  
   - All `computed(...)`. Use `// (none)` when the section is intentionally empty.
7. **Watchers** — Optional: `// -------------------------------------------------- Watchers --------------------------------------------------` if you have multiple `watch(...)` and want a dedicated block. Otherwise watchers can sit after computed or before lifecycle.
8. **Methods** — `// -------------------------------------------------- Methods --------------------------------------------------`  
   - All component functions. Order: generic helpers first, then feature-specific (e.g. create, edit, delete). Sub-group with `// --- create ---`, `// --- edit ---`, `// --- delete ---` when there are many methods.
9. **Lifecycle** — `// -------------------------------------------------- Lifecycle --------------------------------------------------`  
   - `onMounted`, `onUnmounted`, `onBeforeUnmount`, etc.

Sections that are not used can be omitted, except when you want to leave an explicit placeholder (e.g. `// (none)` under Computed).

### 3.2 Section header style

Use the long separator style for main sections:

```ts
// -------------------------------------------------- SectionName --------------------------------------------------
```

Use short sub-group comments inside Methods when needed:

```ts
// --- create ---
// --- edit ---
// --- delete ---
```

### 3.3 Component-specific notes

- **Props + Emits:** Define props and emits at the top of the script, right after imports. Use TypeScript types for both.
- **Constants:** If the component needs constants (e.g. options, colors), place them after emits (or after a Types section if present) and before Data.

---

## 4. Order, formatting, and grouping of functions (general)

### 4.1 Within a Vue script (Methods section)

- Order: generic/utility helpers first (e.g. `formatDate`, `showSuccess`), then data-fetching (e.g. `fetchAll`, `fetchRuns`), then feature-specific methods grouped by action (create, edit, delete, toggle, etc.).
- Use `// --- feature ---` style comments to separate logical groups when the list is long.
- Prefer `function fnName()` in the script for consistency where the codebase already uses it; arrow functions in const are also acceptable (e.g. `const handleLogout = (): void => { ... }`).

### 4.2 In TypeScript/API files (non-Vue)

- **Top of file:** Imports (same grouping rules: node_modules → classes → types), then any module-level types or constants.
- **Sections:** Use clear section headers, e.g.  
  `// ---------------------------------- SectionName ----------------------------------`  
  or  
  `// -------------------------------------------------- SectionName --------------------------------------------------`  
  for larger files.
- **Function order:** Group by domain or feature (e.g. Auth, Workspaces, Settings). Within a group, list methods in a logical order (e.g. list, get, create, update, delete).
- **Route handlers:** In route files, keep handlers in a consistent order (e.g. GET list, GET by id, POST, PATCH, DELETE) and document each with a short comment (e.g. `// GET /api/automations — list all`).

### 4.3 Formatting

- Indentation: 2 spaces.
- Prefer single quotes for strings unless the string contains a single quote.
- Trailing commas in multi-line objects, arrays, and argument lists.
- Prefer explicit return types on exported and non-trivial functions (e.g. `: Promise<void>`, `: string`).
- **Control flow:** Do not use inline if/else. Always use curly braces `{ }` for `if`, `else`, `for`, `while`, etc., even for one-liners (e.g. prefer `if (x) { doSomething(); }` over `if (x) doSomething();`).

---

## 5. Summary checklist for agents

When generating or editing code, ensure:

- [ ] **Imports:** Grouped in order: node_modules → components → stores → classes/api → types; use `import type` for types.
- [ ] **Booleans:** Local boolean refs (and similar state) use the `b` prefix (e.g. `bLoading`, `bMenuOpen`).
- [ ] **Naming:** camelCase for variables/functions, PascalCase for types/components/classes, UPPER_SNAKE or PascalCase for constants; no truncated names (e.g. `response` not `res`, `workspace` not `ws`).
- [ ] **Vue script sections:** Order as Props → Emits → Store (optional) → Data → Computed → Watchers (optional) → Methods → Lifecycle; use the long `// ---...---` section headers.
- [ ] **Methods:** Grouped by feature with `// --- feature ---` when there are many; generic helpers first, then feature-specific.
- [ ] **TS/API:** Sections by domain; functions ordered logically within each section; route comments for HTTP method and path.
- [ ] **Control flow:** Always use `{ }` for if/else/for/while, even for one-liners; no inline single-statement branches.
