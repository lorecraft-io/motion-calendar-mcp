#!/bin/bash
# ============================================================
# MOTION CALENDAR MCP — INSTALLER
# ============================================================
# Installs motion-calendar-mcp as a Claude Code MCP server,
# collects credentials, writes .env, and verifies the setup.
#
# USAGE:
#   curl -fsSL <raw-url> | bash
#   — or —
#   chmod +x install.sh && ./install.sh
#
# IDEMPOTENT: Safe to re-run. Detects existing installs and
# prompts before overwriting.
# ============================================================

set -euo pipefail

# ── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ── Output helpers ──────────────────────────────────────────
info()    { echo -e "${BLUE}[INFO]${NC}    $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}    $1"; }
fail()    { echo -e "${RED}[FAIL]${NC}    $1"; exit 1; }
step()    { echo -e "\n${CYAN}${BOLD}── Step $1: $2 ──${NC}"; }

# ── Config ──────────────────────────────────────────────────
ENV_DIR="$HOME/.motion-calendar-mcp"
ENV_FILE="$ENV_DIR/.env"
MCP_NAME="motion-calendar"
NPX_CMD="npx -y motion-calendar-mcp"

# ── Banner ──────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   ${CYAN}Motion Calendar MCP${NC}${BOLD} — Installer                    ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
echo -e "  ${DIM}Full calendar access for Claude Code via Motion API${NC}"
echo ""

# ============================================================
# STEP 1: Check prerequisites
# ============================================================
step "1" "Checking prerequisites"

# -- Node.js --
if command -v node &>/dev/null; then
  NODE_VERSION=$(node --version)
  success "Node.js found: $NODE_VERSION"

  # Check minimum version (18+)
  NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_MAJOR" -lt 18 ]; then
    fail "Node.js 18+ required (found $NODE_VERSION). Update at https://nodejs.org"
  fi
else
  fail "Node.js not found. Install it from https://nodejs.org (v18+ required)"
fi

# -- npm --
if command -v npm &>/dev/null; then
  NPM_VERSION=$(npm --version)
  success "npm found: v$NPM_VERSION"
else
  fail "npm not found. It should come with Node.js — reinstall from https://nodejs.org"
fi

# -- npx --
if command -v npx &>/dev/null; then
  success "npx found"
else
  fail "npx not found. It should come with npm — try: npm install -g npx"
fi

# -- Claude Code --
if command -v claude &>/dev/null; then
  success "Claude Code CLI found"
else
  warn "Claude Code CLI not found in PATH"
  echo -e "  ${DIM}Install it from: https://docs.anthropic.com/en/docs/claude-code${NC}"
  echo -e "  ${DIM}If it's installed but not in PATH, you can continue — the MCP will${NC}"
  echo -e "  ${DIM}still work if you add it manually to your Claude config.${NC}"
  echo ""
  read -p "Continue anyway? (y/N): " CONTINUE_ANYWAY
  if [[ ! "$CONTINUE_ANYWAY" =~ ^[Yy]$ ]]; then
    echo ""
    info "Install Claude Code first, then re-run this script."
    exit 0
  fi
fi

# ============================================================
# STEP 2: Check for existing installation
# ============================================================
step "2" "Checking for existing installation"

ALREADY_INSTALLED=false

if [ -f "$ENV_FILE" ]; then
  ALREADY_INSTALLED=true
  warn "Existing installation detected at $ENV_DIR"
  echo ""
  read -p "Overwrite existing configuration? (y/N): " OVERWRITE
  if [[ ! "$OVERWRITE" =~ ^[Yy]$ ]]; then
    echo ""
    info "Keeping existing configuration. Skipping to verification..."
    # Jump ahead — skip credential collection and MCP registration
    SKIP_SETUP=true
  else
    SKIP_SETUP=false
  fi
else
  SKIP_SETUP=false
  info "No existing installation found. Starting fresh setup."
fi

# ============================================================
# STEP 3: Register MCP with Claude Code
# ============================================================
step "3" "Registering MCP with Claude Code"

if command -v claude &>/dev/null; then
  # Check if already registered
  MCP_EXISTS=$(claude mcp list 2>/dev/null | grep -c "$MCP_NAME" || true)

  if [ "$MCP_EXISTS" -gt 0 ] && [ "$SKIP_SETUP" = true ]; then
    success "MCP already registered: $MCP_NAME"
  else
    info "Registering MCP server: $MCP_NAME"
    if claude mcp add --scope user "$MCP_NAME" -- $NPX_CMD 2>/dev/null; then
      success "MCP registered: $MCP_NAME"
    else
      warn "MCP registration returned non-zero — it may already exist."
      info "You can verify with: claude mcp list"
    fi
  fi
else
  warn "Skipping MCP registration (Claude CLI not available)"
  echo -e "  ${DIM}Run this manually later:${NC}"
  echo -e "  ${DIM}  claude mcp add --scope user $MCP_NAME -- $NPX_CMD${NC}"
fi

# ============================================================
# STEP 4: Collect credentials (unless skipping)
# ============================================================
if [ "$SKIP_SETUP" = false ]; then

