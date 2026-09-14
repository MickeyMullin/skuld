# Skuld

A personal timesheet tracker named for the Norse Norn of obligation—fitting for billable hours.

Skuld replaces a manual Excel time tracker with a local web app. Log time entries with start/end times, assign them to clients, and see daily and weekly summaries at a glance. Times automatically round to the nearest quarter hour in your favor, and the system prevents overlapping entries so you never double-bill.

Skuld is also one of the services in a small home-hosted environment alongside Luci (reporting) and Dispatch (task tracking). A built copy runs live at `skuld.home.vorheim.com`, discoverable from a central homepage at `home.vorheim.com`; the source in this repo is developed separately and deployed there when ready. When running live, the header shows a quiet link back to that homepage; a dev-server build shows a "Dev" badge in its place.

## Prerequisites

- [Bun](https://bun.sh) (runtime and package manager for both workspaces)

## Getting Started

```bash
git clone https://github.com/MickeyMullin/skuld.git skuld
cd skuld

# install dependencies for both workspaces
bun install

# start both servers
bun run dev
```

The API server runs on `http://localhost:3456` and the client on `http://localhost:5199`.

Open `http://localhost:5199` in your browser and start logging time.

To run the way it is deployed — one process, the API and the built client together on 3456 — build first and start the server alone:

```bash
bun run build
bun run start
```

Deployment to `skuld.home.vorheim.com` is documented in [deploy/README.md](deploy/README.md).

## How It Works

**Enter time entries** with a start time, end time, note, and client code. Start and end times round to the nearest 15-minute boundary — start times floor, end times ceil — so 9:07–10:22 becomes 9:00–10:30.

**Track by client.** PC and WB are built-in as quick-select options. Other client codes can be entered manually and will appear as options going forward. Use the gear menu in the header to set a **default client** that's pre-selected on new entries (stored in your browser; clear it anytime).

**See summaries** for each day (in the collapsible day headers) and for the week (in the sidebar), broken down by client with proportional progress bars.

**Copy a client's day at a glance.** Click a client chip in a day header to pop up that client's total hours and a combined task list, with a one-click copy button, ready to paste into an invoice or another timesheet.

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
