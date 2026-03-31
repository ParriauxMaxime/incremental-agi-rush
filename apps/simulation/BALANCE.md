# Balance Guide

Reference for agents and humans working on game balance. Read this before touching costs, rates, or progression.

## Running the Simulation

```bash
npm run sim              # Human-readable, 3 profiles
npm run sim -- --verbose # Per-tier breakdown + idle analysis
npm run sim -- --json    # Structured JSON output
npm run sim -- --trace   # Full purchase timeline + snapshots
npm run sim -- --profile casual  # Single profile
```

All 3 profiles must pass for CI. Fix failures before merging.

## The Three Resources

| Resource | Produced by | Consumed by | Role |
|----------|-------------|-------------|------|
| **LoC** | Typing, devs, AI models | Execution (FLOPS) | Flows through a pipeline — never stockpiled long |
| **FLOPS** | Hardware upgrades, tech tree | Execution + AI generation | Throughput cap, split by slider at T4+ |
| **Cash** | Executing LoC | Buying upgrades/tech | The only spendable resource |
| **Tokens** | Human workers (autoLocPerSec) | AI models (tokenCost) | Gates AI output, but rarely the bottleneck |

## The Production Chain

```
T0-T3:  Typing/Devs → LoC → FLOPS execute → Cash
T4+:    Human workers → Tokens → AI models → LoC ─┐
                          surplus → direct LoC ─────┤
                                                    ├→ Exec FLOPS consume → Cash
        FLOPS split by slider ──┬── Exec pool ──────┘
                                └── AI pool → powers models
```

### FLOPS Slider (T4+)

`execFlops = totalFlops * flopSlider` / `aiFlops = totalFlops * (1 - flopSlider)`

- Default: 0.7 (70% exec, 30% AI)
- Models allocated **bottom-up** (cheapest flopsCost first) — lower-tier models always at max
- Auto-arbitrage (tech unlock): smoothly adjusts slider to match exec rate to AI production rate, with queue pressure bias

### Token System

Tokens gate AI output but are designed to be abundant at T4:
- Human output is split: `tokensProduced = min(humanOutput, totalTokenDemand)`
- Surplus goes directly to LoC: `directLoc = humanOutput - tokensProduced`
- `tokenEfficiency = tokensProduced / totalTokenDemand` (0–1, multiplicative gate on AI output)
- T4 model tokenCosts are intentionally low (~5-7x less than flopsCost ratio) so FLOPS is the real bottleneck
- T5 models have higher tokenCosts to reintroduce token pressure at endgame

### AI Output Formula

```
aiLoc = model.locPerSec * tokenEfficiency * min(1, allocatedFlops / model.flopsCost)
```

Both gates are multiplicative. If either tokens or FLOPS are insufficient, output drops proportionally.

## Cost Scaling

All upgrades: `cost(n) = baseCost * costMultiplier^n`

Multiply effects compound as `value^owned`: a x2 multiplier stacked 3 times = 2^3 = 8x, not 6x. This exponential compounding is the primary driver of acceleration.

## Tier Progression

| Tier | cashPerLoc | Target Unlock | Duration | Feel |
|------|-----------|---------------|----------|------|
| T0 Garage | $0.10 | 0:00 | 30-300s | Typing, learning the loop |
| T1 Freelancing | $0.25 | ~5:00 | 60-800s | First acceleration, mechanical keyboard |
| T2 Startup | $0.80 | ~12:00 | 120-900s | Devs arrive, auto-LoC |
| T3 Tech Company | $5.00 | ~20:00 | 150-900s | Scaling, Series A |
| T4 AI Lab | $10.00 | ~28:00 | 30-1600s | AI models, FLOPS slider, token system |
| T5 AGI Race | $50.00 | ~35:00 | 60-1200s | Exponential, singularity |

Target session: 35-40 minutes for first playthrough.

## Player Profiles

