/**
 * townMapData.js – Tileset atlas generation and Tiled-JSON map builder
 * for the multi-layer town tilemap.
 *
 * Tileset layout: 8 columns × 3 rows = 24 tiles, each 32×32.
 * Map size:       30 × 25 tiles (960 × 800 px).
 * Layers:         ground, water, structures, canopy.
 */

import { SeededRNG } from '../utils/SeededRNG.js';

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

export const TILESET_COLS = 8;
export const TILESET_ROWS = 3;
export const TS = 32;

export const MAP_W = 30;
export const MAP_H = 25;

/** Tile indices (0-based) inside the tileset atlas. */
export const T = {
  GRASS_0:      0,
  GRASS_1:      1,
  GRASS_2:      2,
  GRASS_3:      3,
  PATH:         4,
  PORTAL:       5,
  WALL:         6,   // building wall
  WATER_0:      7,
  WATER_1:      8,
  STONE_BORDER: 9,
  BRIDGE:       10,
  BRIDGE_RAIL:  11,
  FENCE_H:      12,
  FENCE_V:      13,
  FENCE_POST:   14,
  TRUNK:        15,
  LANTERN:      16,
  STATUE:       17,
  CANOPY_G:     18,  // green canopy core
  CANOPY_A:     19,  // autumn canopy core
  CANOPY_GE:    20,  // green canopy edge
  CANOPY_AE:    21,  // autumn canopy edge
  STONE_WALL:   22,  // thick border wall
};

/** Convert a 0-based tile index to a Tiled GID (firstgid = 1). */
function gid(index) { return index + 1; }

/* ================================================================== */
/*  Tileset canvas generation                                          */
/* ================================================================== */

/**
 * Build a 256×96 canvas containing every tile in the town tileset.
 * Grass and path tiles are derived from already-loaded Phaser textures;
 * all other tiles are drawn procedurally.
 *
 * @param {Phaser.Scene} scene – a scene with textures already loaded.
 * @returns {HTMLCanvasElement}
 */
