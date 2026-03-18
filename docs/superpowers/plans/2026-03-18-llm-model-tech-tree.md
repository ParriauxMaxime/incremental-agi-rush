# LLM Model Tech Tree — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 8 named LLM model nodes (GPT-3/3.5/4/4.1/5, Claude Haiku/Sonnet/Opus) to the tech tree, gating AI model deployment behind research.

**Architecture:** New tech tree nodes use a `modelUnlock` effect type that enables models from `ai-models.json` for purchase. The existing `llm_instance` sidebar upgrade is removed — models are now deployed individually via the AI model purchase system. The balance sim is updated to gate AI model purchases behind tech tree unlocks.

**Tech Stack:** TypeScript, Zustand, ts-pattern, JSON data files

**Spec:** `docs/superpowers/specs/2026-03-18-llm-model-tech-tree-design.md`

---

### Task 1: Add new models to ai-models.json

Add GPT-3, GPT-3.5, GPT-4.1, and Claude Haiku to the existing AI models data file, and update `requires` chains for existing models.

**Files:**
- Modify: `specs/data/ai-models.json`

- [ ] **Step 1: Add 4 new model entries**

Insert before the existing `gpt_4` entry:

```json
{
  "id": "gpt_3",
  "family": "gpt",
  "name": "GPT",
  "version": "3",
  "icon": "🟢",
  "tier": "ai_lab",
  "cost": 2000000,
  "locPerSec": 500,
  "flopsCost": 800,
  "codeQuality": 70,
  "special": {
    "id": "verbose",
    "name": "Verbose",
    "description": "+30% LoC/s but lines are 30% fluff (reduced cash value)",
    "locBonus": 0.3,
    "cashPenalty": 0.3
  }
},
{
  "id": "gpt_35",
  "family": "gpt",
  "name": "GPT",
  "version": "3.5",
  "icon": "🟢",
  "tier": "ai_lab",
  "cost": 5000000,
  "locPerSec": 1500,
  "flopsCost": 1500,
  "codeQuality": 78,
  "requires": "gpt_3",
  "special": {
    "id": "chatgpt_moment",
    "name": "ChatGPT moment",
    "description": "+10% cash multiplier for 60s on deploy",
    "timedCashMultiplier": 1.1,
    "duration": 60
  }
}
```

Insert before existing `gpt_5` entry:

```json
{
  "id": "gpt_41",
  "family": "gpt",
  "name": "GPT",
  "version": "4.1",
  "icon": "🟢",
  "tier": "ai_lab",
  "cost": 50000000,
  "locPerSec": 10000,
  "flopsCost": 3500,
  "codeQuality": 88,
  "requires": "gpt_4",
  "special": {
    "id": "efficient",
    "name": "Efficient",
    "description": "20% less FLOPS cost than listed",
    "flopsCostMultiplier": 0.8
  }
}
```

Insert before existing `claude_sonnet` entry:

```json
{
  "id": "claude_haiku",
  "family": "claude",
  "name": "Claude",
  "version": "Haiku",
  "icon": "🟠",
  "tier": "ai_lab",
  "cost": 5000000,
  "locPerSec": 800,
  "flopsCost": 400,
  "codeQuality": 82,
  "special": {
    "id": "fast_cheap",
    "name": "Fast & cheap",
    "description": "Best FLOPS/LoC ratio in the game"
  }
}
```

- [ ] **Step 2: Update requires chains on existing models**

Update `gpt_4` to add `"requires": "gpt_35"` (it currently has no `requires` field).

Update `claude_sonnet` to add `"requires": "claude_haiku"` (it currently has no `requires` field).

`gpt_5` already has `"requires": "gpt_4"` — no change needed.
`claude_opus` already has `"requires": "claude_sonnet"` — no change needed.

- [ ] **Step 3: Commit**

```bash
git add specs/data/ai-models.json
git commit -m "✨ Add GPT-3, GPT-3.5, GPT-4.1, Claude Haiku to ai-models.json"
```

---

### Task 2: Add 8 tech tree nodes to tech-tree.json

Add the model unlock nodes branching from `llm_gate`. Each uses a new `modelUnlock` effect type.

**Files:**
- Modify: `specs/data/tech-tree.json`

- [ ] **Step 1: Add all 8 nodes**

Append these to the `nodes` array in `specs/data/tech-tree.json`. Positions are placed near `llm_gate` (x: -20, y: 780), spreading out below and to the sides:

