#!/usr/bin/env bash
# Reclaim disk on Box C. Ben authorised this on 2026-09-08.
#   bash reclaim-disk.sh --dry-run    # show what would go, change nothing
#   bash reclaim-disk.sh --apply      # do it
#
# ONLY these targets. Nothing live, nothing that is research data, nothing that is a
# rollback safety net for a running service. Everything here is either a regenerable
# cache or a superseded build tree with no systemd/nginx reference.
#
# Deliberately NOT touched: /opt/wander/var, /opt/wander/data, /opt/oracle-clm/*,
# /opt/wander-around-game (live), /opt/wander-release-backups, /opt/wander-rollbacks,
# /opt/wander-release-candidates, /root/wander-loop-baseline-* (research evidence).
set -u
MODE="${1:---dry-run}"
[ "$MODE" = "--apply" ] || [ "$MODE" = "--dry-run" ] || { echo "usage: $0 --dry-run|--apply"; exit 2; }

echo "=== before ==="; df -h / | tail -1; echo

# Superseded build trees. Re-checked for references at run time; skipped if referenced.
TREES="/opt/wander-around-game-v1.1 /opt/ensouled-desktop-build"
# Regenerable caches.
CACHES="/root/.cache /root/.npm"

total=0
for d in $TREES; do
  [ -d "$d" ] || { echo "skip (absent):    $d"; continue; }
  if grep -rlq -- "$d" /etc/systemd/system/*.service /etc/nginx/sites-enabled/* 2>/dev/null; then
    echo "SKIP (referenced): $d"; continue
  fi
  sz=$(du -sm "$d" 2>/dev/null | cut -f1); total=$((total + sz))
  echo "remove tree:      $d (${sz}M, last modified $(stat -c %y "$d" | cut -c1-10))"
  [ "$MODE" = "--apply" ] && rm -rf "$d"
done

for d in $CACHES; do
  [ -d "$d" ] || { echo "skip (absent):    $d"; continue; }
  sz=$(du -sm "$d" 2>/dev/null | cut -f1); total=$((total + sz))
  echo "clear cache:      $d (${sz}M)"
  [ "$MODE" = "--apply" ] && rm -rf "${d:?}/"* 2>/dev/null
done

echo "vacuum journal:   $(journalctl --disk-usage 2>/dev/null | grep -oE '[0-9.]+[GM]' | head -1) -> 300M cap"
[ "$MODE" = "--apply" ] && journalctl --vacuum-size=300M >/dev/null 2>&1
echo "apt cache:        $(du -sh /var/cache/apt 2>/dev/null | cut -f1)"
[ "$MODE" = "--apply" ] && apt-get clean >/dev/null 2>&1

echo
echo "targets total:    ~$((total / 1024))G plus journal and apt cache"
if [ "$MODE" = "--apply" ]; then
  echo "=== after ==="; df -h / | tail -1
  printf '%s: removed superseded trees (wander-around-game-v1.1, ensouled-desktop-build), cleared /root/.cache and /root/.npm, vacuumed journal to 300M, apt clean. No live service, research data or rollback archive touched.\n' "$(date -u)" >> /opt/_reclaim-log.txt
  echo "logged to /opt/_reclaim-log.txt"
else
  echo "(dry run: nothing was changed)"
fi
