# Monorepo Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the flat project into an npm workspaces monorepo with `apps/` (game, editor) and `libs/` (domain, engine, design-system) — single big-bang commit.

**Architecture:** npm workspaces with 5 packages. Libs are consumed as TypeScript source (no build step) via tsconfig project references. Apps use Rspack with aliases pointing to workspace packages.

**Tech Stack:** npm workspaces, TypeScript 5.x project references, Rspack, React 19, Emotion, Zustand

**Spec:** `docs/superpowers/specs/2026-03-24-monorepo-restructure-design.md`

---

### Task 1: Create libs/domain

The data layer — schema types + JSON data + typed exports. Every other package depends on this.

**Files:**
- Create: `libs/domain/package.json`
- Create: `libs/domain/tsconfig.json`
- Create: `libs/domain/index.ts`
- Create: `libs/domain/types/upgrade.ts`
- Create: `libs/domain/types/tech-node.ts`
- Create: `libs/domain/types/tier.ts`
- Create: `libs/domain/types/ai-model.ts`
- Create: `libs/domain/types/event.ts`
- Create: `libs/domain/types/milestone.ts`
- Create: `libs/domain/types/balance.ts`
- Create: `libs/domain/types/index.ts`
- Create: `libs/domain/data.ts`
- Move: `specs/data/*.json` → `libs/domain/data/`

- [ ] **Step 1: Create package.json**

```json
{
	"name": "@agi-rush/domain",
	"private": true,
	"version": "0.0.0",
	"type": "module",
	"main": "index.ts",
	"types": "index.ts"
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
	"extends": "../../tsconfig.base.json",
	"compilerOptions": {
		"rootDir": ".",
		"outDir": "dist"
	},
	"include": ["."]
}
```

- [ ] **Step 3: Move JSON data files**

```bash
mkdir -p libs/domain/data
git mv specs/data/ai-models.json libs/domain/data/
git mv specs/data/balance.json libs/domain/data/
git mv specs/data/events.json libs/domain/data/
git mv specs/data/milestones.json libs/domain/data/
git mv specs/data/tech-tree.json libs/domain/data/
git mv specs/data/tiers.json libs/domain/data/
git mv specs/data/upgrades.json libs/domain/data/
```

- [ ] **Step 4: Create type files**

Create `libs/domain/types/upgrade.ts`:
```typescript
export interface UpgradeEffect {
	type: string;
	op: "add" | "multiply" | "enable" | "set";
	value: number | boolean | string;
	doubleInterval?: number;
}

export interface Upgrade {
	id: string;
	tier: string;
	name: string;
	description: string;
	icon: string;
	baseCost: number;
	costMultiplier: number;
	max: number;
	effects: UpgradeEffect[];
	costCategory?: string;
	codeQuality?: number;
	flopsCost?: number | string;
	requires?: string[];
}
```

Create `libs/domain/types/tech-node.ts`:
```typescript
export const TechCurrencyEnum = {
	loc: "loc",
	cash: "cash",
} as const;
export type TechCurrencyEnum = (typeof TechCurrencyEnum)[keyof typeof TechCurrencyEnum];

export interface TechNode {
	id: string;
	name: string;
	description: string;
	icon: string;
	requires: string[];
	max: number;
	baseCost: number;
	costMultiplier: number;
	currency: TechCurrencyEnum;
	effects: import("./upgrade").UpgradeEffect[];
	levelLabels?: string[];
	x?: number;
	y?: number;
}
```

Create `libs/domain/types/tier.ts`:
```typescript
export interface Tier {
	id: string;
	index: number;
	name: string;
	tagline: string;
	cashPerLoc: number;
	locRequired: number;
	cashRequired: number;
	cost: number;
}
```

Create `libs/domain/types/ai-model.ts`:
```typescript
export interface AiModelData {
	id: string;
	family: string;
	name: string;
	version: string;
	icon: string;
	tier: string;
	cost: number;
	locPerSec: number;
	flopsCost: number;
	codeQuality: number;
	requires?: string;
	special?: Record<string, unknown>;
}

export interface AgentSetup {
	id: string;
	name: string;
	description: string;
	requiredModels: number;
	unlockCondition: string;
	slots: unknown[];
	effects: Record<string, string>;
}
```

