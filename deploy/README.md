# Deploying Skuld to `~/app`

Follows the Ghostwolf hosting convention: `~/dev` is for development, `~/app` holds a separate clone on `master`, `launchd` supervises the process, Caddy fronts it on the LAN.

> The development server and the deployed launchd job share backend port 3456 by convention (the same way dispatch uses 4200 for both and luci uses 4100), and only the Vite dev server gets its own port, 5199. They cannot run at the same time. Stop any `bun run dev` bound to 3456 before bootstrapping the job, or launchd will fail to bind and `KeepAlive` will crash-loop it.

## Migrating from the two-job deployment — completed 2026-09-13

Kept as a record of what changed; there is nothing left to run here. Skuld was originally deployed as two launchd jobs — `com.mickey.skuld-app-server` on 3456 and `com.mickey.skuld-app-client` running a Vite **dev** server on 5199, with Caddy proxying to the latter. The server now serves the built client itself, so the client job goes away and Caddy proxies to 3456. Run this once, on Ghostwolf:

```bash
launchctl bootout gui/$(id -u)/com.mickey.skuld-app-client
launchctl bootout gui/$(id -u)/com.mickey.skuld-app-server
rm ~/Library/LaunchAgents/com.mickey.skuld-app-client.plist ~/Library/LaunchAgents/com.mickey.skuld-app-server.plist
```

The clone's `origin` pointed at the `~/dev/skuld` working copy rather than GitHub, and was repointed as part of the same cutover:

```bash
git -C ~/app/skuld remote set-url origin git@github.com:MickeyMullin/skuld.git
```

The retired plists were moved to `~/backup/retired-launchagents/`, and a local hotfix in the deployed clone that widened Vite's `allowedHosts` was saved to `~/backup/skuld-app-vite-allowedhosts-2026-09-13.patch` before being discarded — it only ever mattered while Vite served production traffic.

## First deployment

```bash
git clone git@github.com:MickeyMullin/skuld.git ~/app/skuld
cd ~/app/skuld && git checkout master
bun install --frozen-lockfile
bun run build
# optional: seed from the development database. Checkpoint the WAL first — in WAL mode
# recent commits sit in skuld.db-wal until a checkpoint folds them into skuld.db, so a bare
# cp of the main file can copy a database missing everything written lately.
sqlite3 ~/dev/skuld/server/skuld.db 'PRAGMA wal_checkpoint(TRUNCATE);'
cp ~/dev/skuld/server/skuld.db ~/app/skuld/server/skuld.db

sed "s|__HOME__|$HOME|g; s|__BUN__|$(which bun)|g" deploy/com.mickey.skuld.plist > ~/Library/LaunchAgents/com.mickey.skuld.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.mickey.skuld.plist
launchctl kickstart -k gui/$(id -u)/com.mickey.skuld
curl http://127.0.0.1:3456/api/health
```

Replace the `skuld.home.vorheim.com` block in `/opt/homebrew/etc/Caddyfile` with the one in `deploy/Caddyfile.snippet`, then reload Caddy with `caddy reload --config /opt/homebrew/etc/Caddyfile`. The hostname is already in local DNS alongside `dispatch`/`luci`, pointing at `192.168.13.100`; nothing to add there.

The `~/app/service-registry.yaml` entry:

```yaml
  skuld:
    status: deployed
    source_path: /Users/mickey/dev/skuld
    deployed_path: /Users/mickey/app/skuld
    repository: git@github.com:MickeyMullin/skuld.git
    hostname: skuld.home.vorheim.com
    port: 3456
    runtime: bun-elysia-react-typescript
    database: /Users/mickey/app/skuld/server/skuld.db
    launchd_label: com.mickey.skuld
```

## Subsequent deployments

```bash
~/dev/skuld/deploy/skuld.sh      # or copy it to ~/deploy/skuld.sh
```

The script backs up the database, fast-forwards `master`, installs locked dependencies, builds the client, restarts the launchd job, and checks `/api/health`.

The backup runs first, before the clone is touched, so a deploy that goes wrong still has the database as it was moments earlier. It writes `~/backup/skuld-<date>-<time>.db` with `sqlite3 .backup` rather than `cp`, because in WAL mode the recent commits sit in `skuld.db-wal` until a checkpoint folds them into `skuld.db` and copying the main file alone silently loses them; `.backup` also takes a consistent snapshot of a database that is still being served. A snapshot that fails `pragma integrity_check` aborts the deploy before the running service is disturbed. The last ten snapshots are kept and older ones are pruned.

## Rollback

```bash
cd ~/app/skuld && git checkout <previous-commit> && bun install --frozen-lockfile && bun run build
launchctl kickstart -k gui/$(id -u)/com.mickey.skuld
```

The database lives at `~/app/skuld/server/skuld.db`, inside the working tree but gitignored by the `*.db` rule, so `git checkout` of an older commit does not touch it. Every deploy already leaves a snapshot in `~/backup`; to take one by hand at any other time, run `sqlite3 ~/app/skuld/server/skuld.db ".backup ~/backup/skuld-$(date +%F-%H%M%S).db"`. Restore by stopping the job, copying a snapshot over `skuld.db` and deleting the stale `skuld.db-wal` and `skuld.db-shm` beside it, then starting the job again — a leftover WAL from the replaced database will otherwise be replayed over the restored one.
