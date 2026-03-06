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
  }

  getMaxHP() {
    return this.levelSystem.getMaxHP();
  }

  heal(amount) {
    this.hp = Math.min(this.hp + amount, this.getMaxHP());
  }

  takeDamage(amount, attackerX, attackerY) {
    if (this.invulnerable) return;

    this.hp -= amount;
    this.invulnerable = true;
    this.invulnerableTimer = 500;

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

  update(time, delta) {
    if (this.attackCooldown > 0) {
      this.attackCooldown -= delta;
    }
    if (this.invulnerable) {
      this.invulnerableTimer -= delta;
      if (this.invulnerableTimer <= 0) {
        this.invulnerable = false;
        this.clearTint();
      }
    }
    if (this.autoRetaliateTimer > 0) {
      this.autoRetaliateTimer -= delta;
    }

    // Movement
    let vx = 0;
    let vy = 0;
    const speed = GAME_CONFIG.PLAYER_SPEED;

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
