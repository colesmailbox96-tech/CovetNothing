import Phaser from 'phaser';

const DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Show loading bar
    const { width, height } = this.scale;
    const barW = Math.min(400, width * 0.6);
    const barH = 30;
    const barX = (width - barW) / 2;
    const barY = height / 2 - barH / 2;

    const bg = this.add.rectangle(width / 2, height / 2, barW + 4, barH + 4, 0x444444);
    const bar = this.add.rectangle(barX + 2, barY + 2, 0, barH, 0x88ccff).setOrigin(0, 0);
    const loadText = this.add.text(width / 2, barY - 30, 'Loading...', {
      fontSize: '20px', fill: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.load.on('progress', (value) => {
      bar.width = barW * value;
    });
    this.load.on('complete', () => {
      bg.destroy();
      bar.destroy();
      loadText.destroy();
    });

    // ---- Player sprites ----
    for (const dir of DIRS) {
      this.load.image(`player-idle-${dir}`, `assets/sprites/player/rotations/${dir}.png`);
    }
    // Run animation frames (6 per direction)
    for (const dir of DIRS) {
      for (let i = 0; i < 6; i++) {
        const pad = String(i).padStart(3, '0');
        this.load.image(`player-run-${dir}-${i}`, `assets/sprites/player/run/${dir}_frame_${pad}.png`);
      }
    }
    // Attack animation frames (4 per direction)
    for (const dir of DIRS) {
      for (let i = 0; i < 4; i++) {
        const pad = String(i).padStart(3, '0');
        this.load.image(`player-attack-${dir}-${i}`, `assets/sprites/player/attack/${dir}_frame_${pad}.png`);
      }
    }

    // ---- Weeping Widow sprites ----
    for (const dir of DIRS) {
      this.load.image(`weeping-widow-idle-${dir}-0`, `assets/sprites/enemies/weeping-widow/idle/${dir}_frame_000.png`);
      for (let i = 0; i < 4; i++) {
        const pad = String(i).padStart(3, '0');
        this.load.image(`weeping-widow-idle-${dir}-${i}`, `assets/sprites/enemies/weeping-widow/idle/${dir}_frame_${pad}.png`);
      }
    }
    for (const dir of DIRS) {
      for (let i = 0; i < 6; i++) {
        const pad = String(i).padStart(3, '0');
        this.load.image(`weeping-widow-walk-${dir}-${i}`, `assets/sprites/enemies/weeping-widow/walk/${dir}_frame_${pad}.png`);
      }
    }
    for (const dir of DIRS) {
      for (let i = 0; i < 4; i++) {
        const pad = String(i).padStart(3, '0');
        this.load.image(`weeping-widow-attack-${dir}-${i}`, `assets/sprites/enemies/weeping-widow/attack/${dir}_frame_${pad}.png`);
      }
    }

    // ---- Temple Beetle sprites ----
    for (const dir of DIRS) {
      this.load.image(`temple-beetle-idle-${dir}-0`, `assets/sprites/enemies/temple-beetle/rotations/${dir}.png`);
    }
    for (const dir of DIRS) {
      for (let i = 0; i < 4; i++) {
        const pad = String(i).padStart(3, '0');
        this.load.image(`temple-beetle-walk-${dir}-${i}`, `assets/sprites/enemies/temple-beetle/walk/${dir}_frame_${pad}.png`);
      }
    }
    for (const dir of DIRS) {
      for (let i = 0; i < 4; i++) {
        const pad = String(i).padStart(3, '0');
        this.load.image(`temple-beetle-attack-${dir}-${i}`, `assets/sprites/enemies/temple-beetle/attack/${dir}_frame_${pad}.png`);
      }
    }

    // ---- Item icons ----
    this.load.image('item-bones', 'assets/items/bones.png');
    this.load.image('item-temple-ash', 'assets/items/temple-ash.png');
    this.load.image('item-polished-beetle-eye', 'assets/items/polished-beetle-eye.png');

    // ---- Tile assets ----
    this.load.image('town-path', 'assets/tiles/cobblestone-0.png');
    this.load.image('town-grass', 'assets/tiles/town-grass-0.png');
    this.load.image('dungeon-floor', 'assets/tiles/dungeon-floor-0.png');
  }

  create() {
    // Create all animations
    this.createPlayerAnimations();
    this.createEnemyAnimations('weeping-widow', { idle: 4, walk: 6, attack: 4 });
    this.createEnemyAnimations('temple-beetle', { idle: 1, walk: 4, attack: 4 });

    // Start town scene
    this.scene.start('TownScene');
    this.scene.launch('UIScene');
  }

  createPlayerAnimations() {
    for (const dir of DIRS) {
      // Run
      this.anims.create({
        key: `player-run-${dir}`,
        frames: Array.from({ length: 6 }, (_, i) => ({ key: `player-run-${dir}-${i}` })),
        frameRate: 10,
        repeat: -1,
      });
      // Attack
      this.anims.create({
        key: `player-attack-${dir}`,
        frames: Array.from({ length: 4 }, (_, i) => ({ key: `player-attack-${dir}-${i}` })),
        frameRate: 12,
        repeat: 0,
      });
    }
  }

  createEnemyAnimations(prefix, frameCounts) {
    for (const dir of DIRS) {
      if (frameCounts.idle > 1) {
        this.anims.create({
          key: `${prefix}-idle-${dir}`,
          frames: Array.from({ length: frameCounts.idle }, (_, i) => ({ key: `${prefix}-idle-${dir}-${i}` })),
          frameRate: 4,
          repeat: -1,
        });
      }
      if (frameCounts.walk > 0) {
        this.anims.create({
          key: `${prefix}-walk-${dir}`,
          frames: Array.from({ length: frameCounts.walk }, (_, i) => ({ key: `${prefix}-walk-${dir}-${i}` })),
          frameRate: 8,
          repeat: -1,
        });
      }
      if (frameCounts.attack > 0) {
        this.anims.create({
          key: `${prefix}-attack-${dir}`,
          frames: Array.from({ length: frameCounts.attack }, (_, i) => ({ key: `${prefix}-attack-${dir}-${i}` })),
          frameRate: 10,
          repeat: 0,
        });
      }
    }
  }
}