Create `libs/domain/types/event.ts`. This consolidates from `src/modules/event/types.ts`:
```typescript
export const TierIdEnum = {
	garage: "garage",
	freelancing: "freelancing",
	startup: "startup",
	tech_company: "tech_company",
	ai_lab: "ai_lab",
	agi_race: "agi_race",
} as const;
export type TierIdEnum = (typeof TierIdEnum)[keyof typeof TierIdEnum];

export const TIER_INDEX: Record<TierIdEnum, number> = {
	garage: 0,
	freelancing: 1,
	startup: 2,
	tech_company: 3,
	ai_lab: 4,
	agi_race: 5,
};

export const EventEffectOpEnum = {
	add: "add",
	multiply: "multiply",
	set: "set",
} as const;
export type EventEffectOpEnum = (typeof EventEffectOpEnum)[keyof typeof EventEffectOpEnum];

export type EventEffect =
	| { type: "flops" | "locPerKey" | "locProduction" | "autoLoc" | "cashMultiplier"; op: "multiply"; value: number }
	| { type: "flops"; op: "set"; value: number }
	| { type: "cash"; op: "multiply"; value: number }
	| { type: "instantCash"; op: "add"; value: string | number }
	| { type: "instantLoc"; op: "add"; value: number }
	| { type: "conditionalCash"; op: "add"; value: number; threshold: string; reward: string }
	| { type: "disableUpgrade"; op: "set"; value: string; upgradeId: string }
	| { type: "codeQuality"; op: "add"; value: number }
	| { type: "choice"; options: EventChoiceOption[] };

export interface EventChoiceOption {
	label: string;
	effect: {
		type: string;
		op?: string;
		value?: number | string;
		duration?: number;
	};
}

export interface EventInteraction {
	type: string;
	reductionPerKey: number;
}

export interface EventDefinition {
	id: string;
	name: string;
	description: string;
	icon: string;
	minTier: TierIdEnum;
	duration: number;
	effects: EventEffect[];
	interaction?: EventInteraction;
	weight: number;
}

export interface EventConfig {
	minIntervalSeconds: number;
	maxIntervalSeconds: number;
	maxConcurrent: number;
}

// Runtime types (used by event store, not domain data)
export interface ActiveEvent {
	definitionId: string;
	startedAt: number;
	remainingDuration: number;
	resolved: boolean;
	synthetic: boolean;
}

export interface EventModifiers {
	flopsMultiplier: number;
	flopsOverride: number | null;
	locPerKeyMultiplier: number;
	locProductionMultiplier: number;
	autoLocMultiplier: number;
	cashMultiplier: number;
	disabledUpgrades: string[];
}

export const DEFAULT_EVENT_MODIFIERS: EventModifiers = {
	flopsMultiplier: 1,
	flopsOverride: null,
	locPerKeyMultiplier: 1,
	locProductionMultiplier: 1,
	autoLocMultiplier: 1,
	cashMultiplier: 1,
	disabledUpgrades: [],
};

export interface ExpressionContext {
	currentCash: number;
	currentLoc: number;
	currentLocPerSec: number;
}
```

Create `libs/domain/types/milestone.ts`:
```typescript
export interface Milestone {
	id: string;
	name: string;
	description: string;
	condition: string;
	threshold: number;
	metric: string;
}
```

Create `libs/domain/types/balance.ts`:
```typescript
export interface BalanceCore {
	targetSessionMinutes: number;
	ticksPerSecond: number;
	startingCash: number;
	startingFlops: number;
	startingLocPerKey: number;
	manualTypingQuality: number;
	agiLocTarget: number;
}

export interface BalanceConfig {
	core: BalanceCore;
	[key: string]: unknown;
}
```

Create `libs/domain/types/index.ts`:
```typescript
export * from "./upgrade";
export * from "./tech-node";
export * from "./tier";
export * from "./ai-model";
export * from "./event";
export * from "./milestone";
export * from "./balance";
```

- [ ] **Step 5: Create data.ts (typed data exports)**