export function generateTownTilesetCanvas(scene) {
  const cols = TILESET_COLS;
  const ts   = TS;

  const canvas = document.createElement('canvas');
  canvas.width  = cols * ts;
  canvas.height = TILESET_ROWS * ts;
  const ctx = canvas.getContext('2d');

  /** Pixel origin for a tile index. */
  function pos(index) {
    return {
      x: (index % cols) * ts,
      y: Math.floor(index / cols) * ts,
    };
  }

  /* ---- base textures loaded in BootScene.preload ---- */
  const grassImg = scene.textures.get('town-grass').getSourceImage();
  const pathImg  = scene.textures.get('town-path').getSourceImage();

  /* ---- Grass variants 0-3 ---- */
  for (let v = 0; v < 4; v++) {
    const p = pos(T.GRASS_0 + v);
    ctx.drawImage(grassImg, p.x, p.y, ts, ts);
    ctx.globalAlpha = 0.06 + v * 0.02;
    ctx.fillStyle = v % 2 === 0 ? '#1a3a0a' : '#2a4a1a';
    const marks = [
      [{ x: 4, y: 8, w: 2, h: 4 }, { x: 20, y: 18, w: 3, h: 3 }],
      [{ x: 12, y: 4, w: 3, h: 3 }, { x: 24, y: 22, w: 2, h: 4 }],
      [{ x: 6, y: 20, w: 4, h: 2 }, { x: 16, y: 6, w: 2, h: 4 }],
      [{ x: 2, y: 12, w: 3, h: 3 }, { x: 22, y: 2, w: 4, h: 2 }],
    ];
    for (const m of marks[v]) ctx.fillRect(p.x + m.x, p.y + m.y, m.w, m.h);
    ctx.globalAlpha = 1;
  }

  /* ---- Cobblestone path ---- */
  { const p = pos(T.PATH); ctx.drawImage(pathImg, p.x, p.y, ts, ts); }

  /* ---- Dungeon portal ---- */
  drawPortal(ctx, pos(T.PORTAL), ts);

  /* ---- Building wall ---- */
  drawBuildingWall(ctx, pos(T.WALL), ts);

  /* ---- Water frames 0 & 1 ---- */
  drawWater(ctx, pos(T.WATER_0), ts, 0);
  drawWater(ctx, pos(T.WATER_1), ts, 1);

  /* ---- Stone border ---- */
  drawStoneBorder(ctx, pos(T.STONE_BORDER), ts);

  /* ---- Bridge plank & rail ---- */
  drawBridgePlank(ctx, pos(T.BRIDGE), ts);
  drawBridgeRail(ctx, pos(T.BRIDGE_RAIL), ts);

  /* ---- Fences ---- */
  drawFenceH(ctx, pos(T.FENCE_H), ts);
  drawFenceV(ctx, pos(T.FENCE_V), ts);
  drawFencePost(ctx, pos(T.FENCE_POST), ts);

  /* ---- Tree trunk ---- */
  drawTrunk(ctx, pos(T.TRUNK), ts);

  /* ---- Lantern post ---- */
  drawLantern(ctx, pos(T.LANTERN), ts);

  /* ---- Statue ---- */
  drawStatue(ctx, pos(T.STATUE), ts);

  /* ---- Canopy tiles (with alpha) ---- */
  drawCanopy(ctx, pos(T.CANOPY_G),  ts, '#2a5e2a', '#3b7e3b', 0.60);
  drawCanopy(ctx, pos(T.CANOPY_A),  ts, '#8b5a1a', '#bb7733', 0.60);
  drawCanopy(ctx, pos(T.CANOPY_GE), ts, '#2a5e2a', '#3b7e3b', 0.38);
  drawCanopy(ctx, pos(T.CANOPY_AE), ts, '#8b5a1a', '#bb7733', 0.38);

  /* ---- Stone wall (border) ---- */
  drawStoneWall(ctx, pos(T.STONE_WALL), ts);

  return canvas;
}

/* ------------------------------------------------------------------ */
/*  Individual tile draw helpers                                       */
/* ------------------------------------------------------------------ */

function drawPortal(ctx, p, ts) {
  const x = p.x, y = p.y;
  ctx.fillStyle = '#1a0a2a'; ctx.fillRect(x, y, ts, ts);
  ctx.fillStyle = '#2a1240'; ctx.fillRect(x + 4, y, ts - 8, ts);
  ctx.globalAlpha = 0.6; ctx.fillStyle = '#3a1a55'; ctx.fillRect(x + 8, y + 4, ts - 16, ts - 8); ctx.globalAlpha = 1;
  ctx.globalAlpha = 0.4; ctx.fillStyle = '#4a2a65'; ctx.fillRect(x + 10, y + 8, ts - 20, ts - 16); ctx.globalAlpha = 1;
  ctx.globalAlpha = 0.8; ctx.fillStyle = '#ff6600'; ctx.fillRect(x + ts / 2 - 4, y + ts / 2 - 4, 8, 8); ctx.globalAlpha = 1;
  ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffaa44'; ctx.fillRect(x + ts / 2 - 2, y + ts / 2 - 2, 4, 4); ctx.globalAlpha = 1;
  ctx.globalAlpha = 0.4; ctx.fillStyle = '#8844aa';
  ctx.fillRect(x + 2, y + 2, 3, 3);
  ctx.fillRect(x + ts - 5, y + 2, 3, 3);
  ctx.fillRect(x + 2, y + ts - 5, 3, 3);
  ctx.fillRect(x + ts - 5, y + ts - 5, 3, 3);
  ctx.globalAlpha = 1;
}

