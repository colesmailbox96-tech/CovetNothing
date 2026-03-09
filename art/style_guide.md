# Covet Nothing – Art & Rendering Style Guide

## Pixel-Perfect Rendering

| Setting | Value | Where |
|---------|-------|-------|
| `pixelArt` | `true` | Phaser game config (`src/main.js`) |
| `antialias` | `false` | `render` section of game config |
| `roundPixels` | `true` | Top-level game config |
| Integer camera scroll | Rounded every frame | `DepthManager.snapCameraScroll()` |

**Feature flag:** `enablePixelPerfect` in `src/config/visualFlags.ts`

> All textures use NEAREST-neighbor filtering (automatic when `pixelArt: true`).
> Camera `scrollX` / `scrollY` are `Math.round()`'d each update to eliminate
> sub-pixel jitter on moving sprites.

---

## Entity Anchoring

Every entity (Player, Enemy) uses **bottom-center** origin:

```
setOrigin(0.5, 1.0)
```

This means:

* `sprite.x` = horizontal center of the sprite.
* `sprite.y` = **feet position** (bottom edge).
* `feetY === sprite.y` — used directly for Y-sort depth.
* Physics body offsets are compensated so collision boxes stay aligned
  after the origin shift.

When placing entities on tile grids, position them at the tile's
**center-bottom** or just use `(tileX + 0.5) * TILE_SIZE` for X and
`(tileY + 1) * TILE_SIZE` for Y.

---

## Y-Sort (Depth Ordering)

Entities are sorted every frame by their Y (feet) position so that
sprites closer to the bottom of the screen render on top.

```
entity.setDepth(entity.y);   // feetY == entity.y with origin (0.5,1.0)
```

Managed by `src/systems/DepthManager.js` → `updateEntityDepth()` /
`updateAllDepths()`.

**Feature flag:** `enableYSort` in `src/config/visualFlags.ts`

---

## Contact Shadows

A small procedural ellipse texture (`entity-shadow`, 24 × 10 px,
black at 35 % opacity) is generated at boot and placed under every
entity.

* Shadow origin: `(0.5, 0.5)` — centered on the entity's feet.
* Shadow depth: `entity.depth − 0.5` — always just below its owner.
* Shadow tracks entity position + visibility each frame via `DepthManager`.

**Feature flag:** `enableShadows` in `src/config/visualFlags.ts`

No external art file is required; the texture is created in
`BootScene.generateShadowTexture()`.

---

## Ground Decals (Phase 3)

Small cosmetic sprites stamped onto the `decalLayer` (depth 100) to
break up repeating floor textures.  Placement is **deterministic** —
the same room seed always produces the same decal layout.

### How it works

1. `Decorator.decorateDungeonRoom()` / `Decorator.decorateTown()` is
   called after the tilemap is built.
2. A `SeededRNG` (Mulberry32) is initialised from a combined
   floor + room-id hash so each room is unique yet reproducible.
3. Each walkable floor tile has a ~12 % chance of receiving a decal.
4. Weighted selection picks from the decal catalogue; an **adjacency
   rule** prevents the same decal key from appearing within 3 tiles.
5. Tiles within 2 tiles of any door opening are excluded.

**Feature flags:** `enableDecals` in `src/config/visualFlags.ts`

### Dungeon decal textures

Generated procedurally in `BootScene.generateDungeonDecalTextures()`:

| Key | Size | Description |
|-----|------|-------------|
| `decal-crack` | 16×16 | Thin floor crack lines |
| `decal-stain` | 16×16 | Dark circular blotch |
| `decal-dust` | 16×16 | Scattered dust specks |
| `decal-rubble` | 16×16 | Small stone fragments |

### Town decal textures

Generated in `BootScene.generateTownDecalTextures()`:

| Key | Size | Description |
|-----|------|-------------|
| `decal-leaf` | 16×16 | Fallen leaf |
| `decal-weed` | 16×16 | Small weed tuft |
| `decal-puddle` | 16×16 | Tiny water puddle |

### Adding new decals

1. Create a 16×16 procedural texture in `BootScene` (or place a PNG
   in `public/assets/tiles/decals/` and preload it).
2. Pick a key following the pattern `decal-<name>`.
3. Add an entry to the relevant catalogue array in
   `src/systems/Decorator.js` (`DUNGEON_DECALS` or `TOWN_DECALS`):
   ```js
   { key: 'decal-myname', weight: 2 },
   ```
   Higher weight = more frequent.

