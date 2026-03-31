# Editor Streaming Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-block editor with a CSS-driven streaming visual at T2+ to eliminate blockQueue allocations and ~200 DOM mutations/sec during idle.

**Architecture:** Add `editorStreamingMode` flag to game store, triggered one-way when auto-production exceeds manual typing. A new `StreamingEditor` component renders ~40 static code lines scrolled via CSS `translateY` animation, with speed derived from `autoLocPerSec`. The game loop skips blockQueue management entirely when streaming is active.

**Tech Stack:** React 19, Emotion CSS-in-JS, Zustand, existing `code-tokens.ts` data

---

### Task 1: Add `editorStreamingMode` to Game Store

**Files:**
- Modify: `apps/game/src/modules/game/store/game-store.ts`

- [ ] **Step 1: Add `editorStreamingMode` to `GameState` interface**

In `apps/game/src/modules/game/store/game-store.ts`, add the field to the `GameState` interface after `_visualTick`:

```typescript
_visualTick: number;
editorStreamingMode: boolean;
```

- [ ] **Step 2: Add initial value**

In the `initialState` object, after `_visualTick: 0,`:

```typescript
_visualTick: 0,
editorStreamingMode: false,
```

- [ ] **Step 3: Add transition detection in `recalcDerivedStats`**

In `recalcDerivedStats()`, after the line `state.autoLocPerSec = totalAutoLoc * locProductionMultiplier * eventMods.autoLocMultiplier;` (around line 453), add:

```typescript
if (!state.editorStreamingMode && state.autoLocPerSec > locPerKey * 8) {
	state.editorStreamingMode = true;
}
```

Note: use the local `locPerKey` variable (already computed above), not `state.locPerKey` which hasn't been assigned yet at this point.

- [ ] **Step 4: Skip blockQueue in tick when streaming**

In the `tick()` function, replace the existing blockQueue section (the `// ── 3. Visual block queue` comment block) with:

```typescript
// ── 3. Visual block queue (capped, for editor only) ──
// Skip at T4+ (CLI prompt) and T2+ streaming mode
let blockQueue = s.blockQueue;
const visualTick = (s._visualTick ?? 0) + 1;
if (aiUnlocked || s.editorStreamingMode) {
	// T4+ or streaming: no block tracking needed
	if (blockQueue.length > 0) blockQueue = [];
} else {
	const visualProduced = Math.floor(humanOutput + aiProduced);
	if (visualProduced > 0 && visualTick % 5 === 0) {
		blockQueue =
			blockQueue.length >= 100
				? blockQueue.slice(-99)
				: [...blockQueue];
		blockQueue.push({ lines: [], loc: visualProduced * 5 });
	}
}
```

- [ ] **Step 5: Verify typecheck passes**

Run: `npm run typecheck`
Expected: Clean pass, no errors.

- [ ] **Step 6: Commit**

```
git add apps/game/src/modules/game/store/game-store.ts
git commit -m "✨ Add editorStreamingMode flag to game store with transition logic"
```

---

### Task 2: Create StreamingEditor Component

**Files:**
- Create: `apps/game/src/modules/editor/components/streaming-editor.tsx`

- [ ] **Step 1: Build the static line buffer**

Create `apps/game/src/modules/editor/components/streaming-editor.tsx`. This component renders ~40 pre-built code lines from `CODE_BLOCKS` and scrolls them via CSS animation.

