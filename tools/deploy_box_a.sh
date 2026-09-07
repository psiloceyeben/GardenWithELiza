#!/usr/bin/env bash
# Runs ON Box A. Expects the client dist already extracted at /var/www/pons.
# Adds the /pons/ static location and the /pons/ws websocket proxy (to Box C :8130) to the prometheus7.com vhost. Idempotent.
set -e
V=/etc/nginx/sites-enabled/hermes
ls /var/www/pons/index.html >/dev/null
cp "$V" "/root/hermes_vhost.bak.$(date +%Y%m%d%H%M%S)"
python3 - "$V" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
static = '''    # Pons Garden (static Phaser build, deployed from Box C /opt/pons/client/dist)
    location = /pons { return 301 /pons/; }
    location ^~ /pons/ {
        alias /var/www/pons/;
        try_files $uri $uri/ /pons/index.html;
        add_header Cache-Control "no-cache" always;
    }

'''
ws = '''    # Pons Garden game server (websocket) on Box C
    location = /pons/ws {
        proxy_pass http://89.167.7.54:8130/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
'''
share = '''    # Pons Garden share pages: any wallet is a garden (bible §6.4)
    location ^~ /pons/garden/ {
        proxy_pass http://89.167.7.54:8130/garden/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
'''
changed = False
if 'location ^~ /pons/garden/' not in s:
    anchor = "    location = /pons { return 301 /pons/; }"
    if anchor in s: s = s.replace(anchor, share + anchor, 1); changed = True
if 'location ^~ /pons/' not in s:
    anchor = "    location = /sites {"; assert s.count(anchor) == 1
    s = s.replace(anchor, static + anchor, 1); changed = True
if 'location = /pons/ws' not in s:
    anchor = "    location = /pons { return 301 /pons/; }"; assert s.count(anchor) == 1
    s = s.replace(anchor, ws + anchor, 1); changed = True
if changed: open(p, "w").write(s)
print("vhost:", "patched" if changed else "unchanged")
PY
nginx -t 2>&1 | tail -1
systemctl reload nginx && echo "nginx: reloaded"
