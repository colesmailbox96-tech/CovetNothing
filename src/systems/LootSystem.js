import { ENEMY_DATA } from '../data/enemies.js';
import { ITEM_DATA } from '../data/items.js';

export class LootSystem {
  static rollDrops(enemyType, floor) {
    const data = ENEMY_DATA[enemyType];
    if (!data) return [];

    const drops = [];
    for (const drop of data.drops) {
      if (Math.random() <= drop.chance) {
        const item = ITEM_DATA[drop.itemId];
        if (item) {
          drops.push({
            itemId: drop.itemId,
            name: item.name,
            icon: item.icon,
            quantity: 1,
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
