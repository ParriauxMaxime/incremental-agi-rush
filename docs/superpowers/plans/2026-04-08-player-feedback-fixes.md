# Player Feedback Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the LoC/s display bug, improve AI/token system clarity, and rebalance T4 AI model pricing based on playtester feedback.

**Architecture:** Three independent changes — (1) expose `effectiveLocPerKey` from the code typing system to fix the stats display, (2) update tutorial text, FLOPS slider labels, and add a diagnostic message to the token stats panel, (3) adjust AI model and tech tree costs in JSON data files. All changes are additive; no mechanic modifications.

**Tech Stack:** React 19, Zustand, Emotion, i18next, TypeScript strict mode, Biome

---

## File Structure

| File | Change Type | Responsibility |
|------|-------------|----------------|
| `apps/game/src/modules/game/store/game-store.ts` | Modify | Add `effectiveLocPerKey` state field + setter |
| `apps/game/src/modules/editor/hooks/use-code-typing.ts` | Modify | Compute `effectiveLocPerKey` on block change, push to game store |
| `apps/game/src/components/stats-loc-section.tsx` | Modify | Use `effectiveLocPerKey` for "You" row and total `locRate` |
| `apps/game/src/modules/editor/components/editor.tsx` | Modify | Use `effectiveLocPerKey` in footer "LoC/key" label |
| `apps/game/src/modules/editor/components/streaming-editor.tsx` | Modify | Set `effectiveLocPerKey = locPerKey` when entering streaming mode |
| `apps/game/src/components/stats-tokens-section.tsx` | Modify | Add diagnostic bottleneck message at top |
| `apps/game/src/components/flops-slider.tsx` | No code change | Label updates are i18n-only |
| `apps/game/src/i18n/locales/*/ui.json` (8 files) | Modify | Slider labels + diagnostic keys |
| `apps/game/src/i18n/locales/*/tutorial.json` (8 files) | Modify | T4 tutorial rewrite |
| `libs/domain/data/ai-models.json` | Modify | T4 model price bumps |
| `libs/domain/data/tech-tree.json` | Modify | `llm_gate` + model unlock node cost bumps |

---

### Task 1: Add `effectiveLocPerKey` to game store

**Files:**
- Modify: `apps/game/src/modules/game/store/game-store.ts`

- [ ] **Step 1: Add `effectiveLocPerKey` to `GameState` interface**

In `game-store.ts`, add after the `locPerKey` field (line 77):

```typescript
effectiveLocPerKey: number;
```

- [ ] **Step 2: Add setter to `GameActions` interface**

In `game-store.ts`, add after `toggleAutoExecute` (line 159):

```typescript
setEffectiveLocPerKey: (value: number) => void;
```

- [ ] **Step 3: Add initial value**

In the `initialState` object, add after `locPerKey: core.startingLocPerKey` (line 178):

```typescript
effectiveLocPerKey: core.startingLocPerKey,
```

- [ ] **Step 4: Add setter implementation**

In the store actions (near the other setters like `setFlopSlider`), add:

```typescript
setEffectiveLocPerKey: (value: number) => {
	set({ effectiveLocPerKey: value });
},
```

- [ ] **Step 5: Reset `effectiveLocPerKey` in the `reset` action**

In the `reset` action, ensure `effectiveLocPerKey` is reset. Find the reset action and add alongside the other state resets:

```typescript
effectiveLocPerKey: core.startingLocPerKey,
```

- [ ] **Step 6: Set `effectiveLocPerKey = locPerKey` when entering streaming mode**

In `recalcDerivedStats` (around line 484), where `editorStreamingMode` is set to `true`:

```typescript
if (!state.editorStreamingMode && state.autoLocPerSec > locPerKey * 8) {
	state.editorStreamingMode = true;
	state.effectiveLocPerKey = locPerKey;
}
```

- [ ] **Step 7: Run typecheck**

