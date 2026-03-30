# Session Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add temporal session analytics (tier timeline, rate trends, purchase feed, sparkline graphs) as sub-tabs inside the existing Stats Panel.

**Architecture:** Add `SessionAnalytics` state to the game store (tier transitions, purchase log, rate snapshots). The Stats Panel gets an inner tab bar switching between Resources (existing content), Timeline (new), and Graphs (new). Each sub-tab is a focused component. Data collection hooks into existing store actions. Two new tech tree nodes gate the unlocks.

**Tech Stack:** React 19, Zustand (game store extension), Emotion CSS, inline SVG sparklines, react-i18next

**Spec:** `docs/superpowers/specs/2026-03-30-session-analytics-design.md`

---

## File Map

```
apps/game/src/components/
├── stats-panel.tsx                # MODIFY: add inner tab bar, split into sub-tab rendering
├── stats-panel-resources.tsx      # CREATE: extracted current stats panel body (resources + sources)
├── stats-panel-timeline.tsx       # CREATE: tier bar, rate trends, purchase feed
├── stats-panel-graphs.tsx         # CREATE: sparkline charts for cash/s, LoC flow, FLOPS util
└── sparkline.tsx                  # CREATE: reusable SVG sparkline component
```

```
apps/game/src/modules/game/store/
└── game-store.ts                  # MODIFY: add session analytics state, collection in tick/buy/research
```

```
libs/domain/data/
└── tech-tree.json                 # MODIFY: add 2 new tech nodes (unlock_session_timeline, unlock_perf_graphs)
```

```
apps/game/src/i18n/locales/*/
└── ui.json                        # MODIFY: add translation keys for analytics tabs and labels (8 locales)
└── tech-tree.json                 # MODIFY: add translation keys for 2 new tech nodes (8 locales)
```

---

### Task 1: Add session analytics state to game store

**Files:**
- Modify: `apps/game/src/modules/game/store/game-store.ts`
- Modify: `apps/game/src/modules/game/index.ts`

- [ ] **Step 1: Add types and state**

In `apps/game/src/modules/game/store/game-store.ts`, add these interfaces after the existing `QueuedBlock` interface:

```typescript
export interface TierTransition {
	tierIndex: number;
	enteredAt: number; // seconds since session start (performance.now() based)
}

export interface PurchaseEntry {
	id: string;
	name: string;
	cost: number;
	time: number; // seconds since session start
}

export interface RateSnapshot {
	t: number; // seconds since session start
	cashPerSec: number;
	locProducedPerSec: number;
	locExecutedPerSec: number;
	flops: number;
	flopUtilization: number;
	tierIndex: number;
}
```

Add these fields to the `GameState` interface (after `reachedMilestones`):

```typescript
// Session analytics
sessionStartTime: number;
tierTransitions: TierTransition[];
purchaseLog: PurchaseEntry[];
rateSnapshots: RateSnapshot[];
lastSnapshotTime: number;
prevTickTotalCash: number;
prevTickTotalLoc: number;
prevTickTotalExecLoc: number;
```

Add default values to `initialState`:

```typescript
sessionStartTime: performance.now(),
tierTransitions: [{ tierIndex: 0, enteredAt: 0 }],
purchaseLog: [],
rateSnapshots: [],
lastSnapshotTime: 0,
prevTickTotalCash: 0,
prevTickTotalLoc: 0,
prevTickTotalExecLoc: 0,
```

- [ ] **Step 2: Add data collection to tick()**

