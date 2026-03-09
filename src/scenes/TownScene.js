import Phaser from 'phaser';
import { GAME_CONFIG, getAdaptiveZoom } from '../config.js';
import { Player } from '../entities/Player.js';
import { ITEM_DATA } from '../data/items.js';
import { LevelSystem } from '../systems/LevelSystem.js';
import { Inventory } from '../systems/LootSystem.js';
import { EquipmentSystem } from '../systems/EquipmentSystem.js';
import { CraftingSystem, RECIPES } from '../systems/CraftingSystem.js';
import { StatusEffectSystem } from '../systems/StatusEffectSystem.js';
import { RunStats } from '../systems/RunStats.js';
import { updateEntityDepth, snapCameraScroll } from '../systems/DepthManager.js';
import { LayerManager, ENTITY_BASE, FOREGROUND_DEPTH } from '../systems/LayerManager.js';
import { Decorator } from '../systems/Decorator.js';
import { SeededRNG } from '../utils/SeededRNG.js';
import { LightManager } from '../systems/LightManager.js';
import { T, MAP_W, MAP_H, TS } from '../data/townMapData.js';

export class TownScene extends Phaser.Scene {
  constructor() {
    super('TownScene');
  }

  init() {
    this.equipmentSystem = this.registry.get('equipmentSystem');
    if (!this.equipmentSystem) {
      this.equipmentSystem = new EquipmentSystem();
      this.registry.set('equipmentSystem', this.equipmentSystem);
    }

    this.statusEffects = this.registry.get('statusEffects');
    if (!this.statusEffects) {
      this.statusEffects = new StatusEffectSystem();
      this.registry.set('statusEffects', this.statusEffects);
    }
    // Clear any lingering buffs when returning to town
    this.statusEffects.clear();

    this.runStats = this.registry.get('runStats');
    if (!this.runStats) {
      this.runStats = new RunStats();
      this.registry.set('runStats', this.runStats);
    }

    this.levelSystem = this.registry.get('levelSystem');
    this.inventory = this.registry.get('inventory');

    // Initialize systems if first load
    if (!this.levelSystem) {
      this.levelSystem = new LevelSystem(this.equipmentSystem, this.statusEffects);
      this.inventory = new Inventory();
      this.registry.set('levelSystem', this.levelSystem);
      this.registry.set('inventory', this.inventory);
    }

    // Link equipment to a levelSystem that was created before this system existed
    if (!this.levelSystem.equipmentSystem) {
      this.levelSystem.equipmentSystem = this.equipmentSystem;
    }
    if (!this.levelSystem.statusEffects) {
      this.levelSystem.statusEffects = this.statusEffects;
    }
  }

  create() {
    const ts = GAME_CONFIG.TILE_SIZE;

    // Phase 2 – layered rendering (still used for entities / UI overlays)
    this.layerManager = new LayerManager(this);

    // ── Multi-layer Phaser tilemap ──
    this._createTilemap(ts);

    // Player spawn – center of the map on the main path
    const spawnX = 14 * ts + ts / 2;
    const spawnY = 9 * ts + ts / 2;
    this.player = new Player(this, spawnX, spawnY, this.levelSystem);
    this.player.hp = this.player.getMaxHP(); // Full heal in town

    // Camera — adaptive zoom for mobile
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(getAdaptiveZoom(this.scale.width));

    // Collisions with tilemap layers
    this.physics.add.collider(this.player, this.structuresLayer);
    this.physics.add.collider(this.player, this.waterLayer);

    // NPC interactions
    this.createNPCs(ts);

    // Dungeon entrance
    this.createDungeonEntrance(ts);

    // Place storefront sprite on the Shop building (tiles x:3-6, y:3-5)
    const shopCenterX = (3 + 6) / 2 * ts + ts / 2;
    const shopCenterY = (3 + 5) / 2 * ts + ts / 2;
    this.layerManager.addToLayer('propsSolidLayer',
      this.add.image(shopCenterX, shopCenterY, 'storefront-sprites', 0)
        .setScale(2));

    // Phase 4 – town lighting (warm lamps near buildings / NPCs)
    this.lightManager = new LightManager(this);
    this._createTownLights(ts);
    this.lightManager.createVignette({ alpha: 0.25 });

    // Update UI
    this.updateUI();

    // Welcome text
    if (!this.registry.get('visited')) {
      this.registry.set('visited', true);
      this.showPopup(spawnX, spawnY - 30, 'Welcome to Town!', '#ffdd44');
      this.time.delayedCall(1500, () => {
        this.showPopup(spawnX, spawnY - 30, 'Find the dungeon entrance to begin', '#aaaaff');
      });
    }
  }

