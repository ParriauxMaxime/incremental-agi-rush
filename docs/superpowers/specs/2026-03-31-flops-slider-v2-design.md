# FLOPS Slider v2 — Design Spec

Replaces the broken greedy FLOPS allocation with a player-controlled slider and an auto-arbitrage tech unlock. Supersedes the 2026-03-23 spec.

## Problem

AI models greedily consume all available FLOPS before execution gets any. With 5 models unlocked and 1.19M FLOPS, execution FLOPS = 0, cash freezes, and LoC piles up indefinitely.

## Core Mechanic: The FLOPS Split

A slider (0–1) divides total FLOPS into two pools:

```
execFlops = totalFlops * flopSlider
aiFlops   = totalFlops * (1 - flopSlider)
```

- **Execution pool** — consumes queued LoC, produces cash
- **AI generation pool** — powers AI models to produce LoC (models share pool greedily, highest locPerSec first)

Default: `flopSlider = 0.7` (70% exec / 30% AI). Pre-T4: slider hidden, all FLOPS go to execution (bypass split).

## Token Rebalance

Tokens stay as a gate but should rarely be the bottleneck. FLOPS slider is the real lever.

Reduce T4 model `tokenCost` by ~5–7x so that mid-T4 human output (~1M tokens/s from dev teams) comfortably covers 2–3 models. T5 models keep higher token costs to reintroduce token pressure at endgame.

| Model | Current tokenCost | New tokenCost |
|-------|-------------------|---------------|
| Copilot | 150 | 30 |
| Claude Haiku | 80 | 15 |
| Claude Sonnet | 500 | 80 |
| GPT-3 | 50 | 10 |
| GPT-3.5 | 150 | 25 |
| GPT-4 | 800 | 120 |
| GPT-4.1 | 1000 | 150 |
| Gemini Pro | 600 | 90 |
| Llama 70B | 300 | 50 |
| Llama 405B | 2500 | 400 |
| Mistral Large | 400 | 60 |
| Grok 2 | 1200 | 180 |

T5 models (Claude Opus, GPT-5, GPT-6, GPT-7, Gemini Ultra/Supreme, Grok 3, Claude Saga/Universe) keep current tokenCost values unchanged.

## Game Loop Changes (tick function)

Replace the current greedy allocation in the tick:

**Before (broken):**
```
remainingFlops = s.flops           // AI takes everything
for model: modelFlops = min(model.flopsCost, remainingFlops)
execFlops = max(0, s.flops - aiFlopsCost)  // usually 0
```

**After (with slider):**
```
execFlops = s.flops * s.flopSlider
aiFlops   = s.flops * (1 - s.flopSlider)

// AI models share aiFlops pool
remainingAiFlops = aiFlops
for model: modelFlops = min(model.flopsCost, remainingAiFlops)

// Execution uses its own dedicated pool
execCapacity = execFlops * dt
executed = min(execCapacity, loc)
```

Pre-T4 (`aiUnlocked === false`): skip the split, use `s.flops` directly for execution.

## Auto-Arbitrage (Tech Tree Unlock)

### Tech Node

- **id:** `auto_arbitrage`
- **icon:** `⚖️`
- **requires:** `gpu_farm`
- **cost:** $50M cash
- **max:** 1
- **effect:** `enable: autoArbitrage`

### Algorithm (runs every tick when enabled)

1. **Compute target slider** — match execution rate to AI production rate:
   ```
   aiLocRate = sum of active model effective locPerSec (accounting for token efficiency and flop ratios)
   targetExecFlops = aiLocRate  (1 FLOP = 1 LoC/s executed)
   targetSlider = targetExecFlops / totalFlops
   ```

2. **Queue pressure bias:**
   - If `queuedLoc > execFlops * 5` (5s backlog) → nudge target +0.05 toward exec
   - If `queuedLoc < execFlops * 1` (< 1s buffer) → nudge target -0.05 toward AI

3. **Smooth transition:** `flopSlider = lerp(current, target, 0.02)` per tick (~2% movement, visibly smooth)

4. **Clamp:** `[0.1, 0.95]` — never fully starve either side

### Player Override

Dragging the slider sets a flag `autoArbitrageOverride = true` and a timestamp. Auto-arbitrage resumes after 10 seconds of no slider interaction. The override flag is not persisted.

## State Changes

### New fields in GameState

| Field | Type | Default | Persisted |
|-------|------|---------|-----------|
| `flopSlider` | `number` | `0.7` | Yes |
| `autoArbitrageEnabled` | `boolean` | `false` | Yes |
| `autoArbitrageOverride` | `boolean` | `false` | No |
| `autoArbitrageOverrideAt` | `number` | `0` | No |

### New actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `setFlopSlider` | `(value: number) => void` | Clamps to [0,1], sets slider, sets override flag + timestamp |

### Store integration

- `flopSlider` and `autoArbitrageEnabled` added to `partialize` (persisted)
- `autoArbitrageEnabled` set to `true` in `researchNode` when node id is `auto_arbitrage`
- Both reset in the `reset` action

## UI: Interactive FlopsSlider

Replaces the current display-only `flops-slider.tsx` with an interactive slider.

### Layout

```
┌─────────────────────────────────────────┐
│ EXEC 714K FLOPS              AI 476K FLOPS │
│ ████████████████████○──────────────────── │
│ 714K loc/s exec              4.7K loc/s gen │
│                                           │
│ ⚖️ Auto-Arbitrage active      targeting 58% │  ← only when enabled
└─────────────────────────────────────────┘
```

### Implementation

- Native `<input type="range" min={0} max={1} step={0.01}>` styled with Emotion
- Green (#3fb950) fill for exec portion, purple (#c678dd) for AI portion
- White circular thumb, draggable
- Top row: FLOPS counts per pool (formatted with `formatNumber`)
- Bottom row: effective loc/s rates per pool
- When auto-arbitrage active: golden indicator row below the slider showing status and current target
- Existing placement: above CLI prompt log, below the wrapper top border

### i18n Keys (ui.json)

- `flops_slider.auto_arbitrage_active` — "Auto-Arbitrage active"
- `flops_slider.targeting` — "targeting {{pct}}%"

Add to all 8 locale files.

## Files to Modify

| File | Change |
|------|--------|
| `apps/game/src/modules/game/store/game-store.ts` | Add state fields, action, update tick with split logic, add auto-arbitrage to tick, handle in `researchNode` |
| `apps/game/src/components/flops-slider.tsx` | Rewrite: display-only → interactive slider with auto-arbitrage indicator |
| `libs/domain/data/tech-tree.json` | Add `auto_arbitrage` node |
| `libs/domain/data/ai-models.json` | Reduce T4 model `tokenCost` values |
| `apps/game/src/i18n/locales/*/ui.json` | Add slider i18n keys (8 files) |
| `apps/game/src/i18n/locales/*/tech-tree.json` | Add auto_arbitrage translations (8 files) |

## Out of Scope

- Agent setups (writer/reviewer, swarm, pipeline, tournament) — defined in ai-models.json but not wired
- AI model special abilities — not implemented yet
- Code quality mechanic
- Prestige system
