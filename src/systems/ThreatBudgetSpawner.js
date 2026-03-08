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
                    : roomType === 'boss'  ? GAME_CONFIG.THREAT_BUDGET_BOSS_BONUS
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
      const affordable = pool.filter(e => e.threat + spent <= budget);
      if (affordable.length === 0) break;
      const pick = affordable[Math.floor(Math.random() * affordable.length)];
      spawns.push({ type: pick.type });
      spent += pick.threat;
    }

    // Split into waves (1 for small groups, up to 3 for larger)
    const waveCount = spawns.length <= 10 ? 1
                    : spawns.length <= 20 ? randomInt(1, 2)
                    : randomInt(2, 3);

    const waves = Array.from({ length: waveCount }, () => []);
    spawns.forEach((s, i) => waves[i % waveCount].push(s));

    // In boss rooms, mark the strongest enemy in wave 1 as a boss variant
    if (roomType === 'boss' && waves.length > 0 && waves[0].length > 0) {
      // Find the enemy with the highest threat in the first wave
      let bossIdx = 0;
      let maxThreat = 0;
      for (let i = 0; i < waves[0].length; i++) {
        const data = ENEMY_DATA[waves[0][i].type];
        if (data && data.threatValue > maxThreat) {
          maxThreat = data.threatValue;
          bossIdx = i;
        }
      }
      waves[0][bossIdx].isBoss = true;
    }

    return { waves };
  }
}

/** Simple random integer without depending on Phaser at module scope */
function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}
