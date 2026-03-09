import Phaser from 'phaser';
import { ENEMY_DATA } from '../data/enemies.js';
import { GAME_CONFIG, getDirection } from '../config.js';
import { visualFlags } from '../config/visualFlags.ts';
import { ENTITY_BASE, FOREGROUND_DEPTH } from '../systems/LayerManager.js';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, enemyType, opts = {}) {
    const data = ENEMY_DATA[enemyType];
    const idleKey = `${enemyType}-idle-south-0`;
    super(scene, x, y, idleKey);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.enemyType = enemyType;
    this.data_ = data;
    this.facing = 'south';
    this.state = 'patrol'; // patrol, chase, attack, kite, dead
    this.attackCooldown = 0;
    this.patrolTimer = 0;
    this.patrolDir = { x: 0, y: 0 };
    this.isAttacking = false;
    this.hpBar = null;

    // Boss variant: boosted stats + visual indicator
    this.isBoss = !!opts.isBoss;
    const hpMult = this.isBoss ? GAME_CONFIG.BOSS_HP_MULTIPLIER : 1;
    const atkMult = this.isBoss ? GAME_CONFIG.BOSS_ATTACK_MULTIPLIER : 1;

    // Floor modifier effects
    const floorMod = opts.floorModifier;
    const modHpMult = (floorMod && floorMod.effects.enemyHpMultiplier) || 1;
    const modSpeedMult = (floorMod && floorMod.effects.enemySpeedMultiplier) || 1;

    this.hp = Math.floor(data.hp * hpMult * modHpMult);
    this.maxHp = this.hp;
    this.bossAttack = Math.floor(data.attack * atkMult);
    this.speedMultiplier = modSpeedMult;

    // Physics setup
    const spriteScale = this.isBoss ? GAME_CONFIG.BOSS_SPRITE_SCALE : 0.45;
    this.setScale(spriteScale);

    // Anchor at bottom-center so sprite.y == feetY
    this.setOrigin(0.5, 1.0);
    const bodySize = data.spriteSize * 0.35;
    const bodyOffset = (data.spriteSize - bodySize) / 2;
    this.body.setSize(bodySize, bodySize);
    // Compensate body offset for origin shift (0.5→1.0 on Y)
    const frameH = this.frame ? this.frame.height : data.spriteSize;
    this.body.setOffset(bodyOffset, bodyOffset + 10 + frameH * 0.5);
    this.setDepth(ENTITY_BASE + y);

    // Contact shadow
    if (visualFlags.enableShadows && scene.textures.exists('entity-shadow')) {
      this._shadow = scene.add.image(x, y, 'entity-shadow').setOrigin(0.5, 0.5);
      this._shadow.setDepth(this.depth - 0.5);
    }

    // Boss glow
    if (this.isBoss) {
      this.setTintFill(0xff4444);
      scene.time.delayedCall(200, () => {
        if (this.active) this.clearTint();
      });
      this._bossGlow = scene.add.circle(x, y - this.displayHeight / 2, data.spriteSize * 0.3, 0xff2222, 0.15).setDepth(ENTITY_BASE + y - 1);
      scene.tweens.add({
        targets: this._bossGlow,
        alpha: { from: 0.08, to: 0.2 },
        scaleX: { from: 0.9, to: 1.15 },
        scaleY: { from: 0.9, to: 1.15 },
        yoyo: true,
        repeat: -1,
        duration: 800,
      });

      // Boss special attack cooldowns
      this.bossAbilityCooldown = 3000; // initial delay before first special
      this.bossAbilityType = 'slam';   // alternates: slam, charge
    }

    // Start idle animation
    this.playIdle();

    // HP bar
    this.createHPBar();
  }

  createHPBar() {
    this.hpBar = this.scene.add.graphics();
    this.hpBar.setDepth(FOREGROUND_DEPTH + 15);
    if (this.isBoss) {
      const name = `BOSS ${this.data_.name}`;
      this._bossLabel = this.scene.add.text(this.x, this.y - this.displayHeight - 16, name, {
        fontSize: '8px', fill: '#ff6644', fontFamily: 'monospace', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(FOREGROUND_DEPTH + 15);
    }
    this.updateHPBar();
  }

  updateHPBar() {
    if (!this.hpBar || !this.active) return;
    this.hpBar.clear();

    const barWidth = this.isBoss ? 44 : 30;
    const barHeight = this.isBoss ? 5 : 4;
    const x = this.x - barWidth / 2;
    const y = this.y - this.displayHeight - 8;

    // Background
    this.hpBar.fillStyle(0x333333, 0.8);
    this.hpBar.fillRect(x, y, barWidth, barHeight);

    // Health
    const hpPercent = this.hp / this.maxHp;
    const color = hpPercent > 0.5 ? 0x00ff00 : hpPercent > 0.25 ? 0xffff00 : 0xff0000;
    this.hpBar.fillStyle(color, 1);
    this.hpBar.fillRect(x, y, barWidth * hpPercent, barHeight);

    // Update boss label position
    if (this._bossLabel && this._bossLabel.active) {
      this._bossLabel.setPosition(this.x, y - 8);
    }
    // Update boss glow position (center of sprite)
    if (this._bossGlow && this._bossGlow.active) {
      this._bossGlow.setPosition(this.x, this.y - this.displayHeight / 2);
    }
  }

  playIdle() {
    const animKey = `${this.enemyType}-idle-${this.facing}`;
    if (this.anims.animationManager.exists(animKey)) {
      this.play(animKey, true);
    } else {
      const texKey = `${this.enemyType}-idle-${this.facing}-0`;
      if (this.scene.textures.exists(texKey)) {
        this.setTexture(texKey);
      }
    }
  }

  playWalk(dir) {
    const animKey = `${this.enemyType}-walk-${dir}`;
    if (this.anims.animationManager.exists(animKey)) {
      if (this.anims.currentAnim?.key !== animKey) {
        this.play(animKey, true);
      }
    }
  }

  playAttack() {
    const animKey = `${this.enemyType}-attack-${this.facing}`;
    if (this.anims.animationManager.exists(animKey)) {
      this.play(animKey);
      this.once('animationcomplete', () => {
        this.isAttacking = false;
      });
    } else {
      this.scene.time.delayedCall(400, () => {
        this.isAttacking = false;
      });
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.setTint(0xff0000);
    this.scene.time.delayedCall(150, () => {
      if (this.active) this.clearTint();
    });

    // Show damage number
    this.showDamageNumber(amount);

    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  showDamageNumber(amount) {
    const dmgText = this.scene.add.text(this.x, this.y - this.displayHeight - 4, `-${amount}`, {
      fontSize: '14px',
      fill: '#ff4444',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(FOREGROUND_DEPTH + 20);

    this.scene.tweens.add({
      targets: dmgText,
      y: dmgText.y - 30,
      alpha: 0,
      duration: 800,
      onComplete: () => dmgText.destroy(),
    });
  }

  die() {
    this.state = 'dead';
    this.setVelocity(0, 0);
    this.body.enable = false;

    // Emit death event for loot/exp
    this.scene.events.emit('enemyDeath', {
      enemyType: this.enemyType,
      x: this.x,
      y: this.y,
    });

    // Death animation
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 400,
      onUpdate: () => {
        // Fade shadow alongside sprite
        if (this._shadow) this._shadow.setAlpha(this.alpha);
      },
      onComplete: () => {
        if (this.hpBar) this.hpBar.destroy();
        this.destroy();
      },
    });
  }

  update(time, delta, player) {
    if (this.state === 'dead' || !this.active) return;

    this.updateHPBar();

    if (this.attackCooldown > 0) {
      this.attackCooldown -= delta;
    }

    // Boss special ability cooldown
    if (this.isBoss && this.bossAbilityCooldown > 0) {
      this.bossAbilityCooldown -= delta;
    }

    // Don't change AI state while attack animation is playing
    if (this.isAttacking) {
      this.setVelocity(0, 0);
      return;
    }

    // Don't change state during charge
    if (this._isCharging) return;

    if (!player || !player.active || player.hp <= 0) {
      this.doPatrol(delta);
      return;
    }

    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    // Ranged enemies try to keep their distance
    if (this.data_.attackType === 'ranged') {
      const retreatRange = this.data_.retreatRange || 80;
      if (dist < retreatRange) {
        this.doKite(player);
      } else if (dist < this.data_.attackRange) {
        if (this.attackCooldown <= 0) {
          this.doAttack(player);
        } else {
          this.setVelocity(0, 0);
          const dx = player.x - this.x;
          const dy = player.y - this.y;
          const dir = getDirection(dx, dy);
          if (dir) this.facing = dir;
          this.playIdle();
        }
      } else if (dist < this.data_.aggroRange) {
        this.doChase(player);
      } else {
        this.doPatrol(delta);
      }
      return;
    }

    // Melee AI (original)
    // Boss special attack check
    if (this.isBoss && this.bossAbilityCooldown <= 0 && dist < this.data_.aggroRange) {
      this.doBossAbility(player, dist);
      return;
    }

    if (dist < this.data_.attackRange) {
      if (this.attackCooldown <= 0) {
        this.doAttack(player);
      } else {
        // In attack range but on cooldown — stand still and face the player
        this.setVelocity(0, 0);
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dir = getDirection(dx, dy);
        if (dir) this.facing = dir;
        this.playIdle();
      }
    } else if (dist < this.data_.aggroRange) {
      this.doChase(player);
    } else {
      this.doPatrol(delta);
    }
  }

  doPatrol(delta) {
    this.state = 'patrol';
    this.patrolTimer -= delta;

    if (this.patrolTimer <= 0) {
      // Pick new patrol direction
      this.patrolTimer = Phaser.Math.Between(1000, 3000);
      if (Math.random() < 0.3) {
        this.patrolDir = { x: 0, y: 0 }; // idle
      } else {
        const angle = Math.random() * Math.PI * 2;
        this.patrolDir = { x: Math.cos(angle), y: Math.sin(angle) };
      }
    }

    if (this.patrolDir.x === 0 && this.patrolDir.y === 0) {
      this.setVelocity(0, 0);
      this.playIdle();
    } else {
      const speed = this.data_.speed * (this.speedMultiplier || 1);
      this.setVelocity(this.patrolDir.x * speed, this.patrolDir.y * speed);
      const dir = getDirection(this.patrolDir.x, this.patrolDir.y);
      if (dir) {
        this.facing = dir;
        this.playWalk(dir);
      }
    }
  }

  doChase(player) {
    this.state = 'chase';
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len > 0) {
      const speed = this.data_.chaseSpeed * (this.speedMultiplier || 1);
      this.setVelocity((dx / len) * speed, (dy / len) * speed);
      const dir = getDirection(dx, dy);
      if (dir) {
        this.facing = dir;
        this.playWalk(dir);
      }
    }
  }

  /** Ranged enemies retreat when player gets too close */
  doKite(player) {
    this.state = 'kite';
    const dx = this.x - player.x;
    const dy = this.y - player.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len > 0) {
      const speed = this.data_.chaseSpeed * (this.speedMultiplier || 1);
      this.setVelocity((dx / len) * speed, (dy / len) * speed);
      // Face the player while retreating
      const dir = getDirection(-dx, -dy);
      if (dir) {
        this.facing = dir;
        this.playWalk(this.facing);
      }
    }
  }

  doAttack(player) {
    if (this.isAttacking) return;

    this.state = 'attack';
    this.isAttacking = true;
    this.attackCooldown = this.data_.attackCooldown;
    this.setVelocity(0, 0);

    // Face the player
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dir = getDirection(dx, dy);
    if (dir) this.facing = dir;

    this.playAttack();

    const attackDamage = this.isBoss ? this.bossAttack : this.data_.attack;

    if (this.data_.attackType === 'ranged') {
      // Fire a projectile after a slight wind-up delay
      this.scene.time.delayedCall(300, () => {
        if (!this.active || this.state === 'dead') return;
        this.scene.events.emit('enemyRangedAttack', {
          x: this.x,
          y: this.y,
          targetX: player.x,
          targetY: player.y,
          damage: attackDamage,
          speed: this.data_.projectileSpeed || 180,
        });
      });
    } else {
      // Melee: deal damage after slight delay
      this.scene.time.delayedCall(200, () => {
        if (!this.active || this.state === 'dead') return;
        const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        if (dist < this.data_.attackRange * 1.5) {
          player.takeDamage(attackDamage, this.x, this.y);
        }
      });
    }
  }

  /** Boss special ability — alternates between ground slam and charge */
  doBossAbility(player, dist) {
    const slamTrigger = GAME_CONFIG.BOSS_SLAM_RANGE * GAME_CONFIG.BOSS_SLAM_TRIGGER_RANGE;
    if (this.bossAbilityType === 'slam' && dist < slamTrigger) {
      this.doGroundSlam(player);
    } else if (this.bossAbilityType === 'charge' && dist > GAME_CONFIG.BOSS_SLAM_RANGE) {
      this.doCharge(player);
    } else {
      // Not in range for current ability — try the other one or chase
      if (this.bossAbilityType === 'slam') {
        this.doChase(player);
      } else {
        // Switch to slam if close enough
        if (dist < slamTrigger) {
          this.bossAbilityType = 'slam';
          this.doGroundSlam(player);
        } else {
          this.doCharge(player);
        }
      }
    }
  }

  /** Boss Ground Slam — AoE damage around the boss with telegraph */
  doGroundSlam(player) {
    this.isAttacking = true;
    this.setVelocity(0, 0);
    this.bossAbilityCooldown = GAME_CONFIG.BOSS_SLAM_COOLDOWN;
    this.bossAbilityType = 'charge'; // alternate

    const range = GAME_CONFIG.BOSS_SLAM_RANGE;

    // Telegraph: red circle that expands
    const telegraph = this.scene.add.circle(this.x, this.y, range, 0xff2222, 0.15).setDepth(ENTITY_BASE - 1);
    telegraph.setScale(0.3);
    this.scene.tweens.add({
      targets: telegraph,
      scaleX: 1,
      scaleY: 1,
      alpha: 0.3,
      duration: GAME_CONFIG.BOSS_SLAM_WINDUP,
    });

    // Tint boss during windup
    this.setTint(0xff6600);

    this.scene.time.delayedCall(GAME_CONFIG.BOSS_SLAM_WINDUP, () => {
      if (!this.active || this.state === 'dead') {
        telegraph.destroy();
        return;
      }

      // Impact flash
      telegraph.setAlpha(0.5);
      this.scene.tweens.add({
        targets: telegraph,
        alpha: 0,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 300,
        onComplete: () => telegraph.destroy(),
      });

      // Screen shake
      this.scene.cameras.main.shake(200, 0.008);

      // Damage player if in range
      const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
      if (dist < range && player.active && player.hp > 0) {
        const damage = Math.floor(this.bossAttack * GAME_CONFIG.BOSS_SLAM_DAMAGE_MULT);
        player.takeDamage(damage, this.x, this.y);
      }

      // Impact particles
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6;
        const px = this.x + Math.cos(angle) * range * 0.6;
        const py = this.y + Math.sin(angle) * range * 0.6;
        const particle = this.scene.add.circle(px, py, 3, 0xff4400, 0.8).setDepth(FOREGROUND_DEPTH + 10);
        this.scene.tweens.add({
          targets: particle,
          x: this.x + Math.cos(angle) * range * 1.2,
          y: this.y + Math.sin(angle) * range * 1.2,
          alpha: 0,
          duration: 400,
          onComplete: () => particle.destroy(),
        });
      }

      this.clearTint();
      this.isAttacking = false;
    });
  }

  /** Boss Charge — rush toward the player at high speed */
  doCharge(player) {
    this.isAttacking = true;
    this._isCharging = true;
    this.bossAbilityCooldown = GAME_CONFIG.BOSS_CHARGE_COOLDOWN;
    this.bossAbilityType = 'slam'; // alternate

    // Face the player
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const dir = getDirection(dx, dy);
    if (dir) this.facing = dir;

    // Brief windup
    this.setTint(0xff8800);
    this.setVelocity(0, 0);

    this.scene.time.delayedCall(350, () => {
      if (!this.active || this.state === 'dead') {
        this._isCharging = false;
        this.isAttacking = false;
        return;
      }

      // Charge!
      const speed = GAME_CONFIG.BOSS_CHARGE_SPEED;
      if (len > 0) {
        this.setVelocity((dx / len) * speed, (dy / len) * speed);
      }

      // Trail effect during charge
      const trailInterval = this.scene.time.addEvent({
        delay: 50,
        repeat: Math.floor(GAME_CONFIG.BOSS_CHARGE_DURATION / 50),
        callback: () => {
          if (!this.active) return;
          const ghost = this.scene.add.circle(this.x, this.y, 8, 0xff6600, 0.4).setDepth(ENTITY_BASE + this.y - 1);
          this.scene.tweens.add({
            targets: ghost,
            alpha: 0,
            scaleX: 0.2,
            scaleY: 0.2,
            duration: 300,
            onComplete: () => ghost.destroy(),
          });
        },
      });

      // End charge after duration
      this.scene.time.delayedCall(GAME_CONFIG.BOSS_CHARGE_DURATION, () => {
        if (!this.active || this.state === 'dead') {
          this._isCharging = false;
          this.isAttacking = false;
          return;
        }

        this.setVelocity(0, 0);
        this._isCharging = false;
        this.isAttacking = false;
        this.clearTint();

        // Check if we hit the player
        const hitDist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        if (hitDist < GAME_CONFIG.BOSS_CHARGE_HIT_RADIUS && player.active && player.hp > 0) {
          const damage = Math.floor(this.bossAttack * GAME_CONFIG.BOSS_CHARGE_DAMAGE_MULT);
          player.takeDamage(damage, this.x, this.y);
        }
      });
    });
  }

  destroy(fromScene) {
    if (this._shadow) {
      this._shadow.destroy();
      this._shadow = null;
    }
    if (this.hpBar) {
      this.hpBar.destroy();
      this.hpBar = null;
    }
    if (this._bossLabel) {
      this._bossLabel.destroy();
      this._bossLabel = null;
    }
    if (this._bossGlow) {
      this._bossGlow.destroy();
      this._bossGlow = null;
    }
    super.destroy(fromScene);
  }
}
