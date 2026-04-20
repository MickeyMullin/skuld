# Skuld

A personal timesheet tracker named for the Norse Norn of obligation—fitting for billable hours.

Skuld replaces a manual Excel time tracker with a local web app. Log time entries with start/end times, assign them to clients, and see daily and weekly summaries at a glance. Times automatically round to the nearest quarter hour in your favor, and the system prevents overlapping entries so you never double-bill.

## Prerequisites

- [Bun](https://bun.sh) (runtime for the API server)
- [Node.js](https://nodejs.org) 18+ (runtime for the Vite dev server)
- [pnpm](https://pnpm.io)

## Getting Started

```bash
git clone https://github.com/MickeyMullin/skuld.git skuld
cd skuld

# install dependencies for root, server, and client
pnpm run setup

# start both servers
pnpm run dev
```

The API server runs on `http://localhost:3456` and the client on `http://localhost:5199`.

Open `http://localhost:5199` in your browser and start logging time.

## How It Works

**Enter time entries** with a start time, end time, note, and client code. Start and end times round to the nearest 15-minute boundary — start times floor, end times ceil — so 9:07–10:22 becomes 9:00–10:30.

**Track by client.** PC and WB are built-in as quick-select options. Other client codes can be entered manually and will appear as options going forward.

**See summaries** for each day (in the collapsible day headers) and for the week (in the sidebar), broken down by client with proportional progress bars.

**Navigate weeks** with the arrow buttons in the header. A "Today" button jumps back to the current week when you've navigated away.

## Project Structure

```
skuld/
  server/           Bun + ElysiaJS API with bun:sqlite
  client/           Vite + React 19 + TypeScript
```

## Data

All data is stored in a local SQLite file at `server/skuld.db`. There is no cloud sync, no auth, and no external dependencies. Back up the `.db` file if you want to preserve your data.

## License

MIT