In the `tick(dt)` function, after the milestone section (after `return next;` is built but before it's returned), add rate snapshot collection:

```typescript
// ── 4. Session analytics snapshots (every 5s) ──
const elapsed = (performance.now() - s.sessionStartTime) / 1000;
if (elapsed - s.lastSnapshotTime >= 5) {
	const cashDelta = totalCash - s.prevTickTotalCash;
	const locDelta = totalLoc - s.prevTickTotalLoc;
	const execDelta = totalExecutedLoc - s.prevTickTotalExecLoc;
	const dtSnap = elapsed - s.lastSnapshotTime;
	const flopUtil = s.flops > 0 ? Math.min(1, loc / Math.max(1, s.flops)) : 0;

	const snapshot: RateSnapshot = {
		t: elapsed,
		cashPerSec: dtSnap > 0 ? cashDelta / dtSnap : 0,
		locProducedPerSec: dtSnap > 0 ? locDelta / dtSnap : 0,
		locExecutedPerSec: dtSnap > 0 ? execDelta / dtSnap : 0,
		flops: s.flops,
		flopUtilization: flopUtil,
		tierIndex: s.currentTierIndex,
	};

	// Ring buffer: keep last 720 entries (1 hour at 5s intervals)
	const snapshots = [...s.rateSnapshots, snapshot].slice(-720);
	next.rateSnapshots = snapshots;
	next.lastSnapshotTime = elapsed;
	next.prevTickTotalCash = totalCash;
	next.prevTickTotalLoc = totalLoc;
	next.prevTickTotalExecLoc = totalExecutedLoc;
}
```

- [ ] **Step 3: Add purchase logging to buyUpgrade**

In `buyUpgrade`, after `sfx.purchase()`, add:

```typescript
const elapsed = (performance.now() - get().sessionStartTime) / 1000;
set((s) => ({
	purchaseLog: [...s.purchaseLog.slice(-49), {
		id: upgrade.id,
		name: upgrade.id,
		cost,
		time: elapsed,
	}],
}));
```

- [ ] **Step 4: Add purchase logging to researchNode**

In `researchNode`, after `sfx.purchase()`, add:

```typescript
const elapsed = (performance.now() - get().sessionStartTime) / 1000;
set((s) => ({
	purchaseLog: [...s.purchaseLog.slice(-49), {
		id: node.id,
		name: node.id,
		cost,
		time: elapsed,
	}],
}));
```

- [ ] **Step 5: Add tier transition tracking**

In `recalcDerivedStats`, find the line `state.currentTierIndex = tierIndex;`. Wrap it with tier transition detection. Since `recalcDerivedStats` is a pure mutation function (not inside `set()`), we need to check if the tier actually changed:

```typescript
if (tierIndex !== state.currentTierIndex) {
	const elapsed = (performance.now() - state.sessionStartTime) / 1000;
	state.tierTransitions = [
		...state.tierTransitions,
		{ tierIndex, enteredAt: elapsed },
	];
}
state.currentTierIndex = tierIndex;
```

- [ ] **Step 6: Do NOT persist analytics state**

The `partialize` function already only persists specific fields. Since we didn't add session analytics fields to `partialize`, they reset on page reload — which is correct (session analytics = current session only).

- [ ] **Step 7: Export new types from module index**

In `apps/game/src/modules/game/index.ts`, add:

```typescript
export type {
	TierTransition,
	PurchaseEntry,
	RateSnapshot,
} from "./store/game-store";
```

- [ ] **Step 8: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 9: Commit**

```bash
git add apps/game/src/modules/game/
git commit -m "✨ Add session analytics state: tier transitions, purchase log, rate snapshots"
```

---

### Task 2: Add tech tree nodes for analytics unlocks

**Files:**
- Modify: `libs/domain/data/tech-tree.json`
- Modify: `apps/game/src/i18n/locales/*/tech-tree.json` (8 locales)

- [ ] **Step 1: Add tech tree nodes**

In `libs/domain/data/tech-tree.json`, add two nodes in the `nodes` array (after the `unlock_analytics` node):

```json
{
	"id": "unlock_session_timeline",
	"name": "Session Timeline",
	"description": "Track your session progress and purchase history.",
	"icon": "📅",
	"requires": ["unlock_stats_panel"],
	"max": 1,
	"baseCost": 50,
	"costMultiplier": 1,
	"currency": "cash",
	"effects": [],
	"x": 1240,
	"y": 220
},
{
	"id": "unlock_perf_graphs",
	"name": "Performance Graphs",
	"description": "Sparkline charts showing rates over time.",
	"icon": "📉",
	"requires": ["unlock_session_timeline", "tier_startup"],
	"max": 1,
	"baseCost": 3000,
	"costMultiplier": 1,
	"currency": "cash",
	"effects": [],
	"x": 1360,
	"y": 220
}
```

- [ ] **Step 2: Add English translations**

In `apps/game/src/i18n/locales/en/tech-tree.json`, add:

```json
"unlock_session_timeline": {
	"name": "Session Timeline",
	"description": "Track your session progress and purchase history."
},
"unlock_perf_graphs": {
	"name": "Performance Graphs",
	"description": "Sparkline charts showing rates over time."
}
```

- [ ] **Step 3: Add translations for all other locales**

Add equivalent translations to `fr`, `it`, `de`, `es`, `pl`, `zh`, `ru` locale files under `tech-tree.json`. Example for French:

```json
"unlock_session_timeline": {
	"name": "Chronologie de session",
	"description": "Suivez votre progression et historique d'achats."
},
"unlock_perf_graphs": {
	"name": "Graphiques de performance",
	"description": "Graphiques sparkline montrant les taux dans le temps."
}
```

Repeat for all 7 non-English locales with appropriate translations.

- [ ] **Step 4: Run balance sim to verify**

```bash
npm run sim
```

Expected: All profiles still pass (new nodes are cheap display-only unlocks, no balance impact).

- [ ] **Step 5: Commit**

```bash
git add libs/domain/data/tech-tree.json apps/game/src/i18n/
git commit -m "✨ Add tech tree nodes: session timeline (50$) and performance graphs (3000$)"
```

---

### Task 3: Sparkline component

**Files:**
- Create: `apps/game/src/components/sparkline.tsx`

- [ ] **Step 1: Create sparkline component**

Create `apps/game/src/components/sparkline.tsx`:

```typescript
import { css } from "@emotion/react";
import type { TierTransition } from "@modules/game";
import { useMemo } from "react";

const svgCss = css({ width: "100%", height: 32, display: "block" });

// Tier colors for dashed markers
const TIER_COLORS = ["#484f58", "#3fb950", "#58a6ff", "#d2a8ff", "#f0883e", "#f85149"];

interface SparklineProps {
	/** Array of y-values to plot */
	data: number[];
	/** Line color */
	color: string;
	/** Optional second data series (dashed line) */
	data2?: number[];
	/** Color for second series */
	color2?: string;
	/** Tier transitions to show as vertical markers */
	tierTransitions?: TierTransition[];
	/** Total elapsed seconds (for scaling tier marker x positions) */
	totalTime?: number;
}

export function Sparkline({
	data,
	color,
	data2,
	color2,
	tierTransitions,
	totalTime,
}: SparklineProps) {
	const { points, points2, markers } = useMemo(() => {
		const W = 256;
		const H = 32;
		const allValues = [...data, ...(data2 ?? [])];
		const maxVal = Math.max(1, ...allValues);

		const toPoints = (values: number[]) =>
			values
				.map((v, i) => {
					const x = values.length > 1 ? (i / (values.length - 1)) * W : W / 2;
					const y = H - (v / maxVal) * (H - 4) - 2;
					return `${x},${y}`;
				})
				.join(" ");

		const pts = toPoints(data);
		const pts2 = data2 ? toPoints(data2) : undefined;

		// Tier transition markers
		const mkrs: Array<{ x: number; color: string; label: string }> = [];
		if (tierTransitions && totalTime && totalTime > 0) {
			for (const tt of tierTransitions) {
				if (tt.tierIndex === 0) continue; // skip T0 start
				const x = (tt.enteredAt / totalTime) * W;
				if (x > 0 && x < W) {
					mkrs.push({
						x,
						color: TIER_COLORS[tt.tierIndex] ?? "#484f58",
						label: `T${tt.tierIndex}`,
					});
				}
			}
		}

		return { points: pts, points2: pts2, markers: mkrs };
	}, [data, data2, tierTransitions, totalTime]);

	// Build area polygon (line + bottom edge)
	const areaPoints = `0,32 ${points} 256,32`;

	return (
		<svg css={svgCss} viewBox="0 0 256 32" preserveAspectRatio="none">
			{/* Tier markers */}
			{markers.map((m) => (
				<g key={m.label}>
					<line
						x1={m.x}
						y1={0}
						x2={m.x}
						y2={32}
						stroke={m.color}
						strokeWidth={0.5}
						strokeDasharray="2,2"
					/>
					<text x={m.x + 2} y={8} fill={m.color} fontSize={5}>
						{m.label}
					</text>
				</g>
			))}
			{/* Area fill */}
			<polygon fill={color} opacity={0.12} points={areaPoints} />
			{/* Main line */}
			<polyline
				fill="none"
				stroke={color}
				strokeWidth={1.5}
				points={points}
			/>
			{/* Optional second series */}
			{points2 && (
				<polyline
					fill="none"
					stroke={color2 ?? "#888"}
					strokeWidth={1.2}
					strokeDasharray="3,2"
					points={points2}
				/>
			)}
		</svg>
	);
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/components/sparkline.tsx
git commit -m "✨ Add reusable Sparkline SVG component with tier markers"
```

---

### Task 4: Timeline sub-tab component

**Files:**
- Create: `apps/game/src/components/stats-panel-timeline.tsx`

- [ ] **Step 1: Create timeline component**

Create `apps/game/src/components/stats-panel-timeline.tsx`:

```typescript
import { css } from "@emotion/react";
import { tiers, useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";

const TIER_COLORS = ["#484f58", "#3fb950", "#58a6ff", "#d2a8ff", "#f0883e", "#f85149"];

const timelineCss = css({
	display: "flex",
	height: 24,
	borderRadius: 4,
	overflow: "hidden",
	margin: "8px 0",
	border: "1px solid var(--border)",
});

const sectionCss = css({ padding: "8px 12px" });

const labelCss = css({
	fontSize: 11,
	textTransform: "uppercase",
	letterSpacing: 0.5,
	marginBottom: 6,
});

const rowCss = css({
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	padding: "4px 0",
	fontSize: 12,
});

const trendCss = css({
	display: "inline-flex",
	alignItems: "center",
	gap: 2,
	fontSize: 10,
	padding: "1px 4px",
	borderRadius: 3,
});

const feedItemCss = css({
	display: "flex",
	justifyContent: "space-between",
	padding: "3px 0",
	fontSize: 11,
	borderBottom: "1px solid var(--divider)",
	"&:last-child": { borderBottom: "none" },
});

function formatElapsed(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

function formatAgo(secondsAgo: number): string {
	if (secondsAgo < 60) return `${Math.floor(secondsAgo)}s ago`;
	const m = Math.floor(secondsAgo / 60);
	const s = Math.floor(secondsAgo % 60);
	return `${m}:${String(s).padStart(2, "0")} ago`;
}

export function StatsPanelTimeline() {
	const { t } = useTranslation();
	const { t: tUpgrades } = useTranslation("upgrades");
	const { t: tTech } = useTranslation("tech-tree");
	const theme = useIdeTheme();
	const tierTransitions = useGameStore((s) => s.tierTransitions);
	const currentTierIndex = useGameStore((s) => s.currentTierIndex);
	const sessionStartTime = useGameStore((s) => s.sessionStartTime);
	const purchaseLog = useGameStore((s) => s.purchaseLog);
	const rateSnapshots = useGameStore((s) => s.rateSnapshots);

	const elapsed = (performance.now() - sessionStartTime) / 1000;

	// Tier durations for the bar
	const tierDurations = useMemo(() => {
		const durations: Array<{ tierIndex: number; duration: number }> = [];
		for (let i = 0; i < tierTransitions.length; i++) {
			const start = tierTransitions[i].enteredAt;
			const end = tierTransitions[i + 1]?.enteredAt ?? elapsed;
			durations.push({ tierIndex: tierTransitions[i].tierIndex, duration: end - start });
		}
		return durations;
	}, [tierTransitions, elapsed]);

	// Trend: compare latest snapshot to ~30s ago
	const trend = useMemo(() => {
		const snaps = rateSnapshots;
		if (snaps.length < 2) return null;
		const latest = snaps[snaps.length - 1];
		// Find snapshot ~30s ago (6 entries back at 5s intervals)
		const idx = Math.max(0, snaps.length - 7);
		const prev = snaps[idx];
		if (!prev || !latest) return null;

		const cashPct = prev.cashPerSec > 0
			? ((latest.cashPerSec - prev.cashPerSec) / prev.cashPerSec) * 100
			: 0;
		const locPct = prev.locProducedPerSec > 0
			? ((latest.locProducedPerSec - prev.locProducedPerSec) / prev.locProducedPerSec) * 100
			: 0;
		const flopDelta = (latest.flopUtilization - prev.flopUtilization) * 100;

		return {
			cashPerSec: latest.cashPerSec,
			cashPct,
			locPerSec: latest.locProducedPerSec,
			locPct,
			flopUtil: latest.flopUtilization * 100,
			flopDelta,
		};
	}, [rateSnapshots]);

	// Recent purchases (newest first)
	const recentPurchases = useMemo(
		() => [...purchaseLog].reverse().slice(0, 10),
		[purchaseLog],
	);

	return (
		<div>
			{/* Tier Timeline Bar */}
			<div css={sectionCss}>
				<div css={labelCss} style={{ color: theme.textMuted }}>
					{t("stats_panel.tier_progression")}
				</div>
				<div css={timelineCss} style={{ borderColor: theme.border }}>
					{tierDurations.map((td, i) => {
						const pct = elapsed > 0 ? (td.duration / elapsed) * 100 : 0;
						const isLast = i === tierDurations.length - 1;
						return (
							<div
								key={td.tierIndex}
								style={{
									width: `${Math.max(pct, 2)}%`,
									background: TIER_COLORS[td.tierIndex],
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									fontSize: 9,
									fontWeight: 600,
									color: td.tierIndex <= 1 ? "#c9d1d9" : "rgba(0,0,0,0.7)",
									position: "relative",
									animation: isLast ? "pulse 2s ease-in-out infinite" : undefined,
								}}
							>
								{pct > 8 && <span>T{td.tierIndex}</span>}
								{pct > 15 && (
									<span style={{ position: "absolute", bottom: 1, right: 3, fontSize: 8, opacity: 0.8 }}>
										{formatElapsed(td.duration)}
									</span>
								)}
							</div>
						);
					})}
				</div>
			</div>

			<div style={{ borderTop: `1px solid ${theme.border}` }} />

			{/* Rate Trends */}
			{trend && (
				<>
					<div css={sectionCss}>
						<div css={labelCss} style={{ color: theme.textMuted }}>
							{t("stats_panel.rates_vs_30s")}
						</div>
						<div css={rowCss}>
							<span style={{ color: theme.textMuted }}>$ {t("stats_panel.cash_per_sec")}</span>
							<span>
								<span style={{ color: theme.cashColor, fontWeight: 500 }}>
									${formatNumber(trend.cashPerSec, true)}
								</span>
								<span
									css={trendCss}
									style={{
										color: trend.cashPct >= 0 ? theme.success : "#f85149",
										background: trend.cashPct >= 0 ? "rgba(63,185,80,0.1)" : "rgba(248,81,73,0.1)",
										marginLeft: 4,
									}}
								>
									{trend.cashPct >= 0 ? "+" : ""}{Math.round(trend.cashPct)}%
								</span>
							</span>
						</div>
						<div css={rowCss}>
							<span style={{ color: theme.textMuted }}>LoC/s</span>
							<span>
								<span style={{ color: theme.locColor, fontWeight: 500 }}>
									{formatNumber(trend.locPerSec)}
								</span>
								<span
									css={trendCss}
									style={{
										color: trend.locPct >= 0 ? theme.success : "#f85149",
										background: trend.locPct >= 0 ? "rgba(63,185,80,0.1)" : "rgba(248,81,73,0.1)",
										marginLeft: 4,
									}}
								>
									{trend.locPct >= 0 ? "+" : ""}{Math.round(trend.locPct)}%
								</span>
							</span>
						</div>
						<div css={rowCss}>
							<span style={{ color: theme.textMuted }}>FLOPS util</span>
							<span>
								<span style={{ color: theme.flopsColor, fontWeight: 500 }}>
									{Math.round(trend.flopUtil)}%
								</span>
								<span
									css={trendCss}
									style={{
										color: trend.flopDelta >= 0 ? theme.success : "#f85149",
										background: trend.flopDelta >= 0 ? "rgba(63,185,80,0.1)" : "rgba(248,81,73,0.1)",
										marginLeft: 4,
									}}
								>
									{trend.flopDelta >= 0 ? "+" : ""}{Math.round(trend.flopDelta)}%
								</span>
							</span>
						</div>
					</div>
					<div style={{ borderTop: `1px solid ${theme.border}` }} />
				</>
			)}

			{/* Purchase Feed */}
			{recentPurchases.length > 0 && (
				<div css={sectionCss}>
					<div css={labelCss} style={{ color: theme.textMuted }}>
						{t("stats_panel.recent_purchases")}
					</div>
					<div style={{ maxHeight: 140, overflowY: "auto" }}>
						{recentPurchases.map((p, i) => {
							const ago = elapsed - p.time;
							// Try upgrade name, fall back to tech tree name
							const name = tUpgrades(`${p.id}.name`, { defaultValue: "" })
								|| tTech(`${p.id}.name`, { defaultValue: p.id });
							return (
								<div key={`${p.id}-${i}`} css={feedItemCss} style={{ borderColor: theme.border }}>
									<span style={{ color: theme.foreground }}>{name}</span>
									<span>
										<span style={{ color: theme.cashColor, fontSize: 10 }}>
											${formatNumber(p.cost, true)}
										</span>
										<span style={{ color: theme.textMuted, fontSize: 10, marginLeft: 6 }}>
											{formatAgo(ago)}
										</span>
									</span>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/components/stats-panel-timeline.tsx
git commit -m "✨ Add Timeline sub-tab: tier bar, rate trends, purchase feed"
```

---

### Task 5: Graphs sub-tab component

**Files:**
- Create: `apps/game/src/components/stats-panel-graphs.tsx`

- [ ] **Step 1: Create graphs component**

Create `apps/game/src/components/stats-panel-graphs.tsx`:

```typescript
import { css } from "@emotion/react";
import { useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { Sparkline } from "./sparkline";

const sectionCss = css({ padding: "8px 12px" });

const sparkRowCss = css({ padding: "6px 0" });

const sparkHeaderCss = css({
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	marginBottom: 4,
});

const sparkLabelCss = css({ fontSize: 11 });
const sparkValueCss = css({ fontSize: 11, fontWeight: 500 });

export function StatsPanelGraphs() {
	const { t } = useTranslation();
	const theme = useIdeTheme();
	const rateSnapshots = useGameStore((s) => s.rateSnapshots);
	const tierTransitions = useGameStore((s) => s.tierTransitions);
	const sessionStartTime = useGameStore((s) => s.sessionStartTime);

	const elapsed = (performance.now() - sessionStartTime) / 1000;

	const { cashData, locProdData, locExecData, flopUtilData, latest } = useMemo(() => {
		const snaps = rateSnapshots;
		return {
			cashData: snaps.map((s) => s.cashPerSec),
			locProdData: snaps.map((s) => s.locProducedPerSec),
			locExecData: snaps.map((s) => s.locExecutedPerSec),
			flopUtilData: snaps.map((s) => s.flopUtilization * 100),
			latest: snaps.length > 0 ? snaps[snaps.length - 1] : null,
		};
	}, [rateSnapshots]);

	if (!latest) {
		return (
			<div css={sectionCss}>
				<div style={{ color: theme.textMuted, fontSize: 12, padding: "20px 0", textAlign: "center" }}>
					{t("stats_panel.graphs_collecting")}
				</div>
			</div>
		);
	}

	return (
		<div css={sectionCss}>
			{/* Cash/s */}
			<div css={sparkRowCss}>
				<div css={sparkHeaderCss}>
					<span css={sparkLabelCss} style={{ color: theme.textMuted }}>
						{t("stats_panel.cash_per_sec")}
					</span>
					<span css={sparkValueCss} style={{ color: theme.cashColor }}>
						${formatNumber(latest.cashPerSec, true)}/s
					</span>
				</div>
				<Sparkline
					data={cashData}
					color={theme.cashColor ?? "#3fb950"}
					tierTransitions={tierTransitions}
					totalTime={elapsed}
				/>
			</div>

			<div style={{ borderTop: `1px solid ${theme.border}`, margin: "4px 0" }} />

			{/* LoC produced vs executed */}
			<div css={sparkRowCss}>
				<div css={sparkHeaderCss}>
					<span css={sparkLabelCss} style={{ color: theme.textMuted }}>
						LoC {t("stats_panel.produced_vs_executed")}
					</span>
					<span css={sparkValueCss} style={{ color: theme.locColor }}>
						{formatNumber(latest.locProducedPerSec)} / {formatNumber(latest.locExecutedPerSec)}
					</span>
				</div>
				<Sparkline
					data={locProdData}
					color={theme.locColor ?? "#58a6ff"}
					data2={locExecData}
					color2={theme.flopsColor ?? "#d2a8ff"}
					tierTransitions={tierTransitions}
					totalTime={elapsed}
				/>
			</div>

			<div style={{ borderTop: `1px solid ${theme.border}`, margin: "4px 0" }} />

			{/* FLOPS utilization */}
			<div css={sparkRowCss}>
				<div css={sparkHeaderCss}>
					<span css={sparkLabelCss} style={{ color: theme.textMuted }}>
						FLOPS {t("stats_panel.utilization")}
					</span>
					<span css={sparkValueCss} style={{ color: theme.flopsColor }}>
						{Math.round(latest.flopUtilization * 100)}%
					</span>
				</div>
				<Sparkline
					data={flopUtilData}
					color={theme.flopsColor ?? "#d2a8ff"}
					tierTransitions={tierTransitions}
					totalTime={elapsed}
				/>
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/components/stats-panel-graphs.tsx
git commit -m "✨ Add Graphs sub-tab: cash/s, LoC flow, FLOPS utilization sparklines"
```

---

### Task 6: Refactor StatsPanel with inner tabs

**Files:**
- Create: `apps/game/src/components/stats-panel-resources.tsx`
- Modify: `apps/game/src/components/stats-panel.tsx`

This is the integration task — extract the existing stats panel body into a Resources sub-tab, add an inner tab bar, and wire up Timeline and Graphs tabs.

- [ ] **Step 1: Create stats-panel-resources.tsx**

Extract the current body of StatsPanel (resources section + sources section + execute button) into a new component. This component receives the same props that the current body uses — read stats-panel.tsx lines 410-600 and move that JSX into the new file.

The new file should contain:
- All the store selectors currently in StatsPanel that the resources section needs
- The `useRatePerSec` hook (move it here or keep it in stats-panel.tsx and import)
- The resources section, sources section, and execute button

```typescript
// apps/game/src/components/stats-panel-resources.tsx
// Contains the original stats panel body: Resources, LoC Sources, AI Models, Execute button
// This is extracted verbatim from stats-panel.tsx lines 121-603 (the component body)
```

Since this is a large extraction, read the current `stats-panel.tsx` and move all the body content (everything from the resources section through execute button) into this new component. Keep the outer shell (panel div, header, collapse button) in stats-panel.tsx.

- [ ] **Step 2: Refactor stats-panel.tsx with inner tabs**

Replace the StatsPanel body with a tab bar and conditional rendering:

```typescript
import { useState } from "react";
import { StatsPanelResources } from "./stats-panel-resources";
import { StatsPanelTimeline } from "./stats-panel-timeline";
import { StatsPanelGraphs } from "./stats-panel-graphs";

// Inside StatsPanel:
const timelineUnlocked = useGameStore(
	(s) => (s.ownedTechNodes.unlock_session_timeline ?? 0) > 0,
);
const graphsUnlocked = useGameStore(
	(s) => (s.ownedTechNodes.unlock_perf_graphs ?? 0) > 0,
);

const [activeTab, setActiveTab] = useState<"resources" | "timeline" | "graphs">("resources");
```

Add a session elapsed clock in the header (next to the title):

```typescript
const sessionStartTime = useGameStore((s) => s.sessionStartTime);
const [elapsed, setElapsed] = useState(0);
useEffect(() => {
	const id = setInterval(() => {
		setElapsed((performance.now() - sessionStartTime) / 1000);
	}, 1000);
	return () => clearInterval(id);
}, [sessionStartTime]);

const elapsedStr = `${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, "0")}`;
```

