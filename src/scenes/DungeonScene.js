import Phaser from 'phaser';
import { GAME_CONFIG, getDirection, getAdaptiveZoom } from '../config.js';
import { RoomGraph } from '../systems/RoomGraph.js';
import { DungeonGenerator } from '../systems/DungeonGenerator.js';
import { ThreatBudgetSpawner } from '../systems/ThreatBudgetSpawner.js';
import { LootSystem } from '../systems/LootSystem.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { ENEMY_DATA } from '../data/enemies.js';
import { EquipmentSystem } from '../systems/EquipmentSystem.js';
import { CraftingSystem } from '../systems/CraftingSystem.js';
import { ITEM_DATA } from '../data/items.js';
import { StatusEffectSystem } from '../systems/StatusEffectSystem.js';
import { RunStats } from '../systems/RunStats.js';
import { AbilitySystem, ABILITIES } from '../systems/AbilitySystem.js';
import { getRandomDescription } from '../data/roomDescriptions.js';
import { pickFloorModifier } from '../data/floorModifiers.js';
import { updateEntityDepth, updateAllDepths, snapCameraScroll } from '../systems/DepthManager.js';
import { LayerManager, FOREGROUND_DEPTH } from '../systems/LayerManager.js';
import { Decorator } from '../systems/Decorator.js';
import { SeededRNG } from '../utils/SeededRNG.js';
import { LightManager } from '../systems/LightManager.js';

export class DungeonScene extends Phaser.Scene {
  constructor() {
    super('DungeonScene');
  }

  init(data) {
    this.currentFloor = data.floor || 1;
    this.levelSystem = this.registry.get('levelSystem');
    this.inventory = this.registry.get('inventory');
    this.equipmentSystem = this.registry.get('equipmentSystem');
    this.statusEffects = this.registry.get('statusEffects');
    if (!this.statusEffects) {
      this.statusEffects = new StatusEffectSystem();
      this.registry.set('statusEffects', this.statusEffects);
    }
    if (this.levelSystem && !this.levelSystem.statusEffects) {
      this.levelSystem.statusEffects = this.statusEffects;
    }
    this.runStats = this.registry.get('runStats');
    if (!this.runStats) {
      this.runStats = new RunStats();
      this.registry.set('runStats', this.runStats);
    }
    // Record floor on entry
    this.runStats.recordFloorDescended(this.currentFloor);
    // Pick floor modifier for this floor
    this.floorModifier = pickFloorModifier(this.currentFloor);
    // Ability system
    this.abilitySystem = this.registry.get('abilitySystem');
    if (!this.abilitySystem) {
      this.abilitySystem = new AbilitySystem();
      this.registry.set('abilitySystem', this.abilitySystem);
    }
  }

  create() {
    this.tileSize = GAME_CONFIG.TILE_SIZE;

    // ---- Generate floor graph ----
    const graph = RoomGraph.generate(this.currentFloor);
    this.graph = graph;

    // Room state
    this.currentRoomId = 0;
    this.activeCombatRoom = -1;
    this.roomEnemies = {};
    this.waveQueue = [];     // remaining waves for active combat room
    this.waveActive = false;
    this.waveSpawning = false;

    // Create tile textures (same as before)
    this.createTileTextures();

    // Phase 2 – layered rendering
    this.layerManager = new LayerManager(this);

    // Phase 4 – 2D lighting (persists across room loads; lights recreated per room)
    this.lightManager = new LightManager(this);
    this.lightManager.createVignette();

    // Phase 7 – dark overlay with player light radius + cool blue-grey color grade
    this.lightManager.createDarkOverlay({ darkness: 0.55 });
    this.lightManager.createColorGrade(0x8899bb, 0.07);

    // Create persistent groups (reused across room loads)
    this.enemies = this.physics.add.group();
    this.doorGroup = this.physics.add.staticGroup();
    this.wallLayer = this.physics.add.staticGroup();
    this.floorGroup = this.add.group();
    this.projectiles = this.physics.add.group();
    this._wallImages = [];
    this._colliders = [];

    // Load the starting room
    this.loadRoom(this.currentRoomId);

    // Camera — adaptive zoom based on screen size for better mobile experience
    this.cameras.main.setZoom(getAdaptiveZoom(this.scale.width));

    // E key
    this.interactKey = this.input.keyboard.addKey('E');
    this.potionKey = this.input.keyboard.addKey('Q');

    // Combat events
    this.events.on('playerAttack', this.handlePlayerAttack, this);
    this.events.on('enemyDeath', this.handleEnemyDeath, this);
    this.events.on('playerDeath', this.handlePlayerDeath, this);
    this.events.on('playerDamageTaken', (amount) => {
      this.runStats.recordDamageTaken(amount);
      this._shakeCamera();
    });
    this.events.on('enemyRangedAttack', this._handleRangedAttack, this);
    this.events.on('useAbility', this._handleAbility, this);

    // Build node minimap
    this.createNodeMinimap();

    // Announce floor modifier (if not calm)
    if (this.floorModifier && this.floorModifier.id !== 'none') {
      this._showFloorModifierAnnouncement();
    }

    // Initial UI
    this.updateUI();
  }

  // ===================== TILE TEXTURES (unchanged) =====================
  createTileTextures() {
    const ts = this.tileSize;
    const g = this.add.graphics();

    // Wall
    g.fillStyle(0x2a1a3a, 1);
    g.fillRect(0, 0, ts, ts);
    g.lineStyle(1, 0x1a0e28, 0.8);
    g.lineBetween(0, 8, ts, 8);
    g.lineBetween(0, 16, ts, 16);
    g.lineBetween(0, 24, ts, 24);
    g.lineBetween(8, 0, 8, 8);
    g.lineBetween(24, 0, 24, 8);
    g.lineBetween(16, 8, 16, 16);
    g.lineBetween(0, 8, 0, 16);
    g.lineBetween(8, 16, 8, 24);
    g.lineBetween(24, 16, 24, 24);
    g.lineBetween(16, 24, 16, 32);
    g.fillStyle(0x3f2852, 0.4);
    g.fillRect(1, 1, ts - 2, 1);
    g.fillRect(1, 9, ts - 2, 1);
    g.fillRect(1, 17, ts - 2, 1);
    g.fillRect(1, 25, ts - 2, 1);
    g.fillStyle(0x150b20, 0.5);
    g.fillRect(0, 7, ts, 1);
    g.fillRect(0, 15, ts, 1);
    g.fillRect(0, 23, ts, 1);
    g.lineStyle(1, 0x3a2a4a, 0.3);
    g.strokeRect(0, 0, ts, ts);
    g.generateTexture('tile-wall', ts, ts);
    g.clear();

    // Stairs
    g.fillStyle(0x6a5a3a, 1);
    g.fillRect(0, 0, ts, ts);
    g.fillStyle(0x9a8a5a, 1);
    g.fillRect(2, 2, 28, 5);
    g.fillRect(4, 9, 24, 5);
    g.fillRect(6, 16, 20, 5);
    g.fillRect(8, 23, 16, 5);
    g.fillStyle(0x4a3a1a, 0.8);
    g.fillRect(2, 7, 28, 2);
    g.fillRect(4, 14, 24, 2);
    g.fillRect(6, 21, 20, 2);
    g.fillRect(8, 28, 16, 2);
    g.fillStyle(0xbaa86a, 0.5);
    g.fillRect(2, 2, 28, 1);
    g.fillRect(4, 9, 24, 1);
    g.fillRect(6, 16, 20, 1);
    g.fillRect(8, 23, 16, 1);
    g.generateTexture('tile-stairs', ts, ts);
    g.clear();

    // Door
    g.fillStyle(0x5a3a1a, 1);
    g.fillRect(0, 0, ts, ts);
    g.fillStyle(0x6a4a2a, 1);
    g.fillRect(2, 2, 12, 28);
    g.fillRect(18, 2, 12, 28);
    g.fillStyle(0x888888, 1);
    g.fillRect(1, 6, 30, 2);
    g.fillRect(1, 16, 30, 2);
    g.fillRect(1, 24, 30, 2);
    g.fillStyle(0xccaa44, 1);
    g.fillRect(22, 14, 4, 4);
    g.lineStyle(1, 0x3a2a0a, 1);
    g.strokeRect(0, 0, ts, ts);
    g.generateTexture('tile-door', ts, ts);
    g.clear();

    // Locked door
    g.fillStyle(0x3a2010, 1);
    g.fillRect(0, 0, ts, ts);
    g.fillStyle(0x4a3020, 1);
    g.fillRect(2, 2, 12, 28);
    g.fillRect(18, 2, 12, 28);
    g.fillStyle(0x666666, 1);
    g.fillRect(1, 6, 30, 2);
    g.fillRect(1, 16, 30, 2);
    g.fillRect(1, 24, 30, 2);
    g.fillStyle(0xff4444, 1);
    g.fillRect(13, 12, 6, 8);
    g.fillStyle(0xcc3333, 1);
    g.fillRect(14, 9, 4, 4);
    g.lineStyle(1, 0x2a1008, 1);
    g.strokeRect(0, 0, ts, ts);
    g.generateTexture('tile-door-locked', ts, ts);
    g.clear();

    // Crafting bench
    g.fillStyle(0x5a4020, 1);
    g.fillRect(0, 4, ts, ts - 4);
    g.fillStyle(0x7a5a30, 1);
    g.fillRect(0, 0, ts, 8);
    g.fillStyle(0x4a3018, 1);
    g.fillRect(2, 8, 4, 22);
    g.fillRect(26, 8, 4, 22);
    g.fillStyle(0xaaaaaa, 1);
    g.fillRect(8, 1, 3, 5);
    g.fillRect(14, 2, 6, 3);
    g.fillStyle(0xccaa44, 1);
    g.fillRect(22, 1, 4, 4);
    g.generateTexture('tile-crafting-bench', ts, ts);
    g.clear();

    // Treasure chest
    g.fillStyle(0x8a6a2a, 1);
    g.fillRect(4, 8, ts - 8, ts - 12);
    g.fillStyle(0xa47a3a, 1);
    g.fillRect(4, 8, ts - 8, 6);
    g.fillStyle(0x6a4a1a, 1);
    g.fillRect(4, 14, ts - 8, 2);
    g.fillStyle(0xccaa44, 1);
    g.fillRect(ts / 2 - 3, 12, 6, 6);
    g.lineStyle(1, 0x5a3a0a, 1);
    g.strokeRect(4, 8, ts - 8, ts - 12);
    g.generateTexture('tile-chest', ts, ts);
    g.clear();

    // Opened chest
    g.fillStyle(0x6a4a1a, 1);
    g.fillRect(4, 12, ts - 8, ts - 16);
    g.fillStyle(0x8a6a2a, 1);
    g.fillRect(4, 4, ts - 8, 10);
    g.fillStyle(0x5a3a0a, 0.5);
    g.fillRect(6, 14, ts - 12, ts - 20);
    g.lineStyle(1, 0x5a3a0a, 1);
    g.strokeRect(4, 4, ts - 8, ts - 8);
    g.generateTexture('tile-chest-open', ts, ts);
    g.clear();

    // Campfire (for rest rooms)
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(0, 0, ts, ts);
    // Logs
    g.fillStyle(0x5a3a18, 1);
    g.fillRect(6, 20, 20, 5);
    g.fillRect(10, 18, 12, 4);
    // Flame layers
    g.fillStyle(0xff4400, 0.9);
    g.fillRect(10, 8, 12, 14);
    g.fillStyle(0xff8800, 0.8);
    g.fillRect(12, 6, 8, 12);
    g.fillStyle(0xffcc00, 0.7);
    g.fillRect(13, 8, 6, 8);
    g.fillStyle(0xffee66, 0.5);
    g.fillRect(14, 10, 4, 4);
    // Ember glow on ground
    g.fillStyle(0xff6600, 0.3);
    g.fillRect(4, 22, 24, 6);
    g.generateTexture('tile-campfire', ts, ts);
    g.clear();

    // Merchant marker
    g.fillStyle(0x1a1a2e, 1);
    g.fillRect(0, 0, ts, ts);
    // Cart/stall
    g.fillStyle(0x6a4a2a, 1);
    g.fillRect(2, 14, ts - 4, 14);
    g.fillStyle(0x8a6a3a, 1);
    g.fillRect(2, 10, ts - 4, 6);
    // Canopy
    g.fillStyle(0xaa3333, 0.8);
    g.fillRect(0, 2, ts, 10);
    g.fillStyle(0xcc5555, 0.6);
    g.fillRect(0, 2, 8, 10);
    g.fillRect(16, 2, 8, 10);
    // Wares on counter
    g.fillStyle(0x44ff88, 0.7);
    g.fillRect(6, 15, 5, 5);
    g.fillStyle(0xff6644, 0.7);
    g.fillRect(14, 16, 4, 4);
    g.fillStyle(0xffdd44, 0.7);
    g.fillRect(22, 15, 4, 5);
    g.generateTexture('tile-merchant', ts, ts);
    g.clear();

    // Spike trap (subtle floor marking)
    g.fillStyle(0x2a2a2a, 1);
    g.fillRect(0, 0, ts, ts);
    g.fillStyle(0x3a3a3a, 0.6);
    g.fillRect(4, 4, ts - 8, ts - 8);
    // Spike tips
    g.fillStyle(0x888888, 0.5);
    g.fillRect(8, 8, 4, 4);
    g.fillRect(20, 8, 4, 4);
    g.fillRect(14, 14, 4, 4);
    g.fillRect(8, 20, 4, 4);
    g.fillRect(20, 20, 4, 4);
    g.generateTexture('tile-trap', ts, ts);
    g.clear();

    // Activated trap (red glow)
    g.fillStyle(0x2a2a2a, 1);
    g.fillRect(0, 0, ts, ts);
    g.fillStyle(0x661111, 0.8);
    g.fillRect(2, 2, ts - 4, ts - 4);
    // Raised spikes
    g.fillStyle(0xaaaaaa, 0.9);
    g.fillRect(7, 6, 5, 8);
    g.fillRect(19, 6, 5, 8);
    g.fillRect(13, 12, 5, 8);
    g.fillRect(7, 18, 5, 8);
    g.fillRect(19, 18, 5, 8);
    g.generateTexture('tile-trap-active', ts, ts);
    g.clear();

    g.destroy();
  }