step "4" "Collecting credentials"

echo ""
echo -e "${BOLD}You'll need 4 credentials from Motion.${NC}"
echo -e "${DIM}Follow the instructions below to find each one.${NC}"
echo ""

# -- Motion API Key --
echo -e "${YELLOW}1. Motion API Key${NC}"
echo -e "   ${DIM}Get this from: Motion Settings > API${NC}"
echo -e "   ${DIM}(Or visit: https://app.usemotion.com/settings/api)${NC}"
echo ""
read -sp "   Enter your Motion API key: " MOTION_API_KEY
echo -e " ${GREEN}[saved]${NC}"
echo ""

if [ -z "$MOTION_API_KEY" ]; then
  fail "Motion API key is required."
fi

# -- Firebase API Key --
echo -e "${YELLOW}2. Firebase API Key${NC}"
echo -e "   ${DIM}Found in browser DevTools network requests at app.usemotion.com${NC}"
echo -e "   ${DIM}Look for requests to securetoken.googleapis.com — the key= param${NC}"
echo -e "   ${DIM}Starts with: AIza...${NC}"
echo ""
read -sp "   Enter your Firebase API key: " FIREBASE_API_KEY
echo -e " ${GREEN}[saved]${NC}"
echo ""

if [ -z "$FIREBASE_API_KEY" ]; then
  fail "Firebase API key is required."
fi

# -- Firebase Refresh Token --
echo -e "${YELLOW}3. Firebase Refresh Token${NC}"
echo -e "   ${DIM}Found in browser DevTools > Application > IndexedDB${NC}"
echo -e "   ${DIM}Database: firebaseLocalStorageDb${NC}"
echo -e "   ${DIM}Look for: stsTokenManager.refreshToken${NC}"
echo ""
read -sp "   Enter your Firebase refresh token: " FIREBASE_REFRESH_TOKEN
echo -e " ${GREEN}[saved]${NC}"
echo ""

if [ -z "$FIREBASE_REFRESH_TOKEN" ]; then
  fail "Firebase refresh token is required."
fi

# -- Motion User ID --
echo -e "${YELLOW}4. Motion User ID${NC}"
echo -e "   ${DIM}Found in the same IndexedDB entry as the refresh token${NC}"
echo -e "   ${DIM}Look for the uid field${NC}"
echo ""
read -p "   Enter your Motion user ID: " MOTION_USER_ID
echo ""

if [ -z "$MOTION_USER_ID" ]; then
  fail "Motion user ID is required."
fi

# -- Timezone --
echo -e "${YELLOW}5. Timezone (optional)${NC}"
DETECTED_TZ=$(readlink /etc/localtime 2>/dev/null | sed 's|.*/zoneinfo/||' || echo "")
if [ -n "$DETECTED_TZ" ]; then
  echo -e "   ${DIM}Detected system timezone: $DETECTED_TZ${NC}"
  DEFAULT_TZ="$DETECTED_TZ"
else
  DEFAULT_TZ="America/New_York"
fi
echo -e "   ${DIM}Default: $DEFAULT_TZ${NC}"
echo ""
read -p "   Enter your timezone [$DEFAULT_TZ]: " MOTION_TIMEZONE
MOTION_TIMEZONE="${MOTION_TIMEZONE:-$DEFAULT_TZ}"
echo ""

# ============================================================
# STEP 5: Write .env file
# ============================================================
step "5" "Writing configuration"

mkdir -p "$ENV_DIR"

cat > "$ENV_FILE" << ENVEOF
# Motion Calendar MCP Configuration
# Generated by install.sh on $(date '+%Y-%m-%d %H:%M:%S')
# Location: $ENV_FILE

MOTION_API_KEY=$MOTION_API_KEY
FIREBASE_API_KEY=$FIREBASE_API_KEY
FIREBASE_REFRESH_TOKEN=$FIREBASE_REFRESH_TOKEN
MOTION_USER_ID=$MOTION_USER_ID
MOTION_TIMEZONE=$MOTION_TIMEZONE
ENVEOF

chmod 600 "$ENV_FILE"
success "Configuration written to: $ENV_FILE"
success "File permissions set to 600 (owner read/write only)"

# ============================================================
# STEP 6: Update MCP config to use .env location
# ============================================================
step "6" "Configuring MCP environment"

if command -v claude &>/dev/null; then
  # Remove and re-add with env file path
  claude mcp remove "$MCP_NAME" --scope user 2>/dev/null || true
  if claude mcp add --scope user "$MCP_NAME" \
    -e "DOTENV_CONFIG_PATH=$ENV_FILE" \
    -- $NPX_CMD 2>/dev/null; then
    success "MCP configured with .env path"
  else
    warn "Could not update MCP config with env path."
    echo -e "  ${DIM}The MCP server will look for .env in its package directory by default.${NC}"
    echo -e "  ${DIM}You may need to set DOTENV_CONFIG_PATH=$ENV_FILE manually.${NC}"
  fi
fi

else
  # SKIP_SETUP=true — we skipped credential collection
  info "Skipped credential collection (using existing config)"
fi

