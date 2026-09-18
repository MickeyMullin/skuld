# Agent instructions for Skuld

## Scope

This is the Skuld timesheet tracker in `/Users/mickey/dev/skuld`. See [CLAUDE.md](CLAUDE.md) for the tech stack, code conventions, business rules, and dev-time verification — those apply to every agent working here. This file covers the one thing CLAUDE.md doesn't: shipping a change to the running service.

## Deployment

Skuld runs as a separate clone at `~/app/skuld`, supervised by launchd (`com.mickey.skuld`) and fronted by Caddy at `skuld.home.vorheim.com`. `~/dev/skuld` (here) is development only; deploying never touches this checkout.

**Never run the deploy script, or anything else that restarts `com.mickey.skuld` or touches `~/app/skuld/server/skuld.db`, without Mickey explicitly asking for that step in the conversation.** It restarts a live service and writes to a real timesheet database, not a test one. A green build is not, by itself, authorization to ship it — confirm first, same as any other production push.

### Prerequisites

- `bun` and `sqlite3` on `PATH`
- SSH access to `git@github.com:MickeyMullin/skuld.git` — the deployed clone fetches over SSH
- Nothing else bound to port 3456 locally (the dev server and the deployed job share it; see [deploy/README.md](deploy/README.md) for how to bootout/bootstrap the job around a dev session)

### Getting a change onto `master`

The deployed clone only ever fast-forwards (`git pull --ff-only origin master`), so a change needs to reach `master` on GitHub first. From an agent's isolated worktree:

```bash
git checkout master
git pull --ff-only origin master
git merge --ff-only <branch>        # or --no-ff if history diverged
git push origin master
```

Do this only once the change is committed, verified (below), and Mickey has agreed it should ship — merging to `master` and pushing carry the same weight as deploying and need the same explicit go-ahead. Once merged, remove the worktree it lived in:

```bash
git worktree remove <worktree-path>
git branch -d <branch>              # refuses if the branch isn't actually merged
```

### Deploy command

```bash
~/dev/skuld/deploy/skuld.sh
```

Bootstrapping a brand-new `~/app/skuld` clone (rather than redeploying an existing one) is a separate, rarer procedure covering the launchd plist, the Caddy route, and the `service-registry.yaml` entry — see the "First deployment" section of [deploy/README.md](deploy/README.md) and follow it in full.

For an ordinary redeploy, the script: backs up `~/app/skuld/server/skuld.db` with `sqlite3 .backup` and verifies `pragma integrity_check` before touching anything else; fast-forwards `~/app/skuld` to `origin/master`; runs `bun install --frozen-lockfile` and `bun run build`; restarts `com.mickey.skuld` with `launchctl kickstart -k`; then polls `/api/health` for up to 10 seconds. A failed integrity check or health check aborts the script with a non-zero exit — check its actual output rather than assuming success because it ran.

### Post-deployment verification

```bash
curl http://127.0.0.1:3456/api/health
curl -H 'Host: skuld.home.vorheim.com' https://skuld.home.vorheim.com/api/health
git -C ~/app/skuld rev-parse --short HEAD   # confirm it matches the commit you meant to ship
tail -n 20 ~/app/skuld/skuld.err.log        # should be empty/unremarkable after a clean restart
```

### Rollback

```bash
cd ~/app/skuld && git checkout <previous-commit> && bun install --frozen-lockfile && bun run build
launchctl kickstart -k gui/$(id -u)/com.mickey.skuld
```

The database is gitignored (`*.db`) and lives inside the working tree, so checking out an older commit doesn't touch it. Every deploy already leaves a snapshot in `~/backup`; see the "Rollback" section of [deploy/README.md](deploy/README.md) for restoring one by hand.

## Discovering this file from a worktree

`AGENTS.md`, `CLAUDE.md`, and everything under `deploy/` are ordinary tracked files, so `git worktree add` checks them out at whatever ref the worktree is on. An agent in an isolated worktree sees the same instructions as one working in `~/dev/skuld` directly, as long as the worktree's branch was created at or after this file reached `master`. Nothing else to wire up.
