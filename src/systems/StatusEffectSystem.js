/**
 * Manages active status effects (buffs/debuffs) on the player.
 * Each effect has: id, name, duration (ms remaining), magnitude, and type.
 */
export class StatusEffectSystem {
  constructor() {
    /** @type {Map<string, {id: string, name: string, duration: number, magnitude: number, type: string}>} */
    this.effects = new Map();
  }

  /**
   * Apply a status effect. If already active, refreshes duration.
   * @param {string} id       – unique effect identifier
   * @param {string} name     – display name
   * @param {string} type     – 'buff' or 'debuff'
   * @param {number} duration – total duration in ms
   * @param {number} magnitude – effect strength (interpretation depends on id)
   */
  apply(id, name, type, duration, magnitude) {
    this.effects.set(id, { id, name, type, duration, magnitude });
  }

  /** Remove a specific effect */
  remove(id) {
    this.effects.delete(id);
  }

  /** Clear all effects */
  clear() {
    this.effects.clear();
  }

  /**
   * Tick all effects forward by delta ms. Expired effects are removed.
   * @param {number} delta – ms since last update
   */
  update(delta) {
    for (const [id, effect] of this.effects) {
      effect.duration -= delta;
      if (effect.duration <= 0) {
        this.effects.delete(id);
      }
    }
  }

  /** Check if a specific effect is active */
  has(id) {
    return this.effects.has(id);
  }

  /** Get a specific effect (or null) */
  get(id) {
    return this.effects.get(id) || null;
  }

  /** Get bonus attack from active effects */
  getBonusAttack() {
    let bonus = 0;
    const strength = this.effects.get('strength_boost');
    if (strength) bonus += strength.magnitude;
    return bonus;
  }

  /** Get speed multiplier from active effects (1.0 = normal) */
  getSpeedMultiplier() {
    let multiplier = 1.0;
    const speed = this.effects.get('speed_boost');
    if (speed) multiplier += speed.magnitude;
    return multiplier;
  }

  /** Get all active effects as array for UI display */
  getActiveEffects() {
    return Array.from(this.effects.values()).map(e => ({
      id: e.id,
      name: e.name,
      type: e.type,
      remainingSec: Math.ceil(e.duration / 1000),
    }));
  }
}
