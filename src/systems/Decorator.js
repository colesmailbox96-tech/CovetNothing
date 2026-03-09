import { visualFlags } from '../config/visualFlags.ts';
import { SeededRNG } from '../utils/SeededRNG.js';

/**
 * Decorator – deterministic environment-dressing pass.
 *
 * After a room/town map is created, Decorator places cosmetic decals
 * on the ground layer using a seeded RNG so the same seed always
 * produces the same visual result.
 *
 * Rules
 * ─────
 * • Decals are placed only on walkable floor tiles (map value 0).
 * • No decals on walls (1), stairs (2), or door tiles.
 * • No decals within ENTRANCE_BUFFER tiles of any door opening.
 * • No two identical decals within ADJACENCY_RADIUS tiles of each other.
 * • Placement density controlled by DECAL_CHANCE (per-tile probability).
 */

/** Distance (in tiles) from doors where no decals are placed. */
const ENTRANCE_BUFFER = 2;

/** Minimum tile distance before the same decal key can repeat. */
const ADJACENCY_RADIUS = 3;

/** Per-tile probability of receiving a decal. */
const DECAL_CHANCE = 0.12;

/* ------------------------------------------------------------------ */
/*  Decal catalogue (texture key → weight)                            */
/* ------------------------------------------------------------------ */

/** Dungeon decal sprites (generated in BootScene). */
const DUNGEON_DECALS = [
  { key: 'decal-crack',  weight: 3 },
  { key: 'decal-stain',  weight: 2 },
  { key: 'decal-dust',   weight: 3 },
  { key: 'decal-rubble', weight: 1 },
];

/** Town decal sprites (generated in BootScene). */
const TOWN_DECALS = [
  { key: 'decal-leaf',  weight: 3 },
  { key: 'decal-weed',  weight: 2 },
  { key: 'decal-puddle', weight: 1 },
];

/* ------------------------------------------------------------------ */
/*  Tile-variant helpers                                               */
/* ------------------------------------------------------------------ */

