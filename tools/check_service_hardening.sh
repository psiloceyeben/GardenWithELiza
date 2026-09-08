#!/usr/bin/env bash
# Box C only: a separate transient service, never pons-server.service/live saves.
set -euo pipefail
runtime=/opt/pons/runtime-check.GjYzpp/node-v22.23.2-linux-x64/bin/node
test -x "$runtime"
evidence=$(mktemp -d /opt/pons/hardening-evidence.XXXXXX)
unit="pons-hardening-qa-${evidence##*.}"
trap 'systemctl stop "$unit.service" || true' EXIT
systemd-run --unit="$unit" --property=DynamicUser=yes \
  --property="StateDirectory=$unit" --property=StateDirectoryMode=0700 \
  --property=WorkingDirectory=/opt/pons --property=ProtectSystem=strict \
  --property=ProtectHome=yes --property=PrivateTmp=yes --property=NoNewPrivileges=yes \
  --property=CapabilityBoundingSet= --property=RestrictSUIDSGID=yes \
  --property='RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6' \
  --property=RuntimeMaxSec=120 --property=TimeoutStopSec=25 \
  --setenv=PONS_HOST=127.0.0.1 --setenv=PONS_PORT=0 \
  "$runtime" /opt/pons/tools/hardened-server.cjs
port_of_service() {
  for attempt in $(seq 1 30); do
    invocation=$(systemctl show "$unit" --property=InvocationID --value)
    port=$(journalctl "_SYSTEMD_INVOCATION_ID=$invocation" -o cat --no-pager | sed -n 's/.*pons server :\([0-9]*\).*/\1/p' | tail -1)
    if test -n "$port" && curl --max-time 2 -fsS "http://127.0.0.1:$port/health" >/dev/null; then printf '%s' "$port"; return; fi
    sleep 1
  done
  journalctl -u "$unit" -o cat --no-pager >&2
  return 1
}
port=$(port_of_service)
"$runtime" /opt/pons/tools/hardened-client.cjs "$port"
systemctl restart "$unit"
port=$(port_of_service)
"$runtime" /opt/pons/tools/hardened-client.cjs "$port" existing
systemctl stop "$unit"
trap - EXIT
journalctl -u "$unit" -o cat --no-pager | tee "$evidence/service.log"
printf 'HARDENING_EVIDENCE=%s STATE_DIRECTORY=/var/lib/%s\n' "$evidence" "$unit"
