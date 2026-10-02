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

Entries, plus the clients, projects, and settings the entry form picks from:

```sql
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,            -- 'YYYY-MM-DD'
  started_at TEXT NOT NULL,      -- ISO 8601 datetime
  ended_at TEXT NOT NULL,        -- ISO 8601 datetime
  note TEXT NOT NULL DEFAULT '',
  ticket TEXT NOT NULL DEFAULT '',   -- optional short ref, e.g. 'RES-1113' or '2280'
  client TEXT NOT NULL,
  project TEXT NOT NULL DEFAULT '',  -- optional; belongs to the entry's client
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
CREATE INDEX IF NOT EXISTS idx_entries_client ON entries(client);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,  -- 1–3 letters, what the entry form shows
  name TEXT NOT NULL DEFAULT '',             -- full name for copy/export; blank falls back to code
  active INTEGER NOT NULL DEFAULT 1,         -- inactive clients drop out of the pickers
  ordinal INTEGER NOT NULL DEFAULT 0         -- picker and export order
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  ordinal INTEGER NOT NULL DEFAULT 0,        -- order within its client
  UNIQUE (client_id, name COLLATE NOCASE)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,                      -- e.g. 'preferredStartTime'
  value TEXT NOT NULL
);
```

The SQLite file lives at `server/skuld.db` and is gitignored. The schema lives in `server/src/schema.ts`.

Entries still name their client by code and their project by name, as text. The catalog is kept in step with them: saving an entry with a client or project the catalog doesn't have adds it (so the form's "Other…" fields keep working, though a new code must be 1–3 letters), names are canonicalized to the catalog's casing, and renaming a client code or a project in Settings rewrites the entries that used the old one.

Schema migrations are versioned with `PRAGMA user_version` and each runs once. Version 1 created the catalog: it seeded the standing clients (PC "PortCity Logistics", WB "Willow Bridge Properties") and the standing project (PC "Dispatch Intelligence Platform II"), added every client and client/project pair already on entries, ordered both alphabetically, and stripped a client's own `"<name> - "` prefix from its entries' projects, since the export now adds that itself.

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

### Overlap flagging

Overlaps are **allowed** — the server saves them and the client flags them. Rejecting them forced entries to be edited in a specific order; flagging lets one be saved and the other adjusted after.

The client computes, for each entry in a day, the minutes between it and the furthest end time among all earlier entries (entries are sorted by start). Positive is an unbilled gap, negative is double-booked time. Measuring against the running maximum rather than just the previous entry means an entry wholly contained in a longer one, and anything overlapping that longer one afterwards, are both still caught.

Each is rendered as a separator between the two rows: a dashed "Xh Ym gap" in dim text, or "Xh Ym overlap" in red. Neither blocks saving.

Overlapping time is **deliberately double-counted** in the day and week totals—do not "fix" this. On time-and-materials work, orchestrating agents across two clients' tasks simultaneously can legitimately bill the same slot twice, so the totals must reflect it. The red marker exists to surface an overlap for review, not to declare it wrong; the common case is simply that it's easier to save one entry and adjust the other than to edit them in a prescribed order.

The only time validation remaining server-side is that end must be after start, which returns HTTP 400.

### Duration math

Duration in minutes = `(Date(ended_at) - Date(started_at)) / 60000`. All summaries are computed from this.

---

## API Routes

All routes are prefixed with `/api`.

### `GET /api/entries?from=YYYY-MM-DD&to=YYYY-MM-DD`
Returns entries in the date range (inclusive), ordered by `date, started_at`.

### `POST /api/entries`
Body: `{ date, startedAt, endedAt, note, ticket, client, project }` (`project` optional, defaults to empty)
Applies rounding, inserts, returns the created entry (with rounded times). Overlaps are permitted.

### `PUT /api/entries/:id`
Body: any subset of `{ date, startedAt, endedAt, note, ticket, client, project }`
Merges with existing values, applies rounding, updates, returns the updated entry. Overlaps are permitted.

### `DELETE /api/entries/:id`
Deletes the entry. Returns `{ deleted: true }`.

`POST` and `PUT` canonicalize `client` and `project` through the catalog, adding either when new (see Data Model). A new client code that isn't 1–3 letters returns 400.

### `GET /api/clients`
Returns every client, active or not, as `{ id, code, name, active, ordinal }[]` in ordinal order.

### `POST /api/clients`
Body: `{ code, name?, active? }`. Appends a client after the rest. 400 for a code that isn't 1–3 letters, 409 for a duplicate.

### `PUT /api/clients/:id`
Body: any subset of `{ code, name, active }`. A code change is carried onto that client's entries.

