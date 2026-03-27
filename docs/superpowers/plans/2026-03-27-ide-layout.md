# IDE Layout Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rearrange the game to look like an IDE: sidebar tree on the left (upgrade shop + milestones), tabbed main area center (editor, tech tree, settings, god mode), status bar at the bottom (resources + tier).

**Architecture:** Create two new components (SidebarTree, StatusBar), rewrite App.tsx layout from 3-panel horizontal to sidebar+main+statusbar, strip the old Sidebar/EditorPanel wrappers. The dynamic editor panel content (dashboard, CLI prompt) still works inside the `agi.py` tab.

**Tech Stack:** React 19, Zustand, Emotion CSS-in-JS, ts-pattern

**Spec:** `docs/superpowers/specs/2026-03-27-ide-layout-design.md`

---

### Task 1: Create the StatusBar component

A horizontal bar at the bottom of the viewport showing resources and tier info. Replaces ResourceBar + TierProgress.

**Files:**
- Create: `apps/game/src/components/status-bar.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { css } from "@emotion/react";
import { aiModels, tiers, useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useEffect, useRef, useState } from "react";

const barCss = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	padding: "2px 12px",
	background: "#0d1117",
	borderTop: "1px solid #1e2630",
	fontSize: 11,
	fontFamily: "'Courier New', monospace",
	flexShrink: 0,
	height: 24,
});

const leftCss = css({
	display: "flex",
	alignItems: "center",
	gap: 16,
});

const rightCss = css({
	display: "flex",
	alignItems: "center",
	gap: 16,
});

const statCss = css({
	display: "flex",
	alignItems: "center",
	gap: 4,
	whiteSpace: "nowrap",
	fontVariantNumeric: "tabular-nums",
});

const rateCss = css({
	color: "#484f58",
	fontSize: 10,
});

const execBarCss = css({
	display: "flex",
	alignItems: "center",
	padding: "0 12px",
	background: "#0d1117",
	borderTop: "1px solid #1e2630",
	flexShrink: 0,
	height: 28,
});

const execBtnCss = css({
	flex: 1,
	padding: "4px 0",
	fontSize: 11,
	fontWeight: "bold",
	fontFamily: "inherit",
	textTransform: "uppercase",
	letterSpacing: 1,
	border: "1px solid #7ee787",
	borderRadius: 3,
	cursor: "pointer",
	transition: "all 0.1s",
	background: "transparent",
	color: "#7ee787",
	"&:hover": { background: "#7ee787", color: "#0d1117" },
	"&:active": { transform: "scale(0.97)" },
});

const autoExecLabelCss = css({
	flex: 1,
	padding: "4px 0",
	fontSize: 11,
	fontWeight: "bold",
	fontFamily: "inherit",
	textTransform: "uppercase",
	letterSpacing: 1,
	textAlign: "center",
	color: "#3fb950",
	border: "1px solid #238636",
	borderRadius: 3,
	background: "rgba(35, 134, 54, 0.1)",
});

function useRatePerSec(value: number): number {
	const valueRef = useRef(value);
	valueRef.current = value;
	const prevRef = useRef(value);
	const [rate, setRate] = useState(0);

	useEffect(() => {
		const id = setInterval(() => {
			setRate(Math.max(0, valueRef.current - prevRef.current));
			prevRef.current = valueRef.current;
		}, 1000);
		return () => clearInterval(id);
	}, []);

	return rate;
}

export function StatusBar() {
	const cash = useGameStore((s) => s.cash);
	const loc = useGameStore((s) => s.loc);
	const totalLoc = useGameStore((s) => s.totalLoc);
	const totalCash = useGameStore((s) => s.totalCash);
	const totalExecutedLoc = useGameStore((s) => s.totalExecutedLoc);
	const flops = useGameStore((s) => s.flops);
	const currentTierIndex = useGameStore((s) => s.currentTierIndex);
	const cashMultiplier = useGameStore((s) => s.cashMultiplier);
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);
	const unlockedModels = useGameStore((s) => s.unlockedModels);
	const autoExec = useGameStore((s) => s.autoExecuteEnabled);
	const executeManual = useGameStore((s) => s.executeManual);

	const locRate = useRatePerSec(totalLoc);
	const cashRate = useRatePerSec(totalCash);
	const execRate = useRatePerSec(totalExecutedLoc);

	const tier = tiers[currentTierIndex];
	const cashPerLoc = tier?.cashPerLoc ?? 0.1;

	let aiFlopsCost = 0;
	if (aiUnlocked) {
		for (const model of aiModels) {
			if (unlockedModels[model.id]) aiFlopsCost += model.flopsCost;
		}
	}
	const execFlops = Math.max(0, flops - Math.min(aiFlopsCost, flops));
	const execLoc = Math.min(Math.floor(execFlops), Math.floor(loc));
	const earnPerExec = execLoc * cashPerLoc * cashMultiplier;

	return (
		<>
			{!autoExec && (
				<div css={execBarCss}>
					<button
						type="button"
						css={execBtnCss}
						onClick={executeManual}
						disabled={execLoc <= 0}
					>
						⚡ Execute {formatNumber(execLoc)} queued → $
						{formatNumber(earnPerExec, true)}
					</button>
				</div>
			)}
			{autoExec && (
				<div css={execBarCss}>
					<div css={autoExecLabelCss}>
						⚡ Auto-Execute — +${formatNumber(cashRate, true)}/s
					</div>
				</div>
			)}
			<div css={barCss}>
				<div css={leftCss}>
					<span css={statCss}>
						<span style={{ color: "#3fb950" }}>
							${formatNumber(cash, true)}
						</span>
						{cashRate > 0.1 && (
							<span css={rateCss}>(+${formatNumber(cashRate, true)}/s)</span>
						)}
					</span>
					<span css={statCss}>
						<span style={{ color: "#58a6ff" }}>
							◇ {formatNumber(loc)} LoC
						</span>
						{locRate > 0.1 && (
							<span css={rateCss}>(+{formatNumber(locRate)}/s)</span>
						)}
					</span>
					<span css={statCss}>
						<span style={{ color: "#fbbf24" }}>
							⚡ {formatNumber(flops)} FLOPS
						</span>
						{execRate > 0.1 && (
							<span css={rateCss}>({formatNumber(execRate)} exec/s)</span>
						)}
					</span>
				</div>
				<div css={rightCss}>
					<span style={{ color: "#8b949e" }}>{tier?.name ?? "—"}</span>
					<span style={{ color: "#484f58" }}>Python</span>
					<span style={{ color: "#484f58" }}>UTF-8</span>
				</div>
			</div>
		</>
	);
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/components/status-bar.tsx
git commit -m "✨ Add StatusBar component for IDE-like bottom bar"
```

