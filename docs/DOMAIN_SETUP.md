# ponsgarden.com — connecting the domain

Box C is already configured and serving the game for `ponsgarden.com`. **The only thing
left is DNS, which only you can do.** Once the records resolve, one command turns on HTTPS.

---

## 1. What is already done

On Box C (`89.167.7.54`):

- An nginx site for `ponsgarden.com` and `www.ponsgarden.com`, serving the game at the root.
- `/ws` proxied to the game server on `127.0.0.1:8130`, with websocket upgrade headers and
  a one-hour read timeout so long sessions do not get cut.
- `/garden/` proxied for the per-address share pages, and `/health` for monitoring.
- Hashed bundles cached for 30 days as immutable; `index.html` explicitly never cached, so a
  redeploy is picked up immediately.
- Any unknown path falls back to `index.html`.
- `/.well-known/acme-challenge/` left reachable over plain HTTP for certificate renewal.

Verified working on the box by sending a `Host: ponsgarden.com` header: the game, all three
legal pages and the health endpoint return 200.

**No client change was needed.** The client derives its websocket URL from whatever origin
it is served from and uses relative asset paths, so it works on any domain at any path.

## 2. What you do — the DNS records

At your registrar, point the domain at Box C:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | `89.167.7.54` | 300 |
| A | `www` | `89.167.7.54` | 300 |

If your registrar offers AAAA and you want IPv6, leave it off for now — Box C's nginx does
listen on IPv6, but there is no reason to add a second thing that can be wrong on launch
night.

A short TTL (300s) is deliberate: if anything needs changing tonight, you are not waiting
hours for it.

**If your registrar uses a proxy (Cloudflare's orange cloud):** turn it OFF for now. It
terminates TLS itself and adds websocket rules that are one more thing to debug during a
launch. Grey cloud, DNS-only.

## 3. Check it resolved

From anywhere:

```bash
dig +short ponsgarden.com
```

You want `89.167.7.54` back. Propagation with a 300s TTL is usually a few minutes.

## 4. Turn on HTTPS

Once DNS resolves, this is the whole thing:

```bash
ssh root@89.167.7.54 "certbot --nginx -d ponsgarden.com -d www.ponsgarden.com --agree-tos -m benhorn99@gmail.com --redirect --non-interactive"
```

Certbot edits the nginx site in place, adds the certificate, and sets up the HTTP-to-HTTPS
redirect. Renewal is automatic via the systemd timer that is already installed.

Then confirm:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://ponsgarden.com/
```

## 5. What to check after it is live

- `https://ponsgarden.com/` loads the game and you can join as a guest.
- The ticker tape appears at the top within about fifteen seconds — that proves the
  **websocket** is working, not just the static files.
- `https://ponsgarden.com/rules.html` loads.
- Open the browser console and confirm no errors mentioning `ws://` or `wss://`.

If the page loads but the tape never appears, the websocket is the problem and not the
site — check `journalctl -u pons-server -n 50` on Box C.

## 6. The old address keeps working

`prometheus7.com/ponsgarden/` is untouched and stays live on Box A. Nothing about this
change breaks it, so there is no cutover moment and no window where the game is down.

Once you are happy with the new domain, the promo copy should switch to `ponsgarden.com`
because it is much better to say out loud. The cards and posts currently say
`prometheus7.com/ponsgarden` — tell me and I will re-render them.