Show the elapsed time as a small tag in the header:

```tsx
<span style={{ fontSize: 10, background: theme.hoverBg, padding: "1px 5px", borderRadius: 3 }}>
	{elapsedStr}
</span>
```

Add inner tab bar after the header (only if at least timeline is unlocked):

```tsx
{timelineUnlocked && (
	<div css={innerTabsCss}>
		<button
			type="button"
			css={innerTabCss}
			className={activeTab === "resources" ? "active" : ""}
			onClick={() => setActiveTab("resources")}
		>
			{t("stats_panel.tab_resources")}
		</button>
		<button
			type="button"
			css={innerTabCss}
			className={activeTab === "timeline" ? "active" : ""}
			onClick={() => setActiveTab("timeline")}
		>
			{t("stats_panel.tab_timeline")}
		</button>
		{graphsUnlocked && (
			<button
				type="button"
				css={innerTabCss}
				className={activeTab === "graphs" ? "active" : ""}
				onClick={() => setActiveTab("graphs")}
			>
				{t("stats_panel.tab_graphs")}
			</button>
		)}
	</div>
)}
```

Add tab bar styles:

```typescript
const innerTabsCss = css({
	display: "flex",
	flexShrink: 0,
});

const innerTabCss = css({
	flex: 1,
	padding: "6px 14px",
	fontSize: 11,
	cursor: "pointer",
	borderBottom: "2px solid transparent",
	background: "none",
	border: "none",
	borderTop: "none",
	fontFamily: "inherit",
	"&.active": {
		borderBottomColor: "#519aba",
	},
});
```