Create `libs/domain/data.ts`:
```typescript
import type { AiModelData, AgentSetup } from "./types/ai-model";
import type { BalanceConfig } from "./types/balance";
import type { EventConfig, EventDefinition } from "./types/event";
import type { Milestone } from "./types/milestone";
import type { TechNode } from "./types/tech-node";
import type { Tier } from "./types/tier";
import type { Upgrade } from "./types/upgrade";

import aiModelsJson from "./data/ai-models.json";
import balanceJson from "./data/balance.json";
import eventsJson from "./data/events.json";
import milestonesJson from "./data/milestones.json";
import techTreeJson from "./data/tech-tree.json";
import tiersJson from "./data/tiers.json";
import upgradesJson from "./data/upgrades.json";

export const tiers: Tier[] = tiersJson.tiers as Tier[];
export const upgrades: Upgrade[] = upgradesJson.upgrades as Upgrade[];
export const techNodes: TechNode[] = techTreeJson.nodes as TechNode[];
export const aiModels: AiModelData[] = aiModelsJson.models as AiModelData[];
export const agentSetups: AgentSetup[] = aiModelsJson.agentSetups as AgentSetup[];
export const events: EventDefinition[] = eventsJson.events as EventDefinition[];
export const eventConfig: EventConfig = eventsJson.eventConfig as EventConfig;
export const milestones: Milestone[] = milestonesJson.milestones as Milestone[];
export const balance: BalanceConfig = balanceJson as unknown as BalanceConfig;

// Re-export raw JSON for cases that need the full structure
export { aiModelsJson, balanceJson, eventsJson, milestonesJson, techTreeJson, tiersJson, upgradesJson };
```

- [ ] **Step 6: Create index.ts (package entry)**

Create `libs/domain/index.ts`:
```typescript
// Types
export * from "./types";

// Data
export {
	tiers,
	upgrades,
	techNodes,
	aiModels,
	agentSetups,
	events,
	eventConfig,
	milestones,
	balance,
	aiModelsJson,
	balanceJson,
	eventsJson,
	milestonesJson,
	techTreeJson,
	tiersJson,
	upgradesJson,
} from "./data";
```

---

### Task 2: Create libs/engine

Pure game math functions + balance sim. Depends on `@agi-rush/domain`.

**Files:**
- Create: `libs/engine/package.json`
- Create: `libs/engine/tsconfig.json`
- Create: `libs/engine/index.ts`
- Create: `libs/engine/cost.ts`
- Create: `libs/engine/expression.ts`
- Create: `libs/engine/flops.ts`
- Create: `libs/engine/types.ts`
- Move: `specs/lib/balance-sim.ts` → `libs/engine/balance-sim.ts`

- [ ] **Step 1: Create package.json**

```json
{
	"name": "@agi-rush/engine",
	"private": true,
	"version": "0.0.0",
	"type": "module",
	"main": "index.ts",
	"types": "index.ts",
	"dependencies": {
		"@agi-rush/domain": "workspace:*"
	}
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
	"extends": "../../tsconfig.base.json",
	"compilerOptions": {
		"rootDir": ".",
		"outDir": "dist"
	},
	"include": ["."],
	"references": [{ "path": "../domain" }]
}
```

- [ ] **Step 3: Create cost.ts**

Extract from `src/modules/game/store/game-store.ts` lines 77-117. These are pure functions that both the game store and sim need:

