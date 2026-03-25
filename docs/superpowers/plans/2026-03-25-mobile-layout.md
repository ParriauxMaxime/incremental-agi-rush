# Mobile Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the game playable on mobile with a tab-based layout, tap-to-code mechanic, and auto-run.

**Architecture:** A `useIsMobile()` hook triggers layout switching. `App` conditionally renders desktop shell or `MobileShell`. Mobile has 3 tabs (Code, Tree, Shop), a compact resource bar, and replaces the keyboard editor with a full-screen tap zone. Desktop is unchanged.

**Tech Stack:** React 19, Emotion CSS-in-JS, Zustand, matchMedia API

**Spec:** `docs/superpowers/specs/2026-03-25-mobile-layout-design.md`

---

### Task 1: Create `useIsMobile` hook

**Files:**
- Create: `apps/game/src/hooks/use-is-mobile.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = "(max-width: 768px)";

export function useIsMobile(): boolean {
	const [isMobile, setIsMobile] = useState(
		() => window.matchMedia(MOBILE_BREAKPOINT).matches,
	);

	useEffect(() => {
		const mql = window.matchMedia(MOBILE_BREAKPOINT);
		const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
		mql.addEventListener("change", handler);
		return () => mql.removeEventListener("change", handler);
	}, []);

	return isMobile;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/hooks/use-is-mobile.ts
git commit -m "✨ Add useIsMobile responsive hook"
```

---

### Task 2: Create `TapToCode` component

**Files:**
- Create: `apps/game/src/modules/editor/components/tap-to-code.tsx`
- Modify: `apps/game/src/modules/editor/index.ts` (add export)

The core mobile interaction — a full-screen tap zone that generates code on each tap.

- [ ] **Step 1: Create the component**

The component:
- Renders the entire area as a tap target
- Shows code scrolling at low opacity in the background (reuses `blockQueue` from game store)
- On each tap: calls `addLoc(locPerKey)` and shows a floating "+X LoC" animation at the tap position
- Shows current LoC/s rate at the bottom

```typescript
import { css, keyframes } from "@emotion/react";
import { useGameStore } from "@modules/game";
import { useCallback, useRef, useState } from "react";

interface FloatingLoc {
	id: number;
	x: number;
	y: number;
	value: number;
}

const floatUp = keyframes({
	"0%": { opacity: 1, transform: "translateY(0)" },
	"100%": { opacity: 0, transform: "translateY(-60px)" },
});

const containerCss = css({
	flex: 1,
	position: "relative",
	overflow: "hidden",
	background: "#0d1117",
	touchAction: "manipulation",
	userSelect: "none",
	cursor: "pointer",
});

const codeBgCss = css({
	position: "absolute",
	inset: 0,
	padding: "12px 16px",
	fontFamily: "'Courier New', monospace",
	fontSize: 11,
	lineHeight: 1.6,
	color: "#c9d1d9",
	opacity: 0.15,
	overflow: "hidden",
	pointerEvents: "none",
});

const floatingCss = css({
	position: "absolute",
	fontSize: 18,
	fontWeight: "bold",
	color: "#3fb950",
	pointerEvents: "none",
	animation: `${floatUp} 0.8s ease-out forwards`,
	textShadow: "0 0 12px rgba(63,185,80,0.4)",
});

const hintCss = css({
	position: "absolute",
	bottom: 16,
	left: "50%",
	transform: "translateX(-50%)",
	fontSize: 12,
	color: "#484f58",
	pointerEvents: "none",
});

export function TapToCode() {
	const locPerKey = useGameStore((s) => s.locPerKey);
	const addLoc = useGameStore((s) => s.addLoc);
	const blockQueue = useGameStore((s) => s.blockQueue);
	const [floats, setFloats] = useState<FloatingLoc[]>([]);
	const nextId = useRef(0);

	const handleTap = useCallback(
		(e: React.MouseEvent | React.TouchEvent) => {
			const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
			const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
			const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
			const x = clientX - rect.left;
			const y = clientY - rect.top;

			addLoc(locPerKey);

			const id = nextId.current++;
			setFloats((prev) => [...prev.slice(-8), { id, x, y, value: locPerKey }]);
			setTimeout(() => {
				setFloats((prev) => prev.filter((f) => f.id !== id));
			}, 800);
		},
		[addLoc, locPerKey],
	);

	// Build background code text from recent blocks
	const bgCode = blockQueue
		.slice(-10)
		.flatMap((b) => b.lines)
		.join("\n")
		// Strip HTML tags for plain text display
		.replace(/<[^>]+>/g, "");

	return (
		<div css={containerCss} onClick={handleTap} onTouchStart={handleTap}>
			<div css={codeBgCss}>
				<pre>{bgCode || "// tap to start coding..."}</pre>
			</div>
			{floats.map((f) => (
				<div key={f.id} css={floatingCss} style={{ left: f.x, top: f.y }}>
					+{Math.round(f.value)}
				</div>
			))}
			<div css={hintCss}>tap anywhere to code</div>
		</div>
	);
}
```

