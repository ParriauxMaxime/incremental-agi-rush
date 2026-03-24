# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start game dev server (port 3000, HMR)
- `npm run build` — Production build of game to `apps/game/dist/`
- `npm run editor` — Start editor dev server (port 3738) + API (port 3737)
- `npm run typecheck` — TypeScript strict check (no emit) for both apps
- `npm run check` — Biome lint + format check
- `npm run check:fix` — Auto-fix biome issues

## Stack

- **React 19** with **Emotion** (`@emotion/react`) for CSS-in-JS via the `css` prop
- **TypeScript** in strict mode, targeting ES2020
- **Zustand** for state management
- **ts-pattern** for pattern matching (prefer `match()` over switch/if-else chains)
- **Rspack** with SWC loader for build/dev
- **Biome** for linting and formatting (tabs, recommended rules)
- **npm workspaces** for monorepo package management

## Architecture

This is an incremental game ("AGI Rush") where players write code, execute it for cash, and progress through six tiers toward AGI. The repo is an **npm workspaces monorepo** with 5 packages:

```
agi-rush/
├── apps/
│   ├── game/              # Main game app (React SPA)
│   └── editor/            # Config editor (React SPA + Express API)
├── libs/
│   ├── domain/            # JSON data + TypeScript schema types
│   ├── engine/            # Pure game math, cost functions, balance sim
│   └── design-system/     # Shared React components, theme, tech tree graph
├── specs/                 # Design docs + balance-check.js
├── package.json           # Root workspaces config
└── tsconfig.base.json     # Shared TS compiler options
```

### libs/domain (`@agi-rush/domain`)

Single source of truth for game data and types. All JSON config files live here.

- `types/` — TypeScript interfaces: `Upgrade`, `TechNode`, `Tier`, `AiModelData`, `EventDefinition`, `Milestone`, `BalanceConfig`
- `data/` — JSON files: `upgrades.json`, `tech-tree.json`, `tiers.json`, `ai-models.json`, `events.json`, `milestones.json`, `balance.json`
- `data.ts` — Typed exports (e.g. `export const upgrades: Upgrade[]`)

### libs/engine (`@agi-rush/engine`)

Pure functions — no React, no stores, no side effects. Depends on `@agi-rush/domain`.

- `cost.ts` — `getUpgradeCost()`, `getEffectiveMax()`, `getTechNodeCost()`
- `expression.ts` — Event condition resolver
- `flops.ts` — Hardware FLOPS formula
- `balance-sim.ts` — Full balance simulation engine
- `types.ts` — Sim-specific types (`SimConfig`, `SimResult`, etc.)

### libs/design-system (`@agi-rush/design-system`)

Shared React + Emotion components. Depends on `@agi-rush/domain`.

- `theme.ts` — Color tokens, tier colors
- `tech-tree/` — React Flow graph components (shared between game and editor)
- `components/` — Editable table, etc.

### apps/game (`@agi-rush/game`)

**Entry:** `apps/game/src/main.tsx` → renders `<App />` into `#root`

```
apps/game/src/
├── modules/
│   ├── editor/        # Code editor, typing mechanics, code tokens
│   ├── game/          # Core game state (Zustand store), game loop
│   ├── event/         # Event system (store, toast, modifiers)
│   └── upgrade/       # Upgrade shop + milestone list
├── components/        # Shell components (layout, sidebar, resource bar)
└── utils/             # App-specific utilities
```

Modules are core business features — modules should NOT import from other modules (use the game store as shared state). Each module exposes a public API through its `index.ts`.

### apps/editor (`@agi-rush/editor`)

Data editor with Express backend on port 3737 and Rspack dev server on port 3738. 8 pages: Tech Tree, Upgrades, AI Models, Events, Milestones, Tiers, Balance, Simulation.

### Import conventions

```typescript
// From workspace packages (preferred for shared code)
import { type Upgrade, upgrades, tiers } from "@agi-rush/domain";
import { getUpgradeCost, runBalanceSim } from "@agi-rush/engine";
import { TechNodeComponent, tierColors } from "@agi-rush/design-system";

// Within game app (path aliases)
import { useGameStore } from "@modules/game";
import { ResourceBar } from "@components/resource-bar";
```

- Use `@agi-rush/*` for cross-package imports
- Use `@modules/`, `@components/`, `@utils/` aliases within the game app
- Use relative imports within a module
- No deep relative imports (`../../../`)

## TypeScript Conventions

### Strict TypeScript — No Exceptions

- **Never** use `any`. No casting to `unknown` as an escape hatch.
- Prefer `type` imports: `import type { Foo } from './foo'`.
- Use interfaces for object shapes that might be extended; type aliases for unions, computed types, function signatures.

### Enum Pattern

Never use TypeScript's `enum` keyword. Use `as const` objects:

```typescript
export const UserStatusEnum = {
	active: "active",
	inactive: "inactive",
} as const;

export type UserStatusEnum = (typeof UserStatusEnum)[keyof typeof UserStatusEnum];
```

Rules:
- All enum names MUST have the `Enum` suffix.
- Use `snake_case` for enum values.

### File Naming

- **kebab-case** for all files (`resource-bar.tsx`, `game-store.ts`).
- Component files: `component-name.tsx`
- Hook files: `use-hook-name.ts`
- Type files: `types.ts`

### Pattern Matching

Use `ts-pattern` `match()` instead of switch statements or complex if-else chains (3+ conditions). Always end with `.exhaustive()` or `.otherwise()`.

## React Conventions

### Components

- Use Emotion's `css()` function with the `css` prop — styles are co-located in component files.
- **~100 lines smell threshold:** A component approaching 100 lines signals a need to refactor.
- Use `useMemo` for expensive computations with stable dependency arrays.
- Call all hooks unconditionally before any early returns (Rules of Hooks).

### Hooks

- One hook per file: `use-<hook-name>.ts`.
- Place in `hooks/` directory.

## Code Quality

- No dead code — if unused, delete it completely. No commented-out code.
- Prefer minimal changes — don't refactor surrounding code when fixing a bug.
- Biome enforces tab indentation and auto-organizes imports.
- `**/dist`, `**/node_modules`, and `.claude/` are excluded from biome checks.

## Balance Validation

**IMPORTANT:** After editing any JSON in `libs/domain/data/` (upgrades, ai-models, tiers, tech-tree, balance, events), ALWAYS run the balance checker:

```bash
cd specs && node balance-check.js
```

Add `--verbose` for per-tier duration breakdown. The script simulates 3 player profiles (casual 4 keys/s, average 6 keys/s, fast 9 keys/s) and checks:
- AGI reached between 22-45 minutes
- 80-500 total purchases
- Max wait between purchases ≤ 300 seconds
- All 6 tiers reached
- Each tier lasts within min/max duration bounds

If any check fails, adjust the data files and re-run until all pass. The same simulation engine is also available in the editor app → Simulation page, or via `@agi-rush/engine`'s `runBalanceSim()`.

**Current validated targets (as of last balance pass):**
- Casual: AGI ~31 min
- Average: AGI ~24 min
- Fast: AGI ~23 min
- ~202 purchases across the game

## Workflow

### Commits

Use [gitmoji](https://gitmoji.dev/) in commit messages:
- `🎉` Init / new component
- `✨` New feature
- `🐛` Bug fix
- `♻️` Refactor
- `⚖️` Balance change
- `⚡` Performance
- `🧪` Tests
- `📝` Docs
