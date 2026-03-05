import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { DungeonGenerator } from '../systems/DungeonGenerator.js';
import { LootSystem } from '../systems/LootSystem.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { ENEMY_DATA } from '../data/enemies.js';

export class DungeonScene extends Phaser.Scene {
  constructor() {
    super('DungeonScene');
  }

  init(data) {
    this.currentFloor = data.floor || 1;
    this.levelSystem = this.registry.get('levelSystem');
    this.inventory = this.registry.get('inventory');
  }

  create() {
    // Generate dungeon
    const generator = new DungeonGenerator();
    const dungeon = generator.generate(this.currentFloor);

    this.dungeonData = dungeon;
    this.tileSize = GAME_CONFIG.TILE_SIZE;

    // Create tilemap layers
    this.createTilemap(dungeon);

    // Create player
    const spawnX = dungeon.spawnPos.x * this.tileSize + this.tileSize / 2;
    const spawnY = dungeon.spawnPos.y * this.tileSize + this.tileSize / 2;
    this.player = new Player(this, spawnX, spawnY, this.levelSystem);

    // Create enemies
    this.enemies = this.physics.add.group();
    this.createEnemies(dungeon.enemySpawns);

    // Collisions
    this.physics.add.collider(this.player, this.wallLayer);
    this.physics.add.collider(this.enemies, this.wallLayer);

    // Camera
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(2);

    // Create stairs sprite
    this.createStairs(dungeon.stairsPos);

    // Combat events
    this.events.on('playerAttack', this.handlePlayerAttack, this);
    this.events.on('enemyDeath', this.handleEnemyDeath, this);
    this.events.on('playerDeath', this.handlePlayerDeath, this);

    // Floor text
    this.updateUI();

    // Minimap hint
    this.createMinimap(dungeon);
  }

  createTilemap(dungeon) {
    const map = this.make.tilemap({
      tileWidth: this.tileSize,
      tileHeight: this.tileSize,
      width: dungeon.map[0].length,
      height: dungeon.map.length,
    });

    // Create tileset texture programmatically
    const tileGraphics = this.add.graphics();

    // Wall tile - stone brick pattern with depth
    tileGraphics.fillStyle(0x2a1a3a, 1);
    tileGraphics.fillRect(0, 0, this.tileSize, this.tileSize);
    // Brick horizontal lines
    tileGraphics.lineStyle(1, 0x1a0e28, 0.8);
    tileGraphics.lineBetween(0, 8, this.tileSize, 8);
    tileGraphics.lineBetween(0, 16, this.tileSize, 16);
    tileGraphics.lineBetween(0, 24, this.tileSize, 24);
    // Brick vertical offset lines
    tileGraphics.lineBetween(8, 0, 8, 8);
    tileGraphics.lineBetween(24, 0, 24, 8);
    tileGraphics.lineBetween(16, 8, 16, 16);
    tileGraphics.lineBetween(0, 8, 0, 16);
    tileGraphics.lineBetween(8, 16, 8, 24);
    tileGraphics.lineBetween(24, 16, 24, 24);
    tileGraphics.lineBetween(16, 24, 16, 32);
    // Highlight edges for depth
    tileGraphics.fillStyle(0x3f2852, 0.4);
    tileGraphics.fillRect(1, 1, this.tileSize - 2, 1);
    tileGraphics.fillRect(1, 9, this.tileSize - 2, 1);
    tileGraphics.fillRect(1, 17, this.tileSize - 2, 1);
    tileGraphics.fillRect(1, 25, this.tileSize - 2, 1);
    // Dark mortar shadows
    tileGraphics.fillStyle(0x150b20, 0.5);
    tileGraphics.fillRect(0, 7, this.tileSize, 1);
    tileGraphics.fillRect(0, 15, this.tileSize, 1);
    tileGraphics.fillRect(0, 23, this.tileSize, 1);
    tileGraphics.lineStyle(1, 0x3a2a4a, 0.3);
    tileGraphics.strokeRect(0, 0, this.tileSize, this.tileSize);
    tileGraphics.generateTexture('tile-wall', this.tileSize, this.tileSize);
    tileGraphics.clear();

    // Floor tile is loaded from dungeon-floor tile asset

    // Stairs tile - carved stone steps with shadow/depth
    tileGraphics.fillStyle(0x6a5a3a, 1);
    tileGraphics.fillRect(0, 0, this.tileSize, this.tileSize);
    // Step surfaces (light)
    tileGraphics.fillStyle(0x9a8a5a, 1);
    tileGraphics.fillRect(2, 2, 28, 5);
    tileGraphics.fillRect(4, 9, 24, 5);
    tileGraphics.fillRect(6, 16, 20, 5);
    tileGraphics.fillRect(8, 23, 16, 5);
    // Step shadow edges (dark)
    tileGraphics.fillStyle(0x4a3a1a, 0.8);
    tileGraphics.fillRect(2, 7, 28, 2);
    tileGraphics.fillRect(4, 14, 24, 2);
    tileGraphics.fillRect(6, 21, 20, 2);
    tileGraphics.fillRect(8, 28, 16, 2);
    // Highlight top edge of each step
    tileGraphics.fillStyle(0xbaa86a, 0.5);
    tileGraphics.fillRect(2, 2, 28, 1);
    tileGraphics.fillRect(4, 9, 24, 1);
    tileGraphics.fillRect(6, 16, 20, 1);
    tileGraphics.fillRect(8, 23, 16, 1);
    tileGraphics.generateTexture('tile-stairs', this.tileSize, this.tileSize);
    tileGraphics.destroy();

    // Place floor tiles
    this.floorGroup = this.add.group();
    this.wallLayer = this.physics.add.staticGroup();

    for (let y = 0; y < dungeon.map.length; y++) {
      for (let x = 0; x < dungeon.map[y].length; x++) {
        const px = x * this.tileSize + this.tileSize / 2;
        const py = y * this.tileSize + this.tileSize / 2;
        const tile = dungeon.map[y][x];

        if (tile === 0 || tile === 2) {
          const floor = this.add.image(px, py, 'dungeon-floor').setDepth(0);
          this.floorGroup.add(floor);
        }
        if (tile === 1) {
          // Only add visible walls (adjacent to a floor tile)
          if (this.isAdjacentToFloor(dungeon.map, x, y)) {
            this.add.image(px, py, 'tile-wall').setDepth(1);
            const wall = this.physics.add.staticImage(px, py, 'tile-wall');
            wall.setVisible(false);
            wall.body.setSize(this.tileSize, this.tileSize);
            this.wallLayer.add(wall);
          }
        }
      }
    }
  }

