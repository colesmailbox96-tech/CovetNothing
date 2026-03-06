import Phaser from 'phaser';
import { getDirection } from '../config.js';
import { ITEM_DATA } from '../data/items.js';
import { CraftingSystem, RECIPES } from '../systems/CraftingSystem.js';

const JOYSTICK_DEAD_ZONE = 0.15;
const SWIPE_THRESHOLD = 30;     // min px to count as a swipe
const SWIPE_MAX_TIME = 300;     // max ms for a swipe gesture

export class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  create() {
    this.stats = {
      hp: 100, maxHp: 100,
      level: 1, exp: 0, expNext: 100,
      gold: 0, floor: 0, attack: 15,
      defense: 0,
      equipment: { weapon: null, armor: null },
      location: 'town',
      inventory: [],
    };

    this.showInventory = false;
    // Detect touch-primary devices (mobile/tablet) using coarse pointer check
    // to avoid showing touch controls on desktop touchscreen laptops
    const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const hasTouchAPI = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    this.isTouchDevice = hasCoarsePointer && hasTouchAPI;

    // Read iOS safe area insets from CSS environment variables
    this.safeArea = { top: 0, right: 0, bottom: 0, left: 0 };
    this._readSafeAreaInsets();

    // Touch input state (joystick vector, shared with Player via registry)
    this.touchMoveX = 0;
    this.touchMoveY = 0;
    this.joystickPointerId = -1;

    // Swipe gesture state (for right-side swipe-to-attack)
    this._swipeStart = null;

