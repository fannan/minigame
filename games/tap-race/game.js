// Tap Race - Tap as fast as you can in 10 seconds!

const GAME_DURATION = 10;
const COUNTDOWN_DURATION = 3;

// Color palette that shifts as you tap faster
const BG_COLORS = [
  0x1a1a2e, // calm deep blue
  0x16213e, // midnight
  0x0f3460, // ocean
  0x533483, // purple
  0x7b2d8e, // violet
  0xe94560, // hot pink
  0xff6b35, // orange
  0xffd700, // gold
];

// Tap speed thresholds (taps per second) for color shifts
const SPEED_THRESHOLDS = [0, 2, 4, 6, 8, 10, 12, 15];

// Speed rating labels
const SPEED_RATINGS = [
  { min: 0,  label: 'Sleepy Sloth',      color: '#888888' },
  { min: 3,  label: 'Casual Tapper',      color: '#4ecdc4' },
  { min: 5,  label: 'Getting Warmed Up',  color: '#45b7d1' },
  { min: 7,  label: 'Speed Demon',        color: '#96e6a1' },
  { min: 9,  label: 'Lightning Fingers',  color: '#ffd700' },
  { min: 11, label: 'Turbo Mode',         color: '#ff6b35' },
  { min: 13, label: 'INSANE',             color: '#e94560' },
  { min: 15, label: 'INHUMAN',            color: '#ff0000' },
];

function getSpeedRating(tps) {
  let rating = SPEED_RATINGS[0];
  for (const r of SPEED_RATINGS) {
    if (tps >= r.min) rating = r;
  }
  return rating;
}

function getBgColor(tps) {
  let color = BG_COLORS[0];
  for (let i = 0; i < SPEED_THRESHOLDS.length; i++) {
    if (tps >= SPEED_THRESHOLDS[i]) color = BG_COLORS[i];
  }
  return color;
}

function lerpColor(a, b, t) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return (rr << 16) | (rg << 8) | rb;
}

// ---- Scenes ----

class CountdownScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CountdownScene' });
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#1a1a2e');

    // Title
    this.add.text(width / 2, height * 0.2, 'TAP RACE', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '48px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(width / 2, height * 0.3, 'Tap as fast as you can!', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '20px',
      color: '#888888',
    }).setOrigin(0.5);

    // Countdown number
    this.countdownText = this.add.text(width / 2, height / 2, '', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '120px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.currentCount = COUNTDOWN_DURATION;
    this.showCount();
  }

  showCount() {
    if (this.currentCount <= 0) {
      // Flash "GO!" then start the game
      this.countdownText.setText('GO!');
      this.countdownText.setColor('#ffd700');
      this.countdownText.setScale(0.5);

      this.tweens.add({
        targets: this.countdownText,
        scale: 1.5,
        alpha: 0,
        duration: 400,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.scene.start('GameScene');
        }
      });

      GameBridge.haptic('heavy');
      return;
    }

    this.countdownText.setText(this.currentCount.toString());
    this.countdownText.setScale(2);
    this.countdownText.setAlpha(1);

    // Color cycle for countdown
    const colors = ['#e94560', '#ffd700', '#4ecdc4'];
    this.countdownText.setColor(colors[(this.currentCount - 1) % colors.length]);

    this.tweens.add({
      targets: this.countdownText,
      scale: 1,
      duration: 800,
      ease: 'Bounce.easeOut',
    });

    GameBridge.haptic('medium');

    this.time.delayedCall(1000, () => {
      this.currentCount--;
      this.showCount();
    });
  }
}

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    const { width, height } = this.scale;

    this.tapCount = 0;
    this.timeRemaining = GAME_DURATION;
    this.gameActive = true;
    this.tapsPerSecond = 0;
    this.recentTaps = []; // timestamps of recent taps for TPS calculation
    this.currentBgColor = BG_COLORS[0];
    this.targetBgColor = BG_COLORS[0];

    this.cameras.main.setBackgroundColor('#1a1a2e');

    // Timer bar background
    this.timerBarBg = this.add.rectangle(width / 2, 40, width - 40, 16, 0x333333, 0.8)
      .setOrigin(0.5)
      .setDepth(10);

    // Timer bar fill
    this.timerBarFill = this.add.rectangle(20, 32, width - 40, 16, 0x4ecdc4, 1)
      .setOrigin(0, 0)
      .setDepth(11);

    // Timer text
    this.timerText = this.add.text(width / 2, 70, GAME_DURATION.toFixed(1) + 's', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    // Score display
    this.scoreText = this.add.text(width / 2, height * 0.22, '0', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '80px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(10);

    this.scoreLabel = this.add.text(width / 2, height * 0.22 + 55, 'TAPS', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '18px',
      color: '#aaaaaa',
      letterSpacing: 8,
    }).setOrigin(0.5).setDepth(10);

    // TPS display
    this.tpsText = this.add.text(width / 2, height * 0.82, '0.0 taps/sec', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '22px',
      color: '#888888',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    // Tap target - main circle
    this.tapTarget = this.add.circle(width / 2, height / 2, 90, 0x4ecdc4, 1)
      .setDepth(5)
      .setInteractive();

    // Tap target glow ring
    this.tapGlow = this.add.circle(width / 2, height / 2, 95, 0x4ecdc4, 0.3)
      .setDepth(4);

    // Pulse animation on the glow ring
    this.tweens.add({
      targets: this.tapGlow,
      radius: 110,
      alpha: 0,
      duration: 1200,
      repeat: -1,
      ease: 'Sine.easeOut',
      onUpdate: (tween) => {
        const val = 95 + (110 - 95) * tween.progress;
        this.tapGlow.setRadius(val);
        this.tapGlow.setAlpha(0.3 * (1 - tween.progress));
      }
    });

    // Inner tap text
    this.tapLabel = this.add.text(width / 2, height / 2, 'TAP!', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '28px',
      color: '#1a1a2e',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(6);

    // Create particle emitter for tap bursts
    // Generate a small circle texture for particles
    const particleGfx = this.make.graphics({ x: 0, y: 0, add: false });
    particleGfx.fillStyle(0xffffff, 1);
    particleGfx.fillCircle(8, 8, 8);
    particleGfx.generateTexture('particle', 16, 16);
    particleGfx.destroy();

    this.tapEmitter = this.add.particles(width / 2, height / 2, 'particle', {
      speed: { min: 150, max: 400 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 600,
      blendMode: 'ADD',
      emitting: false,
      quantity: 8,
      tint: [0x4ecdc4, 0x45b7d1, 0x96e6a1, 0xffd700],
    }).setDepth(7);

    // Ripple pool - reuse ring graphics
    this.ripples = [];

    // Handle taps on the circle
    this.tapTarget.on('pointerdown', (pointer) => {
      if (!this.gameActive) return;
      this.handleTap(pointer);
    });

    // Also allow tapping anywhere on screen
    this.input.on('pointerdown', (pointer) => {
      if (!this.gameActive) return;
      this.handleTap(pointer);
    });

    // Timer event
    this.timerEvent = this.time.addEvent({
      delay: 100,
      callback: this.updateTimer,
      callbackScope: this,
      loop: true,
    });

    // Handle resize
    this.scale.on('resize', (gameSize) => {
      this.repositionElements(gameSize.width, gameSize.height);
    });
  }

  handleTap(pointer) {
    this.tapCount++;
    const now = Date.now();
    this.recentTaps.push(now);

    // Update score display
    this.scoreText.setText(this.tapCount.toString());

    // Score text pop animation
    this.tweens.killTweensOf(this.scoreText);
    this.scoreText.setScale(1.3);
    this.tweens.add({
      targets: this.scoreText,
      scale: 1,
      duration: 150,
      ease: 'Back.easeOut',
    });

    // Tap target squash and stretch
    this.tweens.killTweensOf(this.tapTarget);
    this.tapTarget.setScale(0.85);
    this.tweens.add({
      targets: this.tapTarget,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });

    // Also animate the tap label
    this.tweens.killTweensOf(this.tapLabel);
    this.tapLabel.setScale(0.85);
    this.tweens.add({
      targets: this.tapLabel,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });

    // Particle burst at tap position (centered on the button)
    const { width, height } = this.scale;
    this.tapEmitter.setPosition(width / 2, height / 2);
    this.tapEmitter.explode(6 + Math.min(Math.floor(this.tapsPerSecond), 12));

    // Screen shake - intensity scales with TPS
    const shakeIntensity = Math.min(0.002 + this.tapsPerSecond * 0.0003, 0.008);
    this.cameras.main.shake(80, shakeIntensity);

    // Spawn ripple ring
    this.spawnRipple(width / 2, height / 2);

    // Haptic
    GameBridge.haptic('light');

    // Flash the tap target color based on speed
    const tps = this.tapsPerSecond;
    let tapColor;
    if (tps > 12) tapColor = 0xff0000;
    else if (tps > 9) tapColor = 0xff6b35;
    else if (tps > 6) tapColor = 0xffd700;
    else tapColor = 0x4ecdc4;

    this.tapTarget.setFillStyle(0xffffff, 1);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 200,
      onUpdate: (tween) => {
        const c = lerpColor(0xffffff, tapColor, tween.getValue());
        this.tapTarget.setFillStyle(c, 1);
      }
    });

    // Update particle tint based on speed
    if (tps > 10) {
      this.tapEmitter.setParticleTint([0xff0000, 0xff6b35, 0xffd700, 0xffffff]);
    } else if (tps > 6) {
      this.tapEmitter.setParticleTint([0xffd700, 0xff6b35, 0x96e6a1, 0x4ecdc4]);
    }
  }

  spawnRipple(x, y) {
    const ripple = this.add.circle(x, y, 90, 0xffffff, 0.4)
      .setDepth(3)
      .setStrokeStyle(2, 0xffffff, 0.6);

    this.tweens.add({
      targets: ripple,
      radius: 180,
      alpha: 0,
      duration: 500,
      ease: 'Sine.easeOut',
      onUpdate: () => {
        ripple.setRadius(ripple.radius);
      },
      onComplete: () => {
        ripple.destroy();
      }
    });
  }

  updateTimer() {
    if (!this.gameActive) return;

    this.timeRemaining -= 0.1;
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.endGame();
      return;
    }

    // Update timer display
    this.timerText.setText(this.timeRemaining.toFixed(1) + 's');

    // Timer bar
    const { width } = this.scale;
    const barWidth = (width - 40) * (this.timeRemaining / GAME_DURATION);
    this.timerBarFill.setSize(Math.max(0, barWidth), 16);

    // Timer color: green -> yellow -> red
    const pct = this.timeRemaining / GAME_DURATION;
    let barColor;
    if (pct > 0.5) {
      barColor = lerpColor(0xffd700, 0x4ecdc4, (pct - 0.5) * 2);
    } else {
      barColor = lerpColor(0xe94560, 0xffd700, pct * 2);
    }
    this.timerBarFill.setFillStyle(barColor, 1);

    // Urgency flash in last 3 seconds
    if (this.timeRemaining <= 3 && this.timeRemaining > 0) {
      this.timerText.setColor(Math.floor(this.timeRemaining * 10) % 2 === 0 ? '#e94560' : '#ffffff');
    }

    // Calculate TPS (taps in last 2 seconds)
    const now = Date.now();
    const cutoff = now - 2000;
    this.recentTaps = this.recentTaps.filter(t => t > cutoff);
    this.tapsPerSecond = this.recentTaps.length / 2;

    // Update TPS display
    this.tpsText.setText(this.tapsPerSecond.toFixed(1) + ' taps/sec');
    const rating = getSpeedRating(this.tapsPerSecond);
    this.tpsText.setColor(rating.color);

    // Smooth background color transition
    this.targetBgColor = getBgColor(this.tapsPerSecond);
    this.currentBgColor = lerpColor(this.currentBgColor, this.targetBgColor, 0.1);
    this.cameras.main.setBackgroundColor(this.currentBgColor);
  }

  endGame() {
    this.gameActive = false;
    this.timerEvent.remove();

    GameBridge.haptic('success');

    // Final TPS over the whole game
    const avgTps = this.tapCount / GAME_DURATION;

    // Submit score
    GameBridge.submitScore(this.tapCount);
    GameBridge.gameOver({
      score: this.tapCount,
      data: {
        avgTapsPerSecond: avgTps,
        peakTapsPerSecond: this.tapsPerSecond,
      }
    });

    // Transition to game over
    this.cameras.main.flash(300, 255, 255, 255);

    this.time.delayedCall(500, () => {
      this.scene.start('GameOverScene', {
        score: this.tapCount,
        avgTps: avgTps,
      });
    });
  }

  repositionElements(w, h) {
    this.timerBarBg.setPosition(w / 2, 40);
    this.timerBarBg.setSize(w - 40, 16);
    this.timerBarFill.setPosition(20, 32);
    this.timerText.setPosition(w / 2, 70);
    this.scoreText.setPosition(w / 2, h * 0.22);
    this.scoreLabel.setPosition(w / 2, h * 0.22 + 55);
    this.tpsText.setPosition(w / 2, h * 0.82);
    this.tapTarget.setPosition(w / 2, h / 2);
    this.tapGlow.setPosition(w / 2, h / 2);
    this.tapLabel.setPosition(w / 2, h / 2);
    this.tapEmitter.setPosition(w / 2, h / 2);
  }
}