---

### Task 2: Create the SidebarTree component

A tree-based upgrade shop with collapsible tier folders + milestones section at the bottom.

**Files:**
- Create: `apps/game/src/components/sidebar-tree.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { css } from "@emotion/react";
import type { Upgrade, UpgradeEffect } from "@agi-rush/domain";
import {
	allMilestones,
	allUpgrades,
	getEffectiveMax,
	getUpgradeCost,
	tiers,
	useGameStore,
} from "@modules/game";
import { formatNumber } from "@utils/format";
import { useState } from "react";

// ── Styles ──

const sidebarCss = css({
	display: "flex",
	flexDirection: "column",
	width: 240,
	minWidth: 200,
	background: "#0d1117",
	borderRight: "1px solid #1e2630",
	overflow: "hidden",
	flexShrink: 0,
});

const scrollCss = css({
	flex: 1,
	overflowY: "auto",
	padding: "4px 0",
	"&::-webkit-scrollbar": { width: 6 },
	"&::-webkit-scrollbar-track": { background: "transparent" },
	"&::-webkit-scrollbar-thumb": { background: "#1e2630", borderRadius: 3 },
});

const sectionHeaderCss = css({
	fontSize: 9,
	textTransform: "uppercase",
	letterSpacing: 0.5,
	color: "#8b949e",
	padding: "8px 12px 4px",
	userSelect: "none",
});

const folderRowCss = css({
	display: "flex",
	alignItems: "center",
	gap: 4,
	padding: "3px 8px",
	fontSize: 11,
	cursor: "pointer",
	userSelect: "none",
	"&:hover": { background: "#141920" },
});

const folderLockedCss = css({
	color: "#484f58",
	cursor: "default",
	"&:hover": { background: "transparent" },
});

const itemCss = css({
	margin: "1px 8px 1px 20px",
	padding: "4px 6px",
	borderRadius: 4,
	background: "#141920",
	border: "1px solid #1e2630",
	cursor: "pointer",
	transition: "border-color 0.15s",
	"&:hover": { borderColor: "#58a6ff" },
});

const itemLockedCss = css({
	opacity: 0.4,
	cursor: "default",
	"&:hover": { borderColor: "#1e2630" },
});

const itemMaxedCss = css({
	borderColor: "#3fb950",
	opacity: 0.5,
	cursor: "default",
	"&:hover": { borderColor: "#3fb950" },
});

const itemRow1Css = css({
	display: "flex",
	alignItems: "center",
	gap: 6,
	fontSize: 11,
});

const itemNameCss = css({
	flex: 1,
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
});

const itemCountCss = css({
	fontSize: 9,
	flexShrink: 0,
});

const itemRow2Css = css({
	display: "flex",
	alignItems: "center",
	gap: 6,
	paddingLeft: 22,
	marginTop: 1,
});

const effectCss = css({
	fontSize: 9,
	flex: 1,
});

const priceBadgeCss = css({
	fontSize: 8,
	padding: "1px 5px",
	borderRadius: 3,
	flexShrink: 0,
});

const milestoneCss = css({
	padding: "2px 12px 2px 20px",
	fontSize: 10,
	lineHeight: 1.8,
});

// ── Effect summary ──

function formatEffect(effect: UpgradeEffect): { text: string; color: string } {
	const val = effect.value as number;
	if (effect.op === "enable" && effect.type === "singularity")
		return { text: "🌀 AGI", color: "#e94560" };
	if (effect.type === "instantCash")
		return { text: `+$${formatNumber(val)}`, color: "#3fb950" };
	if (effect.type === "llmHostSlot")
		return { text: `+${val} AI slot`, color: "#d4a574" };
	if (effect.type === "managerLoc")
		return { text: "+50% teams", color: "#c084fc" };

	if (effect.op === "multiply")
		return { text: `×${val}`, color: "#c084fc" };

	const locTypes = [
		"freelancerLoc",
		"internLoc",
		"devLoc",
		"teamLoc",
		"autoLoc",
		"agentLoc",
	];
	if (locTypes.includes(effect.type))
		return { text: `+${formatNumber(val)} loc/s`, color: "#58a6ff" };

	const flopTypes = ["flops", "cpuFlops", "ramFlops", "storageFlops"];
	if (flopTypes.includes(effect.type))
		return { text: `+${formatNumber(val)} flops`, color: "#fbbf24" };

	return { text: effect.type, color: "#8b949e" };
}

// ── Upgrade item ──

function UpgradeItem({ upgrade }: { upgrade: Upgrade }) {
	const cash = useGameStore((s) => s.cash);
	const owned = useGameStore((s) => s.ownedUpgrades[upgrade.id] ?? 0);
	const buyUpgrade = useGameStore((s) => s.buyUpgrade);
	const state = useGameStore((s) => s);

	const cost = getUpgradeCost(upgrade, owned, state);
	const effectiveMax = getEffectiveMax(upgrade, state);
	const canAfford = cash >= cost;
	const maxed = owned >= effectiveMax;

	const effect = upgrade.effects[0]
		? formatEffect(upgrade.effects[0])
		: null;

	const nameColor = canAfford || maxed ? "#c9d1d9" : "#6272a4";

	return (
		<div
			css={[
				itemCss,
				!canAfford && !maxed && itemLockedCss,
				maxed && itemMaxedCss,
			]}
			onClick={() => {
				if (canAfford && !maxed) buyUpgrade(upgrade);
			}}
			onKeyDown={(e) => {
				if (e.key === "Enter" && canAfford && !maxed) buyUpgrade(upgrade);
			}}
			role="button"
			tabIndex={0}
		>
			<div css={itemRow1Css}>
				<span>{upgrade.icon}</span>
				<span css={itemNameCss} style={{ color: nameColor }}>
					{upgrade.name}
				</span>
				<span
					css={itemCountCss}
					style={{ color: maxed ? "#3fb950" : "#484f58" }}
				>
					{effectiveMax === 1
						? owned > 0
							? "✓"
							: ""
						: `${owned}/${effectiveMax}`}
				</span>
			</div>
			<div css={itemRow2Css}>
				{effect && (
					<span css={effectCss} style={{ color: effect.color }}>
						{effect.text}
					</span>
				)}
				<span
					css={priceBadgeCss}
					style={{
						background: maxed ? "#1a3a2a" : "#2a2a1a",
						color: maxed ? "#3fb950" : "#d19a66",
					}}
				>
					{maxed ? "MAXED" : `$${formatNumber(cost)}`}
				</span>
			</div>
		</div>
	);
}

// ── Main sidebar ──

export function SidebarTree() {
	const currentTierIndex = useGameStore((s) => s.currentTierIndex);
	const ownedTechNodes = useGameStore((s) => s.ownedTechNodes);
	const reachedMilestones = useGameStore((s) => s.reachedMilestones);
	const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
	const [milestonesOpen, setMilestonesOpen] = useState(true);

	const toggle = (id: string) =>
		setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

	return (
		<div css={sidebarCss}>
			<div css={scrollCss}>
				<div css={sectionHeaderCss}>Upgrades</div>
				{tiers.map((tier) => {
					const locked = tier.index > currentTierIndex;
					const isOpen = !locked && !collapsed[tier.id];
					const tierUpgrades = allUpgrades.filter(
						(u) =>
							u.tier === tier.id &&
							(!u.requires ||
								u.requires.every((id) => (ownedTechNodes[id] ?? 0) > 0)),
					);

					return (
						<div key={tier.id}>
							<div
								css={[folderRowCss, locked && folderLockedCss]}
								onClick={() => {
									if (!locked) toggle(tier.id);
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter" && !locked) toggle(tier.id);
								}}
								role="button"
								tabIndex={locked ? -1 : 0}
							>
								<span style={{ fontSize: 10, width: 12 }}>
									{locked ? "▸" : isOpen ? "▾" : "▸"}
								</span>
								<span>📂</span>
								<span style={{ color: locked ? "#484f58" : "#c9d1d9" }}>
									{tier.id}/
								</span>
								{locked && (
									<span style={{ fontSize: 8, marginLeft: 4 }}>🔒</span>
								)}
							</div>
							{isOpen &&
								tierUpgrades.map((u) => (
									<UpgradeItem key={u.id} upgrade={u} />
								))}
						</div>
					);
				})}

				{/* Milestones section */}
				<div
					css={[sectionHeaderCss, { cursor: "pointer" }]}
					onClick={() => setMilestonesOpen(!milestonesOpen)}
					onKeyDown={(e) => {
						if (e.key === "Enter") setMilestonesOpen(!milestonesOpen);
					}}
					role="button"
					tabIndex={0}
				>
					{milestonesOpen ? "▾" : "▸"} Milestones
				</div>
				{milestonesOpen &&
					allMilestones.map((m) => {
						const reached = reachedMilestones.includes(m.id);
						return (
							<div
								key={m.id}
								css={milestoneCss}
								style={{ color: reached ? "#3fb950" : "#484f58" }}
							>
								{reached ? "✓" : "○"} {m.name} — {formatNumber(m.threshold)}
							</div>
						);
					})}
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/components/sidebar-tree.tsx
git commit -m "✨ Add SidebarTree component with collapsible tier folders and milestones"
```