```json
{
  "id": "openai_gpt3",
  "name": "GPT-3",
  "description": "Unlock GPT-3 for deployment.",
  "icon": "🟢",
  "requires": ["llm_gate"],
  "max": 1,
  "baseCost": 500000,
  "costMultiplier": 1,
  "currency": "cash",
  "effects": [
    { "type": "modelUnlock", "op": "enable", "value": "gpt_3" }
  ],
  "x": -340,
  "y": 780
},
{
  "id": "openai_gpt35",
  "name": "GPT-3.5",
  "description": "Unlock GPT-3.5 for deployment.",
  "icon": "🟢",
  "requires": ["openai_gpt3"],
  "max": 1,
  "baseCost": 1500000,
  "costMultiplier": 1,
  "currency": "cash",
  "effects": [
    { "type": "modelUnlock", "op": "enable", "value": "gpt_35" }
  ],
  "x": -440,
  "y": 860
},
{
  "id": "openai_gpt4",
  "name": "GPT-4",
  "description": "Unlock GPT-4 for deployment.",
  "icon": "🟢",
  "requires": ["openai_gpt35"],
  "max": 1,
  "baseCost": 5000000,
  "costMultiplier": 1,
  "currency": "cash",
  "effects": [
    { "type": "modelUnlock", "op": "enable", "value": "gpt_4" }
  ],
  "x": -540,
  "y": 940
},
{
  "id": "openai_gpt41",
  "name": "GPT-4.1",
  "description": "Unlock GPT-4.1 for deployment.",
  "icon": "🟢",
  "requires": ["openai_gpt4"],
  "max": 1,
  "baseCost": 12000000,
  "costMultiplier": 1,
  "currency": "cash",
  "effects": [
    { "type": "modelUnlock", "op": "enable", "value": "gpt_41" }
  ],
  "x": -640,
  "y": 1020
},
{
  "id": "openai_gpt5",
  "name": "GPT-5",
  "description": "Unlock GPT-5 for deployment.",
  "icon": "🟢",
  "requires": ["openai_gpt4"],
  "max": 1,
  "baseCost": 30000000,
  "costMultiplier": 1,
  "currency": "cash",
  "effects": [
    { "type": "modelUnlock", "op": "enable", "value": "gpt_5" }
  ],
  "x": -440,
  "y": 1020
},
{
  "id": "anthropic_haiku",
  "name": "Claude Haiku",
  "description": "Unlock Claude Haiku for deployment.",
  "icon": "🟠",
  "requires": ["llm_gate"],
  "max": 1,
  "baseCost": 800000,
  "costMultiplier": 1,
  "currency": "cash",
  "effects": [
    { "type": "modelUnlock", "op": "enable", "value": "claude_haiku" }
  ],
  "x": 200,
  "y": 780
},
{
  "id": "anthropic_sonnet",
  "name": "Claude Sonnet",
  "description": "Unlock Claude Sonnet for deployment.",
  "icon": "🟠",
  "requires": ["anthropic_haiku"],
  "max": 1,
  "baseCost": 5000000,
  "costMultiplier": 1,
  "currency": "cash",
  "effects": [
    { "type": "modelUnlock", "op": "enable", "value": "claude_sonnet" }
  ],
  "x": 300,
  "y": 860
},
{
  "id": "anthropic_opus",
  "name": "Claude Opus",
  "description": "Unlock Claude Opus for deployment.",
  "icon": "🟠",
  "requires": ["anthropic_sonnet"],
  "max": 1,
  "baseCost": 25000000,
  "costMultiplier": 1,
  "currency": "cash",
  "effects": [
    { "type": "modelUnlock", "op": "enable", "value": "claude_opus" }
  ],
  "x": 400,
  "y": 940
}
```

Note: The `modelUnlock` effect uses `value` as a string (the model ID). This is a new pattern — the `UpgradeEffect` type currently types `value` as `number | boolean`. Task 3 will update the type to also accept `string`.

- [ ] **Step 2: Commit**

```bash
git add specs/data/tech-tree.json
git commit -m "✨ Add 8 LLM model tech tree nodes"
```

---

### Task 3: Update TypeScript types for modelUnlock effect

The `UpgradeEffect` interface needs `value` to accept `string` for the `modelUnlock` type. This applies both to the shared types file and the balance sim's local type definitions.

