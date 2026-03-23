# FLOPS Allocation Slider — Design Spec

## Overview

A slider that splits the player's total FLOPS between two competing demands: **execution** (running LoC for cash) and **AI generation** (writing new LoC via owned AI models). This is the primary late-game interaction — the keyboard equivalent for Tier 4+.

## Prerequisite: AI Model Ownership

The game store does **not** currently track owned AI models — that only exists in the balance sim. This feature requires adding `ownedModels: Record<string, boolean>` to `GameState` and a `buyModel` action. AI model purchasing via the tech tree or upgrade shop is a prerequisite but is **not designed here** — this spec assumes `ownedModels` exists and is populated by whatever purchasing mechanism is built.

For implementation, we will add the `ownedModels` field and a stub `buyModel` action so the slider can be wired up and tested via God Mode.

## Unlock Condition

The slider appears when the player owns at least one AI model: `Object.values(state.ownedModels).some(Boolean)`. This corresponds to the `ai_lab` tier (tier index 4) in `balance.json` → `flopsAllocation.unlockTier`, but the actual trigger is model ownership, not tier index.

Before any model is owned, 100% of FLOPS go to execution implicitly — no slider is rendered.

## Slider Behavior

- **Range:** 0% to 100%, fully continuous (no step snapping)
- **Default:** 70% execution / 30% AI generation (configured in `specs/data/balance.json` → `flopsAllocation.defaultSplit`)
- **Semantics:** `flopSlider = 0.7` means 70% of total FLOPS go to execution, 30% to AI generation
- **Persistence:** `flopSlider` value persists in the Zustand game store (localStorage via `partialize`)
- **Clamping:** `setFlopSlider` clamps input to `[0, 1]` with `Math.min(1, Math.max(0, value))`

## FLOPS Pool Computation

```
executionFlops = totalFlops * flopSlider
aiGenerationFlops = totalFlops * (1 - flopSlider)
```

Both pools are recomputed each game loop tick whenever `flopSlider` or `totalFlops` changes. Event modifiers (e.g. `flopsMultiplier`, `flopsOverride`) apply to `totalFlops` before the split.

## AI Generation Mechanics

### LoC Production

Each owned AI model has:
- `locPerSec` — base LoC output per second
- `flopsCost` — FLOPS consumed per second to run at full capacity

Total AI demand and output:
```
totalAiLoc = sum(model.locPerSec for each owned model)
totalAiFlops = sum(model.flopsCost for each owned model)
```

AI output is capped by available FLOPS:
```
effectiveAiLoc = totalAiLoc * min(1, aiGenerationFlops / totalAiFlops)
```

If `totalAiFlops` is 0 (no models owned), AI generation produces nothing.

### Block Queue Integration

AI-generated LoC enters the existing block queue as discrete blocks — identical to typed blocks. AI does **not** bypass the queue or have a separate execution path.

**Generation cadence:** AI produces blocks at a fixed interval. Each tick, a non-persisted accumulator (`aiLocAccumulator`) tracks fractional LoC produced (`effectiveAiLoc * dt`). When the accumulator reaches the block-size threshold (10 LoC), a block is created and pushed onto the block queue.

**AI block content:** AI-generated `QueuedBlock` entries have `loc` set to the threshold (10) and `lines` populated with placeholder code strings (e.g. `"// AI-generated code"` repeated). The visual content is cosmetic — the editor already cycles through code themes. No distinction from typed blocks in the queue.

**When `running` is false:** AI generation **pauses** along with execution. Both sides of the FLOPS split stop when the player hits Stop. This matches the existing behavior where execution halts.

### Execution

The current game loop accumulates `s.flops * dt` into `executionProgress` and consumes one LoC from the front block per 1.0 of accumulated progress. The only change is replacing `s.flops` with `executionFlops` (`s.flops * s.flopSlider`) in this accumulation:

```
// Before (current):
let progress = s.running ? s.executionProgress + s.flops * dt : s.executionProgress;

// After:
const execFlops = s.flops * s.flopSlider;
let progress = s.running ? s.executionProgress + execFlops * dt : s.executionProgress;
```

The rest of the block consumption loop remains unchanged.

**Pre-AI behavior:** When no AI models are owned, `flopSlider` defaults to `0.7` but the slider is hidden. To avoid reducing execution throughput before the slider is visible, the tick should use `s.flops` directly (not `execFlops`) when `aiUnlocked` is false.

## State Changes

### New state fields (game store)

| Field | Type | Default | Persisted | Description |
|-------|------|---------|-----------|-------------|
| `flopSlider` | `number` | `0.7` | Yes | Execution share (0–1) |
| `ownedModels` | `Record<string, boolean>` | `{}` | Yes | AI models the player owns |
| `aiLocAccumulator` | `number` | `0` | No | Fractional AI LoC between ticks |

All three must be added to `initialState`. `flopSlider` and `ownedModels` must be added to the `partialize` config. `aiLocAccumulator` resets to 0 on load (not persisted). All three reset in the `reset` action.

### New actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `setFlopSlider` | `(value: number) => void` | Clamps to [0,1] and sets `flopSlider` |
| `buyModel` | `(modelId: string) => void` | Stub: sets `ownedModels[modelId] = true`. Purchasing logic TBD. |

### Derived values (computed in `recalcDerivedStats`)

