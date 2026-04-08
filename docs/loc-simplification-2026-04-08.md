# LoC System Simplification — 2026-04-08

## Before (3 independent systems)

The editor had three disconnected systems tracking LoC:

1. **`loc` counter** (game store) — incremented by `addLoc()`, decremented by execution in the tick
2. **`blockQueue`** (game store) — visual blocks with `lines[]` and `loc` count, added by `enqueueBlock()`, drained by sync hacks
3. **`typing` state** (React useState in `useCodeTyping`) — `typing.lines` and `typing.currentLine`, updated per visual token

These constantly drifted apart. The editor showed code when `loc` was 0. The counter showed LoC when the editor was empty. Multiple sync patches were added and each introduced new edge cases.

The `advanceTokens()` function conflated visual token advancement with LoC accounting — each token added `block.loc / totalTokens` LoC via `pendingLocRef`. The `locPerKey` value (3) represented "visual tokens per keystroke," not actual LoC per keystroke. An `effectiveLocPerKey` was computed from the token-to-LoC ratio, which varied per code block.

A streaming editor existed for T2+ to bypass the block system at high production rates.

## After (1 source of truth)

### `loc` is a direct counter. Period.

- `addLoc(amount)` → `loc += amount * locProductionMultiplier`
- Tick execution → `loc -= executed`
- Tech tree purchases → `loc -= cost`
- No blockQueue derivation, no block draining, no visual sync

### `locPerKey` is the actual rate

- Starts at 0.2 (5 keystrokes = 1 LoC = 1 line in editor)
- Upgrades: Better Keyboard +0.5, Coffee +0.3, Barista +0.5, Doppio +0.7
- What the footer shows is what you get. No token ratios, no `effectiveLocPerKey`.

### Editor is a pure function of `loc`

- Pre-generated pool of ~178 code lines from `CODE_BLOCKS`
- `getLine(idx)` → `pool[idx % pool.length]` — O(1) lookup
- Renders `floor(loc)` complete lines + 1 partial line for the fractional part
- Virtualizer renders only ~30 visible DOM nodes regardless of LoC count
- No array allocation, no iteration — works at 5 LoC or 500K LoC

### `advanceTokens()` is purely visual

- Called with `advanceTokens(1)` per keystroke — advances 1 visual token for typing animation flavor
- No LoC accounting inside — `pendingLocRef` removed
- `enqueueBlock()` is a no-op (blocks no longer used for display)

### No streaming editor

- One editor component for all tiers (T0 through T5)
- `editorStreamingMode` flag still exists in state (save compat) but unused
- `streaming-editor.tsx` deleted (363 lines removed)

## What was removed

| Component | Lines | Purpose |
|-----------|-------|---------|
| `streaming-editor.tsx` | 363 | Separate editor for T2+ |
| `effectiveLocPerKey` | ~40 | Token-to-LoC ratio computation |
| `pendingLocRef` flush | ~15 | Batched LoC accounting from tokens |
| Block queue sync logic | ~80 | Sync hacks (clear at zero, trim excess, drain proportionally) |
| Block mode in tick | ~50 | Derive loc from blockQueue, drain blocks on execution |
| `_typingLoc` buffer | ~20 | Failed attempt at typing buffer accounting |
| `_visualTick` counter | ~5 | Block queue throttling |

Total: ~570 lines of complexity removed, replaced by ~60 lines of direct counter + O(1) rendering.
