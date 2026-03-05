# Covet Nothing

A Pixel Fantasy-style Roguelike RPG Dungeon Crawler built with Phaser 3.

## 🎮 How to Play

### Controls
| Key | Action |
|-----|--------|
| **WASD** / Arrow Keys | Move (8-directional) |
| **SPACE** / Click | Attack |
| **E** | Interact (NPCs, dungeon entrance, stairs) |
| **I** | Toggle inventory |

### Game Loop
1. **Town** – Your safe haven. Heal up, sell loot at the **Shop**, and prepare for the dungeon.
2. **Dungeon** – Procedurally generated floors filled with enemies. Fight through rooms, collect loot, and find the stairs to descend deeper.
3. **Progression** – Gain EXP and gold from kills, level up to increase HP and ATK, sell loot for gold.

### Enemies
| Enemy | HP | ATK | Gold | EXP | Drops |
|-------|-----|-----|------|-----|-------|
| Weeping Widow | 40 | 8 | 5-10 | 20 | Bones (100%) |
| Temple Beetle | 25 | 5 | 1-5 | 10 | Temple Ash (50%), Polished Beetle Eye (20%) |

*Gold and EXP scale with dungeon floor depth.*

### Leveling
- Level 1 → 2: 100 EXP
- EXP curve: `100 × level^1.5`
- Each level: +20 HP, +3 ATK

## 🚀 Development

### Prerequisites
- Node.js 18+

### Quick Start
```bash
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

### Build for Production
```bash
npm run build
npm run preview
```

### Deploy to GitHub Pages
Push to `main` branch — the GitHub Actions workflow will automatically build and deploy.

## 📁 Project Structure
```
src/
├── main.js              # Game entry point & Phaser config
├── config.js            # Game balance constants & utilities
├── data/
│   ├── enemies.js       # Enemy definitions & drop tables
│   └── items.js         # Item definitions
├── entities/
│   ├── Player.js        # Player character
│   └── Enemy.js         # Enemy base class with AI
├── scenes/
│   ├── BootScene.js     # Asset loading
│   ├── TownScene.js     # Town safe zone
│   ├── DungeonScene.js  # Dungeon gameplay
│   └── UIScene.js       # HUD overlay
└── systems/
    ├── DungeonGenerator.js  # Procedural dungeon generation
    ├── LevelSystem.js       # EXP & leveling
    └── LootSystem.js        # Loot drops & inventory
public/assets/
├── sprites/             # Extracted character animations
└── items/               # Loot item icons
```