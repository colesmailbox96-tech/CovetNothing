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
   * @param {object}  opts     – { hasStairs: bool, hasCraftingBench: bool, floor: number }
   * @returns {{ map, width, height, doorPositions, spawnPos, stairsPos, craftingBenchPos, obstacles, trapPositions }}
   */
  static generateRoom(roomNode, opts = {}) {
    const w = roomNode.width;
    const h = roomNode.height;

    // Initialize map (all walls)
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

    // --- Optional obstacles (structured pillar formations inside the room) ---
    const obstacles = [];
    if (roomNode.type === 'normal' || roomNode.type === 'elite' || roomNode.type === 'boss') {
      const patterns = DungeonGenerator._pillarPatterns(w, h);
      if (patterns.length > 0) {
        const pattern = patterns[Math.floor(Math.random() * patterns.length)];
        for (const pos of pattern) {
          if (pos.x >= 2 && pos.x < w - 2 && pos.y >= 2 && pos.y < h - 2 && map[pos.y][pos.x] === 0) {
            map[pos.y][pos.x] = 1; // wall obstacle
            obstacles.push({ x: pos.x, y: pos.y });
          }
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

    // --- Trap placement (combat rooms only) ---
    const trapPositions = [];
    if ((roomNode.type === 'normal' || roomNode.type === 'elite' || roomNode.type === 'boss') && opts.floor) {
      const trapCount = Math.floor(
        GAME_CONFIG.TRAP_BASE_COUNT + (opts.floor - 1) * GAME_CONFIG.TRAP_COUNT_PER_FLOOR
      );
      for (let i = 0; i < trapCount; i++) {
        let tx, ty, attempts = 0;
        do {
          tx = Phaser.Math.Between(3, w - 4);
          ty = Phaser.Math.Between(3, h - 4);
          attempts++;
        } while (
          (map[ty][tx] !== 0 ||
           (tx === spawnPos.x && ty === spawnPos.y) ||
           trapPositions.some(tp => tp.x === tx && tp.y === ty)) &&
          attempts < 20
        );
        if (map[ty][tx] === 0) {
          trapPositions.push({ x: tx, y: ty });
        }
      }
    }

    // --- Decoration placement (torches along walls, debris on floor) ---
    const decorations = [];
    const torchCount = Phaser.Math.Between(
      GAME_CONFIG.TORCH_COUNT_MIN, GAME_CONFIG.TORCH_COUNT_MAX
    );
    for (let i = 0; i < torchCount; i++) {
      let dx, dy, attempts = 0;
      do {
        // Pick a floor tile adjacent to a wall (y=1 or y=h-2, or x=1 or x=w-2)
        const side = Phaser.Math.Between(0, 3);
        if (side === 0)      { dx = Phaser.Math.Between(2, w - 3); dy = 1; }
        else if (side === 1) { dx = Phaser.Math.Between(2, w - 3); dy = h - 2; }
        else if (side === 2) { dx = 1;     dy = Phaser.Math.Between(2, h - 3); }
        else                 { dx = w - 2; dy = Phaser.Math.Between(2, h - 3); }
        attempts++;
      } while (
        (map[dy][dx] !== 0 ||
         decorations.some(d => d.x === dx && d.y === dy) ||
         (dx === spawnPos.x && dy === spawnPos.y)) &&
        attempts < 20
      );
      if (map[dy][dx] === 0) {
        decorations.push({ x: dx, y: dy, type: 'torch' });
      }
    }

    const debrisCount = Phaser.Math.Between(
      GAME_CONFIG.DEBRIS_COUNT_MIN, GAME_CONFIG.DEBRIS_COUNT_MAX
    );
    for (let i = 0; i < debrisCount; i++) {
      let dx, dy, attempts = 0;
      do {
        dx = Phaser.Math.Between(3, w - 4);
        dy = Phaser.Math.Between(3, h - 4);
        attempts++;
      } while (
        (map[dy][dx] !== 0 ||
         decorations.some(d => d.x === dx && d.y === dy) ||
         trapPositions.some(tp => tp.x === dx && tp.y === dy) ||
         (dx === spawnPos.x && dy === spawnPos.y)) &&
        attempts < 20
      );
      if (map[dy][dx] === 0) {
        decorations.push({ x: dx, y: dy, type: 'debris' });
      }
    }

    // --- Breakable pot placement (most room types) ---
    const potPositions = [];
    if (roomNode.type !== 'rest') {
      const potCount = Phaser.Math.Between(
        GAME_CONFIG.POT_COUNT_MIN, GAME_CONFIG.POT_COUNT_MAX
      );
      for (let i = 0; i < potCount; i++) {
        let px, py, attempts = 0;
        do {
          px = Phaser.Math.Between(2, w - 3);
          py = Phaser.Math.Between(2, h - 3);
          attempts++;
        } while (
          (map[py][px] !== 0 ||
           (px === spawnPos.x && py === spawnPos.y) ||
           potPositions.some(p => p.x === px && p.y === py) ||
           trapPositions.some(tp => tp.x === px && tp.y === py) ||
           decorations.some(d => d.x === px && d.y === py)) &&
          attempts < 20
        );
        if (map[py][px] === 0) {
          potPositions.push({ x: px, y: py });
        }
      }
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
      trapPositions,
      decorations,
      potPositions,
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

  /** Generate structured pillar formation patterns for tactical combat */
  static _pillarPatterns(w, h) {
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2);
    const patterns = [];

    // Pattern: Four corner pillars (creates open center with cover spots)
    patterns.push([
      { x: cx - 4, y: cy - 3 }, { x: cx + 4, y: cy - 3 },
      { x: cx - 4, y: cy + 3 }, { x: cx + 4, y: cy + 3 },
    ]);

    // Pattern: Cross formation (central obstacle ring)
    patterns.push([
      { x: cx, y: cy - 3 }, { x: cx, y: cy + 3 },
      { x: cx - 4, y: cy }, { x: cx + 4, y: cy },
    ]);

    // Pattern: L-shape barriers (asymmetric cover)
    patterns.push([
      { x: cx - 3, y: cy - 2 }, { x: cx - 3, y: cy - 1 }, { x: cx - 2, y: cy - 2 },
      { x: cx + 3, y: cy + 2 }, { x: cx + 3, y: cy + 1 }, { x: cx + 2, y: cy + 2 },
    ]);

    // Pattern: Central column with flanking pillars
    patterns.push([
      { x: cx, y: cy },
      { x: cx - 5, y: cy - 2 }, { x: cx + 5, y: cy - 2 },
      { x: cx - 5, y: cy + 2 }, { x: cx + 5, y: cy + 2 },
    ]);

    // Pattern: Corridor walls (forces movement along lanes)
    patterns.push([
      { x: cx - 2, y: cy - 3 }, { x: cx - 2, y: cy - 2 }, { x: cx - 2, y: cy - 1 },
      { x: cx + 2, y: cy + 1 }, { x: cx + 2, y: cy + 2 }, { x: cx + 2, y: cy + 3 },
    ]);

    // Pattern: Empty room (no obstacles, ~25% chance)
    patterns.push([]);

    return patterns;
  }
}
