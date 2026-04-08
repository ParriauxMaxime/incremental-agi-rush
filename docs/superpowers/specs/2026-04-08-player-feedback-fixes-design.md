# Player Feedback Fixes — 2026-04-08

Three changes based on playtester feedback: fix the LoC/s display bug, improve AI/token clarity, and rebalance T4 AI model pricing.

## 1. LoC/s Display Fix

### Problem

The stats panel displays `keysPerSec * locPerKey` as the "You" LoC/s rate. But in the non-streaming editor, keystrokes go through `advanceTokens()` which advances *visual tokens*, not LoC directly. Each visual token only produces `block.loc / block.totalTokens` LoC — a fraction of 1.

Result: display shows 55 LoC/s, actual production is ~15 LoC/s. Player sees "55 LoC/s with 27 FLOPS" and wonders why the queue is going down.

The streaming editor (`addLoc(locPerKey)`) doesn't have this bug — it adds `locPerKey` LoC per keystroke directly.

### Fix

Expose the actual LoC-per-keystroke from the code typing system.

**Changes:**

1. **`game-store.ts`** — Add `effectiveLocPerKey: number` to game state (default = `locPerKey`).

2. **`use-code-typing.ts`** — When the current block changes (line 136-141, block completion), compute and store:
   ```
   effectiveLocPerKey = locPerKey * (block.loc / tokenizeBlock(block).length)
   ```
   Call `useGameStore.getState().setEffectiveLocPerKey(value)` or update via a setter.

3. **`stats-loc-section.tsx`** — Replace `locPerKey` with `effectiveLocPerKey` in:
   - Line 92: `typingLocPerSec = Math.max(keysPerSec, autoTypeKeysPerSec) * effectiveLocPerKey`
   - Line 129: `locPerSec: effectiveKeysPerSec * effectiveLocPerKey`

4. **`streaming-editor.tsx`** — Line 183 and 185 already use `state.locPerKey` for `typingLocPerSec` display. In streaming mode, `effectiveLocPerKey` should equal `locPerKey` since `addLoc(locPerKey)` is called directly. Set this when entering streaming mode.

5. **Editor footer** — The "X LoC/key" label in both `editor.tsx` (line 398) and `streaming-editor.tsx` (line 255) should also use `effectiveLocPerKey` in non-streaming mode so the footer matches reality.

**What stays the same:** All production mechanics, `addLoc`, `advanceTokens`, tick function, auto-type hook. This is display-only.

---

## 2. AI/Token Clarity

### Problem

Players don't understand the token mechanic at T4. The triple gate (tokens + FLOPS saturation + FLOPS slider) is too much to grasp at once. The tutorial is a single line. The stats panel shows raw numbers without explaining what they mean or what to do.

### Fix: Better tutorial + clearer stats panel + explicit slider labels

No mechanic changes. All changes are UI text and layout.

### 2a. T4 Tutorial Rewrite

Current text: `"AI Lab online. Workers now produce tokens instead of LoC.\nAI models consume tokens + FLOPS → massive LoC output."`

New text (English, then translate to all 8 locales):
```
The age of writing code is over.

Your workers now produce tokens — the atomic units AI models
consume to generate LoC at massive scale.

Split your compute: FLOPS execute queued code into cash,
or power AI models to generate more code.
```

This is an i18n change in `apps/game/src/i18n/locales/{en,fr,it,de,es,pl,zh,ru}/tutorial.json`.

### 2b. Token Stats Panel Diagnostic

Add a one-line diagnostic message at the top of `StatsTokensSection` that tells the player what's bottlenecking them:

| Condition | Message | Color |
|-----------|---------|-------|
| `tokenEfficiency < 0.5` | "AI is starving — need more workers" | Red |
| `tokenEfficiency < 0.9` | "AI needs more tokens" | Yellow |
| `saturation < 0.5` | "AI needs more compute — move FLOPS slider" | Red |
| `saturation < 0.9` | "AI needs more FLOPS" | Yellow |
| Both >= 0.9 | "AI running at full capacity" | Green |

Priority: token bottleneck message takes precedence over FLOPS if both are low (tokens are harder to understand, so surface them first).

These messages need i18n across all 8 locales (new keys in `ui.json` namespace).

### 2c. Token Stats Panel Flow Redesign

Reorganize the existing `StatsTokensSection` layout into a clear top-to-bottom pipeline. Same data, better visual hierarchy:

```
[Diagnostic message]                    ← NEW (2b)

Workers → 5K tokens/s                   ← existing "Produced" row
  ████████████░░░░  consumed / surplus   ← existing bar
  🪙 4.5K/s → 30K LoC/s  |  +500 direct ← existing summary

AI demands 4.5K tokens/s (100%)         ← existing demand row, keep as-is
FLOPS saturation: 85%                   ← existing, keep as-is

[Per-model rows]                        ← existing, keep as-is
```

The actual layout stays structurally the same — we're just adding the diagnostic at the top. No component restructure needed.