```typescript
import type { Upgrade, TechNode } from "@agi-rush/domain";

interface CostDiscounts {
	freelancerCostDiscount: number;
	internCostDiscount: number;
	devCostDiscount: number;
	teamCostDiscount: number;
	managerCostDiscount: number;
	llmCostDiscount: number;
	agentCostDiscount: number;
}

interface MaxBonuses {
	freelancerMaxBonus: number;
	internMaxBonus: number;
	teamMaxBonus: number;
	managerMaxBonus: number;
	llmMaxBonus: number;
	agentMaxBonus: number;
}

export function getEffectiveMax(upgrade: Upgrade, bonuses?: MaxBonuses): number {
	if (!bonuses || !upgrade.costCategory) return upgrade.max;
	let bonus = 0;
	if (upgrade.costCategory === "freelancer") bonus = bonuses.freelancerMaxBonus;
	if (upgrade.costCategory === "intern") bonus = bonuses.internMaxBonus;
	if (upgrade.costCategory === "team") bonus = bonuses.teamMaxBonus;
	if (upgrade.costCategory === "manager") bonus = bonuses.managerMaxBonus;
	if (upgrade.costCategory === "llm") bonus = bonuses.llmMaxBonus;
	if (upgrade.costCategory === "agent") bonus = bonuses.agentMaxBonus;
	return upgrade.max + bonus;
}

export function getUpgradeCost(upgrade: Upgrade, owned: number, discounts?: CostDiscounts): number {
	let cost = Math.floor(upgrade.baseCost * upgrade.costMultiplier ** owned);
	if (discounts) {
		if (upgrade.costCategory === "freelancer") cost = Math.floor(cost * discounts.freelancerCostDiscount);
		if (upgrade.costCategory === "intern") cost = Math.floor(cost * discounts.internCostDiscount);
		if (upgrade.costCategory === "dev") cost = Math.floor(cost * discounts.devCostDiscount);
		if (upgrade.costCategory === "team") cost = Math.floor(cost * discounts.teamCostDiscount);
		if (upgrade.costCategory === "manager") cost = Math.floor(cost * discounts.managerCostDiscount);
		if (upgrade.costCategory === "llm") cost = Math.floor(cost * discounts.llmCostDiscount);
		if (upgrade.costCategory === "agent") cost = Math.floor(cost * discounts.agentCostDiscount);
	}
	return Math.max(1, cost);
}

export function getTechNodeCost(node: TechNode, owned: number): number {
	return Math.floor(node.baseCost * node.costMultiplier ** owned);
}
```

- [ ] **Step 4: Create expression.ts**

Extract from `src/modules/event/utils/expression-resolver.ts`:

```typescript
import type { ExpressionContext } from "@agi-rush/domain";

export function resolveExpression(expr: string | number, ctx: ExpressionContext): number {
	if (typeof expr === "number") return expr;
	const parts = expr.split(/\s+/);
	if (parts.length === 1) {
		return lookupVariable(parts[0], ctx);
	}
	if (parts.length === 3) {
		const left = lookupVariable(parts[0], ctx);
		const op = parts[1];
		const right = Number.parseFloat(parts[2]);
		if (Number.isNaN(right)) return 0;
		if (op === "*") return left * right;
		if (op === "+") return left + right;
		if (op === "-") return left - right;
		if (op === "/") return right !== 0 ? left / right : 0;
	}
	return 0;
}

function lookupVariable(name: string, ctx: ExpressionContext): number {
	if (name === "currentCash") return ctx.currentCash;
	if (name === "currentLoc") return ctx.currentLoc;
	if (name === "currentLocPerSec") return ctx.currentLocPerSec;
	return 0;
}
```

- [ ] **Step 5: Create flops.ts**

```typescript
export function computeFlops(cpu: number, ram: number, storage: number): number {
	return Math.min(cpu, ram) + storage;
}
```

- [ ] **Step 6: Create types.ts (sim-specific types)**

Move sim-specific types from `specs/lib/types.ts` — the types that are only relevant to the simulation, not the domain:

```typescript
export const AiStrategyEnum = {
	balanced: "balanced",
	exec_heavy: "exec_heavy",
	ai_heavy: "ai_heavy",
} as const;
export type AiStrategyEnum = (typeof AiStrategyEnum)[keyof typeof AiStrategyEnum];

export const PurchaseTypeEnum = {
	upgrade: "upgrade",
	tier: "tier",
	tech: "tech",
	ai: "ai",
} as const;
export type PurchaseTypeEnum = (typeof PurchaseTypeEnum)[keyof typeof PurchaseTypeEnum];

export interface SimConfig {
	keysPerSec: number;
	skill: number;
	aiStrategy: AiStrategyEnum;
	maxMinutes: number;
}

export interface SimSnapshot {
	time: number;
	cash: number;
	loc: number;
	flops: number;
	quality: number;
	locPerSec: number;
	cashPerSec: number;
	tier: number;
}

export interface SimLogEntry {
	time: number;
	type: string;
	msg: string;
	cash: number;
	loc: number;
	flops: number;
}

export interface SimPurchase {
	time: number;
	type: PurchaseTypeEnum;
	name: string;
}

export interface SimResult {
	agiTime: number | null;
	endTime: number;
	purchaseCount: number;
	longestWait: number;
	tierTimes: Record<number, number>;
	totalCash: number;
	totalLoc: number;
	finalTier: number;
	finalQuality: number;
	aiModelsOwned: number;
	passed: boolean;
	failures: string[];
	snapshots: SimSnapshot[];
	log: SimLogEntry[];
	purchases: SimPurchase[];
}
```

