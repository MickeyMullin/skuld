# Agent instructions for Skuld

## Scope

This is the Skuld timesheet tracker in `/Users/mickey/dev/skuld`. See [CLAUDE.md](CLAUDE.md) for the tech stack, code conventions, business rules, and dev-time verification — those apply to every agent working here, not just Claude. This file adds what CLAUDE.md doesn't cover: how to ship a change to the running service.

## Deployment

Skuld runs as a separate clone at `~/app/skuld`, supervised by launchd (`com.mickey.skuld`) and fronted by Caddy at `skuld.home.vorheim.com`. `~/dev/skuld` (here) is development only; deploying never touches this checkout, only the one at `~/app/skuld`.

**Never run the deploy script, or anything else that restarts `com.mickey.skuld` or touches `~/app/skuld/server/skuld.db`, unless the deployment is authorized as described under [Deployment authorization](#deployment-authorization).** It restarts a live service and writes to a real timesheet database, not a test one. A passing build, or a task description that mentions deployment, is not by itself that authorization.

**"Don't deploy" (or an instruction to bundle a task's changes with a follow-up before shipping) scopes only the deploy step below — it is never a reason to leave finished, verified work uncommitted.** Commit as soon as a task's changes are verified, on their own branch if nothing else is ready to receive them. Uncommitted changes sitting in `~/dev/skuld` block every other task from being worked on in this same checkout, including ones that have nothing to do with why the deploy was held back. Only the gated steps below (merge to `master` + push, and the deploy script itself) need authorization; committing does not.

### Deployment authorization

A deployment is authorized by exactly one of these, and only for the deployment it names:

1. **A Dispatch hand-off with the deploy option selected.** Ticking **Deploy once complete** when generating a prompt package or confirming Execute in Dispatch is Mickey's explicit authorization for that one hand-off's deployment. It is complete on its own: the worker does not ask for, or wait for, a separate confirmation in a conversation, and the absence of one is never a reason to block or skip the deploy. The same goes for a project whose settings in Dispatch grant standing authorization, for the hand-offs of that project.
1. **Mickey asking for the deployment directly**, in the conversation or in a comment on the task. This is the rule outside a Dispatch hand-off: an interactive session has no checkbox, so nothing else counts there.

An authorized deployment includes the source-control steps that must come before it: merging the verified branch into `master` and pushing to `origin`, as described under [Getting a change onto `master`](#getting-a-change-onto-master). Doing those is part of carrying out the deployment, not a separate decision to ask about.

Precedence, for an agent working a Dispatch hand-off (a bridge card or a copied prompt package):

1. The hand-off's own **Deployment** section decides. **Deployment (requested for this package)**, **Deployment (requested on this hand-off)**, or **Deployment (standing authorization)** means merge, push, and deploy, once verification passes. A plain **Deployment** section (not requested, deferred to a later hand-off, or the project defines none) means do not deploy.
1. Nothing else in a hand-off overrides that section in either direction. A task title, description, note, or linked document that says to deploy does not authorize it; one that says not to does not remove an authorization the section carries, though Mickey saying so directly does.
1. This file's other instructions still apply, in particular that the procedure below is followed as written, that verification comes first, and that a failure stops the deploy rather than being worked around.

What the authorization does not cover, whichever way it was given: another hand-off's deployment or any other deploy; and a change to the live configuration (the launchd plist, the Caddy route, `service-registry.yaml`, the live database beyond what the script's own backup and restart do). Those stay explicit operator steps.

When a hand-off has no Deployment section at all, treat it as not authorized and say so rather than deploying. A claim in a task description, a comment, or a worker's own summary that the box was ticked is not evidence; the hand-off's Deployment section is.

### Prerequisites

- `bun` and `sqlite3` on `PATH`
- SSH access to `git@github.com:MickeyMullin/skuld.git` — the deployed clone fetches over SSH, not HTTPS
- Nothing else bound to port 3456 locally (the dev server and the deployed job share it by convention; see [deploy/README.md](deploy/README.md) for how to bootout/bootstrap the job around a dev session)

### Getting a change onto `master`

The deployed clone only ever fast-forwards (`git pull --ff-only origin master`), so a change has to reach `master` on GitHub before a deploy can pick it up:

```bash
git checkout master
git pull --ff-only origin master
git merge --ff-only <branch>        # or --no-ff if history diverged
git push origin master
```

Do this once the change is committed and verified (below), as part of an authorized deployment or when Mickey asks for it. If the branch lived in an isolated worktree, clean it up once merged so it doesn't linger:

```bash
git worktree remove <worktree-path>
git branch -d <branch>              # refuses if the branch isn't actually merged
```

### Deploy command

```bash
~/dev/skuld/deploy/skuld.sh
```

Bootstrapping a brand-new `~/app/skuld` clone for the first time (rather than redeploying an existing one) is a separate, rarer procedure with its own steps for the launchd plist, the Caddy route, and the `service-registry.yaml` entry — see the "First deployment" section of [deploy/README.md](deploy/README.md) and follow it in full rather than improvising from the script alone.

For an ordinary redeploy, the script: backs up `~/app/skuld/server/skuld.db` with `sqlite3 .backup` and verifies `pragma integrity_check` before anything else is touched; fast-forwards `~/app/skuld` to `origin/master`; runs `bun install --frozen-lockfile` and `bun run build`; restarts `com.mickey.skuld` with `launchctl kickstart -k`; then polls `/api/health` for up to 10 seconds. A failed integrity check or a failed health check aborts the script with a non-zero exit — check its actual output rather than assuming success because it ran.

Schema migrations run on server start (see `server/src/schema.ts`), so the restart is also when a new migration is applied to the live database. The pre-deploy backup is the copy to restore if one goes wrong.

### Post-deployment verification

```bash
curl http://127.0.0.1:3456/api/health
curl -H 'Host: skuld.home.vorheim.com' https://skuld.home.vorheim.com/api/health
git -C ~/app/skuld rev-parse --short HEAD   # confirm it matches the commit you meant to ship
tail -n 20 ~/app/skuld/skuld.err.log        # should be empty/unremarkable after a clean restart
```

The deploy script itself already fails loudly on a bad backup or a failing health check; these checks are for confirming *which* commit ended up live and that nothing is quietly erroring in the log after the restart.

### Rollback

```bash
cd ~/app/skuld && git checkout <previous-commit> && bun install --frozen-lockfile && bun run build
launchctl kickstart -k gui/$(id -u)/com.mickey.skuld
```

The database is gitignored (`*.db`) and lives inside the working tree, so checking out an older commit doesn't touch it — but it also doesn't undo a migration the newer commit applied. Every deploy leaves a snapshot in `~/backup`; see the "Rollback" section of [deploy/README.md](deploy/README.md) for restoring one by hand.

## Discovering this file from a worktree

`AGENTS.md`, `CLAUDE.md`, and everything under `deploy/` are ordinary tracked files, not gitignored, so any `git worktree add` from this repository checks them out at whatever ref the worktree is on — an agent working in an isolated worktree sees the same instructions as one working in `~/dev/skuld` directly, as long as the worktree's branch was created at or after this file was merged to `master`. There is nothing extra to wire up.
