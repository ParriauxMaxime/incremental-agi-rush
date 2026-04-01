---
name: rebalance-game
description: Use when adjusting game balance, modifying upgrade costs, tier progression, AI model stats, tech tree nodes, or when the balance simulation fails after data changes
---

# Rebalance Game

## Overview

Iterative workflow for adjusting AGI Rush game balance. Edit data JSON files, run the balance simulation, interpret failures, and repeat until all checks pass for all 3 player profiles.

## When to Use

- After changing any data file in `libs/domain/data/` (upgrades, tiers, ai-models, tech-tree, balance, events)
- When the balance simulation reports failures
- When intentionally retuning game pacing (e.g. "make early game faster", "AI lab feels too short")
- When adding new upgrades, tech nodes, or AI models
- When comparing sim predictions to real player sessions

## First Step: Read the Balance Guide

**Before making any changes**, read `apps/simulation/BALANCE.md`. It contains:
- The full production chain and resource flow
- FLOPS slider and token system mechanics
- AI output formula
- Simulation architecture (tick loop, purchase AI heuristic)
- Known issues and current bottlenecks by tier

This context is essential for understanding *why* a change will have its effect.

## Data Files

All game data lives in `libs/domain/data/`:

| File | What it controls | Key levers |
|------|-----------------|------------|
| `balance.json` | Global constants + validation thresholds | `core.startingLocPerKey`, `core.agiLocTarget`, `validation.*` |
| `upgrades.json` | Purchasable items | `baseCost`, `costMultiplier`, `max`, effects |
| `tiers.json` | 6 progression tiers | `cashPerLoc`, `cost` (must match tech-tree tier node costs) |
| `tech-tree.json` | Research nodes | `baseCost`, `costMultiplier`, `currency`, `requires`, `effects` |
| `ai-models.json` | AI models | `cost`, `locPerSec`, `flopsCost`, unlock chains |
| `events.json` | Random events | Probabilities, effects, durations |
| `milestones.json` | LoC/cash threshold rewards | `threshold`, `metric`, `cashBonus` |

**IMPORTANT:** Tier unlock costs must be synced between `tiers.json` (cost field) and `tech-tree.json` (tier_* node baseCost). If they diverge, the sim and game will disagree.

## Simulation CLI

The simulation lives at `apps/simulation/` and imports from `@flopsed/engine` + `@flopsed/domain`. No duplicated logic.

```bash
npm run sim                      # human-readable, 3 profiles (balanced AI)
npm run sim -- --verbose         # per-tier duration breakdown
npm run sim -- --json            # structured JSON (for programmatic use)
npm run sim -- --profile casual  # single profile only
npm run sim -- --greedy          # greedy purchase AI (buy cheapest available)
npm run sim -- --greedy --verbose # greedy with per-tier breakdown
npm run sim -- --trace           # full purchase timeline + snapshots
```

**Use `--json` when you need to parse results programmatically.** The JSON output has typed fields for every metric.

## Two Purchase AI Strategies

The sim has two purchase strategies that bracket real player behavior:

| Strategy | Flag | Behavior | Typical fast player |
|----------|------|----------|-------------------|
| **Balanced** | (default) | Value/cost ratio optimization | ~52 min |
| **Greedy** | `--greedy` | Buy cheapest available, human reaction delay | ~31 min |

**Real players land between greedy and balanced.** A phone player typing fast ≈ greedy-fast. A desktop player optimizing purchases ≈ balanced.

**Always run BOTH strategies** when rebalancing to check the full range:
```bash
npm run sim -- --greedy --verbose
npm run sim -- --verbose
```

## Per-Tier Comparison Workflow

When a tier feels too fast/slow, compare both strategies side by side:

```bash
# Quick per-tier view for a specific profile
npm run sim -- --greedy --verbose --profile fast
npm run sim -- --verbose --profile fast
```

Build a comparison table from the output:

| Tier | Greedy Fast | Balanced Fast | Target |
|------|------------|--------------|--------|
| T0 Garage | Xs | Xs | ~2 min |
| T1 Freelancing | Xs | Xs | ~3 min |
| ... | | | |

If a tier is too short in **both** strategies, the tier's production/costs need adjusting. If it's only short in greedy, it's fine — the greedy bot is the floor.

## Workflow

1. **Understand the goal** — What specifically needs rebalancing?

