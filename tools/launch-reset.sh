#!/usr/bin/env bash
# Launch reset: start Season 1 from a clean village.
#
# Removes every stored garden so nobody begins the first scored season with a head start
# built during development, and optionally moves storage to PostgreSQL at the same moment -
# a fresh database needs no migration, which is why doing both together is safer than
# doing either alone later.
#
# DESTRUCTIVE. Takes a backup first and prints where it went. Run on Box C as root.
#
#   ./launch-reset.sh --dry-run     show what would happen
#   ./launch-reset.sh --apply       do it (file storage, wiped)
#   ./launch-reset.sh --apply --postgres   also switch storage to PostgreSQL

set -euo pipefail

DATA=${PONS_DATA:-/var/lib/pons}
UNIT=/etc/systemd/system/pons-server.service
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP=/opt/pons/launch-reset-$STAMP

MODE=dry
USE_PG=0
for a in "$@"; do
  case "$a" in
    --apply) MODE=apply ;;
    --dry-run) MODE=dry ;;
    --postgres) USE_PG=1 ;;
    *) echo "unknown argument: $a" >&2; exit 2 ;;
  esac
done

echo "data dir     : $DATA"
echo "backup to    : $BACKUP"
echo "storage      : $([ $USE_PG -eq 1 ] && echo 'PostgreSQL (fresh)' || echo 'file')"
echo "mode         : $MODE"
echo

if [ -f "$DATA/snapshot.json" ]; then
  PLAYERS=$(node -e "try{const d=require('$DATA/snapshot.json');console.log(Object.keys(d.players||{}).length)}catch(e){console.log('?')}" 2>/dev/null || echo '?')
  echo "would remove : $PLAYERS stored player record(s)"
else
  echo "would remove : no snapshot present"
fi

if [ "$MODE" = dry ]; then
  echo
  echo "Dry run only. Nothing changed. Re-run with --apply when you are ready to launch."
  exit 0
fi

echo
echo "stopping the service first, so nothing rewrites state while we work"
systemctl stop pons-server

mkdir -p "$BACKUP"
cp -a "$DATA/." "$BACKUP/" 2>/dev/null || true
cp -a "$UNIT" "$BACKUP/pons-server.service" 2>/dev/null || true
echo "backed up to $BACKUP"

# Remove stored state. The directory itself and its ownership stay put: recreating it as
# root is what caused the outage on 8 September.
find "$DATA" -mindepth 1 -maxdepth 1 -name 'snapshot.json' -delete
find "$DATA" -mindepth 1 -maxdepth 1 -name 'players.json' -delete
find "$DATA" -mindepth 1 -maxdepth 1 -name 'villages.json' -delete
find "$DATA" -mindepth 1 -maxdepth 1 -name 'ledger.log' -delete
echo "cleared stored gardens"

if [ $USE_PG -eq 1 ]; then
  if [ ! -f /root/.pons_db_pw ]; then echo "missing /root/.pons_db_pw" >&2; exit 1; fi
  PW=$(cat /root/.pons_db_pw)
  URL="postgresql://pons_app:$PW@127.0.0.1:5432/pons"
  # Drop and recreate so the first scored season starts on an empty schema.
  sudo -u postgres psql -q -v ON_ERROR_STOP=1 -c 'DROP DATABASE IF EXISTS pons;' -c 'CREATE DATABASE pons OWNER pons_app;'
  grep -v '^Environment=PONS_DATABASE_URL=' "$UNIT" > "$UNIT.tmp"
  awk -v url="Environment=PONS_DATABASE_URL=$URL" '
    /^Environment=PONS_DATA=/ { print; print url; next } { print }' "$UNIT.tmp" > "$UNIT"
  rm -f "$UNIT.tmp"
  chmod 600 "$UNIT"
  systemctl daemon-reload
  echo "storage switched to PostgreSQL on a fresh database"
fi

chown -R pons:pons "$DATA"
systemctl start pons-server
sleep 4

if ! systemctl is-active --quiet pons-server; then
  echo "SERVICE DID NOT START — restore with:" >&2
  echo "  systemctl stop pons-server && cp -a $BACKUP/. $DATA/ && cp -a $BACKUP/pons-server.service $UNIT && systemctl daemon-reload && systemctl start pons-server" >&2
  journalctl -u pons-server -n 20 --no-pager >&2
  exit 1
fi

echo
echo "service active. health:"
curl -s http://127.0.0.1:8130/health
echo
echo
echo "Launch reset complete. Rollback if needed:"
echo "  systemctl stop pons-server && cp -a $BACKUP/. $DATA/ && cp -a $BACKUP/pons-server.service $UNIT && systemctl daemon-reload && systemctl start pons-server"