/** Number of procedural floor variants generated in BootScene. */
const DUNGEON_FLOOR_VARIANTS = 4;   // dungeon-floor-v0 … v3
const TOWN_GRASS_VARIANTS    = 3;   // town-grass-v0 … v2

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export class Decorator {
  /**
   * Place decals onto a dungeon room.
   *
   * @param {Phaser.Scene} scene
   * @param {object}       roomData   – from DungeonGenerator.generateRoom()
   * @param {object}       layerManager
   * @param {number}       tileSize
   * @param {number}       seed       – deterministic seed for this room
   * @param {number|null}  floorTint  – optional colour tint applied to decals
   * @returns {Phaser.GameObjects.Image[]} created decal images (caller owns cleanup)
   */
  static decorateDungeonRoom(scene, roomData, layerManager, tileSize, seed, floorTint = null) {
    if (!visualFlags.enableDecals) return [];

    const rng = new SeededRNG(seed);
    const doorSet = Decorator._doorTileSet(roomData, ENTRANCE_BUFFER);
    return Decorator._placeDecals(
      scene, rng, roomData.map, roomData.width, roomData.height,
      doorSet, DUNGEON_DECALS, layerManager, tileSize, floorTint,
    );
  }

  /**
   * Place decals onto the town map.
   *
   * @param {Phaser.Scene} scene
   * @param {number[][]}   layout    – 2-D tile array (0=grass, 1=wall, 2=path, 3=entrance)
   * @param {number}       w         – width in tiles
   * @param {number}       h         – height in tiles
   * @param {object}       layerManager
   * @param {number}       tileSize
   * @param {number}       seed
   * @returns {Phaser.GameObjects.Image[]}
   */
  static decorateTown(scene, layout, w, h, layerManager, tileSize, seed) {
    if (!visualFlags.enableDecals) return [];

    const rng = new SeededRNG(seed);
    // In the town the "doors" concept doesn't apply but we exclude
    // wall (1) and entrance (3) tiles; only grass (0) gets decals.
    const blocked = new Set();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (layout[y][x] !== 0) blocked.add(`${x},${y}`);
      }
    }
    // Build a map-compatible 2-D array (0 = placeable, 1 = blocked)
    const map = [];
    for (let y = 0; y < h; y++) {
      map[y] = [];
      for (let x = 0; x < w; x++) {
        map[y][x] = layout[y][x] === 0 ? 0 : 1;
      }
    }

    return Decorator._placeDecals(
      scene, rng, map, w, h,
      blocked, TOWN_DECALS, layerManager, tileSize, null,
    );
  }

  /**
   * Choose a tile-variant texture key for a dungeon floor tile.
   *
   * @param {SeededRNG} rng
   * @returns {string} texture key, e.g. 'dungeon-floor-v2'
   */
  static dungeonFloorVariant(rng) {
    if (!visualFlags.enableTileVariants) return 'dungeon-floor';
    return `dungeon-floor-v${rng.between(0, DUNGEON_FLOOR_VARIANTS - 1)}`;
  }

  /**
   * Choose a tile-variant texture key for a town grass tile.
   *
   * @param {SeededRNG} rng
   * @returns {string} texture key, e.g. 'town-grass-v1'
   */
  static townGrassVariant(rng) {
    if (!visualFlags.enableTileVariants) return 'town-grass';
    return `town-grass-v${rng.between(0, TOWN_GRASS_VARIANTS - 1)}`;
  }

  /* ================================================================ */
  /*  Private helpers                                                  */
  /* ================================================================ */

  /**
   * Build a Set of tile-coordinate strings that are within `buffer`
   * tiles of any door opening.
   */
  static _doorTileSet(roomData, buffer) {
    const set = new Set();
    if (!roomData.doorPositions) return set;
    for (const dir of Object.keys(roomData.doorPositions)) {
      const dp = roomData.doorPositions[dir];
      for (let dy = -buffer; dy <= buffer; dy++) {
        for (let dx = -buffer; dx <= buffer; dx++) {
          set.add(`${dp.tileX + dx},${dp.tileY + dy}`);
        }
      }
    }
    return set;
  }

  /**
   * Core decal-placement loop (shared by dungeon & town).
   */
  static _placeDecals(scene, rng, map, w, h, blockedSet, catalogue, layerManager, tileSize, tint) {
    const placed = [];          // { key, x, y }
    const images = [];

    const totalWeight = catalogue.reduce((s, d) => s + d.weight, 0);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // Only floor tiles
        if (map[y][x] !== 0) continue;
        // Not near entrances / blocked
        if (blockedSet.has(`${x},${y}`)) continue;
        // Random chance
        if (rng.next() > DECAL_CHANCE) continue;

        // Weighted selection
        const key = Decorator._pickDecal(rng, catalogue, totalWeight);

        // Adjacency rule – same key must not repeat within radius R
        const tooClose = placed.some(
          p => p.key === key &&
               Math.abs(p.x - x) <= ADJACENCY_RADIUS &&
               Math.abs(p.y - y) <= ADJACENCY_RADIUS,
        );
        if (tooClose) continue;

        // Stamp decal
        const px = x * tileSize + tileSize / 2;
        const py = y * tileSize + tileSize / 2;
        const img = scene.add.image(px, py, key);
        if (tint !== null && tint !== undefined) img.setTint(tint);
        img.setAlpha(0.55 + rng.next() * 0.35);  // slight variation
        layerManager.addToLayer('decalLayer', img);

        placed.push({ key, x, y });
        images.push(img);
      }
    }

    return images;
  }

  /** Weighted random pick from catalogue. */
  static _pickDecal(rng, catalogue, totalWeight) {
    let roll = rng.next() * totalWeight;
    for (const entry of catalogue) {
      roll -= entry.weight;
      if (roll <= 0) return entry.key;
    }
    return catalogue[catalogue.length - 1].key;
  }
}
