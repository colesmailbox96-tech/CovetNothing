import Phaser from 'phaser';
import { ENEMY_DATA } from '../data/enemies.js';
import { getDirection } from '../config.js';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, enemyType) {
    const data = ENEMY_DATA[enemyType];
    const idleKey = `${enemyType}-idle-south-0`;
    super(scene, x, y, idleKey);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.enemyType = enemyType;
    this.data_ = data;
    this.hp = data.hp;
    this.maxHp = data.hp;
    this.facing = 'south';
    this.state = 'patrol'; // patrol, chase, attack, dead
    this.attackCooldown = 0;
    this.patrolTimer = 0;
    this.patrolDir = { x: 0, y: 0 };
    this.isAttacking = false;
    this.hpBar = null;

    // Physics setup
    const spriteScale = 0.45;
    this.setScale(spriteScale);
    const bodySize = data.spriteSize * 0.35;
    const bodyOffset = (data.spriteSize - bodySize) / 2;
    this.body.setSize(bodySize, bodySize);
    this.body.setOffset(bodyOffset, bodyOffset + 10);
    this.setDepth(8);

    // Start idle animation
    this.playIdle();

    // HP bar
    this.createHPBar();
  }

  createHPBar() {
    this.hpBar = this.scene.add.graphics();
    this.hpBar.setDepth(15);
    this.updateHPBar();
  }

  updateHPBar() {
    if (!this.hpBar || !this.active) return;
    this.hpBar.clear();

    const barWidth = 30;
    const barHeight = 4;
    const x = this.x - barWidth / 2;
    const y = this.y - this.displayHeight / 2 - 8;

    // Background
    this.hpBar.fillStyle(0x333333, 0.8);
    this.hpBar.fillRect(x, y, barWidth, barHeight);

    // Health
    const hpPercent = this.hp / this.maxHp;
    const color = hpPercent > 0.5 ? 0x00ff00 : hpPercent > 0.25 ? 0xffff00 : 0xff0000;
    this.hpBar.fillStyle(color, 1);
    this.hpBar.fillRect(x, y, barWidth * hpPercent, barHeight);
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
    const dmgText = this.scene.add.text(this.x, this.y - 20, `-${amount}`, {
      fontSize: '14px',
      fill: '#ff4444',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(20);

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

    // Don't change AI state while attack animation is playing
    if (this.isAttacking) {
      this.setVelocity(0, 0);
      return;
    }

    if (!player || !player.active || player.hp <= 0) {
      this.doPatrol(delta);
      return;
    }

    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

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
      const speed = this.data_.speed;
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
      const speed = this.data_.chaseSpeed;
      this.setVelocity((dx / len) * speed, (dy / len) * speed);
      const dir = getDirection(dx, dy);
      if (dir) {
        this.facing = dir;
        this.playWalk(dir);
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

    // Deal damage after slight delay
    this.scene.time.delayedCall(200, () => {
      if (!this.active || this.state === 'dead') return;
      const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
      if (dist < this.data_.attackRange * 1.5) {
        player.takeDamage(this.data_.attack, this.x, this.y);
      }
    });
  }

  destroy(fromScene) {
    if (this.hpBar) {
      this.hpBar.destroy();
      this.hpBar = null;
    }
    super.destroy(fromScene);
  }
}
