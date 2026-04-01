import { css, keyframes } from "@emotion/react";
import { sfx } from "@modules/audio";
import { useGameStore, useUiStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { CODE_BLOCKS } from "../data/code-tokens";
import { EDITOR_THEMES } from "../data/editor-themes";
import { useEditorFocus } from "../hooks/use-editor-focus";
import { useKeyboardInput } from "../hooks/use-keyboard-input";

const LINE_HEIGHT = 21;
const VISIBLE_LINES = 40;

// Build static HTML once at module load — never changes
function buildStaticLines(): string[] {
	const lines: string[] = [];
	for (const block of CODE_BLOCKS) {
		for (const line of block.lines) {
			lines.push(line);
		}
		lines.push("");
	}
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
const BASE_DURATION = 10;

// ── Styles ──

const wrapperCss = css({
	flex: 1,
	position: "relative",
	overflow: "hidden",
	fontSize: 13,
	lineHeight: 1.6,
	contain: "strict",
	cursor: "text",
	"&:focus": { outline: "none" },
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

const scrollUp = keyframes({
	"0%": { transform: "translateY(0)" },
	"100%": { transform: `translateY(-${HALF * LINE_HEIGHT}px)` },
});

const linesCss = css({
	position: "absolute",
	left: 0,
	right: 0,
	willChange: "transform",
	animationName: scrollUp,
	animationTimingFunction: "linear",
	animationIterationCount: "infinite",
	animationDuration: `${BASE_DURATION}s`,
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

const statusBarCss = css({
	background: "#141920",
	padding: "4px 16px",
	fontSize: 11,
	color: "#6272a4",
	display: "flex",
	justifyContent: "flex-end",
	gap: 16,
	borderTop: "1px solid #1e2630",
	flexShrink: 0,
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

// ── Static lines: rendered once, never re-rendered ──

interface StaticLinesProps {
	lineNumberColor: string;
}

const StaticLines = memo(function StaticLines({
	lineNumberColor,
}: StaticLinesProps) {
	return (
		<>
			{STATIC_LINES.map((line, i) => (
				<div css={lineCss} key={i}>
					<span css={lineNumCss} style={{ color: lineNumberColor }} data-ln={i}>
						{(i % HALF) + 1}
					</span>
					<span dangerouslySetInnerHTML={{ __html: line || "&nbsp;" }} />
				</div>
			))}
		</>
	);
});

// ── Main component ──

export function StreamingEditor() {
	const locPerKey = useGameStore((s) => s.locPerKey);
	const addLoc = useGameStore((s) => s.addLoc);
	const running = useGameStore((s) => s.running);
	const editorTheme = useUiStore((s) => s.editorTheme);
	const theme = EDITOR_THEMES[editorTheme];
	const editorRef = useRef<HTMLDivElement>(null);
	const linesRef = useRef<HTMLDivElement>(null);
	const fillBarRef = useRef<HTMLDivElement>(null);
	const totalLocRef = useRef<HTMLSpanElement>(null);
	const locPerKeyRef = useRef<HTMLSpanElement>(null);

	// ── Keyboard input (produces LoC) ──
	const keystrokeTimestamps = useRef<number[]>([]);

	const onKeystroke = useCallback(() => {
		if (!running) return;
		sfx.typing();
		addLoc(locPerKey);
		keystrokeTimestamps.current.push(performance.now());
	}, [addLoc, locPerKey, running]);

	useKeyboardInput(editorRef, onKeystroke);
	useEditorFocus(editorRef);

	// ── Animation speed + fill bar + line numbers: updated via store subscription + refs (no re-renders) ──
	const virtualLineRef = useRef(1);
	const prevLocRef = useRef(0);
	const lineSpansRef = useRef<NodeListOf<HTMLElement> | null>(null);

	useEffect(() => {
		const unsub = useGameStore.subscribe((state) => {
			const el = linesRef.current;
			const bar = fillBarRef.current;

			// Compute typing rate from timestamps
			const now = performance.now();
			const cutoff = now - 2000;
			const ts = keystrokeTimestamps.current;
			while (ts.length > 0 && ts[0] < cutoff) ts.shift();
			const typingLocPerSec = (ts.length / 2) * state.locPerKey;

			const totalLocPerSec = state.autoLocPerSec + typingLocPerSec;

			// Update animation speed via Web Animations API
			if (el) {
				const anim = el.getAnimations()[0];
				if (anim) {
					if (totalLocPerSec <= 0) {
						anim.playbackRate = 0;
					} else {
						// Scale: 10→6x, 100→14x, 500→20x, 1000→23x, 10000→39x
						const v = Math.max(1, totalLocPerSec);
						const rate = Math.max(1, Math.log10(v) * 6 + Math.sqrt(v) * 0.15);
						anim.playbackRate = rate;
					}
				}

				// ── Dynamic line numbers ──
				// Virtual line tracks loc buffer: goes up with production, down with execution
				if (state.loc <= 0) {
					virtualLineRef.current = 1;
				} else {
					const delta = state.loc - prevLocRef.current;
					virtualLineRef.current = Math.max(
						1,
						virtualLineRef.current + delta * 0.1,
					);
				}
				prevLocRef.current = state.loc;

				// Cache line spans on first use
				if (!lineSpansRef.current) {
					lineSpansRef.current = el.querySelectorAll("[data-ln]");
				}
				const spans = lineSpansRef.current;
				if (spans.length > 0) {
					// Get current scroll offset from animation to determine visible range
					const anim2 = el.getAnimations()[0];
					let scrollLine = 0;
					if (anim2) {
						const t =
							((anim2.currentTime as number) ?? 0) /
							((anim2.effect?.getComputedTiming().duration as number) ??
								BASE_DURATION * 1000);
						const frac = t % 1;
						scrollLine = Math.floor(frac * HALF);
					}
					const base = Math.max(
						1,
						Math.floor(virtualLineRef.current) - VISIBLE_LINES,
					);
					for (let i = 0; i < spans.length; i++) {
						const visibleIdx = (((i - scrollLine) % HALF) + HALF) % HALF;
						spans[i].textContent = String(base + visibleIdx);
					}
				}
			}

			// Update fill bar via direct DOM manipulation
			if (bar) {
				const maxBuffer = Math.max(1, state.flops * 10);
				const fillRatio = Math.min(1, state.loc / maxBuffer);
				bar.style.opacity = fillRatio > 0.01 ? "0.4" : "0";
				bar.style.transform = `scaleY(${fillRatio})`;
			}

			// Update status bar
			if (totalLocRef.current) {
				totalLocRef.current.textContent = `${formatNumber(state.totalLoc)} lines`;
			}
			if (locPerKeyRef.current) {
				locPerKeyRef.current.textContent = `${state.locPerKey} LoC/key`;
			}
		});
		return unsub;
	}, []);

	const themedWrapperCss = useMemo(
		() =>
			css(wrapperCss, {
				background: theme.background,
				color: theme.foreground,
				fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
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

	return (
		<>
			<div ref={editorRef} css={themedWrapperCss} tabIndex={0}>
				<div css={maskCss}>
					<div ref={linesRef} css={linesCss}>
						<StaticLines lineNumberColor={theme.lineNumbers} />
					</div>
				</div>
				<div
					ref={fillBarRef}
					css={fillBarCss}
					style={{ background: theme.accent }}
				/>
			</div>
			<div css={statusBarCss}>
				<span ref={totalLocRef} />
				<span ref={locPerKeyRef} />
			</div>
		</>
	);
}
