#!/usr/bin/env bash
# Box C only; explicit existing preview target, never the public service.
set -euo pipefail
cd /opt/pons
test "${1:-}" = --apply || { echo 'Pass --apply for a preview-only restart' >&2; exit 1; }
preview_unit=pons-hd2d-preview.service
systemctl is-active --quiet "$preview_unit"
preview_pid=$(systemctl show "$preview_unit" --property=MainPID --value)
[[ "$preview_pid" =~ ^[1-9][0-9]*$ ]]
preview_data=/opt/pons/data_hd2d.BLm4JG
preview_node=/opt/pons/runtime-check.GjYzpp/node-v22.23.2-linux-x64/bin/node
test "$(readlink /proc/$preview_pid/cwd)" = /opt/pons
tr '\0' '\n' < /proc/$preview_pid/environ | grep -Fx "PONS_DATA=$preview_data"
tr '\0' '\n' < /proc/$preview_pid/environ | grep -Fx 'PONS_PORT=8132'
test "$(realpath "$preview_data")" = /opt/pons/data_hd2d.BLm4JG
test -x "$preview_node"
test "$(readlink /proc/$preview_pid/exe)" = "$preview_node"
test -f "$preview_data/snapshot.json"
tr '\0' '\n' < /proc/$preview_pid/environ | grep -Fx 'PONS_HOST=127.0.0.1'
curl -fsS http://127.0.0.1:8132/health | grep -F '"reader":"cached(mock)"'
preview_backup=$(mktemp -d /opt/pons/hd2d-refresh.XXXXXX)
cp -a "$preview_data" "$preview_backup/before-stop"
cp -a server/dist "$preview_backup/rebuilt-dist"
printf 'Recovery directory: %s\n' "$preview_backup"
"$preview_node" tools/check-preview-preservation.cjs --candidate="$preview_backup/before-stop"
test "$(systemctl show "$preview_unit" --property=MainPID --value)" = "$preview_pid"
# Restart the validated existing unit, retaining its environment and graceful stop.
systemctl restart "$preview_unit"
for attempt in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:8132/health; then
    printf '\n'
    cp -a "$preview_data" "$preview_backup/after-restart"
    "$preview_node" tools/check-preview-preservation.cjs --before="$preview_backup/before-stop" --after="$preview_backup/after-restart"
    systemctl show "$preview_unit" --property=ActiveState --property=MainPID --property=NRestarts
    exit 0
  fi
  sleep 1
done
echo 'Preview health unavailable; inspect pons-hd2d-preview journal. Backups retained.' >&2
exit 1