  /* ================================================================ */
  /*  Tilemap setup                                                    */
  /* ================================================================ */

  _createTilemap(ts) {
    const map = this.make.tilemap({ key: 'town-map' });
    const tileset = map.addTilesetImage('town-tileset');

    // ---- Ground layer (depth 0 – below everything) ----
    this.groundLayer = map.createLayer('ground', tileset, 0, 0);
    this.groundLayer.setDepth(0);

    // ---- Water layer (depth 1 – just above ground) ----
    this.waterLayer = map.createLayer('water', tileset, 0, 0);
    this.waterLayer.setDepth(1);
    // Collide with all non-empty water/stone tiles
    this.waterLayer.setCollisionByExclusion([-1, 0]);

    // ---- Structures layer (depth 200 – props band) ----
    this.structuresLayer = map.createLayer('structures', tileset, 0, 0);
    this.structuresLayer.setDepth(200);
    // Collision on all structure tiles EXCEPT bridge planks (walkable)
    const walkableTiles = [T.BRIDGE + 1]; // GIDs (bridge planks only)
    this.structuresLayer.setCollisionByExclusion([-1, 0, ...walkableTiles]);

    // ---- Canopy layer (renders ABOVE the player for walk-behind) ----
    this.canopyLayer = map.createLayer('canopy', tileset, 0, 0);
    // Must be above the max entity depth (ENTITY_BASE + MAP_H * TS ≈ 1100)
    // but below FOREGROUND_DEPTH (10 000) used for UI labels / popups.
    const CANOPY_DEPTH = FOREGROUND_DEPTH - 100;
    this.canopyLayer.setDepth(CANOPY_DEPTH);

    this.townMap = map;
  }

  /* ================================================================ */
  /*  NPCs                                                             */
  /* ================================================================ */

  createNPCs(ts) {
    // Shop NPC (below shop building 3-6, 3-5)
    const shopX = 4.5 * ts + ts / 2;
    const shopY = 6.5 * ts + ts / 2;
    this.createNPCMarker(shopX, shopY, 'Shop', 0xffaa00, () => {
      this.openShop();
    });

    // Blacksmith NPC (below blacksmith 23-26, 3-5)
    const smithX = 24.5 * ts + ts / 2;
    const smithY = 6.5 * ts + ts / 2;
    this.createNPCMarker(smithX, smithY, 'Blacksmith', 0xff6600, () => {
      this.openBlacksmith();
    });

    // Crafting NPC (below crafting 3-6, 15-17)
    const craftX = 4.5 * ts + ts / 2;
    const craftY = 18.5 * ts + ts / 2;
    this.createNPCMarker(craftX, craftY, 'Crafting', 0x66aaff, () => {
      this.openCrafting();
    });
  }

  /** Phase 4 – Place warm light pools near buildings and the dungeon entrance. */
  _createTownLights(ts) {
    if (!this.lightManager) return;
    // Shop building entrance
    this.lightManager.addLight(4.5 * ts + ts / 2, 6 * ts, { radius: 2.5, alpha: 0.35, tint: 0xffdd99 });
    // Blacksmith entrance
    this.lightManager.addLight(24.5 * ts + ts / 2, 6 * ts, { radius: 2.5, alpha: 0.35, tint: 0xffaa66 });
    // Crafting building entrance
    this.lightManager.addLight(4.5 * ts + ts / 2, 18.5 * ts, { radius: 2.5, alpha: 0.3, tint: 0xaaddff });
    // Dungeon entrance glow
    this.lightManager.addLight(14.5 * ts, 1.5 * ts, { radius: 2, alpha: 0.3, tint: 0xccbbff });
    // Lantern lights
    for (const l of [{ x: 12, y: 7 }, { x: 17, y: 7 }, { x: 14, y: 4 }, { x: 15, y: 4 }, { x: 14, y: 18 }, { x: 15, y: 18 }]) {
      this.lightManager.addLight(l.x * ts + ts / 2, l.y * ts + ts / 2, { radius: 1.8, alpha: 0.3, tint: 0xffdd88 });
    }
  }