  // ===================== ROOM LOADING =====================

  /** Tear down current room objects and build the new room */
  loadRoom(roomId, entryDirection) {
    // Clear previous room objects
    this._destroyRoomObjects();

    const node = this.graph.rooms[roomId];
    this.currentRoomId = roomId;
    node.visited = true;

    // Determine special furniture
    const isStartRoom = roomId === 0;
    const lastRoom = this.graph.rooms[this.graph.rooms.length - 1];
    const hasStairs = (roomId === lastRoom.id);
    const hasCraftingBench = isStartRoom;

    // Generate tilemap for this room
    const roomData = DungeonGenerator.generateRoom(node, { hasStairs, hasCraftingBench, floor: this.currentFloor });
    this.roomData = roomData;

    // Build tilemap visuals & physics
    this._buildTilemap(roomData);

    // Phase 3 – deterministic decal dressing
    this._decalImages = [];
    const decalSeed = SeededRNG.roomSeed(this.currentFloor, roomId);
    const floorTint = this._getFloorTint();
    this._decalImages = Decorator.decorateDungeonRoom(
      this, roomData, this.layerManager, this.tileSize, decalSeed, floorTint,
    );

    // Stairs
    this.stairs = null;
    if (roomData.stairsPos) {
      this._createStairs(roomData.stairsPos);
    }

    // Crafting bench
    this.craftingBench = null;
    this.craftingBenchPrompt = null;
    if (roomData.craftingBenchPos) {
      this._createCraftingBench(roomData.craftingBenchPos);
    }

    // Treasure chest
    this.treasureChest = null;
    this.treasureChestPrompt = null;
    this.treasureChestOpened = false;
    if (node.type === 'treasure' && !node.chestLooted) {
      this._createTreasureChest(roomData);
    }

    // Campfire (rest rooms)
    this.campfire = null;
    this.campfirePrompt = null;
    this.campfireUsed = !!node.campfireUsed;
    if (node.type === 'rest') {
      this._createCampfire(roomData);
    }

    // Merchant (merchant rooms)
    this.merchant = null;
    this.merchantPrompt = null;
    if (node.type === 'merchant') {
      this._createMerchant(roomData);
    }

    // Traps
    this.traps = [];
    if (roomData.trapPositions && roomData.trapPositions.length > 0) {
      this._createTraps(roomData.trapPositions);
    }

    // Decorations
    this.decorations = [];
    if (roomData.decorations && roomData.decorations.length > 0) {
      this._createDecorations(roomData.decorations);
    }

    // Breakable pots
    this.pots = [];
    if (roomData.potPositions && roomData.potPositions.length > 0) {
      this._createPots(roomData.potPositions);
    }

    // Phase 2 – foreground canopy overlay (acceptance test: renders above player)
    this._foregroundOverlays = [];
    this._createForegroundOverlays(roomData);

    // Doors
    this.doors = [];
    this._createDoors(node, roomData);

    // Player
    const spawnTile = entryDirection
      ? this._entryTile(entryDirection, roomData)
      : roomData.spawnPos;

    const px = spawnTile.x * this.tileSize + this.tileSize / 2;
    const py = spawnTile.y * this.tileSize + this.tileSize / 2;

    if (!this.player) {
      this.player = new Player(this, px, py, this.levelSystem);
    } else {
      this.player.setPosition(px, py);
      this.player.setVelocity(0, 0);
    }
    // Pass floor modifier to player for damage calculations
    this.player.floorModifier = this.floorModifier || null;

    // Collisions (track so we can clean them up on next room load)
    this._colliders = [
      this.physics.add.collider(this.player, this.wallLayer),
      this.physics.add.collider(this.enemies, this.wallLayer),
      this.physics.add.collider(this.player, this.doorGroup),
      this.physics.add.collider(this.enemies, this.doorGroup),
      this.physics.add.overlap(this.projectiles, this.player, this._onProjectileHitPlayer, null, this),
      this.physics.add.collider(this.projectiles, this.wallLayer, this._onProjectileHitWall, null, this),
    ];

    // Camera
    const worldW = roomData.width * this.tileSize;
    const worldH = roomData.height * this.tileSize;
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    // Depth is managed by DepthManager y-sort; initial kick via updateEntityDepth
    updateEntityDepth(this.player);

    // Phase 7 – attach light radius to player (update ref each room load in case player was recreated)
    if (this.lightManager) {
      this.lightManager.setPlayerLight(this.player, { radius: 2.0 });
    }

    // If this room has enemies and isn't cleared, start combat
    if (!node.cleared && node.type !== 'rest' && node.type !== 'treasure' && node.type !== 'merchant') {
      this._beginRoomCombat(roomId);
    } else {
      // Room is clear – doors are interactable
      this._unlockAllDoors();
    }

    // Update minimap
    if (this.nodeMapGfx) this._redrawNodeMinimap();

    // Show room atmosphere text
    if (roomId !== 0) {
      this._showRoomAtmosphere(node.type);
    }
  }