- [ ] **Step 2: Export from editor module**

In `apps/game/src/modules/editor/index.ts`, add:

```typescript
export { TapToCode } from "./components/tap-to-code";
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

- [ ] **Step 4: Commit**

```bash
git add apps/game/src/modules/editor/components/tap-to-code.tsx apps/game/src/modules/editor/index.ts
git commit -m "✨ Add TapToCode component for mobile"
```

---

### Task 3: Create `MobileResourceBar`

**Files:**
- Create: `apps/game/src/components/mobile-resource-bar.tsx`

Compact resource bar with expandable FLOPS slider and settings gear icon.

- [ ] **Step 1: Create the component**

The component:
- Fixed at top, single row: Cash | LoC | FLOPS | ⚙
- Tap FLOPS to expand/collapse inline slider
- Gear icon opens settings overlay (handled by parent via callback)
- Uses `useRatePerSec` pattern from existing `resource-bar.tsx` for rates

Read `apps/game/src/components/resource-bar.tsx` for the `useRatePerSec` hook and `formatNumber` utility. Reuse them.

```typescript
import { css } from "@emotion/react";
import { useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useState } from "react";

interface MobileResourceBarProps {
	onOpenSettings: () => void;
}

// ... styles for bar, stat cells, FLOPS slider expand ...

export function MobileResourceBar({ onOpenSettings }: MobileResourceBarProps) {
	const loc = useGameStore((s) => s.loc);
	const cash = useGameStore((s) => s.cash);
	const flops = useGameStore((s) => s.flops);
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);
	const flopSlider = useGameStore((s) => s.flopSlider);
	const setFlopSlider = useGameStore((s) => s.setFlopSlider);
	const [showSlider, setShowSlider] = useState(false);

	return (
		<div css={barCss}>
			<div css={statCss}>
				<span css={labelCss}>💰</span>
				<span css={valueCss}>${formatNumber(cash)}</span>
			</div>
			<div css={statCss}>
				<span css={labelCss}>📝</span>
				<span css={valueCss}>{formatNumber(loc)}</span>
			</div>
			{aiUnlocked && (
				<div
					css={[statCss, { cursor: "pointer" }]}
					onClick={() => setShowSlider(!showSlider)}
				>
					<span css={labelCss}>⚡</span>
					<span css={valueCss}>{formatNumber(flops)}</span>
				</div>
			)}
			<button type="button" css={gearCss} onClick={onOpenSettings}>⚙</button>

			{/* Expandable FLOPS slider */}
			{showSlider && aiUnlocked && (
				<div css={sliderRowCss}>
					<span css={sliderLabelCss}>Exec {Math.round(flopSlider * 100)}%</span>
					<input
						type="range"
						min={0}
						max={1}
						step={0.01}
						value={flopSlider}
						onChange={(e) => setFlopSlider(Number.parseFloat(e.target.value))}
						css={sliderCss}
					/>
					<span css={sliderLabelCss}>AI {Math.round((1 - flopSlider) * 100)}%</span>
				</div>
			)}
		</div>
	);
}
```

Style the bar as: `position: sticky`, `top: 0`, `z-index: 100`, `background: #0d1117`, `border-bottom: 1px solid #1e2630`, `padding: 8px 12px`. Stats in a flex row. Slider row appears below stats when expanded.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/components/mobile-resource-bar.tsx
git commit -m "✨ Add MobileResourceBar with expandable FLOPS slider"
```

---

### Task 4: Create `MobileTabBar`

**Files:**
- Create: `apps/game/src/components/mobile-tab-bar.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { css } from "@emotion/react";

const MobileTabEnum = {
	code: "code",
	tree: "tree",
	shop: "shop",
} as const;

type MobileTabEnum = (typeof MobileTabEnum)[keyof typeof MobileTabEnum];

interface MobileTabBarProps {
	activeTab: MobileTabEnum;
	onTabChange: (tab: MobileTabEnum) => void;
}

const tabs: Array<{ key: MobileTabEnum; label: string; icon: string }> = [
	{ key: MobileTabEnum.code, label: "Code", icon: "⌨️" },
	{ key: MobileTabEnum.tree, label: "Tree", icon: "🌳" },
	{ key: MobileTabEnum.shop, label: "Shop", icon: "🛒" },
];

// Styles: fixed bottom, flex row, each tab flex:1, center-aligned icon+label
// Active tab: border-top 2px solid #58a6ff, color #c9d1d9
// Inactive: color #484f58

