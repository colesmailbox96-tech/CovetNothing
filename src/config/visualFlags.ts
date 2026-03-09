/** Visual-polish feature flags – Phase 1, 2 & 3 */
export const visualFlags = {
  /** Nearest-neighbor filtering + integer camera scroll */
  enablePixelPerfect: true,
  /** Depth = feetY each frame for correct overlap ordering */
  enableYSort: true,
  /** Small ellipse shadow under every entity */
  enableShadows: true,
  /** Phase 2 – layered rendering (ground → decal → props → entity → foreground) */
  enableLayers: true,
  /** Phase 3 – deterministic ground decals (cracks, stains, leaves, etc.) */
  enableDecals: true,
  /** Phase 3 – seeded floor-tile variants to break repetition */
  enableTileVariants: true,
};
