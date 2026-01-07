# 2048 Simulator

A web-based 2048 simulation platform for testing, comparing, and evolving game strategies. Discover optimal play patterns through user-defined rules and machine-learned approaches.

## Features

### ✅ Completed (Phase 1 MVP)

- **Core Game Engine**
  - Standard 2048 rules implementation (4×4 grid)
  - Seeded RNG (Mulberry32) for deterministic gameplay
  - Move validation and game state management
  - Tile merging and spawning logic

- **Strategy System**
  - Directional Priority (prefer Left > Down > Right > Up)
  - Corner Anchoring (keep highest tile in bottom-left)
  - Merge Maximization (prioritize moves creating most merges)
  - Random baseline strategy

- **Interactive Game UI**
  - Beautiful game board with color-coded tiles
  - Keyboard controls (Arrow keys + WASD)
  - Real-time score and statistics
  - New game and reset functionality

- **Batch Simulation**
  - Web Worker for headless batch runs
  - Multiple seed modes (Random, Fixed, Shared)
  - Configurable batch sizes (1-10,000 games)
  - Strategy selection and parameter configuration

- **Storage & Data**
  - IndexedDB for persistent local storage
  - Game results tracking
  - Batch management
  - Strategy statistics

- **UI Components**
  - Game replay with playback controls
  - Batch results grid with sorting and pagination
  - Progress indicators
  - Configuration panel

## Project Structure

```
2048/
├── src/
│   ├── engine/
│   │   ├── rng.ts              # Seeded random number generator
│   │   ├── gameEngine.ts       # Core 2048 game logic
│   │   ├── strategy.ts         # Strategy implementations
│   │   └── types.ts            # TypeScript type definitions
│   ├── storage/
│   │   └── db.ts               # IndexedDB storage layer
│   ├── workers/
│   │   └── simulationWorker.ts # Web Worker for batch sims
│   ├── store/
│   │   └── gameStore.ts        # Zustand state management
│   ├── components/
│   │   ├── GameBoard.tsx       # 4×4 game board display
│   │   ├── GameStats.tsx       # Score and stats display
│   │   ├── GameReplay.tsx      # Replay viewer with controls
│   │   ├── BatchResultsGrid.tsx # Grid view of game results
│   │   ├── BatchConfigPanel.tsx # Batch configuration UI
│   │   └── ProgressIndicator.tsx # Progress bar component
│   ├── App.tsx                 # Main application
│   ├── main.tsx               # App entry point
│   └── index.css              # Global styles
├── public/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── ProjectOverview.md         # Full specification
```

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)

### Installation

1. **Fix npm cache permissions** (if needed):
   ```bash
   sudo chown -R $(id -u):$(id -g) "$HOME/.npm"
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Open in browser**:
   Navigate to `http://localhost:5173`

### Build for Production

```bash
npm run build
npm run preview
```

## How to Use

### Playing Manually

1. Launch the app
2. Use arrow keys or WASD to move tiles
3. Try to reach the 2048 tile
4. Click "New Game" to start fresh with a new seed
5. Click "Reset" to restart with the same seed

### Running Batch Simulations

1. Navigate to the Batch Simulation panel
2. Select a strategy (Directional Priority, Corner Anchor, etc.)
3. Configure strategy parameters (e.g., corner position)
4. Set the number of games (1-10,000)
5. Choose seed mode:
   - **Random**: Each game gets a unique seed
   - **Fixed**: All games use the same seed
   - **Shared**: Generate seeds for head-to-head comparison
6. Click "Start Batch Simulation"
7. View results in the grid
8. Click any game to replay it

### Viewing Game Replays

1. Click on any game result card
2. Use playback controls:
   - Play/Pause
   - Step forward/backward
   - Speed control (0.5x - 5x)
   - Timeline slider for jumping to specific moves
3. Watch the game unfold move-by-move

## Technical Details

### Seeded RNG

The simulator uses the Mulberry32 algorithm for deterministic random number generation. This ensures:
- Same seed + same moves = identical game
- Reproducible results for testing and comparison
- Seeds are 8-character alphanumeric strings (e.g., "A7X9K2M1")

### Game Engine

The engine implements standard 2048 rules:
- Tiles slide in chosen direction
- Matching tiles merge (2+2→4, 4+4→8, etc.)
- New tile spawns after each move (90% "2", 10% "4")
- Game ends when no valid moves remain
- Win condition: Create a 2048 tile

### Strategies

**Directional Priority**: Always tries moves in a fixed order (default: Left > Down > Right > Up)

**Corner Anchor**: Keeps the highest tile in a specific corner, avoiding moves that would disturb it

**Merge Maximization**: Analyzes the board and prioritizes moves that create the most merges

**Random**: Baseline strategy that picks random valid moves

## Roadmap

### Phase 2 (Future)
- Strategy builder UI (drag-and-drop rule configuration)
- Heatmap visualizations (tile position frequency)
- Side-by-side sync replay for strategy comparison
- Export to JSON/CSV
- Analytics dashboard with charts
- Seed library (save challenging seeds)

### Phase 3 (Future)
- ML-based strategy evolution
- Strategy sharing/importing
- Leaderboard
- Challenge mode (beat the engine)

## Technologies

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Build Tool**: Vite
- **Storage**: IndexedDB (browser-local)
- **Concurrency**: Web Workers

## Contributing

This is a personal project. Feel free to fork and experiment!

## License

MIT
