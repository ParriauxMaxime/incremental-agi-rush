# Mobile Responsive Design Spec

## Goal

Make the game playable on mobile by keeping the desktop IDE layout and adding touch support — no separate mobile UI.

## What Changes

### 1. Remove MobileShell Branch

The `useIsMobile()` conditional in `app.tsx` that swaps the entire UI to `<MobileShell />` is removed. Mobile renders the same three-column IDE layout as desktop.

**Files deleted:**
- `apps/game/src/components/mobile-shell.tsx`
- `apps/game/src/components/mobile-resource-bar.tsx`
- `apps/game/src/components/mobile-tab-bar.tsx`
- `apps/game/src/components/mobile-shop-tab.tsx`
- `apps/game/src/components/mobile-settings-overlay.tsx`

**Files modified:**
- `apps/game/src/app.tsx` — remove `useIsMobile()` import, remove conditional branch, render desktop layout unconditionally.

### 2. Portrait Rotation Nudge

A dismissable banner shown when `window.matchMedia("(orientation: portrait)")` matches on touch devices.

**Behavior:**
- Appears at the top of the viewport as a horizontal bar
- Text: "Rotate your device for the best experience" (i18n key: `ui.rotateDevice`)
- Dismiss button (×) hides it for the session (state in `sessionStorage`)
- Does NOT block the game — purely informational

**Implementation:** New component `apps/game/src/components/rotate-nudge.tsx`, rendered in `app.tsx` above the main layout. Only mounts on touch devices (`'ontouchstart' in window` or `navigator.maxTouchPoints > 0`).

### 3. Sidebars Default Collapsed on Mobile

On mobile (touch device detection), both sidebars start collapsed.

**Implementation:** In `apps/game/src/app.tsx` (or wherever sidebar visibility state is initialized), if touch device is detected, initialize `leftPanelVisible` and `rightPanelVisible` to `false`. The existing collapse/expand buttons remain — user can open them manually.

No new components or UI patterns. Just a different default.

### 4. Touch-to-Type on Editor

The editor area accepts touch input on mobile for code generation.

**Tap:** Single tap = one keystroke worth of LoC (calls `addLoc(locPerKey)` + triggers keystroke for code typing). Shows floating `+{locPerKey} LoC` indicator at tap position.

**Press-and-hold:** Continuous typing while finger is held down. Fires at an interval capped at ~10 keystrokes/sec (100ms interval), matching the desktop keyboard mashing cap. Each interval tick = one keystroke + one floating indicator.

**Floating +LoC indicator:**
- Color: `theme.locColor` (typically `#61afef` blue) instead of current hardcoded `#50fa7b` green
- Text shadow glow matches `locColor` with 0.5 alpha
- Animation: existing `floatUp` keyframe (800ms, fade + move up 60px)
- Max 8 simultaneous indicators (existing cap)
- Only appears on manual tap/press, not on auto-type or other LoC sources

**Hint text:** "tap or hold to code" (i18n key: `ui.tapOrHoldToCode`)

**Implementation:** Modify `apps/game/src/modules/editor/components/tap-to-code.tsx`:
- Add `onTouchStart` / `onTouchEnd` handlers for press-and-hold (setInterval at 100ms, clear on touch end)
- Replace hardcoded `#50fa7b` with `theme.locColor` from `useIdeTheme()`
- Replace hardcoded green glow with dynamic glow based on `locColor`
- Update hint text

**Integration:** The `TapToCode` component is currently only used inside `MobileShell`. After removing MobileShell, integrate it into the main editor panel as an overlay on touch devices. When a touch device is detected, layer `TapToCode` over the editor/streaming-editor so taps on the editor area trigger code generation. On desktop (no touch), the existing keyboard input continues to work as-is.

### 5. i18n

New keys added to all 8 locale files under the `ui` namespace:
- `ui.rotateDevice` — "Rotate your device for the best experience"
- `ui.tapOrHoldToCode` — "Tap or hold to code"

## What Does NOT Change

- Desktop layout, sizing, behavior — completely untouched
- Keyboard input on desktop — unchanged
- Resource bar, status bar, stats panel — same components, same rendering
- Game loop, store, engine — no changes
- Editor virtualization, streaming editor — unchanged (touch overlay sits on top)
- The `useIsMobile` hook can be repurposed or removed — detection switches to touch capability rather than screen width

## Touch Detection

Use `'ontouchstart' in window || navigator.maxTouchPoints > 0` rather than screen width. This correctly identifies tablets in landscape (touch + wide screen) and laptops with touch screens.

A new hook `useTouchDevice()` replaces `useIsMobile()` for the behaviors above.
