# GoEV WV — Droplet Rebuild & First Launch Runbook

**Audience:** Patrick (goevwv.com owner)
**Estimated total time:** ~60–90 minutes of active work plus some waiting
**Outcome:** Droplet 174.138.53.28 rebuilt to Ubuntu 24.04 LTS, goevwv.com live with HTTPS serving a "Coming Soon" page.

> **Before you start this runbook, confirm:** your forum scrape of whyweare50th.com is saved somewhere that is NOT on the droplet (your laptop, Google Drive, an external drive). Everything on the droplet will be destroyed in Phase 4.

---

## Phase 0 — Tell me your laptop OS

Instructions below cover both **Windows** and **macOS**. Skip the section that doesn't apply to you.

---

## Phase 1 — Create an SSH key and add it to DigitalOcean (~10 min)

You'll use this key to log into the droplet after rebuild. Without it, you'll be locked out.

### On Windows

1. Open **PowerShell** (Start menu → type "PowerShell" → Enter).
2. Run:
   ```
   ssh-keygen -t ed25519 -C "pbrennan10@gmail.com"
   ```
3. When it asks where to save the file, press Enter to accept the default (`C:\Users\Patrick\.ssh\id_ed25519`).
4. When it asks for a passphrase, you can press Enter twice to skip, or enter one for extra security. **Write it down if you use one.**
5. Display your public key — you'll paste this into DigitalOcean:
   ```
   Get-Content $HOME\.ssh\id_ed25519.pub
   ```
6. Copy the entire line that starts with `ssh-ed25519` and ends with `pbrennan10@gmail.com`.

### On macOS

1. Open **Terminal** (Cmd+Space → type "Terminal" → Enter).
2. Run:
   ```
   ssh-keygen -t ed25519 -C "pbrennan10@gmail.com"
   ```
3. Press Enter to accept the default save path.
4. Press Enter twice (or set a passphrase).
5. Display your public key:
   ```
   cat ~/.ssh/id_ed25519.pub
   ```
6. Copy the entire line that starts with `ssh-ed25519`.

### Add the key to DigitalOcean

1. Go to https://cloud.digitalocean.com/account/security
2. Under **SSH Keys**, click **Add SSH Key**.
3. Paste the public key you copied.
4. Name it something like `patrick-laptop`.
5. Click **Add SSH Key**.

✅ Checkpoint: your key name should now appear in the SSH Keys list.

---

## Phase 2 — Push the scaffold code to GitHub (~10 min)

The bootstrap script on the droplet pulls from your GitHub repo, so the code needs to be there first.

**Your repo:** https://github.com/pbrennan10-stack/goevwv

1. Go to your repo on github.com. If it's empty, you'll see a page with options to "create a new file," "upload files," etc.
2. Click **"uploading an existing file"** (or "Add file" → "Upload files").
3. On your laptop, open the folder `D:\Documents\Claude\Projects\GOEVWV\goevwv\` and select **all** files and subfolders.
4. Drag them into the GitHub upload area.
5. Wait for uploads to finish (you'll see green checkmarks).
6. Scroll down, in the commit message box type: `Initial scaffold`
7. Click **Commit changes**.

✅ Checkpoint: visit https://github.com/pbrennan10-stack/goevwv and confirm you see `README.md`, `Caddyfile`, `docker-compose.yml`, `data/`, `public/`, `scripts/`.

> **If drag-and-drop doesn't work for the subfolders:** install GitHub Desktop (https://desktop.github.com), click "Clone a repository," pick `pbrennan10-stack/goevwv`, copy the scaffold files into the local clone folder, then use GitHub Desktop to commit and push.

---

## Phase 3 — Pre-rebuild safety (~5 min)

### Confirm scrape is saved off-droplet

One last check: is `whyweare50th.com` forum data saved somewhere that is NOT the droplet? ✅ If yes, continue.

### Take a safety snapshot of the droplet

This is cheap insurance. After rebuild, nothing on the old droplet can be recovered unless you snapshot first.

1. Go to https://cloud.digitalocean.com/droplets
2. Click your droplet (the one at 174.138.53.28).
3. In the left sidebar, click **Snapshots**.
4. Name the snapshot `pre-rebuild-2026-04-18-discourse` and click **Take Snapshot**.
5. This takes 5–15 minutes. Wait for it to finish (the droplet is temporarily powered off during snapshot).

✅ Checkpoint: snapshot appears in your Snapshots list with today's date.

**Cost note:** snapshots cost ~$0.06/GB/month. A 25GB droplet snapshot is ~$1.50/mo if you keep it. You can delete it after goevwv has been running successfully for a week.

---

## Phase 4 — Rebuild the droplet (~15 min)

This is the point of no return. Everything on the droplet disk is wiped.

1. From the droplet page on DigitalOcean, click **Destroy** in the left sidebar.
2. Click the **Rebuild Droplet** tab (NOT the "Destroy Droplet" tab — that deletes the droplet entirely and you lose the IP).
3. Choose **Ubuntu 24.04 (LTS) x64** from the image selector.
4. **Important:** confirm that your `patrick-laptop` SSH key (added in Phase 1) is selected to be pre-installed. If you don't see an option to pick SSH keys, they'll be auto-pulled from your account's SSH keys list.
5. Click **Rebuild**.
6. Wait ~3-5 minutes. The droplet's status will go to "rebuilding" then back to "active."

✅ Checkpoint: droplet status is "active" with a fresh Ubuntu 24.04 image. The IP `174.138.53.28` should be unchanged.

---

## Phase 5 — SSH in and run the bootstrap (~15 min)

### First login

From your laptop terminal (PowerShell on Windows, Terminal on macOS):
```
ssh root@174.138.53.28
```

- First time, you'll see "The authenticity of host... can't be established." Type `yes` and Enter.
- If it prompts for a password, your key didn't get attached — stop here and tell me.
- If you get a `$` or `#` prompt, you're in. ✅

