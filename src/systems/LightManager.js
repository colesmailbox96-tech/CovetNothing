import Phaser from 'phaser';
import { visualFlags } from '../config/visualFlags.ts';
import { FOREGROUND_DEPTH } from './LayerManager.js';

/**
 * LightManager – Phase 4 mobile-safe 2D lighting.
 *
 * Provides additive light-pool sprites at torch / lamp positions with
 * a subtle flicker (alpha & scale variance).  Optionally renders a
 * vignette overlay on world scenes (never UIScene).
 *
 * All light sprites use Phaser ADD blend mode for cheap, GPU-friendly
 * additive blending that works on all mobile WebGL backends.
 *
 * Usage
 * ─────
 *   const lm = new LightManager(scene);
 *   lm.addLight(x, y);                       // default warm torch
 *   lm.addLight(x, y, { radius: 3, tint: 0xffeedd }); // custom
 *   lm.createVignette();                     // optional ambient
 *   lm.destroy();                            // cleanup
 */

/** Depth for light-pool sprites – just above decal layer but below props. */
const LIGHT_DEPTH = 150;

/** Depth for the vignette – above everything except UI (FOREGROUND_DEPTH). */
const VIGNETTE_DEPTH = FOREGROUND_DEPTH - 1;

export class LightManager {
  /**
   * @param {Phaser.Scene} scene – the owning world scene
   */
  constructor(scene) {
    this.scene = scene;

    /** @type {Phaser.GameObjects.Image[]} */
    this.lights = [];

    /** @type {Phaser.GameObjects.Graphics|null} */
    this.vignette = null;
  }

  /* ------------------------------------------------------------------ */
  /*  Light pool                                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Spawn a soft additive light-pool sprite.
   *
   * @param {number} x – world X
   * @param {number} y – world Y
   * @param {object} [opts]
   * @param {number} [opts.radius=2.5]  – scale multiplier (1 = 64 px)
   * @param {number} [opts.tint=0xffdcaa] – tint colour
   * @param {number} [opts.alpha=0.40]  – base alpha (kept low to avoid blow-out)
   * @returns {Phaser.GameObjects.Image|null}
   */
  addLight(x, y, opts = {}) {
    if (!visualFlags.enableLighting) return null;

    const radius = opts.radius ?? 2.5;
    const tint   = opts.tint   ?? 0xffdcaa;
    const alpha  = opts.alpha  ?? 0.40;

    const img = this.scene.add.image(x, y, 'light-pool');
    img.setBlendMode(Phaser.BlendModes.ADD);
    img.setScale(radius);
    img.setAlpha(alpha);
    img.setTint(tint);
    img.setDepth(LIGHT_DEPTH);

    // Flicker – subtle alpha & scale variance at random intervals
    this._addFlicker(img, alpha, radius);

    this.lights.push(img);
    return img;
  }

  /**
   * Add a flickering tween to a light sprite.
   * Uses two tweens: one for alpha and one for scale, each with
   * randomised duration so the flicker looks organic.
   */
  _addFlicker(img, baseAlpha, baseScale) {
    // Alpha flicker
    this.scene.tweens.add({
      targets: img,
      alpha: { from: baseAlpha * 0.8, to: baseAlpha },
      yoyo: true,
      repeat: -1,
      duration: 500 + Math.random() * 600,
      ease: 'Sine.easeInOut',
    });

    // Scale flicker
    this.scene.tweens.add({
      targets: img,
      scaleX: { from: baseScale * 0.95, to: baseScale * 1.05 },
      scaleY: { from: baseScale * 0.95, to: baseScale * 1.05 },
      yoyo: true,
      repeat: -1,
      duration: 700 + Math.random() * 500,
      ease: 'Sine.easeInOut',
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Vignette                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * Draw a subtle vignette overlay sized to the camera viewport.
   * Applied only to world scenes; never UIScene.
   *
   * @param {object} [opts]
   * @param {number} [opts.alpha=0.35] – maximum corner darkness
   */
  createVignette(opts = {}) {
    if (!visualFlags.enableVignette) return;

    const cam = this.scene.cameras.main;
    const w = cam.width;
    const h = cam.height;
    const maxAlpha = opts.alpha ?? 0.35;

    const gfx = this.scene.add.graphics();
    gfx.setScrollFactor(0);           // fixed to camera viewport
    gfx.setDepth(VIGNETTE_DEPTH);

    // Build a vignette as concentric ellipses from edge → centre
    const steps = 12;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;                      // 0 = outermost ring
      const a = maxAlpha * (1 - t) * (1 - t);   // quadratic fade-in from edge
      const rx = (w / 2) * (1 - t * 0.6);       // shrink to 40 % at centre
      const ry = (h / 2) * (1 - t * 0.6);

      gfx.fillStyle(0x000000, a);
      gfx.fillEllipse(w / 2, h / 2, rx * 2, ry * 2);
    }

    this.vignette = gfx;
  }

  /* ------------------------------------------------------------------ */
  /*  Cleanup                                                            */
  /* ------------------------------------------------------------------ */

  /** Destroy all light-pool sprites (but keep the vignette). */
  clearLights() {
    for (const img of this.lights) {
      if (img && img.active) {
        this.scene.tweens.killTweensOf(img);
        img.destroy();
      }
    }
    this.lights = [];
  }

  /** Destroy all managed light sprites and the vignette. */
  destroy() {
    this.clearLights();

    if (this.vignette) {
      this.vignette.destroy();
      this.vignette = null;
    }
  }
}
