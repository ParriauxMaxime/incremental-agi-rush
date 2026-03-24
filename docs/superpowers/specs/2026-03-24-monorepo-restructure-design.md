# Monorepo Restructure

**Date:** 2026-03-24
**Status:** Approved

## Problem

The project has a flat structure with scattered shared code: JSON data in `specs/data/`, shared sim engine in `specs/lib/`, types duplicated across `src/modules/game/types.ts`, `src/modules/event/types.ts`, and `specs/lib/types.ts`. Game logic (cost functions, effect application) is duplicated between the game store and the balance sim. The editor lives in `tools/editor/` as a separate npm project with its own `node_modules`.

## Solution

Restructure into a proper npm workspaces monorepo with `apps/` and `libs/`.

## Target Structure

```
agi-rush/
├── apps/
│   ├── game/                    # React game app (from src/)
│   │   ├── package.json         # @agi-rush/game
│   │   ├── tsconfig.json
│   │   ├── rspack.config.ts
│   │   └── src/
│   └── editor/                  # Config editor SPA + Express (from tools/editor/)
│       ├── package.json         # @agi-rush/editor
│       ├── tsconfig.json
│       ├── rspack.config.ts
│       ├── server.ts
│       └── src/
├── libs/
│   ├── domain/                  # JSON data + TypeScript schema types
│   │   ├── package.json         # @agi-rush/domain
│   │   ├── index.ts
│   │   ├── types/               # One file per entity
│   │   ├── data/                # JSON files (from specs/data/)
│   │   └── data.ts              # Typed re-exports of JSON
│   ├── engine/                  # Pure game math + balance sim
│   │   ├── package.json         # @agi-rush/engine
│   │   ├── index.ts
│   │   ├── cost.ts              # getUpgradeCost, getEffectiveMax, getTechNodeCost
│   │   ├── effects.ts           # Shared effect application
│   │   ├── expression.ts        # Event expression resolver
│   │   ├── flops.ts             # Hardware FLOPS formula
│   │   ├── balance-sim.ts       # Balance simulation engine
│   │   └── types.ts             # Sim-specific types (SimConfig, SimResult)
│   └── design-system/           # Shared React + Emotion components
│       ├── package.json         # @agi-rush/design-system
│       ├── index.ts
│       ├── theme.ts             # Color tokens, spacing
│       ├── tech-tree/           # React Flow graph (shared between both apps)
│       └── components/          # Editable table, toast, etc.
├── package.json                 # Root — npm workspaces config
├── tsconfig.base.json           # Shared compiler options
├── biome.json
├── specs/                       # Design docs only (DESIGN.md, balance-check.js)
└── docs/
```

## Package dependencies

```
@agi-rush/domain        → (no internal deps)
@agi-rush/engine        → @agi-rush/domain
@agi-rush/design-system → @agi-rush/domain, react, @emotion/react, @xyflow/react
@agi-rush/game          → @agi-rush/domain, @agi-rush/engine, @agi-rush/design-system
@agi-rush/editor        → @agi-rush/domain, @agi-rush/engine, @agi-rush/design-system
```

## What goes where

### libs/domain

Consolidates all game data types and JSON files into one package.

**Types (one file per entity):**
- `types/upgrade.ts` — `Upgrade`, `UpgradeEffect` (from `src/modules/game/types.ts`)
- `types/tech-node.ts` — `TechNode`, `TechCurrencyEnum` (from `src/modules/game/types.ts`)
- `types/tier.ts` — `Tier` (from `src/modules/game/types.ts`)
- `types/ai-model.ts` — `AiModel`, `AgentSetup` (from `specs/lib/types.ts` + `src/modules/game/ai-models.ts`)
- `types/event.ts` — `EventDef`, `EventEffect`, `EventConfig` (from `src/modules/event/types.ts`)
- `types/milestone.ts` — `Milestone` (from `src/modules/game/types.ts`)
- `types/balance.ts` — `BalanceConfig` (typed shape of balance.json)

**Data:**
- `data/*.json` — moved from `specs/data/`
- `data.ts` — typed exports:
  ```typescript
  import upgradesData from "./data/upgrades.json";
  import type { Upgrade } from "./types/upgrade";
  export const upgrades: Upgrade[] = upgradesData.upgrades;
  // etc. for all entities
  ```

**Replaces:**
- `src/modules/game/types.ts` (Upgrade, TechNode, Tier, Milestone, UpgradeEffect, TechCurrencyEnum)
- `src/modules/event/types.ts` (event shapes)
- `specs/lib/types.ts` (SimEventEffect, SimEvent, AiModel, TechNodeData, UpgradeData, SimData)
- All scattered JSON imports (`../../../../specs/data/tiers.json` etc.)

### libs/engine

Pure functions — no React, no stores, no side effects. Both the game store and balance sim call these.

