/** Visual-polish feature flags – Phase 1, 2, 3, 4, 5, 6 & 7 */
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
  /** Phase 4 – additive light pools at torches / lamps (mobile-safe) */
  enableLighting: false,
  /** Phase 4 – subtle vignette overlay (DungeonScene only; disabled for bright outdoor TownScene) */
  enableVignette: false,
  /** TownScene override – no vignette for outdoor daytime area */
  enableVignetteTown: false,
  /** Phase 5 – decorative particle emitters (leaves, pollen, flames) */
  enableParticles: true,
  /** Phase 6 – minimap overlay in top-right corner */
  enableMinimap: true,
  /** Phase 6 – compass arrow pointing toward dungeon entrance */
  enableCompass: true,
  /** Phase 7 – dark overlay with circular gradient light cutouts (DungeonScene only) */
  enableDarkOverlay: true,
  /** TownScene override – no dark overlay for outdoor daytime area */
  enableDarkOverlayTown: false,
  /** Phase 7 – subtle color-grade tint (warm golden / cool blue-grey) */
  enableColorGrade: true,
};
