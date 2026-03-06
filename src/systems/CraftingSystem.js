import { ITEM_DATA } from '../data/items.js';

/**
 * Crafting recipes and logic.
 * Each recipe: { id, name, ingredients: [{itemId, qty}], result: {itemId, qty} }
 */
export const RECIPES = [
  {
    id: 'bone-club',
    name: 'Bone Club',
    ingredients: [{ itemId: 'bones', qty: 5 }],
    result: { itemId: 'bone-club', qty: 1 },
  },
  {
    id: 'bone-mail',
    name: 'Bone Mail',
    ingredients: [{ itemId: 'bones', qty: 8 }],
    result: { itemId: 'bone-mail', qty: 1 },
  },
  {
    id: 'widow-fang-dagger',
    name: 'Widow Fang Dagger',
    ingredients: [{ itemId: 'bones', qty: 4 }, { itemId: 'temple-ash', qty: 3 }],
    result: { itemId: 'widow-fang-dagger', qty: 1 },
  },
  {
    id: 'widow-silk-robe',
    name: 'Widow Silk Robe',
    ingredients: [{ itemId: 'bones', qty: 6 }, { itemId: 'temple-ash', qty: 4 }],
    result: { itemId: 'widow-silk-robe', qty: 1 },
  },
  {
    id: 'beetle-shell-sword',
    name: 'Beetle Shell Sword',
    ingredients: [{ itemId: 'polished-beetle-eye', qty: 2 }, { itemId: 'temple-ash', qty: 5 }],
    result: { itemId: 'beetle-shell-sword', qty: 1 },
  },
  {
    id: 'beetle-carapace',
    name: 'Beetle Carapace',
    ingredients: [{ itemId: 'polished-beetle-eye', qty: 3 }, { itemId: 'bones', qty: 5 }],
    result: { itemId: 'beetle-carapace', qty: 1 },
  },
  {
    id: 'health-potion',
    name: 'Health Potion',
    ingredients: [{ itemId: 'temple-ash', qty: 2 }],
    result: { itemId: 'health-potion', qty: 1 },
  },
  {
    id: 'greater-health-potion',
    name: 'Greater Health Potion',
    ingredients: [{ itemId: 'temple-ash', qty: 3 }, { itemId: 'polished-beetle-eye', qty: 1 }],
    result: { itemId: 'greater-health-potion', qty: 1 },
  },
  {
    id: 'strength-potion',
    name: 'Strength Potion',
    ingredients: [{ itemId: 'bones', qty: 3 }, { itemId: 'temple-ash', qty: 2 }],
    result: { itemId: 'strength-potion', qty: 1 },
  },
  {
    id: 'speed-potion',
    name: 'Speed Potion',
    ingredients: [{ itemId: 'temple-ash', qty: 2 }, { itemId: 'polished-beetle-eye', qty: 1 }],
    result: { itemId: 'speed-potion', qty: 1 },
  },
];

export class CraftingSystem {
  /**
   * Get available recipes that the player can currently craft.
   * @param {import('./LootSystem.js').Inventory} inventory
   * @returns {Array<{recipe, canCraft: boolean}>}
   */
  static getAvailableRecipes(inventory) {
    return RECIPES.map(recipe => ({
      recipe,
      canCraft: CraftingSystem.canCraft(recipe, inventory),
    }));
  }

  /** Check if a recipe can be crafted with current inventory */
  static canCraft(recipe, inventory) {
    for (const ing of recipe.ingredients) {
      const have = inventory.items[ing.itemId] || 0;
      if (have < ing.qty) return false;
    }
    return true;
  }

  /**
   * Craft a recipe: consume ingredients and add result to inventory.
   * @returns {boolean} true if crafted successfully
   */
  static craft(recipe, inventory) {
    if (!CraftingSystem.canCraft(recipe, inventory)) return false;

    // Consume ingredients
    for (const ing of recipe.ingredients) {
      inventory.removeItem(ing.itemId, ing.qty);
    }

    // Add result
    inventory.addItem(recipe.result.itemId, recipe.result.qty);
    return true;
  }
}