Run: `npm run typecheck`
Expected: Type errors in `stats-loc-section.tsx` and `editor.tsx` where `effectiveLocPerKey` is not yet used (but should compile since it's just a new optional field being added).

- [ ] **Step 8: Commit**

```bash
git add apps/game/src/modules/game/store/game-store.ts
git commit -m "✨ Add effectiveLocPerKey to game store"
```

---

### Task 2: Compute `effectiveLocPerKey` in code typing hook

**Files:**
- Modify: `apps/game/src/modules/editor/hooks/use-code-typing.ts`

- [ ] **Step 1: Import `tokenizeBlock` for ratio computation**

`tokenizeBlock` is already imported at line 4. No change needed. Verify it's there:

```typescript
import { CODE_BLOCKS, tokenizeBlock } from "../data/code-tokens";
```

- [ ] **Step 2: Add an effect to compute and push `effectiveLocPerKey` on mount and block change**

After the existing `pendingLocRef` flush interval (around line 81), add an effect that computes the ratio from the current block and pushes it to the game store. Also add a ref to track the current block index so we can update when it changes:

```typescript
// Keep effectiveLocPerKey in sync with current block's token-to-LoC ratio
const prevBlockIndexForRatio = useRef(-1);
useEffect(() => {
	const updateRatio = () => {
		const idx = blockIndexRef.current;
		if (idx === prevBlockIndexForRatio.current) return;
		prevBlockIndexForRatio.current = idx;
		const block = CODE_BLOCKS[idx % CODE_BLOCKS.length];
		const tokens = tokenizeBlock(block);
		const locPerKey = useGameStore.getState().locPerKey;
		if (tokens.length > 0) {
			const effectiveLocPerKey = locPerKey * (block.loc / tokens.length);
			useGameStore.getState().setEffectiveLocPerKey(effectiveLocPerKey);
		}
	};
	updateRatio();
	// Re-check every 500ms (block changes happen via advanceTokens, not via state)
	const interval = setInterval(updateRatio, 500);
	return () => clearInterval(interval);
}, []);
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors related to this change)

- [ ] **Step 4: Commit**

```bash
git add apps/game/src/modules/editor/hooks/use-code-typing.ts
git commit -m "✨ Compute effectiveLocPerKey from current code block ratio"
```

---

### Task 3: Use `effectiveLocPerKey` in stats panel and editor footers

**Files:**
- Modify: `apps/game/src/components/stats-loc-section.tsx`
- Modify: `apps/game/src/modules/editor/components/editor.tsx`
- Modify: `apps/game/src/modules/editor/components/streaming-editor.tsx`

- [ ] **Step 1: Update `stats-loc-section.tsx`**

Replace `locPerKey` usage with `effectiveLocPerKey` for the display calculation. At line 83:

Change:
```typescript
const locPerKey = useGameStore((s) => s.locPerKey);
```
To:
```typescript
const effectiveLocPerKey = useGameStore((s) => s.effectiveLocPerKey);
```

At line 92, change:
```typescript
const typingLocPerSec = Math.max(keysPerSec, autoTypeKeysPerSec) * locPerKey;
```
To:
```typescript
const typingLocPerSec = Math.max(keysPerSec, autoTypeKeysPerSec) * effectiveLocPerKey;
```

In the `humanSources` memo (line 129), change:
```typescript
locPerSec: effectiveKeysPerSec * locPerKey,
```
To:
```typescript
locPerSec: effectiveKeysPerSec * effectiveLocPerKey,
```

Update the dependency array of the `humanSources` memo — replace `locPerKey` with `effectiveLocPerKey` (line 140).

- [ ] **Step 2: Update `editor.tsx` footer**

At line 398, the footer shows `{locPerKey} LoC/key`. Change the store selector:

Replace:
```typescript
const locPerKey = useGameStore((s) => s.locPerKey);
```
with:
```typescript
const locPerKey = useGameStore((s) => s.locPerKey);
const effectiveLocPerKey = useGameStore((s) => s.effectiveLocPerKey);
```

Keep `locPerKey` for the `onKeystroke` callback (it's used for `advanceTokens(locPerKey)` — we don't change the mechanic). But change the footer display at line 398 from:

```tsx
<span>{locPerKey} LoC/key</span>
```
To:
```tsx
<span>{Math.round(effectiveLocPerKey * 10) / 10} LoC/key</span>
```

- [ ] **Step 3: Update `streaming-editor.tsx` footer**

At line 255, the footer shows `locPerKey` via a ref. In streaming mode, `effectiveLocPerKey` already equals `locPerKey` (set in Task 1, Step 6), so no change needed here — the displayed value will be correct once the store subscription reads `effectiveLocPerKey`.

However, update the subscription that sets the ref (around line 254-255). Change:
```typescript
if (locPerKeyRef.current) {
	locPerKeyRef.current.textContent = `${state.locPerKey} LoC/key`;
}
```
To:
```typescript
if (locPerKeyRef.current) {
	locPerKeyRef.current.textContent = `${Math.round(state.effectiveLocPerKey * 10) / 10} LoC/key`;
}
```

Also update the `typingLocPerSec` calculation at line 183:
```typescript
const typingLocPerSec = (ts.length / 2) * state.locPerKey;
```
To:
```typescript
const typingLocPerSec = (ts.length / 2) * state.effectiveLocPerKey;
```

And `totalLocPerSec` at line 185 stays as-is (it already uses `state.autoLocPerSec + typingLocPerSec`).

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Run dev server and verify**

Run: `npm run dev`
Open http://localhost:3000 — check that:
1. The "You" row in stats shows a lower LoC/s than before (matching actual production)
2. The editor footer shows the effective LoC/key (not the raw `locPerKey`)
3. When auto-execute is on and FLOPS > displayed LoC/s, the queue actually goes down (as expected)

- [ ] **Step 6: Commit**

```bash
git add apps/game/src/components/stats-loc-section.tsx apps/game/src/modules/editor/components/editor.tsx apps/game/src/modules/editor/components/streaming-editor.tsx
git commit -m "🐛 Fix LoC/s display to show actual production rate"
```

---

### Task 4: Update FLOPS slider labels (i18n)

**Files:**
- Modify: `apps/game/src/i18n/locales/en/ui.json`
- Modify: `apps/game/src/i18n/locales/fr/ui.json`
- Modify: `apps/game/src/i18n/locales/de/ui.json`
- Modify: `apps/game/src/i18n/locales/es/ui.json`
- Modify: `apps/game/src/i18n/locales/it/ui.json`
- Modify: `apps/game/src/i18n/locales/pl/ui.json`
- Modify: `apps/game/src/i18n/locales/zh/ui.json`
- Modify: `apps/game/src/i18n/locales/ru/ui.json`

- [ ] **Step 1: Update English slider labels**

In `en/ui.json`, change the `flops_slider` keys:

```json
"flops_slider": {
	"exec_flops": "Execute LoC {{count}} FLOPS",
	"ai_flops": "Generate LoC {{count}} FLOPS",
	"exec_rate": "{{count}} LoC/s executed",
	"ai_rate": "{{count}} LoC/s generated",
```

Keep all other keys in the `flops_slider` section unchanged.

- [ ] **Step 2: Update French slider labels**

In `fr/ui.json`:

```json
"flops_slider": {
	"exec_flops": "Exécuter LoC {{count}} FLOPS",
	"ai_flops": "Générer LoC {{count}} FLOPS",
	"exec_rate": "{{count}} LoC/s exécutés",
	"ai_rate": "{{count}} LoC/s générés",
```

- [ ] **Step 3: Update remaining 6 locales**

Apply the same pattern to `de`, `es`, `it`, `pl`, `zh`, `ru` — translate "Execute LoC" and "Generate LoC" labels, plus "executed" and "generated" rate suffixes.

**German (`de/ui.json`):**
```json
"exec_flops": "LoC ausführen {{count}} FLOPS",
"ai_flops": "LoC generieren {{count}} FLOPS",
"exec_rate": "{{count}} LoC/s ausgeführt",
"ai_rate": "{{count}} LoC/s generiert",
```

**Spanish (`es/ui.json`):**
```json
"exec_flops": "Ejecutar LoC {{count}} FLOPS",
"ai_flops": "Generar LoC {{count}} FLOPS",
"exec_rate": "{{count}} LoC/s ejecutados",
"ai_rate": "{{count}} LoC/s generados",
```

**Italian (`it/ui.json`):**
```json
"exec_flops": "Eseguire LoC {{count}} FLOPS",
"ai_flops": "Generare LoC {{count}} FLOPS",
"exec_rate": "{{count}} LoC/s eseguiti",
"ai_rate": "{{count}} LoC/s generati",
```

**Polish (`pl/ui.json`):**
```json
"exec_flops": "Wykonaj LoC {{count}} FLOPS",
"ai_flops": "Generuj LoC {{count}} FLOPS",
"exec_rate": "{{count}} LoC/s wykonanych",
"ai_rate": "{{count}} LoC/s wygenerowanych",
```

**Chinese (`zh/ui.json`):**
```json
"exec_flops": "执行 LoC {{count}} FLOPS",
"ai_flops": "生成 LoC {{count}} FLOPS",
"exec_rate": "{{count}} LoC/s 已执行",
"ai_rate": "{{count}} LoC/s 已生成",
```

**Russian (`ru/ui.json`):**
```json
"exec_flops": "Выполнить LoC {{count}} FLOPS",
"ai_flops": "Сгенерировать LoC {{count}} FLOPS",
"exec_rate": "{{count}} LoC/s выполнено",
"ai_rate": "{{count}} LoC/s сгенерировано",
```

- [ ] **Step 4: Commit**

```bash
git add apps/game/src/i18n/locales/*/ui.json
git commit -m "🎨 Update FLOPS slider labels for clarity (8 locales)"
```

---

### Task 5: Add token stats diagnostic message

**Files:**
- Modify: `apps/game/src/i18n/locales/*/ui.json` (8 files)
- Modify: `apps/game/src/components/stats-tokens-section.tsx`

- [ ] **Step 1: Add diagnostic i18n keys to English**

In `en/ui.json`, inside the `stats_panel` section, add:

```json
"ai_diagnostic_starving": "AI is starving — need more workers",
"ai_diagnostic_needs_tokens": "AI needs more tokens",
"ai_diagnostic_needs_compute": "AI needs more compute — move FLOPS slider",
"ai_diagnostic_needs_flops": "AI needs more FLOPS",
"ai_diagnostic_full_capacity": "AI running at full capacity",
```

- [ ] **Step 2: Add diagnostic keys to French**

In `fr/ui.json`:

```json
"ai_diagnostic_starving": "L'IA est affamée — embauchez plus de travailleurs",
"ai_diagnostic_needs_tokens": "L'IA a besoin de plus de tokens",
"ai_diagnostic_needs_compute": "L'IA a besoin de plus de puissance — ajustez le slider FLOPS",
"ai_diagnostic_needs_flops": "L'IA a besoin de plus de FLOPS",
"ai_diagnostic_full_capacity": "L'IA fonctionne à pleine capacité",
```

- [ ] **Step 3: Add diagnostic keys to remaining 6 locales**

**German (`de/ui.json`):**
```json
"ai_diagnostic_starving": "KI hungert — mehr Arbeiter einstellen",
"ai_diagnostic_needs_tokens": "KI braucht mehr Tokens",
"ai_diagnostic_needs_compute": "KI braucht mehr Rechenleistung — FLOPS-Slider anpassen",
"ai_diagnostic_needs_flops": "KI braucht mehr FLOPS",
"ai_diagnostic_full_capacity": "KI läuft auf voller Kapazität",
```

**Spanish (`es/ui.json`):**
```json
"ai_diagnostic_starving": "La IA está hambrienta — contrata más trabajadores",
"ai_diagnostic_needs_tokens": "La IA necesita más tokens",
"ai_diagnostic_needs_compute": "La IA necesita más potencia — ajusta el slider de FLOPS",
"ai_diagnostic_needs_flops": "La IA necesita más FLOPS",
"ai_diagnostic_full_capacity": "La IA funciona a plena capacidad",
```

**Italian (`it/ui.json`):**
```json
"ai_diagnostic_starving": "L'IA è affamata — assumi più lavoratori",
"ai_diagnostic_needs_tokens": "L'IA ha bisogno di più token",
"ai_diagnostic_needs_compute": "L'IA ha bisogno di più potenza — sposta il cursore FLOPS",
"ai_diagnostic_needs_flops": "L'IA ha bisogno di più FLOPS",
"ai_diagnostic_full_capacity": "L'IA funziona a piena capacità",
```

**Polish (`pl/ui.json`):**
```json
"ai_diagnostic_starving": "AI głoduje — zatrudnij więcej pracowników",
"ai_diagnostic_needs_tokens": "AI potrzebuje więcej tokenów",
"ai_diagnostic_needs_compute": "AI potrzebuje więcej mocy — przesuń suwak FLOPS",
"ai_diagnostic_needs_flops": "AI potrzebuje więcej FLOPS",
"ai_diagnostic_full_capacity": "AI działa na pełnej mocy",
```

**Chinese (`zh/ui.json`):**
```json
"ai_diagnostic_starving": "AI 正在挨饿 — 需要更多工人",
"ai_diagnostic_needs_tokens": "AI 需要更多代币",
"ai_diagnostic_needs_compute": "AI 需要更多算力 — 调整 FLOPS 滑块",
"ai_diagnostic_needs_flops": "AI 需要更多 FLOPS",
"ai_diagnostic_full_capacity": "AI 满负荷运行",
```

**Russian (`ru/ui.json`):**
```json
"ai_diagnostic_starving": "ИИ голодает — наймите больше работников",
"ai_diagnostic_needs_tokens": "ИИ нужно больше токенов",
"ai_diagnostic_needs_compute": "ИИ нужно больше мощности — переместите слайдер FLOPS",
"ai_diagnostic_needs_flops": "ИИ нужно больше FLOPS",
"ai_diagnostic_full_capacity": "ИИ работает на полную мощность",
```

- [ ] **Step 4: Add diagnostic to `StatsTokensSection` component**

In `stats-tokens-section.tsx`, add a diagnostic message computation inside the existing `useMemo` block (after line 144, before the return). Add these fields to the returned object:

```typescript
// Diagnostic message
let diagnosticKey = "stats_panel.ai_diagnostic_full_capacity";
let diagnosticColor = theme.success;
if (tokEff < 0.5) {
	diagnosticKey = "stats_panel.ai_diagnostic_starving";
	diagnosticColor = "#f44336";
} else if (tokEff < 0.9) {
	diagnosticKey = "stats_panel.ai_diagnostic_needs_tokens";
	diagnosticColor = "#fbbf24";
} else if (sat < 0.5) {
	diagnosticKey = "stats_panel.ai_diagnostic_needs_compute";
	diagnosticColor = "#f44336";
} else if (sat < 0.9) {
	diagnosticKey = "stats_panel.ai_diagnostic_needs_flops";
	diagnosticColor = "#fbbf24";
}
```

Add `diagnosticKey` and `diagnosticColor` to the returned object from the `useMemo`.

Also add `diagnosticKey: ""` and `diagnosticColor: ""` to the early return (line 94-104) for when `aiUnlocked` is false.

Then render the diagnostic message as the first element inside the `<CollapsibleSection>` children (before the token pipeline div, around line 173):

```tsx
{diagnosticKey && (
	<div
		style={{
			fontSize: 10,
			fontWeight: 600,
			color: diagnosticColor,
			marginBottom: 6,
			padding: "2px 0",
		}}
	>
		{t(diagnosticKey)}
	</div>
)}
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/game/src/i18n/locales/*/ui.json apps/game/src/components/stats-tokens-section.tsx
git commit -m "✨ Add AI bottleneck diagnostic message to token stats panel"
```

---

### Task 6: Rewrite T4 tutorial (i18n)

**Files:**
- Modify: `apps/game/src/i18n/locales/*/tutorial.json` (8 files)

- [ ] **Step 1: Update English tutorial**

In `en/tutorial.json`, change the `ai_lab` entry:

```json
"ai_lab": {
	"header": "tutorial.ai_lab()",
	"body": "The age of writing code is over.\n\nYour workers now produce tokens — the atomic units AI models consume to generate LoC at massive scale.\n\nSplit your compute: FLOPS execute queued code into cash, or power AI models to generate more code."
},
```

- [ ] **Step 2: Update French tutorial**

In `fr/tutorial.json`:

```json
"ai_lab": {
	"header": "tutorial.ai_lab()",
	"body": "L'ère de l'écriture de code est révolue.\n\nVos travailleurs produisent maintenant des tokens — les unités atomiques que les modèles IA consomment pour générer du LoC à grande échelle.\n\nRépartissez votre puissance : les FLOPS exécutent le code en file d'attente pour du cash, ou alimentent les modèles IA pour générer plus de code."
},
```

- [ ] **Step 3: Update remaining 6 locales**

**German (`de/tutorial.json`):**
```json
"ai_lab": {
	"header": "tutorial.ai_lab()",
	"body": "Das Zeitalter des Code-Schreibens ist vorbei.\n\nIhre Arbeiter produzieren jetzt Tokens — die atomaren Einheiten, die KI-Modelle verbrauchen, um LoC in großem Maßstab zu generieren.\n\nTeilen Sie Ihre Rechenleistung auf: FLOPS führen wartenden Code für Cash aus oder treiben KI-Modelle an, um mehr Code zu generieren."
},
```

**Spanish (`es/tutorial.json`):**
```json
"ai_lab": {
	"header": "tutorial.ai_lab()",
	"body": "La era de escribir código ha terminado.\n\nTus trabajadores ahora producen tokens — las unidades atómicas que los modelos de IA consumen para generar LoC a gran escala.\n\nDivide tu potencia: los FLOPS ejecutan código en cola por cash, o alimentan modelos de IA para generar más código."
},
```

**Italian (`it/tutorial.json`):**
```json
"ai_lab": {
	"header": "tutorial.ai_lab()",
	"body": "L'era della scrittura del codice è finita.\n\nI tuoi lavoratori ora producono token — le unità atomiche che i modelli IA consumano per generare LoC su vasta scala.\n\nDividi la tua potenza: i FLOPS eseguono il codice in coda per cash, o alimentano i modelli IA per generare più codice."
},
```

**Polish (`pl/tutorial.json`):**
```json
"ai_lab": {
	"header": "tutorial.ai_lab()",
	"body": "Era pisania kodu dobiegła końca.\n\nTwoi pracownicy produkują teraz tokeny — atomowe jednostki, które modele AI konsumują, aby generować LoC na ogromną skalę.\n\nPodziel swoją moc: FLOPS wykonują kod w kolejce za cash lub zasilają modele AI, aby generować więcej kodu."
},
```

**Chinese (`zh/tutorial.json`):**
```json
"ai_lab": {
	"header": "tutorial.ai_lab()",
	"body": "编写代码的时代已经结束。\n\n你的工人现在生产代币 — AI 模型消耗这些原子单位来大规模生成 LoC。\n\n分配你的算力：FLOPS 执行排队代码换取现金，或驱动 AI 模型生成更多代码。"
},
```

**Russian (`ru/tutorial.json`):**
```json
"ai_lab": {
	"header": "tutorial.ai_lab()",
	"body": "Эра написания кода закончилась.\n\nВаши работники теперь производят токены — атомарные единицы, которые модели ИИ потребляют для генерации LoC в огромных масштабах.\n\nРаспределите вычислительную мощность: FLOPS исполняют код в очереди за наличные или питают модели ИИ для генерации большего количества кода."
},
```

- [ ] **Step 4: Commit**

```bash
git add apps/game/src/i18n/locales/*/tutorial.json
git commit -m "📝 Rewrite T4 AI Lab tutorial for clarity (8 locales)"
```

---

### Task 7: Rebalance T4 AI model prices

**Files:**
- Modify: `libs/domain/data/ai-models.json`

- [ ] **Step 1: Update T4 model costs**

In `ai-models.json`, update the `cost` field for each T4 model (entry models unchanged, mid/late T4 bumped):

| Model ID | Line | Old cost | New cost |
|----------|------|----------|----------|
| `gpt_3` | 87 | `15000000` | `15000000` (no change) |
| `claude_haiku` | 28 | `20000000` | `20000000` (no change) |
| `copilot` | 10 | `25000000` | `25000000` (no change) |
| `gpt_35` | 102 | `30000000` | `60000000` |
| `llama_70b` | 227 | `35000000` | `70000000` |
| `mistral_large` | 268 | `50000000` | `120000000` |
| `gemini_pro` | 188 | `60000000` | `150000000` |
| `claude_sonnet` | 46 | `80000000` | `200000000` |
| `gpt_4` | 127 | `100000000` | `250000000` |
| `gpt_41` | 148 | `140000000` | `350000000` |
| `deepseek_v2` | 290 | `150000000` | `350000000` |
| `llama_405b` | 246 | `250000000` | `500000000` |

All T5 (`agi_race`) models stay at current prices.

- [ ] **Step 2: Commit**

```bash
git add libs/domain/data/ai-models.json
git commit -m "⚖️ Bump T4 AI model prices (cheap entry, steep mid-curve)"
```

---

### Task 8: Rebalance tech tree node costs

**Files:**
- Modify: `libs/domain/data/tech-tree.json`

- [ ] **Step 1: Bump `llm_gate` cost**

Change `llm_gate` baseCost from `6000000` to `12000000` (line 814).

- [ ] **Step 2: Bump model unlock tech node costs proportionally**

Update these tech nodes to match the new model pricing curve:

| Node ID | Line | Old baseCost | New baseCost | Rationale |
|---------|------|-------------|-------------|-----------|
| `llm_gate` | 814 | `6000000` | `12000000` | 2x gate bump |
| `openai_gpt3` | 1276 | `15000000` | `15000000` | No change (entry) |
| `anthropic_haiku` | 1401 | `30000000` | `30000000` | No change (entry) |
| `github_copilot` | 1476 | `15000000` | `15000000` | No change (entry) |
| `openai_gpt35` | 1301 | `75000000` | `150000000` | 2x |
| `meta_llama_70b` | 1551 | `30000000` | `70000000` | ~2.3x |
| `mistral_unlock` | 1601 | `45000000` | `120000000` | ~2.7x |
| `google_gemini_pro` | 1501 | `120000000` | `300000000` | 2.5x |
| `anthropic_sonnet` | 1426 | `450000000` | `500000000` | Modest bump |
| `openai_gpt4` | 1326 | `300000000` | `600000000` | 2x |
| `openai_gpt41` | 1351 | `1500000000` | `1500000000` | No change (already high) |
| `deepseek_v2` | 1626 | `18000000` | `45000000` | 2.5x |
| `meta_llama_405b` | 1576 | `750000000` | `750000000` | No change (already high) |

All T5 (`agi_race`) unlock nodes stay unchanged.

- [ ] **Step 3: Commit**

```bash
git add libs/domain/data/tech-tree.json
git commit -m "⚖️ Bump T4 tech tree node costs to match model price curve"
```

---

### Task 9: Run balance simulation and adjust

**Files:**
- May need further edits to: `libs/domain/data/ai-models.json`, `libs/domain/data/tech-tree.json`

- [ ] **Step 1: Run balance simulation**

Run: `npm run sim -- --verbose`

Expected: All 3 profiles (casual, average, fast) complete. Check that:
- T4 progression is not too slow (casual should reach T4 within ~20 min)
- T4 dwell time increased compared to before (player has time to learn AI system)
- Total game time stays within ~35-40 min for average player

- [ ] **Step 2: If sim fails or pacing is off, adjust**

If T4 takes too long:
- Reduce mid-tier model price multipliers from 2.5x to 2x
- Reduce tech node costs proportionally
- Re-run sim

If T4 is still too fast:
- Bump `llm_gate` further or increase mid-tier prices
- Re-run sim

Iterate until all 3 profiles pass.

- [ ] **Step 3: Commit final adjustments**

```bash
git add libs/domain/data/ai-models.json libs/domain/data/tech-tree.json
git commit -m "⚖️ Fine-tune T4 balance after simulation"
```

---

### Task 10: Run checks and final verification

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — no errors

- [ ] **Step 2: Run linter**

Run: `npm run check`
Expected: PASS — no biome errors

- [ ] **Step 3: Run balance sim one final time**

Run: `npm run sim`
Expected: All 3 profiles pass

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`

Verify:
1. **LoC/s display** — at T0/T1 with auto-type, displayed LoC/s matches actual queue behavior
2. **FLOPS slider** — labels say "Execute LoC" / "Generate LoC" at T4
3. **Token diagnostic** — shows "AI is starving" when token efficiency is low, "full capacity" when good
4. **T4 tutorial** — triggers on AI Lab unlock with new text
5. **AI model prices** — entry models still affordable, mid-tier models require saving up
6. **French locale** — switch language to FR and verify slider labels + tutorial + diagnostic messages render

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "🐛 Final polish from smoke test"
```
