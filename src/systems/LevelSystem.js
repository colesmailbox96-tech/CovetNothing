import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';

export class LevelSystem {
  constructor(equipmentSystem = null, statusEffects = null) {
    this.level = 1;
    this.exp = 0;
    this.gold = 0;
    this.equipmentSystem = equipmentSystem;
    this.statusEffects = statusEffects;
  }

  getExpForNextLevel() {
    return Math.floor(GAME_CONFIG.BASE_EXP * Math.pow(this.level, GAME_CONFIG.EXP_EXPONENT));
  }

  addExp(amount) {
    this.exp += amount;
    let leveledUp = false;
    while (this.exp >= this.getExpForNextLevel()) {
      this.exp -= this.getExpForNextLevel();
      this.level++;
      leveledUp = true;
    }
    return leveledUp;
  }

  addGold(amount) {
    this.gold += amount;
  }

  removeGold(amount) {
    if (this.gold >= amount) {
      this.gold -= amount;
      return true;
    }
    return false;
  }

  getMaxHP() {
    const base = GAME_CONFIG.PLAYER_BASE_HP + (this.level - 1) * GAME_CONFIG.PLAYER_HP_PER_LEVEL;
    return base + (this.equipmentSystem ? this.equipmentSystem.getBonusMaxHP() : 0);
  }

  getAttack() {
    const base = GAME_CONFIG.PLAYER_BASE_ATTACK + (this.level - 1) * GAME_CONFIG.PLAYER_ATTACK_PER_LEVEL;
    const equipBonus = this.equipmentSystem ? this.equipmentSystem.getBonusAttack() : 0;
    const buffBonus = this.statusEffects ? this.statusEffects.getBonusAttack() : 0;
    return base + equipBonus + buffBonus;
  }

  getDefense() {
    const equipBonus = this.equipmentSystem ? this.equipmentSystem.getBonusDefense() : 0;
    const buffBonus = this.statusEffects ? this.statusEffects.getBonusDefense() : 0;
    return equipBonus + buffBonus;
  }

  getScaledGold(baseMin, baseMax, floor) {
    const scale = 1 + floor * GAME_CONFIG.FLOOR_GOLD_SCALE;
    const min = Math.floor(baseMin * scale);
    const max = Math.floor(baseMax * scale);
    return Phaser.Math.Between(min, max);
  }

  getScaledExp(baseExp, floor) {
    const scale = 1 + floor * GAME_CONFIG.FLOOR_EXP_SCALE;
    return Math.floor(baseExp * scale);
  }
}
