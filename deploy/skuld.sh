#!/bin/zsh
# deploy/skuld.sh — deterministic deployment of the ~/app/skuld clone
set -euo pipefail

APP_DIR="$HOME/app/skuld"
LABEL="com.mickey.skuld"
DB="$APP_DIR/server/skuld.db"
BACKUP_DIR="$HOME/backup"
KEEP=10

# back up before anything else touches the clone, so a deploy that goes wrong still has the
#  database as it was a moment earlier. .backup, not cp: in WAL mode most recent commits sit in
#  skuld.db-wal until a checkpoint folds them into skuld.db, and copying the main file alone
#  silently loses them. It also takes a consistent snapshot of a database being written to
if [[ -f "$DB" ]]; then
  mkdir -p "$BACKUP_DIR"
  STAMP="$(date +%F-%H%M%S)"
  SNAPSHOT="$BACKUP_DIR/skuld-$STAMP.db"
  # the service is still serving while this runs, so wait rather than failing the deploy if a
  #  write holds the lock at that moment
  sqlite3 -cmd '.timeout 5000' "$DB" ".backup '$SNAPSHOT'"
  # a backup that cannot be read back is not a backup, and finding that out at restore time is
  #  too late, so a bad snapshot stops the deploy before the running service is disturbed
  if [[ "$(sqlite3 "$SNAPSHOT" 'pragma integrity_check;')" != "ok" ]]; then
    echo "backup failed integrity check: $SNAPSHOT" >&2
    exit 1
  fi
  echo "backed up: $SNAPSHOT ($(du -h "$SNAPSHOT" | cut -f1))"
  # keep the last $KEEP, oldest first out
  ls -1t "$BACKUP_DIR"/skuld-[0-9]*.db 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
    rm -f -- "$old"
    echo "pruned old backup: $old"
  done
else
  echo "no database at $DB yet; nothing to back up"
fi

cd "$APP_DIR"
git fetch origin
git checkout master
git pull --ff-only origin master

bun install --frozen-lockfile
bun run build

launchctl kickstart -k "gui/$(id -u)/$LABEL"

for i in {1..10}; do
  if curl -fsS http://127.0.0.1:3456/api/health >/dev/null; then
    echo "skuld deployed: $(git rev-parse --short HEAD)"
    exit 0
  fi
  sleep 1
done

echo "skuld failed health check after restart" >&2
exit 1