| Profile | keys/s | skill | Click interval | Behavior |
|---------|--------|-------|----------------|----------|
| Casual | 4 | 0.6 | 2.1s | Slower, more idle |
| Average | 6 | 0.8 | 1.8s | Standard playthrough |
| Fast | 9 | 0.95 | 1.58s | Aggressive |

`skill` affects manual execution cooldown: `clickInterval = 3 - skill * 1.5`

## Validation Thresholds

From `libs/domain/data/balance.json` → `validation`:

- AGI time: 20-60 minutes
- Purchases: 80-500
- Longest wait between purchases: max 600s
- All 6 tiers must be reached
- Per-tier min/max durations (see balance.json)

## Key Bottlenecks by Tier

**T0-T1:** LoC production (typing speed). FLOPS are cheap, cash is the gate.

**T2-T3:** Execution throughput. Devs produce LoC fast, but FLOPS can't keep up. Hardware upgrades are critical.

**T4:** FLOPS split tension. AI models demand FLOPS for generation, but execution also needs FLOPS. The slider is the primary interaction. Token supply is usually adequate.

**T5:** Everything scales exponentially. Auto-arbitrage handles slider. Player focuses on which models to buy.

## Simulation Architecture

**Engine:** `libs/engine/balance-sim.ts` — pure function, no React, no side effects.

**Tick loop:** 1 tick = 1 second, runs up to 3600 ticks (60 min).

Each tick:
1. Event system (spawn/expire random events, apply modifiers)
2. Production (manual + auto-type + auto-LoC + AI token/FLOPS pipeline)
3. Execution (FLOPS consume LoC → cash)
4. Auto-arbitrage (if enabled, adjust slider)
5. Tech tree research (greedy: best value per cost)
6. Upgrade purchases (greedy: best value per cost, 5 buys per tick max)
7. Snapshots (every 10s)
8. AGI check

**Purchase AI:** The sim uses a greedy value heuristic:
- Each upgrade/model is scored by `value / cost`
- Value = estimated cash/s improvement from the purchase
- Bottleneck-aware: when LoC production > exec capacity, production upgrades are devalued (x0.3)
- LLM host slots valued by the next model that would become active

## Common Balance Issues

**"AI Lab too short"** — Players blast through T4 in seconds. Usually means T4 upgrades are too cheap relative to T3 accumulated wealth, or AI models produce too much cash too fast.

**"Longest wait too long"** — A purchase gap > 600s. Check if there's a cost cliff between tiers. The top idle gaps in verbose output show what the player was saving for.

**"Too few purchases"** — Cost scaling is too aggressive. Check costMultiplier values.

**"Cash frozen at T4+"** — The old greedy FLOPS bug (fixed). Now: check flopSlider default and auto-arbitrage behavior.

## Data Files

| File | What it controls |
|------|-----------------|
| `libs/domain/data/balance.json` | Global config, tier costs, pacing targets, validation thresholds |
| `libs/domain/data/upgrades.json` | Upgrade costs, effects, max levels, cost categories |
| `libs/domain/data/tech-tree.json` | Tech node costs, effects, prerequisites, positions |
| `libs/domain/data/ai-models.json` | AI model stats: locPerSec, flopsCost, tokenCost, cost |
| `libs/domain/data/tiers.json` | Tier unlock costs, cashPerLoc rates |
| `libs/domain/data/events.json` | Random event definitions, weights, effects |
| `libs/domain/data/milestones.json` | Milestone thresholds and cash bonuses |

**After editing any data file, always run `npm run sim` to validate.**

## Known Issues (2026-03-31)

- AI Lab tier duration is too short (1-27s across all profiles). T4 needs rebalancing — likely increase model costs or reduce early T4 cash flow.
- Agent setups (writer/reviewer, swarm, pipeline, tournament) defined in ai-models.json but not wired in game or sim.
- AI model special abilities (quality floors, conditional bonuses, etc.) not implemented.
- Code quality mechanic not implemented in game (sim has placeholder decay).