- [ ] **Step 7: Move and update balance-sim.ts**

Move `specs/lib/balance-sim.ts` → `libs/engine/balance-sim.ts`.

Update its imports from:
```typescript
import type { SimConfig, SimData, SimResult, ... } from "./types";
```
To:
```typescript
import { tiers, upgrades, techNodes, aiModels, balance, events, eventConfig } from "@agi-rush/domain";
import type { Upgrade, TechNode, AiModelData, ... } from "@agi-rush/domain";
import { getUpgradeCost, getEffectiveMax, getTechNodeCost } from "./cost";
import { resolveExpression } from "./expression";
import type { SimConfig, SimResult } from "./types";
```

The sim should import data from domain and use shared cost functions from `./cost`. The `SimData` parameter interface can be removed — the sim reads from domain directly. OR keep it as a parameter so the editor can pass live-edited data. **Keep the parameter approach** — the editor needs to pass unsaved data.

But also export a convenience wrapper that uses bundled data:
```typescript
export function runBalanceSim(data: SimData, config: Partial<SimConfig> = {}): SimResult { ... }

// Convenience: run with bundled data
export function runDefaultBalanceSim(config: Partial<SimConfig> = {}): SimResult {
	return runBalanceSim({
		tiers, upgrades, techTree: { nodes: techNodes },
		aiModels: { models: aiModels, agentSetups: [] },
		balance, events: { events, eventConfig },
	}, config);
}
```

- [ ] **Step 8: Create index.ts**

```typescript
export { getUpgradeCost, getEffectiveMax, getTechNodeCost } from "./cost";
export { resolveExpression } from "./expression";
export { computeFlops } from "./flops";
export { runBalanceSim, runDefaultBalanceSim } from "./balance-sim";
export * from "./types";
```

---

### Task 3: Create libs/design-system

Shared React + Emotion components. Depends on `@agi-rush/domain`.

**Files:**
- Create: `libs/design-system/package.json`
- Create: `libs/design-system/tsconfig.json`
- Create: `libs/design-system/index.ts`
- Create: `libs/design-system/theme.ts`
- Move: `tools/editor/src/pages/tech-tree/tech-node.tsx` → `libs/design-system/tech-tree/tech-node.tsx`
- Move: `tools/editor/src/pages/tech-tree/use-tech-tree-flow.ts` → `libs/design-system/tech-tree/use-tech-tree-flow.ts`
- Move: `tools/editor/src/pages/tech-tree/types.ts` → `libs/design-system/tech-tree/types.ts`
- Move: `tools/editor/src/components/shared/editable-table.tsx` → `libs/design-system/components/editable-table.tsx`

- [ ] **Step 1: Create package.json**

```json
{
	"name": "@agi-rush/design-system",
	"private": true,
	"version": "0.0.0",
	"type": "module",
	"main": "index.ts",
	"types": "index.ts",
	"dependencies": {
		"@agi-rush/domain": "workspace:*"
	},
	"peerDependencies": {
		"@emotion/react": ">=11",
		"@xyflow/react": ">=12",
		"react": ">=19",
		"react-dom": ">=19"
	}
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
	"extends": "../../tsconfig.base.json",
	"compilerOptions": {
		"rootDir": ".",
		"outDir": "dist"
	},
	"include": ["."],
	"references": [{ "path": "../domain" }]
}
```

- [ ] **Step 3: Create theme.ts**

```typescript
export const tierColors: Record<string, string> = {
	garage: "#6272a4",
	freelancing: "#8be9fd",
	startup: "#3fb950",
	tech_company: "#d19a66",
	ai_lab: "#c678dd",
	agi_race: "#e94560",
};

export const colors = {
	bg: "#0a0e14",
	bgPanel: "#161b22",
	bgHover: "#1a2030",
	border: "#1e2630",
	text: "#c9d1d9",
	textMuted: "#6272a4",
	textBright: "#e0e0e0",
	accent: "#58a6ff",
	success: "#3fb950",
	error: "#e94560",
	warning: "#d19a66",
	purple: "#c678dd",
} as const;
```

