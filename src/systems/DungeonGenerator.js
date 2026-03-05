import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';

// Simple BSP-style dungeon generator
export class DungeonGenerator {
  constructor(width, height) {
    this.width = width || GAME_CONFIG.DUNGEON_WIDTH;
    this.height = height || GAME_CONFIG.DUNGEON_HEIGHT;
    this.map = [];
    this.rooms = [];
    this.corridors = [];
    this.stairsPos = null;
    this.spawnPos = null;
    this.enemySpawns = [];
  }

  generate(floor) {
    // Initialize with walls (1 = wall, 0 = floor, 2 = stairs)
    this.map = [];
    for (let y = 0; y < this.height; y++) {
      this.map[y] = [];
      for (let x = 0; x < this.width; x++) {
        this.map[y][x] = 1;
      }
    }
    this.rooms = [];
    this.corridors = [];
    this.enemySpawns = [];

    const maxRooms = GAME_CONFIG.MAX_ROOMS + Math.floor(floor * 0.5);
    const enemiesPerRoom = GAME_CONFIG.ENEMIES_PER_ROOM + Math.floor(floor * 0.3);

    // Generate rooms
    for (let i = 0; i < maxRooms * 3; i++) {
      if (this.rooms.length >= maxRooms) break;

      const w = Phaser.Math.Between(GAME_CONFIG.MIN_ROOM_SIZE, GAME_CONFIG.MAX_ROOM_SIZE);
      const h = Phaser.Math.Between(GAME_CONFIG.MIN_ROOM_SIZE, GAME_CONFIG.MAX_ROOM_SIZE);
      const x = Phaser.Math.Between(1, this.width - w - 1);
      const y = Phaser.Math.Between(1, this.height - h - 1);

      const newRoom = { x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) };

      // Check overlap
      let overlaps = false;
      for (const room of this.rooms) {
        if (x <= room.x + room.w + 1 && x + w + 1 >= room.x &&
            y <= room.y + room.h + 1 && y + h + 1 >= room.y) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        this.carveRoom(newRoom);
        if (this.rooms.length > 0) {
          const prev = this.rooms[this.rooms.length - 1];
          this.carveCorridor(prev.cx, prev.cy, newRoom.cx, newRoom.cy);
        }
        this.rooms.push(newRoom);
      }
    }

    // Set spawn in first room
    const firstRoom = this.rooms[0];
    this.spawnPos = { x: firstRoom.cx, y: firstRoom.cy };

    // Set stairs in last room
    const lastRoom = this.rooms[this.rooms.length - 1];
    this.stairsPos = { x: lastRoom.cx, y: lastRoom.cy };
    this.map[lastRoom.cy][lastRoom.cx] = 2;

    // Place enemies in rooms (skip first room)
    for (let i = 1; i < this.rooms.length; i++) {
      const room = this.rooms[i];
      const count = Math.min(enemiesPerRoom, Math.floor(room.w * room.h / 8));
      for (let j = 0; j < count; j++) {
        const ex = Phaser.Math.Between(room.x + 1, room.x + room.w - 2);
        const ey = Phaser.Math.Between(room.y + 1, room.y + room.h - 2);
        if (this.map[ey][ex] === 0) {
          const type = Math.random() < 0.5 ? 'weeping-widow' : 'temple-beetle';
          this.enemySpawns.push({ x: ex, y: ey, type });
        }
      }
    }

    return {
      map: this.map,
      rooms: this.rooms,
      spawnPos: this.spawnPos,
      stairsPos: this.stairsPos,
      enemySpawns: this.enemySpawns,
    };
  }

  carveRoom(room) {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        this.map[y][x] = 0;
      }
    }
  }

  carveCorridor(x1, y1, x2, y2) {
    let x = x1;
    let y = y1;

    // Horizontal first, then vertical (or vice versa, randomly)
    if (Math.random() < 0.5) {
      while (x !== x2) {
        this.map[y][x] = 0;
        x += x < x2 ? 1 : -1;
      }
      while (y !== y2) {
        this.map[y][x] = 0;
        y += y < y2 ? 1 : -1;
      }
    } else {
      while (y !== y2) {
        this.map[y][x] = 0;
        y += y < y2 ? 1 : -1;
      }
      while (x !== x2) {
        this.map[y][x] = 0;
        x += x < x2 ? 1 : -1;
      }
    }
    this.map[y2][x2] = 0;
  }
}