---

### Task 3: Strip EditorPanel wrapper for embedding in main area

The EditorPanel currently wraps itself in a panel div with flex/minWidth/borderRight. In the new layout, its content goes inside a tab in the main area, so we need to remove the outer wrapper and make it a pure content component.

**Files:**
- Modify: `apps/game/src/components/editor-panel.tsx`

- [ ] **Step 1: Simplify EditorPanel to content-only**

Replace the entire file with:

```typescript
import { css } from "@emotion/react";
import { Editor } from "@modules/editor";
import { useGameStore } from "@modules/game";
import { AnalyticsDashboard } from "./analytics-dashboard";
import { CliPrompt } from "./cli-prompt";

const wrapperCss = css({
	display: "flex",
	flexDirection: "column",
	flex: 1,
	overflow: "hidden",
});

const sectionCss = css({
	display: "flex",
	flexDirection: "column",
	overflow: "hidden",
	transition: "flex 0.5s ease",
});

const tabBarCss = css({
	display: "flex",
	background: "#0d1117",
	borderBottom: "1px solid #1e2630",
	flexShrink: 0,
});

const tabCss = css({
	padding: "6px 16px",
	fontSize: 12,
	color: "#c9d1d9",
	background: "#141920",
	border: "none",
	borderRight: "1px solid #1e2630",
	borderBottom: "1px solid #141920",
	marginBottom: -1,
	fontFamily: "inherit",
	whiteSpace: "nowrap",
});

const contentCss = css({
	flex: 1,
	overflow: "hidden",
	display: "flex",
	flexDirection: "column",
});

const dividerCss = css({
	height: 1,
	background: "#1e2630",
	flexShrink: 0,
});

export function EditorPanel() {
	const tierIndex = useGameStore((s) => s.currentTierIndex);
	const autoLocPerSec = useGameStore((s) => s.autoLocPerSec);
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);

	const showDashboard = autoLocPerSec > 0 || tierIndex >= 2;
	const showEditor = !aiUnlocked;
	const showPrompt = aiUnlocked;

	return (
		<div css={wrapperCss} data-tutorial="editor">
			{showDashboard && (
				<div css={sectionCss} style={{ flex: showEditor ? 2 : 3 }}>
					<AnalyticsDashboard />
				</div>
			)}

			{showDashboard && (showEditor || showPrompt) && <div css={dividerCss} />}

			{showEditor && (
				<div css={sectionCss} style={{ flex: showDashboard ? 3 : 1 }}>
					<div css={tabBarCss}>
						<div css={tabCss}>agi.py</div>
					</div>
					<div css={contentCss}>
						<Editor />
					</div>
				</div>
			)}

			{showPrompt && (
				<div css={sectionCss} style={{ flex: 2 }}>
					<CliPrompt />
				</div>
			)}
		</div>
	);
}
```

