# Mobile Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the game playable on mobile by keeping the desktop IDE layout, adding touch-to-type with press-and-hold, a portrait rotation nudge, and removing the separate mobile shell.

**Architecture:** Remove the `useIsMobile()` branch that swaps the entire UI to `MobileShell`. Instead, detect touch capability via a `useTouchDevice()` hook and layer a touch overlay on the editor panel for tap/hold-to-type. A dismissable banner nudges portrait users to rotate.

**Tech Stack:** React 19, Emotion CSS-in-JS, Zustand, i18next

**Spec:** `docs/superpowers/specs/2026-03-31-mobile-responsive-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/game/src/hooks/use-touch-device.ts` | Hook returning boolean for touch capability |
| Create | `apps/game/src/components/rotate-nudge.tsx` | Dismissable portrait rotation banner |
| Modify | `apps/game/src/modules/editor/components/tap-to-code.tsx` | Add hold-to-type, theme locColor, integrate with editor keystroke system |
| Modify | `apps/game/src/components/editor-panel.tsx:30-66` | Layer TapToCode overlay on touch devices |
| Modify | `apps/game/src/app.tsx:3,31,591,642-651` | Remove MobileShell branch, add RotateNudge |
| Modify | `apps/game/src/i18n/locales/*/ui.json` (8 files) | Add `rotate_device` and `tap_or_hold` keys |
| Delete | `apps/game/src/components/mobile-shell.tsx` | No longer needed |
| Delete | `apps/game/src/components/mobile-resource-bar.tsx` | No longer needed |
| Delete | `apps/game/src/components/mobile-tab-bar.tsx` | No longer needed |
| Delete | `apps/game/src/components/mobile-shop-tab.tsx` | No longer needed |
| Delete | `apps/game/src/components/mobile-settings-overlay.tsx` | No longer needed |

---

### Task 1: Create `useTouchDevice` Hook

**Files:**
- Create: `apps/game/src/hooks/use-touch-device.ts`

- [ ] **Step 1: Create the hook**

```typescript
export function useTouchDevice(): boolean {
	if (typeof window === "undefined") return false;
	return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}
```

