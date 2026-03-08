import { ENEMY_DATA } from '../data/enemies.js';
import { ITEM_DATA } from '../data/items.js';

export class LootSystem {
  /** Generate loot for a treasure chest based on floor level */
  static rollTreasureChest(floor) {
    const loot = [];
    const goldAmount = 15 + Math.floor(floor * 8);
    loot.push({ type: 'gold', amount: goldAmount });

    if (Math.random() < 0.6) {
      loot.push({ type: 'item', itemId: floor >= 3 ? 'greater-health-potion' : 'health-potion', quantity: 1 });
    }

    if (Math.random() < 0.4) {
      const materials = ['bones', 'temple-ash', 'polished-beetle-eye'];
      const mat = materials[Math.floor(Math.random() * materials.length)];
      const qty = 1 + Math.floor(Math.random() * 3);
      loot.push({ type: 'item', itemId: mat, quantity: qty });
    }

    return loot;
  }

  static rollDrops(enemyType, floor) {
    const data = ENEMY_DATA[enemyType];
    if (!data) return [];

    const drops = [];
    for (const drop of data.drops) {
      // Support variable chance range (chanceMin/chanceMax) or fixed chance
      const chance = (drop.chanceMin != null && drop.chanceMax != null)
        ? drop.chanceMin + Math.random() * (drop.chanceMax - drop.chanceMin)
        : drop.chance;

      if (Math.random() <= chance) {
        const item = ITEM_DATA[drop.itemId];
        if (item) {
          // Support weighted quantity distribution or default to 1
          let quantity = 1;
          if (drop.quantityWeights) {
            const totalWeight = drop.quantityWeights.reduce((s, w) => s + w.weight, 0);
            let roll = Math.random() * totalWeight;
            for (const entry of drop.quantityWeights) {
              roll -= entry.weight;
              if (roll <= 0) {
                quantity = entry.qty;
                break;
              }
            }
          }

          drops.push({
            itemId: drop.itemId,
            name: item.name,
            icon: item.icon,
            quantity,
          });
        }
      }
    }
    return drops;
  }
}

export class Inventory {
  constructor() {
    this.items = {}; // { itemId: quantity }
  }

  addItem(itemId, quantity = 1) {
    if (!this.items[itemId]) {
      this.items[itemId] = 0;
    }
    this.items[itemId] += quantity;
  }

  removeItem(itemId, quantity = 1) {
    if (this.items[itemId] && this.items[itemId] >= quantity) {
      this.items[itemId] -= quantity;
      if (this.items[itemId] <= 0) {
        delete this.items[itemId];
      }
      return true;
    }
    return false;
  }

  getItems() {
    return Object.entries(this.items).map(([id, qty]) => {
      const data = ITEM_DATA[id];
      return {
        itemId: id,
        name: data ? data.name : id,
        quantity: qty,
        sellPrice: data ? data.sellPrice : 0,
        icon: data ? data.icon : null,
      };
    });
  }

  getTotalSellValue() {
    return this.getItems().reduce((sum, item) => sum + item.sellPrice * item.quantity, 0);
  }
}
