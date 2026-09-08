#!/usr/bin/env bash
# Box C only. Stage a project-local runtime; never alter PATH or live services.
set -euo pipefail
test "$(uname -m)" = x86_64
test -d /opt/pons
version=22.23.2
archive="node-v${version}-linux-x64.tar.xz"
# Official latest-v22.x/SHASUMS256.txt, checked 2026-09-08 over HTTPS.
checksum=d60acfe00a2932254bb0ad20e01b0d74397a0875595de719654b214f4b03f307
staging=$(mktemp -d /opt/pons/runtime-check.XXXXXX)
cd "$staging"
curl --fail --location --proto '=https' --tlsv1.2 --connect-timeout 15 --max-time 180 \
  --output "$archive" "https://nodejs.org/dist/v${version}/${archive}"
printf '%s  %s\n' "$checksum" "$archive" | sha256sum --check --strict -
tar --extract --xz --file "$archive" --no-same-owner --no-same-permissions
runtime="$staging/node-v${version}-linux-x64/bin/node"
"$runtime" --version
printf 'STAGED_NODE=%s\n' "$runtime"
