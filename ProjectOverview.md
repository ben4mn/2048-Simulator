# 2048 Simulator - Product Specification

## Overview

A web-based 2048 simulation platform for testing, comparing, and evolving game strategies. Discover optimal play patterns through user-defined rules and machine-learned approaches.

-----

## Game Engine

### Standard 2048 Rules

- 4×4 grid
- Tiles slide in chosen direction (Up/Down/Left/Right)
- Matching tiles merge (2+2→4, 4+4→8, etc.)
- New tile spawns after each move (90% “2”, 10% “4”)
- Game ends when no valid moves remain
- Win condition: Create a 2048 tile (game can continue beyond)

### Seeded RNG

- Deterministic PRNG (mulberry32 or xoshiro128)
- Same seed + same moves = identical game
- Seed controls: initial spawns, spawn positions, 2-vs-4 probability
- Seed format: 8-character alphanumeric (e.g., “A7X9K2M1”)

### Strategy Types

|Category                 |Description                                   |
|-------------------------|----------------------------------------------|
|**Directional Priority** |Prefer Left > Down > Right > Up               |
|**Corner Anchoring**     |Keep highest tile in bottom-left corner       |
|**Monotonic Maintenance**|Maintain descending rows/columns toward anchor|
|**Merge Maximization**   |Prioritize moves creating most merges         |
|**Board Clearing**       |Prioritize moves freeing cells                |
|**Random**               |Pure random (baseline)                        |
|**Hybrid/Weighted**      |Combine above with configurable weights       |

-----

## Data Model

### Storage Format: TOON

Using Token-Oriented Object Notation for compact, efficient storage. TOON uses schema declarations with CSV-style rows for uniform data.

### Game Record

```toon
game:
  id: a1b2c3d4
  strategy_id: strat_001
  batch_id: batch_123
  seed: A7X9K2M1
  timestamp: 1732540800
  moves: LDLDLDRRUDLLDR...
  final_score: 28456
  max_tile: 2048
  move_count: 1847
  result: win
  duration_ms: 342
```

### Strategy Record

```toon
strategy:
  id: strat_001
  name: Bottom-Left Anchor
  source: user
  rules[4]{type,params}:
    corner_anchor,bottom-left
    directional_priority,L>D>R>U
    monotonic,descending-rows
    merge_max,0.3
  stats:
    games_played: 5000
    win_rate: 0.73
    avg_score: 24892
    avg_moves: 1654
    best_score: 89234
    min_moves_to_2048: 847
```

### Batch Record

```toon
batch:
  id: batch_123
  strategy_ids[2]: strat_001,strat_002
  game_count: 100
  status: complete
  seed_mode: shared
  seeds[100]: A7X9K2M1,B3C4D5E6,...
  created_at: 2024-01-15T10:00:00Z
  completed_at: 2024-01-15T10:05:32Z
  results[2]{strategy_id,wins,losses,avg_score,max_score,avg_moves,min_moves_to_win}:
    strat_001,73,27,24892,89234,1654,847
    strat_002,61,39,21456,76123,1432,912
  comparison:
    head_to_head[2]{strategy_id,seeds_won}:
      strat_001,67
      strat_002,33
```

### Seed Modes

|Mode      |Use Case                                          |
|----------|--------------------------------------------------|
|**Random**|Each game gets unique seed - maximum variance     |
|**Fixed** |Same seed repeated N times - test consistency     |
|**Shared**|All strategies play identical seeds - head-to-head|

-----

## Metrics

### Per-Game

- Final score
- Max tile achieved
- Total move count
- Win/loss result
- Move efficiency (score per move)

### Per-Strategy (Aggregated)

- Win rate
- Average/median/best score
- Minimum moves to reach 2048
- Survival rate at thresholds (500, 1000, 2000, 5000 moves)
- Tile position heatmaps

### Research Questions

1. Minimum moves required to reach 2048?
1. Maximum survival before randomness causes failure?
1. Which strategies best mitigate bad-spawn risk?
1. Do user strategies outperform discovered ones?

-----

## UI/UX

### Visual Style

Crisp, clean, minimal. Subtle depth with soft shadows. Warm color palette inspired by original 2048 (yellows/oranges for tiles). Engaging without clutter.

### Main Views

#### 1. Dashboard

- List of batch runs with summary stats
- Sort by: score, win rate, recency
- Click → Batch Detail

#### 2. Batch Detail

- Game board grid (toggle: 10 / 20 / 30 per page)
- Sort by: highest score, most moves, max tile
- Board cards show: final state, score, move count, status
- Click board → Game Replay

**Comparison Mode (multiple strategies):**

- Side-by-side boards sharing same seed
- Color-coded borders per strategy
- Winner indicator per seed
- Summary: “Strategy A won 67/100 seeds”
- Toggle: all games vs grouped-by-seed

#### 3. Game Replay

- Single large board
- Controls: Play/Pause, Step Forward/Back, Speed slider
- Move counter, score display
- Jump to specific move

#### 4. Strategy Builder

- Create/edit rule sets
- Drag-and-drop priority ordering
- Test with single game before batch

#### 5. Analytics (Phase 2)

- Tile position heatmaps
- Score distribution charts
- Strategy comparison tables

### Settings Panel

- Batch size (number of simulations)
- Strategy selector (multi-select for comparison)
- Seed mode: Random / Fixed / Shared
- Manual seed input (optional)
- Rule configuration

-----

## Technical Architecture

### Frontend

- React + TypeScript
- Tailwind CSS
- State: Zustand or Redux
- Charts: Recharts or D3

### Storage

- IndexedDB (browser-local, no server)
- TOON format via @toon-format/toon package
- Export to JSON/CSV (Phase 2)

### Simulation Engine

- Web Worker for headless batch runs
- Visual mode: ~100-500ms per move
- Headless: maximum speed
- Deterministic given seed

-----

## Scope

### Phase 1 (MVP)

- Working 2048 engine with seeded RNG
- Basic strategies (directional priority + corner anchor)
- Single game visual playback
- Batch runs (headless) with progress indicator
- Seed modes: random, fixed, shared
- Batch results grid (10/20/30 toggle, sort)
- Click-to-replay games
- TOON storage in IndexedDB
- Metrics: score, max tile, move count, win/loss
- Basic comparison: 2 strategies on shared seeds

### Phase 2

- Strategy builder UI
- Heatmap visualizations
- Engine-discovered strategy suggestions
- Export to JSON/CSV
- Side-by-side sync replay
- Analytics dashboard
- Seed library (save challenging seeds)

### Phase 3

- ML-based strategy evolution
- Strategy sharing/importing
- Leaderboard
- Challenge mode (beat the engine)

-----

## Defaults

- Corner preference: bottom-left
- Default strategy: Left > Down > Right > Up with bottom-left anchor