  /** Destroy all room-specific game objects */
  _destroyRoomObjects() {
    // Clear layer manager references (objects destroyed below by scene code)
    if (this.layerManager) this.layerManager.clearAll();
    // Remove colliders from previous room
    if (this._colliders) {
      for (const c of this._colliders) c.destroy();
    }
    this._colliders = [];

    // Tiles
    if (this.floorGroup) { this.floorGroup.clear(true, true); }
    if (this.wallLayer) { this.wallLayer.clear(true, true); }

    // Enemies
    this.enemies.clear(true, true);
    this.roomEnemies = {};
    this.waveQueue = [];
    this.waveActive = false;
    this.waveSpawning = false;

    // Projectiles
    if (this.projectiles) {
      this.projectiles.clear(true, true);
    }

    // Doors
    this.doorGroup.clear(true, true);
    if (this.doors) {
      for (const d of this.doors) {
        if (d.prompt) d.prompt.destroy();
      }
    }
    this.doors = [];

    // Stairs
    if (this.stairs) { this.stairs.destroy(); this.stairs = null; }
    if (this.stairsPrompt) { this.stairsPrompt.destroy(); this.stairsPrompt = null; }

    // Crafting bench
    if (this.craftingBench) { this.craftingBench.destroy(); this.craftingBench = null; }
    if (this.craftingBenchPrompt) { this.craftingBenchPrompt.destroy(); this.craftingBenchPrompt = null; }

    // Treasure chest
    if (this.treasureChest) { this.treasureChest.destroy(); this.treasureChest = null; }
    if (this.treasureChestPrompt) { this.treasureChestPrompt.destroy(); this.treasureChestPrompt = null; }

    // Campfire
    if (this.campfire) { this.campfire.destroy(); this.campfire = null; }
    if (this.campfirePrompt) { this.campfirePrompt.destroy(); this.campfirePrompt = null; }
    if (this._campfireGlow) { this._campfireGlow.destroy(); this._campfireGlow = null; }

    // Merchant
    if (this.merchant) { this.merchant.destroy(); this.merchant = null; }
    if (this.merchantPrompt) { this.merchantPrompt.destroy(); this.merchantPrompt = null; }
    if (this._merchantLabel) { this._merchantLabel.destroy(); this._merchantLabel = null; }

    // Traps
    if (this.traps) {
      for (const trap of this.traps) {
        if (trap.sprite) trap.sprite.destroy();
      }
    }
    this.traps = [];

    // Decorations
    if (this.decorations) {
      for (const deco of this.decorations) {
        if (deco.sprite) deco.sprite.destroy();
        if (deco.glow) deco.glow.destroy();
      }
    }
    this.decorations = [];

    // Breakable pots
    if (this.pots) {
      for (const pot of this.pots) {
        if (pot.sprite) pot.sprite.destroy();
      }
    }
    this.pots = [];

    // Foreground overlays
    if (this._foregroundOverlays) {
      for (const img of this._foregroundOverlays) img.destroy();
    }
    this._foregroundOverlays = [];

    // Phase 3 – decal images
    if (this._decalImages) {
      for (const img of this._decalImages) img.destroy();
    }
    this._decalImages = [];

    // Phase 4 – room light pools (vignette persists across rooms)
    if (this.lightManager) {
      this.lightManager.clearLights();
      // Phase 7 – clear per-room overlay lights (player light persists)
      this.lightManager.clearOverlayLights();
    }

    // Wall visuals stored separately
    if (this._wallImages) {
      for (const img of this._wallImages) img.destroy();
    }
    this._wallImages = [];
  }

  /** Build floor + wall tiles from roomData.map */
  _buildTilemap(roomData) {
    // Progressive floor tint: deeper floors get darker / more ominous
    const floorTint = this._getFloorTint();

    // Seeded RNG for tile-variant selection (same seed → same variants)
    const variantRng = new SeededRNG(
      SeededRNG.roomSeed(this.currentFloor, this.currentRoomId) + 7,
    );

    for (let y = 0; y < roomData.height; y++) {
      for (let x = 0; x < roomData.width; x++) {
        const px = x * this.tileSize + this.tileSize / 2;
        const py = y * this.tileSize + this.tileSize / 2;
        const tile = roomData.map[y][x];

        if (tile === 0 || tile === 2) {
          const texKey = Decorator.dungeonFloorVariant(variantRng);
          const floor = this.add.image(px, py, texKey);
          if (floorTint !== null) floor.setTint(floorTint);
          this.layerManager.addToLayer('groundLayer', floor);
          this.floorGroup.add(floor);
        }
        if (tile === 1) {
          // Only add wall physics if adjacent to a floor tile
          if (this._isAdjacentToFloor(roomData.map, x, y)) {
            const wallImg = this.add.image(px, py, 'tile-wall');
            if (floorTint !== null) wallImg.setTint(floorTint);
            this.layerManager.addToLayer('propsLowLayer', wallImg);
            this._wallImages.push(wallImg);

            const wall = this.physics.add.staticImage(px, py, 'tile-wall');
            wall.setVisible(false);
            wall.body.setSize(this.tileSize, this.tileSize);
            this.wallLayer.add(wall);
          }
        }
      }
    }
  }

  /** Return a tint color based on current floor depth, or null for floor 1 */
  _getFloorTint() {
    if (this.currentFloor <= 1) return null;
    // Gradual shift: floors 2-4 blue-gray, 5-7 green-tinged, 8+ reddish
    const depth = Math.min(this.currentFloor, 10);
    if (depth <= 4) {
      // Cool blue-gray tint (progressively darker)
      const intensity = 1 - (depth - 1) * 0.06;
      const r = Math.floor(intensity * 0.85 * 255);
      const g = Math.floor(intensity * 0.88 * 255);
      const b = Math.floor(intensity * 255);
      return (r << 16) | (g << 8) | b;
    } else if (depth <= 7) {
      // Eerie green tint
      const intensity = 1 - (depth - 1) * 0.05;
      const r = Math.floor(intensity * 0.8 * 255);
      const g = Math.floor(intensity * 0.95 * 255);
      const b = Math.floor(intensity * 0.75 * 255);
      return (r << 16) | (g << 8) | b;
    } else {
      // Deep crimson tint
      const intensity = 1 - (depth - 1) * 0.04;
      const r = Math.floor(intensity * 255);
      const g = Math.floor(intensity * 0.7 * 255);
      const b = Math.floor(intensity * 0.7 * 255);
      return (r << 16) | (g << 8) | b;
    }
  }

