/**
 * Tracks statistics for the current dungeon run.
 * Reset when a new run begins; summarised on death.
 */
export class RunStats {
  constructor() {
    this.reset();
  }

  reset() {
    this.enemiesKilled = 0;
    this.roomsCleared = 0;
    this.goldEarned = 0;
    this.itemsFound = 0;
    this.floorsDescended = 0;
    this.potionsUsed = 0;
    this.damageDealt = 0;
    this.damageTaken = 0;
    this.highestFloor = 1;
  }

  recordKill() {
    this.enemiesKilled++;
  }

  recordRoomCleared() {
    this.roomsCleared++;
  }

  recordGold(amount) {
    this.goldEarned += amount;
  }

  recordItemFound() {
    this.itemsFound++;
  }

  recordFloorDescended(floor) {
    this.floorsDescended++;
    if (floor > this.highestFloor) {
      this.highestFloor = floor;
    }
  }

  recordPotionUsed() {
    this.potionsUsed++;
  }

  recordDamageDealt(amount) {
    this.damageDealt += amount;
  }

  recordDamageTaken(amount) {
    this.damageTaken += amount;
  }

  /** Return a summary object for the death screen */
  getSummary() {
    return {
      enemiesKilled: this.enemiesKilled,
      roomsCleared: this.roomsCleared,
      goldEarned: this.goldEarned,
      itemsFound: this.itemsFound,
      highestFloor: this.highestFloor,
      potionsUsed: this.potionsUsed,
      damageDealt: this.damageDealt,
      damageTaken: this.damageTaken,
    };
  }
}
