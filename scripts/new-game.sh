#!/bin/bash
# USAGE: new-game.sh <game-name> [--title TITLE] [--duration SECONDS] [--players MIN-MAX]
#
# Creates a new game by copying the template.
#
# Arguments:
#   game-name       kebab-case name for the game (e.g., word-scramble)
#   --title         Display title (default: derived from game-name)
#   --duration      Game duration in seconds (default: 60)
#   --players       Player range as MIN-MAX (default: 1-4)
#
# Creates games/<game-name>/ with:
#   manifest.json (customized)
#   index.html
#   game.js (template with TODO markers)
#   style.css

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
Usage: new-game.sh <game-name> [options]

Arguments:
  game-name              kebab-case name (e.g., word-scramble)

Options:
  --title TITLE          Display title (default: derived from game-name)
  --duration SECONDS     Game duration in seconds (default: 60)
  --players MIN-MAX      Player range (default: 1-4)
  -h, --help             Show this help message

Examples:
  new-game.sh word-scramble
  new-game.sh color-match --title "Color Match!" --duration 45 --players 2-6
USAGE
  exit 1
}

# ---------------------------------------------------------------------------
# Resolve project root (directory containing games/)
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEMPLATE_DIR="${PROJECT_ROOT}/games/_template"
GAMES_DIR="${PROJECT_ROOT}/games"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Convert kebab-case to Title Case: "word-scramble" -> "Word Scramble"
kebab_to_title() {
  echo "$1" | tr '-' ' ' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1'
}

# Generate a UUID v4
generate_uuid() {
  if command -v uuidgen &>/dev/null; then
    uuidgen | tr '[:upper:]' '[:lower:]'
  else
    # Fallback: generate from /dev/urandom
    od -x /dev/urandom | head -1 | awk '{
      printf "%s%s-%s-4%s-%s-%s%s%s\n",
        $2,$3, $4, substr($5,2),
        sprintf("%x", (strtonum("0x" substr($6,1,1)) % 4) + 8) substr($6,2) ,
        $7,$8,$9
    }'
  fi
}

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
GAME_NAME=""
TITLE=""
DURATION=60
MIN_PLAYERS=1
MAX_PLAYERS=4

