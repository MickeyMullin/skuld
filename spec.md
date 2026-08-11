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
  ticket TEXT NOT NULL DEFAULT '',   -- optional short ref, e.g. 'RES-1113' or '2280'
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
Body: `{ date, startedAt, endedAt, note, ticket, client }`
Applies rounding, inserts, returns the created entry (with rounded times). Overlaps are permitted.

### `PUT /api/entries/:id`
Body: any subset of `{ date, startedAt, endedAt, note, ticket, client }`
Merges with existing values, applies rounding, updates, returns the updated entry. Overlaps are permitted.

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
- **Entry rows**: show formatted time range, duration, note, ticket, and client badge. Edit (pencil) and delete (×) buttons appear on hover. Delete opens a modal confirmation dialog (`ConfirmDialog`) showing the entry's time range, duration, client, note, and ticket, so it's unambiguous which row is going. The Delete button is focused on open, so confirming is one keystroke; Escape, the Cancel button, and a backdrop click all back out. A failed delete keeps the dialog open and shows the server's message rather than failing silently.
- **Entry form**: inline within the day section. Time inputs are native `<input type="time">`. Shows rounded preview next to each time input when rounding will occur. Note is a text input. Ticket is an optional short text input sitting between Note and Client. Client is a row of toggle buttons for known clients (PC, WB hardcoded as defaults, plus any others from the DB) plus an "Other" button that shows a text input. When adding, the start time pre-fills from the previous entry's end time. Focus lands on the note field.
- **Autocomplete**: the Note and Ticket inputs suggest values already used elsewhere in the *same day*, matched case-insensitively on prefix, from the first character typed. Each row shows the source entry's ticket and client alongside the value, so it's visible what accepting will pull in. Duplicates collapse case-insensitively with the **most recent** entry as the source.
  - Two highlight states. The row Tab would take is always marked (`.tab-target`, with a `⇥` hint) — by default the first match. Arrow-Down *steps into* the list (`.active`, accent bar), Arrow-Up steps back out to the input, and only while stepped in does Enter accept; otherwise Enter submits the form, so a note that merely prefixes an older one still saves normally. Tab accepts the marked row and advances to the next field either way. Escape dismisses.
  - Accepting pulls the source entry's sibling fields: from the **Note** list it fills note, ticket, and client; from the **Ticket** list it fills ticket and client, deliberately leaving the note alone since that's free text the user likely authored. A pulled client lands on the select or the "Other" input depending on whether the code is known.
  - The list is `position: fixed` so it escapes the day card's `overflow: hidden`.
- **Day-copy dialog**: clicking a per-client chip opens a copy popover for that day+client. Clicking the same chip again closes it; clicking any other chip (another client, or another day) closes the open one and opens the new one in a single click — only one is ever open. Dismisses on Escape or any outside click, and self-dismisses 2s after a successful copy — the ✓ holds for that beat, then the popover fades out over 220ms and unmounts (the fade duration is set inline from the component so the animation and unmount timer can't drift; `prefers-reduced-motion` skips the animation). The clipboard payload is tab-separated and shaped for the target spreadsheet's columns — Hours (B), Task (C), two empty cells for the hidden D and E, then Ticket# (F): `hours \t tasks \t\t\t tickets`. The padding exists only in the clipboard; the dialog itself shows just Hrs / Tasks / Tickets. Both lists are deduped case-insensitively and comma-joined, tasks led by "Standup" when present. The ticket cell is always emitted, empty or not, so pasted rows line up.
  - **Multi-ticket entries**: a single entry's `ticket` field may hold several comma-separated refs (`223, 224`). Anything that counts or compares tickets splits the field first (`splitTickets`), so a ref shared by two entries is listed once rather than duplicated. Sloppy input is tolerated and tidied — `223,224`, `223, 224,225`, `,223,,224,` and stray whitespace all normalize to `223, 224[, 225]` via `normalizeTicketField`, applied when saving, when displaying an entry row, and when building the copy output. Ref *order* within a field is left as typed; only separators and blanks are cleaned.
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
