export const ENEMY_DATA = {
  'weeping-widow': {
    name: 'Weeping Widow',
    hp: 40,
    attack: 8,
    speed: 48,
    chaseSpeed: 72,
    aggroRange: 150,
    attackRange: 40,
    attackCooldown: 1500,
    spriteSize: 112,
    gold: { min: 5, max: 10 },
    exp: 20,
    drops: [
      { itemId: 'bones', chance: 1.0 },
    ],
    animations: {
      idle: { frames: 4, prefix: 'weeping-widow-idle' },
      walk: { frames: 6, prefix: 'weeping-widow-walk' },
      attack: { frames: 4, prefix: 'weeping-widow-attack' },
    },
  },
  'temple-beetle': {
    name: 'Temple Beetle',
    hp: 25,
    attack: 5,
    speed: 50,
    chaseSpeed: 80,
    aggroRange: 120,
    attackRange: 35,
    attackCooldown: 1200,
    spriteSize: 80,
    gold: { min: 1, max: 5 },
    exp: 10,
    drops: [
      { itemId: 'temple-ash', chance: 0.5 },
      { itemId: 'polished-beetle-eye', chance: 0.2 },
    ],
    animations: {
      walk: { frames: 4, prefix: 'temple-beetle-walk' },
      attack: { frames: 4, prefix: 'temple-beetle-attack' },
    },
  },
};