This is a simple capability check — no state, no listeners. Touch capability doesn't change during a session.

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/hooks/use-touch-device.ts
git commit -m "✨ Add useTouchDevice hook for touch capability detection"
```

---

### Task 2: Add i18n Keys

**Files:**
- Modify: `apps/game/src/i18n/locales/en/ui.json`
- Modify: `apps/game/src/i18n/locales/fr/ui.json`
- Modify: `apps/game/src/i18n/locales/it/ui.json`
- Modify: `apps/game/src/i18n/locales/de/ui.json`
- Modify: `apps/game/src/i18n/locales/es/ui.json`
- Modify: `apps/game/src/i18n/locales/pl/ui.json`
- Modify: `apps/game/src/i18n/locales/zh/ui.json`
- Modify: `apps/game/src/i18n/locales/ru/ui.json`

- [ ] **Step 1: Add keys to English locale**

In `apps/game/src/i18n/locales/en/ui.json`, add inside the `"mobile"` object (after `"reset_game": "Reset Game"`):

```json
"rotate_device": "Rotate your device for the best experience",
"tap_or_hold": "Tap or hold to code"
```

- [ ] **Step 2: Add keys to all other locales**

Add translated keys to the `"mobile"` section of each locale file:

**French (`fr/ui.json`):**
```json
"rotate_device": "Tournez votre appareil pour une meilleure expérience",
"tap_or_hold": "Appuyez ou maintenez pour coder"
```

**Italian (`it/ui.json`):**
```json
"rotate_device": "Ruota il dispositivo per un'esperienza migliore",
"tap_or_hold": "Tocca o tieni premuto per programmare"
```

**German (`de/ui.json`):**
```json
"rotate_device": "Drehe dein Gerät für ein besseres Erlebnis",
"tap_or_hold": "Tippen oder halten zum Coden"
```

**Spanish (`es/ui.json`):**
```json
"rotate_device": "Gira tu dispositivo para una mejor experiencia",
"tap_or_hold": "Toca o mantén pulsado para programar"
```

**Polish (`pl/ui.json`):**
```json
"rotate_device": "Obróć urządzenie, aby uzyskać lepsze wrażenia",
"tap_or_hold": "Dotknij lub przytrzymaj, aby kodować"
```

**Chinese (`zh/ui.json`):**
```json
"rotate_device": "旋转设备以获得最佳体验",
"tap_or_hold": "点击或长按来编程"
```

**Russian (`ru/ui.json`):**
```json
"rotate_device": "Поверните устройство для лучшего опыта",
"tap_or_hold": "Нажмите или удерживайте для кода"
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add apps/game/src/i18n/locales/*/ui.json
git commit -m "🌐 Add mobile i18n keys for rotate nudge and tap-to-code hint"
```

---

### Task 3: Create Rotate Nudge Component

**Files:**
- Create: `apps/game/src/components/rotate-nudge.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { css, keyframes } from "@emotion/react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { useTouchDevice } from "../hooks/use-touch-device";

const SESSION_KEY = "flopsed-rotate-dismissed";

const slideDown = keyframes({
	from: { transform: "translateY(-100%)" },
	to: { transform: "translateY(0)" },
});

const barCss = css({
	position: "fixed",
	top: 0,
	left: 0,
	right: 0,
	zIndex: 9999,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	gap: 12,
	padding: "8px 16px",
	fontSize: 13,
	animation: `${slideDown} 0.3s ease-out`,
});

const closeBtnCss = css({
	background: "none",
	border: "none",
	cursor: "pointer",
	fontSize: 16,
	padding: "0 4px",
	lineHeight: 1,
});

export function RotateNudge() {
	const isTouch = useTouchDevice();
	const { t } = useTranslation("ui");
	const theme = useIdeTheme();
	const [portrait, setPortrait] = useState(false);
	const [dismissed, setDismissed] = useState(
		() => sessionStorage.getItem(SESSION_KEY) === "1",
	);

	useEffect(() => {
		const mql = window.matchMedia("(orientation: portrait)");
		setPortrait(mql.matches);
		const handler = (e: MediaQueryListEvent) => setPortrait(e.matches);
		mql.addEventListener("change", handler);
		return () => mql.removeEventListener("change", handler);
	}, []);

	const dismiss = useCallback(() => {
		setDismissed(true);
		sessionStorage.setItem(SESSION_KEY, "1");
	}, []);

	if (!isTouch || !portrait || dismissed) return null;

	return (
		<div
			css={barCss}
			style={{
				background: theme.statusBarBg,
				color: theme.statusBarFg,
				borderBottom: `1px solid ${theme.border}`,
			}}
		>
			<span>{t("mobile.rotate_device")}</span>
			<button
				css={closeBtnCss}
				style={{ color: theme.textMuted }}
				onClick={dismiss}
				type="button"
			>
				×
			</button>
		</div>
	);
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/components/rotate-nudge.tsx
git commit -m "✨ Add RotateNudge banner for portrait mobile users"
```

---

### Task 4: Upgrade TapToCode with Hold-to-Type and Theme Colors

**Files:**
- Modify: `apps/game/src/modules/editor/components/tap-to-code.tsx`

- [ ] **Step 1: Rewrite tap-to-code.tsx**

Replace the entire file contents with:

```typescript
import { css, keyframes } from "@emotion/react";
import type { EditorTheme } from "@modules/editor";
import { useGameStore } from "@modules/game";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface FloatingIndicator {
	id: number;
	x: number;
	y: number;
	amount: number;
}

const floatUp = keyframes({
	"0%": { opacity: 1, transform: "translateY(0)" },
	"100%": { opacity: 0, transform: "translateY(-60px)" },
});

const containerCss = css({
	position: "absolute",
	inset: 0,
	touchAction: "manipulation",
	userSelect: "none",
	overflow: "hidden",
	zIndex: 10,
});

const floatingCss = css({
	position: "absolute",
	pointerEvents: "none",
	fontWeight: 700,
	fontSize: 18,
	animation: `${floatUp} 800ms ease-out forwards`,
});

const hintCss = css({
	position: "absolute",
	bottom: 32,
	left: 0,
	right: 0,
	textAlign: "center",
	fontSize: 14,
	pointerEvents: "none",
});

const MAX_INDICATORS = 8;
const HOLD_INTERVAL_MS = 100; // ~10 keystrokes/sec cap

interface TapToCodeProps {
	theme: EditorTheme;
	onKeystroke: () => void;
}

export function TapToCode({ theme, onKeystroke }: TapToCodeProps) {
	const addLoc = useGameStore((s) => s.addLoc);
	const locPerKey = useGameStore((s) => s.locPerKey);
	const { t } = useTranslation("ui");

	const [indicators, setIndicators] = useState<FloatingIndicator[]>([]);
	const nextIdRef = useRef(0);
	const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const lastTapRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

	const spawnIndicator = useCallback(
		(x: number, y: number) => {
			const id = nextIdRef.current++;
			setIndicators((prev) => {
				const next = [...prev, { id, x, y, amount: locPerKey }];
				return next.length > MAX_INDICATORS
					? next.slice(next.length - MAX_INDICATORS)
					: next;
			});
			setTimeout(() => {
				setIndicators((prev) => prev.filter((ind) => ind.id !== id));
			}, 800);
		},
		[locPerKey],
	);

	const handleKeystroke = useCallback(
		(x: number, y: number) => {
			addLoc(locPerKey);
			onKeystroke();
			spawnIndicator(x, y);
		},
		[addLoc, locPerKey, onKeystroke, spawnIndicator],
	);

	const startHold = useCallback(
		(x: number, y: number) => {
			lastTapRef.current = { x, y };
			handleKeystroke(x, y);
			holdIntervalRef.current = setInterval(() => {
				const { x: hx, y: hy } = lastTapRef.current;
				// Jitter position slightly so indicators don't stack exactly
				const jx = hx + (Math.random() - 0.5) * 40;
				const jy = hy + (Math.random() - 0.5) * 40;
				handleKeystroke(jx, jy);
			}, HOLD_INTERVAL_MS);
		},
		[handleKeystroke],
	);

	const stopHold = useCallback(() => {
		if (holdIntervalRef.current) {
			clearInterval(holdIntervalRef.current);
			holdIntervalRef.current = null;
		}
	}, []);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
		};
	}, []);

	const onTouchStart = useCallback(
		(e: React.TouchEvent) => {
			e.preventDefault();
			const touch = e.touches[0];
			const rect = e.currentTarget.getBoundingClientRect();
			startHold(touch.clientX - rect.left, touch.clientY - rect.top);
		},
		[startHold],
	);

	const onTouchEnd = useCallback(() => {
		stopHold();
	}, [stopHold]);

	const onMouseDown = useCallback(
		(e: React.MouseEvent) => {
			const rect = e.currentTarget.getBoundingClientRect();
			startHold(e.clientX - rect.left, e.clientY - rect.top);
		},
		[startHold],
	);

	const onMouseUp = useCallback(() => {
		stopHold();
	}, [stopHold]);

	const onMouseLeave = useCallback(() => {
		stopHold();
	}, [stopHold]);

	const glowColor = useMemo(() => {
		// Parse hex to rgba for text-shadow
		const hex = theme.locColor.replace("#", "");
		const r = Number.parseInt(hex.substring(0, 2), 16);
		const g = Number.parseInt(hex.substring(2, 4), 16);
		const b = Number.parseInt(hex.substring(4, 6), 16);
		return `rgba(${r}, ${g}, ${b}, 0.5)`;
	}, [theme.locColor]);

	return (
		<div
			css={containerCss}
			onTouchStart={onTouchStart}
			onTouchEnd={onTouchEnd}
			onTouchCancel={onTouchEnd}
			onMouseDown={onMouseDown}
			onMouseUp={onMouseUp}
			onMouseLeave={onMouseLeave}
		>
			{indicators.map((ind) => (
				<span
					key={ind.id}
					css={floatingCss}
					style={{
						left: ind.x,
						top: ind.y,
						color: theme.locColor,
						textShadow: `0 0 6px ${glowColor}`,
					}}
				>
					+{ind.amount} LoC
				</span>
			))}

			<span css={hintCss} style={{ color: theme.comment }}>
				{t("mobile.tap_or_hold")}
			</span>
		</div>
	);
}
```

**Key changes from the original:**
- Now accepts `theme: EditorTheme` and `onKeystroke: () => void` props instead of being self-contained
- Uses `theme.locColor` for indicator color and glow instead of hardcoded green
- `position: absolute` + `inset: 0` so it overlays the editor area
- Press-and-hold via `setInterval(HOLD_INTERVAL_MS=100ms)` on `touchstart`/`mousedown`, cleared on `touchend`/`mouseup`/`mouseleave`
- Hold indicator positions jitter slightly (±20px) so they don't all stack
- Calls `onKeystroke()` prop to trigger actual code typing in the editor
- Removed background code text (the real editor is visible underneath)
- Uses i18n for hint text

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: May show errors in files that import TapToCode with old API — those are fixed in the next task.

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/modules/editor/components/tap-to-code.tsx
git commit -m "✨ Upgrade TapToCode: hold-to-type, theme colors, overlay mode"
```

---

### Task 5: Integrate TapToCode into EditorPanel

**Files:**
- Modify: `apps/game/src/components/editor-panel.tsx`

- [ ] **Step 1: Add touch overlay to EditorPanel**

Replace the entire file contents with:

```typescript
import { css } from "@emotion/react";
import { Editor, StreamingEditor, TapToCode } from "@modules/editor";
import { useGameStore } from "@modules/game";
import { useCallback, useRef } from "react";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { useTouchDevice } from "../hooks/use-touch-device";
import { CliPrompt } from "./cli-prompt";
import { FlopsSlider } from "./flops-slider";

const wrapperCss = css({
	display: "flex",
	flexDirection: "column",
	flex: 1,
	overflow: "hidden",
});

const editorAreaCss = css({
	overflow: "hidden",
	display: "flex",
	flexDirection: "column",
	minHeight: 0,
	boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)",
	position: "relative",
});

const contentCss = css({
	flex: 1,
	overflow: "hidden",
	display: "flex",
	flexDirection: "column",
});

export function EditorPanel() {
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);
	const streamingMode = useGameStore((s) => s.editorStreamingMode);
	const theme = useIdeTheme();
	const isTouch = useTouchDevice();
	const keystrokeCallbackRef = useRef<(() => void) | null>(null);

	const onKeystroke = useCallback(() => {
		keystrokeCallbackRef.current?.();
	}, []);

	if (aiUnlocked) {
		// T4+: CLI prompt takes over entirely — no touch overlay needed
		return (
			<div css={wrapperCss} data-tutorial="editor">
				<FlopsSlider />
				<div css={contentCss} style={{ background: theme.panelBg }}>
					<CliPrompt />
				</div>
			</div>
		);
	}

	// T2+ streaming: simplified CSS-driven editor
	if (streamingMode) {
		return (
			<div css={wrapperCss} data-tutorial="editor">
				<div css={editorAreaCss} style={{ flex: 1 }}>
					<StreamingEditor />
					{isTouch && (
						<TapToCode theme={theme} onKeystroke={onKeystroke} />
					)}
				</div>
			</div>
		);
	}

	// T0-early T2: Full block-based editor
	return (
		<div css={wrapperCss} data-tutorial="editor">
			<div css={editorAreaCss} style={{ flex: 1 }}>
				<Editor keystrokeCallbackRef={keystrokeCallbackRef} />
				{isTouch && (
					<TapToCode theme={theme} onKeystroke={onKeystroke} />
				)}
			</div>
		</div>
	);
}
```

**Key changes:**
- Added `position: relative` to `editorAreaCss` so the absolute TapToCode overlay positions correctly
- `TapToCode` renders on touch devices as an overlay on top of Editor/StreamingEditor
- `keystrokeCallbackRef` pattern: the Editor component sets this ref to its own keystroke handler, and TapToCode calls it through the `onKeystroke` prop — this triggers actual code typing
- Not shown on T4+ (CliPrompt) since that's a different interaction mode

- [ ] **Step 2: Wire keystrokeCallbackRef in Editor**

In `apps/game/src/modules/editor/components/editor.tsx`, the Editor component needs to accept and populate the `keystrokeCallbackRef`. Add the prop to Editor's interface and assign the ref in a useEffect:

At the top, add the prop:
```typescript
interface EditorProps {
	keystrokeCallbackRef?: React.MutableRefObject<(() => void) | null>;
}
```

Update the function signature:
```typescript
export function Editor({ keystrokeCallbackRef }: EditorProps = {}) {
```

Inside the component, after `useKeyboardInput` is set up, add:
```typescript
useEffect(() => {
	if (keystrokeCallbackRef) {
		keystrokeCallbackRef.current = onKeystroke;
	}
	return () => {
		if (keystrokeCallbackRef) {
			keystrokeCallbackRef.current = null;
		}
	};
}, [keystrokeCallbackRef, onKeystroke]);
```

Where `onKeystroke` is the existing keystroke callback that the `useKeyboardInput` hook calls. This exposes the same function to the touch overlay.

- [ ] **Step 3: Export TapToCode from editor module index**

In `apps/game/src/modules/editor/index.ts`, add:
```typescript
export { TapToCode } from "./components/tap-to-code";
```

- [ ] **Step 4: Verify typecheck passes**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/game/src/components/editor-panel.tsx apps/game/src/modules/editor/components/editor.tsx apps/game/src/modules/editor/index.ts
git commit -m "✨ Integrate TapToCode overlay into EditorPanel for touch devices"
```

---

### Task 6: Remove MobileShell and Wire RotateNudge into App

**Files:**
- Modify: `apps/game/src/app.tsx`
- Delete: `apps/game/src/components/mobile-shell.tsx`
- Delete: `apps/game/src/components/mobile-resource-bar.tsx`
- Delete: `apps/game/src/components/mobile-tab-bar.tsx`
- Delete: `apps/game/src/components/mobile-shop-tab.tsx`
- Delete: `apps/game/src/components/mobile-settings-overlay.tsx`

- [ ] **Step 1: Modify app.tsx**

Remove these imports (lines 3, 31):
```typescript
import { MobileShell } from "@components/mobile-shell";
import { useIsMobile } from "./hooks/use-is-mobile";
```

Remove the `isMobile` variable (line 591):
```typescript
const isMobile = useIsMobile();
```

Remove the entire mobile conditional block (lines 642-651):
```typescript
if (isMobile) {
    return (
        <>
            <Global styles={globalStyles} />
            <MobileShell />
            <EventToast />
            {singularity && <SingularitySequence animate={singularityAnimate} />}
        </>
    );
}
```

Add import for RotateNudge:
```typescript
import { RotateNudge } from "@components/rotate-nudge";
```

In the desktop return block (line 653+), add `<RotateNudge />` right after `<Global styles={globalStyles} />`:
```typescript
return (
    <>
        <Global styles={globalStyles} />
        <RotateNudge />
        <div ref={shellRef} css={[...
```

- [ ] **Step 2: Delete mobile component files**

```bash
rm apps/game/src/components/mobile-shell.tsx
rm apps/game/src/components/mobile-resource-bar.tsx
rm apps/game/src/components/mobile-tab-bar.tsx
rm apps/game/src/components/mobile-shop-tab.tsx
rm apps/game/src/components/mobile-settings-overlay.tsx
```

- [ ] **Step 3: Clean up any remaining imports of deleted files**

Search for any other files that import the deleted mobile components and remove those imports. Check:
```bash
grep -r "mobile-shell\|mobile-resource-bar\|mobile-tab-bar\|mobile-shop-tab\|mobile-settings" apps/game/src/ --include="*.ts" --include="*.tsx" -l
```

Remove any found imports.

- [ ] **Step 4: Verify typecheck passes**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 5: Verify the app builds**

Run: `npm run build`
Expected: Clean build, no errors

- [ ] **Step 6: Commit**

```bash
git add -A apps/game/src/app.tsx apps/game/src/components/rotate-nudge.tsx apps/game/src/components/mobile-shell.tsx apps/game/src/components/mobile-resource-bar.tsx apps/game/src/components/mobile-tab-bar.tsx apps/game/src/components/mobile-shop-tab.tsx apps/game/src/components/mobile-settings-overlay.tsx
git commit -m "♻️ Remove MobileShell, use desktop layout on all devices with RotateNudge"
```

---

### Task 7: Cleanup and Final Verification

**Files:**
- Optionally delete: `apps/game/src/hooks/use-is-mobile.ts` (if no other consumers)

- [ ] **Step 1: Check if useIsMobile is used anywhere else**

```bash
grep -r "use-is-mobile\|useIsMobile" apps/game/src/ --include="*.ts" --include="*.tsx" -l
```

If only `use-is-mobile.ts` itself appears, delete it. If other files import it, leave it.

- [ ] **Step 2: Run full checks**

```bash
npm run typecheck && npm run check && npm run build
```

Expected: All pass with no errors.

- [ ] **Step 3: Manual test checklist**

Open `npm run dev` and test:
- Desktop browser: game works exactly as before, no visual changes
- Mobile emulation (Chrome DevTools, iPhone SE landscape): desktop layout renders, TapToCode overlay visible, tap produces +LoC in theme blue, hold produces continuous keystrokes capped at ~10/sec
- Mobile emulation portrait: rotation nudge banner appears, dismissible, game still playable underneath
- Dismiss nudge, rotate to landscape, rotate back to portrait: nudge stays dismissed (sessionStorage)
- Switch editor themes: +LoC indicator color matches `locColor` of each theme

- [ ] **Step 4: Commit any cleanup**

```bash
git add -A
git commit -m "🧹 Clean up unused mobile hook and imports"
```
