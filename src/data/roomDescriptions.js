/**
 * Atmospheric text shown when entering dungeon rooms.
 * Each room type has a pool of descriptions; one is picked at random.
 */
export const ROOM_DESCRIPTIONS = {
  normal: [
    'The air hangs heavy with dust.',
    'Echoes ripple through the dark.',
    'Ancient markings line the walls.',
    'A faint scratching emanates from the shadows.',
    'The stone floor is cracked and uneven.',
    'Faded murals depict a forgotten age.',
    'Something stirs in the darkness ahead.',
    'The walls weep with moisture.',
  ],
  elite: [
    'A malevolent presence fills the room.',
    'The ground trembles beneath your feet.',
    'Dark energy crackles in the air.',
    'The shadows here seem… alive.',
    'An unnatural chill grips your bones.',
    'The walls pulse with a sickly glow.',
  ],
  boss: [
    'A thunderous roar shakes the chamber.',
    'You feel an overwhelming dread.',
    'The very walls tremble with fury.',
    'This is no ordinary foe...',
    'Power radiates from the heart of the room.',
  ],
  treasure: [
    'Something glimmers in the dim light.',
    'The air smells of old gold and secrets.',
    'A chest sits untouched by time.',
    'Fortune favors the bold.',
  ],
  merchant: [
    'A friendly face in an unfriendly place.',
    '"Come, see my wares…" a voice calls.',
    'The scent of herbs and metal fills the air.',
    'A lantern flickers beside a weathered cart.',
  ],
  rest: [
    'A warm glow beckons you closer.',
    'The crackling fire offers respite.',
    'For a moment, the darkness recedes.',
    'A safe haven… for now.',
  ],
};

/** Pick a random description for the given room type */
export function getRandomDescription(roomType) {
  const pool = ROOM_DESCRIPTIONS[roomType] || ROOM_DESCRIPTIONS.normal;
  return pool[Math.floor(Math.random() * pool.length)];
}
