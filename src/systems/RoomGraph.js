import { GAME_CONFIG } from '../config.js';

/**
 * Generates a room-graph for a dungeon floor.
 * Rooms are nodes; doors are edges.
 * Room 0 is always the safe/start room.
 * A boss room appears every BOSS_ROOM_INTERVAL rooms.
 */
export class RoomGraph {
  /**
   * @param {number} floor – current dungeon depth (1-based)
   * @returns {{ rooms: Array, edges: Array }}
   */
  static generate(floor) {
    const maxRooms = GAME_CONFIG.MAX_ROOMS + Math.floor(floor * 0.5);
    const bossInterval = GAME_CONFIG.BOSS_ROOM_INTERVAL;

    const rooms = [];
    const edges = [];

    // --- create rooms ---
    for (let i = 0; i < maxRooms; i++) {
      const type = RoomGraph._assignType(i, maxRooms, bossInterval);
      rooms.push({
        id: i,
        type,
        width: GAME_CONFIG.ROOM_TILE_W,
        height: GAME_CONFIG.ROOM_TILE_H,
        doors: [],      // filled later
        cleared: i === 0,
        visited: i === 0,
      });
    }

    // --- build graph edges (tree with a few extra branches) ---
    // Use a simple spanning-tree approach then add optional extra edges
    // so most rooms have 2-3 exits.
    const connected = new Set([0]);
    const availableParents = [0]; // rooms that can still accept new connections

    for (let i = 1; i < rooms.length; i++) {
      // pick a random available parent room that has < 3 edges
      let parentIdx;
      const validParents = availableParents.filter(
        f => rooms[f].doors.length < 3
      );
      if (validParents.length > 0) {
        parentIdx = validParents[Math.floor(Math.random() * validParents.length)];
      } else {
        // fallback: pick any connected room with fewest edges
        parentIdx = [...connected].reduce((a, b) =>
          rooms[a].doors.length <= rooms[b].doors.length ? a : b
        );
      }

      const edgeId = edges.length;
      const edge = { id: edgeId, from: parentIdx, to: i };
      edges.push(edge);

      rooms[parentIdx].doors.push({ edgeId, targetRoom: i });
      rooms[i].doors.push({ edgeId, targetRoom: parentIdx });

      connected.add(i);
      availableParents.push(i);

      // remove parent from available list when full
      if (rooms[parentIdx].doors.length >= 3) {
        const idx = availableParents.indexOf(parentIdx);
        if (idx !== -1) availableParents.splice(idx, 1);
      }
    }

    // Assign spatial door directions (north/south/east/west) per room
    for (const room of rooms) {
      const dirPool = ['north', 'south', 'east', 'west'];
      // Shuffle
      for (let j = dirPool.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [dirPool[j], dirPool[k]] = [dirPool[k], dirPool[j]];
      }
      room.doors.forEach((d, idx) => {
        d.direction = dirPool[idx % dirPool.length];
      });
    }

    return { rooms, edges };
  }

  /** Determine room type based on index within the floor */
  static _assignType(index, totalRooms, bossInterval) {
    if (index === 0) return 'rest'; // safe start room
    if (index === totalRooms - 1) return 'boss'; // last room is boss
    if (index > 0 && index % bossInterval === 0) return 'boss';

    // Sprinkle special types
    const roll = Math.random();
    if (roll < 0.10) return 'elite';
    if (roll < 0.15) return 'treasure';
    if (roll < 0.20) return 'merchant';
    if (roll < 0.25) return 'rest';
    return 'normal';
  }
}