class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  create(data) {
    const { width, height } = this.scale;
    const { score, avgTps } = data;
    const rating = getSpeedRating(avgTps);

    this.cameras.main.setBackgroundColor('#1a1a2e');

    // "TIME'S UP!" title
    const titleText = this.add.text(width / 2, height * 0.12, "TIME'S UP!", {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '42px',
      color: '#e94560',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: titleText,
      alpha: 1,
      y: height * 0.14,
      duration: 500,
      ease: 'Back.easeOut',
    });

    // Score - big number with count-up animation
    this.scoreDisplay = this.add.text(width / 2, height * 0.35, '0', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '100px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0);

    this.add.text(width / 2, height * 0.35 + 65, 'TAPS', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '20px',
      color: '#aaaaaa',
      letterSpacing: 8,
    }).setOrigin(0.5);

    // Count up animation
    this.tweens.add({
      targets: this.scoreDisplay,
      alpha: 1,
      duration: 300,
      delay: 300,
      onComplete: () => {
        this.tweens.addCounter({
          from: 0,
          to: score,
          duration: 800,
          ease: 'Cubic.easeOut',
          onUpdate: (tween) => {
            this.scoreDisplay.setText(Math.floor(tween.getValue()).toString());
          },
          onComplete: () => {
            this.scoreDisplay.setText(score.toString());
            // Pop effect at end
            this.tweens.add({
              targets: this.scoreDisplay,
              scale: 1.2,
              duration: 100,
              yoyo: true,
              ease: 'Quad.easeOut',
            });
            GameBridge.haptic('success');
          }
        });
      }
    });

