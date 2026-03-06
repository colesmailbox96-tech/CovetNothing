import Phaser from 'phaser';

export class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  create() {
    this.stats = {
      hp: 100, maxHp: 100,
      level: 1, exp: 0, expNext: 100,
      gold: 0, floor: 0, attack: 15,
      location: 'town',
      inventory: [],
    };

    this.showInventory = false;
    this.isTouchDevice = this.input.activePointer.wasTouch
      || ('ontouchstart' in window)
      || (navigator.maxTouchPoints > 0);

    // Touch input state (joystick vector, shared with Player via registry)
    this.touchMoveX = 0;
    this.touchMoveY = 0;
    this.joystickPointerId = -1;

    // Create UI elements
    this.createHUD();
    if (this.isTouchDevice) {
      this.createTouchControls();
    }

    // Listen for stat updates from game scenes
    this.events.on('updateStats', (data) => {
      Object.assign(this.stats, data);
      this.refreshHUD();
    });

    // Toggle inventory with I key
    this.input.keyboard.on('keydown-I', () => {
      this.showInventory = !this.showInventory;
      this.refreshHUD();
    });

    // Handle resize
    this.scale.on('resize', () => {
      this.createHUD();
      if (this.isTouchDevice) {
        this.createTouchControls();
      }
    });
  }

  /** Push joystick vector to the active game scene's player */
  syncTouchInput() {
    const activeScene = this.scene.get('DungeonScene');
    const townScene = this.scene.get('TownScene');
    const player = (activeScene && activeScene.player) || (townScene && townScene.player);
    if (player) {
      player.touchMoveX = this.touchMoveX;
      player.touchMoveY = this.touchMoveY;
    }
  }

  // ---- Touch controls (virtual joystick + action buttons) ----
  createTouchControls() {
    if (this.touchContainer) this.touchContainer.destroy();
    this.touchContainer = this.add.container(0, 0).setDepth(300).setScrollFactor(0);

    const { width, height } = this.scale;
    const safeBottom = height - 20; // Account for safe area insets

    this.createVirtualJoystick(width, safeBottom);
    this.createActionButtons(width, safeBottom);
  }

  createVirtualJoystick(screenW, safeBottom) {
    const radius = Math.min(50, screenW * 0.08);
    const knobRadius = radius * 0.45;
    const cx = radius + 30;
    const cy = safeBottom - radius - 20;

    // Base circle
    const base = this.add.circle(cx, cy, radius, 0xffffff, 0.15);
    base.setStrokeStyle(2, 0xffffff, 0.3);
    this.touchContainer.add(base);

    // Knob
    const knob = this.add.circle(cx, cy, knobRadius, 0xffffff, 0.35);
    this.touchContainer.add(knob);

    // Store joystick state
    this.joyBase = { x: cx, y: cy, radius };
    this.joyKnob = knob;

    // Make the base interactive with a larger hit area for easier use
    const hitSize = radius * 2.5;
    const hitZone = this.add.zone(cx, cy, hitSize, hitSize).setInteractive();
    this.touchContainer.add(hitZone);

    hitZone.on('pointerdown', (pointer) => {
      this.joystickPointerId = pointer.id;
      this.updateJoystick(pointer);
    });

    this.input.on('pointermove', (pointer) => {
      if (pointer.id === this.joystickPointerId && pointer.isDown) {
        this.updateJoystick(pointer);
      }
    });

    this.input.on('pointerup', (pointer) => {
      if (pointer.id === this.joystickPointerId) {
        this.joystickPointerId = -1;
        this.touchMoveX = 0;
        this.touchMoveY = 0;
        knob.setPosition(cx, cy);
        this.syncTouchInput();
      }
    });
  }

  updateJoystick(pointer) {
    const base = this.joyBase;
    const dx = pointer.x - base.x;
    const dy = pointer.y - base.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = base.radius;

    let nx, ny;
    if (dist > maxDist) {
      nx = (dx / dist) * maxDist;
      ny = (dy / dist) * maxDist;
    } else {
      nx = dx;
      ny = dy;
    }

    this.joyKnob.setPosition(base.x + nx, base.y + ny);

    // Normalize to -1..1 range with a small dead zone
    const deadZone = 0.15;
    const normX = nx / maxDist;
    const normY = ny / maxDist;
    this.touchMoveX = Math.abs(normX) > deadZone ? normX : 0;
    this.touchMoveY = Math.abs(normY) > deadZone ? normY : 0;

    this.syncTouchInput();
  }

  createActionButtons(screenW, safeBottom) {
    const btnRadius = Math.min(28, screenW * 0.05);
    const pad = btnRadius * 0.6;

    // Position buttons on the right side
    const rightX = screenW - btnRadius - 30;
    const bottomY = safeBottom - btnRadius - 20;

    // Attack button (bottom-right, large)
    this.createTouchButton(rightX, bottomY, btnRadius, '⚔️', 0xff4444, () => {
      this.emitTouchAction('attack');
    });

    // Interact button (above attack)
    this.createTouchButton(rightX, bottomY - btnRadius * 2 - pad, btnRadius * 0.8, 'E', 0x44aaff, () => {
      this.emitTouchAction('interact');
    });

    // Inventory button (above interact)
    this.createTouchButton(rightX - btnRadius * 2 - pad, bottomY, btnRadius * 0.8, 'I', 0xffaa44, () => {
      this.showInventory = !this.showInventory;
      this.refreshHUD();
    });
  }

  createTouchButton(x, y, radius, label, color, callback) {
    const bg = this.add.circle(x, y, radius, color, 0.3);
    bg.setStrokeStyle(2, color, 0.6);
    this.touchContainer.add(bg);

    const text = this.add.text(x, y, label, {
      fontSize: `${Math.max(12, radius * 0.7)}px`,
      fill: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.touchContainer.add(text);

    // Make interactive
    bg.setInteractive(new Phaser.Geom.Circle(0, 0, radius), Phaser.Geom.Circle.Contains);
    bg.on('pointerdown', () => {
      bg.setAlpha(0.8);
      callback();
    });
    bg.on('pointerup', () => {
      bg.setAlpha(1);
    });
    bg.on('pointerout', () => {
      bg.setAlpha(1);
    });
  }

  emitTouchAction(action) {
    // Send action to the currently active game scene
    const dungeonScene = this.scene.get('DungeonScene');
    const townScene = this.scene.get('TownScene');

    if (action === 'attack') {
      // Trigger attack on the player in the active scene
      const player = (dungeonScene && dungeonScene.player) || (townScene && townScene.player);
      if (player && player.active) {
        player.tryAttack();
      }
    } else if (action === 'interact') {
      // Simulate E key press in the active game scene
      if (dungeonScene && dungeonScene.scene.isActive()) {
        dungeonScene.handleTouchInteract();
      } else if (townScene && townScene.scene.isActive()) {
        townScene.handleTouchInteract();
      }
    }
  }

  createHUD() {
    // Clear existing
    if (this.uiContainer) this.uiContainer.destroy();

    this.uiContainer = this.add.container(0, 0);
    this.uiContainer.setDepth(200);

    const { width, height } = this.scale;
    const pad = 8;
    const barWidth = Math.min(160, width * 0.25);
    const barHeight = 12;
    const fontSize = '11px';
    const smallFont = '9px';

    // ---- Top-Right: Stats Panel ----
    const panelX = width - barWidth - pad * 2;
    const panelY = pad;

    // Background panel
    const panelBg = this.add.rectangle(
      panelX - pad, panelY - pad / 2,
      barWidth + pad * 3, 105,
      0x000000, 0.7
    ).setOrigin(0, 0);
    this.uiContainer.add(panelBg);

    // Location text
    const locText = this.stats.location === 'town' ? '🏠 Town' : `⚔️ Dungeon F${this.stats.floor}`;
    this.locationText = this.add.text(panelX, panelY, locText, {
      fontSize, fill: '#ffffff', fontFamily: 'monospace',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
    });
    this.uiContainer.add(this.locationText);

    // HP Bar
    const hpY = panelY + 18;
    this.hpBarBg = this.add.rectangle(panelX, hpY, barWidth, barHeight, 0x333333).setOrigin(0, 0);
    const hpPercent = this.stats.hp / this.stats.maxHp;
    this.hpBar = this.add.rectangle(panelX, hpY, barWidth * hpPercent, barHeight, 0xff3333).setOrigin(0, 0);
    this.hpText = this.add.text(panelX + barWidth / 2, hpY + barHeight / 2,
      `HP: ${this.stats.hp}/${this.stats.maxHp}`, {
        fontSize: smallFont, fill: '#ffffff', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 1,
      }).setOrigin(0.5);
    this.uiContainer.add([this.hpBarBg, this.hpBar, this.hpText]);

    // EXP Bar
    const expY = hpY + barHeight + 4;
    this.expBarBg = this.add.rectangle(panelX, expY, barWidth, barHeight, 0x333333).setOrigin(0, 0);
    const expPercent = this.stats.exp / this.stats.expNext;
    this.expBar = this.add.rectangle(panelX, expY, barWidth * expPercent, barHeight, 0x3388ff).setOrigin(0, 0);
    this.expText = this.add.text(panelX + barWidth / 2, expY + barHeight / 2,
      `EXP: ${this.stats.exp}/${this.stats.expNext}`, {
        fontSize: smallFont, fill: '#ffffff', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 1,
      }).setOrigin(0.5);
    this.uiContainer.add([this.expBarBg, this.expBar, this.expText]);

    // Level, Gold, Attack text
    const statsY = expY + barHeight + 6;
    this.levelText = this.add.text(panelX, statsY,
      `Lv: ${this.stats.level}  ATK: ${this.stats.attack}`, {
        fontSize: smallFont, fill: '#ffdd44', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 1,
      });
    this.uiContainer.add(this.levelText);

    const goldY = statsY + 14;
    this.goldText = this.add.text(panelX, goldY,
      `Gold: ${this.stats.gold}`, {
        fontSize: smallFont, fill: '#ffaa00', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 1,
      });
    this.uiContainer.add(this.goldText);

    // ---- Bottom: Controls hint ----
    const controlsY = height - 20;
    const controlsText = this.isTouchDevice
      ? ''
      : 'WASD: Move | SPACE: Attack | E: Interact | I: Inventory';
    if (controlsText) {
      this.controlsHint = this.add.text(width / 2, controlsY, controlsText, {
        fontSize: '9px', fill: '#888888', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 1,
      }).setOrigin(0.5);
      this.uiContainer.add(this.controlsHint);
    }

    // ---- Item Icons Bar (always visible, bottom-left) ----
    this.createItemIconsBar(width, height);

    // ---- Inventory Panel (if open) ----
    if (this.showInventory) {
      this.createInventoryPanel(width, height);
    }
  }

  createItemIconsBar(width, height) {
    const items = this.stats.inventory || [];
    if (items.length === 0) return;

    const iconSize = 32;
    const iconPad = 6;
    const barX = 10;
    // Move item bar higher on touch devices to avoid overlapping with joystick
    const barY = this.isTouchDevice ? height - 160 : height - 56;

    // Background for the item bar
    const totalWidth = items.length * (iconSize + iconPad) + iconPad;
    const barBg = this.add.rectangle(
      barX - 4, barY - 4,
      totalWidth + 4, iconSize + 8,
      0x000000, 0.6
    ).setOrigin(0, 0);
    const barBorder = this.add.rectangle(
      barX - 4, barY - 4,
      totalWidth + 4, iconSize + 8
    ).setOrigin(0, 0);
    barBorder.setStrokeStyle(1, 0x555555);
    this.uiContainer.add([barBg, barBorder]);

    let offsetX = barX;
    for (const item of items) {
      // Item slot background
      const slotBg = this.add.rectangle(
        offsetX, barY, iconSize, iconSize,
        0x1a1a2e, 0.8
      ).setOrigin(0, 0);
      const slotBorder = this.add.rectangle(
        offsetX, barY, iconSize, iconSize
      ).setOrigin(0, 0);
      slotBorder.setStrokeStyle(1, 0x4a4a6e);
      this.uiContainer.add([slotBg, slotBorder]);

      // Item icon
      if (item.icon && this.textures.exists(item.icon)) {
        const icon = this.add.image(
          offsetX + iconSize / 2,
          barY + iconSize / 2,
          item.icon
        ).setDisplaySize(iconSize - 6, iconSize - 6);
        this.uiContainer.add(icon);
      }

      // Quantity text in bottom-right corner of the icon
      if (item.quantity > 0) {
        const qtyText = this.add.text(
          offsetX + iconSize - 2,
          barY + iconSize - 2,
          `${item.quantity}`, {
            fontSize: '10px',
            fill: '#ffffff',
            fontFamily: 'monospace',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2,
          }
        ).setOrigin(1, 1);
        this.uiContainer.add(qtyText);
      }

      offsetX += iconSize + iconPad;
    }
  }

  createInventoryPanel(width, height) {
    const panelW = Math.min(250, width * 0.4);
    const panelH = Math.min(300, height * 0.5);
    const panelX = width / 2 - panelW / 2;
    const panelY = height / 2 - panelH / 2;

    const bg = this.add.rectangle(panelX, panelY, panelW, panelH, 0x1a1a2e, 0.95).setOrigin(0, 0);
    const border = this.add.rectangle(panelX, panelY, panelW, panelH).setOrigin(0, 0);
    border.setStrokeStyle(2, 0x4a4a6e);
    this.uiContainer.add([bg, border]);

    const title = this.add.text(panelX + panelW / 2, panelY + 12, '📦 Inventory', {
      fontSize: '12px', fill: '#ffffff', fontFamily: 'monospace',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);
    this.uiContainer.add(title);

    const items = this.stats.inventory || [];
    if (items.length === 0) {
      const empty = this.add.text(panelX + panelW / 2, panelY + panelH / 2, 'Empty', {
        fontSize: '10px', fill: '#888888', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.uiContainer.add(empty);
    } else {
      let yOffset = panelY + 30;
      for (const item of items) {
        // Item icon
        if (item.icon && this.textures.exists(item.icon)) {
          const icon = this.add.image(panelX + 20, yOffset + 8, item.icon).setScale(0.25);
          this.uiContainer.add(icon);
        }

        const itemText = this.add.text(panelX + 38, yOffset,
          `${item.name} x${item.quantity}`, {
            fontSize: '9px', fill: '#dddddd', fontFamily: 'monospace',
          });
        this.uiContainer.add(itemText);

        const priceText = this.add.text(panelX + panelW - 12, yOffset,
          `${item.sellPrice * item.quantity}g`, {
            fontSize: '9px', fill: '#ffaa00', fontFamily: 'monospace',
          }).setOrigin(1, 0);
        this.uiContainer.add(priceText);

        yOffset += 20;
      }
    }
  }

  refreshHUD() {
    this.createHUD();
  }
}
