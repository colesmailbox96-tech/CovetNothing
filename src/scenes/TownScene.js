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
    const tileSize = GAME_CONFIG.TILE_SIZE;

    // Create town map (20x15 tiles)
    const townW = 20;
    const townH = 15;

    // Generate tile textures
    this.createTileTextures(tileSize);

    // Town layout
    this.createTownLayout(townW, townH, tileSize);

    // Player in center of town
    const spawnX = 10 * tileSize + tileSize / 2;
    const spawnY = 10 * tileSize + tileSize / 2;
    this.player = new Player(this, spawnX, spawnY, this.levelSystem);
    this.player.hp = this.player.getMaxHP(); // Full heal in town

    // Camera — adaptive zoom for mobile
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(getAdaptiveZoom(this.scale.width));

    // Walls
    this.physics.add.collider(this.player, this.wallLayer);

    // NPC interactions
    this.createNPCs(tileSize);

    // Dungeon entrance
    this.createDungeonEntrance(tileSize);

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

  createTileTextures(ts) {
    const g = this.add.graphics();

    // Town grass texture is loaded from tile asset

    // Town path texture is loaded from cobblestone tile asset

    // Building wall - wooden planks with grain
    g.fillStyle(0x6b4423, 1);
    g.fillRect(0, 0, ts, ts);
    // Plank horizontal lines
    g.lineStyle(1, 0x5a3618, 0.7);
    g.lineBetween(0, 8, ts, 8);
    g.lineBetween(0, 16, ts, 16);
    g.lineBetween(0, 24, ts, 24);
    // Wood grain detail
    g.fillStyle(0x7b5433, 0.3);
    g.fillRect(2, 1, 10, 1);
    g.fillRect(18, 10, 8, 1);
    g.fillRect(5, 18, 12, 1);
    g.fillRect(20, 26, 6, 1);
    // Highlight top edge of planks
    g.fillStyle(0x8b6243, 0.3);
    g.fillRect(0, 0, ts, 1);
    g.fillRect(0, 9, ts, 1);
    g.fillRect(0, 17, ts, 1);
    g.fillRect(0, 25, ts, 1);
    g.lineStyle(1, 0x8b6243, 0.4);
    g.strokeRect(0, 0, ts, ts);
    g.generateTexture('town-wall', ts, ts);
    g.clear();

    // Dungeon entrance - dark portal with glow
    g.fillStyle(0x1a0a2a, 1);
    g.fillRect(0, 0, ts, ts);
    g.fillStyle(0x2a1240, 1);
    g.fillRect(4, 0, ts - 8, ts);
    // Inner glow layers
    g.fillStyle(0x3a1a55, 0.6);
    g.fillRect(8, 4, ts - 16, ts - 8);
    g.fillStyle(0x4a2a65, 0.4);
    g.fillRect(10, 8, ts - 20, ts - 16);
    // Bright center orb
    g.fillStyle(0xff6600, 0.8);
    g.fillRect(ts / 2 - 4, ts / 2 - 4, 8, 8);
    g.fillStyle(0xffaa44, 0.5);
    g.fillRect(ts / 2 - 2, ts / 2 - 2, 4, 4);
    // Corner rune marks
    g.fillStyle(0x8844aa, 0.4);
    g.fillRect(2, 2, 3, 3);
    g.fillRect(ts - 5, 2, 3, 3);
    g.fillRect(2, ts - 5, 3, 3);
    g.fillRect(ts - 5, ts - 5, 3, 3);
    g.generateTexture('dungeon-entrance', ts, ts);
    g.clear();

    g.destroy();
  }

  createTownLayout(w, h, ts) {
    this.wallLayer = this.physics.add.staticGroup();

    // Town map layout:
    // 0 = grass, 1 = wall, 2 = path, 3 = dungeon entrance
    const layout = [];
    for (let y = 0; y < h; y++) {
      layout[y] = [];
      for (let x = 0; x < w; x++) {
        // Border walls
        if (x === 0 || x === w - 1 || y === 0 || y === h - 1) {
          layout[y][x] = 1;
        }
        // Main path (horizontal)
        else if (y >= 6 && y <= 8 && x >= 2 && x <= w - 3) {
          layout[y][x] = 2;
        }
        // Main path (vertical to dungeon)
        else if (x >= 9 && x <= 11 && y >= 1 && y <= 6) {
          layout[y][x] = 2;
        }
        // Shop building (top-left)
        else if (x >= 2 && x <= 5 && y >= 2 && y <= 4) {
          layout[y][x] = 1;
        }
        // Blacksmith building (top-right)
        else if (x >= 14 && x <= 17 && y >= 2 && y <= 4) {
          layout[y][x] = 1;
        }
        // Crafting building (bottom-left)
        else if (x >= 2 && x <= 5 && y >= 10 && y <= 12) {
          layout[y][x] = 1;
        }
        else {
          layout[y][x] = 0;
        }
      }
    }

    // Dungeon entrance at top center
    layout[1][10] = 3;

    // Render tiles
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = x * ts + ts / 2;
        const py = y * ts + ts / 2;
        const tile = layout[y][x];

        if (tile === 0) {
          this.add.image(px, py, 'town-grass').setDepth(0);
        } else if (tile === 1) {
          this.add.image(px, py, 'town-wall').setDepth(1);
          const wall = this.physics.add.staticImage(px, py, 'town-wall');
          wall.setVisible(false);
          wall.body.setSize(ts, ts);
          this.wallLayer.add(wall);
        } else if (tile === 2) {
          this.add.image(px, py, 'town-path').setDepth(0);
        } else if (tile === 3) {
          this.add.image(px, py, 'town-path').setDepth(0);
          this.add.image(px, py, 'dungeon-entrance').setDepth(1);
        }
      }
    }
  }

  createNPCs(ts) {
    // Shop NPC
    const shopX = 3.5 * ts + ts / 2;
    const shopY = 5.5 * ts + ts / 2;
    this.createNPCMarker(shopX, shopY, 'Shop', 0xffaa00, () => {
      this.openShop();
    });

    // Blacksmith NPC
    const smithX = 15.5 * ts + ts / 2;
    const smithY = 5.5 * ts + ts / 2;
    this.createNPCMarker(smithX, smithY, 'Blacksmith', 0xff6600, () => {
      this.openBlacksmith();
    });

    // Crafting NPC
    const craftX = 3.5 * ts + ts / 2;
    const craftY = 9.5 * ts + ts / 2;
    this.createNPCMarker(craftX, craftY, 'Crafting', 0x66aaff, () => {
      this.openCrafting();
    });
  }

  createNPCMarker(x, y, label, color, callback) {
    const circle = this.add.circle(x, y, 10, color, 0.8).setDepth(5);
    const text = this.add.text(x, y - 18, label, {
      fontSize: '8px',
      fill: '#ffffff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(6);

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
        }).setOrigin(0.5).setDepth(6);
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
    const x = 10 * ts + ts / 2;
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
    }).setOrigin(0.5).setDepth(6);

    this.dungeonZone = zone;
    this.dungeonEntrance = { x, y };
  }

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

  showPopup(x, y, text, color) {
    const popup = this.add.text(x, y, text, {
      fontSize: '10px',
      fill: color,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(25);

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
            ).setOrigin(0.5).setDepth(20);
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