### `PUT /api/clients/order`
Body: `{ ids }`, client ids in their new order. Returns the reordered list.

### `GET /api/projects`
Returns every project, active or not, as `{ id, clientId, client, name, active, ordinal }[]` (`client` is the owning code), sorted by client ordinal, then project ordinal. Projects belong to a client, so the same name under two clients is two projects.

### `POST /api/projects`
Body: `{ clientId, name, active? }`. Appends a project after the client's others. 409 for a duplicate name (case-insensitive) under that client.

### `PUT /api/projects/:id`
Body: any subset of `{ name, active }`. A rename is carried onto that client's entries.

### `PUT /api/projects/order`
Body: `{ clientId, ids }`, that client's project ids in their new order. Returns every project.

### `GET /api/settings`, `PUT /api/settings`
`{ preferredStartTime }`, `HH:MM`, default `09:00`. `PUT` takes any subset and returns the full settings; a malformed time returns 400.

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
- **Entry rows**: show formatted time range, duration, note, ticket, and client badge. Edit (pencil) and delete (×) buttons appear on hover. Delete opens a modal confirmation dialog (`ConfirmDialog`) showing the entry's time range, duration, client, note, and ticket, so it's unambiguous which row is going. The Delete button is focused on open, so confirming is one keystroke; Escape, the Cancel button, and a backdrop click all back out. A failed delete keeps the dialog open and shows the server's message rather than failing silently.
- **Entry form**: inline within the day section. Time inputs are native `<input type="time">`. Shows rounded preview next to each time input when rounding will occur. Note is a text input. Ticket is an optional short text input sitting between Note and Client. Client is a required select of the active clients in their configured order, plus "Other…" which shows a text input for a new 1–3 letter code. It starts on the default client, or blank (a hidden "Select…" placeholder) when none is set, so picking one is deliberate rather than accepting whichever sorts first; submitting with it blank is blocked. Editing an entry whose client has since been deactivated still offers that client. When adding, the start time pre-fills from the previous entry's end time, or the preferred start time from Settings for the day's first entry, with the end an hour later. Focus lands on the note field.
  - **Project**: an optional select after Client, offering None, the selected client's active projects in their configured order, and "Other…" (which shows a text input for a new name). An inactive project already on the entry is still offered. Changing the client resets the project to that client's default project, or None. A new entry starts on the default project when it belongs to the starting client; editing keeps the entry's own project. Entry rows show the project as a dim line under the note.
- **Autocomplete**: the Note and Ticket inputs suggest values already used elsewhere in the *same day*, matched case-insensitively on prefix, from the first character typed. Each row shows the source entry's ticket and client alongside the value, so it's visible what accepting will pull in. Duplicates collapse case-insensitively with the **most recent** entry as the source.
  - Two highlight states. The row Tab would take is always marked (`.tab-target`, with a `⇥` hint) — by default the first match. Arrow-Down *steps into* the list (`.active`, accent bar), Arrow-Up steps back out to the input, and only while stepped in does Enter accept; otherwise Enter submits the form, so a note that merely prefixes an older one still saves normally. Tab accepts the marked row and advances to the next field either way. Escape dismisses.
  - Accepting pulls the source entry's sibling fields: from the **Note** list it fills note, ticket, client, and project; from the **Ticket** list it fills ticket, client, and project, deliberately leaving the note alone since that's free text the user likely authored. A pulled client lands on the select or the "Other" input depending on whether the code is known.
  - The list is `position: fixed` so it escapes the day card's `overflow: hidden`.