- [ ] **Step 4: Move tech tree components**

Move the editor's tech tree components to the design system:
```bash
mkdir -p libs/design-system/tech-tree libs/design-system/components
git mv tools/editor/src/pages/tech-tree/tech-node.tsx libs/design-system/tech-tree/
git mv tools/editor/src/pages/tech-tree/use-tech-tree-flow.ts libs/design-system/tech-tree/
git mv tools/editor/src/pages/tech-tree/types.ts libs/design-system/tech-tree/
git mv tools/editor/src/components/shared/editable-table.tsx libs/design-system/components/
```

Update imports in moved files to use `@agi-rush/domain` instead of relative paths. The tech-node.tsx should import `tierColors` from `../theme` instead of hardcoding them.

- [ ] **Step 5: Create index.ts**

```typescript
export { tierColors, colors } from "./theme";
export { TechNodeComponent } from "./tech-tree/tech-node";
export { useTechTreeFlow } from "./tech-tree/use-tech-tree-flow";
export type { TechNode as TechTreeNode } from "./tech-tree/types";
export { EditableTable } from "./components/editable-table";
export type { Column } from "./components/editable-table";
```

---

### Task 4: Move apps/game

Move `src/` → `apps/game/src/` and update all configuration.

**Files:**
- Create: `apps/game/package.json`
- Create: `apps/game/tsconfig.json`
- Move: `rspack.config.ts` → `apps/game/rspack.config.ts`
- Move: `src/` → `apps/game/src/`

- [ ] **Step 1: Create package.json**

```json
{
	"name": "@agi-rush/game",
	"private": true,
	"version": "0.0.0",
	"type": "commonjs",
	"scripts": {
		"dev": "rspack serve",
		"build": "rspack build"
	},
	"dependencies": {
		"@agi-rush/domain": "workspace:*",
		"@agi-rush/engine": "workspace:*",
		"@agi-rush/design-system": "workspace:*",
		"@dagrejs/dagre": "^3.0.0",
		"@emotion/react": "^11.14.0",
		"@xyflow/react": "^12.0.0",
		"react": "^19.1.0",
		"react-dom": "^19.1.0",
		"ts-pattern": "^5.7.0",
		"zustand": "^5.0.5"
	},
	"devDependencies": {
		"@rspack/cli": "^1.3.12",
		"@rspack/core": "^1.3.12",
		"@types/react": "^19.1.2",
		"@types/react-dom": "^19.1.2",
		"typescript": "^5.8.3"
	}
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
	"extends": "../../tsconfig.base.json",
	"compilerOptions": {
		"rootDir": ".",
		"outDir": "dist",
		"paths": {
			"@modules/*": ["src/modules/*"],
			"@components/*": ["src/components/*"],
			"@utils/*": ["src/utils/*"]
		}
	},
	"include": ["src"],
	"references": [
		{ "path": "../../libs/domain" },
		{ "path": "../../libs/engine" },
		{ "path": "../../libs/design-system" }
	]
}
```

- [ ] **Step 3: Move files**

```bash
mkdir -p apps/game
git mv src/ apps/game/src/
git mv rspack.config.ts apps/game/rspack.config.ts
```

- [ ] **Step 4: Update rspack.config.ts**

Update the `apps/game/rspack.config.ts`:
- Fix `__dirname` references (now in `apps/game/`)
- Update path aliases to resolve from new location
- Add aliases for workspace packages if needed (Rspack needs to know where `@agi-rush/*` packages are)
- Entry stays `./src/main.tsx`, HTML template stays `./src/index.html`

Key changes:
```typescript
alias: {
	"@modules": path.resolve(__dirname, "src/modules"),
	"@components": path.resolve(__dirname, "src/components"),
	"@utils": path.resolve(__dirname, "src/utils"),
},
```

- [ ] **Step 5: Update all imports in game app**

Replace all `../../../../specs/data/*.json` imports with `@agi-rush/domain`:

In `apps/game/src/modules/game/store/game-store.ts`:
```typescript
// Before
import balanceData from "../../../../specs/data/balance.json";
import tiersData from "../../../../specs/data/tiers.json";
// etc.

// After
import { tiers, upgrades, techNodes, milestones, balance } from "@agi-rush/domain";
import type { Upgrade, TechNode, Tier, Milestone } from "@agi-rush/domain";
import { getUpgradeCost, getEffectiveMax, getTechNodeCost } from "@agi-rush/engine";
```

Delete `apps/game/src/modules/game/types.ts` — types now come from `@agi-rush/domain`.
Delete `apps/game/src/modules/game/ai-models.ts` — data now comes from `@agi-rush/domain`.
Delete `apps/game/src/modules/event/types.ts` — types now come from `@agi-rush/domain`.
Delete `apps/game/src/modules/event/data/events.ts` — data now comes from `@agi-rush/domain`.
Delete `apps/game/src/modules/event/utils/expression-resolver.ts` — now in `@agi-rush/engine`.
Delete `apps/game/src/utils/balance-sim.ts` — now in `@agi-rush/engine`.

Update ALL files that imported from these deleted modules to import from the workspace packages instead. This affects:
- `modules/game/index.ts` (re-exports)
- `modules/event/index.ts` (re-exports)
- `modules/game/store/game-store.ts` (biggest change)
- `modules/event/store/event-store.ts`
- `modules/event/components/event-toast.tsx`
- `modules/upgrade/components/upgrade-list.tsx`
- `modules/upgrade/components/milestone-list.tsx`
- `modules/game/hooks/use-game-loop.ts`
- `components/god-mode-page.tsx`
- `components/tech-tree-page.tsx`
- `components/sim/*` (all sim components)
- `components/flops-slider.tsx`
- `components/resource-bar.tsx`
- `components/tier-progress.tsx`
- `components/bottleneck-indicator.tsx`

---

### Task 5: Move apps/editor

Move `tools/editor/` → `apps/editor/` and update configuration.

**Files:**
- Move: `tools/editor/` → `apps/editor/`

- [ ] **Step 1: Move files**

```bash
git mv tools/editor apps/editor
rmdir tools  # remove empty directory
```

- [ ] **Step 2: Update package.json**

Update `apps/editor/package.json`:
```json
{
	"name": "@agi-rush/editor",
	"private": true,
	"version": "0.0.0",
	"type": "module",
	"scripts": {
		"dev": "concurrently \"tsx node_modules/@rspack/cli/bin/rspack.js serve\" \"tsx server.ts\"",
		"build": "tsx node_modules/@rspack/cli/bin/rspack.js build",
		"server": "tsx server.ts"
	},
	"dependencies": {
		"@agi-rush/domain": "workspace:*",
		"@agi-rush/engine": "workspace:*",
		"@agi-rush/design-system": "workspace:*",
		"@dagrejs/dagre": "^3.0.0",
		"@emotion/react": "^11.14.0",
		"@xyflow/react": "^12.0.0",
		"cors": "^2.8.5",
		"express": "^5.1.0",
		"react": "^19.1.0",
		"react-dom": "^19.1.0",
		"ts-pattern": "^5.7.0",
		"zustand": "^5.0.5"
	},
	"devDependencies": {
		"@rspack/cli": "^1.3.12",
		"@rspack/core": "^1.3.12",
		"@rspack/plugin-react-refresh": "^1.0.1",
		"@types/dagre": "^0.7.54",
		"@types/express": "^5.0.2",
		"@types/react": "^19.1.2",
		"@types/react-dom": "^19.1.2",
		"concurrently": "^9.1.2",
		"react-refresh": "^0.17.0",
		"tsx": "^4.19.4",
		"typescript": "^5.8.3"
	}
}
```

- [ ] **Step 3: Update tsconfig.json**

```json
{
	"extends": "../../tsconfig.base.json",
	"compilerOptions": {
		"rootDir": ".",
		"outDir": "dist"
	},
	"include": ["src/**/*", "server.ts"],
	"references": [
		{ "path": "../../libs/domain" },
		{ "path": "../../libs/engine" },
		{ "path": "../../libs/design-system" }
	]
}
```