  isAdjacentToFloor(map, x, y) {
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

  createStairs(stairsPos) {
    const sx = stairsPos.x * this.tileSize + this.tileSize / 2;
    const sy = stairsPos.y * this.tileSize + this.tileSize / 2;
    this.stairs = this.add.image(sx, sy, 'tile-stairs').setDepth(1);

    // Pulsing effect
    this.tweens.add({
      targets: this.stairs,
      alpha: 0.6,
      yoyo: true,
      repeat: -1,
      duration: 800,
    });
  }

  createEnemies(spawns) {
    for (const spawn of spawns) {
      const ex = spawn.x * this.tileSize + this.tileSize / 2;
      const ey = spawn.y * this.tileSize + this.tileSize / 2;
      const enemy = new Enemy(this, ex, ey, spawn.type);
      this.enemies.add(enemy);
    }
  }

  createMinimap(dungeon) {
    const mmScale = 3;
    const mmWidth = dungeon.map[0].length * mmScale;
    const mmHeight = dungeon.map.length * mmScale;

    this.minimapGraphics = this.add.graphics();
    this.minimapGraphics.setScrollFactor(0);
    this.minimapGraphics.setDepth(100);

    this.drawMinimap(dungeon, mmScale);
  }

  drawMinimap(dungeon, mmScale) {
    const g = this.minimapGraphics;
    const offsetX = 10;
    const offsetY = 10;
    const mapW = dungeon.map[0].length;
    const mapH = dungeon.map.length;

    // Background
    g.fillStyle(0x000000, 0.6);
    g.fillRect(offsetX - 2, offsetY - 2, mapW * mmScale + 4, mapH * mmScale + 4);

    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const tile = dungeon.map[y][x];
        if (tile === 0) {
          g.fillStyle(0x666666, 0.8);
          g.fillRect(offsetX + x * mmScale, offsetY + y * mmScale, mmScale, mmScale);
        } else if (tile === 2) {
          g.fillStyle(0xffff00, 1);
          g.fillRect(offsetX + x * mmScale, offsetY + y * mmScale, mmScale, mmScale);
        }
      }
    }

    // Player dot (will be updated)
    this.minimapPlayerDot = this.add.rectangle(0, 0, mmScale + 1, mmScale + 1, 0x00ff00);
    this.minimapPlayerDot.setScrollFactor(0);
    this.minimapPlayerDot.setDepth(101);