### Run the bootstrap

Paste this single command and press Enter:
```
curl -fsSL https://raw.githubusercontent.com/pbrennan10-stack/goevwv/main/scripts/bootstrap.sh | bash
```

You'll see ~3 minutes of output: package installs, Docker setup, firewall config, and finally a summary showing the Caddy container running.

The script is idempotent — if anything breaks, you can safely re-run it after fixing the issue.

✅ Checkpoint: the final output shows "Bootstrap complete" and a docker container named `goevwv-caddy` with status `Up`.

### Type `exit` to log out.

---

## Phase 6 — Point goevwv.com at the droplet (at GoDaddy) (~10 min + DNS wait)

1. Sign in to GoDaddy: https://account.godaddy.com/products
2. Find `goevwv.com` and click the **DNS** button (or "Manage DNS").
3. In the **DNS Records** section, you'll see existing default records. Make these changes:
   - **Find the `A` record with name `@`** (that's the apex — goevwv.com itself).
     - If it exists: click edit, set value to `174.138.53.28`, TTL 600 (10 minutes).
     - If it doesn't exist: click **Add**, type=A, name=`@`, value=`174.138.53.28`, TTL=600.
   - **Find or add the `CNAME` record with name `www`.**
     - Set it to point to `@` (which is goevwv.com).
4. **Delete** any default "Parked" or "Forwarding" records GoDaddy auto-created. They'll interfere with Caddy.
5. Save.

DNS propagation typically takes 5–30 minutes. You can check with:
```
nslookup goevwv.com
```
When it returns `174.138.53.28`, you're live.

---

## Phase 7 — Retire whyweare50th.com DNS (~5 min)

Since the forum is gone and the domain is being retired:

1. Sign in to GoDaddy (or wherever whyweare50th.com is registered — tell me if it's not GoDaddy and I'll adjust).
2. Go to DNS Records for `whyweare50th.com`.
3. **Delete** the `A` record pointing to `174.138.53.28`. This prevents confused visitors from hitting your droplet and getting a 404 from the catch-all rule in your Caddyfile.
4. Also delete any `CNAME` records for www or mail that were forum-related.
5. If you're not renewing the domain, you can let it expire naturally (GoDaddy will email renewal reminders 30 days out).

---

## Phase 8 — Verify (~5 min)

Wait until `nslookup goevwv.com` returns `174.138.53.28`, then:

1. In your browser, visit **https://goevwv.com**
2. You should see the "GoEV WV — Coming Soon" page with a green tag, headline, and feature cards.
3. The browser should show a lock icon (HTTPS). Caddy auto-provisions the Let's Encrypt certificate on first visit.
4. Test the www redirect: visit https://www.goevwv.com — should redirect to https://goevwv.com.

✅ **If both work, you're launched.** 🎉

---

## If things go wrong

**"Permission denied (publickey)" when SSHing in**
Your public key didn't get installed during rebuild. From DO dashboard → droplet → Access → Reset Root Password. Use the emailed password to SSH in once, then manually add your key to `/root/.ssh/authorized_keys`. Tell me if this happens — I'll walk you through it live.

**Bootstrap script errors out mid-run**
Re-run it. It's designed to be safe on re-run. If it fails the second time, paste me the last 20 lines of output.

**Site shows "Your connection is not private" or SSL error**
DNS hasn't propagated yet. Wait 10-15 minutes and retry. Caddy needs DNS pointing at the droplet before it can issue a cert.

**Site shows "404 Not Found"**
Caddy is running but the wrong Caddyfile is loaded. SSH in and run: `cd /opt/goevwv && docker compose logs caddy --tail 50`. Paste me the output.

**"Bootstrap complete" but `docker compose ps` shows no containers**
Something in the docker-compose.yml is malformed or missing. SSH in and run: `cd /opt/goevwv && docker compose up -d 2>&1 | tee /tmp/compose.log`. Paste me `/tmp/compose.log`.

---

## What happens next (after successful launch)

Once goevwv.com is showing the Coming Soon page reliably:

1. I'll start building the MVP (Next.js commute calculator). This happens in the `goevwv` repo; you won't need to touch the droplet.
2. I'll add you a free UptimeRobot account so you get an email if the site goes down.
3. We'll set up GitHub Actions for automatic deploys so pushing to the repo auto-updates the live site.

---

## Quick reference — what you'll need handy

- **Droplet IP:** 174.138.53.28
- **Domain:** goevwv.com (GoDaddy)
- **Repo:** https://github.com/pbrennan10-stack/goevwv
- **SSH login:** `ssh root@174.138.53.28`
- **App directory on droplet:** `/opt/goevwv`
- **Restart the site:** `cd /opt/goevwv && docker compose restart`
- **View logs:** `cd /opt/goevwv && docker compose logs -f`