export function MobileTabBar({ activeTab, onTabChange }: MobileTabBarProps) {
	return (
		<div css={tabBarCss}>
			{tabs.map((t) => (
				<button
					key={t.key}
					type="button"
					css={[tabCss, activeTab === t.key && activeTabCss]}
					onClick={() => onTabChange(t.key)}
				>
					<span css={iconCss}>{t.icon}</span>
					<span css={labelCss}>{t.label}</span>
				</button>
			))}
		</div>
	);
}

export { MobileTabEnum };
```

- [ ] **Step 2: Run typecheck**

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/components/mobile-tab-bar.tsx
git commit -m "✨ Add MobileTabBar component"
```

---

### Task 5: Create `MobileSettingsOverlay`

**Files:**
- Create: `apps/game/src/components/mobile-settings-overlay.tsx`

- [ ] **Step 1: Create the component**

A slide-up modal overlay with: theme picker, auto-type toggle, reset button. Reuses the same `EDITOR_THEMES` and `ThemePreview` pattern from the desktop `SettingsPage` in `app.tsx`.

```typescript
interface MobileSettingsOverlayProps {
	onClose: () => void;
}
```

Structure:
- Dark backdrop (`position: fixed`, `inset: 0`, `background: rgba(0,0,0,0.6)`, `z-index: 200`)
- Content panel slides up from bottom (`position: fixed`, `bottom: 0`, `left: 0`, `right: 0`, `max-height: 70vh`, `overflow-y: auto`, `border-radius: 12px 12px 0 0`)
- Close button (X) at top-right
- Theme grid (same as desktop settings)
- Auto-type toggle (if unlocked)
- Reset game button

- [ ] **Step 2: Run typecheck**

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/components/mobile-settings-overlay.tsx
git commit -m "✨ Add MobileSettingsOverlay component"
```

---

### Task 6: Create `MobileShell` and wire up `App`

**Files:**
- Create: `apps/game/src/components/mobile-shell.tsx`
- Modify: `apps/game/src/app.tsx`

This is the main integration task.

- [ ] **Step 1: Create `MobileShell`**

The mobile shell renders:
1. `MobileResourceBar` (top, sticky)
2. Active tab content (full remaining height)
3. `MobileTabBar` (bottom, fixed)
4. `MobileSettingsOverlay` (when open)

```typescript
import { css } from "@emotion/react";
import { useState } from "react";
import { TapToCode } from "@modules/editor";
import { MobileResourceBar } from "./mobile-resource-bar";
import { MobileTabBar, MobileTabEnum } from "./mobile-tab-bar";
import { MobileSettingsOverlay } from "./mobile-settings-overlay";
import { TechTreePage } from "./tech-tree-page";
import { MobileShopTab } from "./mobile-shop-tab";

const shellCss = css({
	display: "flex",
	flexDirection: "column",
	height: "100vh",
	overflow: "hidden",
	background: "#0a0e14",
	color: "#c5c8c6",
	fontFamily: "'Courier New', monospace",
});

const contentCss = css({
	flex: 1,
	display: "flex",
	flexDirection: "column",
	overflow: "hidden",
});

export function MobileShell() {
	const [activeTab, setActiveTab] = useState(MobileTabEnum.code);
	const [settingsOpen, setSettingsOpen] = useState(false);

	return (
		<div css={shellCss}>
			<MobileResourceBar onOpenSettings={() => setSettingsOpen(true)} />
			<div css={contentCss}>
				{activeTab === MobileTabEnum.code && <TapToCode />}
				{activeTab === MobileTabEnum.tree && <TechTreePage />}
				{activeTab === MobileTabEnum.shop && <MobileShopTab />}
			</div>
			<MobileTabBar activeTab={activeTab} onTabChange={setActiveTab} />
			{settingsOpen && (
				<MobileSettingsOverlay onClose={() => setSettingsOpen(false)} />
			)}
		</div>
	);
}
```

Note: `MobileShopTab` is a wrapper that renders `TierProgress`, a toggle between Upgrades/Milestones, and the corresponding list. It reuses existing components from the sidebar.

- [ ] **Step 2: Create `MobileShopTab`**

Create `apps/game/src/components/mobile-shop-tab.tsx`:

Renders (vertically, full-width, scrollable):
1. `TierProgress` at top
2. Toggle bar: "Upgrades" | "Milestones"
3. `UpgradeList` or `MilestoneList` based on toggle

Reuses existing components from `apps/game/src/modules/upgrade/`.

- [ ] **Step 3: Wire up `App` with conditional rendering**

In `apps/game/src/app.tsx`:
- Import `useIsMobile` and `MobileShell`
- In `App` component, call `useIsMobile()`
- If mobile: render `<MobileShell />` instead of the desktop shell div
- The `useGameLoop()` call stays (it runs regardless of layout)
- The `SingularitySequence` overlay stays (renders on top of either shell)
- The `EventToast` stays

```tsx
export function App() {
	useGameLoop();
	const isMobile = useIsMobile();
	const singularity = useGameStore((s) => s.singularity);
	// ... existing singularityAnimate logic ...

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

	return (
		<>
			{/* ... existing desktop layout unchanged ... */}
		</>
	);
}
```

- [ ] **Step 4: Force auto-run on mobile**

In `apps/game/src/modules/game/hooks/use-game-loop.ts`, the game loop should force `running: true` on mobile. The simplest approach: in `MobileShell`, call `useGameStore.getState().toggleRunning()` on mount if not already running. Or: pass `isMobile` context and skip the `running` check in the tick.

Simplest: in `MobileShell`, add an effect:

```typescript
useEffect(() => {
	const state = useGameStore.getState();
	if (!state.running) {
		state.toggleRunning();
	}
}, []);
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`

- [ ] **Step 6: Run biome check on new files**

Run: `npx biome check --fix apps/game/src/components/mobile-shell.tsx apps/game/src/components/mobile-shop-tab.tsx apps/game/src/app.tsx`

- [ ] **Step 7: Manual test**

Run: `npm run dev`, open `http://localhost:3000`
1. Resize browser to < 768px → should switch to mobile layout
2. Tap on code tab → floating "+X LoC" should appear
3. Switch to Tree tab → tech tree with touch pan
4. Switch to Shop tab → upgrades list
5. Tap gear icon → settings overlay slides up
6. Resize back to > 768px → desktop layout returns

