# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

2048 Simulator is a web-based platform for testing, comparing, and evolving 2048 game strategies. It features deterministic seeded gameplay, batch simulation capabilities, and strategy comparison tools.

## Development Commands

### Running the Application
```bash
npm run dev              # Start development server (http://localhost:5173)
npm run build            # Build for production (TypeScript + Vite)
npm run preview          # Preview production build
npm run lint             # Run ESLint
```

### Common Setup Issues
If you encounter npm permission errors:
```bash
sudo chown -R $(id -u):$(id -g) "$HOME/.npm"
```

## Architecture Overview

### Core Engine System (src/engine/)

**Deterministic Game Engine**: The `GameEngine` class (gameEngine.ts) implements standard 2048 rules with seeded RNG. Key principle: same seed + same moves = identical game outcome. The engine uses Mulberry32 algorithm for deterministic random number generation.

**State Immutability**: The engine internally mutates state but returns read-only copies via `getState()`. All board operations create new arrays to prevent external mutations.

**Move Processing Pipeline**: Moves are processed by transforming the board so all operations can be treated as "slide left", then transforming back. The `transformBoard()` method handles rotation/transposition for up/down/right moves.

### Strategy System (src/engine/strategy.ts)

Strategies implement the `Strategy` interface with a single method: `selectMove(engine: GameEngine): Direction | null`.

**Built-in Strategy Types**:
- `DirectionalPriorityStrategy`: Fixed move priority order (default: L > D > R > U)
- `CornerAnchorStrategy`: Keeps highest tile in specified corner with corner-safe moves
- `MergeMaxStrategy`: Counts potential merges for each direction, chooses maximum
- `RandomStrategy`: Baseline for comparison

**Custom Strategy Types** (added for user-defined rules):
- `PatternStrategy`: Cycles through a fixed sequence of moves
- `ConditionalStrategy`: Evaluates board conditions and applies rule-based actions
- `LookAheadStrategy`: Evaluates moves N steps ahead using board scoring heuristics
- `WeightedStrategy`: Scores each move based on weighted criteria (empty tiles, merges, monotonicity, etc.)
- `CustomStrategy`: Container that executes multiple sub-strategies in priority order

**Strategy Pattern**: All strategies receive the engine instance and query it using `isValidMove()` and `getState()`. They never mutate the engine directly.

### Custom Rule System (src/engine/customRules.ts)

The custom rule system allows users to define strategies through configuration rather than code:

**Rule Types**:
1. **Pattern Rules**: Define a fixed sequence like `['left', 'down', 'right', 'down']`
2. **Conditional Rules**: If-then logic based on board state (e.g., "if max tile in corner, prefer safe moves")
3. **Look-Ahead Rules**: Evaluate board positions N moves ahead with configurable evaluation weights
4. **Weighted Rules**: Score moves immediately based on criteria like empty cells, merge count, monotonicity

**Board Evaluation Functions** (BoardEvaluator class):
- `countEmptyTiles()`: Number of empty cells
- `getMaxTile()`: Location and value of highest tile
- `countMerges()`: Potential merges available
- `calculateMonotonicity()`: How well tiles are ordered ascending/descending
- `calculateSmoothness()`: Similarity of adjacent tiles
- `evaluateBoard()`: Combined score using weighted criteria

**Custom Strategy Factory** (src/engine/customStrategyFactory.ts):
Converts `CustomRule[]` configurations into executable `Strategy` instances. This allows rules defined in the UI to be passed to the simulation worker and executed identically to built-in strategies.

### Web Worker Architecture (src/workers/simulationWorker.ts)

Batch simulations run in a Web Worker to avoid blocking the UI thread. The worker:
1. Receives a `SimulationJob` with seeds and strategy configuration
2. Creates a fresh `GameEngine` instance per game
3. Runs games headless at maximum speed (no rendering)
4. Reports progress every 10 games via `postMessage()`
5. Aggregates all `GameResult` records for storage

**Worker Communication**: Main thread creates worker via `new URL('../workers/simulationWorker.ts', import.meta.url)` which Vite bundles as a separate chunk.

### State Management (src/store/gameStore.ts)

Uses Zustand for global state. The store manages:
- **Interactive Play**: Single `GameEngine` instance for manual play
- **Batch Execution**: Web Worker lifecycle, progress tracking, result aggregation
- **View State**: Current view mode (play/batch/results), selected game for replay

**Critical Pattern**: The store owns the worker instance and terminates it on completion or cancellation. Failed batches must update status in IndexedDB.

### Storage Layer (src/storage/db.ts)

IndexedDB provides persistent browser-local storage for:
- Game results with full move history (as compressed string: "LDLDRRU...")
- Batch metadata (strategy IDs, seeds, status)
- Strategy statistics (computed from game results)

**Data Flow**: Worker sends results → Store receives via `onmessage` → Store calls `db.saveGames()` → IndexedDB persists

### Type System (src/engine/types.ts)

