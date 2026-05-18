<!-- CLAUDE.md -->
# Skuld

Personal timesheet tracker. Named for the Norn of obligation — fitting for billable hours.

## What This Is

A local-only web app replacing a manual Excel time tracker. Two processes: a Bun/Elysia API server and a Vite/React client. Data lives in a SQLite file on disk. No auth, no deployment, no cloud — just runs on localhost.

## Tech Stack

- **Server**: Bun, ElysiaJS, bun:sqlite — port 3456
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
- Use pnpm as the package manager — not npm or yarn

## Project Structure

```
skuld/
  package.json              ← root: concurrently runs both servers
  .gitignore
  CLAUDE.md
  spec.md                   ← full project spec, the source of truth
  server/
    package.json
    tsconfig.json
    src/
      index.ts              ← Elysia app entrypoint
      db.ts                 ← SQLite setup, schema, query helpers
      rounding.ts           ← quarter-hour rounding logic
      overlap.ts            ← overlap detection
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
2. **Overlap prevention**: No double-billing. Server rejects entries that overlap after rounding (HTTP 409).
3. **Duration**: Always computed, never stored. `(ended_at - started_at) / 60000` = minutes.
4. **Clients**: PC and WB are the two current clients. Hardcoded as default quick-select buttons in the form, but the system supports arbitrary client codes.

## Running

```bash
# First time
pnpm run setup   # installs deps in root, server/, and client/
pnpm run dev     # starts both via concurrently

# Or individually
cd server && bun run src/index.ts
cd client && pnpm vite --port 5199
```

## Common Tasks

- **Add a new API route**: Define handler in `server/src/routes.ts`, types in `server/src/types.ts`
- **Add a new component**: Create in `client/src/components/`, plain CSS in `styles.css`
- **Change the schema**: Modify the CREATE TABLE in `server/src/db.ts`. Delete `server/skuld.db` to recreate from scratch during dev.

## Spec

The full project specification lives in `spec.md` in the project root. That document is the source of truth for all behavior, layout, theming, and phasing decisions. Read it before making structural changes.
