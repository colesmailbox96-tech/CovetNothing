/**
 * SeededRNG – deterministic pseudo-random number generator.
 *
 * Uses the Mulberry32 algorithm (fast, good distribution, 32-bit state).
 * Given the same seed, the sequence of outputs is always identical.
 */
export class SeededRNG {
  /**
   * @param {number} seed – integer seed value
   */
  constructor(seed) {
    this._state = seed | 0;
  }

  /** Return a float in [0, 1) – deterministic. */
  next() {
    this._state = (this._state + 0x6d2b79f5) | 0;
    let t = Math.imul(this._state ^ (this._state >>> 15), 1 | this._state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Return an integer in [min, max] (inclusive). */
  between(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Create a combined seed from floor number and room id.
   * @param {number} floor
   * @param {number} roomId
   * @returns {number}
   */
  static roomSeed(floor, roomId) {
    return ((floor * 73856093) ^ (roomId * 19349663)) | 0;
  }

  /**
   * Create a seed for town dressing (constant per game session).
   * @param {number} [base=42] – optional base seed
   * @returns {number}
   */
  static townSeed(base = 42) {
    return (base * 2654435761) | 0;
  }
}
