// Game Template - Replace with your game logic

const config = {
  type: Phaser.AUTO,
  scale: {
    mode: Phaser.Scale.RESIZE,
    parent: 'game-container',
    width: '100%',
    height: '100%',
  },
  backgroundColor: '#1a1a2e',
  scene: {
    preload: preload,
    create: create,
    update: update
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  }
};

const game = new Phaser.Game(config);

function preload() {
  // Load assets here
  // this.load.image('key', 'path/to/image.png');
}

function create() {
  // Setup game objects here
  const { width, height } = this.scale;

  this.add.text(width / 2, height / 2, 'Game Template', {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '32px',
    color: '#ffffff',
    fontStyle: 'bold'
  }).setOrigin(0.5);

  this.add.text(width / 2, height / 2 + 50, 'Replace game.js with your game logic', {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '16px',
    color: '#888888'
  }).setOrigin(0.5);

  // Listen for resize
  this.scale.on('resize', (gameSize) => {
    this.cameras.main.setSize(gameSize.width, gameSize.height);
  });

  // Connect to GameBridge
  GameBridge.on('connected', (data) => {
    console.log('Connected:', data);
  });
}

function update(time, delta) {
  // Game loop logic here
}