2. **Run baseline with both strategies** — Capture current state:
   ```bash
   npm run sim -- --greedy --verbose
   npm run sim -- --verbose
   ```

3. **Make targeted edits** — Change the minimum number of values. Common adjustments:
   - **Tier too short**: Increase tier unlock `baseCost` in tech-tree.json (+ sync tiers.json `cost`), reduce `cashPerLoc`, or nerf compounding multipliers feeding into it
   - **Tier too long**: Decrease costs, increase production effects, or boost `cashPerLoc`
   - **Wait too long between purchases**: Lower `baseCost` of next available items, or add a cheaper intermediate item
   - **AGI too fast/slow**: Adjust late-game production multipliers or singularity cost
   - **Explosive mid-game**: Check for compounding `multiply` effects — `val ** owned` means x2 stacking 3 times = 8x, not 6x. Nerf the multiplier value.
   - **Milestones skipping tiers**: Reduce `cashBonus` in milestones.json — large bonuses at tier transitions can let players skip the grind entirely

4. **Run simulation** — Verify changes:
   ```bash
   npm run sim -- --greedy --verbose
   npm run sim -- --verbose
   ```

5. **Interpret failures** — The sim validates per profile (Casual 4 keys/s, Average 6 keys/s, Fast 9 keys/s):
   - `AGI too fast/slow` → adjust late-game production or singularity cost
   - `Too few/many purchases` → adjust cost curves
   - `Longest wait > 600s` → check which item/tier caused the stall (see `validation.maxWaitSeconds`)
   - `Tier too short/long` → adjust costs and production within that tier

6. **Iterate** — Repeat steps 3-5 until all checks pass. Small incremental changes are better than large sweeping ones.

## Key Levers by Tier

| Tier | What makes it too fast | What makes it too slow |
|------|----------------------|----------------------|
| **T0** | Milestone cash bonuses, high `cashPerLoc` | Low `cashPerLoc` ($0.05 current), high tier_freelancing cost |
| **T1-T2** | Milestone bonuses, cheap upgrades | High tier unlock costs |
| **T3** | Architect x1.3 cashMultiplier compounding | — |
| **T4** | ML Pipeline + RLHF compounding, low tier_agi_race cost, milestone cash injections | High tier_agi_race cost ($30B current) |
| **T5** | Planetary Datacenter spam | High singularity cost ($2Q current) |

## Validation Thresholds

Thresholds live in `libs/domain/data/balance.json` under the `validation` key. They're editable in the editor app. Key fields:

- `agiMinMinutes` / `agiMaxMinutes` — AGI completion time window
- `maxWaitSeconds` — max seconds between any two purchases
- `minPurchases` / `maxPurchases` — total purchase count range
- `tierMinDuration` / `tierMaxDuration` — per-tier duration bounds (seconds)

## Key Balance Insight: Compounding Multipliers

The game applies `multiply` effects as `val ** owned`. This means:
- x1.15 stacked 3 times = `1.15^3 = 1.52x` (mild)
- x1.2 stacked 5 times = `1.2^5 = 2.49x` (moderate)
- x1.3 stacked 3 times = `1.3^3 = 2.2x` (strong)
- x2.0 stacked 3 times = `2.0^3 = 8.0x` (explosive — avoid)

When a tier feels "too fast", the cause is usually a compounding multiplier from the previous tier making income too high. Check `cashMultiplier`, `llmLocMultiplier`, `locProductionSpeed`, and `locPerKey` multiply effects.

## Common Mistakes

- **Changing too many values at once** — Makes it hard to isolate which change broke things.
- **Forgetting to run the sim** — Always run after every edit.
- **Only checking one profile** — A change that fixes Casual might break Fast.
- **Only checking one strategy** — Always run both `--greedy` and balanced.
- **Making things more expensive without checking multipliers** — If income is 10x too high, doubling costs only delays the problem by seconds. Nerf the multiplier instead.
- **Tier cost mismatch** — tiers.json `cost` and tech-tree.json tier node `baseCost` must match.
- **Ignoring milestone cash** — Large milestone bonuses can skip entire tier progressions. Check `milestones.json` cashBonus values relative to tier unlock costs.
- **Adding new upgrades without i18n** — New upgrades need translation keys in all 8 locale files under `apps/game/src/i18n/locales/*/upgrades.json`.