function drawBuildingWall(ctx, p, ts) {
  const x = p.x, y = p.y;
  ctx.fillStyle = '#6b4423'; ctx.fillRect(x, y, ts, ts);
  ctx.strokeStyle = 'rgba(90,54,24,0.7)'; ctx.lineWidth = 1;
  for (const ly of [8, 16, 24]) {
    ctx.beginPath(); ctx.moveTo(x, y + ly); ctx.lineTo(x + ts, y + ly); ctx.stroke();
  }
  ctx.globalAlpha = 0.3; ctx.fillStyle = '#7b5433';
  ctx.fillRect(x + 2, y + 1, 10, 1); ctx.fillRect(x + 18, y + 10, 8, 1);
  ctx.fillRect(x + 5, y + 18, 12, 1); ctx.fillRect(x + 20, y + 26, 6, 1);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(139,98,67,0.4)'; ctx.strokeRect(x + 0.5, y + 0.5, ts - 1, ts - 1);
}

function drawWater(ctx, p, ts, frame) {
  const x = p.x, y = p.y;
  ctx.fillStyle = frame === 0 ? '#2a5577' : '#2e5f85';
  ctx.fillRect(x, y, ts, ts);
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = frame === 0 ? '#3a7099' : '#4488aa';
  const off = frame * 6;
  ctx.fillRect(x + 2 + off, y + 6, 10, 2);
  ctx.fillRect(x + 16 - off, y + 14, 8, 2);
  ctx.fillRect(x + 6 + off, y + 22, 12, 2);
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#88ccee';
  ctx.fillRect(x + 8 - off, y + 10, 6, 1);
  ctx.fillRect(x + 18 + off, y + 20, 4, 1);
  ctx.globalAlpha = 1;
}

function drawStoneBorder(ctx, p, ts) {
  const x = p.x, y = p.y;
  ctx.fillStyle = '#777777'; ctx.fillRect(x, y, ts, ts);
  ctx.fillStyle = '#888888'; ctx.fillRect(x + 1, y + 1, ts - 2, ts - 2);
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#999999'; ctx.fillRect(x + 3, y + 3, 8, 6);
  ctx.fillRect(x + 16, y + 12, 10, 6);
  ctx.fillRect(x + 5, y + 20, 12, 5);
  ctx.globalAlpha = 0.3; ctx.fillStyle = '#666666';
  ctx.fillRect(x + 14, y + 2, 6, 4);
  ctx.fillRect(x + 2, y + 14, 8, 4);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(100,100,100,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, ts - 1, ts - 1);
}

function drawBridgePlank(ctx, p, ts) {
  const x = p.x, y = p.y;
  ctx.fillStyle = '#8b6b3a'; ctx.fillRect(x, y, ts, ts);
  ctx.strokeStyle = 'rgba(110,80,40,0.6)'; ctx.lineWidth = 1;
  for (let i = 0; i < ts; i += 8) {
    ctx.beginPath(); ctx.moveTo(x, y + i); ctx.lineTo(x + ts, y + i); ctx.stroke();
  }
  ctx.globalAlpha = 0.25; ctx.fillStyle = '#a0804a';
  ctx.fillRect(x + 2, y + 2, 6, 2); ctx.fillRect(x + 14, y + 12, 8, 2);
  ctx.fillRect(x + 6, y + 22, 10, 2);
  ctx.globalAlpha = 1;
}

function drawBridgeRail(ctx, p, ts) {
  const x = p.x, y = p.y;
  // Mostly transparent with a vertical wooden rail
  ctx.fillStyle = '#8b6b3a'; ctx.fillRect(x, y, ts, ts);
  ctx.fillStyle = '#6b4b2a'; ctx.fillRect(x + 12, y, 8, ts);
  ctx.fillStyle = '#7b5b3a';
  ctx.fillRect(x + 13, y + 2, 6, 4); ctx.fillRect(x + 13, y + 14, 6, 4); ctx.fillRect(x + 13, y + 26, 6, 4);
  ctx.strokeStyle = 'rgba(90,60,30,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(x + 12.5, y + 0.5, 7, ts - 1);
}

