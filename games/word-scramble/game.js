// Word Scramble - A fast-paced word unscrambling game
// Optimized for WKWebView: rAF timer, touch events, no DOM thrashing

(function () {
  'use strict';

  // ── Word List ──────────────────────────────────────────────────────────────
  var WORDS = [
    'able', 'acid', 'aged', 'also', 'arch', 'area', 'army', 'away',
    'baby', 'back', 'band', 'bank', 'bare', 'base', 'bath', 'bear',
    'beat', 'bell', 'belt', 'bend', 'bird', 'bite', 'blow', 'blue',
    'boat', 'body', 'bold', 'bomb', 'bond', 'bone', 'book', 'boot',
    'born', 'boss', 'burn', 'busy', 'calm', 'came', 'camp', 'card',
    'care', 'cart', 'case', 'cash', 'cast', 'cave', 'chip', 'city',
    'clam', 'clay', 'clip', 'club', 'coal', 'coat', 'code', 'coin',
    'cold', 'come', 'cook', 'cool', 'cope', 'copy', 'core', 'cost',
    'dark', 'data', 'date', 'dawn', 'deal', 'dear', 'debt', 'deep',
    'desk', 'diet', 'dirt', 'dish', 'disk', 'dock', 'dome', 'done',
    'door', 'dose', 'down', 'drag', 'draw', 'drop', 'drum', 'dual',
    'duke', 'dump', 'dust', 'duty', 'each', 'earn', 'ease', 'east',
    'flame', 'flash', 'float', 'flood', 'floor', 'fluid',
    'force', 'forge', 'frame', 'fresh', 'front', 'frost',
    'grace', 'grade', 'grain', 'grand', 'grant', 'grape',
    'grasp', 'grass', 'grave', 'great', 'green', 'grind',
    'group', 'grown', 'guard', 'guess', 'guide', 'guild',
    'haven', 'heart', 'heavy', 'hello', 'horse', 'hotel',
    'house', 'human', 'humor', 'hunts',
    'judge', 'juice', 'jumps',
    'knelt', 'knife', 'knock',
    'lemon', 'light', 'linen', 'lions', 'lucky', 'lunch',
    'magic', 'maple', 'match', 'metal', 'minor', 'model',
    'money', 'month', 'motel', 'mount', 'mouse', 'mouth',
    'music', 'nerve', 'night', 'noble', 'noise', 'north',
    'novel', 'nurse', 'ocean', 'offer', 'olive', 'onset',
    'orbit', 'order', 'other', 'outer', 'owner', 'oxide',
    'paint', 'panel', 'paper', 'parts', 'party', 'pasta',
    'patch', 'pause', 'peace', 'pearl', 'phase', 'phone',
    'photo', 'piano', 'piece', 'pilot', 'pitch', 'place',
    'plain', 'plane', 'plant', 'plate', 'plaza', 'plead',
    'plumb', 'plume', 'point', 'pound', 'power', 'press',
    'price', 'pride', 'prime', 'print', 'prize', 'proof',
    'pupil', 'queen', 'quest', 'quick', 'quiet', 'quote',
    'radio', 'raise', 'range', 'rapid', 'reach', 'realm',
    'rider', 'ridge', 'right', 'rinse', 'risen', 'rival',
    'river', 'roast', 'robin', 'robot', 'rocky', 'round',
    'route', 'royal', 'rugby', 'ruler', 'rural',
    'saint', 'salad', 'scale', 'scene', 'score', 'sense',
    'serve', 'seven', 'shade', 'shake', 'shame', 'shape',
    'share', 'sharp', 'sheep', 'shelf', 'shell', 'shift',
    'shine', 'shirt', 'shock', 'shore', 'short', 'shout',
    'sight', 'since', 'sixth', 'sixty', 'skill', 'skull',
    'slate', 'sleep', 'slice', 'slide', 'smart', 'smell',
    'smile', 'smoke', 'snake', 'solid', 'solve', 'sorry',
    'sound', 'south', 'space', 'spare', 'spark', 'speak',
    'speed', 'spend', 'spill', 'spine', 'split', 'spoke',
    'spoon', 'sport', 'squad', 'stack', 'staff', 'stage',
    'stain', 'stair', 'stake', 'stale', 'stamp', 'stand',
    'stark', 'start', 'state', 'stays', 'steam', 'steel',
    'steep', 'steer', 'stern', 'stick', 'stiff', 'still',
    'stock', 'stone', 'stood', 'store', 'storm', 'story',
    'stove', 'strip', 'stuck', 'study', 'stuff', 'style',
    'sugar', 'suite', 'super', 'surge', 'swamp', 'swear',
    'sweep', 'sweet', 'swept', 'swift', 'swing', 'sword',
    'table', 'taken', 'taste', 'teach', 'teeth', 'thank',
    'theme', 'thick', 'thing', 'think', 'third', 'those',
    'three', 'threw', 'throw', 'thumb', 'tiger', 'tight',
    'timer', 'tired', 'title', 'toast', 'today', 'token',
    'topic', 'total', 'touch', 'tough', 'towel', 'tower',
    'toxic', 'trace', 'track', 'trade', 'trail', 'train',
    'trait', 'trash', 'treat', 'trend', 'trial', 'tribe',
    'trick', 'tried', 'troop', 'truck', 'truly', 'trump',
    'trunk', 'trust', 'truth', 'twice', 'twist',
    'ultra', 'uncle', 'under', 'union', 'unite', 'unity',
    'until', 'upper', 'upset', 'urban', 'usage', 'usual',
    'valid', 'value', 'vault', 'venue', 'verse', 'video',
    'vigor', 'vinyl', 'viola', 'viral', 'virus', 'visit',
    'vital', 'vivid', 'vocal', 'voice', 'voter',
    'waste', 'watch', 'water', 'weave', 'wedge', 'weigh',
    'wheat', 'wheel', 'where', 'which', 'while', 'white',
    'whole', 'whose', 'width', 'witch', 'woman', 'world',
    'worse', 'worst', 'worth', 'would', 'wound', 'wrist',
    'write', 'wrong', 'wrote', 'yacht', 'youth'
  ];

  // ── Constants ────────────────────────────────────────────────────────────
  var GAME_DURATION = 60;
  var FAST_BONUS_THRESHOLD = 5; // seconds
  var MAX_TILES = 6; // max letters any word can have (pre-allocate)
  var TAP_DEBOUNCE_MS = 80; // minimum ms between taps on same target

  // ── Game State ─────────────────────────────────────────────────────────────
  var currentWord = '';
  var scrambledWord = '';
  var selectedIndices = []; // indices into scrambled letters that have been tapped
  var score = 0;
  var streak = 0;
  var bestStreak = 0;
  var wordsSolved = 0;
  var timeLeft = GAME_DURATION;
  var gameRunning = false;
  var wordStartTime = 0;
  var usedWords = new Set();

  // Timer state (rAF-based)
  var timerRAF = null;
  var timerStartTimestamp = 0;
  var timerElapsedAtStart = 0;

  // Debounce state
  var lastTapTime = 0;

  // ── DOM Elements ───────────────────────────────────────────────────────────
  var $timerFill = document.getElementById('timer-fill');
  var $scoreValue = document.getElementById('score-value');
  var $streakValue = document.getElementById('streak-value');
  var $timeValue = document.getElementById('time-value');
  var $scrambledLetters = document.getElementById('scrambled-letters');
  var $answerSlots = document.getElementById('answer-slots');
  var $clearBtn = document.getElementById('clear-btn');
  var $submitBtn = document.getElementById('submit-btn');
  var $feedback = document.getElementById('feedback');
  var $gameOver = document.getElementById('game-over-screen');
  var $finalScore = document.getElementById('final-score');
  var $finalWords = document.getElementById('final-words');
  var $finalStreak = document.getElementById('final-streak');
  var $playAgainBtn = document.getElementById('play-again-btn');

  // ── Pre-created DOM pools ──────────────────────────────────────────────────
  // Pre-create tile and slot elements so we never innerHTML during gameplay
  var tileElements = [];
  var slotElements = [];
  var activeLetterCount = 0; // how many tiles/slots are in use this word

  function preallocateTiles() {
    for (var i = 0; i < MAX_TILES; i++) {
      var tile = document.createElement('div');
      tile.className = 'letter-tile';
      tile.style.display = 'none';
      tile.dataset.index = i;
      $scrambledLetters.appendChild(tile);
      tileElements.push(tile);

      // Touch handler for this tile (bound once, never re-attached)
      (function (idx) {
        addTapHandler(tile, function () {
          handleTileTap(idx);
        });
      })(i);
    }

    for (var j = 0; j < MAX_TILES; j++) {
      var slot = document.createElement('div');
      slot.className = 'answer-slot';
      slot.style.display = 'none';
      slot.dataset.index = j;
      $answerSlots.appendChild(slot);
      slotElements.push(slot);

      (function (idx) {
        addTapHandler(slot, function () {
          handleAnswerTap(idx);
        });
      })(j);
    }
  }

  // ── Utilities ──────────────────────────────────────────────────────────────
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function scramble(word) {
    var letters = word.split('');
    var attempts = 0;
    var result;
    do {
      result = shuffle(letters);
      attempts++;
    } while (result.join('') === word && attempts < 20);
    return result.join('');
  }

  function pickWord() {
    var available = WORDS.filter(function (w) { return !usedWords.has(w); });
    if (available.length === 0) {
      usedWords.clear();
      return WORDS[Math.floor(Math.random() * WORDS.length)];
    }
    return available[Math.floor(Math.random() * available.length)];
  }

  function haptic(style) {
    if (typeof GameBridge !== 'undefined' && GameBridge.haptic) {
      GameBridge.haptic(style);
    }
  }

  // ── Touch handling ─────────────────────────────────────────────────────────
  // Use touchstart for instant response; fall back to click for non-touch
  function addTapHandler(element, callback) {
    var handled = false;

    element.addEventListener('touchstart', function (e) {
      e.preventDefault(); // prevent scroll, zoom, and 300ms click delay
      handled = true;
      var now = Date.now();
      if (now - lastTapTime < TAP_DEBOUNCE_MS) return;
      lastTapTime = now;
      callback();
    }, { passive: false });

    element.addEventListener('click', function (e) {
      if (handled) {
        handled = false;
        return; // already processed by touchstart
      }
      var now = Date.now();
      if (now - lastTapTime < TAP_DEBOUNCE_MS) return;
      lastTapTime = now;
      callback();
    });
  }

  // ── Rendering (no DOM thrashing) ───────────────────────────────────────────
  function updateTiles() {
    var letters = scrambledWord.split('');
    for (var i = 0; i < MAX_TILES; i++) {
      var tile = tileElements[i];
      if (i < activeLetterCount) {
        tile.style.display = 'flex';
        tile.textContent = letters[i];

        if (selectedIndices.indexOf(i) !== -1) {
          tile.classList.add('selected');
        } else {
          tile.classList.remove('selected');
        }
      } else {
        tile.style.display = 'none';
      }
    }
  }

  function updateSlots() {
    for (var i = 0; i < MAX_TILES; i++) {
      var slot = slotElements[i];
      if (i < activeLetterCount) {
        slot.style.display = 'flex';
        // Remove feedback classes
        slot.classList.remove('correct', 'wrong');

        if (i < selectedIndices.length) {
          slot.textContent = scrambledWord[selectedIndices[i]];
          slot.classList.add('filled');
        } else {
          slot.textContent = '';
          slot.classList.remove('filled');
        }
      } else {
        slot.style.display = 'none';
      }
    }
  }

  function playPopInOnTiles() {
    for (var i = 0; i < activeLetterCount; i++) {
      var tile = tileElements[i];
      tile.classList.remove('pop-in');
      // Force reflow to re-trigger animation (single reflow for batch)
      if (i === activeLetterCount - 1) {
        void tile.offsetWidth;
      }
    }
    for (var j = 0; j < activeLetterCount; j++) {
      tileElements[j].classList.add('pop-in');
      tileElements[j].style.animationDelay = (j * 0.04) + 's';
    }
  }

  function updateHUD() {
    $scoreValue.textContent = score;
    $streakValue.textContent = streak;
    $timeValue.textContent = timeLeft;

    var pct = timeLeft / GAME_DURATION;
    $timerFill.style.transform = 'scaleX(' + pct + ')';

    if (timeLeft <= 10) {
      $timerFill.classList.add('warning');
    } else {
      $timerFill.classList.remove('warning');
    }

    $submitBtn.disabled = selectedIndices.length !== currentWord.length;
  }

  // ── Interaction ────────────────────────────────────────────────────────────
  function handleTileTap(index) {
    if (!gameRunning) return;
    if (index >= activeLetterCount) return;

    var idx = selectedIndices.indexOf(index);
    if (idx !== -1) {
      // Deselect
      selectedIndices.splice(idx, 1);
    } else if (selectedIndices.length < currentWord.length) {
      selectedIndices.push(index);
    }
    haptic('light');
    updateTiles();
    updateSlots();
    updateHUD();
  }

  function handleAnswerTap(answerIndex) {
    if (!gameRunning) return;
    if (answerIndex >= activeLetterCount) return;
    if (answerIndex < selectedIndices.length) {
      selectedIndices.splice(answerIndex, 1);
      haptic('light');
      updateTiles();
      updateSlots();
      updateHUD();
    }
  }

  function clearAnswer() {
    if (!gameRunning) return;
    selectedIndices = [];
    haptic('light');
    updateTiles();
    updateSlots();
    updateHUD();
  }

  function submitAnswer() {
    if (!gameRunning) return;
    if (selectedIndices.length !== currentWord.length) return;

    var answer = '';
    for (var i = 0; i < selectedIndices.length; i++) {
      answer += scrambledWord[selectedIndices[i]];
    }

    if (answer === currentWord) {
      handleCorrect();
    } else {
      handleWrong();
    }
  }

  function handleCorrect() {
    var elapsed = (Date.now() - wordStartTime) / 1000;
    var points = 10;
    if (elapsed < FAST_BONUS_THRESHOLD) {
      points += 5;
    }

    score += points;
    streak++;
    wordsSolved++;
    if (streak > bestStreak) bestStreak = streak;

    haptic('success');
    showFeedback('correct', '+' + points);
    showScorePopup('+' + points);

    // Flash answer slots green
    for (var i = 0; i < activeLetterCount; i++) {
      slotElements[i].classList.add('correct');
    }

    // Submit running score
    if (typeof GameBridge !== 'undefined' && GameBridge.submitScore) {
      GameBridge.submitScore(score);
    }

    setTimeout(function () {
      loadNewWord();
    }, 350);
  }

  function handleWrong() {
    streak = 0;
    haptic('error');
    showFeedback('wrong', 'Nope');

    // Flash answer slots red
    for (var i = 0; i < activeLetterCount; i++) {
      if (i < selectedIndices.length) {
        slotElements[i].classList.add('wrong');
      }
    }

    setTimeout(function () {
      clearAnswer();
    }, 450);
  }

  function showFeedback(type, text) {
    $feedback.textContent = text;
    $feedback.className = '';

    // Force reflow to re-trigger animation
    void $feedback.offsetWidth;

    $feedback.classList.add(type === 'correct' ? 'show-correct' : 'show-wrong');
  }

  function showScorePopup(text) {
    var popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = text;
    document.body.appendChild(popup);
    setTimeout(function () {
      if (popup.parentNode) popup.parentNode.removeChild(popup);
    }, 750);
  }

  // ── rAF-based Timer ────────────────────────────────────────────────────────
  function timerTick(timestamp) {
    if (!gameRunning) return;

    if (timerStartTimestamp === 0) {
      timerStartTimestamp = timestamp;
    }

    var elapsedMs = timestamp - timerStartTimestamp;
    var elapsedSec = Math.floor(elapsedMs / 1000) + timerElapsedAtStart;
    var newTimeLeft = Math.max(0, GAME_DURATION - elapsedSec);

    if (newTimeLeft !== timeLeft) {
      timeLeft = newTimeLeft;
      updateHUD();

      if (timeLeft <= 0) {
        endGame();
        return;
      }
    }

    // Smooth timer bar: use fractional seconds for smooth scaleX
    var exactElapsed = (elapsedMs / 1000) + timerElapsedAtStart;
    var smoothPct = Math.max(0, 1 - (exactElapsed / GAME_DURATION));
    $timerFill.style.transform = 'scaleX(' + smoothPct + ')';

    timerRAF = requestAnimationFrame(timerTick);
  }

  // ── Game Flow ──────────────────────────────────────────────────────────────
  function loadNewWord() {
    currentWord = pickWord();
    usedWords.add(currentWord);
    scrambledWord = scramble(currentWord);
    selectedIndices = [];
    activeLetterCount = currentWord.length;
    wordStartTime = Date.now();

    updateTiles();
    updateSlots();
    playPopInOnTiles();
    updateHUD();
  }

  function startGame() {
    score = 0;
    streak = 0;
    bestStreak = 0;
    wordsSolved = 0;
    timeLeft = GAME_DURATION;
    gameRunning = true;
    usedWords.clear();

    $gameOver.classList.add('hidden');

    // Reset timer state
    timerStartTimestamp = 0;
    timerElapsedAtStart = 0;

    loadNewWord();
    updateHUD();

    // Cancel any existing rAF
    if (timerRAF) {
      cancelAnimationFrame(timerRAF);
    }
    timerRAF = requestAnimationFrame(timerTick);
  }

  function endGame() {
    gameRunning = false;
    if (timerRAF) {
      cancelAnimationFrame(timerRAF);
      timerRAF = null;
    }

    // Update final stats
    $finalScore.textContent = score;
    $finalWords.textContent = wordsSolved;
    $finalStreak.textContent = bestStreak;

    // Show game over (only in browser; native handles results UI)
    if (!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.gameOver)) {
      $gameOver.classList.remove('hidden');
    }

    // Notify native
    if (typeof GameBridge !== 'undefined') {
      if (GameBridge.submitScore) {
        GameBridge.submitScore(score);
      }
      if (GameBridge.gameOver) {
        GameBridge.gameOver({
          score: score,
          wordsSolved: wordsSolved,
          bestStreak: bestStreak,
          duration: GAME_DURATION
        });
      }
    }
  }

  // ── Event Listeners ────────────────────────────────────────────────────────
  addTapHandler($clearBtn, clearAnswer);
  addTapHandler($submitBtn, submitAnswer);
  addTapHandler($playAgainBtn, startGame);

  // Prevent any stray touch events from causing scroll/zoom
  document.addEventListener('touchmove', function (e) {
    e.preventDefault();
  }, { passive: false });

  // ── Init ───────────────────────────────────────────────────────────────────
  preallocateTiles();
  startGame();

})();