---

## Tile Variants (Phase 3)

Base floor textures ship a set of subtle variants so that adjacent
tiles are not pixel-identical.  Variant selection is seeded per-room
for determinism.

### Dungeon floor variants

`BootScene.generateDungeonFloorVariants()` creates four canvas textures
from the base `dungeon-floor` asset:

```
dungeon-floor-v0  dungeon-floor-v1  dungeon-floor-v2  dungeon-floor-v3
```

Each variant overlays small, barely-visible marks at different
positions.  `Decorator.dungeonFloorVariant(rng)` returns a random key.

### Town grass variants

`BootScene.generateTownGrassVariants()` creates three variants:

```
town-grass-v0  town-grass-v1  town-grass-v2
```

Selected via `Decorator.townGrassVariant(rng)`.

### Adding new variants

1. Increase the variant count constant in `Decorator.js`
   (`DUNGEON_FLOOR_VARIANTS` / `TOWN_GRASS_VARIANTS`).
2. Add a matching generation loop entry in the corresponding
   `BootScene.generate*Variants()` method.
3. Each variant should differ only subtly (opacity ≤ 10 %) to stay
   readable at 2× zoom on mobile.

**Feature flag:** `enableTileVariants` in `src/config/visualFlags.ts`

---

## 2D Lighting (Phase 4)

Cheap additive light pools placed at torches, campfires, and town
lamp positions to add depth without heavy shaders.  Mobile-safe —
uses Phaser `ADD` blend mode which maps directly to WebGL additive
compositing.

### How it works

1. `BootScene.generateLightPoolTexture()` creates a 64×64 canvas with a
   soft radial gradient (warm centre → transparent edge).
2. `LightManager` (`src/systems/LightManager.js`) spawns Image sprites
   using the `light-pool` texture with `BlendMode.ADD`.
3. Each light receives two looping tweens (alpha flicker + scale flicker)
   with randomised durations so adjacent lights look organic.
4. An optional vignette overlay (`Graphics` object, scroll-factor 0) adds
   subtle corner darkening to world scenes.  Never applied to `UIScene`.

**Feature flags:**

| Flag | Effect |
|------|--------|
| `enableLighting` | Additive light-pool sprites at torches / lamps |
| `enableVignette` | Subtle edge-darkening overlay on world scenes |

### Recommended light sizes

| Context | `radius` | `alpha` | `tint` | Notes |
|---------|----------|---------|--------|-------|
| Wall torch | 2.5 | 0.40 | `0xffdcaa` | Default warm glow |
| Campfire | 3.5 | 0.50 | `0xffcc88` | Larger, slightly warmer |
| Town NPC lamp | 2.5 | 0.30–0.35 | `0xffdd99` | Softer, subtle |
| Dungeon entrance | 2.0 | 0.30 | `0xccbbff` | Cool purple tint |

> **Rule of thumb:** keep `alpha ≤ 0.5` and `radius ≤ 4` to avoid
> blowing out colours on bright floor tiles.

### Placement rules

* Place lights at every **torch** decoration (auto-handled by
  `DungeonScene._createDecorations()`).
* Place a light at every **campfire** in rest rooms.
* In town, place lights near building entrances and the dungeon entrance.
* Lights are cleaned up on room transition in
  `DungeonScene._destroyRoomObjects()`.
* The vignette is created once in `create()` and persists across rooms
  (it uses `scrollFactor(0)` so it is camera-fixed).

### Adding a new light source

```js
// Inside any world scene that has a LightManager
this.lightManager.addLight(worldX, worldY, {
  radius: 2.5,      // scale multiplier (1 = 64 px)
  alpha: 0.4,       // base alpha (clamped low to stay subtle)
  tint: 0xffdcaa,    // hex colour
});
```

---

## Seeded RNG Utility

`src/utils/SeededRNG.js` provides a Mulberry32-based PRNG:

```js
import { SeededRNG } from '../utils/SeededRNG.js';

const rng = new SeededRNG(12345);
rng.next();          // float [0, 1)
rng.between(1, 10);  // integer [1, 10]

SeededRNG.roomSeed(floor, roomId);  // combined hash for dungeon rooms
SeededRNG.townSeed();                // constant seed for town dressing
```
