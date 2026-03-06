import { GAME_CONFIG } from '../config.js';
import { ENEMY_DATA } from '../data/enemies.js';

/**
 * Threat-budget enemy spawner.
 * Assigns each enemy a threatValue. Room budget = base + depthScaling + tierBonus.
 * Spawns until sum(threat) >= budget, capped for mobile performance.
 * Optionally splits into 1-3 waves.
 */
export class ThreatBudgetSpawner {
  /**
   * Build a spawn plan for a room.
   * @param {number} floor  – dungeon depth (1-based)
   * @param {string} roomType – 'normal'|'elite'|'treasure'|'merchant'|'rest'|'boss'
   * @returns {{ waves: Array<Array<{type:string}>> }}
   */
  static plan(floor, roomType) {
    // Rooms that don't spawn enemies
    if (roomType === 'rest' || roomType === 'treasure' || roomType === 'merchant') {
      return { waves: [] };
    }

    const base = GAME_CONFIG.THREAT_BUDGET_BASE;
    const depthScaling = Math.floor(floor * GAME_CONFIG.THREAT_BUDGET_DEPTH_SCALE);
    const tierBonus = roomType === 'elite' ? GAME_CONFIG.THREAT_BUDGET_ELITE_BONUS
                    : roomType === 'boss'  ? GAME_CONFIG.THREAT_BUDGET_ELITE_BONUS * 2
                    : 0;

    const budget = base + depthScaling + tierBonus;

    // Pick enemies
    const pool = Object.entries(ENEMY_DATA).map(([key, data]) => ({
      type: key,
      threat: data.threatValue,
    }));
    // Sort ascending by threat so we can fill efficiently
    pool.sort((a, b) => a.threat - b.threat);

    const maxEnemies = GAME_CONFIG.MAX_ENEMIES_PER_ROOM;
    const spawns = [];
    let spent = 0;

    while (spent < budget && spawns.length < maxEnemies) {
      // Pick an affordable enemy
      const affordable = pool.filter(e => e.threat + spent <= budget || spawns.length === 0);
      if (affordable.length === 0) break;
      const pick = affordable[Math.floor(Math.random() * affordable.length)];
      spawns.push({ type: pick.type });
      spent += pick.threat;
    }

    // Split into waves (1 for small groups, up to 3 for larger)
    const waveCount = spawns.length <= 2 ? 1
                    : spawns.length <= 4 ? randomInt(1, 2)
                    : randomInt(2, 3);

    const waves = Array.from({ length: waveCount }, () => []);
    spawns.forEach((s, i) => waves[i % waveCount].push(s));

    return { waves };
  }
}

/** Simple random integer without depending on Phaser at module scope */
function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}
