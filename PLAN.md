# Enhanced Rule Builder - Implementation Plan

## Overview

Replace the current strategy dropdown with a rich **Rule Builder** experience. Users can create custom move-priority rule sets via three input modes:

1. **Drag & Drop** - Visual reordering of directional priorities with conditional fallbacks
2. **Arrow Keys** - Quick keyboard-driven rule sequence entry
3. **LLM Natural Language** - Describe a strategy in plain English, get a structured rule set generated

All three modes produce the same underlying **RuleSet** data structure, which a new `CustomRuleStrategy` executes during simulation.

---

## Phase 1: Rule Set Data Model & Execution Engine

### New types (`src/engine/types.ts`)

```ts
type Direction = 'up' | 'down' | 'left' | 'right';

// A single rule: "try this direction when condition is met"
interface Rule {
  id: string;
  direction: Direction;
  condition: RuleCondition; // when to apply this rule
  priority: number;        // lower = higher priority
}

// Conditions that gate when a rule fires
type RuleCondition =
  | { type: 'always' }                                    // unconditional
  | { type: 'fallback'; whenUnavailable: Direction[] }    // only when listed dirs invalid
  | { type: 'board'; check: BoardCheck }                  // board-state conditional

type BoardCheck =
  | { type: 'highest_tile_in'; positions: [number,number][] }  // e.g. corner
  | { type: 'merge_available'; direction: Direction }           // mergeable tiles exist
  | { type: 'empty_cells_above'; threshold: number }           // open space check
  | { type: 'empty_cells_below'; threshold: number }           // board getting full

interface RuleSet {
  id: string;
  name: string;
  description?: string;
  rules: Rule[];
  fallbackDirection?: Direction; // last resort if no rule fires
  source: 'manual' | 'arrow_keys' | 'llm';
}
```

### New strategy (`src/engine/strategy.ts`)

- `CustomRuleStrategy` implements `Strategy`
- Accepts a `RuleSet` and evaluates rules top-to-bottom by priority
- For each rule: check condition → if true and direction is valid → select it
- If no rule fires, use `fallbackDirection` or first valid move

### Files changed
- `src/engine/types.ts` - Add RuleSet, Rule, RuleCondition types
- `src/engine/strategy.ts` - Add CustomRuleStrategy class + register in factory
- `src/workers/simulationWorker.ts` - Support serialized RuleSet in job params

---

## Phase 2: Drag & Drop Rule Builder UI

### New component: `src/components/RuleBuilder.tsx`

**Layout:**
- Left panel: **Available Directions** - four direction cards (Up/Down/Left/Right) with arrow icons
- Right panel: **Rule Sequence** - drop zone where user builds their ordered priority list
- Each dropped card can be expanded to add conditions (click to toggle condition picker)

**Drag & Drop behavior:**
- Drag direction cards from the palette into the rule list
- Reorder rules by dragging within the list
- A direction can appear multiple times (e.g. "Left" as primary, "Left" again as fallback with condition)
- Swipe/click to remove a rule from the list
- Smooth animations on reorder

**Condition picker (per-rule):**
- Collapsible section under each rule card
- "Always" (default) - no condition
- "Only when [direction] unavailable" - dropdown to pick which direction(s)
- "When board is crowded" / "When board is open" - threshold slider
- "When merge available in this direction" - auto-detected

**Visual design:**
- Direction cards use arrow icons (←↓→↑) with colored backgrounds
- Drop zone has dashed border placeholder when empty
- Active drag shows ghost + insertion indicator
- Cards have grab handle on left edge

**Implementation approach:**
- Use native HTML5 drag-and-drop API (no extra deps)
- Touch support via pointer events for mobile
- State managed locally, emits `RuleSet` on change

### Files changed/created
- `src/components/RuleBuilder.tsx` - New: main drag-and-drop builder
- `src/components/RuleCard.tsx` - New: individual draggable rule card with condition picker
- `src/components/DirectionPalette.tsx` - New: source palette of four directions
- `src/index.css` - Drag-and-drop animations, card styles

---

## Phase 3: Arrow Key Input Mode

### Enhancement to RuleBuilder

**UX flow:**
- Toggle button at top of Rule Builder: "Drag & Drop" | "Arrow Keys" | "LLM"
- In Arrow Keys mode, show a focused input area with prompt: "Press arrow keys in priority order..."
- As user presses ←↓→↑, direction cards animate into the rule list sequentially
- Backspace removes last entry
- Enter confirms the sequence
- Visual feedback: large arrow icon pulses on each keypress
- The sequence maps to a simple `RuleSet` with `condition: { type: 'always' }` and sequential priorities