function drawFenceH(ctx, p, ts) {
  const x = p.x, y = p.y;
  // Horizontal fence: two rails
  ctx.fillStyle = '#8b7340'; ctx.fillRect(x, y + 10, ts, 4);
  ctx.fillStyle = '#8b7340'; ctx.fillRect(x, y + 20, ts, 4);
  ctx.fillStyle = '#9b8350'; ctx.fillRect(x, y + 11, ts, 2);
  ctx.fillStyle = '#9b8350'; ctx.fillRect(x, y + 21, ts, 2);
}

function drawFenceV(ctx, p, ts) {
  const x = p.x, y = p.y;
  // Vertical fence: two rails
  ctx.fillStyle = '#8b7340'; ctx.fillRect(x + 10, y, 4, ts);
  ctx.fillStyle = '#8b7340'; ctx.fillRect(x + 20, y, 4, ts);
  ctx.fillStyle = '#9b8350'; ctx.fillRect(x + 11, y, 2, ts);
  ctx.fillStyle = '#9b8350'; ctx.fillRect(x + 21, y, 2, ts);
}

function drawFencePost(ctx, p, ts) {
  const x = p.x, y = p.y;
  ctx.fillStyle = '#7b6330'; ctx.fillRect(x + 12, y + 8, 8, 18);
  ctx.fillStyle = '#8b7340'; ctx.fillRect(x + 13, y + 9, 6, 16);
  ctx.fillStyle = '#9b8350'; ctx.fillRect(x + 10, y + 6, 12, 4);
}

function drawTrunk(ctx, p, ts) {
  const x = p.x, y = p.y;
  ctx.fillStyle = '#5a3a1a'; ctx.fillRect(x + 10, y + 2, 12, 28);
  ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x + 12, y + 4, 8, 24);
  ctx.globalAlpha = 0.3; ctx.fillStyle = '#4a2a0a';
  ctx.fillRect(x + 14, y + 2, 3, 28);
  ctx.globalAlpha = 1;
  // Roots
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(x + 6, y + 26, 6, 4); ctx.fillRect(x + 20, y + 26, 6, 4);
}

function drawLantern(ctx, p, ts) {
  const x = p.x, y = p.y;
  // Post
  ctx.fillStyle = '#555555'; ctx.fillRect(x + 14, y + 10, 4, 20);
  ctx.fillStyle = '#666666'; ctx.fillRect(x + 15, y + 12, 2, 16);
  // Lantern head
  ctx.fillStyle = '#444444'; ctx.fillRect(x + 10, y + 4, 12, 8);
  ctx.fillStyle = '#555555'; ctx.fillRect(x + 11, y + 5, 10, 6);
  // Glow
  ctx.globalAlpha = 0.7; ctx.fillStyle = '#ffcc44';
  ctx.fillRect(x + 12, y + 6, 8, 4);
  ctx.globalAlpha = 0.4; ctx.fillStyle = '#ffeeaa';
  ctx.fillRect(x + 13, y + 7, 6, 2);
  ctx.globalAlpha = 1;
}

function drawStatue(ctx, p, ts) {
  const x = p.x, y = p.y;
  // Pedestal
  ctx.fillStyle = '#888888'; ctx.fillRect(x + 4, y + 20, 24, 10);
  ctx.fillStyle = '#999999'; ctx.fillRect(x + 5, y + 21, 22, 8);
  // Figure
  ctx.fillStyle = '#777777'; ctx.fillRect(x + 10, y + 2, 12, 20);
  ctx.fillStyle = '#888888'; ctx.fillRect(x + 12, y + 4, 8, 16);
  // Head
  ctx.fillStyle = '#999999';
  ctx.beginPath(); ctx.arc(x + 16, y + 4, 5, 0, Math.PI * 2); ctx.fill();
  // Arms
  ctx.fillStyle = '#777777';
  ctx.fillRect(x + 6, y + 8, 6, 3); ctx.fillRect(x + 20, y + 8, 6, 3);
}

