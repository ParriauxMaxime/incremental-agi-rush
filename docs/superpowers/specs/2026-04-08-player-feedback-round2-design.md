# Player Feedback Round 2 — 2026-04-08

Four changes: fix the GitHub Stars event reward, rework the singularity endgame flow, add a `sudo godmode` easter egg, and add a prestige confirmation modal with better framing.

## 1. GitHub Stars Event Fix

### Problem

The `github_star` event rewards `currentCash * 0.02` — at T0-T2, that's $1-$4. Invisible to the player. They reported "the event doesn't work."

### Fix

Replace percentage-based reward with tier-scaled flat cash.

**Expression context change:** Add `currentTierIndex: number` to `ExpressionContext` (in `libs/domain/types/event.ts` and `apps/game/src/modules/game/hooks/use-game-loop.ts`).

**Event data change:** In `libs/domain/data/events.json`, change `github_star` effect value from `"currentCash * 0.02"` to `"20 + currentTierIndex * 40"`:
- T0 (Garage): $20
- T1 (Freelancing): $60
- T2 (Startup): $100

The event still caps at `maxTier: "startup"` (T2) so it never fires beyond that.

**Files:**
- `libs/domain/types/event.ts` — add `currentTierIndex` to `ExpressionContext`
- `libs/engine/expression.ts` — handle `currentTierIndex` variable
- `apps/game/src/modules/game/hooks/use-game-loop.ts` — populate `ctx.currentTierIndex`
- `libs/domain/data/events.json` — change `github_star` value

---

## 2. Singularity Endgame Fix

### Problem

Clicking the red X during the singularity sequence calls `reset() + reload()`, which wipes the game. The player wanted to skip the text and continue playing, but instead lost everything.

### Fix

**New state field:** `endgameCompleted: boolean` in game store (persisted, default `false`).

**Red X behavior:**
- **Before rickroll phase:** disabled — no click handler, no pointer cursor, static red dot
- **After rickroll phase:** red dot starts pulsing (CSS keyframe animation with subtle glow). Clicking it:
  - Sets `endgameCompleted = true`
  - Sets `singularity = false` (dismisses overlay)
  - Does NOT call `reset()`, does NOT reload
  - Player returns to their game state with the godmode tab now visible

**God mode visibility:** Change gate from `hasReachedSingularity || localhost` to `endgameCompleted || localhost`.

**Editor hint:** After `endgameCompleted` is true, show a comment line in the editor area:
```
// hint: You could have bypassed this whole grind by just running "sudo godmode"
```

**Prestige preservation:** `endgameCompleted` is preserved across prestige resets (same as `hasReachedSingularity` and `prestigeCount`).

**Files:**
- `apps/game/src/modules/game/store/game-store.ts` — add `endgameCompleted` field, preserve in reset/prestige
- `apps/game/src/modules/game/components/singularity-sequence.tsx` — disable X before rickroll, pulsing animation after, new click handler
- `apps/game/src/app.tsx` — change godmode gate to `endgameCompleted || localhost`
- Editor component (TBD) — show hint comment after endgame

---

## 3. `sudo godmode` Terminal Command

### Overview

Hidden easter egg terminal command. Not in `help`, not documented. Works at any time.

**Command:** `sudo godmode`
- Sets `endgameCompleted = true`
- Shows the godmode tab, switches to it
- Terminal output: `"root access granted. You cheater."`

**Other `sudo` usage:** `sudo <anything-else>` returns `"Permission denied. Nice try."`

**Files:**
- `apps/game/src/modules/terminal/` — add sudo command handler
- i18n: terminal output strings in all 8 locales

---

## 4. Prestige Confirmation Modal

### Problem

Player clicked prestige without understanding what it does. Lost all progress. Frustrated.

### Fix: Acquisition Offer Modal

When the prestige event choice is triggered, instead of immediately calling `prestige()`, show a confirmation modal framed as a company acquisition offer.

**Modal content:**

```
💼  Acquisition Offer

A corporation wants to buy your company.

✅ Walk away with $X cash
✅ Experience gained: 1.0x → 1.7x $/LoC
✅ Reputation: ★ → ★★

❌ Start over from The Garage
❌ All employees, hardware & AI lost
❌ All tech research wiped

[ Keep working ]              [ Sell out ]
```

**Dynamic values:**
- `$X` = current cash × 0.05 (the 5% kept)
- Experience multiplier: `1.7^currentPrestigeCount` → `1.7^(currentPrestigeCount+1)`
- Reputation: current stars → current + 1 star

**Buttons:**
- "Keep working" = cancel, dismiss modal, continue playing
- "Sell out" = call `prestige()`, dismiss modal

**Implementation:**
- New `PrestigeModal` component (Emotion CSS, follows existing modal patterns)
- `showPrestigeModal: boolean` in UI store (or local state in event toast)
- Event choice handler sets the flag instead of calling `prestige()` directly
- Modal's "Sell out" button calls `prestige()` and dismisses

**Status bar update:** Change the prestige display from bare `★★ 2.9x` to `experience: ★★ 2.9x $/LoC` for clarity.

**i18n:** All modal text + status bar label in all 8 locales.

**Files:**
- New: `apps/game/src/components/prestige-modal.tsx`
- `apps/game/src/modules/event/components/event-toast.tsx` — show modal instead of calling prestige directly
- `apps/game/src/components/status-bar.tsx` — update prestige display label
- `apps/game/src/i18n/locales/*/ui.json` — modal text + status bar label (8 locales)

---

## Files Changed Summary

| File | Change |
|------|--------|
| `libs/domain/types/event.ts` | Add `currentTierIndex` to `ExpressionContext` |
| `libs/engine/expression.ts` | Handle `currentTierIndex` variable |
| `apps/game/src/modules/game/hooks/use-game-loop.ts` | Populate `ctx.currentTierIndex` |
| `libs/domain/data/events.json` | Fix `github_star` reward value |
| `apps/game/src/modules/game/store/game-store.ts` | Add `endgameCompleted` field |
| `apps/game/src/modules/game/components/singularity-sequence.tsx` | Disable X before rickroll, pulse after, new handler |
| `apps/game/src/app.tsx` | Change godmode gate to `endgameCompleted` |
| `apps/game/src/modules/terminal/` | Add `sudo godmode` command |
| New: `apps/game/src/components/prestige-modal.tsx` | Acquisition offer modal |
| `apps/game/src/modules/event/components/event-toast.tsx` | Show modal instead of direct prestige |
| `apps/game/src/components/status-bar.tsx` | Update prestige label to `experience: ★★ X.Xx $/LoC` |
| `apps/game/src/i18n/locales/*/ui.json` (8 files) | Modal text, sudo output, status bar label |
| Editor component | Show "sudo godmode" hint after endgame |

## Out of Scope

- Auto-type counter showing tok/s instead of loc/s (backlog)