### 2d. FLOPS Slider Label Update

Current labels:
- Left: `"Exec {{count}} FLOPS"`
- Right: `"AI {{count}} FLOPS"`
- Bottom-left: `"{{count}} loc/s exec"`
- Bottom-right: `"{{count}} loc/s gen"`

New labels:
- Left: `"Execute LoC {{count}} FLOPS"`
- Right: `"Generate LoC {{count}} FLOPS"`
- Bottom-left: `"{{count}} LoC/s executed"`
- Bottom-right: `"{{count}} LoC/s generated"`

i18n keys to update in all 8 locales:
- `flops_slider.exec_flops`
- `flops_slider.ai_flops`
- `flops_slider.exec_rate`
- `flops_slider.ai_rate`

---

## 3. T4 AI Model Price Rebalance

### Problem

T4 AI models are too cheap. Players buy multiple models before understanding how one works. The tech tree gate (`llm_gate` at 6M) is also trivially affordable at T4 entry (35M to unlock the tier).

### Strategy: Cheap entry, steep mid-curve, modest late bump

The first model should be affordable so the player gets a taste. The second and third models should be expensive enough that the player is forced to sit with one model, learn the token/FLOPS system, and save up before scaling.

### Price Changes

**`llm_gate` tech node:** 6M → 12M (bump to create a small gap after T4 unlock).

**AI model costs (`libs/domain/data/ai-models.json`):**

| Model | Current | New | Rationale |
|-------|---------|-----|-----------|
| GPT-3 | 15M | 15M | Cheapest entry, keep accessible |
| Claude Haiku | 20M | 20M | Entry tier, keep |
| Copilot | 25M | 25M | Entry tier, keep |
| GPT-3.5 | 30M | 60M | 2x — first "step up" should feel like saving |
| Llama 70B | 35M | 70M | 2x |
| Mistral Large | 50M | 120M | ~2.5x — mid tier |
| Gemini Pro | 60M | 150M | 2.5x — mid tier |
| Claude Sonnet | 80M | 200M | 2.5x — premium mid |
| GPT-4 | 100M | 250M | 2.5x — late mid |
| GPT-4.1 | 140M | 350M | 2.5x |
| DeepSeek V2 | 150M | 350M | ~2.3x |
| Llama 405B | 250M | 500M | 2x — high end of T4 |
| Claude Opus | 10B | 10B | T5 entry, keep |
| GPT-5 | 30B | 30B | Keep |
| Gemini Ultra | 100B | 100B | Keep |
| DeepSeek R1 | 250B | 250B | Keep |
| GPT-6 | 500B | 500B | Keep |
| Claude Mythos | 2T | 2T | Keep |
| GPT-7 | 5T | 5T | Keep |
| Gemini Supreme | 5T | 5T | Keep |
| Claude Universe | 20T | 20T | Keep |

**Model unlock tech nodes (`libs/domain/data/tech-tree.json`):** The tech nodes that unlock models (e.g., `openai_gpt3` at 15M, `anthropic_haiku` at 30M) should also be bumped proportionally to match the new model costs. These are the "research" cost to unlock the model for purchase.

### Validation

Run `npm run sim` after changes. All 3 profiles (casual 4 keys/s, average 6 keys/s, fast 9 keys/s) must complete within ~35-40 min target. The sim will flag if T4 progression is too slow.

If the sim shows T4 taking too long, reduce mid-tier multipliers from 2.5x to 2x. The entry models must stay cheap.

---

## Files Changed

| File | Change |
|------|--------|
| `apps/game/src/modules/game/store/game-store.ts` | Add `effectiveLocPerKey` state + setter |
| `apps/game/src/modules/editor/hooks/use-code-typing.ts` | Compute and store `effectiveLocPerKey` on block change |
| `apps/game/src/components/stats-loc-section.tsx` | Use `effectiveLocPerKey` for display |
| `apps/game/src/components/stats-tokens-section.tsx` | Add diagnostic message at top |
| `apps/game/src/components/flops-slider.tsx` | Update label i18n keys |
| `apps/game/src/modules/editor/components/editor.tsx` | Use `effectiveLocPerKey` in footer |
| `apps/game/src/modules/editor/components/streaming-editor.tsx` | Use `effectiveLocPerKey` in footer + set it = locPerKey on streaming mode entry |
| `apps/game/src/i18n/locales/*/tutorial.json` | T4 tutorial rewrite (8 locales) |
| `apps/game/src/i18n/locales/*/ui.json` | New diagnostic keys + slider label updates (8 locales) |
| `libs/domain/data/ai-models.json` | Price changes for T4 models |
| `libs/domain/data/tech-tree.json` | `llm_gate` cost bump + model unlock node cost adjustments |

## Out of Scope

These items from the feedback are tracked in `docs/player-feedback-2026-04-08.md` but not addressed in this spec:
- Prestige confirmation modal
- End game close button reset behavior
- GitHub Stars event bug
- Sound volume settings
- God mode terminal command
- Auto-type removal consideration