  createNPCMarker(x, y, label, color, callback) {
    const circle = this.add.circle(x, y, 10, color, 0.8);
    this.layerManager.addToLayer('entityLayer', circle);
    const text = this.add.text(x, y - 18, label, {
      fontSize: '8px',
      fill: '#ffffff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.layerManager.addToLayer('foregroundLayer', text);

    // Interaction zone
    const zone = this.add.zone(x, y, 40, 40);
    this.physics.add.existing(zone, true);

    // Store callback data
    zone.npcCallback = callback;
    zone.npcLabel = label;
    this.physics.add.overlap(this.player, zone, () => {
      if (!zone.promptText) {
        zone.promptText = this.add.text(x, y + 18, this._interactHint(), {
          fontSize: '7px',
          fill: '#ffffff',
          fontFamily: 'monospace',
          stroke: '#000000',
          strokeThickness: 1,
        }).setOrigin(0.5);
        this.layerManager.addToLayer('foregroundLayer', zone.promptText);
      }
    });

    // Bounce animation
    this.tweens.add({
      targets: circle,
      y: y - 3,
      yoyo: true,
      repeat: -1,
      duration: 1000,
    });

    if (!this.npcZones) this.npcZones = [];
    this.npcZones.push(zone);
  }

  createDungeonEntrance(ts) {
    const x = 14.5 * ts;
    const y = 1 * ts + ts / 2;

    const zone = this.add.zone(x, y, ts * 2, ts);
    this.physics.add.existing(zone, true);
    zone.isDungeonEntrance = true;

    const label = this.add.text(x, y - 18, 'Dungeon', {
      fontSize: '8px',
      fill: '#ff6644',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.layerManager.addToLayer('foregroundLayer', label);

    this.dungeonZone = zone;
    this.dungeonEntrance = { x, y };
  }

  /* ================================================================ */
  /*  Shop / Blacksmith / Crafting                                     */
  /* ================================================================ */

  openBlacksmith() {
    const uiScene = this.scene.get('UIScene');
    if (uiScene) {
      uiScene.showEquipmentPanel(this.inventory, this.equipmentSystem);
    }
  }

  openCrafting() {
    const uiScene = this.scene.get('UIScene');
    if (uiScene) {
      uiScene.showCraftingPanel(this.inventory);
    }
  }

  openShop() {
    // Simple sell interface via UI
    const items = this.inventory.getItems();
    if (items.length === 0) {
      this.showPopup(this.player.x, this.player.y - 20, 'Nothing to sell!', '#aaaaaa');
      return;
    }

    // Sell all items
    const totalValue = this.inventory.getTotalSellValue();
    if (totalValue > 0) {
      this.levelSystem.addGold(totalValue);
      // Clear inventory
      for (const item of items) {
        this.inventory.removeItem(item.itemId, item.quantity);
      }
      this.showPopup(this.player.x, this.player.y - 20, `Sold all for ${totalValue}g!`, '#ffdd44');
      this.updateUI();
    }
  }

  /* ================================================================ */
  /*  Utilities                                                        */
  /* ================================================================ */

  showPopup(x, y, text, color) {
    const popup = this.add.text(x, y, text, {
      fontSize: '10px',
      fill: color,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(FOREGROUND_DEPTH + 25);

    this.tweens.add({
      targets: popup,
      y: popup.y - 30,
      alpha: 0,
      duration: 2000,
      onComplete: () => popup.destroy(),
    });
  }

  updateUI() {
    const uiScene = this.scene.get('UIScene');
    if (uiScene) {
      uiScene.events.emit('updateStats', {
        hp: this.player ? this.player.hp : this.levelSystem.getMaxHP(),
        maxHp: this.levelSystem.getMaxHP(),
        level: this.levelSystem.level,
        exp: this.levelSystem.exp,
        expNext: this.levelSystem.getExpForNextLevel(),
        gold: this.levelSystem.gold,
        floor: 0,
        attack: this.levelSystem.getAttack(),
        defense: this.levelSystem.getDefense(),
        equipment: {
          weapon: this.equipmentSystem ? this.equipmentSystem.getEquipped('weapon') : null,
          armor: this.equipmentSystem ? this.equipmentSystem.getEquipped('armor') : null,
        },
        location: 'town',
        inventory: this.inventory.getItems(),
      });
    }
  }

  /* ================================================================ */
  /*  Frame update                                                     */
  /* ================================================================ */

  update(time, delta) {
    if (this.player && this.player.active) {
      this.player.update(time, delta);
      this.updateUI();

      // Check dungeon entrance
      if (this.dungeonZone) {
        const dist = Phaser.Math.Distance.Between(
          this.player.x, this.player.y,
          this.dungeonEntrance.x, this.dungeonEntrance.y
        );

        if (dist < 30) {
          if (!this.dungeonPrompt) {
            this.dungeonPrompt = this.add.text(
              this.dungeonEntrance.x, this.dungeonEntrance.y + 20,
              this._interactHint('enter'), {
                fontSize: '7px',
                fill: '#ffffff',
                fontFamily: 'monospace',
                stroke: '#000000',
                strokeThickness: 1,
              }
            ).setOrigin(0.5).setDepth(FOREGROUND_DEPTH + 20);
          }

          if (Phaser.Input.Keyboard.JustDown(this.input.keyboard.addKey('E'))) {
            this.scene.start('DungeonScene', { floor: 1 });
          }
        } else if (this.dungeonPrompt) {
          this.dungeonPrompt.destroy();
          this.dungeonPrompt = null;
        }
      }

      // Check NPC interactions
      if (this.npcZones) {
        const eKey = this.input.keyboard.addKey('E');
        for (const zone of this.npcZones) {
          const dist = Phaser.Math.Distance.Between(
            this.player.x, this.player.y,
            zone.x, zone.y
          );
          if (dist < 30) {
            if (Phaser.Input.Keyboard.JustDown(eKey) && zone.npcCallback) {
              zone.npcCallback();
            }
          } else if (zone.promptText) {
            zone.promptText.destroy();
            zone.promptText = null;
          }
        }
      }
    }

    // ── Visual polish: Y-sort + shadow + pixel-perfect camera ──
    updateEntityDepth(this.player);
    snapCameraScroll(this.cameras.main);
  }

  /** Return a touch-aware interaction prompt */
  _interactHint(action) {
    const ui = this.scene.get('UIScene');
    if (ui && ui.isTouchDevice) {
      return action ? `Tap to ${action}` : 'Tap';
    }
    return action ? `Press E to ${action}` : 'Press E';
  }

  /** Called from UIScene when the touch E button is pressed */
  handleTouchInteract() {
    if (!this.player || !this.player.active) return;

    // Wider interaction range for touch (fat-finger tolerance)
    const touchRange = GAME_CONFIG.TILE_SIZE * 1.40625; // ≈45px when TILE_SIZE is 32

    // Check dungeon entrance
    if (this.dungeonZone) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.dungeonEntrance.x, this.dungeonEntrance.y
      );
      if (dist < touchRange) {
        this.scene.start('DungeonScene', { floor: 1 });
        return;
      }
    }

    // Check NPC interactions
    if (this.npcZones) {
      for (const zone of this.npcZones) {
        const dist = Phaser.Math.Distance.Between(
          this.player.x, this.player.y,
          zone.x, zone.y
        );
        if (dist < touchRange && zone.npcCallback) {
          zone.npcCallback();
          return;
        }
      }
    }
  }
}
