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