**Extracted from game-store.ts:**
- `cost.ts` — `getUpgradeCost()`, `getEffectiveMax()`, `getTechNodeCost()` (currently duplicated verbatim in game-store.ts and balance-sim.ts)
- `effects.ts` — shared effect application logic (consolidate the match chain from recalcDerivedStats and the sim's applyEffects). Must resolve the locPerKey divergence (game compounds exponentially, sim uses flat multiplier — pick one approach).
- `flops.ts` — hardware FLOPS bottleneck: `Math.min(cpu, ram) + storage`

**Extracted from event-store.ts / expression-resolver.ts:**
- `expression.ts` — `resolveExpression()` for event conditions

**Moved from specs/lib/:**
- `balance-sim.ts` — refactored to call shared cost/effect functions instead of duplicating them
- `types.ts` — sim-specific types only (SimConfig, SimResult, SimSnapshot, SimLogEntry, SimPurchase)

### libs/design-system

Shared React + Emotion components used by both apps.

**Extracted from both apps:**
- `theme.ts` — color tokens (tier colors, status colors), spacing scale, shared CSS constants
- `tech-tree/` — React Flow graph rendering:
  - `tech-tree-graph.tsx` — the `<ReactFlow>` wrapper with minimap, controls, background
  - `tech-node.tsx` — custom node component
  - `use-tech-tree-flow.ts` — hook converting data ↔ React Flow nodes/edges
- `components/editable-table.tsx` — generic inline-editing table (from editor)
- `components/toast.tsx` — toast notification component

**Apps wrap these with their own page logic:**
- Game's tech-tree-page imports `<TechTreeGraph>` and adds purchase/research interactions
- Editor's tech-tree-page imports `<TechTreeGraph>` and adds inspector/editing interactions

### apps/game

Current `src/` moves to `apps/game/src/`. Module structure stays the same internally (`modules/editor/`, `modules/game/`, `modules/event/`, `modules/upgrade/`).

**Changes:**
- `modules/game/types.ts` → deleted (types come from `@agi-rush/domain`)
- `modules/event/types.ts` → deleted
- `modules/game/ai-models.ts` → deleted (data comes from `@agi-rush/domain`)
- `modules/event/data/events.ts` → deleted
- `modules/game/store/game-store.ts` → imports cost functions from `@agi-rush/engine`, types from `@agi-rush/domain`
- `utils/balance-sim.ts` → deleted (use `@agi-rush/engine` directly)
- `components/tech-tree-page.tsx` → imports `TechTreeGraph` from `@agi-rush/design-system`

**Path aliases:**
```
@modules/ → apps/game/src/modules/
@components/ → apps/game/src/components/
@utils/ → apps/game/src/utils/
```

### apps/editor

Current `tools/editor/` moves to `apps/editor/`. Internal structure stays the same.

**Changes:**
- `server.ts` → reads JSON from `@agi-rush/domain` package path (resolved via `require.resolve`)
- Simulation page → imports `runBalanceSim` from `@agi-rush/engine`
- Tech tree page → imports shared components from `@agi-rush/design-system`
- Store types → uses `@agi-rush/domain` types instead of local `unknown[]`
- Removes `@shared` alias (replaced by `@agi-rush/engine`)

## Root configuration

### package.json
```json
{
  "name": "agi-rush",
  "private": true,
  "workspaces": [
    "libs/*",
    "apps/*"
  ],
  "scripts": {
    "dev": "npm run dev -w @agi-rush/game",
    "build": "npm run build -w @agi-rush/game",
    "editor": "npm run dev -w @agi-rush/editor",
    "typecheck": "tsc -b",
    "check": "biome check .",
    "check:fix": "biome check --fix ."
  }
}
```

### tsconfig.base.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "@emotion/react",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "composite": true,
    "declaration": true,
    "declarationMap": true
  }
}
```

Each package's `tsconfig.json` extends this and adds its own `paths`, `include`, and `references`.

## Migration approach

Big-bang commit. Everything moves at once. Steps:

1. Create all new directories and package.json files
2. Move files to new locations
3. Update all imports
4. Update rspack configs and tsconfigs
5. Update root package.json with workspaces
6. Extract shared code into libs
7. Delete old directories (specs/data/, specs/lib/, tools/, old type files)
8. Verify: `npm install && npm run typecheck && npm run build`
9. Run balance check
10. Single commit

## What stays in specs/

Design documents only:
- `specs/DESIGN.md`
- `specs/balance-check.js` (reads from `@agi-rush/domain` package)
- `specs/design.html`, `specs/prototype.html`
- `specs/IDEAS.md`, `specs/feedback.md`

## Non-goals

- No Turborepo or other build orchestration (npm workspaces is enough)
- No CI/CD changes
- No runtime behavior changes — this is a pure restructure
- Libs don't need their own build step (consumed as TypeScript source via tsconfig references)
