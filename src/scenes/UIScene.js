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

    // Create UI elements
    this.createHUD();

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
    });
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
    const controlsText = 'WASD: Move | SPACE: Attack | E: Interact | I: Inventory';
    this.controlsHint = this.add.text(width / 2, controlsY, controlsText, {
      fontSize: '9px', fill: '#888888', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 1,
    }).setOrigin(0.5);
    this.uiContainer.add(this.controlsHint);

    // ---- Inventory Panel (if open) ----
    if (this.showInventory) {
      this.createInventoryPanel(width, height);
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
