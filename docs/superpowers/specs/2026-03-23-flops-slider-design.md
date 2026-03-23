# FLOPS Allocation Slider — Design Spec

## Overview

A slider that splits the player's total FLOPS between two competing demands: **execution** (running LoC for cash) and **AI generation** (writing new LoC via owned AI models). This is the primary late-game interaction — the keyboard equivalent for Tier 4+.

## Unlock Condition

The slider appears when the player purchases their first AI model (Tier 4 / AI Lab). Before that, 100% of FLOPS go to execution implicitly — no slider is rendered.

## Slider Behavior

- **Range:** 0% to 100%, fully continuous (no step snapping)
- **Default:** 70% execution / 30% AI generation (configured in `specs/data/balance.json` → `flopsAllocation.defaultSplit`)
- **Semantics:** `flopSlider = 0.7` means 70% of total FLOPS go to execution, 30% to AI generation
- **Persistence:** `flopSlider` value persists in the Zustand game store (localStorage)

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

**Generation cadence:** AI produces blocks at a fixed interval. Each tick, an accumulator tracks fractional LoC produced (`effectiveAiLoc * dt`). When the accumulator reaches a block-size threshold, a block is created and pushed onto the block queue. The block is indistinguishable from a typed block.

### Execution

Execution FLOPS consume blocks from the queue exactly as they do today, just operating on the `executionFlops` pool instead of the full `totalFlops`.

## State Changes

### New state fields (game store)

| Field | Type | Default | Persisted | Description |
|-------|------|---------|-----------|-------------|
| `flopSlider` | `number` | `0.7` | Yes | Execution share (0–1) |

### Derived values (computed each tick)

| Value | Computation | Description |
|-------|-------------|-------------|
| `aiUnlocked` | `Object.values(ownedModels).some(v => v > 0)` or equivalent check on owned AI model count | Whether slider is visible |
| `executionFlops` | `flops * flopSlider` | FLOPS available for running LoC |
| `aiGenerationFlops` | `flops * (1 - flopSlider)` | FLOPS available for AI writing |
| `effectiveAiLocPerSec` | `totalAiLoc * min(1, aiGenerationFlops / totalAiFlops)` | Actual AI LoC/s after FLOPS cap |
| `executionLocPerSec` | `executionFlops * executionRate` | LoC/s execution throughput |

`executionRate` comes from `balance.json` → `flopsAllocation.executionRate` (currently `1.0`).

`aiGenerationEfficiency` from `balance.json` is **not used** — model `locPerSec` values already account for efficiency.

## UI Specification

### Placement

Compact horizontal bar between the resource bar and tier progress in the sidebar. Only renders when `aiUnlocked` is true.

### Layout

```
┌─────────────────────────────────────┐
│ Exec 70%        FLOPS Split    AI 30% │
│ ●━━━━━━━━━━━━━━━━━━━━━━━○──────────── │
│ 35K loc/s exec          9K loc/s gen │
└─────────────────────────────────────┘
```

- **Top row:** "Exec {X}%" left-aligned, "AI {Y}%" right-aligned
- **Middle:** Horizontal slider track with draggable thumb. Track fill uses a gradient from execution color (#3fb950 green) to AI color (#c678dd purple)
- **Bottom row:** Computed throughput rates — execution loc/s on the left, AI generation loc/s on the right. Uses subdued color (#484e58)

### Interaction

- Drag the thumb to adjust the split
- Values update in real-time as the thumb moves (no debounce — continuous)
- Slider is always interactive once visible (no disabled state)

### Styling

Follows existing sidebar conventions:
- Background: slightly darker than sidebar (`#131820` or similar)
- Border: `1px solid #1e2630` bottom
- Padding: `10px 12px`
- Font sizes: 9px for labels, 8px for rates
- Colors: green (#3fb950) for execution, purple (#c678dd) for AI generation, matching the existing FLOPS purple in the resource bar

## Game Loop Integration

In `use-game-loop.ts`, the tick function needs to:

1. Compute `executionFlops` and `aiGenerationFlops` from the slider split
2. Run AI generation: accumulate `effectiveAiLoc * dt`, create blocks when threshold is reached
3. Run execution: consume blocks from queue using `executionFlops` (instead of raw `flops`)

Steps 2 and 3 replace the current single execution path that uses all FLOPS.

## Balance Simulation Alignment

The balance sim (`src/utils/balance-sim.ts`) already implements this logic with `sim.flopSlider` and three AI strategies (exec_heavy: 0.7, ai_heavy: 0.3, balanced: 0.5). The game store implementation should match the sim's math to keep balance validation accurate.

## Files to Modify

| File | Change |
|------|--------|
| `src/modules/game/types.ts` | Add `flopSlider` to `GameState` |
| `src/modules/game/store/game-store.ts` | Add `flopSlider` state, `setFlopSlider` action, wire into recalculation |
| `src/modules/game/hooks/use-game-loop.ts` | Split FLOPS pools, add AI block generation, use `executionFlops` for queue consumption |
| `src/components/resource-bar.tsx` | No changes (keeps showing total FLOPS) |
| `src/components/sidebar.tsx` | Import and render `<FlopsSlider />` between `<ResourceBar />` and `<TierProgress />` |
| New: `src/components/flops-slider.tsx` | Slider component (~80 lines) |

## Out of Scope

- Bottleneck warning indicator (player reads the rates)
- Agent orchestration / model pipelines
- Quality degradation from AI-generated code
- Prestige system
- FLOPS allocation tech tree nodes
