# Token Economy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At T4+ (AI Lab), human workers split their output between tokens (to feed AI models) and direct LoC (surplus). AI models consume tokens + FLOPS to generate massive LoC. At T5, AI Agents produce tokens autonomously.

**Architecture:** Add `tokens` resource to game store. Modify the tick loop so at T4+, `autoLocPerSec` splits into token production (capped at AI demand) and direct LoC (surplus). AI models gain a `tokenCost` field. The stats panel and status bar show the token pipeline. New burnout events create pressure at T4.

**Tech Stack:** React 19, Zustand, TypeScript, existing game loop

**Spec:** Visual design at `.superpowers/brainstorm/*/content/token-design-v4.html`

---

## Coherence Check

Before implementation, verify these invariants:

1. **T0-T3 unchanged**: No tokens, no AI, no new UI. Humans produce LoC. FLOPS execute. Cash flows. All existing gameplay identical.
2. **T4 flip**: When `aiUnlocked === true`, human output splits. `tokensProduced = min(humanOutput, aiTokenDemand)`. `directLoc = humanOutput - tokensProduced`. AI output: `locPerSec × min(1, tokensProduced / tokenDemand) × flopEfficiency`.
3. **No token stockpile**: Tokens are consumed instantly each tick (like FLOPS). No queue, no accumulation. The split is computed per-tick.
4. **Surplus goes to LoC**: If humans produce more than AI needs, the surplus is added directly to LoC (same as pre-T4 behavior for that portion).
5. **T5 agents produce tokens**: `agentLoc` effect type becomes dual: at T4+ it produces tokens, not LoC. Same numbers.
6. **Balance will be done separately**: Token costs on AI models will be tuned after implementation. Use placeholder values that roughly match `flopsCost / 10` for now.

---

### Task 1: Add `tokenCost` field to AI model data

**Files:**
- Modify: `libs/domain/types/ai-model.ts`
- Modify: `libs/domain/data/ai-models.json`

- [ ] **Step 1: Add `tokenCost` to AiModelData interface**

In `libs/domain/types/ai-model.ts`, add after `flopsCost: number;`:

```typescript
tokenCost: number;
```

- [ ] **Step 2: Add `tokenCost` to every model in ai-models.json**

Add `"tokenCost"` field to each model. Use `Math.round(flopsCost / 10)` as initial values:

| Model | flopsCost | tokenCost |
|-------|-----------|-----------|
| copilot | 800,000 | 80,000 |
| claude_haiku | 500,000 | 50,000 |
| claude_sonnet | 2,000,000 | 200,000 |
| openai_gpt3 | 1,000,000 | 100,000 |
| openai_gpt35 | 1,500,000 | 150,000 |
| openai_gpt4 | 3,000,000 | 300,000 |
| llama_70b | 1,200,000 | 120,000 |
| llama_405b | 5,000,000 | 500,000 |
| gemini_pro | 2,500,000 | 250,000 |
| grok_2 | 4,000,000 | 400,000 |
| grok_3 | 15,000,000 | 1,500,000 |
| openai_gpt5 | 25,000,000 | 2,500,000 |
| openai_gpt6 | 50,000,000 | 5,000,000 |
| openai_gpt7 | 200,000,000 | 20,000,000 |
| anthropic_opus | 10,000,000 | 1,000,000 |
| anthropic_saga | 30,000,000 | 3,000,000 |
| anthropic_universe | 100,000,000 | 10,000,000 |
| google_gemini_supreme | 40,000,000 | 4,000,000 |

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`

- [ ] **Step 4: Commit**

```bash
git add libs/domain/types/ai-model.ts libs/domain/data/ai-models.json
git commit -m "⚖️ Add tokenCost field to AI models"
```

---

### Task 2: Add token state to game store

**Files:**
- Modify: `apps/game/src/modules/game/store/game-store.ts`

- [ ] **Step 1: Add token fields to GameState interface**

After `totalExecutedLoc: number;` add:

```typescript
tokens: number;
totalTokens: number;
```

- [ ] **Step 2: Add initial values**

In `initialState`, after `totalExecutedLoc: 0,` add:

```typescript
tokens: 0,
totalTokens: 0,
```

- [ ] **Step 3: Persist tokens**

In the `partialize` function, add `tokens` and `totalTokens` to the persisted fields.

- [ ] **Step 4: Add tokens to GodModeOverrides**

Add `tokens?: number;` and `totalTokens?: number;` to `GodModeOverrides`.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`

- [ ] **Step 6: Commit**

```bash
git add apps/game/src/modules/game/store/game-store.ts
git commit -m "✨ Add tokens resource to game store"
```

---

### Task 3: Modify tick loop for token split at T4+

This is the core mechanic. At T4+, the `autoLocPerSec` output splits between tokens (for AI) and direct LoC (surplus).

**Files:**
- Modify: `apps/game/src/modules/game/store/game-store.ts` (tick function)

- [ ] **Step 1: Rewrite the LoC production + AI section of the tick**

Replace the current "LoC production" and "AI production" blocks in the tick function with:

```typescript
// ── 1. Production (rate-based) ──
const aiUnlocked = s.aiUnlocked;
let humanOutput = s.autoLocPerSec * dt; // total human production this tick
let aiProduced = 0;
let tokensConsumed = 0;

if (aiUnlocked && s.running) {
    // Compute total AI token demand
    const activeModels = aiModels
        .filter((m) => s.unlockedModels[m.id])
        .sort((a, b) => b.locPerSec - a.locPerSec)
        .slice(0, s.llmHostSlots);

    let totalTokenDemand = 0;
    let totalAiFlopsCost = 0;
    for (const model of activeModels) {
        totalTokenDemand += model.tokenCost * dt;
        totalAiFlopsCost += model.flopsCost;
    }

    // Split human output: tokens first, surplus to LoC
    tokensConsumed = Math.min(humanOutput, totalTokenDemand);
    const directLoc = humanOutput - tokensConsumed;

    // Token efficiency: how much of AI demand is satisfied
    const tokenEfficiency = totalTokenDemand > 0
        ? tokensConsumed / totalTokenDemand
        : 0;

    // AI LoC output (gated by both tokens AND FLOPS)
    let remainingFlops = s.flops;
    for (const model of activeModels) {
        const modelFlops = Math.min(model.flopsCost, remainingFlops);
        remainingFlops -= modelFlops;
        const flopRatio = model.flopsCost > 0 ? modelFlops / model.flopsCost : 0;
        aiProduced += model.locPerSec * tokenEfficiency * Math.min(1, flopRatio) * dt;
    }

    // Add direct LoC (surplus human output) + AI output
    loc += directLoc + aiProduced;
    totalLoc += directLoc + aiProduced;
} else {
    // Pre-T4: all human output goes to LoC directly
    loc += humanOutput;
    totalLoc += humanOutput;
}

// Track tokens consumed (for UI display)
const newTokens = s.tokens + tokensConsumed;
const newTotalTokens = s.totalTokens + tokensConsumed;
```

- [ ] **Step 2: Update the execution section**

The execution section uses `s.flops - aiFlopsCost`. Update to use the computed `remainingFlops` from the AI section, or recompute:

```typescript
// ── 2. Execution ──
let execFlopsBudget: number;
if (aiUnlocked) {
    // FLOPS remaining after AI models consume their share
    let aiFlopsCost = 0;
    const activeModels = aiModels
        .filter((m) => s.unlockedModels[m.id])
        .sort((a, b) => b.locPerSec - a.locPerSec)
        .slice(0, s.llmHostSlots);
    for (const model of activeModels) {
        aiFlopsCost += model.flopsCost;
    }
    execFlopsBudget = Math.max(0, s.flops - Math.min(aiFlopsCost, s.flops));
} else {
    execFlopsBudget = s.flops;
}
```

- [ ] **Step 3: Include tokens in the state update**

Add to the `next` partial state object:

```typescript
tokens: newTokens,
totalTokens: newTotalTokens,
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`

- [ ] **Step 5: Commit**

```bash
git add apps/game/src/modules/game/store/game-store.ts
git commit -m "✨ Token split mechanic: humans feed AI with tokens, surplus → LoC"
```

---

### Task 4: Show tokens in status bar at T4+

**Files:**
- Modify: `apps/game/src/components/status-bar.tsx`

- [ ] **Step 1: Read aiUnlocked and tokens from store**

Add:

```typescript
const aiUnlocked = useGameStore((s) => s.aiUnlocked);
const tokens = useGameStore((s) => s.tokens);
```

- [ ] **Step 2: Conditionally show tokens in the status bar**

After the cash stat, add (only when `aiUnlocked`):

```typescript
{aiUnlocked && (
    <span css={statCss}>🪙 {formatNumber(tokens)} tokens</span>
)}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`

- [ ] **Step 4: Commit**

```bash
git add apps/game/src/components/status-bar.tsx
git commit -m "✨ Show tokens in status bar at T4+"
```

---

### Task 5: Update stats panel — Token Sources section at T4+

**Files:**
- Modify: `apps/game/src/components/stats-panel.tsx`

- [ ] **Step 1: When `aiUnlocked`, rename "LoC Sources" to "Token Sources"**

Change the section label and total to show token production vs AI demand:

```typescript
<div css={sectionLabelCss}>
    {aiUnlocked ? "Token Sources" : "LoC Sources"}
</div>
<span style={{ color: aiUnlocked ? theme.cashColor : theme.locColor }}>
    {aiUnlocked
        ? `${formatNumber(autoLocPerSec + locPerKey * 6)}/s → AI`
        : `${formatNumber(autoLocPerSec + locPerKey * 6 + aiSources.reduce((sum, s) => sum + s.locPerSec, 0))}/s`
    }
</span>
```

- [ ] **Step 2: Show token supply/demand summary**

Below the source rows, when `aiUnlocked`, add a supply vs demand line:

```typescript
{aiUnlocked && (
    <div style={{
        borderTop: `1px solid ${theme.border}`,
        marginTop: 8,
        paddingTop: 8,
        display: "flex",
        justifyContent: "space-between",
        fontSize: 11,
    }}>
        <span style={{ color: theme.cashColor }}>
            Supply: {formatNumber(humanTotal)}/s
        </span>
        <span style={{ color: tokenEfficiency >= 1 ? theme.success : "#f14c4c" }}>
            {tokenEfficiency >= 1 ? "AI fed ✓" : `AI at ${Math.round(tokenEfficiency * 100)}%`}
        </span>
    </div>
)}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`

- [ ] **Step 4: Commit**

```bash
git add apps/game/src/components/stats-panel.tsx
git commit -m "✨ Stats panel shows Token Sources with supply/demand at T4+"
```

---

### Task 6: Add burnout events (T4 only)

**Files:**
- Modify: `libs/domain/data/events.json`
- Modify: `libs/domain/types/event.ts` (add `tokenProduction` effect type)

- [ ] **Step 1: Add `tokenProduction` to EventEffect union**

In `libs/domain/types/event.ts`, add to the EventEffect union:

```typescript
| { type: "tokenProduction"; op: "multiply"; value: number }
```

Also add to `EventModifiers`:

```typescript
tokenProductionMultiplier: number;
```

And update `DEFAULT_EVENT_MODIFIERS`:

```typescript
tokenProductionMultiplier: 1,
```

- [ ] **Step 2: Add burnout events to events.json**

Add these events:

```json
{
    "id": "dev_burnout",
    "name": "Dev Burnout",
    "description": "Your developers are exhausted. Token production -50% for 30s.",
    "icon": "🔥",
    "minTier": "ai_lab",
    "duration": 30,
    "effects": [{ "type": "tokenProduction", "op": "multiply", "value": 0.5 }],
    "interaction": { "type": "mash_keys", "reductionPerKey": 0.5 },
    "weight": 3
},
{
    "id": "prompt_fatigue",
    "name": "Prompt Fatigue",
    "description": "Low-quality prompts. AI efficiency -30% for 20s.",
    "icon": "😤",
    "minTier": "ai_lab",
    "duration": 20,
    "effects": [{ "type": "tokenProduction", "op": "multiply", "value": 0.7 }],
    "weight": 2
},
{
    "id": "prompt_breakthrough",
    "name": "Prompt Breakthrough",
    "description": "Perfect prompt discovered! Token production ×3 for 15s.",
    "icon": "💡",
    "minTier": "ai_lab",
    "duration": 15,
    "effects": [{ "type": "tokenProduction", "op": "multiply", "value": 3 }],
    "weight": 1
}
```

- [ ] **Step 3: Handle tokenProductionMultiplier in event store**

In the event store's `getEventModifiers`, add handling for the `tokenProduction` effect type, computing `tokenProductionMultiplier`.

- [ ] **Step 4: Apply tokenProductionMultiplier in the tick loop**

In the tick's token split section, multiply `humanOutput` by `eventMods.tokenProductionMultiplier` before splitting.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`

- [ ] **Step 6: Commit**

```bash
git add libs/domain/types/event.ts libs/domain/data/events.json apps/game/src/modules/event/store/event-store.ts apps/game/src/modules/game/store/game-store.ts
git commit -m "✨ Add burnout events: Dev Burnout, Prompt Fatigue, Prompt Breakthrough"
```

---

### Task 7: Terminal tutorial message at T4 transition

**Files:**
- Modify: `apps/game/src/components/tutorial-screen.tsx`

- [ ] **Step 1: Add T4 tutorial tip**

Add a new tip and trigger for AI Lab unlock:

```typescript
{
    id: "ai_lab_tokens",
    lines: [
        "$ switch --mode ai-lab",
        "✓ Human workers now produce tokens instead of LoC.",
        "",
        "AI models consume tokens + FLOPS to generate massive LoC.",
        "More humans = more tokens = more AI output.",
    ],
},
```

Trigger:

```typescript
{
    id: "ai_lab_tokens",
    test: (s) => s.aiUnlocked,
},
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/components/tutorial-screen.tsx
git commit -m "✨ Tutorial tip for T4 token mechanic"
```

---

### Task 8: God Mode — add tokens to resource bumps

**Files:**
- Modify: `apps/game/src/components/god-mode-page.tsx`

- [ ] **Step 1: Add tokens to the resourceRows array**

Add after the FLOPS entry:

```typescript
{
    key: "tokens",
    label: "Tokens",
    color: "#d4a574",
    bumps: [1_000, 100_000, 10_000_000],
},
```

- [ ] **Step 2: Typecheck and commit**

```bash
git add apps/game/src/components/god-mode-page.tsx
git commit -m "✨ God Mode: add token resource bumps"
```

---

### Task 9: Verify and balance check

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`

- [ ] **Step 2: Run biome check**

Run: `npm run check:fix`

- [ ] **Step 3: Run balance sim**

Run: `npm run sim`

Note: The sim may need updates to handle the token mechanic. If it fails, the balance tuning will be done separately as agreed.

- [ ] **Step 4: Build check**

Run: `npm run build`

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -u
git commit -m "🐛 Fix issues from token economy implementation"
```
