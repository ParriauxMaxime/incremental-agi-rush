# AGENTS.md

Instructions for AI agents working on this codebase. Read CLAUDE.md first for full context — this file adds agent-specific guidance.

## Quick Orientation

**What is this?** An incremental/idle browser game where you type code, execute it with FLOPS for cash, and scale from a garage to building AGI. Built as an npm workspaces monorepo with React 19 + Zustand + Emotion + TypeScript strict mode.

**The core loop:** Keystrokes produce LoC (lines of code). LoC accumulates in a block queue. FLOPS execute LoC from the queue, consuming it. Each executed LoC earns cash at the current tier's rate. Cash buys upgrades that produce more LoC, more FLOPS, or multiply earnings. At T4, AI models arrive and compete with execution for FLOPS via a slider. Win by buying The Singularity ($500T).

## Monorepo Map

```
Package                    What it does                                  Key files
─────────────────────────  ────────────────────────────────────────────   ─────────────────────────────
@agi-rush/domain           JSON data + TS types. Source of truth.        types/*.ts, data/*.json, data.ts
@agi-rush/engine           Pure math. No React, no side effects.         cost.ts, flops.ts, balance-sim.ts
@agi-rush/design-system    Shared React components + theme.              theme.ts, tech-tree/*.tsx
@agi-rush/game             Main game SPA (port 3000).                    modules/{game,editor,event,upgrade}/
@agi-rush/editor           Data editor SPA (3738) + Express API (3737).  pages/*/, server.ts
@agi-rush/simulation       CLI balance sim runner.                       src/main.ts
```

### Game app structure (`apps/game/src/`)

```
modules/
  game/       → Zustand store (game-store.ts), game loop (use-game-loop.ts), singularity endgame
  editor/     → Code editor display, typing mechanics, auto-type, code tokens
  event/      → Random event system (hazards/bonuses), toast UI, event store
  upgrade/    → Upgrade shop list, milestone list
components/   → Shell layout, resource bar, sidebar, tech tree page, FLOPS slider, mobile UI
hooks/        → use-is-mobile.ts
utils/        → format.ts (number formatting)
```

**Module rule:** Modules must NOT import from other modules. Use the game store as shared state. Each module exposes its public API through `index.ts`.

### Data files (`libs/domain/data/`)

All game content is data-driven via JSON:
- `upgrades.json` — Purchasable upgrades (typing, hardware, devs, AI, infrastructure)
- `tech-tree.json` — Prerequisite-based research tree (unlocks tiers, models, bonuses)
- `tiers.json` — 6 tiers with cashPerLoc rates and unlock thresholds
- `ai-models.json` — 15+ AI models with locPerSec, flopsCost, quality, specials
- `events.json` — Random events (hazards, bonuses, choices)
- `milestones.json` — Achievement thresholds (LoC and cash)
- `balance.json` — Master balance config (pacing, cost curves, quality decay, validation)

## Key Formulas

```
Hardware FLOPS    = min(cpuFlops, ramFlops) + storageFlops
Execution         = min(queued_loc, effective_flops) LoC consumed per second
Cash per tick     = executed_loc × tier.cashPerLoc × cashMultiplier
Upgrade cost      = baseCost × costMultiplier^owned
Multiply effects  = value^owned  (x2 stacked 3 times = 8x, not 6x)
AI effective LoC  = totalAiLoc × min(1, aiFlops / totalAiFlops)
Effective FLOPS   = totalFlops × flopSlider (execution) / totalFlops × (1-flopSlider) (AI)
```

## Commands

```bash
npm run dev          # Game dev server (port 3000, HMR)
npm run build        # Production build → apps/game/dist/
npm run editor       # Editor dev server (port 3738) + API (port 3737)
npm run typecheck    # TypeScript strict check (both apps)
npm run sim          # Balance simulation (3 profiles, exit 0 = pass, 1 = fail)
npm run sim -- --verbose   # Per-tier breakdown
npm run sim -- --json      # Structured JSON output
npm run check        # Biome lint + format check
npm run check:fix    # Auto-fix biome issues
```

## Rules for Agents

### After changing game data
**Always run `npm run sim`** after editing any JSON in `libs/domain/data/`. The simulation validates pacing, tier durations, purchase frequency, and completion time. If it fails, adjust and re-run until it passes.

### Code style (enforced by Biome)
- **Tabs** for indentation
- **No `any`**, no `enum` keyword (use `as const` objects with `Enum` suffix)
- **kebab-case** file names
- **ts-pattern `match()`** over switch/if-else (3+ branches)
- **Emotion `css` prop** for styles, co-located in component files
- **~100 lines** component smell threshold
- **No dead code**, no commented-out code
- Import conventions: `@agi-rush/*` cross-package, `@modules/` / `@components/` / `@utils/` within game app

### Commits
Use [gitmoji](https://gitmoji.dev/): `✨` feature, `🐛` fix, `♻️` refactor, `⚖️` balance, `⚡` perf, `🧪` tests, `📝` docs.

### Architecture invariants
- `libs/engine` is pure functions — no React, no stores, no DOM
- `libs/domain` is data + types only — no logic
- Game modules don't import from each other
- Tech tree nodes use `requires` arrays for prerequisites
- Tier unlocks are tech tree nodes with `tierUnlock` effects
- AI model unlocks are tech tree nodes with `modelUnlock` effects

## Design Docs

- `specs/DESIGN.md` — Full game design document (tiers, upgrades, AI models, mechanics)
- `specs/IDEAS.md` — Future ideas (self-referential source code in editor)
- `docs/superpowers/plans/` — Implementation plans for past features
- `docs/superpowers/specs/` — Design specs for past features
