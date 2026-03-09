import Phaser from 'phaser';
import { visualFlags } from '../config/visualFlags.ts';
import { FOREGROUND_DEPTH } from './LayerManager.js';

/**
 * LightManager – Phase 4 & 7 mobile-safe 2D lighting.
 *
 * Phase 4: Additive light-pool sprites at torch / lamp positions with
 * a subtle flicker (alpha & scale variance).  Optional vignette overlay.
 *
 * Phase 7: Dark overlay (RenderTexture) with circular gradient cutouts
 * for dramatic lighting.  Optional player-following light and color grade.
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
 *   lm.createDarkOverlay({ darkness: 0.55 }); // Phase 7 dark overlay
 *   lm.addOverlayLight(x, y, { radius: 1.5 }); // Phase 7 cutout
 *   lm.setPlayerLight(player, { radius: 2 }); // Phase 7 player light
 *   lm.createColorGrade(0xffd080, 0.08);     // Phase 7 tint
 *   lm.updateOverlay(time);                  // call each frame
 *   lm.destroy();                            // cleanup
 */

/** Depth for light-pool sprites – just above decal layer but below props. */
const LIGHT_DEPTH = 150;

/** Depth for the dark overlay – above game but below vignette/UI. */
const OVERLAY_DEPTH = FOREGROUND_DEPTH - 5;

/** Depth for the color grade – just above dark overlay. */
const COLOR_GRADE_DEPTH = FOREGROUND_DEPTH - 4;

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

    /** @type {Phaser.GameObjects.RenderTexture|null} */
    this.overlayRT = null;

    /** @type {Array<{x:number,y:number,radius:number,flickerPhase:number,flickerSpeed:number,flickerAmount:number}>} */
    this.overlayLights = [];

    /** @type {{player:object,radius:number}|null} */
    this.playerLight = null;

    /** @type {Phaser.GameObjects.Image|null} */
    this._eraseMask = null;

    /** @type {number} darkness alpha for the overlay */
    this.darkness = 0.65;

    /** @type {Phaser.GameObjects.Graphics|null} */
    this.colorGrade = null;
  }

  /* ------------------------------------------------------------------ */
  /*  Light pool (Phase 4)                                               */
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
  /*  Vignette (Phase 4)                                                 */
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
  /*  Dark overlay with gradient cutouts (Phase 7)                       */
  /* ------------------------------------------------------------------ */

  /**
   * Create a dark overlay RenderTexture. Each frame, call updateOverlay()
   * to fill with darkness and erase circular gradient cutouts at light
   * positions.
   *
   * @param {object} [opts]
   * @param {number} [opts.darkness=0.65] – overall darkness (0–1)
   */
  createDarkOverlay(opts = {}) {
    if (!visualFlags.enableDarkOverlay) return;

    const cam = this.scene.cameras.main;
    const w = cam.width;
    const h = cam.height;

    this.darkness = opts.darkness ?? 0.65;
    this.overlayRT = this.scene.add.renderTexture(0, 0, w, h);
    this.overlayRT.setScrollFactor(0);
    this.overlayRT.setDepth(OVERLAY_DEPTH);

    // Hidden sprite used as the erase stamp (scaled per light)
    this._eraseMask = this.scene.add.image(0, 0, 'light-mask');
    this._eraseMask.setVisible(false);
  }

  /**
   * Register a static light source for the dark overlay cutout.
   *
   * @param {number} x – world X
   * @param {number} y – world Y
   * @param {object} [opts]
   * @param {number} [opts.radius=1.5]  – scale of the 256 px mask
   * @param {number} [opts.flickerSpeed]  – sin-wave speed (default random 1.5–2.5)
   * @param {number} [opts.flickerAmount=0.08] – amplitude of flicker (0 = none)
   */
  addOverlayLight(x, y, opts = {}) {
    if (!this.overlayRT) return;

    this.overlayLights.push({
      x,
      y,
      radius: opts.radius ?? 1.5,
      flickerPhase: Math.random() * Math.PI * 2,
      flickerSpeed: opts.flickerSpeed ?? (1.5 + Math.random()),
      flickerAmount: opts.flickerAmount ?? 0.08,
    });
  }

  /**
   * Attach a light that follows the player (used in dungeons).
   *
   * @param {object} player – entity with x, y properties
   * @param {object} [opts]
   * @param {number} [opts.radius=2.0] – scale of the 256 px mask
   */
  setPlayerLight(player, opts = {}) {
    if (!this.overlayRT) return;

    this.playerLight = {
      player,
      radius: opts.radius ?? 2.0,
    };
  }

  /**
   * Create a full-screen color grade overlay (tinted rectangle).
   *
   * @param {number} [tint=0xffd080] – tint colour
   * @param {number} [alpha=0.08]    – overlay opacity
   */
  createColorGrade(tint = 0xffd080, alpha = 0.08) {
    if (!visualFlags.enableColorGrade) return;

    const cam = this.scene.cameras.main;
    const gfx = this.scene.add.graphics();
    gfx.setScrollFactor(0);
    gfx.setDepth(COLOR_GRADE_DEPTH);
    gfx.fillStyle(tint, alpha);
    gfx.fillRect(0, 0, cam.width, cam.height);
    this.colorGrade = gfx;
  }

  /**
   * Refresh the dark overlay – call once per frame from scene.update().
   * Clears the RT, fills with darkness, then erases circular gradient
   * cutouts at every registered overlay-light position and the player.
   *
   * @param {number} time – scene time (ms) for flicker animation
   */
  updateOverlay(time) {
    if (!this.overlayRT || !this._eraseMask) return;

    const cam = this.scene.cameras.main;
    const zoom = cam.zoom;
    const rt = this.overlayRT;

    // Clear & fill with darkness
    rt.clear();
    rt.fill(0x000000, this.darkness);

    // Erase cutouts for static overlay lights
    for (const light of this.overlayLights) {
      const sx = (light.x - cam.scrollX) * zoom;
      const sy = (light.y - cam.scrollY) * zoom;

      // Flicker modulation
      const flicker = 1 + Math.sin(time * 0.001 * light.flickerSpeed + light.flickerPhase) * light.flickerAmount;
      const scale = light.radius * flicker * zoom;

      this._eraseMask.setScale(scale);
      rt.erase(this._eraseMask, sx, sy);
    }

    // Erase cutout for player light
    if (this.playerLight && this.playerLight.player && this.playerLight.player.active !== false) {
      const p = this.playerLight.player;
      const sx = (p.x - cam.scrollX) * zoom;
      const sy = (p.y - cam.scrollY) * zoom;

      this._eraseMask.setScale(this.playerLight.radius * zoom);
      rt.erase(this._eraseMask, sx, sy);
    }
  }

  /** Clear only overlay lights (keep player light, overlay RT, color grade). */
  clearOverlayLights() {
    this.overlayLights = [];
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

    if (this.overlayRT) {
      this.overlayRT.destroy();
      this.overlayRT = null;
    }

    if (this._eraseMask) {
      this._eraseMask.destroy();
      this._eraseMask = null;
    }

    this.overlayLights = [];
    this.playerLight = null;

    if (this.colorGrade) {
      this.colorGrade.destroy();
      this.colorGrade = null;
    }
  }
}