```typescript
import { css, keyframes } from "@emotion/react";
import { useGameStore, useUiStore } from "@modules/game";
import { useMemo, useRef } from "react";
import { CODE_BLOCKS } from "../data/code-tokens";
import { EDITOR_THEMES } from "../data/editor-themes";

const LINE_HEIGHT = 21;
const VISIBLE_LINES = 40;

// Build a static HTML line buffer from CODE_BLOCKS (done once at module load)
function buildStaticLines(): string[] {
	const lines: string[] = [];
	for (const block of CODE_BLOCKS) {
		for (const line of block.lines) {
			lines.push(line);
		}
		lines.push(""); // blank between blocks
	}
	// Repeat to fill at least VISIBLE_LINES * 2 (for seamless loop)
	while (lines.length < VISIBLE_LINES * 2) {
		for (const block of CODE_BLOCKS) {
			for (const line of block.lines) {
				lines.push(line);
			}
			lines.push("");
		}
	}
	return lines;
}

const STATIC_LINES = buildStaticLines();
const HALF = Math.floor(STATIC_LINES.length / 2);

// ── Styles ──

const wrapperCss = css({
	flex: 1,
	position: "relative",
	overflow: "hidden",
	fontSize: 13,
	lineHeight: 1.6,
	contain: "strict",
});

const maskCss = css({
	position: "absolute",
	inset: 0,
	pointerEvents: "none",
	zIndex: 1,
	maskImage:
		"linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)",
	WebkitMaskImage:
		"linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)",
});

const linesCss = css({
	position: "absolute",
	left: 0,
	right: 0,
	willChange: "transform",
});

const lineCss = css({
	display: "flex",
	gap: 16,
	height: LINE_HEIGHT,
	padding: "0 16px",
	whiteSpace: "pre",
});

const lineNumCss = css({
	minWidth: 40,
	textAlign: "right",
	userSelect: "none",
	fontVariantNumeric: "tabular-nums",
});

const fillBarCss = css({
	position: "absolute",
	right: 2,
	top: 0,
	bottom: 0,
	width: 3,
	borderRadius: 2,
	transformOrigin: "bottom",
	transition: "transform 0.5s ease, opacity 0.5s ease",
	zIndex: 2,
});

export function StreamingEditor() {
	const autoLocPerSec = useGameStore((s) => s.autoLocPerSec);
	const loc = useGameStore((s) => s.loc);
	const flops = useGameStore((s) => s.flops);
	const editorTheme = useUiStore((s) => s.editorTheme);
	const theme = EDITOR_THEMES[editorTheme];

	// Scroll speed: map autoLocPerSec to animation duration
	// Higher production = faster scroll. Clamp between 4s (very fast) and 60s (slow).
	const scrollDuration = useMemo(() => {
		if (autoLocPerSec <= 0) return 0;
		const speed = Math.max(4, Math.min(60, 2000 / autoLocPerSec));
		return speed;
	}, [autoLocPerSec]);

	// Fill indicator: loc as fraction of a visual "buffer" (flops × 10 as max)
	const maxBuffer = Math.max(1, flops * 10);
	const fillRatio = Math.min(1, loc / maxBuffer);

	const scrollAnim = useMemo(
		() =>
			scrollDuration > 0
				? keyframes({
						"0%": { transform: "translateY(0)" },
						"100%": {
							transform: `translateY(-${HALF * LINE_HEIGHT}px)`,
						},
					})
				: null,
		[scrollDuration],
	);

	const themedWrapperCss = useMemo(
		() =>
			css(wrapperCss, {
				background: theme.background,
				color: theme.foreground,
				fontFamily:
					"'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
				".kw": { color: theme.keyword },
				".fn": { color: theme.function },
				".str": { color: theme.string },
				".cm": { color: theme.comment, fontStyle: "italic" },
				".num": { color: theme.number },
				".op": { color: theme.operator },
				".type": { color: theme.type },
				".var": { color: theme.variable },
			}),
		[theme],
	);

	const animatedLinesCss = useMemo(
		() =>
			css(linesCss, {
				animation:
					scrollAnim && scrollDuration > 0
						? `${scrollAnim} ${scrollDuration}s linear infinite`
						: "none",
			}),
		[scrollAnim, scrollDuration],
	);

	return (
		<div css={themedWrapperCss}>
			<div css={maskCss}>
				<div css={animatedLinesCss}>
					{STATIC_LINES.map((line, i) => (
						<div css={lineCss} key={i}>
							<span
								css={lineNumCss}
								style={{ color: theme.lineNumbers }}
							>
								{(i % HALF) + 1}
							</span>
							<span dangerouslySetInnerHTML={{ __html: line || "&nbsp;" }} />
						</div>
					))}
				</div>
			</div>
			{/* Fill indicator bar */}
			<div
				css={fillBarCss}
				style={{
					background: theme.accent,
					opacity: fillRatio > 0.01 ? 0.4 : 0,
					transform: `scaleY(${fillRatio})`,
				}}
			/>
		</div>
	);
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: Clean pass (component not imported anywhere yet, but should have no internal type errors).

- [ ] **Step 3: Commit**

```
git add apps/game/src/modules/editor/components/streaming-editor.tsx
git commit -m "✨ Add StreamingEditor component with CSS-driven scroll animation"
```

---

### Task 3: Export and Wire Up StreamingEditor

**Files:**
- Modify: `apps/game/src/modules/editor/index.ts`
- Modify: `apps/game/src/components/editor-panel.tsx`

- [ ] **Step 1: Export from editor module**

In `apps/game/src/modules/editor/index.ts`, add the export:

```typescript
export { StreamingEditor } from "./components/streaming-editor";
```

- [ ] **Step 2: Route to StreamingEditor in EditorPanel**

Replace the full content of `apps/game/src/components/editor-panel.tsx`:

```typescript
import { css } from "@emotion/react";
import { Editor, StreamingEditor } from "@modules/editor";
import { useGameStore } from "@modules/game";
import { useIdeTheme } from "../hooks/use-ide-theme";
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

	if (aiUnlocked) {
		// T4+: CLI prompt takes over entirely
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
				</div>
			</div>
		);
	}

	// T0-early T2: Full block-based editor
	return (
		<div css={wrapperCss} data-tutorial="editor">
			<div css={editorAreaCss} style={{ flex: 1 }}>
				<Editor />
			</div>
		</div>
	);
}
```

- [ ] **Step 3: Verify typecheck and lint**

Run: `npm run typecheck && npm run check`
Expected: Clean typecheck. Lint may show pre-existing issues in other files — verify no new errors in the changed files.

- [ ] **Step 4: Manual test in browser**

1. Start dev server: `npm run dev`
2. Open `http://localhost:3000`
3. Play until you have enough freelancers that `autoLocPerSec > locPerKey * 8` (typically 2-3 freelancers)
4. Verify: editor switches from block-typing mode to scrolling CSS animation
5. Verify: scroll speed increases as you buy more producers
6. Verify: fill indicator bar appears on right edge when LoC queues up
7. Verify: no console errors

- [ ] **Step 5: Commit**

```
git add apps/game/src/modules/editor/index.ts apps/game/src/components/editor-panel.tsx
git commit -m "✨ Wire StreamingEditor into EditorPanel with mode routing"
```

---

### Task 4: Verify Performance Improvement

**Files:** None (testing only)

- [ ] **Step 1: Run balance simulation**

Run: `npm run sim`
Expected: All 3 profiles pass. The `editorStreamingMode` change in recalc shouldn't affect game balance since it's display-only.

- [ ] **Step 2: Profile in browser**

1. Open `http://localhost:3000`
2. Play to T2+ with freelancers (or use god mode to skip ahead)
3. Confirm streaming mode is active (CSS scrolling editor, no per-block typing)
4. Use the in-game PERF profiler: click Start, idle for 15 seconds, click Stop
5. Compare memory growth and DOM mutation counts against previous baselines
6. Expected improvements:
   - Memory growth should be significantly lower during idle
   - Long tasks should be reduced (fewer DOM mutations triggering layout)

- [ ] **Step 3: Final commit with any fixes**

If any issues were found in testing, fix and commit:

```
git add -u
git commit -m "🐛 Fix streaming editor issues from testing"
```