Replace the body with conditional rendering:

```tsx
{activeTab === "resources" && <StatsPanelResources />}
{activeTab === "timeline" && <StatsPanelTimeline />}
{activeTab === "graphs" && <StatsPanelGraphs />}
```

- [ ] **Step 3: Add i18n keys for tabs**

Add to all 8 `ui.json` locale files:

English (`en/ui.json`):
```json
"stats_panel.tab_resources": "Resources",
"stats_panel.tab_timeline": "Timeline",
"stats_panel.tab_graphs": "Graphs",
"stats_panel.tier_progression": "Tier Progression",
"stats_panel.rates_vs_30s": "Rates (vs 30s ago)",
"stats_panel.cash_per_sec": "Cash/s",
"stats_panel.recent_purchases": "Recent Purchases",
"stats_panel.graphs_collecting": "Collecting data...",
"stats_panel.produced_vs_executed": "produced vs executed",
"stats_panel.utilization": "utilization"
```

Add equivalent translations to all 7 other locale files.

- [ ] **Step 4: Add pulse keyframe**

Add to stats-panel.tsx or a global styles location:

```typescript
const pulseKeyframe = keyframes`
	0%, 100% { opacity: 1; }
	50% { opacity: 0.5; }
`;
```

Import `keyframes` from `@emotion/react` in stats-panel-timeline.tsx and apply to the current tier segment (or define it inline with a `@keyframes` CSS block).

