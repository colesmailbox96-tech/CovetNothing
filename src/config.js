// Game balance constants
export const GAME_CONFIG = {
  TILE_SIZE: 32,
  PLAYER_SPEED: 160,
  ENEMY_SPEED: 60,
  ENEMY_CHASE_SPEED: 90,
  ENEMY_AGGRO_RANGE: 150,
  ENEMY_ATTACK_RANGE: 40,
  ENEMY_ATTACK_COOLDOWN: 1200,

  PLAYER_BASE_HP: 100,
  PLAYER_BASE_ATTACK: 15,
  PLAYER_HP_PER_LEVEL: 20,
  PLAYER_ATTACK_PER_LEVEL: 3,
  PLAYER_ATTACK_COOLDOWN: 500,
  PLAYER_ATTACK_REACH: 50,
  PLAYER_COMBAT_MODE_DURATION: 3000,

  // EXP curve: expForLevel(n) = BASE_EXP * (n ^ EXP_EXPONENT)
  BASE_EXP: 100,
  EXP_EXPONENT: 1.5,

  // Gold/EXP floor scaling: multiply by (1 + floor * SCALE)
  FLOOR_GOLD_SCALE: 0.15,
  FLOOR_EXP_SCALE: 0.1,

  // Dungeon generation
  DUNGEON_WIDTH: 50,
  DUNGEON_HEIGHT: 50,
  MIN_ROOM_SIZE: 5,
  MAX_ROOM_SIZE: 10,
  MAX_ROOMS: 12,
  ENEMIES_PER_ROOM: 2,
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
