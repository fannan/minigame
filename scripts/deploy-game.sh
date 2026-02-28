#!/bin/bash
# USAGE: deploy-game.sh <game-dir> <date> [--account-id ID] [--bucket BUCKET] [--kv-namespace-id ID]
#
# Deploys a game bundle to R2 and updates the KV game schedule.
#
# Arguments:
#   game-dir        Path to game directory (e.g., games/tap-race)
#   date            Target date in YYYY-MM-DD format
#   --account-id    Cloudflare account ID (or CLOUDFLARE_ACCOUNT_ID env)
#   --bucket        R2 bucket name (default: minigame-bundles)
#   --kv-namespace-id  KV namespace ID (or CLOUDFLARE_KV_NAMESPACE_ID env)
#
# Steps:
# 1. Validate game directory has manifest.json and index.html
# 2. Read manifest.json for metadata
# 3. Calculate SHA-256 of all files in bundle
# 4. Upload all files to R2 under games/{date}/ prefix
# 5. Update KV schedule entry for the date with manifest + bundle URL + sha256
# 6. Print success summary

set -euo pipefail

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------
usage() {
  cat <<'USAGE'
Usage: deploy-game.sh <game-dir> <date> [options]

Arguments:
  game-dir              Path to game directory (e.g., games/tap-race)
  date                  Target date in YYYY-MM-DD format

Options:
  --account-id ID       Cloudflare account ID (default: $CLOUDFLARE_ACCOUNT_ID)
  --bucket BUCKET       R2 bucket name (default: minigame-bundles)
  --kv-namespace-id ID  KV namespace ID (default: $CLOUDFLARE_KV_NAMESPACE_ID)
  -h, --help            Show this help message
USAGE
  exit 1
}

# ---------------------------------------------------------------------------
# Dependency check
# ---------------------------------------------------------------------------
check_dependencies() {
  local missing=()
  for cmd in wrangler jq shasum; do
    if ! command -v "$cmd" &>/dev/null; then
      missing+=("$cmd")
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    error "Missing required commands: ${missing[*]}"
    echo "  Install wrangler:  npm install -g wrangler"
    echo "  Install jq:        brew install jq"
    echo "  shasum is typically pre-installed on macOS/Linux"
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
GAME_DIR=""
DATE=""
ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"
BUCKET="minigame-bundles"
KV_NAMESPACE_ID="${CLOUDFLARE_KV_NAMESPACE_ID:-}"

parse_args() {
  # Handle --help anywhere in args
  for arg in "$@"; do
    case "$arg" in -h|--help) usage ;; esac
  done

  if [[ $# -lt 2 ]]; then
    usage
  fi

  GAME_DIR="$1"; shift
  DATE="$1"; shift

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --account-id)
        [[ $# -lt 2 ]] && { error "--account-id requires a value"; exit 1; }
        ACCOUNT_ID="$2"; shift 2
        ;;
      --bucket)
        [[ $# -lt 2 ]] && { error "--bucket requires a value"; exit 1; }
        BUCKET="$2"; shift 2
        ;;
      --kv-namespace-id)
        [[ $# -lt 2 ]] && { error "--kv-namespace-id requires a value"; exit 1; }
        KV_NAMESPACE_ID="$2"; shift 2
        ;;
      *)
        error "Unknown option: $1"
        usage
        ;;
    esac
  done
}

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
validate_inputs() {
  # Game directory
  if [[ ! -d "$GAME_DIR" ]]; then
    error "Game directory not found: $GAME_DIR"
    exit 1
  fi

  if [[ ! -f "$GAME_DIR/manifest.json" ]]; then
    error "Missing manifest.json in $GAME_DIR"
    exit 1
  fi

  if [[ ! -f "$GAME_DIR/index.html" ]]; then
    error "Missing index.html in $GAME_DIR"
    exit 1
  fi

  # Date format
  if ! echo "$DATE" | grep -qE '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'; then
    error "Invalid date format: $DATE (expected YYYY-MM-DD)"
    exit 1
  fi

  # Account ID
  if [[ -z "$ACCOUNT_ID" ]]; then
    error "Cloudflare account ID required. Use --account-id or set CLOUDFLARE_ACCOUNT_ID"
    exit 1
  fi

  # KV namespace ID
  if [[ -z "$KV_NAMESPACE_ID" ]]; then
    error "KV namespace ID required. Use --kv-namespace-id or set CLOUDFLARE_KV_NAMESPACE_ID"
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Calculate SHA-256 of all bundle files
# ---------------------------------------------------------------------------
calculate_bundle_hash() {
  local dir="$1"
  # Hash all files in the directory (sorted for determinism), then hash the combined output
  find "$dir" -type f | sort | xargs shasum -a 256 | shasum -a 256 | cut -d' ' -f1
}

# ---------------------------------------------------------------------------
# Upload files to R2
# ---------------------------------------------------------------------------
upload_to_r2() {
  local dir="$1"
  local prefix="$2"
  local uploaded=0
  local failed=0

  info "Uploading files to R2 bucket '${BUCKET}' under prefix '${prefix}'..."

  while IFS= read -r filepath; do
    # Get path relative to game dir
    local relative="${filepath#${dir}/}"
    local r2_key="${prefix}/${relative}"

    # Determine content type
    local content_type="application/octet-stream"
    case "${filepath##*.}" in
      html) content_type="text/html" ;;
      js)   content_type="application/javascript" ;;
      css)  content_type="text/css" ;;
      json) content_type="application/json" ;;
      png)  content_type="image/png" ;;
      jpg|jpeg) content_type="image/jpeg" ;;
      svg)  content_type="image/svg+xml" ;;
      woff2) content_type="font/woff2" ;;
      woff) content_type="font/woff" ;;
      mp3)  content_type="audio/mpeg" ;;
      ogg)  content_type="audio/ogg" ;;
      wav)  content_type="audio/wav" ;;
    esac

    if wrangler r2 object put "${BUCKET}/${r2_key}" \
        --file="$filepath" \
        --content-type="$content_type" 2>/dev/null; then
      success "  ${relative} -> ${r2_key}"
      uploaded=$((uploaded + 1))
    else
      error "  Failed to upload: ${relative}"
      failed=$((failed + 1))
    fi
  done < <(find "$dir" -type f | sort)

  if [[ $failed -gt 0 ]]; then
    error "$failed file(s) failed to upload"
    exit 1
  fi

  info "Uploaded $uploaded file(s) to R2"
}