parse_args() {
  # Handle --help anywhere in args
  for arg in "$@"; do
    case "$arg" in -h|--help) usage ;; esac
  done

  if [[ $# -lt 1 ]]; then
    usage
  fi

  GAME_NAME="$1"; shift

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --title)
        [[ $# -lt 2 ]] && { error "--title requires a value"; exit 1; }
        TITLE="$2"; shift 2
        ;;
      --duration)
        [[ $# -lt 2 ]] && { error "--duration requires a value"; exit 1; }
        DURATION="$2"; shift 2
        ;;
      --players)
        [[ $# -lt 2 ]] && { error "--players requires a value"; exit 1; }
        if ! echo "$2" | grep -qE '^[0-9]+-[0-9]+$'; then
          error "Invalid player range: $2 (expected MIN-MAX, e.g., 1-4)"
          exit 1
        fi
        MIN_PLAYERS="${2%-*}"
        MAX_PLAYERS="${2#*-}"
        shift 2
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
  # Validate game name is kebab-case
  if ! echo "$GAME_NAME" | grep -qE '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'; then
    error "Game name must be kebab-case (e.g., word-scramble)"
    error "  Got: $GAME_NAME"
    exit 1
  fi

  # Check template exists
  if [[ ! -d "$TEMPLATE_DIR" ]]; then
    error "Template directory not found: $TEMPLATE_DIR"
    exit 1
  fi

  # Check game doesn't already exist
  local game_dir="${GAMES_DIR}/${GAME_NAME}"
  if [[ -d "$game_dir" ]]; then
    error "Game directory already exists: $game_dir"
    exit 1
  fi

  # Validate duration is a positive integer
  if ! [[ "$DURATION" =~ ^[0-9]+$ ]] || [[ "$DURATION" -le 0 ]]; then
    error "Duration must be a positive integer (got: $DURATION)"
    exit 1
  fi

  # Validate player range
  if [[ "$MIN_PLAYERS" -gt "$MAX_PLAYERS" ]]; then
    error "Min players ($MIN_PLAYERS) cannot exceed max players ($MAX_PLAYERS)"
    exit 1
  fi

  # Default title from game name
  if [[ -z "$TITLE" ]]; then
    TITLE="$(kebab_to_title "$GAME_NAME")"
  fi
}

# ---------------------------------------------------------------------------
# Scaffold the game
# ---------------------------------------------------------------------------
scaffold_game() {
  local game_dir="${GAMES_DIR}/${GAME_NAME}"
  local game_id
  game_id="$(generate_uuid)"

  info "Creating game directory: ${game_dir}"
  mkdir -p "$game_dir"

  # --- manifest.json ---
  info "Writing manifest.json..."
  cat > "${game_dir}/manifest.json" <<EOF
{
  "id": "${game_id}",
  "title": "${TITLE}",
  "description": "",
  "version": "1.0.0",
  "minPlayers": ${MIN_PLAYERS},
  "maxPlayers": ${MAX_PLAYERS},
  "duration": ${DURATION},
  "xpReward": 50,
  "engine": "phaser",
  "engineVersion": "3.80.1"
}
EOF
  success "manifest.json"

  # --- style.css (copy from template) ---
  if [[ -f "${TEMPLATE_DIR}/style.css" ]]; then
    info "Copying style.css from template..."
    cp "${TEMPLATE_DIR}/style.css" "${game_dir}/style.css"
    success "style.css"
  else
    warn "No style.css in template; creating default"
    cat > "${game_dir}/style.css" <<'EOF'
/* Minigame - Fullscreen canvas styles */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #000000;
  touch-action: none;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

#game-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

#game-container canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
EOF
    success "style.css"
  fi

  # --- index.html ---
  info "Writing index.html..."
  cat > "${game_dir}/index.html" <<EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${TITLE}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="game-container"></div>
  <script src="../shared/bridge.js"></script>
  <script src="game.js"></script>
</body>
</html>
EOF
  success "index.html"

  # --- game.js ---
  info "Writing game.js..."
  cat > "${game_dir}/game.js" <<'GAMEJS'
// =============================================================================
// TODO: Game Implementation
// =============================================================================
//
// This is the main game file. The Phaser game instance and all scenes go here.
//
// Available APIs:
//   GameBridge.on(event, callback)  - Listen for native events
//   GameBridge.haptic(style)        - Trigger haptic feedback ('light'|'medium'|'heavy')
//   GameBridge.playSound(name)      - Play a sound asset
//   GameBridge.submitScore(score)   - Submit score during gameplay
//   GameBridge.gameOver(result)     - Signal game end with final results
//   GameBridge.sendMove(data)       - Send move to other players (multiplayer)
//
// Events from native:
//   'connected'     - { playerId }
//   'playerJoined'  - { playerId, displayName }
//   'playerLeft'    - { playerId }
//   'moveReceived'  - { playerId, data }
//   'countdown'     - { seconds }
//
// =============================================================================

// TODO: Configure your Phaser game settings
const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: {
      // TODO: Adjust gravity if needed
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: {
    preload: preload,
    create: create,
    update: update,
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

const game = new Phaser.Game(config);

// Game state
let score = 0;
let timeRemaining = 0;
let isGameActive = false;

// TODO: Add your game-specific state variables here

function preload() {
  // TODO: Load your assets
  // this.load.image('key', 'assets/image.png');
  // this.load.audio('key', 'assets/sound.mp3');
  // this.load.spritesheet('key', 'assets/sheet.png', { frameWidth: 64, frameHeight: 64 });
}

function create() {
  const scene = this;

  // TODO: Set up your game scene
  // - Create game objects
  // - Set up physics
  // - Add input handlers

  // Example: Display a placeholder message
  scene.add.text(
    config.width / 2,
    config.height / 2,
    'Game Ready!\nTap to start',
    {
      fontSize: '32px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#ffffff',
      align: 'center',
    }
  ).setOrigin(0.5);

  // Listen for game start from native
  GameBridge.on('countdown', (data) => {
    timeRemaining = data.seconds;
    // TODO: Show countdown UI
  });

  GameBridge.on('connected', (data) => {
    // TODO: Handle player connected
    console.log('Player connected:', data.playerId);
  });

  // TODO: Start the game timer
  // scene.time.addEvent({
  //   delay: 1000,
  //   callback: onTimerTick,
  //   callbackScope: scene,
  //   loop: true,
  // });
}

function update(time, delta) {
  if (!isGameActive) return;

  // TODO: Game loop logic
  // - Update positions
  // - Check collisions
  // - Update score display
}

// TODO: Implement your game-over logic
function endGame() {
  isGameActive = false;

  GameBridge.haptic('success');
  GameBridge.gameOver({
    score: score,
    placement: 1, // TODO: Calculate from leaderboard
    data: {
      // TODO: Add game-specific result data
    },
  });
}
GAMEJS
  success "game.js"
}

# ---------------------------------------------------------------------------
# Print next steps
# ---------------------------------------------------------------------------
print_next_steps() {
  local game_dir="${GAMES_DIR}/${GAME_NAME}"

  echo ""
  echo -e "${BOLD}============================================${NC}"
  echo -e "${GREEN}${BOLD}  Game Scaffolded Successfully${NC}"
  echo -e "${BOLD}============================================${NC}"
  echo ""
  echo -e "  ${BOLD}Name:${NC}      ${GAME_NAME}"
  echo -e "  ${BOLD}Title:${NC}     ${TITLE}"
  echo -e "  ${BOLD}Duration:${NC}  ${DURATION}s"
  echo -e "  ${BOLD}Players:${NC}   ${MIN_PLAYERS}-${MAX_PLAYERS}"
  echo -e "  ${BOLD}Location:${NC}  ${game_dir}"
  echo ""
  echo -e "${BOLD}Files created:${NC}"
  echo "  manifest.json  - Game metadata and configuration"
  echo "  index.html     - Entry point loaded by the WebView"
  echo "  game.js        - Main game logic (edit this!)"
  echo "  style.css      - Fullscreen canvas styles"
  echo ""
  echo -e "${BOLD}Next steps:${NC}"
  echo -e "  1. Edit ${BOLD}game.js${NC} - implement preload(), create(), and update()"
  echo -e "  2. Add assets to ${BOLD}${game_dir}/assets/${NC} if needed"
  echo -e "  3. Update ${BOLD}manifest.json${NC} description and xpReward"
  echo -e "  4. Test locally by opening ${BOLD}index.html${NC} in a browser"
  echo -e "  5. Deploy with: ${BOLD}scripts/deploy-game.sh ${game_dir} YYYY-MM-DD${NC}"
  echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  parse_args "$@"
  validate_inputs

  info "Scaffolding new game: ${BOLD}${TITLE}${NC} (${GAME_NAME})"

  scaffold_game
  print_next_steps
}

main "$@"