- **Day-copy dialog**: clicking a per-client chip opens a copy popover for that day+client. Clicking the same chip again closes it; clicking any other chip (another client, or another day) closes the open one and opens the new one in a single click — only one is ever open. Dismisses on Escape or any outside click, and self-dismisses 2s after a successful copy — the ✓ holds for that beat, then the popover fades out over 220ms and unmounts (the fade duration is set inline from the component so the animation and unmount timer can't drift; `prefers-reduced-motion` skips the animation). The clipboard payload is tab-separated and shaped for the target spreadsheet's columns — Hours (B), Task (C), two empty cells for the hidden D and E, then Ticket# (F), then the client-and-project label appended at the end: `hours \t tasks \t\t\t tickets \t label`. The padding exists only in the clipboard; the dialog itself shows just Hrs / Tasks / Tickets / Project. The label is the client's name and the project joined by a hyphen, `PortCity Logistics - Dispatch Intelligence Platform II`, with the client's code standing in for a blank name, and just the client when no project was logged. Several projects for one day+client are deduped and comma-joined after the client (`Client - A, B`). Both lists are deduped case-insensitively and comma-joined, tasks led by "Standup" when present. The ticket cell is always emitted, empty or not, so pasted rows line up.
  - **Multi-ticket entries**: a single entry's `ticket` field may hold several comma-separated refs (`223, 224`). Anything that counts or compares tickets splits the field first (`splitTickets`), so a ref shared by two entries is listed once rather than duplicated. Sloppy input is tolerated and tidied — `223,224`, `223, 224,225`, `,223,,224,` and stray whitespace all normalize to `223, 224[, 225]` via `normalizeTicketField`, applied when saving, when displaying an entry row, and when building the copy output. Ref *order* within a field is left as typed; only separators and blanks are cleaned.
- **Settings menu** (gear in the header): two columns split by a vertical rule, Default Client on the left (the active clients, in order) and Default Project on the right, each with its own "Clear default". The whole project column is hidden until a default client is set, and lists only that client's active projects; changing the default client rebuilds that list and clears a default project belonging to another client, and clearing the default client clears the default project too. Both are stored in browser local storage (`skuld.defaultClient`, and `skuld.defaultProject` as `{ client, project }`); a stored default project still carrying its client's old name prefix is rewritten to the bare name once loaded. Below the columns, "› Advanced settings" links to the Settings page, carrying the current week along.
- **Settings page** (`/settings`): a separate page (chosen by path in `main.tsx`; the server and Vite both answer any extensionless path with the client shell), with "← Back to timesheet" returning to the week it was opened from. Three sections, all saved to the server as they're edited — text fields on blur or Enter (Escape backs out), checkboxes and reorders at once — with a failed save shown above its table and the field put back:
  - **General**: preferred start time (`HH:MM`, default 09:00), where a day's first new entry starts.
  - **Clients**: a table of drag handle, Code (1–3 letters, uppercased), Name, and Active. Dragging a row by its handle (or ArrowUp/ArrowDown on a focused handle) sets the order the entry form, gear menu, day chips, and week export use. "+ Add" appends a blank row, created once it has a code; a name typed first is kept for it.
  - **Projects**: a Client filter (default All) over a table of drag handle, Client, Name, and Active, sorted by client order then project order. Handles are disabled under All, since order only means something within one client. "+ Add" appends a blank row for the filtered client, or with its own client picker under All, created once it has a name.
- **Week summary**: sticky sidebar. Shows total hours in large text, then a per-client breakdown with mini progress bars showing relative proportion. An "Export" pill at the top right of the Week Total box opens the week export.
- **Week export**: a popover like the day-copy dialog, anchored below the Export pill and flush with the summary card's right edge so it opens leftward over the day list. It lists every day of the week, each client logged that day as its own row in configured client order, and blank days as just their date. Its ⎘ button copies the whole week as one block: the day-copy row with the date (`Mon, 8/10/2026`) in a leading column, hours trimmed of trailing zeros (`1.5`, `3`, `1.75`), and a blank day kept as its date plus six empty cells so the paste always covers seven days. Dismissal matches the day-copy dialog (Escape, outside click, the pill again, or the ✓ beat after a copy).
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
      schema.ts             ← tables and versioned migrations
      db.ts                 ← SQLite setup, entry query helpers
      catalog.ts            ← clients, projects, settings
      rounding.ts           ← floorToQuarter, ceilToQuarter functions
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
      weekExport.ts         ← week export rows and clipboard text
      styles.css
      components/
        DaySection.tsx
        EntryRow.tsx
        EntryForm.tsx
        WeekSummary.tsx
        WeekExportOverlay.tsx
        SettingsPage.tsx    ← /settings: general, clients, projects
        ClientsTable.tsx
        ProjectsTable.tsx
```

---

## Phase 1: Server

Set up the Bun + Elysia server with all API routes, database, and rounding logic. Verify with manual curl commands.

Files to create:

1. Root `package.json` with `dev` script using concurrently
2. Root `.gitignore` (node_modules, *.db, dist)
3. `server/package.json` with elysia dependency
4. `server/tsconfig.json`
5. `server/src/types.ts`
6. `server/src/rounding.ts`
7. `server/src/db.ts`
9. `server/src/routes.ts`
10. `server/src/index.ts`

After creating all files, run the server and test with curl:

- Create an entry
- Create an overlapping entry (should succeed; the client flags it)
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

After creating all files, install dependencies and run both servers. Verify the full flow in the browser: navigate weeks, add entries, see rounding previews, confirm overlaps save and show the red overlap marker, check daily/weekly summaries.

---

## Future Enhancements (not in scope now)

- Export to TSV/XLSX matching company spreadsheet format
- Keyboard shortcuts (n = new entry, e = edit focused, etc.)
- Running timer mode as an alternative to manual entry
- Week-over-week comparison view
- Data import from existing Excel sheets
