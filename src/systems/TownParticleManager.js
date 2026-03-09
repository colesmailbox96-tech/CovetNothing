import Phaser from 'phaser';
import { visualFlags } from '../config/visualFlags.ts';
import { FOREGROUND_DEPTH, ENTITY_BASE } from './LayerManager.js';

/**
 * TownParticleManager – Phase 5 decorative particle emitters for TownScene.
 *
 * Three emitter types:
 *   1. Falling leaves  – small colored squares drifting with random wind
 *   2. Floating pollen  – faint dots rising near water (pond / river)
 *   3. Torch flames     – flickering particles on lantern posts
 */
export class TownParticleManager {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    this.scene = scene;
    /** @type {Phaser.GameObjects.Particles.ParticleEmitter[]} */
    this.emitters = [];
  }

  /* ------------------------------------------------------------------ */
  /*  Falling leaves (map-wide)                                          */
  /* ------------------------------------------------------------------ */

  /**
   * @param {number} mapWidth   pixel width of the map
   * @param {number} mapHeight  pixel height of the map
   */
  createFallingLeaves(mapWidth, mapHeight) {
    if (!visualFlags.enableParticles) return;

    const emitter = this.scene.add.particles(0, 0, 'particle-square', {
      x: { min: 0, max: mapWidth },
      y: -10,
      lifespan: { min: 5000, max: 9000 },
      speedX: { min: -15, max: 25 },      // slow drift + random wind
      speedY: { min: 8, max: 22 },
      scale: { start: 0.8, end: 0.3 },
      alpha: { start: 0.6, end: 0 },
      tint: [0x44aa44, 0x88cc44, 0xcc8833, 0xaa6622, 0xddaa33],
      rotate: { min: 0, max: 360 },
      frequency: 900,
      quantity: 1,
    });
    // Above entities but below canopy (9900) and UI
    emitter.setDepth(FOREGROUND_DEPTH - 200);
    this.emitters.push(emitter);
    return emitter;
  }

  /* ------------------------------------------------------------------ */
  /*  Floating pollen / fireflies near water                             */
  /* ------------------------------------------------------------------ */

  /**
   * @param {{ x: number, y: number }[]} positions  world-pixel centers
   */
  createWaterPollen(positions) {
    if (!visualFlags.enableParticles) return;

    for (const pos of positions) {
      const emitter = this.scene.add.particles(pos.x, pos.y, 'particle-dot', {
        x: { min: -24, max: 24 },
        y: { min: -16, max: 16 },
        lifespan: { min: 2500, max: 5000 },
        speedX: { min: -6, max: 6 },
        speedY: { min: -10, max: -2 },
        scale: { start: 0.5, end: 0.1 },
        // Bell-curve alpha for gentle pulse: fade in → glow → fade out
        alpha: [0, 0.15, 0.35, 0.5, 0.35, 0.15, 0],
        tint: [0xffffcc, 0xeeff88, 0xaaddff],
        frequency: 1200,
        quantity: 1,
      });
      emitter.setDepth(ENTITY_BASE + pos.y + 1);
      this.emitters.push(emitter);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Torch flame flicker on lanterns                                    */
  /* ------------------------------------------------------------------ */

  /**
   * @param {{ x: number, y: number }[]} positions  world-pixel centers at lantern head
   */
  createTorchFlames(positions) {
    if (!visualFlags.enableParticles) return;

    for (const pos of positions) {
      const emitter = this.scene.add.particles(pos.x, pos.y, 'particle-flame', {
        x: { min: -2, max: 2 },
        lifespan: { min: 150, max: 400 },
        speedX: { min: -4, max: 4 },
        speedY: { min: -14, max: -4 },
        scale: { start: 0.7, end: 0.15 },
        alpha: { start: 0.8, end: 0 },
        tint: [0xffcc44, 0xff8800, 0xffee66],
        frequency: 60,
        quantity: 1,
        blendMode: Phaser.BlendModes.ADD,
      });
      emitter.setDepth(ENTITY_BASE + pos.y);
      this.emitters.push(emitter);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Cleanup                                                            */
  /* ------------------------------------------------------------------ */

  destroy() {
    for (const e of this.emitters) {
      e.destroy();
    }
    this.emitters = [];
  }
}