**Key Types**:
- `Direction` and `DirectionShort`: Move representation (long form for API, short for storage)
- `GameState`: Complete game state including board, score, move history, game over status
- `GameResult`: Serializable game record for storage (includes seed, moves string, final metrics)
- `MoveResult`: Internal move processing result with `moved` flag and merge points

### Component Architecture

React components are organized by function:
- `GameBoard.tsx`: 4×4 grid renderer with tile animations
- `GameReplay.tsx`: Playback controls for viewing recorded games (Play/Pause, speed, timeline)
- `BatchConfigPanel.tsx`: Configuration UI for batch runs (strategy, seed mode, batch size)
- `BatchResultsGrid.tsx`: Results display with sorting, pagination, click-to-replay

**Replay Pattern**: `GameReplay` creates a new `GameEngine` instance with the saved seed, then programmatically calls `engine.move()` with the recorded move sequence.

## Key Design Decisions

### Why Seeded RNG?
Enables reproducible testing and fair strategy comparison. Same seed ensures both strategies face identical spawn patterns.

### Why Web Workers?
Running 10,000 games synchronously would freeze the browser. Workers enable parallel execution with progress updates.

### Why IndexedDB?
Allows storing thousands of game records locally without a server. Supports complex queries for analytics.

### Move String Storage
Moves stored as compressed strings ("LDLDRRU...") rather than arrays to minimize storage size. A typical game with 1500 moves = 1.5KB as string vs ~6KB as JSON array.

## Testing Strategy Implementations

When implementing new strategies:
1. Implement the `Strategy` interface
2. Add to `createStrategy()` factory function
3. Test with single game first: `playGameWithStrategy(seed, strategy)`
4. Run small batch (10-100 games) before large-scale testing
5. Compare against baseline `RandomStrategy` to validate improvement

## Custom Strategy Builder

### UI Components
- **CustomStrategyBuilder** (src/components/CustomStrategyBuilder.tsx): Main container with tabbed interface (Manual/AI)
- **ManualRuleBuilder** (src/components/ManualRuleBuilder.tsx): Form-based rule creation with dynamic inputs per rule type
- **AIStrategyAssistant** (src/components/AIStrategyAssistant.tsx): Natural language interface for AI-powered strategy generation

### AI Integration (src/services/aiStrategyGenerator.ts)
Converts natural language descriptions into rule configurations via OpenAI or Anthropic APIs:
- Supports both providers with unified interface
- API keys stored in sessionStorage (not persisted)
- Returns validated `CustomRule[]` arrays
- Handles markdown-wrapped JSON responses
- Includes comprehensive system prompt with rule type examples

### Data Flow for Custom Strategies
1. User creates rules in UI (manual or AI-generated)
2. Rules saved as `CustomRule[]` in BatchConfigPanel state (session only)
3. When starting batch: rules passed to SimulationJob
4. Worker uses `CustomStrategyFactory.createFromRules()` to build Strategy instance
5. Strategy executes identically to built-in strategies

## Common Development Patterns

### Adding a New Built-in Strategy Type
1. Create strategy class implementing `Strategy` interface in strategy.ts
2. Add case to `createStrategy()` factory
3. Update `BatchConfigPanel.tsx` to expose in UI
4. Add configuration parameters to UI if needed

### Adding a New Custom Rule Type
1. Define rule interface in customRules.ts
2. Add to `CustomRule` union type
3. Implement evaluation logic in BoardEvaluator or ConditionEvaluator
4. Add validation in RuleValidator
5. Update CustomStrategyFactory to handle new rule type
6. Add UI controls in ManualRuleBuilder
7. Update AI system prompt in aiStrategyGenerator.ts

### Debugging Game Behavior
Use fixed seeds for reproducibility:
```typescript
const engine = new GameEngine("A7X9K2M1");
// Game will be identical every time
```

### Analyzing Game Results
```typescript
const games = await db.getAllGames();
const wins = games.filter(g => g.result === 'win');
const avgScore = wins.reduce((sum, g) => sum + g.finalScore, 0) / wins.length;
```

### Testing Custom Strategies
1. Create rules in Custom Strategy Builder
2. Start with small batch (10-50 games) to test behavior
3. Compare results against baseline Random strategy
4. If using look-ahead with depth > 2, expect significantly slower simulation

## Technology Stack

- **Build Tool**: Vite (fast HMR, Web Worker bundling)
- **Framework**: React 18 with TypeScript
- **State**: Zustand (lightweight, no boilerplate)
- **Styling**: Tailwind CSS (utility-first)
- **Storage**: IndexedDB (native browser API)
- **Concurrency**: Web Workers (for batch simulation)

## Project Phases

Currently in **Phase 1 (MVP)** - core engine and batch simulation complete.

Future phases include:
- Phase 2: Visual strategy builder, heatmap analytics, CSV export
- Phase 3: ML-based strategy evolution, strategy sharing, leaderboards