- [ ] **Step 5: Verify typecheck + biome**

```bash
npm run typecheck && npm run check:fix
```

- [ ] **Step 6: Commit**

```bash
git add apps/game/src/components/ apps/game/src/i18n/
git commit -m "✨ Add inner tabs to Stats Panel: Resources, Timeline, Graphs"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run full checks**

```bash
npm run typecheck && npm run check && npm run sim
```

All must pass.

- [ ] **Step 2: Manual testing checklist**

Start dev server (`npm run dev`), play through:

| Check | Expected |
|-------|----------|
| Stats panel shows only Resources tab initially | No tabs visible until timeline unlocked |
| Buy `unlock_session_timeline` (50 cash) | Timeline tab appears, tier bar shows T0 |
| Tier transitions update the bar | New segments appear with correct colors |
| Rate trends show after ~10s | Cash/s, LoC/s, FLOPS util with trend arrows |
| Purchase feed populates | Latest purchases with relative timestamps |
| Buy `unlock_perf_graphs` (requires T2 + 3000 cash) | Graphs tab appears |
| Sparklines populate after ~15s | Three charts with tier markers |
| Session clock in header | Ticks every second |
| All text is translated when switching language | No hardcoded English |

- [ ] **Step 3: Commit any fixes**

```bash
git add -A && git commit -m "🐛 Fix session analytics issues found during QA"
```
