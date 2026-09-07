#!/usr/bin/env bash
# Runs ON Box A. Expects the client dist already extracted at /var/www/pons.
# Serves the game at /ponsgarden/ (static), proxies /ponsgarden/ws and /ponsgarden/garden/ to Box C :8130,
# and redirects the old /pons paths. Idempotent: rewrites the whole Pons block each run.
set -e
V=/etc/nginx/sites-enabled/hermes
ls /var/www/pons/index.html >/dev/null
cp "$V" "/root/hermes_vhost.bak.$(date +%Y%m%d%H%M%S)"
python3 - "$V" <<'PY'
import re, sys
p = sys.argv[1]; s = open(p).read()
block = '''    # >>> Pons Garden (managed by tools/deploy_box_a.sh)
    location = /pons { return 301 /ponsgarden/; }
    location = /ponsgarden { return 301 /ponsgarden/; }
    location ^~ /pons/garden/ { return 301 /ponsgarden/garden/$request_uri; }
    location ^~ /pons/ { return 301 /ponsgarden/; }
    location ^~ /ponsgarden/garden/ {
        proxy_pass http://89.167.7.54:8130/garden/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    location = /ponsgarden/ws {
        proxy_pass http://89.167.7.54:8130/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
    location ^~ /ponsgarden/ {
        alias /var/www/pons/;
        try_files $uri $uri/ /ponsgarden/index.html;
        add_header Cache-Control "no-cache" always;
    }
    # <<< Pons Garden

'''
# strip every earlier Pons location (v1 blocks and the managed block) then insert once before /sites
s = re.sub(r'    # >>> Pons Garden.*?# <<< Pons Garden\n\n', '', s, flags=re.S)
s = re.sub(r'    # Pons Garden[^\n]*\n(?:    location[^{]*\{[^}]*\}\n)+\n?', '', s)
s = re.sub(r'    location = /pons \{ return 301 /pons/; \}\n', '', s)
anchor = "    location = /sites {"; assert s.count(anchor) == 1, "anchor not unique"
s = s.replace(anchor, block + anchor, 1)
open(p, "w").write(s); print("vhost: rewritten")
PY
nginx -t 2>&1 | tail -1
systemctl reload nginx && echo "nginx: reloaded"