- [ ] **Step 4: Update rspack.config.ts**

Remove the `@shared` alias. Add aliases for workspace packages if needed. Update `__dirname` references.

- [ ] **Step 5: Update server.ts**

The server needs to find the JSON data files. Instead of `../../specs/data`, resolve via the domain package:

```typescript
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const domainDir = path.dirname(require.resolve("@agi-rush/domain/package.json"));
const DATA_DIR = path.join(domainDir, "data");
```

Also update `BALANCE_CHECK` path to `../../specs/balance-check.js`.

- [ ] **Step 6: Update all imports in editor app**

Replace `@shared/*` imports with `@agi-rush/engine`:
- `simulation-page.tsx`: `import { runBalanceSim } from "@agi-rush/engine"`
- `sim-controls.tsx`: `import { AiStrategyEnum } from "@agi-rush/engine"`
- `sim-results.tsx`, `cash-chart.tsx`: `import type { SimResult, SimSnapshot } from "@agi-rush/engine"`

Import shared components from `@agi-rush/design-system`:
- Tech tree page: `import { TechNodeComponent, useTechTreeFlow } from "@agi-rush/design-system"`
- Upgrades page: `import { EditableTable } from "@agi-rush/design-system"`
- Other pages using EditableTable

Import types from `@agi-rush/domain` instead of local `unknown[]` types:
- Store types can use proper domain types

---

### Task 6: Root configuration + cleanup

- [ ] **Step 1: Create root package.json**

Replace root `package.json` with workspaces config:
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
		"typecheck": "tsc --noEmit -p apps/game/tsconfig.json && tsc --noEmit -p apps/editor/tsconfig.json",
		"check": "biome check .",
		"check:fix": "biome check --fix ."
	},
	"devDependencies": {
		"@biomejs/biome": "^2.4.7",
		"typescript": "^5.8.3"
	}
}
```

Move shared dependencies (react, emotion, etc.) to app-level package.json files. Root only has devDependencies for tooling (biome, typescript).

- [ ] **Step 2: Create tsconfig.base.json**

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
		"noEmit": true
	}
}
```

Delete old root `tsconfig.json`.

- [ ] **Step 3: Update biome.json**

Update excludes — no more `specs` exclusion. Add `libs/*/dist`, `apps/*/dist`:
```json
{
	"files": {
		"include": ["**"],
		"ignore": ["**/dist", "**/node_modules", ".claude"]
	}
}
```

- [ ] **Step 4: Update .gitignore**

Add:
```
apps/editor/dist/
apps/editor/node_modules/
```

Remove old `tools/editor` entries if present.

- [ ] **Step 5: Update specs/balance-check.js**

Update the data file paths from `./data/*.json` to resolve from the domain package:
```javascript
const path = require("path");
const domainDir = path.resolve(__dirname, "../libs/domain/data");
```

Update all `require("./data/...")` to `require(path.join(domainDir, "..."))`.

- [ ] **Step 6: Clean up deleted files**

Delete:
- `specs/data/` directory (moved to `libs/domain/data/`)
- `specs/lib/` directory (moved to `libs/engine/`)
- `tools/` directory (moved to `apps/editor/`)
- Old root `tsconfig.json`
- Old root `rspack.config.ts`

- [ ] **Step 7: Update CLAUDE.md**

Update the project CLAUDE.md to reflect the new structure — file paths, commands, architecture description.

- [ ] **Step 8: Install and verify**

```bash
rm -rf node_modules package-lock.json apps/editor/node_modules apps/editor/package-lock.json
npm install
npm run typecheck
npm run build
npm run editor  # verify editor starts
cd specs && node balance-check.js  # verify balance
```

- [ ] **Step 9: Single commit**

```bash
git add -A
git commit -m "♻️ Restructure into npm workspaces monorepo

Move to apps/ (game, editor) + libs/ (domain, engine, design-system).
- libs/domain: JSON data + TypeScript schema types (single source of truth)
- libs/engine: Game math, cost functions, balance sim (no more duplication)
- libs/design-system: Shared React components (tech tree, table, theme)
- apps/game: Main game app (from src/)
- apps/editor: Config editor (from tools/editor/)

All packages linked via npm workspaces with workspace:* protocol."
```