    // Create UI elements
    this.createHUD();
    if (this.isTouchDevice) {
      this.createTouchControls();
      this._setupSwipeGesture();
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
      this._readSafeAreaInsets();
      this.createHUD();
      if (this.isTouchDevice) {
        this.createTouchControls();
      }
    });
  }

  /** Get the player from the currently active game scene */
  getActivePlayer() {
    const dungeonScene = this.scene.get('DungeonScene');
    if (dungeonScene && dungeonScene.scene.isActive() && dungeonScene.player) {
      return dungeonScene.player;
    }
    const townScene = this.scene.get('TownScene');
    if (townScene && townScene.scene.isActive() && townScene.player) {
      return townScene.player;
    }
    return null;
  }

  /** Push joystick vector to the active game scene's player */
  syncTouchInput() {
    const player = this.getActivePlayer();
    if (player) {
      player.touchMoveX = this.touchMoveX;
      player.touchMoveY = this.touchMoveY;
    }
  }

  /** Read iOS/Android safe area insets from CSS env() variables */
  _readSafeAreaInsets() {
    // Use a temp element positioned at safe area boundaries to measure insets.
    // CSS env() values can only be resolved in CSS context, not via getComputedStyle directly.
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:env(safe-area-inset-top);right:env(safe-area-inset-right);bottom:env(safe-area-inset-bottom);left:env(safe-area-inset-left);pointer-events:none;visibility:hidden;';
    document.body.appendChild(div);
    const rect = div.getBoundingClientRect();
    const winH = window.innerHeight;
    const winW = window.innerWidth;
    this.safeArea = {
      top: Math.max(0, rect.top),
      bottom: Math.max(0, winH - rect.bottom),
      left: Math.max(0, rect.left),
      right: Math.max(0, winW - rect.right),
    };
    document.body.removeChild(div);
  }

  /** Trigger haptic feedback (short vibration) if available.
   *  Note: navigator.vibrate is not supported on iOS Safari; the guard
   *  ensures this is a no-op on unsupported platforms. */
  static haptic(ms = 15) {
    if (navigator.vibrate) {
      navigator.vibrate(ms);
    }
  }

  // ---- Touch controls (virtual joystick + action buttons) ----
  createTouchControls() {
    if (this.touchContainer) this.touchContainer.destroy();
    this.touchContainer = this.add.container(0, 0).setDepth(300).setScrollFactor(0);

    const { width, height } = this.scale;
    // Account for iOS safe area insets (notch, home indicator)
    const safeBottom = height - Math.max(20, this.safeArea.bottom + 10);
    const safeLeft = Math.max(20, this.safeArea.left + 10);
    const safeRight = Math.max(20, this.safeArea.right + 10);

    this.createVirtualJoystick(width, safeBottom, safeLeft);
    this.createActionButtons(width, safeBottom, safeRight);
  }

  createVirtualJoystick(screenW, safeBottom, safeLeft) {
    // DPI-aware scaling: base radius scales with screen and device pixel ratio
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const baseRadius = Math.min(50, screenW * 0.08) * Math.max(1, dpr * 0.45);
    const knobRadius = baseRadius * 0.45;

    // Floating joystick: define the touch zone on the left half of the screen
    const zoneWidth = screenW * 0.45;
    const zoneHeight = safeBottom * 0.5;
    const zoneX = safeLeft;
    const zoneY = safeBottom - zoneHeight;

    // Ghost indicator showing default joystick position (semi-transparent)
    const ghostCx = safeLeft + baseRadius + 20;
    const ghostCy = safeBottom - baseRadius - 10;
    const ghost = this.add.circle(ghostCx, ghostCy, baseRadius, 0xffffff, 0.08);
    ghost.setStrokeStyle(1, 0xffffff, 0.15);
    this.touchContainer.add(ghost);
    this._joyGhost = ghost;

    // Active joystick elements (hidden until touch)
    const base = this.add.circle(0, 0, baseRadius, 0xffffff, 0.2);
    base.setStrokeStyle(2, 0xffffff, 0.4);
    base.setVisible(false);
    this.touchContainer.add(base);

    const knob = this.add.circle(0, 0, knobRadius, 0xffffff, 0.5);
    knob.setVisible(false);
    this.touchContainer.add(knob);

    // Store joystick state
    this.joyBaseCircle = base;
    this.joyKnob = knob;
    this.joyRadius = baseRadius;

    // Invisible touch zone covering the left side
    const hitZone = this.add.zone(
      zoneX + zoneWidth / 2, zoneY + zoneHeight / 2,
      zoneWidth, zoneHeight
    ).setInteractive();
    this.touchContainer.add(hitZone);

    hitZone.on('pointerdown', (pointer) => {
      this.joystickPointerId = pointer.id;
      // Position the joystick base where the touch started
      this.joyBase = { x: pointer.x, y: pointer.y, radius: baseRadius };
      base.setPosition(pointer.x, pointer.y);
      knob.setPosition(pointer.x, pointer.y);
      base.setVisible(true);
      knob.setVisible(true);
      ghost.setVisible(false);
      UIScene.haptic(10);
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
        base.setVisible(false);
        knob.setVisible(false);
        ghost.setVisible(true);
        this.syncTouchInput();
      }
    });
  }

  updateJoystick(pointer) {
    if (!this.joyBase) return;
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

    // Normalize to -1..1 range with dead zone
    const normX = nx / maxDist;
    const normY = ny / maxDist;
    this.touchMoveX = Math.abs(normX) > JOYSTICK_DEAD_ZONE ? normX : 0;
    this.touchMoveY = Math.abs(normY) > JOYSTICK_DEAD_ZONE ? normY : 0;

    this.syncTouchInput();
  }

  createActionButtons(screenW, safeBottom, safeRight) {
    // DPI-aware scaling for consistent physical button sizes across devices
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const btnRadius = Math.min(32, screenW * 0.06) * Math.max(1, dpr * 0.4);
    const pad = btnRadius * 0.7;

    // Position buttons on the right side with safe area padding
    const rightX = screenW - btnRadius - safeRight - 10;
    const bottomY = safeBottom - btnRadius - 10;

    // Attack button (bottom-right, largest)
    this.createTouchButton(rightX, bottomY, btnRadius, '⚔️', 0xff4444, () => {
      this.emitTouchAction('attack');
    });

    // Interact button (above attack)
    this.createTouchButton(rightX, bottomY - btnRadius * 2 - pad, btnRadius * 0.8, 'E', 0x44aaff, () => {
      this.emitTouchAction('interact');
    });

    // Inventory button (left of attack)
    this.createTouchButton(rightX - btnRadius * 2 - pad, bottomY, btnRadius * 0.8, 'I', 0xffaa44, () => {
      this.showInventory = !this.showInventory;
      this.refreshHUD();
    });

    // Potion button (above interact)
    this.createTouchButton(rightX - btnRadius * 2 - pad, bottomY - btnRadius * 2 - pad, btnRadius * 0.8, '🧪', 0x44ff88, () => {
      this.emitTouchAction('potion');
    });
  }

  createTouchButton(x, y, radius, label, color, callback) {
    const bg = this.add.circle(x, y, radius, color, 0.3);
    bg.setStrokeStyle(2, color, 0.6);
    this.touchContainer.add(bg);

    const text = this.add.text(x, y, label, {
      fontSize: `${Math.max(14, radius * 0.7)}px`,
      fill: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.touchContainer.add(text);

    // Make interactive with a slightly larger hit area for easier tapping
    const hitRadius = radius * 1.15;
    bg.setInteractive(new Phaser.Geom.Circle(0, 0, hitRadius), Phaser.Geom.Circle.Contains);
    bg.on('pointerdown', () => {
      bg.setAlpha(0.8);
      bg.setScale(0.92);
      text.setScale(0.92);
      UIScene.haptic(12);
      callback();
    });
    bg.on('pointerup', () => {
      bg.setAlpha(1);
      bg.setScale(1);
      text.setScale(1);
    });
    bg.on('pointerout', () => {
      bg.setAlpha(1);
      bg.setScale(1);
      text.setScale(1);
    });
  }

  emitTouchAction(action) {
    if (action === 'attack') {
      const player = this.getActivePlayer();
      if (player && player.active) {
        UIScene.haptic(20);
        player.tryAttack();
      }
    } else if (action === 'interact') {
      const dungeonScene = this.scene.get('DungeonScene');
      if (dungeonScene && dungeonScene.scene.isActive()) {
        dungeonScene.handleTouchInteract();
      } else {
        const townScene = this.scene.get('TownScene');
        if (townScene && townScene.scene.isActive()) {
          townScene.handleTouchInteract();
        }
      }
    } else if (action === 'potion') {
      const dungeonScene = this.scene.get('DungeonScene');
      if (dungeonScene && dungeonScene.scene.isActive() && dungeonScene._usePotion) {
        dungeonScene._usePotion();
      }
    }
  }

  /** Set up swipe gesture on right side of screen for quick directional attacks */
  _setupSwipeGesture() {
    this.input.on('pointerdown', (pointer) => {
      // Only track swipes on the right 40% of the screen
      // and ignore pointers already claimed by the joystick
      if (pointer.id === this.joystickPointerId) return;
      if (pointer.x < this.scale.width * 0.6) return;
      this._swipeStart = { x: pointer.x, y: pointer.y, time: pointer.downTime, id: pointer.id };
    });

    this.input.on('pointerup', (pointer) => {
      if (!this._swipeStart || pointer.id !== this._swipeStart.id) return;
      const dx = pointer.x - this._swipeStart.x;
      const dy = pointer.y - this._swipeStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const elapsed = pointer.upTime - this._swipeStart.time;
      this._swipeStart = null;

      if (dist >= SWIPE_THRESHOLD && elapsed <= SWIPE_MAX_TIME) {
        // Determine swipe direction and face player that way before attacking
        const player = this.getActivePlayer();
        if (player && player.active) {
          const dir = getDirection(dx, dy);
          if (dir) player.facing = dir;
          UIScene.haptic(25);
          player.tryAttack();
        }
      }
    });
  }

  createHUD() {
    // Clear existing
    if (this.uiContainer) this.uiContainer.destroy();

    this.uiContainer = this.add.container(0, 0);
    this.uiContainer.setDepth(200);

    const { width, height } = this.scale;
    const pad = 8;
    const safeTop = Math.max(pad, this.safeArea.top);
    const safeRight = this.safeArea.right;
    const barWidth = Math.min(160, width * 0.25);
    const barHeight = 12;
    const fontSize = '11px';
    const smallFont = '9px';

    // ---- Top-Right: Stats Panel (offset by safe area for notch/Dynamic Island) ----
    const panelX = width - barWidth - pad * 2 - safeRight;
    const panelY = safeTop;

    // Background panel
    const panelBg = this.add.rectangle(
      panelX - pad, panelY - pad / 2,
      barWidth + pad * 3, 125,
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
      `Lv: ${this.stats.level}  ATK: ${this.stats.attack}  DEF: ${this.stats.defense}`, {
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

    const equipY = goldY + 14;
    const weaponName = this.stats.equipment.weapon ? this.stats.equipment.weapon.name : 'None';
    const armorName = this.stats.equipment.armor ? this.stats.equipment.armor.name : 'None';
    this.equipText = this.add.text(panelX, equipY,
      `⚔${weaponName}  🛡${armorName}`, {
        fontSize: '8px', fill: '#aaccff', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 1,
      });
    this.uiContainer.add(this.equipText);

    const potionY = equipY + 12;
    const potionCount = (this.stats.inventory || [])
      .filter(i => ITEM_DATA[i.itemId] && ITEM_DATA[i.itemId].type === 'consumable')
      .reduce((sum, i) => sum + i.quantity, 0);
    if (potionCount > 0) {
      this.potionText = this.add.text(panelX, potionY,
        `🧪 Potions: ${potionCount} (Q)`, {
          fontSize: '8px', fill: '#44ff88', fontFamily: 'monospace',
          stroke: '#000000', strokeThickness: 1,
        });
      this.uiContainer.add(this.potionText);
    }

    // ---- Bottom: Controls hint ----
    const controlsY = height - Math.max(20, this.safeArea.bottom + 8);
    const controlsText = this.isTouchDevice
      ? ''
      : 'WASD: Move | SPACE: Attack | E: Interact | Q: Potion | I: Inventory';
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
    const barX = 10 + this.safeArea.left;
    // Move item bar higher on touch devices to avoid overlapping with joystick
    const safeBottom = Math.max(20, this.safeArea.bottom + 10);
    const barY = this.isTouchDevice ? height - 160 - safeBottom : height - 56;

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
    const panelW = Math.min(280, width * 0.45);
    const panelH = Math.min(320, height * 0.55);
    const panelX = width / 2 - panelW / 2;
    const panelY = height / 2 - panelH / 2;

    // Tap-outside-to-close overlay (covers entire screen behind the panel)
    if (this.isTouchDevice) {
      const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.3)
        .setOrigin(0, 0).setInteractive();
      overlay.on('pointerdown', () => {
        this.showInventory = false;
        this.refreshHUD();
      });
      this.uiContainer.add(overlay);
    }

    const bg = this.add.rectangle(panelX, panelY, panelW, panelH, 0x1a1a2e, 0.95).setOrigin(0, 0);
    const border = this.add.rectangle(panelX, panelY, panelW, panelH).setOrigin(0, 0);
    border.setStrokeStyle(2, 0x4a4a6e);
    this.uiContainer.add([bg, border]);

    // Prevent taps on the panel from closing it
    bg.setInteractive();

    const title = this.add.text(panelX + panelW / 2, panelY + 12, '📦 Inventory', {
      fontSize: '12px', fill: '#ffffff', fontFamily: 'monospace',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);
    this.uiContainer.add(title);

    // Close button (top-right corner of panel) for touch devices
    if (this.isTouchDevice) {
      const closeBtn = this.add.text(panelX + panelW - 10, panelY + 6, '✕', {
        fontSize: '14px', fill: '#ff6666', fontFamily: 'monospace',
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
      }).setOrigin(1, 0).setInteractive();
      closeBtn.on('pointerdown', () => {
        this.showInventory = false;
        this.refreshHUD();
      });
      this.uiContainer.add(closeBtn);
    }

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

  showEquipmentPanel(inventory, equipmentSystem) {
    if (this._overlayPanel) this._destroyOverlayPanel();

    const { width, height } = this.scale;
    const panelW = Math.min(300, width * 0.5);
    const panelH = Math.min(360, height * 0.6);
    const panelX = width / 2 - panelW / 2;
    const panelY = height / 2 - panelH / 2;

    this._overlayPanel = this.add.container(0, 0).setDepth(500);

    // Dim overlay
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.5)
      .setOrigin(0, 0).setInteractive();
    overlay.on('pointerdown', () => this._destroyOverlayPanel());
    this._overlayPanel.add(overlay);

    // Panel background
    const bg = this.add.rectangle(panelX, panelY, panelW, panelH, 0x1a1a2e, 0.95).setOrigin(0, 0).setInteractive();
    const border = this.add.rectangle(panelX, panelY, panelW, panelH).setOrigin(0, 0);
    border.setStrokeStyle(2, 0xff6600);
    this._overlayPanel.add([bg, border]);

    // Title
    const title = this.add.text(panelX + panelW / 2, panelY + 12, '🔨 Blacksmith', {
      fontSize: '12px', fill: '#ff9944', fontFamily: 'monospace',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);
    this._overlayPanel.add(title);

    // Close button
    const closeBtn = this.add.text(panelX + panelW - 10, panelY + 6, '✕', {
      fontSize: '14px', fill: '#ff6666', fontFamily: 'monospace',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0).setInteractive();
    closeBtn.on('pointerdown', () => this._destroyOverlayPanel());
    this._overlayPanel.add(closeBtn);

    let yOffset = panelY + 32;

    // Current equipment
    const eqLabel = this.add.text(panelX + 10, yOffset, 'Equipped:', {
      fontSize: '10px', fill: '#aaaaaa', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 1,
    });
    this._overlayPanel.add(eqLabel);
    yOffset += 16;

    for (const slot of ['weapon', 'armor']) {
      const equipped = equipmentSystem.getEquipped(slot);
      const slotLabel = slot === 'weapon' ? '⚔ Weapon' : '🛡 Armor';
      const itemName = equipped ? equipped.name : 'Empty';
      const color = equipped ? '#ffffff' : '#666666';

      const slotText = this.add.text(panelX + 14, yOffset, `${slotLabel}: ${itemName}`, {
        fontSize: '9px', fill: color, fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 1,
      });
      this._overlayPanel.add(slotText);

      if (equipped) {
        // Unequip button
        const unBtn = this.add.text(panelX + panelW - 14, yOffset, '[Unequip]', {
          fontSize: '8px', fill: '#ff6644', fontFamily: 'monospace',
          stroke: '#000000', strokeThickness: 1,
        }).setOrigin(1, 0).setInteractive();
        unBtn.on('pointerdown', () => {
          const removed = equipmentSystem.unequip(slot);
          if (removed) inventory.addItem(removed, 1);
          this.showEquipmentPanel(inventory, equipmentSystem);
          this.refreshHUD();
        });
        this._overlayPanel.add(unBtn);
      }
      yOffset += 16;
    }

    // Available equipment in inventory
    yOffset += 8;
    const availLabel = this.add.text(panelX + 10, yOffset, 'Available Equipment:', {
      fontSize: '10px', fill: '#aaaaaa', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 1,
    });
    this._overlayPanel.add(availLabel);
    yOffset += 16;

    const items = inventory.getItems();
    const equipItems = items.filter(i => {
      const data = ITEM_DATA[i.itemId];
      return data && (data.type === 'weapon' || data.type === 'armor');
    });

    if (equipItems.length === 0) {
      const noItems = this.add.text(panelX + 14, yOffset, 'No equipment in inventory', {
        fontSize: '9px', fill: '#666666', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 1,
      });
      this._overlayPanel.add(noItems);
    } else {
      for (const item of equipItems) {
        if (yOffset > panelY + panelH - 30) break;
        const data = ITEM_DATA[item.itemId];
        const statsStr = data.stats
          ? Object.entries(data.stats).map(([k, v]) => `+${v} ${k}`).join(' ')
          : '';

        const itemText = this.add.text(panelX + 14, yOffset, `${item.name} (${statsStr})`, {
          fontSize: '9px', fill: '#dddddd', fontFamily: 'monospace',
          stroke: '#000000', strokeThickness: 1,
        });
        this._overlayPanel.add(itemText);

        const equipBtn = this.add.text(panelX + panelW - 14, yOffset, '[Equip]', {
          fontSize: '8px', fill: '#44ff44', fontFamily: 'monospace',
          stroke: '#000000', strokeThickness: 1,
        }).setOrigin(1, 0).setInteractive();
        equipBtn.on('pointerdown', () => {
          // Remove from inventory
          inventory.removeItem(item.itemId, 1);
          // Equip (returns previously equipped item, if any)
          const prev = equipmentSystem.equip(item.itemId);
          if (prev) inventory.addItem(prev, 1);
          this.showEquipmentPanel(inventory, equipmentSystem);
          this.refreshHUD();
        });
        this._overlayPanel.add(equipBtn);

        yOffset += 16;
      }
    }
  }

  showCraftingPanel(inventory) {
    if (this._overlayPanel) this._destroyOverlayPanel();

    const { width, height } = this.scale;
    const panelW = Math.min(320, width * 0.55);
    const panelH = Math.min(400, height * 0.65);
    const panelX = width / 2 - panelW / 2;
    const panelY = height / 2 - panelH / 2;

    this._overlayPanel = this.add.container(0, 0).setDepth(500);

    // Dim overlay
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.5)
      .setOrigin(0, 0).setInteractive();
    overlay.on('pointerdown', () => this._destroyOverlayPanel());
    this._overlayPanel.add(overlay);

    // Panel
    const bg = this.add.rectangle(panelX, panelY, panelW, panelH, 0x1a1a2e, 0.95).setOrigin(0, 0).setInteractive();
    const border = this.add.rectangle(panelX, panelY, panelW, panelH).setOrigin(0, 0);
    border.setStrokeStyle(2, 0x66aaff);
    this._overlayPanel.add([bg, border]);

    // Title
    const title = this.add.text(panelX + panelW / 2, panelY + 12, '🔧 Crafting', {
      fontSize: '12px', fill: '#66aaff', fontFamily: 'monospace',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);
    this._overlayPanel.add(title);

    // Close button
    const closeBtn = this.add.text(panelX + panelW - 10, panelY + 6, '✕', {
      fontSize: '14px', fill: '#ff6666', fontFamily: 'monospace',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0).setInteractive();
    closeBtn.on('pointerdown', () => this._destroyOverlayPanel());
    this._overlayPanel.add(closeBtn);

    let yOffset = panelY + 32;

    // List recipes
    const recipeList = CraftingSystem.getAvailableRecipes(inventory);

    for (const { recipe, canCraft } of recipeList) {
      if (yOffset > panelY + panelH - 30) break;

      const resultData = ITEM_DATA[recipe.result.itemId];
      const nameColor = canCraft ? '#ffffff' : '#666666';

      // Recipe name
      const nameText = this.add.text(panelX + 14, yOffset, recipe.name, {
        fontSize: '10px', fill: nameColor, fontFamily: 'monospace',
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 1,
      });
      this._overlayPanel.add(nameText);

      // Craft button
      if (canCraft) {
        const craftBtn = this.add.text(panelX + panelW - 14, yOffset, '[Craft]', {
          fontSize: '9px', fill: '#44ff44', fontFamily: 'monospace',
          stroke: '#000000', strokeThickness: 1,
        }).setOrigin(1, 0).setInteractive();
        craftBtn.on('pointerdown', () => {
          CraftingSystem.craft(recipe, inventory);
          this.showCraftingPanel(inventory);
          this.refreshHUD();
        });
        this._overlayPanel.add(craftBtn);
      }

      yOffset += 14;

      // Ingredients
      const ingStr = recipe.ingredients.map(ing => {
        const ingData = ITEM_DATA[ing.itemId];
        const have = inventory.items[ing.itemId] || 0;
        const color = have >= ing.qty ? '#44ff44' : '#ff4444';
        return `${ingData ? ingData.name : ing.itemId}: ${have}/${ing.qty}`;
      }).join(', ');

      const ingText = this.add.text(panelX + 24, yOffset, ingStr, {
        fontSize: '8px', fill: '#aaaaaa', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 1,
      });
      this._overlayPanel.add(ingText);

      yOffset += 18;
    }
  }

  _destroyOverlayPanel() {
    if (this._overlayPanel) {
      this._overlayPanel.destroy();
      this._overlayPanel = null;
    }
  }

  refreshHUD() {
    this.createHUD();
  }
}