    this.mmScale = mmScale;
    this.mmOffsetX = offsetX;
    this.mmOffsetY = offsetY;
  }

  handlePlayerAttack(attackData) {
    const enemies = this.enemies.getChildren();
    for (const enemy of enemies) {
      if (!enemy.active || enemy.state === 'dead') continue;
      const dist = Phaser.Math.Distance.Between(attackData.x, attackData.y, enemy.x, enemy.y);
      if (dist < attackData.reach + 20) {
        enemy.takeDamage(attackData.damage);
      }
    }
  }

  handleEnemyDeath(data) {
    // Award gold and exp
    const enemyData = ENEMY_DATA[data.enemyType];
    if (!enemyData) return;

    const goldAmount = this.levelSystem.getScaledGold(
      enemyData.gold.min, enemyData.gold.max, this.currentFloor
    );
    const expAmount = this.levelSystem.getScaledExp(enemyData.exp, this.currentFloor);

    this.levelSystem.addGold(goldAmount);
    const leveledUp = this.levelSystem.addExp(expAmount);

    // Show gold/exp popup
    this.showPopup(data.x, data.y - 10, `+${goldAmount}g +${expAmount}xp`, '#ffdd44');

    if (leveledUp) {
      this.showPopup(data.x, data.y - 30, `LEVEL UP! Lv${this.levelSystem.level}`, '#44ff44');
      this.player.hp = this.player.getMaxHP();
    }

    // Roll loot - items go directly to inventory
    const drops = LootSystem.rollDrops(data.enemyType, this.currentFloor);
    for (const drop of drops) {
      this.inventory.addItem(drop.itemId, drop.quantity);
      this.showPopup(data.x, data.y + 10, `+${drop.name}`, '#ffffff');
    }

    this.updateUI();
  }

  handlePlayerDeath() {
    // Return to town, lose some gold
    const lostGold = Math.floor(this.levelSystem.gold * 0.1);
    this.levelSystem.gold -= lostGold;

    this.showPopup(this.player.x, this.player.y, 'YOU DIED', '#ff0000');

    this.time.delayedCall(1500, () => {
      this.scene.start('TownScene');
    });
  }

  showPopup(x, y, text, color) {
    const popup = this.add.text(x, y, text, {
      fontSize: '12px',
      fill: color,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(25);

    this.tweens.add({
      targets: popup,
      y: popup.y - 40,
      alpha: 0,
      duration: 1500,
      onComplete: () => popup.destroy(),
    });
  }

  updateUI() {
    // Emit to UI scene
    this.scene.get('UIScene').events.emit('updateStats', {
      hp: this.player.hp,
      maxHp: this.player.getMaxHP(),
      level: this.levelSystem.level,
      exp: this.levelSystem.exp,
      expNext: this.levelSystem.getExpForNextLevel(),
      gold: this.levelSystem.gold,
      floor: this.currentFloor,
      attack: this.levelSystem.getAttack(),
      location: 'dungeon',
      inventory: this.inventory.getItems(),
    });
  }

  checkStairsOverlap() {
    if (!this.stairs || !this.player) return;

    const dist = Phaser.Math.Distance.Between(
      this.player.x, this.player.y,
      this.stairs.x, this.stairs.y
    );

    if (dist < this.tileSize) {
      // Show prompt
      if (!this.stairsPrompt) {
        this.stairsPrompt = this.add.text(this.stairs.x, this.stairs.y - 20, 'Press E to descend', {
          fontSize: '10px',
          fill: '#ffffff',
          fontFamily: 'monospace',
          stroke: '#000000',
          strokeThickness: 2,
        }).setOrigin(0.5).setDepth(20);
      }

      if (Phaser.Input.Keyboard.JustDown(this.input.keyboard.addKey('E'))) {
        this.goToNextFloor();
      }
    } else if (this.stairsPrompt) {
      this.stairsPrompt.destroy();
      this.stairsPrompt = null;
    }
  }

  goToNextFloor() {
    this.scene.restart({ floor: this.currentFloor + 1 });
  }

  updateMinimap() {
    if (!this.minimapPlayerDot || !this.player) return;
    const tileX = Math.floor(this.player.x / this.tileSize);
    const tileY = Math.floor(this.player.y / this.tileSize);
    this.minimapPlayerDot.x = this.mmOffsetX + tileX * this.mmScale + this.mmScale / 2;
    this.minimapPlayerDot.y = this.mmOffsetY + tileY * this.mmScale + this.mmScale / 2;
  }

  update(time, delta) {
    if (this.player && this.player.active) {
      this.player.update(time, delta);
      this.checkStairsOverlap();
      this.updateMinimap();
      this.updateUI();
    }

    // Update enemies
    const enemies = this.enemies.getChildren();
    for (const enemy of enemies) {
      if (enemy.active) {
        enemy.update(time, delta, this.player);
      }
    }
  }
}
