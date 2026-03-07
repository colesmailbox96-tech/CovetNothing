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
    // Generate procedural textures for Dust Wraith
    this.generateDustWraithTextures();

    // Generate decoration textures
    this.generateDecorationTextures();

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

  /** Procedurally generate Dust Wraith textures (ghostly floating specter) */
  generateDustWraithTextures() {
    const size = 64;
    const g = this.add.graphics();

    for (const dir of DIRS) {
      g.clear();

      // Outer glow
      g.fillStyle(0x6644aa, 0.15);
      g.fillCircle(size / 2, size / 2, 28);

      // Body — translucent purple-blue oval
      g.fillStyle(0x7755cc, 0.6);
      g.fillEllipse(size / 2, size / 2 + 2, 30, 36);

      // Inner glow
      g.fillStyle(0x9977ee, 0.4);
      g.fillEllipse(size / 2, size / 2, 20, 26);

      // Core
      g.fillStyle(0xbbaaff, 0.5);
      g.fillEllipse(size / 2, size / 2 - 2, 12, 16);

      // Eyes (two small bright dots, offset based on direction)
      const eyeOffsets = {
        'south':      [{ x: -5, y: -3 }, { x: 5, y: -3 }],
        'north':      [{ x: -5, y: -3 }, { x: 5, y: -3 }],
        'east':       [{ x: 2, y: -4 }, { x: 2, y: 2 }],
        'west':       [{ x: -2, y: -4 }, { x: -2, y: 2 }],
        'south-east': [{ x: 0, y: -3 }, { x: 6, y: -1 }],
        'south-west': [{ x: -6, y: -1 }, { x: 0, y: -3 }],
        'north-east': [{ x: 0, y: -3 }, { x: 6, y: -1 }],
        'north-west': [{ x: -6, y: -1 }, { x: 0, y: -3 }],
      };
      const eyes = eyeOffsets[dir] || eyeOffsets['south'];
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(size / 2 + eyes[0].x, size / 2 + eyes[0].y, 3);
      g.fillCircle(size / 2 + eyes[1].x, size / 2 + eyes[1].y, 3);
      g.fillStyle(0xcc44ff, 1);
      g.fillCircle(size / 2 + eyes[0].x, size / 2 + eyes[0].y, 1.5);
      g.fillCircle(size / 2 + eyes[1].x, size / 2 + eyes[1].y, 1.5);

      // Wispy tail at bottom
      g.fillStyle(0x6644aa, 0.3);
      g.fillTriangle(
        size / 2 - 10, size / 2 + 14,
        size / 2 + 10, size / 2 + 14,
        size / 2, size / 2 + 30
      );

      g.generateTexture(`dust-wraith-idle-${dir}-0`, size, size);
    }
    g.destroy();
  }

  /** Procedurally generate decoration textures for dungeon rooms */
  generateDecorationTextures() {
    const g = this.add.graphics();

    // Wall torch (16x16)
    g.clear();
    // Bracket
    g.fillStyle(0x666666, 1);
    g.fillRect(6, 8, 4, 8);
    // Flame
    g.fillStyle(0xff6600, 0.9);
    g.fillRect(4, 2, 8, 8);
    g.fillStyle(0xffaa00, 0.8);
    g.fillRect(5, 3, 6, 5);
    g.fillStyle(0xffdd44, 0.7);
    g.fillRect(6, 4, 4, 3);
    g.generateTexture('deco-torch', 16, 16);
    g.clear();

    // Floor debris (16x16)
    g.fillStyle(0x444444, 0.6);
    g.fillRect(2, 6, 5, 3);
    g.fillRect(8, 4, 4, 4);
    g.fillRect(5, 10, 6, 3);
    g.fillStyle(0x555555, 0.4);
    g.fillRect(10, 9, 3, 3);
    g.fillRect(1, 11, 3, 2);
    g.generateTexture('deco-debris', 16, 16);
    g.clear();

    // Pillar / column (16x24) - visual decoration near walls
    g.fillStyle(0x4a3a5a, 1);
    g.fillRect(3, 0, 10, 24);
    g.fillStyle(0x5a4a6a, 0.8);
    g.fillRect(4, 1, 8, 3);
    g.fillRect(4, 20, 8, 3);
    g.fillStyle(0x3a2a4a, 0.6);
    g.fillRect(7, 0, 2, 24);
    g.generateTexture('deco-pillar', 16, 24);
    g.clear();

    g.destroy();
  }
}
