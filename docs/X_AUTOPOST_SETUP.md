# Auto-posting to X

What you do once, what you do per post, and what the system will never do on its own.

---

## The one rule

**Nothing posts unless you have marked it `"approved": true`.**

The queue is not a suggestion box that drains automatically. An account posting unattended is
one bad line away from something you cannot unsend, and a one-word edit in a file is a cheap
place to keep a person in the loop. Everything below is built around that.

Second rule, which matters less to you but saves you an embarrassment: **nothing posts
twice.** Every entry has an id, posted ids go into a log, and the log is checked before each
send. A duplicate timer fire, a retry, or a server restart cannot repost.

---

## Part 1 — get the keys (about ten minutes, once)

1. Go to **developer.x.com** and sign in **as the GardenWithEliza account**, not your personal
   one. Whichever account authorises this is the account that posts.
2. Create a **Project**, then an **App** inside it. Any name.
3. In the app's **User authentication settings**:
   - App permissions: **Read and write** (the default is read-only, and posting will fail
     with a 403 that does not explain itself)
   - Type of App: **Web App, Automated App or Bot**
   - Callback URL: `https://gardenwitheliza.com/` (unused, but the form demands one)
   - Website URL: `https://gardenwitheliza.com/`
4. Go to **Keys and tokens** and generate all four:
   - **API Key** and **API Key Secret** (consumer keys)
   - **Access Token** and **Access Token Secret** (under "Authentication Tokens")

**Important:** if you change app permissions *after* generating the access token, the token
keeps the old permission. Regenerate the Access Token afterwards or posting stays blocked.

**Never paste these into a chat, a commit, a document, or the queue file.** They go in one
place, in step 2.

---

## Part 2 — put them on the server (once)

```bash
ssh root@89.167.7.54 nano /etc/pons-x.env
```

Paste, with your values:

```
X_API_KEY=...
X_API_SECRET=...
X_ACCESS_TOKEN=...
X_ACCESS_SECRET=...
```

Save with `Ctrl+O`, `Enter`, `Ctrl+X`. Then lock it down so only root can read it:

```bash
ssh root@89.167.7.54 "chmod 600 /etc/pons-x.env && ls -l /etc/pons-x.env"
```

Check it works without posting anything:

```bash
ssh root@89.167.7.54 "set -a; . /etc/pons-x.env; set +a; cd /opt/pons/tools/x-poster && node post.cjs --status"
```

You should see the queue listed. `--status` never contacts X, so this is safe to run at any
time.

---

## Part 3 — approving a post

Open the queue:

```bash
ssh root@89.167.7.54 nano /opt/pons/tools/x-poster/queue.json
```

Find the entry and change one word:

```json
{
  "id": "launch-01",
  "approved": true,
  "notBefore": null,
  "text": "Your land stays yours. Your plants do not. ..."
}
```

- `approved` — `false` until you say otherwise. This is the whole safety model.
- `notBefore` — optional. `null` means "as soon as it is approved". Otherwise an ISO time
  such as `"2026-09-10T17:00:00Z"` and it waits.
- `text` — 280 characters or fewer. Anything longer is **skipped, not truncated**, and says so.
- `id` — must be unique and must never be reused. It is what stops a repost.

**Always dry-run first.** It prints exactly what would go out and contacts nothing:

```bash
ssh root@89.167.7.54 "cd /opt/pons/tools/x-poster && node post.cjs --dry-run"
```

Post it for real:

```bash
ssh root@89.167.7.54 "set -a; . /etc/pons-x.env; set +a; cd /opt/pons/tools/x-poster && node post.cjs --once"
```

`--once` sends at most one due entry. Leave it off to send everything that is due.

---

## Part 4 — running it on a timer (optional)

Only worth doing once you trust the queue. The timer still respects `approved`, so an empty
or unapproved queue simply does nothing.

```bash
ssh root@89.167.7.54 "cat > /etc/systemd/system/pons-x.service <<'EOF'
[Unit]
Description=GardenWithEliza X poster
After=network-online.target

[Service]
Type=oneshot
EnvironmentFile=/etc/pons-x.env
WorkingDirectory=/opt/pons/tools/x-poster
ExecStart=/usr/bin/node post.cjs --once
EOF
cat > /etc/systemd/system/pons-x.timer <<'EOF'
[Unit]
Description=Post one approved GardenWithEliza entry, hourly

[Timer]
OnCalendar=hourly
Persistent=true

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload && systemctl enable --now pons-x.timer && systemctl list-timers pons-x.timer --no-pager"
```

One approved post per hour at most. To pause everything without touching the queue:

```bash
ssh root@89.167.7.54 "systemctl stop pons-x.timer && systemctl disable pons-x.timer"
```

---

## What went out

Every attempt is logged, successes and failures both:

```bash
ssh root@89.167.7.54 "cat /opt/pons/tools/x-poster/posted.jsonl"
```

Each line records the id, the time, whether it worked, the tweet id, and the first part of
the text. Failures are logged with the error rather than disappearing, because a post that
silently did not happen is worse than one that visibly failed.

---

## When it does not work

**403 with a permissions message.** The app is read-only, or the access token predates the
permission change. Set Read and write, then regenerate the Access Token.

**401.** One of the four values is wrong or has a stray space. Re-copy all four.

**429.** Rate limited. The free tier is tight. Leave it and the timer picks it up next hour.

**"missing credentials".** The env file was not loaded. Use the `set -a; . /etc/pons-x.env;
set +a;` prefix, which is what the systemd unit does for you.

**Nothing happens and no error.** Almost always `approved` is still `false`, or the id is
already in `posted.jsonl`. Run `--status`, which tells you which.

---

## What this will never do

- Post anything you have not approved.
- Post the same entry twice.
- Reply, quote, follow, like, or DM. It only creates posts.
- Read your timeline or anybody's data.
- Write credentials into the repo, the queue, or the log.

If you want it to do more than post, that is a separate conversation and a separate set of
permissions.