    // Average TPS
    const tpsDisplay = this.add.text(width / 2, height * 0.55, avgTps.toFixed(1) + ' taps/sec', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '28px',
      color: '#4ecdc4',
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: tpsDisplay,
      alpha: 1,
      y: height * 0.55,
      duration: 500,
      delay: 1200,
      ease: 'Back.easeOut',
    });

    // Speed rating
    const ratingText = this.add.text(width / 2, height * 0.63, rating.label, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '32px',
      color: rating.color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0).setScale(0.5);

    this.tweens.add({
      targets: ratingText,
      alpha: 1,
      scale: 1,
      duration: 600,
      delay: 1600,
      ease: 'Back.easeOut',
    });

    // Particle celebration for high scores
    if (avgTps >= 7) {
      const particleGfx = this.make.graphics({ x: 0, y: 0, add: false });
      particleGfx.fillStyle(0xffffff, 1);
      particleGfx.fillCircle(6, 6, 6);
      particleGfx.generateTexture('confetti', 12, 12);
      particleGfx.destroy();

      // Left side confetti
      this.add.particles(0, height * 0.3, 'confetti', {
        x: { min: 0, max: width },
        y: -20,
        speed: { min: 80, max: 200 },
        angle: { min: 80, max: 100 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 0.8, end: 0 },
        lifespan: 2000,
        frequency: 100,
        blendMode: 'ADD',
        tint: [0x4ecdc4, 0xffd700, 0xe94560, 0x96e6a1, 0xff6b35],
      }).setDepth(20);
    }

    // "Tap to play again" text
    const replayText = this.add.text(width / 2, height * 0.85, 'Tap to play again', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '20px',
      color: '#666666',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: replayText,
      alpha: 1,
      delay: 2200,
      duration: 500,
    });

    // Pulse the replay text
    this.tweens.add({
      targets: replayText,
      alpha: 0.4,
      duration: 800,
      yoyo: true,
      repeat: -1,
      delay: 2700,
      ease: 'Sine.easeInOut',
    });

    // Tap to restart (only after delay)
    this.time.delayedCall(2200, () => {
      this.input.on('pointerdown', () => {
        GameBridge.haptic('medium');
        this.scene.start('CountdownScene');
      });
    });
  }
}

// ---- Game Config ----

const config = {
  type: Phaser.AUTO,
  scale: {
    mode: Phaser.Scale.RESIZE,
    parent: 'game-container',
    width: '100%',
    height: '100%',
  },
  backgroundColor: '#1a1a2e',
  scene: [CountdownScene, GameScene, GameOverScene],
  input: {
    activePointers: 3, // Support multi-touch
  },
  banner: false,
};

const game = new Phaser.Game(config);