The key changes from the previous version:
- Removed `panelCss` with `borderRight`, `transition: flex`, `minWidth`
- Removed `getPanelStyle()` — flex/minWidth no longer needed (the main area handles sizing)
- Wrapper uses simple `flex: 1` to fill its tab content area

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/components/editor-panel.tsx
git commit -m "♻️ Strip EditorPanel wrapper for embedding in main area tab"
```

---

### Task 4: Rewrite App.tsx with IDE layout

Replace the 3-panel layout with: sidebar-tree (left) + main tabbed area (center) + status bar (bottom). The main area has tabs for agi.py, tech_tree.svg, settings.json, godmode.ts.

**Files:**
- Modify: `apps/game/src/app.tsx`

- [ ] **Step 1: Update imports**

At the top of app.tsx, replace the Sidebar import and add new ones:

Replace:
```typescript
import { Sidebar } from "@components/sidebar";
```

With:
```typescript
import { SidebarTree } from "@components/sidebar-tree";
import { StatusBar } from "@components/status-bar";
```

- [ ] **Step 2: Remove unused panel styles and update middleTabs**

Remove `getMiddlePanelFlex` function (lines 95-99).

Update `middleTabs` to include the game/editor tab:

```typescript
const middleTabs: TabDef[] = [
	{ page: PageEnum.game, filename: "agi.py" },
	{ page: PageEnum.tech_tree, filename: "tech_tree.svg" },
	{ page: PageEnum.settings, filename: "settings.json" },
	{ page: PageEnum.god_mode, filename: "godmode.ts" },
];
```

- [ ] **Step 3: Rewrite the desktop layout in the App component**

Replace the desktop return block (the `return` after the mobile check) with:

```typescript
	return (
		<>
			<Global styles={globalStyles} />
			<div
				ref={shellRef}
				css={[
					{
						display: "flex",
						flexDirection: "column",
						height: "100vh",
						overflow: "hidden",
						background: "#0a0e14",
						color: "#c5c8c6",
						fontFamily: "'Courier New', monospace",
					},
					singularity && singularityAnimate && shellCollapseCss,
				]}
			>
				{/* Main area: sidebar + tabbed content */}
				<div css={{ display: "flex", flex: 1, overflow: "hidden" }}>
					<SidebarTree />

					{/* Tabbed main area */}
					<div css={[panelCss, { flex: 1 }]}>
						<div css={tabBarCss}>
							{middleTabs.map((t) => (
								<button
									key={t.page}
									type="button"
									css={t.page === page ? tabActiveCss : tabCss}
									onClick={() => setPage(t.page)}
								>
									{t.filename}
								</button>
							))}
						</div>
						<div css={contentCss}>
							{match(page)
								.with(PageEnum.game, () => <EditorPanel />)
								.with(PageEnum.tech_tree, () => <TechTreePage />)
								.with(PageEnum.settings, () => <SettingsPage />)
								.with(PageEnum.god_mode, () => <GodModePage />)
								.exhaustive()}
						</div>
					</div>
				</div>

				{/* Status bar */}
				<StatusBar />
			</div>
			<EventToast />
			<TutorialTip />
			{singularity && <SingularitySequence animate={singularityAnimate} />}
		</>
	);