  _isAdjacentToFloor(map, x, y) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const ny = y + dy;
        const nx = x + dx;
        if (ny >= 0 && ny < map.length && nx >= 0 && nx < map[0].length) {
          if (map[ny][nx] === 0 || map[ny][nx] === 2) return true;
        }
      }
    }
    return false;
  }

  // ===================== DOORS =====================

  _createDoors(node, roomData) {
    for (const dir of Object.keys(roomData.doorPositions)) {
      const dp = roomData.doorPositions[dir];
      const doorX = dp.tileX * this.tileSize + this.tileSize / 2;
      const doorY = dp.tileY * this.tileSize + this.tileSize / 2;

      const doorSprite = this.physics.add.staticImage(doorX, doorY, 'tile-door');
      this.layerManager.addToLayer('propsSolidLayer', doorSprite);
      doorSprite.body.setSize(this.tileSize, this.tileSize);
      this.doorGroup.add(doorSprite);

      this.doors.push({
        sprite: doorSprite,
        direction: dir,
        tileX: dp.tileX,
        tileY: dp.tileY,
        edgeId: dp.edgeId,
        targetRoom: dp.targetRoom,
        state: 'closed', // will be locked during combat
        prompt: null,
      });
    }
  }

  _lockAllDoors() {
    for (const door of this.doors) {
      door.state = 'locked';
      door.sprite.setTexture('tile-door-locked');
      door.sprite.setVisible(true);
      door.sprite.body.enable = true;
      if (door.prompt) { door.prompt.destroy(); door.prompt = null; }
    }
  }

  _unlockAllDoors() {
    for (const door of this.doors) {
      door.state = 'closed';
      door.sprite.setTexture('tile-door');
      door.sprite.setVisible(true);
      door.sprite.body.enable = true;
    }
  }

  // ===================== DOOR TRANSITION (fade) =====================

  _openDoor(door) {
    if (door.prompt) { door.prompt.destroy(); door.prompt = null; }

    const targetRoomId = door.targetRoom;
    const targetNode = this.graph.rooms[targetRoomId];

    // Determine entry direction into the target room: the door that leads back here
    const returnDoor = targetNode.doors.find(d => d.targetRoom === this.currentRoomId);
    const entryDir = returnDoor ? returnDoor.direction : null;

    // Fade out → load new room → fade in (snappy 150ms for responsive feel)
    this.cameras.main.fadeOut(150, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.loadRoom(targetRoomId, entryDir);
      this.cameras.main.fadeIn(150, 0, 0, 0);
    });
  }

  /** Get spawn tile inside room when entering from a given door direction */
  _entryTile(direction, roomData) {
    const dp = roomData.doorPositions[direction];
    if (!dp) return roomData.spawnPos;
    // Step 2 tiles inside from the door
    switch (direction) {
      case 'north': return { x: dp.tileX, y: dp.tileY + 2 };
      case 'south': return { x: dp.tileX, y: dp.tileY - 2 };
      case 'east':  return { x: dp.tileX - 2, y: dp.tileY };
      case 'west':  return { x: dp.tileX + 2, y: dp.tileY };
      default: return roomData.spawnPos;
    }
  }

  // ===================== COMBAT =====================

  _beginRoomCombat(roomId) {
    const node = this.graph.rooms[roomId];
    const plan = ThreatBudgetSpawner.plan(this.currentFloor, node.type);

    if (plan.waves.length === 0) {
      node.cleared = true;
      this._unlockAllDoors();
      return;
    }

    this.activeCombatRoom = roomId;
    this.roomEnemies[roomId] = [];

    // Lock doors
    this._lockAllDoors();

    // Queue waves
    this.waveQueue = plan.waves.slice(); // shallow copy
    this._spawnNextWave(roomId);

    // Popup
    const room = this.roomData;
    const rx = Math.floor(room.width / 2) * this.tileSize + this.tileSize / 2;
    const ry = Math.floor(room.height / 2) * this.tileSize;
    this.showPopup(rx, ry - 20, 'Enemies appear!', '#ff6644');
  }

  _spawnNextWave(roomId) {
    if (this.waveQueue.length === 0) return;

    const wave = this.waveQueue.shift();
    this.waveActive = true;

    const room = this.roomData;
    for (const spawn of wave) {
      // Pick random floor tile inside the room (avoid borders & obstacles)
      let ex, ey, attempts = 0;
      do {
        ex = Phaser.Math.Between(2, room.width - 3);
        ey = Phaser.Math.Between(2, room.height - 3);
        attempts++;
      } while (room.map[ey][ex] !== 0 && attempts < 30);

      const epx = ex * this.tileSize + this.tileSize / 2;
      const epy = ey * this.tileSize + this.tileSize / 2;
      const enemy = new Enemy(this, epx, epy, spawn.type, {
        isBoss: !!spawn.isBoss,
        floorModifier: this.floorModifier,
      });
      enemy.roomIndex = roomId;
      this.enemies.add(enemy);
      if (!this.roomEnemies[roomId]) this.roomEnemies[roomId] = [];
      this.roomEnemies[roomId].push(enemy);
    }
  }

  _checkCombatCleared() {
    if (this.activeCombatRoom < 0) return;
    if (this.waveSpawning) return; // prevent rapid successive wave spawns
    const roomId = this.activeCombatRoom;
    const alive = (this.roomEnemies[roomId] || []).filter(
      e => e.active && e.state !== 'dead'
    );

    // Wave threshold: spawn next wave when few enemies remain
    if (alive.length <= GAME_CONFIG.WAVE_THRESHOLD && this.waveQueue.length > 0) {
      this.waveSpawning = true;
      this.time.delayedCall(500, () => {
        this._spawnNextWave(roomId);
        this.waveSpawning = false;
      });
      return;
    }

    if (alive.length === 0 && this.waveQueue.length === 0) {
      const node = this.graph.rooms[roomId];
      node.cleared = true;
      this.activeCombatRoom = -1;
      this.waveActive = false;
      this.runStats.recordRoomCleared();

      this._unlockAllDoors();

      const room = this.roomData;
      const rx = Math.floor(room.width / 2) * this.tileSize + this.tileSize / 2;
      const ry = Math.floor(room.height / 2) * this.tileSize;
      this.showPopup(rx, ry - 20, 'Room Cleared!', '#44ff44');

      if (this.nodeMapGfx) this._redrawNodeMinimap();
    }
  }

  // ===================== STAIRS =====================

  _createStairs(pos) {
    const sx = pos.x * this.tileSize + this.tileSize / 2;
    const sy = pos.y * this.tileSize + this.tileSize / 2;
    this.stairs = this.add.image(sx, sy, 'tile-stairs');
    this.layerManager.addToLayer('decalLayer', this.stairs);
    this.tweens.add({
      targets: this.stairs,
      alpha: 0.6,
      yoyo: true,
      repeat: -1,
      duration: 800,
    });
  }

  _createCraftingBench(pos) {
    const bx = pos.x * this.tileSize + this.tileSize / 2;
    const by = pos.y * this.tileSize + this.tileSize / 2;
    this.craftingBench = this.add.image(bx, by, 'tile-crafting-bench');
    this.layerManager.addToLayer('propsSolidLayer', this.craftingBench);
    this.craftingBenchPrompt = null;
  }

  _createTreasureChest(roomData) {
    // Place in center of room
    const cx = Math.floor(roomData.width / 2) * this.tileSize + this.tileSize / 2;
    const cy = Math.floor(roomData.height / 2) * this.tileSize + this.tileSize / 2;
    this.treasureChest = this.add.image(cx, cy, 'tile-chest');
    this.layerManager.addToLayer('propsSolidLayer', this.treasureChest);
    this.treasureChestPrompt = null;
    this.treasureChestOpened = false;
  }

  _createCampfire(roomData) {
    const cx = Math.floor(roomData.width / 2) * this.tileSize + this.tileSize / 2;
    const cy = Math.floor(roomData.height / 2) * this.tileSize + this.tileSize / 2;
    this.campfire = this.add.image(cx, cy, 'tile-campfire');
    this.layerManager.addToLayer('propsSolidLayer', this.campfire);

    // Ambient glow circle
    this._campfireGlow = this.add.circle(cx, cy, 40, 0xff6600, 0.12);
    this.layerManager.addToLayer('decalLayer', this._campfireGlow);
    this.tweens.add({
      targets: this._campfireGlow,
      alpha: 0.06,
      scaleX: 0.9,
      scaleY: 0.9,
      yoyo: true,
      repeat: -1,
      duration: 1200,
    });

    // Flame flicker
    this.tweens.add({
      targets: this.campfire,
      scaleX: 0.95,
      scaleY: 1.05,
      yoyo: true,
      repeat: -1,
      duration: 400,
    });

    // Phase 4 – additive light pool (larger & warmer for campfire)
    if (this.lightManager) {
      this.lightManager.addLight(cx, cy, { radius: 3.5, alpha: 0.5, tint: 0xffcc88 });
      // Phase 7 – overlay cutout for campfire
      this.lightManager.addOverlayLight(cx, cy, { radius: 2.0, flickerAmount: 0.12 });
    }
  }

  _createMerchant(roomData) {
    const cx = Math.floor(roomData.width / 2) * this.tileSize + this.tileSize / 2;
    const cy = Math.floor(roomData.height / 2) * this.tileSize + this.tileSize / 2;
    this.merchant = this.add.image(cx, cy, 'tile-merchant');
    this.layerManager.addToLayer('propsSolidLayer', this.merchant);

    this._merchantLabel = this.add.text(cx, cy - 22, 'Merchant', {
      fontSize: '8px',
      fill: '#ffdd44',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.layerManager.addToLayer('foregroundLayer', this._merchantLabel);

    // Gentle bob animation
    this.tweens.add({
      targets: this.merchant,
      y: cy - 2,
      yoyo: true,
      repeat: -1,
      duration: 1000,
    });
  }

  _createTraps(trapPositions) {
    for (const pos of trapPositions) {
      const tx = pos.x * this.tileSize + this.tileSize / 2;
      const ty = pos.y * this.tileSize + this.tileSize / 2;
      const sprite = this.add.image(tx, ty, 'tile-trap');
      this.layerManager.addToLayer('decalLayer', sprite);
      this.traps.push({
        sprite,
        tileX: pos.x,
        tileY: pos.y,
        cooldown: 0,        // ready to trigger
        active: false,
      });
    }
  }

  _createDecorations(decoList) {
    for (const deco of decoList) {
      const dx = deco.x * this.tileSize + this.tileSize / 2;
      const dy = deco.y * this.tileSize + this.tileSize / 2;

      if (deco.type === 'torch') {
        const sprite = this.add.image(dx, dy, 'deco-torch');
        this.layerManager.addToLayer('propsSolidLayer', sprite);
        // Ambient glow circle
        const glow = this.add.circle(dx, dy, 24, 0xff8800, 0.08);
        this.layerManager.addToLayer('decalLayer', glow);
        this.tweens.add({
          targets: glow,
          alpha: { from: 0.04, to: 0.1 },
          scaleX: { from: 0.9, to: 1.1 },
          scaleY: { from: 0.9, to: 1.1 },
          yoyo: true,
          repeat: -1,
          duration: 600 + Math.random() * 400,
        });
        // Flicker the torch sprite
        this.tweens.add({
          targets: sprite,
          scaleY: { from: 0.95, to: 1.05 },
          yoyo: true,
          repeat: -1,
          duration: 300 + Math.random() * 200,
        });
        // Phase 4 – additive light pool
        if (this.lightManager) {
          this.lightManager.addLight(dx, dy, { radius: 2.5, alpha: 0.4 });
          // Phase 7 – overlay cutout for torch
          this.lightManager.addOverlayLight(dx, dy, { radius: 1.3, flickerAmount: 0.10 });
        }
        this.decorations.push({ sprite, glow });
      } else if (deco.type === 'debris') {
        const sprite = this.add.image(dx, dy, 'deco-debris').setAlpha(0.7);
        this.layerManager.addToLayer('decalLayer', sprite);
        this.decorations.push({ sprite, glow: null });
      }
    }
  }

  _createPots(potPositions) {
    for (const pos of potPositions) {
      const px = pos.x * this.tileSize + this.tileSize / 2;
      const py = pos.y * this.tileSize + this.tileSize / 2;
      const sprite = this.add.image(px, py, 'deco-pot');
      this.layerManager.addToLayer('propsSolidLayer', sprite);
      this.pots.push({
        sprite,
        tileX: pos.x,
        tileY: pos.y,
        broken: false,
      });
    }
  }

  /**
   * Phase 2 – Place foreground canopy overlays that render above the player.
   * One canopy is placed near the room center on every room that has floor
   * space, demonstrating that the foreground layer draws over entities.
   */
  _createForegroundOverlays(roomData) {
    if (!this.layerManager) return;
    // Place a canopy in the upper-center area of the room
    const cx = Math.floor(roomData.width / 2) * this.tileSize + this.tileSize / 2;
    const cy = Math.floor(roomData.height * 0.35) * this.tileSize + this.tileSize / 2;
    // Only place if the tile is walkable floor
    const tx = Math.floor(roomData.width / 2);
    const ty = Math.floor(roomData.height * 0.35);
    if (ty >= 0 && ty < roomData.height && tx >= 0 && tx < roomData.width &&
        (roomData.map[ty][tx] === 0 || roomData.map[ty][tx] === 2)) {
      const canopy = this.add.image(cx, cy, 'foreground-canopy');
      this.layerManager.setToForeground(canopy);
      this._foregroundOverlays.push(canopy);
    }
  }

  /** Check if player's attack hits any breakable pots */
  _checkPotBreaks(attackX, attackY, reach) {
    if (!this.pots) return;
    for (const pot of this.pots) {
      if (pot.broken) continue;
      const dist = Phaser.Math.Distance.Between(attackX, attackY, pot.sprite.x, pot.sprite.y);
      if (dist < reach + 16) {
        this._breakPot(pot);
      }
    }
  }

  _breakPot(pot) {
    pot.broken = true;
    pot.sprite.setTexture('deco-pot-broken');
    pot.sprite.setAlpha(0.6);
    this.layerManager.addToLayer('decalLayer', pot.sprite);

    // Spawn break particles
    for (let i = 0; i < 4; i++) {
      const particle = this.add.circle(
        pot.sprite.x, pot.sprite.y,
        Phaser.Math.Between(1, 3), 0x8a5a2a, 0.8
      ).setDepth(FOREGROUND_DEPTH + 10);
      const angle = (Math.PI * 2 * i) / 4 + (Math.random() - 0.5) * 0.8;
      const dist = Phaser.Math.Between(10, 25);
      this.tweens.add({
        targets: particle,
        x: pot.sprite.x + Math.cos(angle) * dist,
        y: pot.sprite.y + Math.sin(angle) * dist,
        alpha: 0,
        duration: 300,
        onComplete: () => particle.destroy(),
      });
    }

    // Drop loot
    const goldAmount = Phaser.Math.Between(GAME_CONFIG.POT_GOLD_MIN, GAME_CONFIG.POT_GOLD_MAX);
    const modMult = (this.floorModifier && this.floorModifier.effects.goldMultiplier) || 1;
    const finalGold = Math.floor(goldAmount * modMult);
    if (finalGold > 0) {
      this.levelSystem.addGold(finalGold);
      this.runStats.recordGold(finalGold);
      this.showPopup(pot.sprite.x, pot.sprite.y - 12, `+${finalGold}g`, '#ffdd44');
    }

    // Small chance to drop an item
    if (Math.random() < GAME_CONFIG.POT_ITEM_CHANCE) {
      const possibleDrops = ['temple-ash', 'bones', 'health-potion'];
      const dropId = possibleDrops[Math.floor(Math.random() * possibleDrops.length)];
      this.inventory.addItem(dropId, 1);
      this.runStats.recordItemFound();
      const itemData = ITEM_DATA[dropId];
      const name = itemData ? itemData.name : dropId;
      this.showPopup(pot.sprite.x, pot.sprite.y - 26, `+${name}`, '#ffffff');
    }

    this.updateUI();
  }

  /** Show floor modifier announcement at start of a new floor */
  _showFloorModifierAnnouncement() {
    const mod = this.floorModifier;
    const room = this.roomData;
    const cx = Math.floor(room.width / 2) * this.tileSize + this.tileSize / 2;
    const cy = 30;

    const titleText = this.add.text(cx, cy, `${mod.icon} ${mod.name}`, {
      fontSize: '14px',
      fill: mod.color,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5).setDepth(FOREGROUND_DEPTH + 30).setAlpha(0);

    const descText = this.add.text(cx, cy + 18, mod.description, {
      fontSize: '9px',
      fill: '#cccccc',
      fontFamily: 'monospace',
      fontStyle: 'italic',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
    }).setOrigin(0.5).setDepth(FOREGROUND_DEPTH + 30).setAlpha(0);

    this.tweens.add({
      targets: [titleText, descText],
      alpha: 1,
      duration: 400,
      hold: 3000,
      yoyo: true,
      onComplete: () => { titleText.destroy(); descText.destroy(); },
    });
  }

  _checkTraps(delta) {
    if (!this.player || !this.player.active || !this.traps) return;
    for (const trap of this.traps) {
      // Tick cooldowns
      if (trap.cooldown > 0) {
        trap.cooldown -= delta;
        if (trap.cooldown <= 0) {
          trap.cooldown = 0;
          trap.active = false;
          trap.sprite.setTexture('tile-trap');
        }
        continue;
      }

      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        trap.sprite.x, trap.sprite.y
      );
      if (dist < this.tileSize * 0.6) {
        // Trigger trap
        trap.active = true;
        trap.cooldown = GAME_CONFIG.TRAP_COOLDOWN;
        trap.sprite.setTexture('tile-trap-active');

        const baseDamage = GAME_CONFIG.TRAP_BASE_DAMAGE + (this.currentFloor - 1) * GAME_CONFIG.TRAP_DAMAGE_PER_FLOOR;
        const trapMult = (this.floorModifier && this.floorModifier.effects.trapDamageMultiplier) || 1;
        const damage = Math.floor(baseDamage * trapMult);
        this.player.takeDamage(damage);
        this.runStats.recordTrapTriggered();

        this.showPopup(trap.sprite.x, trap.sprite.y - 16, `Trap! -${damage}`, '#ff4444');
      }
    }
  }

  goToNextFloor() {
    this.scene.restart({ floor: this.currentFloor + 1 });
  }

  // ===================== NODE MINIMAP =====================

  createNodeMinimap() {
    this.nodeMapGfx = this.add.graphics();
    this.nodeMapGfx.setScrollFactor(0);
    this.nodeMapGfx.setDepth(FOREGROUND_DEPTH + 100);
    this._redrawNodeMinimap();
  }

  _redrawNodeMinimap() {
    const g = this.nodeMapGfx;
    g.clear();

    const offsetX = 10;
    const offsetY = 10;
    const nodeSize = 14;
    const gap = 24;

    // Layout rooms in a simple BFS grid from room 0
    const positions = this._layoutGraph();

    // Background
    const maxX = Object.values(positions).reduce((m, p) => Math.max(m, p.col), 0) + 1;
    const maxY = Object.values(positions).reduce((m, p) => Math.max(m, p.row), 0) + 1;
    g.fillStyle(0x000000, 0.6);
    g.fillRect(offsetX - 4, offsetY - 4, maxX * gap + 8, maxY * gap + 8);

    // Draw edges
    g.lineStyle(2, 0x555555, 0.8);
    for (const edge of this.graph.edges) {
      const fromRoom = this.graph.rooms[edge.from];
      const toRoom = this.graph.rooms[edge.to];
      if (!fromRoom.visited && !toRoom.visited) continue;
      const p1 = positions[edge.from];
      const p2 = positions[edge.to];
      if (!p1 || !p2) continue;
      const x1 = offsetX + p1.col * gap + nodeSize / 2;
      const y1 = offsetY + p1.row * gap + nodeSize / 2;
      const x2 = offsetX + p2.col * gap + nodeSize / 2;
      const y2 = offsetY + p2.row * gap + nodeSize / 2;
      g.lineBetween(x1, y1, x2, y2);
    }

    // Draw room nodes
    for (const room of this.graph.rooms) {
      const p = positions[room.id];
      if (!p) continue;

      // Only draw visited rooms or rooms adjacent to visited rooms
      const isAdjacent = room.doors.some(d => this.graph.rooms[d.targetRoom].visited);
      if (!room.visited && !isAdjacent) continue;

      const nx = offsetX + p.col * gap;
      const ny = offsetY + p.row * gap;

      // Color by state/type
      let color;
      if (room.id === this.currentRoomId) {
        color = 0x00ff00; // current
      } else if (room.cleared) {
        color = 0x666666; // cleared
      } else if (room.visited) {
        color = 0xaaaaaa;
      } else {
        color = 0x333333; // unrevealed adjacent
      }

      g.fillStyle(color, 1);
      g.fillRect(nx, ny, nodeSize, nodeSize);

      // Type indicator border
      let borderColor = 0x444444;
      switch (room.type) {
        case 'boss':     borderColor = 0xff0000; break;
        case 'elite':    borderColor = 0xff8800; break;
        case 'treasure': borderColor = 0xffff00; break;
        case 'merchant': borderColor = 0x00aaff; break;
        case 'rest':     borderColor = 0x44ff44; break;
      }
      // Only show type hint for visited/adjacent rooms
      if (room.visited || isAdjacent) {
        g.lineStyle(2, borderColor, 1);
        g.strokeRect(nx, ny, nodeSize, nodeSize);
      }
    }
  }

  /** BFS layout: assign (row, col) to each room */
  _layoutGraph() {
    const positions = {};
    const visited = new Set();
    const queue = [{ id: 0, row: 0, col: 0 }];
    visited.add(0);

    const occupied = new Set();
    occupied.add('0,0');

    while (queue.length > 0) {
      const { id, row, col } = queue.shift();
      positions[id] = { row, col };

      const room = this.graph.rooms[id];
      // Direction offsets
      const dirOffsets = [
        { dr: -1, dc: 0 },  // up
        { dr: 1, dc: 0 },   // down
        { dr: 0, dc: 1 },   // right
        { dr: 0, dc: -1 },  // left
      ];
      let dirIdx = 0;

      for (const door of room.doors) {
        if (visited.has(door.targetRoom)) continue;
        visited.add(door.targetRoom);

        // Try each direction until we find an unoccupied spot
        let placed = false;
        for (let attempt = 0; attempt < 4; attempt++) {
          const off = dirOffsets[(dirIdx + attempt) % 4];
          const nr = row + off.dr;
          const nc = col + off.dc;
          const key = `${nr},${nc}`;
          if (!occupied.has(key)) {
            occupied.add(key);
            queue.push({ id: door.targetRoom, row: nr, col: nc });
            placed = true;
            break;
          }
        }
        if (!placed) {
          // Extend outward
          const off = dirOffsets[dirIdx % 4];
          let nr = row + off.dr;
          let nc = col + off.dc;
          while (occupied.has(`${nr},${nc}`)) {
            nr += off.dr;
            nc += off.dc;
          }
          occupied.add(`${nr},${nc}`);
          queue.push({ id: door.targetRoom, row: nr, col: nc });
        }
        dirIdx++;
      }
    }

    // Normalize so min row/col = 0
    const rows = Object.values(positions).map(p => p.row);
    const cols = Object.values(positions).map(p => p.col);
    const minR = Math.min(...rows);
    const minC = Math.min(...cols);
    for (const key of Object.keys(positions)) {
      positions[key].row -= minR;
      positions[key].col -= minC;
    }
    return positions;
  }

  // ===================== INTERACTIONS =====================

  checkInteractions() {
    if (!this.player || !this.player.active) return;
    const justPressedE = Phaser.Input.Keyboard.JustDown(this.interactKey);

    let nearDoor = false;

    // Doors
    for (const door of this.doors) {
      if (door.state === 'open' || door.state === 'hidden') continue;

      const dwx = door.tileX * this.tileSize + this.tileSize / 2;
      const dwy = door.tileY * this.tileSize + this.tileSize / 2;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, dwx, dwy);

      if (dist < this.tileSize * 1.5) {
        if (door.state === 'closed') {
          if (!door.prompt) {
            door.prompt = this.add.text(dwx, dwy - 20, this._interactHint('Open'), {
              fontSize: '10px', fill: '#ffffff', fontFamily: 'monospace',
              stroke: '#000000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(FOREGROUND_DEPTH + 20);
          }
          if (justPressedE) {
            this._openDoor(door);
            nearDoor = true;
          }
        } else if (door.state === 'locked') {
          if (!door.prompt) {
            door.prompt = this.add.text(dwx, dwy - 20, 'Locked!', {
              fontSize: '10px', fill: '#ff4444', fontFamily: 'monospace',
              stroke: '#000000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(FOREGROUND_DEPTH + 20);
          }
        }
      } else {
        if (door.prompt) { door.prompt.destroy(); door.prompt = null; }
      }
    }

    // Crafting bench
    if (this.craftingBench) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.craftingBench.x, this.craftingBench.y
      );
      if (dist < this.tileSize * 1.5) {
        if (!this.craftingBenchPrompt) {
          this.craftingBenchPrompt = this.add.text(
            this.craftingBench.x, this.craftingBench.y - 20,
            this._interactHint('Craft'),
            { fontSize: '10px', fill: '#ffdd44', fontFamily: 'monospace',
              stroke: '#000000', strokeThickness: 2 }
          ).setOrigin(0.5).setDepth(FOREGROUND_DEPTH + 20);
        }
        if (justPressedE && !nearDoor) {
          const uiScene = this.scene.get('UIScene');
          if (uiScene) {
            uiScene.showCraftingPanel(this.inventory);
          }
        }
      } else if (this.craftingBenchPrompt) {
        this.craftingBenchPrompt.destroy();
        this.craftingBenchPrompt = null;
      }
    }

    // Treasure chest
    if (this.treasureChest && !this.treasureChestOpened) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.treasureChest.x, this.treasureChest.y
      );
      if (dist < this.tileSize * 1.5) {
        if (!this.treasureChestPrompt) {
          this.treasureChestPrompt = this.add.text(
            this.treasureChest.x, this.treasureChest.y - 20,
            this._interactHint('Open'),
            { fontSize: '10px', fill: '#ffdd44', fontFamily: 'monospace',
              stroke: '#000000', strokeThickness: 2 }
          ).setOrigin(0.5).setDepth(FOREGROUND_DEPTH + 20);
        }
        if (justPressedE && !nearDoor) {
          this._openTreasureChest();
        }
      } else if (this.treasureChestPrompt) {
        this.treasureChestPrompt.destroy();
        this.treasureChestPrompt = null;
      }
    }

    // Campfire (rest rooms)
    if (this.campfire && !this.campfireUsed) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.campfire.x, this.campfire.y
      );
      if (dist < this.tileSize * 1.5) {
        if (!this.campfirePrompt) {
          this.campfirePrompt = this.add.text(
            this.campfire.x, this.campfire.y - 20,
            this._interactHint('Rest'),
            { fontSize: '10px', fill: '#44ff88', fontFamily: 'monospace',
              stroke: '#000000', strokeThickness: 2 }
          ).setOrigin(0.5).setDepth(FOREGROUND_DEPTH + 20);
        }
        if (justPressedE && !nearDoor) {
          this._useCampfire();
        }
      } else if (this.campfirePrompt) {
        this.campfirePrompt.destroy();
        this.campfirePrompt = null;
      }
    }

    // Merchant
    if (this.merchant) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.merchant.x, this.merchant.y
      );
      if (dist < this.tileSize * 1.5) {
        if (!this.merchantPrompt) {
          this.merchantPrompt = this.add.text(
            this.merchant.x, this.merchant.y + 22,
            this._interactHint('Trade'),
            { fontSize: '10px', fill: '#ffdd44', fontFamily: 'monospace',
              stroke: '#000000', strokeThickness: 2 }
          ).setOrigin(0.5).setDepth(FOREGROUND_DEPTH + 20);
        }
        if (justPressedE && !nearDoor) {
          this._openMerchantShop();
        }
      } else if (this.merchantPrompt) {
        this.merchantPrompt.destroy();
        this.merchantPrompt = null;
      }
    }

    // Stairs
    this._checkStairsOverlap(justPressedE);
  }

  _checkStairsOverlap(justPressedE) {
    if (!this.stairs || !this.player || !this.stairs.visible) return;
    const dist = Phaser.Math.Distance.Between(
      this.player.x, this.player.y,
      this.stairs.x, this.stairs.y
    );
    if (dist < this.tileSize) {
      if (!this.stairsPrompt) {
        this.stairsPrompt = this.add.text(this.stairs.x, this.stairs.y - 20, this._interactHint('Descend'), {
          fontSize: '10px', fill: '#ffffff', fontFamily: 'monospace',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(FOREGROUND_DEPTH + 20);
      }
      if (justPressedE) {
        this.goToNextFloor();
      }
    } else if (this.stairsPrompt) {
      this.stairsPrompt.destroy();
      this.stairsPrompt = null;
    }
  }

  /** Return a touch-aware interaction prompt (e.g. "Tap to open" vs "Press E to open") */
  _interactHint(action) {
    const label = action.toLowerCase();
    const ui = this.scene.get('UIScene');
    return (ui && ui.isTouchDevice) ? `Tap to ${label}` : `Press E to ${label}`;
  }

  /** Called from UIScene when the touch E button is pressed */
  handleTouchInteract() {
    if (!this.player || !this.player.active) return;

    // Wider interaction range for touch (fat-finger tolerance)
    const touchRange = this.tileSize * 2.2;

    for (const door of this.doors) {
      if (door.state !== 'closed') continue;
      const dwx = door.tileX * this.tileSize + this.tileSize / 2;
      const dwy = door.tileY * this.tileSize + this.tileSize / 2;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, dwx, dwy);
      if (dist < touchRange) {
        this._openDoor(door);
        return;
      }
    }

    if (this.craftingBench) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.craftingBench.x, this.craftingBench.y
      );
      if (dist < touchRange) {
        const uiScene = this.scene.get('UIScene');
        if (uiScene) {
          uiScene.showCraftingPanel(this.inventory);
        }
        return;
      }
    }

    if (this.treasureChest && !this.treasureChestOpened) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.treasureChest.x, this.treasureChest.y
      );
      if (dist < touchRange) {
        this._openTreasureChest();
        return;
      }
    }

    if (this.campfire && !this.campfireUsed) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.campfire.x, this.campfire.y
      );
      if (dist < touchRange) {
        this._useCampfire();
        return;
      }
    }

    if (this.merchant) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.merchant.x, this.merchant.y
      );
      if (dist < touchRange) {
        this._openMerchantShop();
        return;
      }
    }

    if (this.stairs && this.stairs.visible) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.stairs.x, this.stairs.y
      );
      if (dist < this.tileSize * 1.5) {
        this.goToNextFloor();
      }
    }
  }

  _openTreasureChest() {
    if (this.treasureChestOpened) return;
    this.treasureChestOpened = true;

    // Mark as looted on the graph node
    const node = this.graph.rooms[this.currentRoomId];
    node.chestLooted = true;

    // Visual change
    this.treasureChest.setTexture('tile-chest-open');
    if (this.treasureChestPrompt) {
      this.treasureChestPrompt.destroy();
      this.treasureChestPrompt = null;
    }

    // Generate loot
    const loot = LootSystem.rollTreasureChest(this.currentFloor);
    let popupY = this.treasureChest.y - 20;

    for (const entry of loot) {
      if (entry.type === 'gold') {
        this.levelSystem.addGold(entry.amount);
        this.showPopup(this.treasureChest.x, popupY, `+${entry.amount}g`, '#ffdd44');
      } else if (entry.type === 'item') {
        this.inventory.addItem(entry.itemId, entry.quantity);
        const itemData = ITEM_DATA[entry.itemId];
        const name = itemData ? itemData.name : entry.itemId;
        this.showPopup(this.treasureChest.x, popupY, `+${name}${entry.quantity > 1 ? ' x' + entry.quantity : ''}`, '#ffffff');
      }
      popupY -= 18;
    }

    this.updateUI();
  }

  _usePotion() {
    if (!this.player || !this.player.active) return;

    // Try heal potions first (only if not at full HP)
    if (this.player.hp < this.player.getMaxHP()) {
      let potionId = null;
      if (this.inventory.items['greater-health-potion'] > 0) {
        potionId = 'greater-health-potion';
      } else if (this.inventory.items['health-potion'] > 0) {
        potionId = 'health-potion';
      }

      if (potionId) {
        const itemData = ITEM_DATA[potionId];
        this.inventory.removeItem(potionId, 1);
        const healAmount = itemData.effect.heal;
        this.player.heal(healAmount);
        this.runStats.recordPotionUsed();
        this.showPopup(this.player.x, this.player.y - 20, `+${healAmount} HP`, '#44ff44');
        this.updateUI();
        return;
      }
    }

    // Try buff potions if at full HP or no heal potions
    for (const buffId of ['strength-potion', 'speed-potion', 'shield-potion']) {
      if (this.inventory.items[buffId] > 0) {
        const itemData = ITEM_DATA[buffId];
        this.inventory.removeItem(buffId, 1);
        const eff = itemData.effect;
        this.statusEffects.apply(eff.buff, itemData.name, 'buff', eff.duration, eff.magnitude);
        this.runStats.recordPotionUsed();
        const durSec = Math.round(eff.duration / 1000);
        this.showPopup(this.player.x, this.player.y - 20, `${itemData.name} (${durSec}s)`, '#66aaff');
        this.updateUI();
        return;
      }
    }

    if (this.player.hp >= this.player.getMaxHP()) {
      this.showPopup(this.player.x, this.player.y - 20, 'No potions!', '#aaaaaa');
    } else {
      this.showPopup(this.player.x, this.player.y - 20, 'No healing potions!', '#ff6644');
    }
  }

  _useCampfire() {
    if (this.campfireUsed) return;
    this.campfireUsed = true;

    // Mark on the graph node so re-entering doesn't allow re-use
    const node = this.graph.rooms[this.currentRoomId];
    node.campfireUsed = true;

    if (this.campfirePrompt) {
      this.campfirePrompt.destroy();
      this.campfirePrompt = null;
    }

    // Heal to full
    const healAmount = this.player.getMaxHP() - this.player.hp;
    this.player.hp = this.player.getMaxHP();

    if (healAmount > 0) {
      this.showPopup(this.campfire.x, this.campfire.y - 30, `Fully rested! +${healAmount} HP`, '#44ff88');
    } else {
      this.showPopup(this.campfire.x, this.campfire.y - 30, 'You feel well rested.', '#44ff88');
    }

    // Dim campfire to show it's used
    this.tweens.killTweensOf(this.campfire);
    this.campfire.setAlpha(0.5);

    this.updateUI();
  }

  _openMerchantShop() {
    const uiScene = this.scene.get('UIScene');
    if (uiScene) {
      uiScene.showMerchantPanel(this.inventory, this.levelSystem, this.currentFloor);
    }
  }

  // ===================== COMBAT EVENTS =====================

  /** Camera shake when player takes damage */
  _shakeCamera() {
    this.cameras.main.shake(150, 0.005);
  }

  /** Spawn colored particle burst on enemy death */
  _spawnDeathParticles(x, y, enemyType) {
    const colors = {
      'dust-wraith':    [0x7755cc, 0x9977ee, 0xbbaaff],
      'sand-stalker':   [0xccaa55, 0xffcc44, 0xbb8833],
      'weeping-widow':  [0x88aacc, 0xaaccee, 0x667788],
      'temple-beetle':  [0x88aa44, 0xaacc66, 0x556633],
      'wardens-keyling': [0xcc7744, 0xee9966, 0xaa5522],
      'scarab-swarm':   [0x445533, 0x668844, 0xccff66],
    };
    const palette = colors[enemyType] || [0xffffff, 0xcccccc, 0x999999];
    const count = 8;

    for (let i = 0; i < count; i++) {
      const color = palette[Math.floor(Math.random() * palette.length)];
      const size = Phaser.Math.Between(2, 5);
      const particle = this.add.circle(x, y, size, color, 0.9).setDepth(FOREGROUND_DEPTH + 20);

      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
      const dist = Phaser.Math.Between(20, 45);
      const tx = x + Math.cos(angle) * dist;
      const ty = y + Math.sin(angle) * dist;

      this.tweens.add({
        targets: particle,
        x: tx,
        y: ty,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: Phaser.Math.Between(300, 600),
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy(),
      });
    }
  }

  /** Show atmospheric room description */
  _showRoomAtmosphere(roomType) {
    const desc = getRandomDescription(roomType);
    const room = this.roomData;
    const cx = Math.floor(room.width / 2) * this.tileSize + this.tileSize / 2;
    const cy = Math.floor(room.height / 2) * this.tileSize + this.tileSize / 2 + 30;

    const text = this.add.text(cx, cy, desc, {
      fontSize: '9px',
      fill: '#aaaaaa',
      fontFamily: 'monospace',
      fontStyle: 'italic',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
    }).setOrigin(0.5).setDepth(FOREGROUND_DEPTH + 25).setAlpha(0);

    // Fade in, hold, fade out
    this.tweens.add({
      targets: text,
      alpha: 0.9,
      duration: 500,
      hold: 2000,
      yoyo: true,
      onComplete: () => text.destroy(),
    });
  }

  /** Handle ranged enemy projectile */
  _handleRangedAttack(data) {
    const { x, y, targetX, targetY, damage, speed } = data;
    const textureKey = 'projectile-sand';

    if (!this.textures.exists(textureKey)) return;

    const projectile = this.physics.add.image(x, y, textureKey);
    projectile.setDepth(FOREGROUND_DEPTH + 10);
    projectile.setCircle(5);
    projectile.damage = damage;
    this.projectiles.add(projectile);

    // Calculate velocity toward target position
    const dx = targetX - x;
    const dy = targetY - y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      projectile.setVelocity((dx / len) * speed, (dy / len) * speed);
    }

    // Auto-destroy after 3 seconds (safety net)
    this.time.delayedCall(3000, () => {
      if (projectile.active) projectile.destroy();
    });
  }

  /** Projectile hits the player */
  _onProjectileHitPlayer(obj1, obj2) {
    // Identify which object is the projectile (belongs to projectiles group)
    let projectile, player;
    if (this.projectiles.contains(obj1)) {
      projectile = obj1;
      player = obj2;
    } else {
      projectile = obj2;
      player = obj1;
    }
    if (!player.active || !projectile.active) return;
    if (typeof player.takeDamage !== 'function') return;
    const damage = projectile.damage || 5;
    player.takeDamage(damage);
    this._spawnProjectileImpact(projectile.x, projectile.y);
    projectile.destroy();
  }

  /** Projectile hits a wall */
  _onProjectileHitWall(projectile) {
    if (!projectile.active) return;
    this._spawnProjectileImpact(projectile.x, projectile.y);
    projectile.destroy();
  }

  /** Small impact flash when a projectile hits something */
  _spawnProjectileImpact(x, y) {
    const flash = this.add.circle(x, y, 6, 0xffcc44, 0.8).setDepth(FOREGROUND_DEPTH + 20);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 200,
      onComplete: () => flash.destroy(),
    });
  }

  handlePlayerAttack(attackData) {
    // Check if attack hits any breakable pots
    this._checkPotBreaks(attackData.x, attackData.y, attackData.reach);

    // Apply floor modifier damage bonus
    const dmgMult = (this.floorModifier && this.floorModifier.effects.playerDamageMultiplier) || 1;

    const enemies = this.enemies.getChildren();
    for (const enemy of enemies) {
      if (!enemy.active || enemy.state === 'dead') continue;
      const dist = Phaser.Math.Distance.Between(attackData.x, attackData.y, enemy.x, enemy.y);
      if (dist < attackData.reach + 20) {
        // Roll for critical hit
        const isCrit = Math.random() < GAME_CONFIG.CRIT_CHANCE;
        const baseDamage = isCrit
          ? Math.floor(attackData.damage * GAME_CONFIG.CRIT_MULTIPLIER)
          : attackData.damage;
        const finalDamage = Math.floor(baseDamage * dmgMult);

        enemy.takeDamage(finalDamage);
        this.runStats.recordDamageDealt(finalDamage);

        if (isCrit) {
          this.runStats.recordCriticalHit();
          this.showPopup(enemy.x, enemy.y - 30, 'CRIT!', '#ffdd00');
        }
      }
    }
  }

  handleEnemyDeath(data) {
    const enemyData = ENEMY_DATA[data.enemyType];
    if (!enemyData) return;

    this.runStats.recordKill();

    // Death particles
    this._spawnDeathParticles(data.x, data.y, data.enemyType);

    // Apply floor modifier multipliers
    const goldMult = (this.floorModifier && this.floorModifier.effects.goldMultiplier) || 1;
    const expMult = (this.floorModifier && this.floorModifier.effects.expMultiplier) || 1;

    const baseGold = this.levelSystem.getScaledGold(
      enemyData.gold.min, enemyData.gold.max, this.currentFloor
    );
    const baseExp = this.levelSystem.getScaledExp(enemyData.exp, this.currentFloor);
    const goldAmount = Math.floor(baseGold * goldMult);
    const expAmount = Math.floor(baseExp * expMult);

    this.levelSystem.addGold(goldAmount);
    this.runStats.recordGold(goldAmount);
    const leveledUp = this.levelSystem.addExp(expAmount);

    // Separate gold and exp popups for clarity
    this.showPopup(data.x - 15, data.y - 10, `+${goldAmount}g`, '#ffdd44');
    this.showPopup(data.x + 15, data.y - 10, `+${expAmount}xp`, '#88ccff');

    if (leveledUp) {
      this.showPopup(data.x, data.y - 30, `LEVEL UP! Lv${this.levelSystem.level}`, '#44ff44');
      this.player.hp = this.player.getMaxHP();
    }

    const drops = LootSystem.rollDrops(data.enemyType, this.currentFloor);
    for (const drop of drops) {
      this.inventory.addItem(drop.itemId, drop.quantity);
      this.runStats.recordItemFound();
      this.showPopup(data.x, data.y + 10, `+${drop.name}${drop.quantity > 1 ? ' x' + drop.quantity : ''}`, '#ffffff');
    }

    this._checkCombatCleared();
    this.updateUI();
  }

  handlePlayerDeath() {
    const lostGold = Math.floor(this.levelSystem.gold * 0.1);
    this.levelSystem.gold -= lostGold;

    // Freeze gameplay
    this.player.setVelocity(0, 0);
    if (this.player.body) this.player.body.enable = false;

    // Show death summary
    const summary = this.runStats.getSummary();
    this.showPopup(this.player.x, this.player.y, 'YOU DIED', '#ff0000');

    // Display run summary via UIScene overlay (interactive — player dismisses)
    const uiScene = this.scene.get('UIScene');
    if (uiScene) {
      uiScene.showDeathSummary(summary, lostGold, () => {
        // Callback when player clicks "Return to Town"
        uiScene._destroyOverlayPanel();
        this.runStats.reset();
        this.statusEffects.clear();
        this.abilitySystem.reset();
        this.scene.start('TownScene');
      });
    }
  }

  // ===================== ABILITY SYSTEM =====================

  _handleAbility(abilityId) {
    if (!this.player || !this.player.active || this.player.hp <= 0) return;

    const ability = ABILITIES[abilityId];
    if (!ability) return;

    // Check level requirement
    if (!this.abilitySystem.isUnlocked(abilityId, this.levelSystem.level)) {
      this.showPopup(this.player.x, this.player.y - 20, `Unlocks at Lv${ability.unlockLevel}`, '#888888');
      return;
    }

    // Check cooldown
    if (!this.abilitySystem.isReady(abilityId)) {
      const remaining = this.abilitySystem.getCooldownRemaining(abilityId).toFixed(1);
      this.showPopup(this.player.x, this.player.y - 20, `${remaining}s`, '#888888');
      return;
    }

    // Execute ability
    this.abilitySystem.use(abilityId);

    if (abilityId === 'whirlwind') {
      this._executeWhirlwind();
    } else if (abilityId === 'war_cry') {
      this._executeWarCry();
    }

    this.updateUI();
  }

  _executeWhirlwind() {
    const ability = ABILITIES.whirlwind;
    const px = this.player.x;
    const py = this.player.y;

    // Visual: spinning ring effect
    const ring = this.add.circle(px, py, ability.range, 0x44ccff, 0.2).setDepth(FOREGROUND_DEPTH + 15);
    ring.setStrokeStyle(2, 0x44ccff, 0.5);
    this.tweens.add({
      targets: ring,
      scaleX: 1.3,
      scaleY: 1.3,
      alpha: 0,
      duration: 400,
      onComplete: () => ring.destroy(),
    });

    // Spinning blade particles
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const startX = px + Math.cos(angle) * 15;
      const startY = py + Math.sin(angle) * 15;
      const endX = px + Math.cos(angle) * ability.range;
      const endY = py + Math.sin(angle) * ability.range;
      const particle = this.add.circle(startX, startY, 3, 0x88ddff, 0.8).setDepth(FOREGROUND_DEPTH + 20);
      this.tweens.add({
        targets: particle,
        x: endX,
        y: endY,
        alpha: 0,
        duration: 300,
        onComplete: () => particle.destroy(),
      });
    }

    // Apply floor modifier damage bonus
    const dmgMult = (this.floorModifier && this.floorModifier.effects.playerDamageMultiplier) || 1;
    const baseDamage = Math.floor(this.levelSystem.getAttack() * ability.damageMultiplier * dmgMult);

    // Damage all enemies in range
    const enemies = this.enemies.getChildren();
    for (const enemy of enemies) {
      if (!enemy.active || enemy.state === 'dead') continue;
      const dist = Phaser.Math.Distance.Between(px, py, enemy.x, enemy.y);
      if (dist < ability.range) {
        enemy.takeDamage(baseDamage);
        this.runStats.recordDamageDealt(baseDamage);
      }
    }

    // Camera effect
    this.cameras.main.shake(100, 0.003);

    this.showPopup(px, py - 30, '🌀 Whirlwind!', '#44ccff');
  }

  _executeWarCry() {
    const ability = ABILITIES.war_cry;
    const px = this.player.x;
    const py = this.player.y;

    // Visual: expanding shockwave ring
    const wave = this.add.circle(px, py, 20, 0xff8844, 0.3).setDepth(FOREGROUND_DEPTH + 15);
    wave.setStrokeStyle(3, 0xff8844, 0.6);
    this.tweens.add({
      targets: wave,
      scaleX: ability.range / 20,
      scaleY: ability.range / 20,
      alpha: 0,
      duration: 500,
      onComplete: () => wave.destroy(),
    });

    // Radial burst particles
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const endX = px + Math.cos(angle) * ability.range;
      const endY = py + Math.sin(angle) * ability.range;
      const particle = this.add.circle(px, py, 2, 0xffaa44, 0.7).setDepth(FOREGROUND_DEPTH + 20);
      this.tweens.add({
        targets: particle,
        x: endX,
        y: endY,
        alpha: 0,
        scaleX: 0.3,
        scaleY: 0.3,
        duration: 400,
        onComplete: () => particle.destroy(),
      });
    }

    // Apply attack buff via status effects
    this.statusEffects.apply(
      'strength_boost',
      'War Cry',
      'buff',
      ability.buffDuration,
      ability.buffMagnitude
    );

    // Knockback nearby enemies
    const enemies = this.enemies.getChildren();
    for (const enemy of enemies) {
      if (!enemy.active || enemy.state === 'dead') continue;
      const dist = Phaser.Math.Distance.Between(px, py, enemy.x, enemy.y);
      if (dist < ability.range) {
        const dx = enemy.x - px;
        const dy = enemy.y - py;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        // Apply knockback velocity
        enemy.setVelocity(
          (dx / len) * ability.knockbackForce,
          (dy / len) * ability.knockbackForce
        );
        // Reset velocity after brief knockback
        this.time.delayedCall(250, () => {
          if (enemy.active) enemy.setVelocity(0, 0);
        });
      }
    }

    // Camera effect
    this.cameras.main.shake(150, 0.004);

    this.showPopup(px, py - 30, '📯 War Cry!', '#ff8844');
  }

  // ===================== HELPERS =====================

  showPopup(x, y, text, color) {
    const popup = this.add.text(x, y, text, {
      fontSize: '12px', fill: color, fontFamily: 'monospace',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(FOREGROUND_DEPTH + 25);

    this.tweens.add({
      targets: popup,
      y: popup.y - 40,
      alpha: 0,
      duration: 1500,
      onComplete: () => popup.destroy(),
    });
  }

  updateUI() {
    if (!this.player) return;
    const modBonusDef = (this.floorModifier && this.floorModifier.effects.bonusDefense) || 0;
    this.scene.get('UIScene').events.emit('updateStats', {
      hp: this.player.hp,
      maxHp: this.player.getMaxHP(),
      level: this.levelSystem.level,
      exp: this.levelSystem.exp,
      expNext: this.levelSystem.getExpForNextLevel(),
      gold: this.levelSystem.gold,
      floor: this.currentFloor,
      attack: this.levelSystem.getAttack(),
      defense: this.levelSystem.getDefense() + modBonusDef,
      equipment: {
        weapon: this.equipmentSystem ? this.equipmentSystem.getEquipped('weapon') : null,
        armor: this.equipmentSystem ? this.equipmentSystem.getEquipped('armor') : null,
      },
      location: 'dungeon',
      inventory: this.inventory.getItems(),
      activeEffects: this.statusEffects ? this.statusEffects.getActiveEffects() : [],
      floorModifier: this.floorModifier || null,
      abilities: this.abilitySystem ? this.abilitySystem.getAbilityStates(this.levelSystem.level) : [],
    });
  }

  findNearestEnemyInRange() {
    const reach = GAME_CONFIG.PLAYER_ATTACK_REACH;
    // Extended range for mobile auto-targeting (generous lock-on radius)
    const scanRange = reach + 40;
    let nearest = null;
    let nearestDist = Infinity;
    const enemies = this.enemies.getChildren();
    for (const enemy of enemies) {
      if (!enemy.active || enemy.state === 'dead') continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (dist < scanRange && dist < nearestDist) {
        nearest = enemy;
        nearestDist = dist;
      }
    }
    return nearest;
  }

  update(time, delta) {
    // Tick status effects
    if (this.statusEffects) {
      this.statusEffects.update(delta);
    }

    // Tick ability cooldowns
    if (this.abilitySystem) {
      this.abilitySystem.update(delta);
    }

    if (this.player && this.player.active) {
      this.player.update(time, delta);
      this.checkInteractions();
      this._checkTraps(delta);
      this.updateUI();

      // Use potion with Q key
      if (Phaser.Input.Keyboard.JustDown(this.potionKey)) {
        this._usePotion();
      }

      // Auto-attack
      if (this.player.autoRetaliateTimer > 0 && !this.player.isAttacking && this.player.attackCooldown <= 0) {
        const nearest = this.findNearestEnemyInRange();
        if (nearest) {
          const dx = nearest.x - this.player.x;
          const dy = nearest.y - this.player.y;
          const dir = getDirection(dx, dy);
          if (dir) this.player.facing = dir;
          this.player.tryAttack();
        }
      }
    }

    // Update enemies
    const enemies = this.enemies.getChildren();
    for (const enemy of enemies) {
      if (enemy.active) {
        enemy.update(time, delta, this.player);
      }
    }

    // ── Visual polish: Y-sort + shadows + pixel-perfect camera ──
    updateEntityDepth(this.player);
    updateAllDepths(this.enemies);
    snapCameraScroll(this.cameras.main);

    // Phase 7 – refresh dark overlay cutouts each frame
    if (this.lightManager) {
      this.lightManager.updateOverlay(time);
    }
  }
}
