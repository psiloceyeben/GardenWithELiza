#!/usr/bin/env bash
set -euo pipefail
umask 077
# Credentials stay in the environment, not arguments or output.
: "${PGDATABASE:?Set PGDATABASE, PGHOST, PGPORT, PGUSER and PGPASSFILE as appropriate}"
case "${1:-}" in
  backup)
    : "${2:?Supply an output archive path}"
    [[ "$2" = /* ]] || { echo "Supply an absolute archive path" >&2; exit 1; }
    if [[ -e "$2" || -L "$2" || -e "$2.partial" || -L "$2.partial" ]]; then echo "Output already exists" >&2; exit 1; fi
    backup_temporary=$(mktemp "$(dirname -- "$2")/.pons-backup.XXXXXX")
    trap 'rm -f -- "$backup_temporary"' EXIT
    pg_dump --format=custom --no-owner --no-acl --file="$backup_temporary"
    pg_restore --list "$backup_temporary" > /dev/null
    # Same-directory hard link publishes without overwriting a raced file or symlink.
    ln -T -- "$backup_temporary" "$2"
    sha256sum "$2"
    ;;
  restore)
    : "${2:?Supply an archive path}" "${3:?Supply the exact destination database name}"
    actual=$(psql -XAtqc 'SELECT current_database()')
    [[ "$actual" == "$3" ]] || { echo "Destination database mismatch" >&2; exit 1; }
    occupied=$(psql -XAtqc "SELECT count(*) FROM pg_namespace WHERE nspname='pons'")
    [[ "$occupied" == 0 ]] || { echo "Destination already contains Pons data; refusing overwrite" >&2; exit 1; }
    # The archive reader must own the transaction: a failed SQL-producing pipe
    # could otherwise let psql commit an incomplete but syntactically valid prefix.
    pg_restore --no-owner --no-acl --single-transaction --exit-on-error --dbname="$actual" "$2" > /dev/null
    echo "Restore completed into $actual"
    ;;
  *) echo "Usage: database_backup.sh backup ARCHIVE | restore ARCHIVE EXPECTED_DATABASE" >&2; exit 2 ;;
esac
