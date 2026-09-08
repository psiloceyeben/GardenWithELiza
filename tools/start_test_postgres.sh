#!/usr/bin/env bash
set -euo pipefail
# Box C only. Uses Ubuntu package binaries extracted under the project, no system service.
runtime=/opt/pons/pg-test-runtime
export LD_LIBRARY_PATH="$runtime/usr/lib/x86_64-linux-gnu"
test_dir=$(mktemp -d /opt/pons/pg-check.XXXXXX)
chown nobody:nogroup "$test_dir"
runuser -u nobody -- env LD_LIBRARY_PATH="$LD_LIBRARY_PATH" "$runtime/usr/lib/postgresql/16/bin/initdb" -D "$test_dir/data" -L "$runtime/usr/share/postgresql/16" --no-locale -E UTF8 --auth=trust > "$test_dir/init.log"
runuser -u nobody -- env LD_LIBRARY_PATH="$LD_LIBRARY_PATH" "$runtime/usr/lib/postgresql/16/bin/pg_ctl" -D "$test_dir/data" -l "$test_dir/postgres.log" -o "-h '' -k $test_dir -p 15432 -c shared_buffers=16MB -c max_connections=10" -w start
printf 'TEST_SOCKET=%s\n' "$test_dir"
