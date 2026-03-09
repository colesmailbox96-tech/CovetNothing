/** Visual-polish feature flags – Phase 1 & 2 */
export const visualFlags = {
  /** Nearest-neighbor filtering + integer camera scroll */
  enablePixelPerfect: true,
  /** Depth = feetY each frame for correct overlap ordering */
  enableYSort: true,
  /** Small ellipse shadow under every entity */
  enableShadows: true,
  /** Phase 2 – layered rendering (ground → decal → props → entity → foreground) */
  enableLayers: true,
};
