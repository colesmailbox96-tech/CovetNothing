import { GAME_CONFIG } from '../config.js';

/**
 * Defines and manages player abilities.
 * Abilities unlock at specific levels and have cooldowns.
 */

export const ABILITIES = {
  whirlwind: {
    id: 'whirlwind',
    name: 'Whirlwind',
    description: 'Spin attack hitting all nearby enemies',
    icon: '🌀',
    unlockLevel: 3,
    cooldown: 8000,      // ms
    range: 70,           // px radius of AoE
    damageMultiplier: 0.8, // % of player attack
    key: 'ONE',
  },
  war_cry: {
    id: 'war_cry',
    name: 'War Cry',
    description: 'Boost attack and push enemies back',
    icon: '📯',
    unlockLevel: 5,
    cooldown: 15000,
    range: 90,           // knockback radius
    knockbackForce: 250, // px/s
    buffDuration: 10000, // ms
    buffMagnitude: 5,    // +ATK
    key: 'TWO',
  },
};

export class AbilitySystem {
  constructor() {
    /** @type {Map<string, number>} ability id → remaining cooldown ms */
    this.cooldowns = new Map();
  }

  /** Check if an ability is unlocked at the given level */
  isUnlocked(abilityId, playerLevel) {
    const ability = ABILITIES[abilityId];
    return ability && playerLevel >= ability.unlockLevel;
  }

  /** Check if an ability is ready (off cooldown) */
  isReady(abilityId) {
    return (this.cooldowns.get(abilityId) || 0) <= 0;
  }

  /** Get remaining cooldown in seconds */
  getCooldownRemaining(abilityId) {
    return Math.max(0, (this.cooldowns.get(abilityId) || 0) / 1000);
  }

  /** Use an ability — sets its cooldown */
  use(abilityId) {
    const ability = ABILITIES[abilityId];
    if (!ability) return;
    this.cooldowns.set(abilityId, ability.cooldown);
  }

  /** Tick cooldowns */
  update(delta) {
    for (const [id, cd] of this.cooldowns) {
      if (cd > 0) {
        this.cooldowns.set(id, cd - delta);
      }
    }
  }

  /** Reset all cooldowns */
  reset() {
    this.cooldowns.clear();
  }

  /** Get all abilities with their current state for UI */
  getAbilityStates(playerLevel) {
    return Object.values(ABILITIES).map(a => ({
      id: a.id,
      name: a.name,
      icon: a.icon,
      key: a.key,
      unlocked: playerLevel >= a.unlockLevel,
      unlockLevel: a.unlockLevel,
      ready: this.isReady(a.id),
      cooldownSec: this.getCooldownRemaining(a.id),
      cooldownTotal: a.cooldown / 1000,
    }));
  }
}