**This is the fastest way to build a simple directional priority** - just tap ← ↓ → ↑ and you're done.

### Files changed
- `src/components/RuleBuilder.tsx` - Add arrow-key input mode tab
- `src/components/ArrowKeyInput.tsx` - New: keyboard capture + visual sequence display

---

## Phase 4: LLM Natural Language → Rule Set

### New component: `src/components/LLMRuleGenerator.tsx`

**UX flow:**
1. Text area with placeholder: *"Describe your strategy... e.g. 'Prioritize left and down. Only go right when left isn't available. Keep the highest tile in the bottom-left corner.'"*
2. "Generate Rule Set" button
3. Loading state with animation while LLM processes
4. Generated RuleSet appears in the drag-and-drop builder (editable!)
5. User can tweak the generated rules before running

### LLM integration: `src/engine/llmRuleParser.ts`

**Approach:**
- Call an LLM API (configurable endpoint) with a structured prompt
- System prompt defines the RuleSet JSON schema and available condition types
- User's natural language is passed as the user message
- LLM returns valid JSON matching the RuleSet schema
- Client-side validation ensures the response is well-formed
- Fallback: if parsing fails, show error and let user retry/edit

**Prompt engineering:**
```
You are a 2048 game strategy designer. Convert the user's natural language
strategy description into a structured RuleSet JSON.

Available directions: up, down, left, right
Available conditions:
- { type: "always" } - always try this direction
- { type: "fallback", whenUnavailable: ["left", "down"] } - only when listed directions are invalid
- { type: "board", check: { type: "highest_tile_in", positions: [[3,0]] } } - positional
- { type: "board", check: { type: "merge_available", direction: "left" } }
- { type: "board", check: { type: "empty_cells_above", threshold: 4 } }
- { type: "board", check: { type: "empty_cells_below", threshold: 4 } }

Return ONLY valid JSON matching the RuleSet schema. Rules are evaluated
top-to-bottom; first matching rule wins.
```

**API key handling:**
- User enters their API key in a settings panel (stored in localStorage, never sent to our servers)
- Support OpenAI-compatible endpoints (OpenAI, Anthropic, local models)
- Key is optional - drag & drop and arrow keys work without it

### Files changed/created
- `src/components/LLMRuleGenerator.tsx` - New: text input + generate button + loading state
- `src/engine/llmRuleParser.ts` - New: prompt construction, API call, response parsing/validation
- `src/components/SettingsPanel.tsx` - New: API key configuration

---

## Phase 5: Integration & UX Polish

### Batch Config integration

- Replace the strategy dropdown in `BatchConfigPanel.tsx` with two options:
  - **Preset Strategies** - existing dropdown (corner anchor, merge max, random)
  - **Custom Rule Set** - opens the Rule Builder
- Custom rule sets are saved to IndexedDB `strategies` store with `type: 'custom_rule'`
- Saved rule sets appear in a "My Rule Sets" list for quick reuse
- Rule sets can be named, duplicated, and deleted

### Tab restructure in `App.tsx`

- **Play** - manual play (unchanged)
- **Build** - the new Rule Builder (drag & drop / arrow keys / LLM) ← NEW TAB
- **Simulate** - batch config + run (uses selected preset or custom rule set)
- **Results** - unchanged

### Rule Set preview

- Compact visual summary of a RuleSet shown as a horizontal pill sequence:
  `← (always) → ↓ (when ← unavail) → → (when ↓ unavail) → ↑ (fallback)`
- Shown in batch config, results cards, and replay modal header

### Files changed
- `src/components/App.tsx` - Add Build tab, restructure navigation
- `src/components/BatchConfigPanel.tsx` - Add custom rule set selection
- `src/components/RuleSetPreview.tsx` - New: compact rule set visualization
- `src/store/gameStore.ts` - Add rule set state management
- `src/storage/db.ts` - Ensure strategies store handles RuleSet persistence

---

## Implementation Order

| Step | Phase | Description | Complexity |
|------|-------|-------------|------------|
| 1 | P1 | RuleSet types & CustomRuleStrategy engine | Medium |
| 2 | P2 | Drag & drop Rule Builder UI | High |
| 3 | P3 | Arrow key input mode | Low |
| 4 | P5 | Tab restructure + integration with batch sim | Medium |
| 5 | P4 | LLM natural language parser | Medium |
| 6 | P5 | Rule set persistence, preview, polish | Medium |

Steps 2 and 3 can be built in parallel. Step 5 (LLM) is independent of the UI work and can be parallelized with step 4.

---

## Dependencies

- **No new npm packages required** for drag & drop (HTML5 native API)
- **LLM integration** requires fetch to an external API (user-provided key)
- All existing functionality remains intact - this is purely additive
