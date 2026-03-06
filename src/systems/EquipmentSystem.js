import { ITEM_DATA } from '../data/items.js';

/**
 * Manages the player's equipped gear (weapon + armor slots).
 * Provides cumulative stat bonuses that integrate with LevelSystem.
 */
export class EquipmentSystem {
  constructor() {
    this.slots = {
      weapon: null,  // itemId or null
      armor: null,
    };
  }

  /** Equip an item into its matching slot. Returns the previously equipped itemId (or null). */
  equip(itemId) {
    const data = ITEM_DATA[itemId];
    if (!data) return null;

    let slot = null;
    if (data.type === 'weapon') slot = 'weapon';
    else if (data.type === 'armor') slot = 'armor';
    if (!slot) return null;

    const prev = this.slots[slot];
    this.slots[slot] = itemId;
    return prev;
  }

  /** Unequip a slot. Returns the itemId that was removed (or null). */
  unequip(slot) {
    const prev = this.slots[slot];
    this.slots[slot] = null;
    return prev;
  }

  /** Get the currently equipped item data for a slot */
  getEquipped(slot) {
    if (!(slot in this.slots)) return null;
    const id = this.slots[slot];
    if (!id) return null;
    return { itemId: id, ...ITEM_DATA[id] };
  }

  /** Total bonus attack from all equipped gear */
  getBonusAttack() {
    let bonus = 0;
    for (const itemId of Object.values(this.slots)) {
      if (!itemId) continue;
      const data = ITEM_DATA[itemId];
      if (data && data.stats && data.stats.attack) {
        bonus += data.stats.attack;
      }
    }
    return bonus;
  }

  /** Total bonus defense from all equipped gear */
  getBonusDefense() {
    let bonus = 0;
    for (const itemId of Object.values(this.slots)) {
      if (!itemId) continue;
      const data = ITEM_DATA[itemId];
      if (data && data.stats && data.stats.defense) {
        bonus += data.stats.defense;
      }
    }
    return bonus;
  }

  /** Total bonus maxHP from all equipped gear */
  getBonusMaxHP() {
    let bonus = 0;
    for (const itemId of Object.values(this.slots)) {
      if (!itemId) continue;
      const data = ITEM_DATA[itemId];
      if (data && data.stats && data.stats.maxHp) {
        bonus += data.stats.maxHp;
      }
    }
    return bonus;
  }
}