| Value | Computation | Description |
|-------|-------------|-------------|
| `aiUnlocked` | `Object.values(state.ownedModels).some(Boolean)` | Whether slider is visible |

The per-tick values (`executionFlops`, `aiGenerationFlops`, `effectiveAiLocPerSec`) are computed inline in the tick function, not stored as state.

`aiGenerationEfficiency` from `balance.json` is **not used** — model `locPerSec` values already account for efficiency. Consider removing the field from `balance.json` in a future cleanup.

## UI Specification

### Placement

Compact horizontal bar between the resource bar and tier progress in the sidebar. Only renders when `aiUnlocked` is true. Lives in `src/components/flops-slider.tsx` (shared component layer, not a module — no cross-module import violations).

### Layout

```
┌─────────────────────────────────────┐
│ Exec 70%                     AI 30% │
│ ●━━━━━━━━━━━━━━━━━━━━━━━○────────── │
│ 35K loc/s exec        9K loc/s gen  │
└─────────────────────────────────────┘
```

- **Top row:** "Exec {X}%" left-aligned, "AI {Y}%" right-aligned
- **Middle:** Horizontal slider track with draggable thumb. Track fill uses a gradient from execution color (#3fb950 green) to AI color (#c678dd purple)
- **Bottom row:** Computed throughput rates — execution loc/s on the left, AI generation loc/s on the right. Uses subdued color (#484e58)

### Interaction

- Drag the thumb to adjust the split
- Values update in real-time as the thumb moves (no debounce — continuous)
- Slider is always interactive once visible (no disabled state)
- Can use a native `<input type="range">` styled with Emotion, or a custom drag implementation

### Styling

Follows existing sidebar conventions:
- Background: slightly darker than sidebar (`#131820` or similar)
- Border: `1px solid #1e2630` bottom
- Padding: `10px 12px`
- Font sizes: 9px for labels, 8px for rates
- Colors: green (#3fb950) for execution, purple (#c678dd) for AI generation, matching the existing FLOPS purple in the resource bar

## Game Loop Integration

In the `tick` function of `game-store.ts`:

1. Check `aiUnlocked` — if false, use `s.flops` for execution as before (skip steps 2-3)
2. Compute `executionFlops = s.flops * s.flopSlider` and `aiGenerationFlops = s.flops * (1 - s.flopSlider)`
3. Run AI generation (only when `s.running`):
   - Sum `totalAiLoc` and `totalAiFlops` from owned models in `specs/data/ai-models.json`
   - Compute `effectiveAiLoc = totalAiLoc * Math.min(1, aiGenerationFlops / totalAiFlops)`
   - Accumulate: `aiLocAccumulator += effectiveAiLoc * dt`
   - While `aiLocAccumulator >= 10`: dequeue a block (10 LoC, placeholder lines), subtract 10 from accumulator
4. Run execution: replace `s.flops` with `executionFlops` in the progress accumulation line

### Numeric Example

Player owns Copilot (1500 loc/s, 500 FLOPS cost) and Claude Haiku (800 loc/s, 400 FLOPS cost). Total FLOPS: 2000. Slider at 70%.

- `executionFlops = 2000 * 0.7 = 1400`
- `aiGenerationFlops = 2000 * 0.3 = 600`
- `totalAiLoc = 1500 + 800 = 2300`
- `totalAiFlops = 500 + 400 = 900`
- `effectiveAiLoc = 2300 * min(1, 600/900) = 2300 * 0.667 = 1533 loc/s`
- At 60fps: each tick produces `1533 * 0.0167 = 25.6 LoC` → ~2.5 blocks/tick

## Balance Simulation Alignment

The balance sim (`src/utils/balance-sim.ts`) already implements this logic with `sim.flopSlider` and three AI strategies (exec_heavy: 0.7, ai_heavy: 0.3, balanced: 0.5). The game store implementation should match the sim's math. **No changes needed to the balance sim** — it already models the correct behavior.

## God Mode

Add `flopSlider` to God Mode overrides so it can be tested without purchasing AI models. Also add a "Grant AI Model" button that calls `buyModel` with a model ID for quick testing.

## Files to Modify

| File | Change |
|------|--------|
| `src/modules/game/types.ts` | Add `flopSlider`, `ownedModels`, `aiLocAccumulator`, `aiUnlocked` to `GameState`. Add `setFlopSlider`, `buyModel` actions. |
| `src/modules/game/store/game-store.ts` | Add fields to `initialState`, implement actions, update `partialize` (add `flopSlider` + `ownedModels`), update `reset`, add AI generation + split execution to `tick`, compute `aiUnlocked` in `recalcDerivedStats` |
| `src/components/sidebar.tsx` | Import and render `<FlopsSlider />` between `<ResourceBar />` and `<TierProgress />` |
| New: `src/components/flops-slider.tsx` | Slider component (~80 lines) |
| `src/components/god-mode-page.tsx` | Add flopSlider override and "Grant AI Model" button |
| `src/utils/balance-sim.ts` | No changes needed |

## Out of Scope

- AI model purchasing UI/flow (only stub `buyModel` action)
- Bottleneck warning indicator (player reads the rates)
- Agent orchestration / model pipelines
- Quality degradation from AI-generated code
- Prestige system
- FLOPS allocation tech tree nodes