# ============================================================
# STEP 7: Verification
# ============================================================
step "7" "Verifying installation"

VERIFY_PASSED=true

# Check .env exists and is readable
if [ -f "$ENV_FILE" ]; then
  success ".env file exists at $ENV_FILE"
else
  warn ".env file not found — configuration may be incomplete"
  VERIFY_PASSED=false
fi

# Check .env has all required keys
if [ -f "$ENV_FILE" ]; then
  MISSING_KEYS=()
  for KEY in MOTION_API_KEY FIREBASE_API_KEY FIREBASE_REFRESH_TOKEN MOTION_USER_ID; do
    if ! grep -q "^${KEY}=.\+" "$ENV_FILE" 2>/dev/null; then
      MISSING_KEYS+=("$KEY")
    fi
  done

  if [ ${#MISSING_KEYS[@]} -eq 0 ]; then
    success "All required credentials present in .env"
  else
    warn "Missing credentials: ${MISSING_KEYS[*]}"
    VERIFY_PASSED=false
  fi
fi

# Check MCP registration
if command -v claude &>/dev/null; then
  MCP_COUNT=$(claude mcp list 2>/dev/null | grep -c "$MCP_NAME" || true)
  if [ "$MCP_COUNT" -gt 0 ]; then
    success "MCP server registered in Claude Code"
  else
    warn "MCP server not found in Claude Code config"
    VERIFY_PASSED=false
  fi
fi

# Quick API test — try a token refresh to validate Firebase credentials
if [ -f "$ENV_FILE" ]; then
  info "Testing API credentials (token refresh)..."

  # Source the env file to get values
  source "$ENV_FILE"

  TOKEN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "https://securetoken.googleapis.com/v1/token?key=$FIREBASE_API_KEY" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -H "Referer: https://app.usemotion.com/" \
    -H "Origin: https://app.usemotion.com" \
    -d "grant_type=refresh_token&refresh_token=$FIREBASE_REFRESH_TOKEN" \
    2>/dev/null || echo "000")

  HTTP_CODE=$(echo "$TOKEN_RESPONSE" | tail -1)
  RESPONSE_BODY=$(echo "$TOKEN_RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "200" ]; then
    success "Firebase token refresh succeeded — credentials are valid"

    # Try to list calendars with the fresh token
    ID_TOKEN=$(echo "$RESPONSE_BODY" | grep -o '"id_token":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$ID_TOKEN" ]; then
      info "Testing calendar access..."
      CAL_RESPONSE=$(curl -s -w "\n%{http_code}" \
        "https://internal.usemotion.com/calendars?userId=$MOTION_USER_ID" \
        -H "Authorization: Bearer $ID_TOKEN" \
        -H "Accept: application/json" \
        -H "x-motion-client: webapp" \
        2>/dev/null || echo "000")

      CAL_HTTP=$(echo "$CAL_RESPONSE" | tail -1)

      if [ "$CAL_HTTP" = "200" ]; then
        success "Calendar API access confirmed"
      else
        warn "Calendar API returned HTTP $CAL_HTTP — check MOTION_USER_ID"
        VERIFY_PASSED=false
      fi
    fi
  elif [ "$HTTP_CODE" = "400" ]; then
    warn "Firebase token refresh failed (HTTP 400) — check FIREBASE_API_KEY and FIREBASE_REFRESH_TOKEN"
    VERIFY_PASSED=false
  elif [ "$HTTP_CODE" = "000" ]; then
    warn "Could not reach Firebase API — check your internet connection"
    VERIFY_PASSED=false
  else
    warn "Firebase token refresh returned HTTP $HTTP_CODE"
    VERIFY_PASSED=false
  fi
fi

# ============================================================
# Summary
# ============================================================
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
if [ "$VERIFY_PASSED" = true ]; then
echo -e "${BOLD}║   ${GREEN}Installation Complete${NC}${BOLD}                               ║${NC}"
else
echo -e "${BOLD}║   ${YELLOW}Installation Complete (with warnings)${NC}${BOLD}               ║${NC}"
fi
echo -e "${BOLD}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}║${NC}                                                      ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}  MCP Name:    ${CYAN}$MCP_NAME${NC}                        ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}  Config:      ${DIM}$ENV_FILE${NC}    ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}  Command:     ${DIM}$NPX_CMD${NC}          ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}                                                      ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}  ${DIM}Restart Claude Code for the MCP to take effect.${NC}     ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}                                                      ${BOLD}║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$VERIFY_PASSED" = false ]; then
  echo -e "${YELLOW}Some checks failed. Review the warnings above.${NC}"
  echo -e "${DIM}You can re-run this script at any time to reconfigure.${NC}"
  echo ""
fi

echo -e "${DIM}Troubleshooting:${NC}"
echo -e "${DIM}  - Re-run this script to reconfigure credentials${NC}"
echo -e "${DIM}  - Check MCP status:  claude mcp list${NC}"
echo -e "${DIM}  - View config:       cat $ENV_FILE${NC}"
echo -e "${DIM}  - Remove MCP:        claude mcp remove $MCP_NAME --scope user${NC}"
echo ""
