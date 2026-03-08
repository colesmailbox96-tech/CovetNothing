import Phaser from 'phaser';
import { GAME_CONFIG, getDirection } from '../config.js';

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, levelSystem) {
    super(scene, x, y, 'player-idle-south');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.levelSystem = levelSystem;
    this.hp = levelSystem.getMaxHP();
    this.facing = 'south';
    this.isAttacking = false;
    this.attackCooldown = 0;
    this.invulnerable = false;
    this.invulnerableTimer = 0;
    this.autoRetaliateTimer = 0;

    // Touch joystick input (set by UIScene)
    this.touchMoveX = 0;
    this.touchMoveY = 0;

    // Set up physics body
    this.setScale(0.5);
    this.body.setSize(40, 40);
    this.body.setOffset(32, 48);
    this.setDepth(10);

    // Input
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.wasd = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.attackKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.dashKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    // Dash state
    this.isDashing = false;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashDir = { x: 0, y: 0 };
  }

  getMaxHP() {
    return this.levelSystem.getMaxHP();
  }

  heal(amount) {
    this.hp = Math.min(this.hp + amount, this.getMaxHP());
  }

  takeDamage(amount, attackerX, attackerY) {
    if (this.invulnerable) return;

    const defense = this.levelSystem.getDefense ? this.levelSystem.getDefense() : 0;
    // Apply floor modifier defense bonus and damage taken multiplier
    const modDef = (this.floorModifier && this.floorModifier.effects.bonusDefense) || 0;
    const dmgTakenMult = (this.floorModifier && this.floorModifier.effects.damageTakenMultiplier) || 1;
    const mitigated = Math.max(1, Math.floor(amount * dmgTakenMult) - defense - modDef);
    this.hp -= mitigated;
    this.invulnerable = true;
    this.invulnerableTimer = 500;

    // Notify scene of damage taken (for run stats)
    this.scene.events.emit('playerDamageTaken', mitigated);

    // Haptic feedback on taking damage
    if (navigator.vibrate) navigator.vibrate(30);

    // Flash effect
    this.setTint(0xff0000);
    this.scene.time.delayedCall(200, () => {
      this.clearTint();
    });

    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
      return;
    }

    // Auto-retaliate: face attacker and strike back
    if (attackerX !== undefined && attackerY !== undefined) {
      const dx = attackerX - this.x;
      const dy = attackerY - this.y;
      const dir = getDirection(dx, dy);
      if (dir) this.facing = dir;
      this.tryAttack();
      // Enter combat mode — auto-attack nearby enemies for a duration
      this.autoRetaliateTimer = GAME_CONFIG.PLAYER_COMBAT_MODE_DURATION;
    }
  }

  die() {
    // Emit death event - scene handles respawn
    this.scene.events.emit('playerDeath');
  }

  tryAttack() {
    if (this.isAttacking || this.attackCooldown > 0) return;

    this.isAttacking = true;
    this.attackCooldown = GAME_CONFIG.PLAYER_ATTACK_COOLDOWN;

    const animKey = `player-attack-${this.facing}`;
    if (this.anims.animationManager.exists(animKey)) {
      this.play(animKey);
      // Safety fallback: ensure isAttacking resets even if the animation is interrupted
      const anim = this.anims.animationManager.get(animKey);
      const duration = (anim.frames.length / anim.frameRate) * 1000 + 50;
      const fallback = this.scene.time.delayedCall(duration, () => {
        this.isAttacking = false;
      });
      this.once('animationcomplete', () => {
        this.isAttacking = false;
        fallback.remove(false);
      });
    } else {
      this.scene.time.delayedCall(300, () => {
        this.isAttacking = false;
      });
    }

    // Emit attack event for combat system
    this.scene.events.emit('playerAttack', {
      x: this.x + this.getFacingOffset().x,
      y: this.y + this.getFacingOffset().y,
      damage: this.levelSystem.getAttack(),
      reach: GAME_CONFIG.PLAYER_ATTACK_REACH,
    });
  }

  getFacingOffset() {
    const reach = GAME_CONFIG.PLAYER_ATTACK_REACH;
    const offsets = {
      'south': { x: 0, y: reach },
      'north': { x: 0, y: -reach },
      'east': { x: reach, y: 0 },
      'west': { x: -reach, y: 0 },
      'south-east': { x: reach * 0.7, y: reach * 0.7 },
      'south-west': { x: -reach * 0.7, y: reach * 0.7 },
      'north-east': { x: reach * 0.7, y: -reach * 0.7 },
      'north-west': { x: -reach * 0.7, y: -reach * 0.7 },
    };
    return offsets[this.facing] || { x: 0, y: reach };
  }

  tryDash() {
    if (this.isDashing || this.dashCooldown > 0) return;

    this.isDashing = true;
    this.invulnerable = true;
    this.dashTimer = GAME_CONFIG.DASH_DURATION;
    this.dashCooldown = GAME_CONFIG.DASH_COOLDOWN;

    // Dash in facing direction
    const offset = this.getFacingOffset();
    const len = Math.sqrt(offset.x * offset.x + offset.y * offset.y);
    if (len > 0) {
      this.dashDir = { x: offset.x / len, y: offset.y / len };
    } else {
      this.dashDir = { x: 0, y: 1 };
    }

    // Visual feedback: tint and slight transparency
    this.setTint(0x88ccff);
    this.setAlpha(0.6);

    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(15);
  }

  update(time, delta) {
    if (this.attackCooldown > 0) {
      this.attackCooldown -= delta;
    }
    if (this.dashCooldown > 0) {
      this.dashCooldown -= delta;
    }
    if (this.invulnerable && !this.isDashing) {
      this.invulnerableTimer -= delta;
      if (this.invulnerableTimer <= 0) {
        this.invulnerable = false;
        this.clearTint();
      }
    }
    if (this.autoRetaliateTimer > 0) {
      this.autoRetaliateTimer -= delta;
    }

    // Handle active dash
    if (this.isDashing) {
      this.dashTimer -= delta;
      this.setVelocity(
        this.dashDir.x * GAME_CONFIG.DASH_SPEED,
        this.dashDir.y * GAME_CONFIG.DASH_SPEED
      );

      // Spawn afterimage
      if (this.scene && this.scene.add) {
        const ghost = this.scene.add.image(this.x, this.y, this.texture.key);
        ghost.setScale(this.scaleX, this.scaleY);
        ghost.setAlpha(0.3);
        ghost.setTint(0x88ccff);
        ghost.setDepth(9);
        this.scene.tweens.add({
          targets: ghost,
          alpha: 0,
          duration: 200,
          onComplete: () => ghost.destroy(),
        });
      }

      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.invulnerable = false;
        this.invulnerableTimer = 0;
        this.clearTint();
        this.setAlpha(1);
        this.setVelocity(0, 0);
      }
      return; // skip normal movement during dash
    }

    // Movement
    let vx = 0;
    let vy = 0;
    let speed = GAME_CONFIG.PLAYER_SPEED;
    // Apply speed buff from status effects
    if (this.levelSystem.statusEffects) {
      speed *= this.levelSystem.statusEffects.getSpeedMultiplier();
    }

    if (this.cursors.left.isDown || this.wasd.left.isDown) vx = -1;
    else if (this.cursors.right.isDown || this.wasd.right.isDown) vx = 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) vy = -1;
    else if (this.cursors.down.isDown || this.wasd.down.isDown) vy = 1;

    // Apply touch joystick input
    if (vx === 0 && vy === 0 && (this.touchMoveX !== 0 || this.touchMoveY !== 0)) {
      vx = this.touchMoveX;
      vy = this.touchMoveY;
    }

    // Attack with space (allowed while moving)
    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) {
      this.tryAttack();
    }

    // Dash with shift
    if (Phaser.Input.Keyboard.JustDown(this.dashKey)) {
      this.tryDash();
    }

    if (vx !== 0 || vy !== 0) {
      // Normalize diagonal
      const len = Math.sqrt(vx * vx + vy * vy);
      this.setVelocity((vx / len) * speed, (vy / len) * speed);

      const dir = getDirection(vx, vy);
      if (dir) {
        this.facing = dir;
        // Only change to run animation if not currently attacking
        if (!this.isAttacking) {
          const runAnim = `player-run-${dir}`;
          if (this.anims.animationManager.exists(runAnim)) {
            if (this.anims.currentAnim?.key !== runAnim) {
              this.play(runAnim, true);
            }
          }
        }
      }
    } else {
      this.setVelocity(0, 0);
      // Idle (only if not attacking)
      if (!this.isAttacking) {
        const idleKey = `player-idle-${this.facing}`;
        if (this.scene.textures.exists(idleKey)) {
          this.setTexture(idleKey);
          this.anims.stop();
        }
      }
    }
  }
}
