#!/usr/bin/env bash
# Runs ON Box A. Expects the client dist already extracted at /var/www/pons.
# Adds the /pons/ nginx location to the prometheus7.com vhost once (idempotent), tests, reloads.
set -e
V=/etc/nginx/sites-enabled/hermes
ls /var/www/pons/index.html >/dev/null
if grep -q 'location \^~ /pons/' "$V"; then
  echo "vhost: /pons/ already present"
else
  cp "$V" "/root/hermes_vhost.bak.$(date +%Y%m%d%H%M%S)"
  python3 - "$V" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
block = '''    # Pons Garden (static Phaser build, deployed from Box C /opt/pons/client/dist)
    location = /pons { return 301 /pons/; }
    location ^~ /pons/ {
        alias /var/www/pons/;
        try_files $uri $uri/ /pons/index.html;
        add_header Cache-Control "no-cache" always;
    }

'''
anchor = "    location = /sites {"
assert s.count(anchor) == 1, "anchor not unique"
open(p, "w").write(s.replace(anchor, block + anchor, 1))
print("vhost: patched")
PY
fi
nginx -t 2>&1 | tail -1
systemctl reload nginx && echo "nginx: reloaded"
