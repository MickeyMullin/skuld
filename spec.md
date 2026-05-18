<!-- spec.md -->
# Skuld — Project Spec

Personal time tracking app named for the Norn of obligation. Replaces a manual Excel spreadsheet. Runs locally on macOS. Two processes (Vite dev server + Bun API server) communicating over HTTP.

---

## Code Style & Preferences

- TypeScript everywhere
- No semicolons (line-ending)
- ES modules only
- Functions with named exports — no classes
- Every file starts with a comment containing its path relative to project root: `// server/src/db.ts`
- Prefer `const` arrow functions for named function expressions
- Use template literals over string concatenation
- Use pnpm as the package manager — not npm or yarn

---

## Tech Stack

### Server
- **Runtime**: Bun
- **Framework**: ElysiaJS
- **Database**: `bun:sqlite` (Bun's built-in SQLite binding)
- **Port**: 3456

### Client
- **Bundler**: Vite
- **Framework**: React 19
- **Language**: TypeScript
- **Styling**: Plain CSS (no Tailwind, no CSS-in-JS)
- **Port**: 5199
- **Fonts**: DM Sans (body), JetBrains Mono (times/numbers) via Google Fonts

---

## Data Model

One table, one index:

```sql
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,            -- 'YYYY-MM-DD'
  started_at TEXT NOT NULL,      -- ISO 8601 datetime
  ended_at TEXT NOT NULL,        -- ISO 8601 datetime
  note TEXT NOT NULL DEFAULT '',
  client TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
CREATE INDEX IF NOT EXISTS idx_entries_client ON entries(client);
```

The SQLite file lives at `server/skuld.db` and is gitignored.

---

## Core Business Logic

### Quarter-hour rounding ("in my favor")

All times round to the nearest 15-minute boundary to maximize billable time:
- **Start times** floor to the nearest :00 / :15 / :30 / :45
- **End times** ceil to the nearest :00 / :15 / :30 / :45

Examples:
- 9:07 start → 9:00
- 10:22 end → 10:30
- 9:00 start → 9:00 (no change)
- 10:30 end → 10:30 (no change)

Rounding is applied server-side before storing. The client shows a preview of the rounded values as the user types.

### Overlap prevention

After rounding, the server checks for overlapping entries on the same date. Two entries overlap if:
```
new_start < existing_end AND new_end > existing_start
```
Exclude the entry's own ID when updating. Return HTTP 409 with `{ error: "This entry overlaps with an existing one" }` on conflict.

### Duration math

Duration in minutes = `(Date(ended_at) - Date(started_at)) / 60000`. All summaries are computed from this.

---

## API Routes

All routes are prefixed with `/api`.

### `GET /api/entries?from=YYYY-MM-DD&to=YYYY-MM-DD`
Returns entries in the date range (inclusive), ordered by `date, started_at`.

### `POST /api/entries`
Body: `{ date, startedAt, endedAt, note, client }`
Applies rounding, checks overlaps, inserts, returns the created entry (with rounded times).

### `PUT /api/entries/:id`
Body: any subset of `{ date, startedAt, endedAt, note, client }`
Merges with existing values, applies rounding, checks overlaps (excluding self), updates, returns the updated entry.

### `DELETE /api/entries/:id`
Deletes the entry. Returns `{ deleted: true }`.

### `GET /api/clients`
Returns `string[]` of distinct client codes from existing entries, sorted alphabetically.

---

## UI Layout

```
┌───────────────────────────────────────────────────────────────┐
│  Skuld              ← Prev  Apr 14–18, 2026  Next →  [Today]  │
├──────────────────────────────────────────────────┬────────────┤
│                                                  │ WEEK TOTAL │
│  ▾ Mon, Apr 14          3h 15m  PC 1h WB 2h15m   │  32h 30m   │
│    9:00 AM – 10:15 AM   1h 15m  PC standup    PC │            │
│    10:15 AM – 12:30 PM  2h 15m  WB nav cache  WB │  PC  12h   │
│    [ + Add Entry ]                               │  ████░░░░  │
│                                                  │  WB  20h30m │
│  ▸ Tue, Apr 15          8h      PC 2h WB 6h      │  ██████░░  │
│  ▸ Wed, Apr 16          ...                      │            │
│  ▸ Thu, Apr 17          ...                      │            │
│  ▸ Fri, Apr 18          ...                      │            │
│                                                  │            │
└──────────────────────────────────────────────────┴────────────┘
```

- **Week navigation**: prev/next buttons shift by 7 days. "Today" button appears when not on the current week, jumps back.
- **Day sections**: collapsible accordion. Today expanded by default, others collapsed. Day header shows the day label, total hours, and per-client chips.
- **Entry rows**: show formatted time range, duration, note, and client badge. Edit (pencil) and delete (×) buttons appear on hover. Delete requires a confirmation click (first click highlights red, second click deletes).
- **Entry form**: inline within the day section. Time inputs are native `<input type="time">`. Shows rounded preview next to each time input when rounding will occur. Note is a text input. Client is a row of toggle buttons for known clients (PC, WB hardcoded as defaults, plus any others from the DB) plus an "Other" button that shows a text input. When adding, the start time pre-fills from the previous entry's end time. Focus lands on the note field.
- **Week summary**: sticky sidebar. Shows total hours in large text, then a per-client breakdown with mini progress bars showing relative proportion.
- **Responsive**: below 800px, the summary moves below the day list.

---

## Theme

Dark, utilitarian. Not flashy — this is a daily-use work tool.

- Background: near-black (#0f1114) with raised surfaces (#181b20)
- Text: light gray (#d4d7dd), bright white for emphasis (#ebedf0), dim (#7a8190)
- Accent: muted steel blue (#5b9bd5)
- Client color coding: PC gets a blue tint, WB gets a green tint (applied to badges and chips)
- Borders: subtle dark (#2a2f38)
- Monospace for all numbers, times, and durations
- Sans-serif for everything else

---

## Project Structure

```
skuld/
  package.json              ← root: scripts to run both, concurrently as devDep
  .gitignore
  CLAUDE.md
  spec.md
  server/
    package.json
    tsconfig.json
    src/
      index.ts              ← Elysia app, starts server
      db.ts                 ← SQLite setup, schema init, query helpers
      rounding.ts           ← floorToQuarter, ceilToQuarter functions
      overlap.ts            ← hasOverlap check
      routes.ts             ← all route handlers
      types.ts              ← shared types (Entry, CreateEntryInput, etc.)
  client/
    package.json
    tsconfig.json
    vite.config.ts
    index.html
    src/
      main.tsx
      App.tsx
      api.ts                ← fetch helpers
      dates.ts              ← date formatting/math utilities
      styles.css
      components/
        DaySection.tsx
        EntryRow.tsx
        EntryForm.tsx
        WeekSummary.tsx
```

---

## Phase 1: Server

Set up the Bun + Elysia server with all API routes, database, rounding, and overlap logic. Verify with manual curl commands.

Files to create:

1. Root `package.json` with `dev` script using concurrently
2. Root `.gitignore` (node_modules, *.db, dist)
3. `server/package.json` with elysia dependency
4. `server/tsconfig.json`
5. `server/src/types.ts`
6. `server/src/rounding.ts`
7. `server/src/db.ts`
8. `server/src/overlap.ts`
9. `server/src/routes.ts`
10. `server/src/index.ts`

After creating all files, run the server and test with curl:

- Create an entry
- Create an overlapping entry (should get 409)
- List entries for a date range
- Update an entry
- Delete an entry
- Verify rounding (send 9:07 start, confirm stored as 9:00)

---

## Phase 2: Client

Set up Vite + React + TypeScript. Build all components and styles. Wire up to the API via the Vite proxy.

Files to create:

1. `client/package.json`
2. `client/tsconfig.json`
3. `client/vite.config.ts` (proxy `/api` to `localhost:3456`)
4. `client/index.html` (with Google Fonts link)
5. `client/src/main.tsx`
6. `client/src/api.ts`
7. `client/src/dates.ts`
8. `client/src/styles.css`
9. `client/src/App.tsx`
10. `client/src/components/WeekSummary.tsx`
11. `client/src/components/DaySection.tsx`
12. `client/src/components/EntryRow.tsx`
13. `client/src/components/EntryForm.tsx`

After creating all files, install dependencies and run both servers. Verify the full flow in the browser: navigate weeks, add entries, see rounding previews, confirm overlaps are rejected, check daily/weekly summaries.

---

## Future Enhancements (not in scope now)

- Export to TSV/XLSX matching company spreadsheet format
- Keyboard shortcuts (n = new entry, e = edit focused, etc.)
- Running timer mode as an alternative to manual entry
- Week-over-week comparison view
- Data import from existing Excel sheets
