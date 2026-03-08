/**
 * Floor modifiers add per-floor gameplay variety.
 * One modifier is randomly selected when entering a new floor.
 * Each modifier has a display name, description, color, and gameplay effects.
 */
export const FLOOR_MODIFIERS = [
  {
    id: 'cursed_ground',
    name: 'Cursed Ground',
    description: 'Traps deal 50% more damage.',
    color: '#ff4444',
    icon: '☠',
    effects: { trapDamageMultiplier: 1.5 },
  },
  {
    id: 'frail_enemies',
    name: 'Frail Enemies',
    description: 'Enemies have 25% less HP.',
    color: '#88ccff',
    icon: '💀',
    effects: { enemyHpMultiplier: 0.75 },
  },
  {
    id: 'treasure_trove',
    name: 'Treasure Trove',
    description: 'Enemies drop 50% more gold.',
    color: '#ffdd44',
    icon: '💰',
    effects: { goldMultiplier: 1.5 },
  },
  {
    id: 'swift_foes',
    name: 'Swift Foes',
    description: 'Enemies move 20% faster.',
    color: '#ff8844',
    icon: '⚡',
    effects: { enemySpeedMultiplier: 1.2 },
  },
  {
    id: 'scholars_blessing',
    name: "Scholar's Blessing",
    description: 'Gain 30% more experience.',
    color: '#aa88ff',
    icon: '📖',
    effects: { expMultiplier: 1.3 },
  },
  {
    id: 'fortified',
    name: 'Fortified',
    description: 'Player gains +3 defense on this floor.',
    color: '#44ff88',
    icon: '🛡',
    effects: { bonusDefense: 3 },
  },
  {
    id: 'blood_pact',
    name: 'Blood Pact',
    description: 'Deal 25% more damage, take 15% more.',
    color: '#cc3333',
    icon: '🩸',
    effects: { playerDamageMultiplier: 1.25, damageTakenMultiplier: 1.15 },
  },
  {
    id: 'none',
    name: 'Calm Floor',
    description: 'Nothing unusual stirs here.',
    color: '#aaaaaa',
    icon: '—',
    effects: {},
  },
];

/** Pick a random floor modifier. Floor 1 is always calm. */
export function pickFloorModifier(floor) {
  if (floor <= 1) {
    return FLOOR_MODIFIERS.find(m => m.id === 'none');
  }
  // Weighted random: 'none' has lower weight on deeper floors
  const pool = FLOOR_MODIFIERS.filter(m => m.id !== 'none');
  // 30% chance of no modifier
  if (Math.random() < 0.3) {
    return FLOOR_MODIFIERS.find(m => m.id === 'none');
  }
  return pool[Math.floor(Math.random() * pool.length)];
}