function drawCanopy(ctx, p, ts, color1, color2, alpha) {
  const x = p.x, y = p.y;
  ctx.globalAlpha = alpha;
  // Outer canopy shape (blocky pixel-art silhouette)
  ctx.fillStyle = color1;
  ctx.fillRect(x + 4,  y + 4,  24, 24);
  ctx.fillRect(x + 2,  y + 6,  28, 20);
  ctx.fillRect(x + 6,  y + 2,  20, 28);
  // Inner highlight clusters
  ctx.fillStyle = color2;
  ctx.fillRect(x + 6,  y + 6,  8, 6);
  ctx.fillRect(x + 18, y + 10, 8, 6);
  ctx.fillRect(x + 10, y + 18, 10, 6);
  // Leaf detail specks
  ctx.globalAlpha = alpha * 0.5;
  ctx.fillStyle = color2;
  ctx.fillRect(x + 4, y + 6, 3, 2); ctx.fillRect(x + 22, y + 14, 3, 2);
  ctx.fillRect(x + 10, y + 24, 4, 2); ctx.fillRect(x + 20, y + 4, 2, 3);
  ctx.globalAlpha = 1;
}

function drawStoneWall(ctx, p, ts) {
  const x = p.x, y = p.y;
  ctx.fillStyle = '#555555'; ctx.fillRect(x, y, ts, ts);
  ctx.fillStyle = '#666666'; ctx.fillRect(x + 1, y + 1, ts - 2, ts - 2);
  ctx.globalAlpha = 0.5; ctx.fillStyle = '#777777';
  ctx.fillRect(x + 2, y + 2, 12, 6); ctx.fillRect(x + 16, y + 4, 12, 6);
  ctx.fillRect(x + 4, y + 12, 10, 6); ctx.fillRect(x + 18, y + 14, 8, 6);
  ctx.fillRect(x + 2, y + 22, 14, 6); ctx.fillRect(x + 18, y + 24, 10, 5);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(80,80,80,0.6)'; ctx.lineWidth = 1;
  for (const ly of [10, 20]) {
    ctx.beginPath(); ctx.moveTo(x, y + ly); ctx.lineTo(x + ts, y + ly); ctx.stroke();
  }
  ctx.strokeRect(x + 0.5, y + 0.5, ts - 1, ts - 1);
}

/* ================================================================== */
/*  JSON tilemap generation                                            */
/* ================================================================== */

/**
 * Build a Tiled-format JSON object for the town map.
 *
 * @returns {object} Tiled-compatible JSON with 4 tile layers.
 */