- [ ] **Step 8: Commit**

```bash
git add apps/game/src/components/mobile-shell.tsx apps/game/src/components/mobile-shop-tab.tsx apps/game/src/app.tsx
git commit -m "✨ Add MobileShell with tab-based layout and tap-to-code"
```

---

### Task 7: Adapt TechTreePage for mobile

**Files:**
- Modify: `apps/game/src/components/tech-tree-page.tsx`

- [ ] **Step 1: Change popover behavior on mobile**

On mobile, there's no hover. Change popover to show on tap (instead of hover). If the node is affordable, research it. If not, show the popover. Tap elsewhere to dismiss.

Import `useIsMobile` and conditionally use `onNodeClick` for both research AND popover:

```typescript
const isMobile = useIsMobile();

const handleNodeClick = useCallback(
	(e: React.MouseEvent, node: Node) => {
		const techNode = allTechNodes.find((n) => n.id === node.id);
		if (!techNode) return;
		const owned = ownedTechNodes[techNode.id] ?? 0;
		const maxed = owned >= techNode.max;
		const cost = getTechNodeCost(techNode, owned);
		const useLoc = techNode.currency === "loc";
		const canAfford = useLoc ? loc >= cost : cash >= cost;

		if (!maxed && canAfford) {
			researchNode(techNode);
			if (isMobile) setHovered(null);
		} else if (isMobile && containerRef.current) {
			// Show popover on tap for non-affordable nodes
			const containerRect = containerRef.current.getBoundingClientRect();
			setHovered({
				node: techNode,
				x: e.clientX - containerRect.left + 12,
				y: e.clientY - containerRect.top,
			});
		}
	},
	[ownedTechNodes, loc, cash, researchNode, isMobile],
);
```

On mobile, disable hover handlers:

```typescript
onNodeMouseEnter={isMobile ? undefined : handleNodeMouseEnter}
onNodeMouseLeave={isMobile ? undefined : handleNodeMouseLeave}
```

Add pane click to dismiss popover on mobile:

```typescript
onPaneClick={isMobile ? () => setHovered(null) : undefined}
```

- [ ] **Step 2: Run typecheck**

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/components/tech-tree-page.tsx
git commit -m "✨ Adapt tech tree popover for mobile tap interaction"
```

---

### Task 8: Polish and verify

**Files:**
- Possibly adjust various components for mobile styling

- [ ] **Step 1: Add viewport meta tag**

In `apps/game/src/index.html`, ensure the viewport meta tag is set:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
```

The `user-scalable=no` prevents double-tap zoom which interferes with tap-to-code.

- [ ] **Step 2: Test on actual mobile or Chrome DevTools mobile emulator**

Open Chrome DevTools → Toggle device toolbar → Select iPhone/Android preset
1. All 3 tabs work
2. Tap-to-code produces floating numbers
3. Tech tree pans smoothly, popover shows on tap
4. Shop shows upgrades, can purchase
5. Settings overlay opens and closes
6. Resource bar shows all stats
7. FLOPS slider expands on tap
8. Singularity sequence works (test via god mode if accessible)

- [ ] **Step 3: Run full checks**

Run: `npm run typecheck && npm run check && npm run build`

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "✨ Complete mobile layout with tap-to-code, tabs, and responsive switching"
```
