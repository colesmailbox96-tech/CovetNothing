// Game balance constants
export const GAME_CONFIG = {
  TILE_SIZE: 32,
  PLAYER_SPEED: 130,
  ENEMY_SPEED: 60,
  ENEMY_CHASE_SPEED: 90,
  ENEMY_AGGRO_RANGE: 150,
  ENEMY_ATTACK_RANGE: 40,
  ENEMY_ATTACK_COOLDOWN: 1200,

  PLAYER_BASE_HP: 100,
  PLAYER_BASE_ATTACK: 10,
  PLAYER_HP_PER_LEVEL: 12,
  PLAYER_ATTACK_PER_LEVEL: 2,
  PLAYER_ATTACK_COOLDOWN: 600,
  PLAYER_ATTACK_REACH: 50,
  PLAYER_COMBAT_MODE_DURATION: 3000,

  // EXP curve: expForLevel(n) = BASE_EXP * (n ^ EXP_EXPONENT)
  BASE_EXP: 100,
  EXP_EXPONENT: 1.5,

  // Gold/EXP floor scaling: multiply by (1 + floor * SCALE)
  FLOOR_GOLD_SCALE: 0.15,
  FLOOR_EXP_SCALE: 0.1,

  // Dungeon generation (room-graph model)
  ROOM_TILE_W: 24,           // room width in tiles
  ROOM_TILE_H: 14,           // room height in tiles
  MAX_ROOMS: 12,
  BOSS_ROOM_INTERVAL: 5,     // boss room every N rooms on a floor

  // Threat-budget spawning
  THREAT_BUDGET_BASE: 5,
  THREAT_BUDGET_DEPTH_SCALE: 1.8,   // extra budget per floor
  THREAT_BUDGET_ELITE_BONUS: 4,
  THREAT_BUDGET_BOSS_BONUS: 8,
  MAX_ENEMIES_PER_ROOM: 8,
  WAVE_THRESHOLD: 2,                 // spawn next wave when remaining <= this

  // Room types: normal, elite, treasure, merchant, rest, boss
  ROOM_TYPES: ['normal', 'elite', 'treasure', 'merchant', 'rest', 'boss'],

  // Traps
  TRAP_BASE_DAMAGE: 5,
  TRAP_DAMAGE_PER_FLOOR: 2,
  TRAP_COOLDOWN: 3000,           // ms before a trap can re-trigger
  TRAP_BASE_COUNT: 1,            // minimum traps per combat room
  TRAP_COUNT_PER_FLOOR: 0.5,    // extra traps per floor (fractional, floored)

  // Critical hits
  CRIT_CHANCE: 0.15,             // 15% chance per attack
  CRIT_MULTIPLIER: 1.5,          // 1.5× damage on crit

  // Dash / dodge
  DASH_SPEED: 350,               // px/s during dash
  DASH_DURATION: 150,            // ms
  DASH_COOLDOWN: 1500,           // ms

  // Room decorations
  TORCH_COUNT_MIN: 2,
  TORCH_COUNT_MAX: 4,
  DEBRIS_COUNT_MIN: 1,
  DEBRIS_COUNT_MAX: 3,

  // Boss variants
  BOSS_HP_MULTIPLIER: 2.5,
  BOSS_ATTACK_MULTIPLIER: 1.6,
  BOSS_SPRITE_SCALE: 0.6,

  // Breakable pots
  POT_COUNT_MIN: 2,
  POT_COUNT_MAX: 5,
  POT_GOLD_MIN: 1,
  POT_GOLD_MAX: 4,
  POT_ITEM_CHANCE: 0.2,        // 20% chance a pot drops an item

  // Boss special attacks
  BOSS_SLAM_COOLDOWN: 6000,      // ms between ground slams
  BOSS_SLAM_RANGE: 60,           // px AoE radius
  BOSS_SLAM_TRIGGER_RANGE: 1.5,  // multiplier on SLAM_RANGE for activation distance
  BOSS_SLAM_DAMAGE_MULT: 1.2,    // multiplied by base attack
  BOSS_SLAM_WINDUP: 600,         // ms telegraph before damage
  BOSS_CHARGE_COOLDOWN: 8000,    // ms between charges
  BOSS_CHARGE_SPEED: 280,        // px/s
  BOSS_CHARGE_DURATION: 400,     // ms
  BOSS_CHARGE_DAMAGE_MULT: 1.5,
  BOSS_CHARGE_HIT_RADIUS: 45,   // px distance for charge impact
};

export const DIRECTIONS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];

// Map from velocity angle to direction name
export function getDirection(vx, vy) {
  if (vx === 0 && vy === 0) return null;
  const angle = Math.atan2(vy, vx) * (180 / Math.PI);
  // Angle ranges: right=0, down=90, left=180, up=-90
  if (angle >= -22.5 && angle < 22.5) return 'east';
  if (angle >= 22.5 && angle < 67.5) return 'south-east';
  if (angle >= 67.5 && angle < 112.5) return 'south';
  if (angle >= 112.5 && angle < 157.5) return 'south-west';
  if (angle >= 157.5 || angle < -157.5) return 'west';
  if (angle >= -157.5 && angle < -112.5) return 'north-west';
  if (angle >= -112.5 && angle < -67.5) return 'north';
  if (angle >= -67.5 && angle < -22.5) return 'north-east';
  return 'south';
}

// Adaptive camera zoom based on screen width for mobile/tablet/desktop
export function getAdaptiveZoom(screenW) {
  if (screenW < 480) return 1.6;   // phones
  if (screenW < 768) return 1.8;   // tablets
  return 2;                         // desktop
}
