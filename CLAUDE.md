<!-- CLAUDE.md -->
# Skuld

Personal timesheet tracker. Named for the Norn of obligation — fitting for billable hours.

## What This Is

A local-first web app replacing a manual Excel time tracker. A Bun/Elysia API server and a Vite/React client, as two workspaces of one Bun workspace root. In development they are two processes — the server on 3456, Vite on 5199 proxying `/api` to it. In deployment there is one process: the server serves the built client from `client/dist` alongside the API on 3456. Data lives in a SQLite file on disk. No auth, no external cloud dependency — but the app is also deployed on the home network, not localhost-only: a built copy runs at `skuld.home.vorheim.com` (via Caddy) from a clone at `~/app/skuld`, managed by the `com.mickey.skuld` launchd job. Development happens in `~/dev/skuld` (this repo); the deployed clone is separate. The dev server and the deployed job share port 3456 and so cannot run at once. See `deploy/README.md` for the deploy process, [AGENTS.md](AGENTS.md) for the agent-facing deployment command/prerequisites/safety rules, and `~/app/service-registry.yaml` for the full home-service inventory.

## Tech Stack

- **Server**: Bun, ElysiaJS, bun:sqlite — port 3456 (`SKULD_HOST`, `SKULD_PORT`, `SKULD_DB` override the defaults in `server/src/config.ts`)
- **Client**: Vite, React 19, TypeScript, plain CSS — port 5199
- **Fonts**: DM Sans (body), JetBrains Mono (times/numbers)

## Code Conventions

- TypeScript everywhere
- No line-ending semicolons
- single-line comments begin with lowercase letter (except acronyms, proper nouns, etc.)
- ES modules only
- Functions with named exports, not classes
- Every file starts with a path comment: `// server/src/db.ts`
- Prefer `const` arrow functions for named function expressions
- Prefer template literals over string concatenation
- Use bun as the package manager and runtime — `bun install`, `bun run`; the workspace root owns `bun.lock`

## Project Structure

```
skuld/
  package.json              ← root: concurrently runs both servers
  .gitignore
  CLAUDE.md
  spec.md                   ← full project spec, the source of truth
  deploy/                   ← launchd plist, Caddy snippet, deploy script, runbook
  server/
    package.json
    tsconfig.json
    src/
      index.ts              ← Elysia app entrypoint
      config.ts             ← env-driven host/port/db path/client dist
      db.ts                 ← SQLite setup, schema, query helpers
      static.ts             ← serves client/dist in deployment
      rounding.ts           ← quarter-hour rounding logic
      routes.ts             ← API route handlers
      types.ts              ← shared type definitions
  client/
    package.json
    tsconfig.json
    vite.config.ts
    index.html
    src/
      main.tsx
      App.tsx
      api.ts                ← fetch wrappers
      dates.ts              ← date formatting/math utils
      styles.css
      components/
        DaySection.tsx
        EntryRow.tsx
        EntryForm.tsx
        WeekSummary.tsx
```

## Key Business Rules

1. **Rounding**: Start times floor to nearest 15 min, end times ceil. Server-side, non-negotiable.
2. **Overlap flagging**: Overlaps are saved, not rejected; entries can be entered in any order and reconciled after. The day view marks double-booked time with a red "overlap" separator, mirroring the "gap" separator. The only time validation left server-side is that end must be after start (HTTP 400).
3. **Duration**: Always computed, never stored. `(ended_at - started_at) / 60000` = minutes.
4. **Clients**: PC and WB are the two current clients. Hardcoded as default quick-select buttons in the form, but the system supports arbitrary client codes.

## Running

```bash
# First time
bun install      # installs both workspaces from the root
bun run dev      # starts both via concurrently

# Or individually
bun run dev:server
bun run dev:client

bun run build      # builds the client into client/dist
bun run start      # runs the server alone, serving that build
bun run typecheck  # tsc --noEmit across both workspaces
bun test server client
```

## Common Tasks

- **Add a new API route**: Define handler in `server/src/routes.ts`, types in `server/src/types.ts`
- **Add a new component**: Create in `client/src/components/`, plain CSS in `styles.css`
- **Change the schema**: Modify the CREATE TABLE in `server/src/db.ts`. Delete `server/skuld.db` to recreate from scratch during dev.

## Spec

The full project specification lives in `spec.md` in the project root. That document is the source of truth for all behavior, layout, theming, and phasing decisions. Read it before making structural changes.