export function generateTownMapJSON() {
  const w = MAP_W, h = MAP_H;

  const ground     = new Array(w * h).fill(0);
  const water      = new Array(w * h).fill(0);
  const structures = new Array(w * h).fill(0);
  const canopyArr  = new Array(w * h).fill(0);

  const rng = new SeededRNG(SeededRNG.townSeed() + 42);

  const set  = (arr, x, y, g) => { if (x >= 0 && x < w && y >= 0 && y < h) arr[y * w + x] = g; };
  const setG = (x, y, g) => set(ground, x, y, g);
  const setW = (x, y, g) => set(water, x, y, g);
  const setS = (x, y, g) => set(structures, x, y, g);
  const setC = (x, y, g) => set(canopyArr, x, y, g);

  /* ---------- 1. Ground: grass everywhere + paths ---------- */
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      setG(x, y, gid(T.GRASS_0 + rng.between(0, 3)));
    }
  }

  // Horizontal main path (rows 7-8)
  for (let x = 1; x < w - 1; x++) {
    setG(x, 7, gid(T.PATH));
    setG(x, 8, gid(T.PATH));
  }

  // Vertical path north (cols 14-15, rows 1-7)
  for (let y = 1; y <= 7; y++) { setG(14, y, gid(T.PATH)); setG(15, y, gid(T.PATH)); }

  // Vertical path south (cols 14-15, rows 8-23, skip pond 10-13)
  for (let y = 8; y <= 23; y++) {
    if (y >= 10 && y <= 13) continue; // pond area
    setG(14, y, gid(T.PATH)); setG(15, y, gid(T.PATH));
  }

  // Path under bridge area
  for (let y = 19; y <= 22; y++) { setG(14, y, gid(T.PATH)); setG(15, y, gid(T.PATH)); }

  // Dungeon entrance tiles
  setG(14, 1, gid(T.PORTAL)); setG(15, 1, gid(T.PORTAL));

  /* ---------- 2. Border walls ---------- */
  for (let x = 0; x < w; x++) { setS(x, 0, gid(T.STONE_WALL)); setS(x, h - 1, gid(T.STONE_WALL)); }
  for (let y = 0; y < h; y++) { setS(0, y, gid(T.STONE_WALL)); setS(w - 1, y, gid(T.STONE_WALL)); }

  /* ---------- 3. Buildings ---------- */
  // Shop (cols 3-6, rows 3-5)
  fillRect(setS, 3, 3, 6, 5, gid(T.WALL));
  // Blacksmith (cols 23-26, rows 3-5)
  fillRect(setS, 23, 3, 26, 5, gid(T.WALL));
  // Crafting (cols 3-6, rows 15-17)
  fillRect(setS, 3, 15, 6, 17, gid(T.WALL));

  /* ---------- 4. Pond (oval, center ≈ 14.5, 11.5) ---------- */
  const pcx = 14.5, pcy = 11.5;
  for (let y = 9; y <= 14; y++) {
    for (let x = 11; x <= 18; x++) {
      const dx = (x - pcx) / 4.2;
      const dy = (y - pcy) / 2.8;
      const d2 = dx * dx + dy * dy;
      if (d2 <= 0.55) {
        setW(x, y, gid(T.WATER_0));
      } else if (d2 <= 1.05) {
        setW(x, y, gid(T.STONE_BORDER));
      }
    }
  }

  // Statue island (remove water, place statue)
  setW(14, 11, 0); setW(15, 11, 0);
  setS(14, 11, gid(T.STATUE)); setS(15, 11, gid(T.STATUE));

  /* ---------- 5. River (rows 20-21) ---------- */
  const bridgeCols = new Set([13, 14, 15, 16]);
  for (let x = 1; x < w - 1; x++) {
    if (bridgeCols.has(x)) continue;
    setW(x, 19, gid(T.STONE_BORDER));
    setW(x, 20, gid(T.WATER_0));
    setW(x, 21, gid(T.WATER_0));
    setW(x, 22, gid(T.STONE_BORDER));
  }

  // Bridge (cols 13-16, rows 19-22)
  for (let y = 19; y <= 22; y++) {
    setS(13, y, gid(T.BRIDGE_RAIL));
    setS(14, y, gid(T.BRIDGE));
    setS(15, y, gid(T.BRIDGE));
    setS(16, y, gid(T.BRIDGE_RAIL));
  }

  /* ---------- 6. Fences ---------- */
  // Fence around shop (cols 2-7, rows 2-6)
  fenceBorder(setS, 2, 2, 7, 6);
  // Fence around blacksmith (cols 22-27, rows 2-6)
  fenceBorder(setS, 22, 2, 27, 6);
  // Fence around crafting (cols 2-7, rows 14-18)
  fenceBorder(setS, 2, 14, 7, 18);

  /* ---------- 7. Trees ---------- */
  const greenTrees  = [{ x: 9, y: 5 }, { x: 20, y: 5 }, { x: 4, y: 10 }, { x: 25, y: 10 }, { x: 9, y: 16 }];
  const autumnTrees = [{ x: 21, y: 16 }, { x: 4, y: 23 }, { x: 9, y: 23 }, { x: 25, y: 23 }, { x: 20, y: 13 }];

  for (const t of greenTrees) {
    setS(t.x, t.y, gid(T.TRUNK));
    placeCanopy(setC, t.x, t.y, 'green', w, h);
  }
  for (const t of autumnTrees) {
    setS(t.x, t.y, gid(T.TRUNK));
    placeCanopy(setC, t.x, t.y, 'autumn', w, h);
  }

  /* ---------- 8. Lanterns ---------- */
  for (const l of [
    { x: 12, y: 7 }, { x: 17, y: 7 },
    { x: 14, y: 4 }, { x: 15, y: 4 },
    { x: 14, y: 18 }, { x: 15, y: 18 },
  ]) {
    setS(l.x, l.y, gid(T.LANTERN));
  }

  /* ---------- Build Tiled JSON ---------- */
  return {
    width: w,
    height: h,
    tilewidth: TS,
    tileheight: TS,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    type: 'map',
    version: '1.6',
    tiledversion: '1.9.0',
    infinite: false,
    tilesets: [{
      firstgid: 1,
      name: 'town-tileset',
      tilewidth: TS,
      tileheight: TS,
      tilecount: TILESET_COLS * TILESET_ROWS,
      columns: TILESET_COLS,
      imagewidth: TILESET_COLS * TS,
      imageheight: TILESET_ROWS * TS,
      image: 'town-tileset',
      spacing: 0,
      margin: 0,
      tiles: [{
        id: T.WATER_0,
        animation: [
          { tileid: T.WATER_0, duration: 600 },
          { tileid: T.WATER_1, duration: 600 },
        ],
      }],
    }],
    layers: [
      tilelayer('ground', w, h, ground),
      tilelayer('water', w, h, water),
      tilelayer('structures', w, h, structures),
      tilelayer('canopy', w, h, canopyArr),
    ],
  };
}