```

- [ ] **Step 4: Remove the `tierIndex` selector from App**

The line `const tierIndex = useGameStore((s) => s.currentTierIndex);` in the App component was used for `getMiddlePanelFlex` which we removed. Delete it.

- [ ] **Step 5: Clean up the old `shellCss` constant**

The `shellCss` constant (lines 33-40) is now replaced by inline styles in the return. Remove it. Also remove `middlePanelCss` reference if it still exists.

- [ ] **Step 6: Verify typecheck passes**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add apps/game/src/app.tsx
git commit -m "♻️ Rewrite App.tsx with IDE layout: sidebar-tree left, tabbed main area, status bar bottom"
```

---

### Task 5: Delete old Sidebar component

The old sidebar.tsx is fully replaced by sidebar-tree.tsx + status-bar.tsx.

**Files:**
- Delete: `apps/game/src/components/sidebar.tsx`

- [ ] **Step 1: Delete the file**

```bash
rm apps/game/src/components/sidebar.tsx
```

- [ ] **Step 2: Verify no remaining imports**

Run: `grep -r "sidebar" apps/game/src/ --include="*.tsx" --include="*.ts" -l`

Check that no file imports from `./sidebar` or `@components/sidebar`. The mobile shell may import it — if so, that's out of scope (mobile layout unchanged), but check that it still works.

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: No errors (if mobile shell imports Sidebar, we need to keep the file or update mobile — check this)

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "🗑️ Remove old Sidebar component (replaced by SidebarTree + StatusBar)"
```

---

### Task 6: Run biome check and fix formatting

- [ ] **Step 1: Run biome check**

Run: `npm run check`
If errors in our files, run: `npm run check:fix`

- [ ] **Step 2: Verify typecheck still passes after fixes**

Run: `npm run typecheck`

- [ ] **Step 3: Commit fixes if any**

```bash
git add -u
git commit -m "🐛 Fix biome lint/format issues"
```

---

### Task 7: Verify full game flow

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Open http://localhost:3000

- [ ] **Step 2: Verify IDE layout**

Check:
- Sidebar tree is on the LEFT with tier folders
- Main area is CENTER with tab bar showing agi.py, tech_tree.svg, settings.json, godmode.ts
- Status bar is at BOTTOM showing $, LoC, FLOPS, tier name
- No right panel

- [ ] **Step 3: Verify sidebar tree**

Check:
- Unlocked tier folders expand/collapse on click
- Locked tiers show 🔒 and don't expand
- Upgrade items show icon, name, count, effect summary, price badge
- Clicking an affordable item buys it
- Maxed items are dimmed with green border
- Milestones section at bottom is collapsible

- [ ] **Step 4: Verify tab switching**

Check:
- agi.py tab shows the editor (with dashboard at T2+, CLI prompt at T4+)
- tech_tree.svg tab shows the tech tree
- settings.json tab shows settings
- godmode.ts tab shows god mode

- [ ] **Step 5: Verify status bar**

Check:
- Cash, LoC, FLOPS values update in real-time
- Rates show in parentheses when > 0
- Tier name appears on the right
- Execute button works (or auto-execute label shows)

- [ ] **Step 6: Build check**

Run: `npm run build`
Expected: Builds successfully

- [ ] **Step 7: Commit any fixes**

```bash
git add -u
git commit -m "🐛 Fix issues found during smoke test"
```

Only if fixes were needed.
