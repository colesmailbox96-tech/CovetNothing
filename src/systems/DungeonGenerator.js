import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';

/**
 * Generates a self-contained tilemap for a single Room.
 * Each room is a discrete chunk: border walls, floor interior,
 * door openings, optional obstacles.
 *
 * map values: 1 = wall, 0 = floor, 2 = stairs
 */
export class DungeonGenerator {
  /**
   * @param {object}  roomNode – from RoomGraph (id, type, width, height, doors)
   * @param {object}  opts     – { hasStairs: bool, hasCraftingBench: bool }
   * @returns {{ map, width, height, doorPositions, spawnPos, stairsPos, craftingBenchPos, obstacles }}
   */
  static generateRoom(roomNode, opts = {}) {
    const w = roomNode.width;
    const h = roomNode.height;

    // Initialise map (all walls)
    const map = [];
    for (let y = 0; y < h; y++) {
      map[y] = [];
      for (let x = 0; x < w; x++) {
        map[y][x] = 1; // wall
      }
    }

    // Carve interior floor
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        map[y][x] = 0; // floor
      }
    }

    // --- Door openings ---
    const doorPositions = {}; // direction -> { tileX, tileY }
    for (const door of roomNode.doors) {
      const pos = DungeonGenerator._doorTile(door.direction, w, h);
      // Carve the wall tile so it becomes floor
      map[pos.y][pos.x] = 0;
      // Also carve adjacent tile inside so there's a 2-wide passage
      const inner = DungeonGenerator._innerTile(door.direction, pos, w, h);
      if (inner) map[inner.y][inner.x] = 0;
      doorPositions[door.direction] = { tileX: pos.x, tileY: pos.y, edgeId: door.edgeId, targetRoom: door.targetRoom };
    }

    // --- Optional obstacles (small wall pillars inside the room) ---
    const obstacles = [];
    if (roomNode.type === 'normal' || roomNode.type === 'elite' || roomNode.type === 'boss') {
      const count = Phaser.Math.Between(0, 3);
      for (let i = 0; i < count; i++) {
        const ox = Phaser.Math.Between(3, w - 4);
        const oy = Phaser.Math.Between(3, h - 4);
        if (map[oy][ox] === 0) {
          map[oy][ox] = 1; // wall obstacle
          obstacles.push({ x: ox, y: oy });
        }
      }
    }

    // Spawn position: centre of room
    const spawnPos = { x: Math.floor(w / 2), y: Math.floor(h / 2) };

    // Stairs (placed near centre-right if needed)
    let stairsPos = null;
    if (opts.hasStairs) {
      const sx = Math.min(w - 3, Math.floor(w / 2) + 2);
      const sy = Math.floor(h / 2);
      map[sy][sx] = 2;
      stairsPos = { x: sx, y: sy };
    }

    // Crafting bench (placed near centre-left if needed)
    let craftingBenchPos = null;
    if (opts.hasCraftingBench) {
      const bx = Math.max(2, Math.floor(w / 2) - 2);
      const by = Math.max(2, Math.floor(h / 2) - 1);
      craftingBenchPos = { x: bx, y: by };
    }

    return {
      map,
      width: w,
      height: h,
      doorPositions,
      spawnPos,
      stairsPos,
      craftingBenchPos,
      obstacles,
    };
  }

  /** Return the tile on the wall border for a given direction */
  static _doorTile(direction, w, h) {
    switch (direction) {
      case 'north': return { x: Math.floor(w / 2), y: 0 };
      case 'south': return { x: Math.floor(w / 2), y: h - 1 };
      case 'east':  return { x: w - 1, y: Math.floor(h / 2) };
      case 'west':  return { x: 0, y: Math.floor(h / 2) };
      default:      return { x: Math.floor(w / 2), y: 0 };
    }
  }

  /** Return the tile just inside the wall so there's a passable entrance */
  static _innerTile(direction, pos, w, h) {
    switch (direction) {
      case 'north': return { x: pos.x, y: pos.y + 1 };
      case 'south': return { x: pos.x, y: pos.y - 1 };
      case 'east':  return { x: pos.x - 1, y: pos.y };
      case 'west':  return { x: pos.x + 1, y: pos.y };
      default:      return null;
    }
  }
}