/* ================================================================== */
/*  Internal helpers                                                   */
/* ================================================================== */

function tilelayer(name, w, h, data) {
  return { name, type: 'tilelayer', width: w, height: h, data, opacity: 1, visible: true, x: 0, y: 0 };
}

function fillRect(setFn, x1, y1, x2, y2, g) {
  for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) setFn(x, y, g);
}

function fenceBorder(setFn, x1, y1, x2, y2) {
  // Corners
  setFn(x1, y1, gid(T.FENCE_POST)); setFn(x2, y1, gid(T.FENCE_POST));
  setFn(x1, y2, gid(T.FENCE_POST)); setFn(x2, y2, gid(T.FENCE_POST));
  // Top & bottom horizontal rails
  for (let x = x1 + 1; x < x2; x++) { setFn(x, y1, gid(T.FENCE_H)); setFn(x, y2, gid(T.FENCE_H)); }
  // Left & right vertical rails
  for (let y = y1 + 1; y < y2; y++) { setFn(y1 === y ? x1 : x1, y, gid(T.FENCE_V)); setFn(x2, y, gid(T.FENCE_V)); }
  // Fix: left side
  for (let y = y1 + 1; y < y2; y++) { setFn(x1, y, gid(T.FENCE_V)); }
}

function placeCanopy(setC, cx, cy, type, w, h) {
  const coreGid = type === 'green' ? gid(T.CANOPY_G) : gid(T.CANOPY_A);
  const edgeGid = type === 'green' ? gid(T.CANOPY_GE) : gid(T.CANOPY_AE);
  // 3×3 canopy centered 1 tile above trunk
  const oy = cy - 1;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = cx + dx, ty = oy + dy;
      if (tx < 0 || tx >= w || ty < 0 || ty >= h) continue;
      const isEdge = Math.abs(dx) + Math.abs(dy) === 2; // corners only
      setC(tx, ty, isEdge ? edgeGid : coreGid);
    }
  }
}
