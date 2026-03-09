import Phaser from 'phaser';
import { visualFlags } from '../config/visualFlags.ts';
import { generateTownTilesetCanvas, generateTownMapJSON } from '../data/townMapData.js';

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

    // ---- Building sprites ----
    this.load.spritesheet('storefront-sprites', 'assets/sprites/storefront-sprites.png', {
      frameWidth: 64,
      frameHeight: 64,
    });

    // ---- Tile assets ----
    this.load.image('town-path', 'assets/tiles/cobblestone-0.png');
    this.load.image('town-grass', 'assets/tiles/town-grass-0.png');
    this.load.image('dungeon-floor', 'assets/tiles/dungeon-floor-0.png');
  }

  create() {
    // ── Visual-polish flags ──
    if (visualFlags.enablePixelPerfect) {
      this.game.renderer.config.antialias = false;
    }

    // Generate contact-shadow ellipse texture (no external art)
    if (visualFlags.enableShadows) {
      this.generateShadowTexture();
    }

    // Generate procedural textures for Dust Wraith
    this.generateDustWraithTextures();

    // Generate procedural textures for Sand Stalker
    this.generateSandStalkerTextures();

    // Generate procedural textures for Warden's Keyling
    this.generateWardensKeylingTextures();

    // Generate procedural textures for Scarab Swarm
    this.generateScarabSwarmTextures();

    // Generate projectile texture
    this.generateProjectileTexture();

    // Generate decoration textures
    this.generateDecorationTextures();

    // Phase 2 – foreground overlay texture (canopy arch for acceptance test)
    if (visualFlags.enableLayers) {
      this.generateCanopyTexture();
    }

    // Phase 3 – decal & tile-variant textures
    if (visualFlags.enableDecals) {
      this.generateDungeonDecalTextures();
      this.generateTownDecalTextures();
    }
    if (visualFlags.enableTileVariants) {
      this.generateDungeonFloorVariants();
      this.generateTownGrassVariants();
    }

    // Phase 4 – light-pool texture for additive lighting
    if (visualFlags.enableLighting) {
      this.generateLightPoolTexture();
    }

    // Phase 7 – light-mask texture for dark-overlay cutouts
    if (visualFlags.enableDarkOverlay) {
      this.generateLightMaskTexture();
    }

    // Phase 5 – particle textures for decorative emitters
    if (visualFlags.enableParticles) {
      this.generateParticleTextures();
    }

    // Generate item icons for materials without sprite assets
    this.generateItemIcons();

    // Town tilemap: procedural tileset atlas + cached JSON map data
    this.textures.addCanvas('town-tileset', generateTownTilesetCanvas(this));
    this.cache.tilemap.add('town-map', {
      format: Phaser.Tilemaps.Formats.TILED_JSON,
      data: generateTownMapJSON(),
    });

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

  /** Procedurally generate Sand Stalker textures (desert-themed ranged caster) */
  generateSandStalkerTextures() {
    const size = 64;
    const g = this.add.graphics();

    for (const dir of DIRS) {
      g.clear();

      // Sandy outer aura
      g.fillStyle(0xccaa55, 0.12);
      g.fillCircle(size / 2, size / 2, 26);

      // Body — ochre/sand colored humanoid form
      g.fillStyle(0xbb8833, 0.8);
      g.fillEllipse(size / 2, size / 2 + 4, 22, 30);

      // Hooded head
      g.fillStyle(0x997722, 0.9);
      g.fillCircle(size / 2, size / 2 - 8, 10);

      // Dark face opening
      g.fillStyle(0x332211, 0.9);
      g.fillEllipse(size / 2, size / 2 - 6, 8, 6);

      // Glowing eyes based on direction
      const eyeOffsets = {
        'south':      [{ x: -3, y: -7 }, { x: 3, y: -7 }],
        'north':      [{ x: -3, y: -9 }, { x: 3, y: -9 }],
        'east':       [{ x: 2, y: -8 }, { x: 2, y: -5 }],
        'west':       [{ x: -2, y: -8 }, { x: -2, y: -5 }],
        'south-east': [{ x: 0, y: -7 }, { x: 4, y: -6 }],
        'south-west': [{ x: -4, y: -6 }, { x: 0, y: -7 }],
        'north-east': [{ x: 0, y: -9 }, { x: 4, y: -8 }],
        'north-west': [{ x: -4, y: -8 }, { x: 0, y: -9 }],
      };
      const eyes = eyeOffsets[dir] || eyeOffsets['south'];
      g.fillStyle(0xffcc00, 1);
      g.fillCircle(size / 2 + eyes[0].x, size / 2 + eyes[0].y, 2);
      g.fillCircle(size / 2 + eyes[1].x, size / 2 + eyes[1].y, 2);

      // Staff/arm on one side
      g.fillStyle(0x664422, 0.9);
      g.fillRect(size / 2 + 8, size / 2 - 4, 3, 20);
      // Staff orb
      g.fillStyle(0xffaa00, 0.7);
      g.fillCircle(size / 2 + 9, size / 2 - 6, 4);

      // Tattered robe edges
      g.fillStyle(0x886633, 0.4);
      g.fillTriangle(
        size / 2 - 8, size / 2 + 16,
        size / 2 + 8, size / 2 + 16,
        size / 2, size / 2 + 28
      );

      g.generateTexture(`sand-stalker-idle-${dir}-0`, size, size);
    }
    g.destroy();
  }

  /** Generate projectile texture for ranged enemies */
  generateProjectileTexture() {
    const g = this.add.graphics();
    // Sand bolt (10x10)
    g.fillStyle(0xffcc44, 0.9);
    g.fillCircle(5, 5, 5);
    g.fillStyle(0xffee88, 0.7);
    g.fillCircle(5, 5, 3);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(5, 5, 1.5);
    g.generateTexture('projectile-sand', 10, 10);
    g.clear();
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

    // Breakable pot / urn (16x16)
    g.fillStyle(0x8a5a2a, 1);
    g.fillEllipse(8, 10, 12, 12);
    g.fillStyle(0x7a4a1a, 0.9);
    g.fillRect(5, 3, 6, 5);
    g.fillStyle(0x9a6a3a, 0.7);
    g.fillEllipse(8, 9, 8, 8);
    g.fillStyle(0x6a3a10, 0.5);
    g.fillRect(6, 14, 4, 2);
    g.generateTexture('deco-pot', 16, 16);
    g.clear();

    // Broken pot (16x16) — shown after a pot is destroyed
    g.fillStyle(0x6a3a10, 0.7);
    g.fillRect(2, 10, 5, 4);
    g.fillRect(9, 11, 4, 3);
    g.fillStyle(0x8a5a2a, 0.5);
    g.fillTriangle(4, 8, 7, 12, 2, 13);
    g.fillTriangle(10, 7, 13, 11, 8, 12);
    g.fillStyle(0x9a6a3a, 0.3);
    g.fillRect(5, 13, 6, 2);
    g.generateTexture('deco-pot-broken', 16, 16);
    g.clear();

    g.destroy();
  }

  /** Procedurally generate Warden's Keyling textures (small copper key-like creature) */
  generateWardensKeylingTextures() {
    const size = 48;
    const g = this.add.graphics();

    for (const dir of DIRS) {
      g.clear();

      // Copper glow aura
      g.fillStyle(0xcc7744, 0.12);
      g.fillCircle(size / 2, size / 2, 20);

      // Body — compact copper-colored oval
      g.fillStyle(0xbb6633, 0.85);
      g.fillEllipse(size / 2, size / 2 + 2, 18, 22);

      // Metallic sheen
      g.fillStyle(0xdd8844, 0.5);
      g.fillEllipse(size / 2 - 2, size / 2 - 1, 12, 16);

      // Key-shaped crest on head
      g.fillStyle(0xeeaa55, 0.9);
      g.fillCircle(size / 2, size / 2 - 10, 6);
      g.fillStyle(0xcc8833, 0.9);
      g.fillRect(size / 2 - 2, size / 2 - 16, 4, 8);

      // Key teeth (tiny notches at top)
      g.fillStyle(0xeeaa55, 0.8);
      g.fillRect(size / 2 - 4, size / 2 - 17, 2, 3);
      g.fillRect(size / 2 + 2, size / 2 - 17, 2, 3);

      // Eyes — small bright dots based on direction
      const eyeOffsets = {
        'south':      [{ x: -4, y: -2 }, { x: 4, y: -2 }],
        'north':      [{ x: -4, y: -4 }, { x: 4, y: -4 }],
        'east':       [{ x: 2, y: -3 }, { x: 2, y: 1 }],
        'west':       [{ x: -2, y: -3 }, { x: -2, y: 1 }],
        'south-east': [{ x: 0, y: -2 }, { x: 5, y: -1 }],
        'south-west': [{ x: -5, y: -1 }, { x: 0, y: -2 }],
        'north-east': [{ x: 0, y: -4 }, { x: 5, y: -3 }],
        'north-west': [{ x: -5, y: -3 }, { x: 0, y: -4 }],
      };
      const eyes = eyeOffsets[dir] || eyeOffsets['south'];
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(size / 2 + eyes[0].x, size / 2 + eyes[0].y, 2.5);
      g.fillCircle(size / 2 + eyes[1].x, size / 2 + eyes[1].y, 2.5);
      g.fillStyle(0xff6600, 1);
      g.fillCircle(size / 2 + eyes[0].x, size / 2 + eyes[0].y, 1.2);
      g.fillCircle(size / 2 + eyes[1].x, size / 2 + eyes[1].y, 1.2);

      // Small legs/feet at bottom
      g.fillStyle(0x995522, 0.7);
      g.fillRect(size / 2 - 6, size / 2 + 10, 3, 5);
      g.fillRect(size / 2 + 3, size / 2 + 10, 3, 5);

      g.generateTexture(`wardens-keyling-idle-${dir}-0`, size, size);
    }
    g.destroy();
  }

  /** Procedurally generate Scarab Swarm textures (cluster of small beetles) */
  generateScarabSwarmTextures() {
    const size = 40;
    const g = this.add.graphics();

    for (const dir of DIRS) {
      g.clear();

      // Ground shadow / swarm aura
      g.fillStyle(0x334422, 0.15);
      g.fillCircle(size / 2, size / 2, 16);

      // Multiple small beetle bodies
      const positions = [
        { x: 0, y: 0 }, { x: -6, y: -5 }, { x: 6, y: -4 },
        { x: -4, y: 5 }, { x: 5, y: 6 }, { x: -8, y: 1 },
      ];

      for (const pos of positions) {
        const bx = size / 2 + pos.x;
        const by = size / 2 + pos.y;

        // Body
        g.fillStyle(0x445533, 0.9);
        g.fillEllipse(bx, by, 6, 5);

        // Shell shine
        g.fillStyle(0x668844, 0.6);
        g.fillEllipse(bx, by - 1, 4, 3);

        // Tiny eye dots
        g.fillStyle(0xccff66, 0.8);
        g.fillCircle(bx - 1, by - 2, 0.8);
        g.fillCircle(bx + 1, by - 2, 0.8);
      }

      // Generate same texture for idle, walk, and attack (single-frame procedural)
      g.generateTexture(`scarab-swarm-idle-${dir}-0`, size, size);
      g.generateTexture(`scarab-swarm-walk-${dir}-0`, size, size);
      g.generateTexture(`scarab-swarm-attack-${dir}-0`, size, size);
    }
    g.destroy();
  }

  /** Generate procedural item icons for materials that lack sprite assets */
  generateItemIcons() {
    const g = this.add.graphics();

    // Copper Fragment — jagged copper shard (16x16)
    g.clear();
    g.fillStyle(0xcc7744, 0.9);
    g.fillTriangle(3, 13, 8, 1, 13, 11);
    g.fillStyle(0xee9966, 0.7);
    g.fillTriangle(5, 12, 8, 3, 11, 10);
    g.fillStyle(0xffbb88, 0.5);
    g.fillTriangle(7, 10, 8, 5, 9, 9);
    g.generateTexture('item-copper-fragment', 16, 16);
    g.clear();

    g.destroy();
  }

  /** Generate a simple ellipse contact-shadow texture used under entities */
  generateShadowTexture() {
    const w = 24;
    const h = 10;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(w / 2, h / 2, w, h);
    g.generateTexture('entity-shadow', w, h);
    g.destroy();
  }

  /** Phase 2 – Generate a semi-transparent canopy/arch overlay for foreground test. */
  generateCanopyTexture() {
    const w = 64;
    const h = 48;
    const g = this.add.graphics();

    // Dark leafy canopy with alpha so the player can be seen underneath
    g.fillStyle(0x1a3a1a, 0.55);
    g.fillEllipse(w / 2, h / 2, w, h);

    // Leaf clumps
    g.fillStyle(0x264e26, 0.50);
    g.fillEllipse(w * 0.3, h * 0.35, 24, 18);
    g.fillEllipse(w * 0.7, h * 0.55, 22, 16);

    // Highlight
    g.fillStyle(0x3b6e3b, 0.3);
    g.fillEllipse(w * 0.5, h * 0.3, 20, 10);

    g.generateTexture('foreground-canopy', w, h);
    g.destroy();
  }

  /* ================================================================== */
  /*  Phase 3 – Decal & tile-variant textures                           */
  /* ================================================================== */

  /** Generate small ground-decal textures for dungeon rooms. */
  generateDungeonDecalTextures() {
    const g = this.add.graphics();

    // decal-crack (16×16) – thin floor crack lines
    g.clear();
    g.lineStyle(1, 0x1a1a1a, 0.5);
    g.lineBetween(3, 2, 8, 7);
    g.lineBetween(8, 7, 6, 13);
    g.lineBetween(8, 7, 13, 10);
    g.lineStyle(1, 0x222222, 0.35);
    g.lineBetween(5, 5, 2, 10);
    g.generateTexture('decal-crack', 16, 16);
    g.clear();

    // decal-stain (16×16) – dark blotch
    g.fillStyle(0x2a2020, 0.3);
    g.fillCircle(8, 8, 5);
    g.fillStyle(0x221818, 0.2);
    g.fillCircle(7, 9, 3);
    g.generateTexture('decal-stain', 16, 16);
    g.clear();

    // decal-dust (16×16) – scattered dust specks
    g.fillStyle(0x888877, 0.25);
    g.fillRect(2, 4, 2, 1);
    g.fillRect(7, 2, 1, 2);
    g.fillRect(12, 6, 2, 1);
    g.fillRect(5, 11, 1, 2);
    g.fillRect(10, 12, 2, 1);
    g.fillRect(3, 8, 1, 1);
    g.generateTexture('decal-dust', 16, 16);
    g.clear();

    // decal-rubble (16×16) – small stone fragments
    g.fillStyle(0x555555, 0.4);
    g.fillRect(3, 7, 3, 2);
    g.fillRect(9, 5, 2, 3);
    g.fillStyle(0x666666, 0.3);
    g.fillRect(6, 10, 4, 2);
    g.fillRect(11, 9, 2, 2);
    g.generateTexture('decal-rubble', 16, 16);
    g.clear();

    g.destroy();
  }

  /** Generate small ground-decal textures for the town. */
  generateTownDecalTextures() {
    const g = this.add.graphics();

    // decal-leaf (16×16) – fallen leaf
    g.clear();
    g.fillStyle(0x6b8e23, 0.4);
    g.fillEllipse(8, 7, 8, 5);
    g.fillStyle(0x556b2f, 0.3);
    g.fillEllipse(9, 8, 5, 3);
    g.lineStyle(1, 0x3b5e1a, 0.3);
    g.lineBetween(5, 7, 12, 7);
    g.generateTexture('decal-leaf', 16, 16);
    g.clear();

    // decal-weed (16×16) – small weed tuft
    g.fillStyle(0x4a7a2a, 0.4);
    g.fillTriangle(8, 2, 5, 12, 11, 12);
    g.fillStyle(0x3a6a1a, 0.3);
    g.fillTriangle(6, 4, 3, 13, 9, 13);
    g.generateTexture('decal-weed', 16, 16);
    g.clear();

    // decal-puddle (16×16) – tiny water puddle
    g.fillStyle(0x4488aa, 0.2);
    g.fillEllipse(8, 9, 10, 6);
    g.fillStyle(0x66aacc, 0.15);
    g.fillEllipse(7, 8, 6, 3);
    g.generateTexture('decal-puddle', 16, 16);
    g.clear();

    g.destroy();
  }

  /**
   * Generate dungeon floor tile variants (dungeon-floor-v0 … v3).
   * Each variant is a copy of the base 'dungeon-floor' texture with
   * small procedural differences drawn on top so that adjacent tiles
   * don't look identical.
   */
  generateDungeonFloorVariants() {
    const ts = 32;
    const base = this.textures.get('dungeon-floor');
    const baseSource = base.getSourceImage();

    for (let v = 0; v < 4; v++) {
      const canvas = document.createElement('canvas');
      canvas.width = ts;
      canvas.height = ts;
      const ctx = canvas.getContext('2d');

      // Draw the original floor tile
      ctx.drawImage(baseSource, 0, 0, ts, ts);

      // Overlay small procedural marks per variant
      ctx.globalAlpha = 0.08 + v * 0.03;
      ctx.fillStyle = v % 2 === 0 ? '#222222' : '#444433';
      // Each variant has marks at different positions
      const offsets = [
        [{ x: 3, y: 5, w: 4, h: 2 }, { x: 18, y: 20, w: 3, h: 3 }],
        [{ x: 10, y: 3, w: 5, h: 2 }, { x: 22, y: 14, w: 4, h: 2 }],
        [{ x: 2, y: 16, w: 3, h: 3 }, { x: 20, y: 6, w: 4, h: 2 }],
        [{ x: 14, y: 24, w: 4, h: 2 }, { x: 6, y: 10, w: 3, h: 3 }],
      ];
      for (const mark of offsets[v]) {
        ctx.fillRect(mark.x, mark.y, mark.w, mark.h);
      }

      ctx.globalAlpha = 1;
      this.textures.addCanvas(`dungeon-floor-v${v}`, canvas);
    }
  }

  /**
   * Generate town grass tile variants (town-grass-v0 … v2).
   */
  generateTownGrassVariants() {
    const ts = 32;
    const base = this.textures.get('town-grass');
    const baseSource = base.getSourceImage();

    for (let v = 0; v < 3; v++) {
      const canvas = document.createElement('canvas');
      canvas.width = ts;
      canvas.height = ts;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(baseSource, 0, 0, ts, ts);

      // Subtle grass-blade / shade marks per variant
      ctx.globalAlpha = 0.06 + v * 0.02;
      ctx.fillStyle = v % 2 === 0 ? '#1a3a0a' : '#2a4a1a';
      const offsets = [
        [{ x: 4, y: 8, w: 2, h: 4 }, { x: 20, y: 18, w: 3, h: 3 }],
        [{ x: 12, y: 4, w: 3, h: 3 }, { x: 24, y: 22, w: 2, h: 4 }],
        [{ x: 6, y: 20, w: 4, h: 2 }, { x: 16, y: 6, w: 2, h: 4 }],
      ];
      for (const mark of offsets[v]) {
        ctx.fillRect(mark.x, mark.y, mark.w, mark.h);
      }

      ctx.globalAlpha = 1;
      this.textures.addCanvas(`town-grass-v${v}`, canvas);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Phase 4 – Light-pool radial gradient texture                       */
  /* ------------------------------------------------------------------ */
  generateLightPoolTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(255, 220, 140, 0.7)');
    grad.addColorStop(0.3, 'rgba(255, 180, 80, 0.35)');
    grad.addColorStop(0.7, 'rgba(255, 140, 40, 0.08)');
    grad.addColorStop(1, 'rgba(255, 120, 20, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    this.textures.addCanvas('light-pool', canvas);
  }

  /* ------------------------------------------------------------------ */
  /*  Phase 7 – Light-mask texture for dark-overlay cutouts              */
  /* ------------------------------------------------------------------ */
  generateLightMaskTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.9)');
    grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.4)');
    grad.addColorStop(0.85, 'rgba(255, 255, 255, 0.1)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    this.textures.addCanvas('light-mask', canvas);
  }

  /* ---- Phase 5: particle textures for decorative emitters ---- */

  generateParticleTextures() {
    // Small white square (4×4) – tinted at runtime for falling leaves
    {
      const c = document.createElement('canvas');
      c.width = 4; c.height = 4;
      const x = c.getContext('2d');
      x.fillStyle = '#ffffff';
      x.fillRect(0, 0, 4, 4);
      this.textures.addCanvas('particle-square', c);
    }

    // Small white circle (4×4) – pollen / firefly dots
    {
      const c = document.createElement('canvas');
      c.width = 4; c.height = 4;
      const x = c.getContext('2d');
      x.fillStyle = '#ffffff';
      x.beginPath();
      x.arc(2, 2, 2, 0, Math.PI * 2);
      x.fill();
      this.textures.addCanvas('particle-dot', c);
    }

    // Soft glow (6×6) – radial gradient for torch flame flicker
    {
      const c = document.createElement('canvas');
      c.width = 6; c.height = 6;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(3, 3, 0, 3, 3, 3);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.4, '#ffcc44');
      g.addColorStop(1, 'rgba(255,100,0,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 6, 6);
      this.textures.addCanvas('particle-flame', c);
    }
  }
}
