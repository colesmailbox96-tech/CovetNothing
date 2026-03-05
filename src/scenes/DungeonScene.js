import Phaser from 'phaser';
import { GAME_CONFIG, getDirection } from '../config.js';
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

    // Room state tracking
    this.revealedRooms = new Set([0]); // Room 0 (safe room) is always revealed
    this.roomCleared = new Set([0]);   // Safe room starts cleared
    this.activeCombatRoom = -1;        // Which room has active combat (-1 = none)
    this.roomEnemies = {};             // Maps roomIndex -> array of enemy sprites

    // Create tileset textures
    this.createTileTextures();

    // Create tilemap with room visibility
    this.createTilemap(dungeon);

    // Create player
    const spawnX = dungeon.spawnPos.x * this.tileSize + this.tileSize / 2;
    const spawnY = dungeon.spawnPos.y * this.tileSize + this.tileSize / 2;
    this.player = new Player(this, spawnX, spawnY, this.levelSystem);

    // Create enemies group (enemies spawn lazily when rooms are revealed)
    this.enemies = this.physics.add.group();

    // Create doors at corridor-room boundaries
    this.doors = [];
    this.doorGroup = this.physics.add.staticGroup();
    this.createDoors(dungeon);

    // Crafting bench in safe room
    this.createCraftingBench(dungeon.craftingBenchPos);

    // Collisions
    this.physics.add.collider(this.player, this.wallLayer);
    this.physics.add.collider(this.enemies, this.wallLayer);
    this.physics.add.collider(this.player, this.doorGroup);
    this.physics.add.collider(this.enemies, this.doorGroup);

    // Camera
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(2);

    // Create stairs sprite (hidden until its room is revealed)
    this.createStairs(dungeon.stairsPos);

    // E key for interactions
    this.interactKey = this.input.keyboard.addKey('E');

    // Combat events
    this.events.on('playerAttack', this.handlePlayerAttack, this);
    this.events.on('enemyDeath', this.handleEnemyDeath, this);
    this.events.on('playerDeath', this.handlePlayerDeath, this);

    // Floor text
    this.updateUI();

    // Minimap
    this.createMinimap(dungeon);
  }

  createTileTextures() {
    const tileGraphics = this.add.graphics();

    // Wall tile - stone brick pattern with depth
    tileGraphics.fillStyle(0x2a1a3a, 1);
    tileGraphics.fillRect(0, 0, this.tileSize, this.tileSize);
    tileGraphics.lineStyle(1, 0x1a0e28, 0.8);
    tileGraphics.lineBetween(0, 8, this.tileSize, 8);
    tileGraphics.lineBetween(0, 16, this.tileSize, 16);
    tileGraphics.lineBetween(0, 24, this.tileSize, 24);
    tileGraphics.lineBetween(8, 0, 8, 8);
    tileGraphics.lineBetween(24, 0, 24, 8);
    tileGraphics.lineBetween(16, 8, 16, 16);
    tileGraphics.lineBetween(0, 8, 0, 16);
    tileGraphics.lineBetween(8, 16, 8, 24);
    tileGraphics.lineBetween(24, 16, 24, 24);
    tileGraphics.lineBetween(16, 24, 16, 32);
    tileGraphics.fillStyle(0x3f2852, 0.4);
    tileGraphics.fillRect(1, 1, this.tileSize - 2, 1);
    tileGraphics.fillRect(1, 9, this.tileSize - 2, 1);
    tileGraphics.fillRect(1, 17, this.tileSize - 2, 1);
    tileGraphics.fillRect(1, 25, this.tileSize - 2, 1);
    tileGraphics.fillStyle(0x150b20, 0.5);
    tileGraphics.fillRect(0, 7, this.tileSize, 1);
    tileGraphics.fillRect(0, 15, this.tileSize, 1);
    tileGraphics.fillRect(0, 23, this.tileSize, 1);
    tileGraphics.lineStyle(1, 0x3a2a4a, 0.3);
    tileGraphics.strokeRect(0, 0, this.tileSize, this.tileSize);
    tileGraphics.generateTexture('tile-wall', this.tileSize, this.tileSize);
    tileGraphics.clear();

    // Stairs tile - carved stone steps
    tileGraphics.fillStyle(0x6a5a3a, 1);
    tileGraphics.fillRect(0, 0, this.tileSize, this.tileSize);
    tileGraphics.fillStyle(0x9a8a5a, 1);
    tileGraphics.fillRect(2, 2, 28, 5);
    tileGraphics.fillRect(4, 9, 24, 5);
    tileGraphics.fillRect(6, 16, 20, 5);
    tileGraphics.fillRect(8, 23, 16, 5);
    tileGraphics.fillStyle(0x4a3a1a, 0.8);
    tileGraphics.fillRect(2, 7, 28, 2);
    tileGraphics.fillRect(4, 14, 24, 2);
    tileGraphics.fillRect(6, 21, 20, 2);
    tileGraphics.fillRect(8, 28, 16, 2);
    tileGraphics.fillStyle(0xbaa86a, 0.5);
    tileGraphics.fillRect(2, 2, 28, 1);
    tileGraphics.fillRect(4, 9, 24, 1);
    tileGraphics.fillRect(6, 16, 20, 1);
    tileGraphics.fillRect(8, 23, 16, 1);
    tileGraphics.generateTexture('tile-stairs', this.tileSize, this.tileSize);
    tileGraphics.clear();

    // Door tile - reinforced wooden door
    tileGraphics.fillStyle(0x5a3a1a, 1);
    tileGraphics.fillRect(0, 0, this.tileSize, this.tileSize);
    // Planks
    tileGraphics.fillStyle(0x6a4a2a, 1);
    tileGraphics.fillRect(2, 2, 12, 28);
    tileGraphics.fillRect(18, 2, 12, 28);
    // Metal bands
    tileGraphics.fillStyle(0x888888, 1);
    tileGraphics.fillRect(1, 6, 30, 2);
    tileGraphics.fillRect(1, 16, 30, 2);
    tileGraphics.fillRect(1, 24, 30, 2);
    // Handle
    tileGraphics.fillStyle(0xccaa44, 1);
    tileGraphics.fillRect(22, 14, 4, 4);
    // Border
    tileGraphics.lineStyle(1, 0x3a2a0a, 1);
    tileGraphics.strokeRect(0, 0, this.tileSize, this.tileSize);
    tileGraphics.generateTexture('tile-door', this.tileSize, this.tileSize);
    tileGraphics.clear();

    // Locked door tile - darker with lock icon
    tileGraphics.fillStyle(0x3a2010, 1);
    tileGraphics.fillRect(0, 0, this.tileSize, this.tileSize);
    tileGraphics.fillStyle(0x4a3020, 1);
    tileGraphics.fillRect(2, 2, 12, 28);
    tileGraphics.fillRect(18, 2, 12, 28);
    tileGraphics.fillStyle(0x666666, 1);
    tileGraphics.fillRect(1, 6, 30, 2);
    tileGraphics.fillRect(1, 16, 30, 2);
    tileGraphics.fillRect(1, 24, 30, 2);
    // Lock icon
    tileGraphics.fillStyle(0xff4444, 1);
    tileGraphics.fillRect(13, 12, 6, 8);
    tileGraphics.fillStyle(0xcc3333, 1);
    tileGraphics.fillRect(14, 9, 4, 4);
    tileGraphics.lineStyle(1, 0x2a1008, 1);
    tileGraphics.strokeRect(0, 0, this.tileSize, this.tileSize);
    tileGraphics.generateTexture('tile-door-locked', this.tileSize, this.tileSize);
    tileGraphics.clear();

    // Crafting bench tile
    tileGraphics.fillStyle(0x5a4020, 1);
    tileGraphics.fillRect(0, 4, this.tileSize, this.tileSize - 4);
    // Table top
    tileGraphics.fillStyle(0x7a5a30, 1);
    tileGraphics.fillRect(0, 0, this.tileSize, 8);
    // Legs
    tileGraphics.fillStyle(0x4a3018, 1);
    tileGraphics.fillRect(2, 8, 4, 22);
    tileGraphics.fillRect(26, 8, 4, 22);
    // Tools on top
    tileGraphics.fillStyle(0xaaaaaa, 1);
    tileGraphics.fillRect(8, 1, 3, 5);
    tileGraphics.fillRect(14, 2, 6, 3);
    tileGraphics.fillStyle(0xccaa44, 1);
    tileGraphics.fillRect(22, 1, 4, 4);
    tileGraphics.generateTexture('tile-crafting-bench', this.tileSize, this.tileSize);
    tileGraphics.destroy();
  }

  createTilemap(dungeon) {
    this.floorGroup = this.add.group();
    this.wallLayer = this.physics.add.staticGroup();

    // Room tile groups: maps roomIndex -> { floors: [], walls: [], wallBodies: [] }
    this.roomTiles = {};
    for (let i = 0; i < dungeon.rooms.length; i++) {
      this.roomTiles[i] = { floors: [], walls: [], wallBodies: [] };
    }

    for (let y = 0; y < dungeon.map.length; y++) {
      for (let x = 0; x < dungeon.map[y].length; x++) {
        const px = x * this.tileSize + this.tileSize / 2;
        const py = y * this.tileSize + this.tileSize / 2;
        const tile = dungeon.map[y][x];
        const owner = dungeon.tileOwner[y][x];

        if (tile === 0 || tile === 2) {
          const floor = this.add.image(px, py, 'dungeon-floor').setDepth(0);
          this.floorGroup.add(floor);

          if (owner >= 0 && this.roomTiles[owner]) {
            this.roomTiles[owner].floors.push(floor);
            if (!this.revealedRooms.has(owner)) {
              floor.setVisible(false);
            }
          }
        }
        if (tile === 1) {
          if (this.isAdjacentToFloor(dungeon.map, x, y)) {
            const wallImg = this.add.image(px, py, 'tile-wall').setDepth(1);
            const wall = this.physics.add.staticImage(px, py, 'tile-wall');
            wall.setVisible(false);
            wall.body.setSize(this.tileSize, this.tileSize);
            this.wallLayer.add(wall);

            // Determine room ownership for wall visibility
            const adjOwner = this.getAdjacentFloorOwner(dungeon, x, y);
            if (adjOwner >= 0 && this.roomTiles[adjOwner]) {
              this.roomTiles[adjOwner].walls.push(wallImg);
              this.roomTiles[adjOwner].wallBodies.push(wall);
              if (!this.revealedRooms.has(adjOwner)) {
                wallImg.setVisible(false);
              }
            }
          }
        }
      }
    }
  }

  getAdjacentFloorOwner(dungeon, x, y) {
    // Return the highest room index of any adjacent floor tile
    let maxOwner = -1;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const ny = y + dy;
        const nx = x + dx;
        if (ny >= 0 && ny < dungeon.map.length && nx >= 0 && nx < dungeon.map[0].length) {
          const tile = dungeon.map[ny][nx];
          if (tile === 0 || tile === 2) {
            const owner = dungeon.tileOwner[ny][nx];
            if (owner > maxOwner) maxOwner = owner;
          }
        }
      }
    }
    return maxOwner;
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

  createDoors(dungeon) {
    for (const conn of dungeon.connections) {
      const doorX = conn.doorPos.x * this.tileSize + this.tileSize / 2;
      const doorY = conn.doorPos.y * this.tileSize + this.tileSize / 2;

      const doorSprite = this.physics.add.staticImage(doorX, doorY, 'tile-door');
      doorSprite.setDepth(5);
      doorSprite.body.setSize(this.tileSize, this.tileSize);
      this.doorGroup.add(doorSprite);

      // Only show doors adjacent to a revealed room
      const fromRevealed = this.revealedRooms.has(conn.fromRoom);
      const toRevealed = this.revealedRooms.has(conn.toRoom);
      if (!fromRevealed && !toRevealed) {
        doorSprite.setVisible(false);
        doorSprite.body.enable = false;
      }

      const door = {
        sprite: doorSprite,
        fromRoom: conn.fromRoom,
        toRoom: conn.toRoom,
        tileX: conn.doorPos.x,
        tileY: conn.doorPos.y,
        state: (fromRevealed || toRevealed) ? 'closed' : 'hidden',
        prompt: null,
      };

      this.doors.push(door);
    }
  }

  createCraftingBench(benchPos) {
    const bx = benchPos.x * this.tileSize + this.tileSize / 2;
    const by = benchPos.y * this.tileSize + this.tileSize / 2;
    this.craftingBench = this.add.image(bx, by, 'tile-crafting-bench').setDepth(2);
    this.craftingBenchPrompt = null;
  }

  createStairs(stairsPos) {
    const sx = stairsPos.x * this.tileSize + this.tileSize / 2;
    const sy = stairsPos.y * this.tileSize + this.tileSize / 2;
    this.stairs = this.add.image(sx, sy, 'tile-stairs').setDepth(1);

    // Determine which room the stairs are in
    const stairsRoom = this.dungeonData.tileOwner[stairsPos.y][stairsPos.x];
    if (stairsRoom >= 0 && !this.revealedRooms.has(stairsRoom)) {
      this.stairs.setVisible(false);
    }

    // Pulsing effect
    this.tweens.add({
      targets: this.stairs,
      alpha: 0.6,
      yoyo: true,
      repeat: -1,
      duration: 800,
    });
  }

  // Reveal a room's tiles, spawn enemies, and set up combat
  revealRoom(roomIndex) {
    if (this.revealedRooms.has(roomIndex)) return;
    this.revealedRooms.add(roomIndex);

    // Show room tiles
    const tiles = this.roomTiles[roomIndex];
    if (tiles) {
      for (const floor of tiles.floors) floor.setVisible(true);
      for (const wall of tiles.walls) wall.setVisible(true);
    }

    // Show stairs if they're in this room
    const stairsRoom = this.dungeonData.tileOwner[this.dungeonData.stairsPos.y][this.dungeonData.stairsPos.x];
    if (stairsRoom === roomIndex && this.stairs) {
      this.stairs.setVisible(true);
    }

    // Make doors connecting this room to unrevealed rooms visible (closed state)
    for (const door of this.doors) {
      if (door.state === 'hidden') {
        if (door.fromRoom === roomIndex || door.toRoom === roomIndex) {
          door.state = 'closed';
          door.sprite.setVisible(true);
          door.sprite.body.enable = true;
        }
      }
    }

    // Redraw minimap to show newly revealed room
    this.redrawMinimap();
  }

  // Spawn enemies in a room and start combat lock
  startRoomCombat(roomIndex) {
    if (this.roomCleared.has(roomIndex)) return;
    if (this.activeCombatRoom === roomIndex) return;

    const spawns = this.dungeonData.enemySpawnsByRoom[roomIndex];
    if (!spawns || spawns.length === 0) {
      // No enemies - mark as cleared immediately
      this.roomCleared.add(roomIndex);
      return;
    }

    this.activeCombatRoom = roomIndex;
    this.roomEnemies[roomIndex] = [];

    // Spawn enemies
    for (const spawn of spawns) {
      const ex = spawn.x * this.tileSize + this.tileSize / 2;
      const ey = spawn.y * this.tileSize + this.tileSize / 2;
      const enemy = new Enemy(this, ex, ey, spawn.type);
      enemy.roomIndex = roomIndex;
      this.enemies.add(enemy);
      this.roomEnemies[roomIndex].push(enemy);
    }

    // Lock ALL doors connected to this room
    this.lockRoomDoors(roomIndex);

    // Show combat start popup
    const room = this.dungeonData.rooms[roomIndex];
    const rx = room.cx * this.tileSize + this.tileSize / 2;
    const ry = room.cy * this.tileSize + this.tileSize / 2;
    this.showPopup(rx, ry - 20, 'Enemies appear!', '#ff6644');
  }

  lockRoomDoors(roomIndex) {
    for (const door of this.doors) {
      if (door.fromRoom === roomIndex || door.toRoom === roomIndex) {
        // Skip hidden doors that connect to completely undiscovered parts
        if (door.state === 'hidden') continue;
        door.state = 'locked';
        door.sprite.setTexture('tile-door-locked');
        door.sprite.setVisible(true);
        door.sprite.body.enable = true;
        // Remove any interaction prompt
        if (door.prompt) {
          door.prompt.destroy();
          door.prompt = null;
        }
      }
    }
  }

  unlockRoomDoors(roomIndex) {
    for (const door of this.doors) {
      if (door.fromRoom === roomIndex || door.toRoom === roomIndex) {
        // If the room on the other side is revealed, open the door fully
        const otherRoom = door.fromRoom === roomIndex ? door.toRoom : door.fromRoom;
        if (this.revealedRooms.has(otherRoom)) {
          door.state = 'open';
          door.sprite.setVisible(false);
          door.sprite.body.enable = false;
        } else {
          // Other room not yet revealed - door becomes interactable
          door.state = 'closed';
          door.sprite.setTexture('tile-door');
          door.sprite.setVisible(true);
          door.sprite.body.enable = true;
        }
      }
    }
  }

  checkRoomCombatCleared() {
    if (this.activeCombatRoom < 0) return;

    const roomEnemies = this.roomEnemies[this.activeCombatRoom];
    if (!roomEnemies) return;

    const allDead = roomEnemies.every(e => !e.active || e.state === 'dead');
    if (allDead) {
      const clearedRoom = this.activeCombatRoom;
      this.roomCleared.add(clearedRoom);
      this.activeCombatRoom = -1;

      // Unlock doors
      this.unlockRoomDoors(clearedRoom);

      // Show cleared popup
      const room = this.dungeonData.rooms[clearedRoom];
      const rx = room.cx * this.tileSize + this.tileSize / 2;
      const ry = room.cy * this.tileSize + this.tileSize / 2;
      this.showPopup(rx, ry - 20, 'Room Cleared!', '#44ff44');
    }
  }

  // Check which room the player is currently in
  getPlayerRoom() {
    const tileX = Math.floor(this.player.x / this.tileSize);
    const tileY = Math.floor(this.player.y / this.tileSize);
    if (tileY >= 0 && tileY < this.dungeonData.tileOwner.length &&
        tileX >= 0 && tileX < this.dungeonData.tileOwner[0].length) {
      return this.dungeonData.tileOwner[tileY][tileX];
    }
    return -1;
  }

  // Check if the player has entered a revealed but uncleared combat room
  checkRoomEntry() {
    const currentRoom = this.getPlayerRoom();
    if (currentRoom <= 0) return; // Room 0 is safe, -1 means corridor/invalid

    // Check if this room is revealed but not yet cleared or in combat
    if (this.revealedRooms.has(currentRoom) &&
        !this.roomCleared.has(currentRoom) &&
        this.activeCombatRoom !== currentRoom) {
      // Check player is actually inside the room bounds (not just in corridor tiles owned by this room)
      const room = this.dungeonData.rooms[currentRoom];
      const tileX = Math.floor(this.player.x / this.tileSize);
      const tileY = Math.floor(this.player.y / this.tileSize);
      if (tileX >= room.x && tileX < room.x + room.w &&
          tileY >= room.y && tileY < room.y + room.h) {
        this.startRoomCombat(currentRoom);
      }
    }
  }

  // Check for door/bench/stairs interactions
  checkInteractions() {
    if (!this.player || !this.player.active) return;
    const justPressedE = Phaser.Input.Keyboard.JustDown(this.interactKey);

    // Check doors
    let nearDoor = false;
    for (const door of this.doors) {
      if (door.state === 'open' || door.state === 'hidden') continue;

      const doorWorldX = door.tileX * this.tileSize + this.tileSize / 2;
      const doorWorldY = door.tileY * this.tileSize + this.tileSize / 2;
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, doorWorldX, doorWorldY
      );

      if (dist < this.tileSize * 1.5) {
        if (door.state === 'closed') {
          // Show prompt
          if (!door.prompt) {
            door.prompt = this.add.text(doorWorldX, doorWorldY - 20, 'Press E to open', {
              fontSize: '10px',
              fill: '#ffffff',
              fontFamily: 'monospace',
              stroke: '#000000',
              strokeThickness: 2,
            }).setOrigin(0.5).setDepth(20);
          }

          if (justPressedE) {
            this.openDoor(door);
            nearDoor = true;
          }
        } else if (door.state === 'locked') {
          if (!door.prompt) {
            door.prompt = this.add.text(doorWorldX, doorWorldY - 20, 'Locked!', {
              fontSize: '10px',
              fill: '#ff4444',
              fontFamily: 'monospace',
              stroke: '#000000',
              strokeThickness: 2,
            }).setOrigin(0.5).setDepth(20);
          }
        }
      } else {
        if (door.prompt) {
          door.prompt.destroy();
          door.prompt = null;
        }
      }
    }

    // Check crafting bench
    if (this.craftingBench) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.craftingBench.x, this.craftingBench.y
      );

      if (dist < this.tileSize * 1.5) {
        if (!this.craftingBenchPrompt) {
          this.craftingBenchPrompt = this.add.text(
            this.craftingBench.x, this.craftingBench.y - 20,
            'Press E to craft (coming soon)',
            {
              fontSize: '10px',
              fill: '#ffdd44',
              fontFamily: 'monospace',
              stroke: '#000000',
              strokeThickness: 2,
            }
          ).setOrigin(0.5).setDepth(20);
        }

        if (justPressedE && !nearDoor) {
          this.showPopup(this.craftingBench.x, this.craftingBench.y - 30,
            'Crafting recipes coming soon!', '#ffdd44');
        }
      } else if (this.craftingBenchPrompt) {
        this.craftingBenchPrompt.destroy();
        this.craftingBenchPrompt = null;
      }
    }

    // Check stairs
    this.checkStairsOverlap(justPressedE);
  }

  openDoor(door) {
    // Determine which room to reveal
    const playerRoom = this.getPlayerRoom();
    let targetRoom;
    if (playerRoom === door.fromRoom || this.revealedRooms.has(door.fromRoom)) {
      targetRoom = door.toRoom;
    } else {
      targetRoom = door.fromRoom;
    }

    // Remove prompt
    if (door.prompt) {
      door.prompt.destroy();
      door.prompt = null;
    }

    // Reveal the target room
    this.revealRoom(targetRoom);

    // Open the door (make passable)
    door.state = 'open';
    door.sprite.setVisible(false);
    door.sprite.body.enable = false;
  }

  createMinimap(dungeon) {
    const mmScale = 3;

    this.minimapGraphics = this.add.graphics();
    this.minimapGraphics.setScrollFactor(0);
    this.minimapGraphics.setDepth(100);

    this.drawMinimap(dungeon, mmScale);
  }

  drawMinimap(dungeon, mmScale) {
    const g = this.minimapGraphics;
    g.clear();

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
        const owner = dungeon.tileOwner[y][x];

        // Only show tiles in revealed rooms
        if (owner >= 0 && !this.revealedRooms.has(owner)) continue;

        if (tile === 0) {
          g.fillStyle(0x666666, 0.8);
          g.fillRect(offsetX + x * mmScale, offsetY + y * mmScale, mmScale, mmScale);
        } else if (tile === 2) {
          g.fillStyle(0xffff00, 1);
          g.fillRect(offsetX + x * mmScale, offsetY + y * mmScale, mmScale, mmScale);
        }
      }
    }

    // Show door positions on minimap
    for (const door of this.doors) {
      if (door.state === 'closed' || door.state === 'locked') {
        const color = door.state === 'locked' ? 0xff4444 : 0xcc8844;
        g.fillStyle(color, 1);
        g.fillRect(offsetX + door.tileX * mmScale, offsetY + door.tileY * mmScale, mmScale, mmScale);
      }
    }

    // Player dot (will be updated)
    if (!this.minimapPlayerDot) {
      this.minimapPlayerDot = this.add.rectangle(0, 0, mmScale + 1, mmScale + 1, 0x00ff00);
      this.minimapPlayerDot.setScrollFactor(0);
      this.minimapPlayerDot.setDepth(101);
    }

    this.mmScale = mmScale;
    this.mmOffsetX = offsetX;
    this.mmOffsetY = offsetY;
  }

  redrawMinimap() {
    this.drawMinimap(this.dungeonData, this.mmScale || 3);
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

    // Check if room combat is cleared
    this.checkRoomCombatCleared();

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

  checkStairsOverlap(justPressedE) {
    if (!this.stairs || !this.player || !this.stairs.visible) return;

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

      if (justPressedE) {
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

  findNearestEnemyInRange() {
    const reach = GAME_CONFIG.PLAYER_ATTACK_REACH;
    let nearest = null;
    let nearestDist = Infinity;
    const enemies = this.enemies.getChildren();
    for (const enemy of enemies) {
      if (!enemy.active || enemy.state === 'dead') continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (dist < reach + 20 && dist < nearestDist) {
        nearest = enemy;
        nearestDist = dist;
      }
    }
    return nearest;
  }

  update(time, delta) {
    if (this.player && this.player.active) {
      this.player.update(time, delta);
      this.checkInteractions();
      this.checkRoomEntry();
      this.updateMinimap();
      this.updateUI();

      // Auto-attack: while in combat mode, attack nearest enemy in range
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
  }
}
