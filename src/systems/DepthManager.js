import { visualFlags } from '../config/visualFlags.ts';

/**
 * DepthManager – sets entity depth = feetY each frame so sprites
 * closer to the bottom of the screen draw on top (standard Y-sort).
 *
 * Also repositions the contact-shadow sprite if one is attached.
 */

/** Update depth + shadow for a single entity. */
export function updateEntityDepth(entity) {
  if (!entity || !entity.active) return;

  if (visualFlags.enableYSort) {
    // With origin (0.5, 1.0) feetY === entity.y
    entity.setDepth(entity.y);
  }

  if (visualFlags.enableShadows && entity._shadow) {
    entity._shadow.setPosition(entity.x, entity.y);
    // Shadow always renders just under its owner
    entity._shadow.setDepth((visualFlags.enableYSort ? entity.y : entity.depth) - 0.5);
    entity._shadow.setVisible(entity.visible);
  }
}

/** Convenience: update an array / Phaser Group of entities. */
export function updateAllDepths(entities) {
  const list = entities.getChildren ? entities.getChildren() : entities;
  for (const e of list) {
    updateEntityDepth(e);
  }
}

/**
 * Round camera scroll to integers – prevents sub-pixel jitter
 * on pixel-art games.
 */
export function snapCameraScroll(camera) {
  if (!visualFlags.enablePixelPerfect) return;
  camera.scrollX = Math.round(camera.scrollX);
  camera.scrollY = Math.round(camera.scrollY);
}
