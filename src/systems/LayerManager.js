import { visualFlags } from '../config/visualFlags.ts';

/**
 * LayerManager – Phase 2 layered rendering.
 *
 * Provides six depth-sorted display layers and helpers for placing
 * game objects at the correct depth.  Each layer is backed by a
 * Phaser Group so that scenes can iterate / batch-clear per layer.
 *
 * Depth bands (when enableLayers is true):
 *   groundLayer      0
 *   decalLayer       100
 *   propsLowLayer    200
 *   propsSolidLayer  ENTITY_BASE + object.y   (y-sortable)
 *   entityLayer      ENTITY_BASE + entity.y   (y-sorted every frame)
 *   foregroundLayer   10 000
 */

/** Base depth added to Y position for entity / propsSolid y-sorting. */
export const ENTITY_BASE = 300;

/** Fixed depth for foreground overlay objects. */
export const FOREGROUND_DEPTH = 10000;

const LAYER_CONFIG = {
  groundLayer:     { baseDepth: 0,               ySort: false },
  decalLayer:      { baseDepth: 100,             ySort: false },
  propsLowLayer:   { baseDepth: 200,             ySort: false },
  propsSolidLayer: { baseDepth: ENTITY_BASE,     ySort: true  },
  entityLayer:     { baseDepth: ENTITY_BASE,     ySort: true  },
  foregroundLayer: { baseDepth: FOREGROUND_DEPTH, ySort: false },
};

export class LayerManager {
  /**
   * @param {Phaser.Scene} scene – the owning scene
   */
  constructor(scene) {
    this.scene = scene;
    /** @type {Object<string, Phaser.GameObjects.Group>} */
    this.layers = {};

    if (!visualFlags.enableLayers) return;

    for (const name of Object.keys(LAYER_CONFIG)) {
      this.layers[name] = scene.add.group();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Public helpers                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Add a game object to the named layer and set its depth.
   *
   * For y-sortable layers (propsSolidLayer, entityLayer) the depth is
   * set to ENTITY_BASE + gameObject.y so it participates in y-sort.
   * For all other layers the depth is the layer's fixed base value.
   *
   * @param {string} layerName
   * @param {Phaser.GameObjects.GameObject} gameObject
   * @returns {Phaser.GameObjects.GameObject} the same object (for chaining)
   */
  addToLayer(layerName, gameObject) {
    if (!visualFlags.enableLayers) return gameObject;

    const cfg = LAYER_CONFIG[layerName];
    if (!cfg) {
      console.warn(`LayerManager: unknown layer "${layerName}"`);
      return gameObject;
    }

    const group = this.layers[layerName];
    if (group) group.add(gameObject);

    if (cfg.ySort && gameObject.setDepth) {
      gameObject.setDepth(ENTITY_BASE + (gameObject.y || 0));
    } else if (gameObject.setDepth) {
      gameObject.setDepth(cfg.baseDepth);
    }

    return gameObject;
  }

  /**
   * Move / place a game object into the foreground layer
   * (drawn above all entities; no collisions).
   */
  setToForeground(gameObject) {
    return this.addToLayer('foregroundLayer', gameObject);
  }

  /**
   * Move / place a game object into the solid-props layer
   * (collidable band; y-sorts with entities if desired).
   */
  setToSolidProps(gameObject) {
    return this.addToLayer('propsSolidLayer', gameObject);
  }

  /* ------------------------------------------------------------------ */
  /*  Cleanup                                                            */
  /* ------------------------------------------------------------------ */

  /** Clear every layer group (does NOT destroy children – call before
   *  the scene's own destruction code so references are cleaned up). */
  clearAll() {
    if (!visualFlags.enableLayers) return;
    for (const group of Object.values(this.layers)) {
      group.clear(false, false);
    }
  }

  /** Clear a single layer group. */
  clearLayer(layerName) {
    if (!visualFlags.enableLayers) return;
    if (this.layers[layerName]) {
      this.layers[layerName].clear(false, false);
    }
  }

  /** Destroy all groups (scene shutdown). */
  destroy() {
    if (!visualFlags.enableLayers) return;
    for (const group of Object.values(this.layers)) {
      group.destroy(true);
    }
    this.layers = {};
  }
}