# ---------------------------------------------------------------------------
# Update KV schedule
# ---------------------------------------------------------------------------
update_kv_schedule() {
  local manifest="$1"
  local bundle_hash="$2"
  local r2_prefix="$3"

  # Build the KV value from manifest + deployment metadata
  local game_id game_title description version duration min_players max_players xp_reward

  game_id=$(jq -r '.id' "$manifest")
  game_title=$(jq -r '.title' "$manifest")
  description=$(jq -r '.description // ""' "$manifest")
  version=$(jq -r '.version // "1.0.0"' "$manifest")
  duration=$(jq -r '.duration // 60' "$manifest")
  min_players=$(jq -r '.minPlayers // 1' "$manifest")
  max_players=$(jq -r '.maxPlayers // 4' "$manifest")
  xp_reward=$(jq -r '.xpReward // 50' "$manifest")

  local kv_value
  kv_value=$(jq -n \
    --arg id "$game_id" \
    --arg title "$game_title" \
    --arg description "$description" \
    --arg version "$version" \
    --argjson duration "$duration" \
    --argjson minPlayers "$min_players" \
    --argjson maxPlayers "$max_players" \
    --argjson xpReward "$xp_reward" \
    --arg date "$DATE" \
    --arg bundleUrl "games/${DATE}/" \
    --arg sha256 "$bundle_hash" \
    --arg deployedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{
      gameId: $id,
      title: $title,
      description: $description,
      version: $version,
      duration: $duration,
      minPlayers: $minPlayers,
      maxPlayers: $maxPlayers,
      xpReward: $xpReward,
      date: $date,
      bundleUrl: $bundleUrl,
      sha256: $sha256,
      deployedAt: $deployedAt
    }')

  info "Updating KV schedule for date: ${DATE}"

  if echo "$kv_value" | wrangler kv key put "schedule:${DATE}" \
      --namespace-id="$KV_NAMESPACE_ID" \
      --stdin; then
    success "KV schedule updated for ${DATE}"
  else
    error "Failed to update KV schedule"
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Print summary
# ---------------------------------------------------------------------------
print_summary() {
  local manifest="$1"
  local bundle_hash="$2"
  local file_count="$3"

  local game_id game_title version
  game_id=$(jq -r '.id' "$manifest")
  game_title=$(jq -r '.title' "$manifest")
  version=$(jq -r '.version // "1.0.0"' "$manifest")

  echo ""
  echo -e "${BOLD}============================================${NC}"
  echo -e "${GREEN}${BOLD}  Deployment Complete${NC}"
  echo -e "${BOLD}============================================${NC}"
  echo ""
  echo -e "  ${BOLD}Game:${NC}       ${game_title} (${game_id})"
  echo -e "  ${BOLD}Version:${NC}    ${version}"
  echo -e "  ${BOLD}Date:${NC}       ${DATE}"
  echo -e "  ${BOLD}Files:${NC}      ${file_count} uploaded"
  echo -e "  ${BOLD}Bundle:${NC}     ${BUCKET}/games/${DATE}/"
  echo -e "  ${BOLD}SHA-256:${NC}    ${bundle_hash}"
  echo -e "  ${BOLD}KV Key:${NC}     schedule:${DATE}"
  echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  check_dependencies
  parse_args "$@"
  validate_inputs

  local manifest="${GAME_DIR}/manifest.json"

  # Read manifest for display
  local game_title
  game_title=$(jq -r '.title' "$manifest")
  info "Deploying ${BOLD}${game_title}${NC} for ${BOLD}${DATE}${NC}"

  # Calculate bundle hash
  info "Calculating bundle SHA-256..."
  local bundle_hash
  bundle_hash=$(calculate_bundle_hash "$GAME_DIR")
  success "Bundle hash: ${bundle_hash}"

  # Count files
  local file_count
  file_count=$(find "$GAME_DIR" -type f | wc -l | tr -d ' ')

  # Upload to R2
  local r2_prefix="games/${DATE}"
  upload_to_r2 "$GAME_DIR" "$r2_prefix"

  # Update KV schedule
  update_kv_schedule "$manifest" "$bundle_hash" "$r2_prefix"

  # Summary
  print_summary "$manifest" "$bundle_hash" "$file_count"
}

main "$@"
