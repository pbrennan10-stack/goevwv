#!/usr/bin/env bash
# GoEV WV droplet bootstrap
# -----------------------------------------------------------
# Run this ONCE on a freshly-rebuilt Ubuntu 24.04 droplet as root.
# It installs Docker, firewall, fail2ban, auto security updates,
# clones the goevwv repo, and starts the site.
#
# Usage (as root on the droplet):
#   curl -fsSL https://raw.githubusercontent.com/pbrennan10-stack/goevwv/main/scripts/bootstrap.sh | bash
#
# Safe to re-run: all steps are idempotent.

set -euo pipefail

# -----------------------------------------------------------
# Config
# -----------------------------------------------------------
REPO_URL="https://github.com/pbrennan10-stack/goevwv.git"
APP_DIR="/opt/goevwv"
EXPECTED_OS_VERSION="24.04"

# -----------------------------------------------------------
# Helpers
# -----------------------------------------------------------
log()  { printf "\n\033[1;36m[bootstrap]\033[0m %s\n" "$*"; }
warn() { printf "\n\033[1;33m[warn]\033[0m %s\n" "$*"; }
die()  { printf "\n\033[1;31m[error]\033[0m %s\n" "$*" >&2; exit 1; }

# -----------------------------------------------------------
# Preflight
# -----------------------------------------------------------
[[ $EUID -eq 0 ]] || die "Run as root (use: sudo bash) — got UID $EUID"

if command -v lsb_release >/dev/null 2>&1; then
  os_ver="$(lsb_release -rs)"
  [[ "$os_ver" == "$EXPECTED_OS_VERSION" ]] \
    || warn "Expected Ubuntu $EXPECTED_OS_VERSION, found $os_ver. Proceeding anyway."
fi

export DEBIAN_FRONTEND=noninteractive

# -----------------------------------------------------------
# 1. System update
# -----------------------------------------------------------
log "Updating apt cache and installing base packages..."
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg lsb-release \
  ufw fail2ban unattended-upgrades \
  git nano htop ncdu

# -----------------------------------------------------------
# 2. Automatic security updates
# -----------------------------------------------------------
log "Enabling unattended security updates..."
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'APT'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
APT
dpkg-reconfigure -f noninteractive unattended-upgrades

# -----------------------------------------------------------
# 3. UFW firewall (SSH + HTTP + HTTPS only)
# -----------------------------------------------------------
log "Configuring UFW firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment 'SSH'
ufw allow 80/tcp   comment 'HTTP (Caddy)'
ufw allow 443/tcp  comment 'HTTPS (Caddy)'
ufw allow 443/udp  comment 'HTTP/3 (Caddy)'
ufw --force enable

# -----------------------------------------------------------
# 4. fail2ban (SSH brute-force protection)
# -----------------------------------------------------------
log "Enabling fail2ban..."
cat >/etc/fail2ban/jail.d/sshd.local <<'F2B'
[sshd]
enabled = true
port    = ssh
backend = systemd
maxretry = 4
findtime = 10m
bantime  = 1h
F2B
systemctl enable --now fail2ban

# -----------------------------------------------------------
# 5. Docker + Docker Compose plugin
# -----------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker Engine..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  log "Docker already installed: $(docker --version)"
fi

# -----------------------------------------------------------
# 6. Clone (or update) the goevwv repo
# -----------------------------------------------------------
if [[ -d "$APP_DIR/.git" ]]; then
  log "Updating existing goevwv checkout at $APP_DIR..."
  git -C "$APP_DIR" fetch --all
  git -C "$APP_DIR" reset --hard origin/main
else
  log "Cloning goevwv repo to $APP_DIR..."
  git clone "$REPO_URL" "$APP_DIR"
fi

# -----------------------------------------------------------
# 7. Launch the stack
# -----------------------------------------------------------
log "Starting goevwv stack..."
cd "$APP_DIR"
docker compose pull --ignore-pull-failures
docker compose up -d --remove-orphans

# -----------------------------------------------------------
# 8. SSH hardening (disable password auth once key works)
# -----------------------------------------------------------
log "Hardening SSH (disabling password auth)..."
# Only flip the switch if an authorized key is already present
if [[ -s /root/.ssh/authorized_keys ]]; then
  sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
  sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
  systemctl reload ssh || systemctl reload sshd || true
else
  warn "No /root/.ssh/authorized_keys found — leaving password auth enabled."
  warn "Add your SSH key before re-running this script or manually hardening."
fi

# -----------------------------------------------------------
# 9. Status
# -----------------------------------------------------------
log "Bootstrap complete."
echo
echo "  Docker containers:"
docker compose -f "$APP_DIR/docker-compose.yml" ps
echo
echo "  Firewall:"
ufw status verbose
echo
echo "Next steps:"
echo "  1. Point goevwv.com DNS (A record) at this droplet's public IP."
echo "  2. Wait 1-5 minutes for DNS + first Let's Encrypt cert issuance."
echo "  3. Visit https://goevwv.com — Caddy will auto-redirect HTTP to HTTPS."
echo