**Files:**
- Modify: `src/modules/game/types.ts:12-17`
- Modify: `src/utils/balance-sim.ts:89-98` (TechNodeData interface)
- Modify: `src/utils/balance-sim.ts:244-246` (applyEffects parameter type)

- [ ] **Step 1: Update UpgradeEffect value type**

In `src/modules/game/types.ts`, change the `value` field:

```typescript
export interface UpgradeEffect {
	type: string;
	op: "add" | "multiply" | "enable" | "set";
	value: number | boolean | string;
	doubleInterval?: number;
}
```

- [ ] **Step 2: Update balance-sim.ts TechNodeData effects type**

In `src/utils/balance-sim.ts`, update the `TechNodeData` interface (line 97):

```typescript
	effects: Array<{ type: string; op: string; value: number | boolean | string }>;
```

- [ ] **Step 3: Update balance-sim.ts applyEffects parameter type**

In `src/utils/balance-sim.ts`, update the `applyEffects` function signature (line 245):

```typescript
function applyEffects(
    effects: Array<{ type: string; op: string; value: number | boolean | string }>,
): void {
```

- [ ] **Step 4: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors (this is a widening change, existing code handles `value as number` which still works)

- [ ] **Step 5: Commit**

```bash
git add src/modules/game/types.ts src/utils/balance-sim.ts
git commit -m "♻️ Widen UpgradeEffect.value to accept string for modelUnlock"
```

---

### Task 4: Add modelUnlock tracking to game store

Track which models are unlocked via tech tree and gate AI model purchases behind those unlocks.

**Files:**
- Modify: `src/modules/game/types.ts:77-124` (GameState interface)
- Modify: `src/modules/game/store/game-store.ts:28-67` (initialState)
- Modify: `src/modules/game/store/game-store.ts:110-266` (recalcDerivedStats)

- [ ] **Step 1: Add unlockedModels to GameState**

In `src/modules/game/types.ts`, add to the `GameState` interface after `agentMaxBonus: number;`:

```typescript
	/** Model IDs unlocked via tech tree (modelUnlock effect) */
	unlockedModels: Record<string, boolean>;
```

- [ ] **Step 2: Add to initialState**

In `src/modules/game/store/game-store.ts`, add to `initialState` after `agentMaxBonus: 0,`:

```typescript
	unlockedModels: {},
```

**Important:** `unlockedModels` is a derived field recomputed from `ownedTechNodes` by `recalcDerivedStats`. Do NOT add it to the `partialize` function in the Zustand persist config — it will be recomputed on rehydration automatically.

- [ ] **Step 3: Handle modelUnlock in recalcDerivedStats**

In `src/modules/game/store/game-store.ts`, inside `recalcDerivedStats`:

Add a local variable at the top of the function (after `let tierIndex = ...`):

```typescript
	const unlockedModels: Record<string, boolean> = {};
```

Add a new match case inside `applyEffect` (before the `.otherwise(() => {})` line):

```typescript
			.with({ type: "modelUnlock", op: "enable" }, () => {
				const modelId = effect.value as string;
				unlockedModels[modelId] = true;
			})
```

At the bottom of `recalcDerivedStats`, after `state.currentTierIndex = tierIndex;`:

```typescript
	state.unlockedModels = unlockedModels;
```

- [ ] **Step 4: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/modules/game/types.ts src/modules/game/store/game-store.ts
git commit -m "✨ Track unlocked models via modelUnlock effect in game store"
```

**Note:** The AI model purchase UI does not exist yet — models are only purchased in the balance sim. The `unlockedModels` state is available for when the model purchase UI is built (it should check `state.unlockedModels[modelId]` before allowing purchase). This is not blocking for the current plan.

---

### Task 5: Remove llm_instance and gate model purchases behind tech tree

Remove the generic `llm_instance` upgrade and update any code that references it. Models from `ai-models.json` that have corresponding tech tree nodes should only be purchasable when unlocked.

**Files:**
- Modify: `specs/data/upgrades.json`
- Modify: `src/utils/balance-sim.ts:490-497` (AI model availability filter)

- [ ] **Step 1: Remove llm_instance from upgrades.json**

In `specs/data/upgrades.json`, remove the entire `llm_instance` object (the entry with `"id": "llm_instance"`).

- [ ] **Step 2: Update balance sim to gate models behind tech tree**

In `src/utils/balance-sim.ts`, the AI model availability filter (around line 491-497) currently checks:

```typescript
const availModels =
    sim.currentTier >= 4
        ? aiModels.filter(
                (m) =>
                    !sim.ownedModels[m.id] &&
                    (!m.requires || sim.ownedModels[m.requires]),
            )
        : [];
