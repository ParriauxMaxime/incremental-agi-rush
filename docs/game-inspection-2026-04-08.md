# Game Inspection Report — 2026-04-08

Deep audit of the Flopsed codebase. Issues grouped by severity.

## CRITICAL — Must Fix

### 1. Prestige/Singularity NOT Persisted to localStorage
**Files:** `game-store.ts:1015-1039`

The `partialize()` function is missing:
- `prestigeCount` — player loses ALL prestige levels on page reload
- `prestigeMultiplier` — 1.7x to 14.2x multiplier GONE
- `hasReachedSingularity` — flag lost, singularity could re-trigger
- `endgameCompleted` — godmode access lost
- `totalTokens` — token counter resets

**Impact:** Player reloads page, loses prestige progress. Game-breaking.

### 2. Double-Counting of LoC in Non-Streaming Mode
**Files:** `game-store.ts:601`, `use-auto-type.ts:28-38`

In non-streaming mode (early game):
- Tick adds `autoLocPerSec * dt` (freelancers, interns, devs)
- Auto-type hook ALSO calls `advanceTokens → addLoc` with `devRate = autoLocPerSec * 0.5`
- Dev/freelancer LoC is partially added TWICE

The auto-type hook's `devRate = autoLocPerSec * 0.5` was meant for visual speed, but `advanceTokens` actually adds LoC via `pendingLocRef → addLoc()`. This inflates early-game production by ~50% of autoLocPerSec beyond what's displayed.

**Fix:** Remove the `devRate` component from auto-type hook. Auto-type should only simulate 5 keystrokes/s, not add dev production on top. The tick already handles dev/freelancer LoC.

### 3. FLOPS Slider AI LoC/s Ignores Token Efficiency
**Files:** `flops-slider.tsx:72-87`

The slider shows `model.locPerSec * flopRatio` but the actual production is `model.locPerSec * tokenEfficiency * flopRatio`. When tokens are scarce, the slider overstates AI output significantly.

**Fix:** Factor `tokenEfficiency` into the slider's AI LoC/s calculation.

### 4. Cost Formula Can Overflow to Infinity
**Files:** `libs/engine/cost.ts:42,63`

`baseCost * costMultiplier ** owned` — at high `owned` counts, the exponent exceeds `Number.MAX_VALUE` → Infinity. Player gets stuck (can't afford Infinity).

**Fix:** Cap cost at `Number.MAX_SAFE_INTEGER` or a game-specific ceiling.

---

## HIGH — Should Fix Soon

### 5. Pause (`running=false`) Doesn't Stop All Production
**Files:** `game-store.ts:601`, `use-auto-type.ts`

When paused:
- Tick still adds `autoLocPerSec * dt` to LoC (line 601 has no `running` check for human production)
- Auto-type hook doesn't check `running`, only `singularity`

**Fix:** Gate human production on `running` in the tick. Check `running` in auto-type hook.

### 6. LoC Source Breakdown Missing AI/Agent Sources
**Files:** `stats-loc-section.tsx:89-150`

`autoLocPerSec` includes LLM and agent LoC, but the bar chart only shows freelancer, intern, team, dev, and you. AI/agent LoC is invisible in the breakdown.

**Fix:** Add LLM and agent source rows when AI is unlocked.

### 7. Prestige Modal Shows Unreachable Level at Max Prestige
**Files:** `prestige-modal.tsx:20-23`

At `prestigeCount = 5` (max), the modal calculates `nextCount = 6` and `nextMult = 1.7 ** 6`. But prestige() returns early at count >= 5. The acquihire event should stop spawning at max prestige.

**Fix:** Don't show modal (or disable confirm) when prestige is maxed.

### 8. i18n: Missing Translation Keys
**Files:** All locale files

Missing from ALL 7 non-English locales:
- 3 keys in `upgrades.json` (`planetary_datacenter.*`)
- 6 keys in `tech-tree.json` (`synthetic_data.*`, `the_singularity.*`)

Missing from English `ui.json` (used with inline defaults):
- 15 settings modal keys (`settings.cancel`, `settings.export_save`, etc.)

---

## MEDIUM — Worth Fixing

### 9. FLOPS Utilization Metric Measures Queue, Not Usage
**Files:** `game-store.ts:751`

`flopUtil = min(1, loc / flops)` measures queue depth relative to FLOPS, not actual utilization. Shows 0% even when FLOPS are maxed out but queue just emptied.

### 10. Auto-Arbitrage Can Oscillate
**Files:** `game-store.ts:771-804`

Queue pressure thresholds (5x vs 1x) can cause the slider to swing between +0.05 and -0.05 adjustments each tick. The 0.02 lerp damping may not be sufficient at high production.

### 11. ManualExecAccum Unbounded
**Files:** `game-store.ts:926`

No cooldown or rate limit on manual execute. Rapid clicking queues massive execution batches that fire at once on next tick.

### 12. Streaming Mode is One-Way
**Files:** `game-store.ts:491-492`

Once `autoLocPerSec > locPerKey * 8` triggers streaming mode, it never reverts even if production drops. Intentional but undocumented.

### 13. codeQuality Effects Silently Ignored on Duration Events
**Files:** `event-store.ts:56-85`

`applyModifier()` doesn't handle `codeQuality` or `instantLoc`. Duration-based events with these effects do nothing. Currently only `ai_hallucination` and `security_audit` are affected.

### 14. Expression Resolver Doesn't Support Division or Negatives
**Files:** `libs/engine/expression.ts:21,29`

Regex `([0-9.]+)` can't match negative numbers. Division handling is dead code (regex never matches `a / b` pattern). No current data uses these, but it's a latent bug.

---

## LOW — Nice to Have

### 15. godSet() No Validation + No Recalc
Can set negative values, tier > 5. Doesn't recalc derived stats after.

### 16. ManualExecAccum Persists Across Pause
Queued execution fires on resume unexpectedly.

### 17. Event Context Uses Stale Stats (50ms delay)
Expression context built from previous tick's values.

### 18. Analytics Sparkline Misses First 5 Seconds
First snapshot fires at t=5s, creating a blind spot.

### 19. Token Costs > LoC Production on Most T4 Models
All early T4 models have `tokenCost > locPerSec` (1.5-2x ratio). Intentional design (tokens ≠ LoC), but contributes to confusion about the token system.