```

Define the set of tech-tree-gated model IDs at the top of `runBalanceSim` (after the `sim` object):

```typescript
const techGatedModels: Record<string, string> = {
    gpt_3: "openai_gpt3",
    gpt_35: "openai_gpt35",
    gpt_4: "openai_gpt4",
    gpt_41: "openai_gpt41",
    gpt_5: "openai_gpt5",
    claude_haiku: "anthropic_haiku",
    claude_sonnet: "anthropic_sonnet",
    claude_opus: "anthropic_opus",
};
```

Update the filter to also check tech tree ownership:

```typescript
const availModels =
    sim.currentTier >= 4
        ? aiModels.filter((m) => {
                if (sim.ownedModels[m.id]) return false;
                if (m.requires && !sim.ownedModels[m.requires]) return false;
                const gateNode = techGatedModels[m.id];
                if (gateNode && !(sim.ownedTech[gateNode] ?? 0)) return false;
                return true;
            })
        : [];
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add specs/data/upgrades.json src/utils/balance-sim.ts
git commit -m "✨ Remove llm_instance, gate AI models behind tech tree in balance sim"
```

---

### Task 6: Update balance sim tech node valuation for modelUnlock

The balance sim's tech node purchasing heuristic doesn't know how to value `modelUnlock` effects. Add valuation so the sim will research model unlock nodes.

**Files:**
- Modify: `src/utils/balance-sim.ts:426-467` (tech node value calculation)

- [ ] **Step 1: Add modelUnlock valuation**

In `src/utils/balance-sim.ts`, inside the tech node value loop (`for (const n of availTech)` block), add a case for `modelUnlock` effects. Find the section after the `cashMultiplier` valuation (around line 455) and before the `if (cost > 0 && val / cost > bestTechVal)` line, add:

```typescript
					if (e.type === "modelUnlock") {
						const modelId = e.value as string;
						const model = aiModels.find((x) => x.id === modelId);
						if (model) {
							val +=
								(model.locPerSec * sim.aiLocMultiplier * cashPerLoc()) /
								(model.cost + cost);
						}
					}
```

This values model unlock nodes based on the model's production potential relative to total cost (unlock + deploy), using the same formula the sim uses for direct AI model purchases.

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/utils/balance-sim.ts
git commit -m "✨ Add modelUnlock valuation to balance sim tech heuristic"
```

---

### Task 7: Run balance check and tune

Validate the game still passes balance checks with the new model tree.

**Files:**
- Possibly modify: `specs/data/tech-tree.json` (node costs)
- Possibly modify: `specs/data/ai-models.json` (model costs/stats)

- [ ] **Step 1: Run balance check**

```bash
cd /home/maxime/Documents/emergence/agi-rush/specs && node balance-check.js --verbose
```

Expected: All 3 profiles (casual/average/fast) should pass. If not, note which checks fail.

- [ ] **Step 2: Tune if needed**

If balance fails, adjust:
- **AGI too slow:** Lower tech tree node unlock costs or model deploy costs
- **AGI too fast:** Raise costs
- **Longest wait too high:** Lower costs of early models (GPT-3, Claude Haiku)
- **Too few purchases:** The two-cost structure (tree + deploy) should naturally increase purchase count

Re-run balance check after each adjustment until all pass.

- [ ] **Step 3: Commit**

```bash
git add specs/data/tech-tree.json specs/data/ai-models.json
git commit -m "⚖️ Tune LLM model costs for balance"
```

---

### Task 8: Verify full build and lint

Final verification that everything compiles and passes lint.

**Files:** None (verification only)

- [ ] **Step 1: Run typecheck**

```bash
cd /home/maxime/Documents/emergence/agi-rush && npm run typecheck
```

Expected: no errors

- [ ] **Step 2: Run biome lint**

```bash
cd /home/maxime/Documents/emergence/agi-rush && npm run check
```

Expected: no errors (or only pre-existing ones)

- [ ] **Step 3: Run dev server smoke test**

```bash
cd /home/maxime/Documents/emergence/agi-rush && npm run build
```

Expected: build succeeds

- [ ] **Step 4: Commit any fixes if needed**

```bash
git add -A && git commit -m "🐛 Fix lint/type issues from LLM model tree"
```
