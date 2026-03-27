import { css, keyframes } from "@emotion/react";
import { allEvents, useEventStore } from "@modules/event";
import { useGameStore, useUiStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import {
	memo,
	useCallback,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { EDITOR_THEMES } from "../data/editor-themes";
import { useAutoType } from "../hooks/use-auto-type";
import { useCodeTyping } from "../hooks/use-code-typing";
import { useEditorFocus } from "../hooks/use-editor-focus";
import { useKeyboardInput } from "../hooks/use-keyboard-input";

const LINE_HEIGHT = 21; // 13px font * 1.6 line-height ≈ 21px
const OVERSCAN = 5; // Extra lines rendered above/below viewport

const blink = keyframes({
	"50%": { opacity: 0 },
});

const statusBarStyle = css({
	background: "#141920",
	padding: "4px 16px",
	fontSize: 11,
	color: "#6272a4",
	display: "flex",
	justifyContent: "flex-end",
	gap: 16,
	borderTop: "1px solid #1e2630",
});

// Static layout styles (no colors — those come from the theme)
const editorLayoutCss = css({
	flex: 1,
	overflowY: "scroll",
	fontSize: 13,
	lineHeight: 1.6,
	cursor: "text",
	position: "relative",
	"&:focus": { outline: "none" },
	"&::-webkit-scrollbar": { width: 6 },
	"&::-webkit-scrollbar-track": { background: "transparent" },
});

const lineStyle = css({
	display: "flex",
	gap: 16,
	height: LINE_HEIGHT,
	padding: "0 16px",
});

const lineNumberLayoutCss = css({
	minWidth: 40,
	textAlign: "right",
	userSelect: "none",
	flexShrink: 0,
});

const lineContentStyle = css({
	whiteSpace: "pre",
});

const cursorLayoutCss = css({
	display: "inline-block",
	width: 8,
	height: 15,
	verticalAlign: "text-bottom",
});

const hintCss = css({
	position: "absolute",
	top: 0,
	left: 0,
	right: 0,
	padding: "0 16px",
	height: LINE_HEIGHT,
	display: "flex",
	gap: 16,
	pointerEvents: "none",
	opacity: 0.5,
	fontStyle: "italic",
});

// ── Memoized line component ──
const EditorLine = memo(function EditorLine({
	lineNumber,
	html,
	lineNumberColor,
}: {
	lineNumber: number;
	html: string;
	lineNumberColor: string;
}) {
	return (
		<div css={lineStyle}>
			<span css={lineNumberLayoutCss} style={{ color: lineNumberColor }}>
				{lineNumber}
			</span>
			<span css={lineContentStyle} dangerouslySetInnerHTML={{ __html: html }} />
		</div>
	);
});

// ── Build flat line list from blockQueue + typing state ──
interface FlatLine {
	key: string;
	lineNumber: number;
	html: string;
}

// Only render the last N blocks to avoid unbounded growth
const MAX_DISPLAY_BLOCKS = 8;

// Global counter for stable keys — never resets, so React never confuses lines
let globalLineKey = 0;

function buildLineList(
	blockQueue: Array<{ lines: string[] }>,
	typingLines: string[],
): FlatLine[] {
	const result: FlatLine[] = [];

	// Always show blocks (no phantom hide/show that causes flicker)
	const blocksToShow = blockQueue.slice(-MAX_DISPLAY_BLOCKS);

	// Estimate line number from total blocks
	let lineNumber = 1;
	const startBlock = Math.max(0, blockQueue.length - MAX_DISPLAY_BLOCKS);
	for (let bIdx = 0; bIdx < startBlock; bIdx++) {
		lineNumber += blockQueue[bIdx].lines.length + 1; // +1 for gap
	}

	for (let bIdx = 0; bIdx < blocksToShow.length; bIdx++) {
		const block = blocksToShow[bIdx];
		for (let lIdx = 0; lIdx < block.lines.length; lIdx++) {
			result.push({
				key: `L${globalLineKey++}`,
				lineNumber,
				html: block.lines[lIdx],
			});
			lineNumber++;
		}
		// Empty line between blocks for readability
		if (bIdx < blocksToShow.length - 1) {
			result.push({
				key: `L${globalLineKey++}`,
				lineNumber,
				html: "",
			});
			lineNumber++;
		}
	}

	for (let i = 0; i < typingLines.length; i++) {
		result.push({
			key: `t-${i}`,
			lineNumber,
			html: typingLines[i],
		});
		lineNumber++;
	}

	return result;
}

export function Editor() {
	const totalLoc = useGameStore((s) => s.totalLoc);
	const locPerKey = useGameStore((s) => s.locPerKey);
	const blockQueue = useGameStore((s) => s.blockQueue);
	const editorTheme = useUiStore((s) => s.editorTheme);
	const editorRef = useRef<HTMLDivElement>(null);

	const { typing, advanceTokens } = useCodeTyping();

	const running = useGameStore((s) => s.running);

	const onKeystroke = useCallback(() => {
		advanceTokens(locPerKey);

		// Check for mash-key event interaction (only while game is running)
		if (running) {
			const eventStore = useEventStore.getState();
			const interactive = eventStore.getActiveInteractiveEvent();
			if (interactive) {
				const definition = allEvents.find(
					(e) => e.id === interactive.definitionId,
				);
				if (definition?.interaction?.type === "mash_keys") {
					eventStore.handleMashKey(interactive.definitionId);
				}
			}
		}
	}, [advanceTokens, locPerKey, running]);

	useKeyboardInput(editorRef, onKeystroke);
	useEditorFocus(editorRef);
	useAutoType(advanceTokens);

	// ── Theme-derived styles ──
	const theme = EDITOR_THEMES[editorTheme];

	const themedEditorCss = useMemo(
		() =>
			css(editorLayoutCss, {
				background: theme.background,
				color: theme.foreground,
				".kw": { color: theme.keyword },
				".fn": { color: theme.function },
				".str": { color: theme.string },
				".cm": { color: theme.comment, fontStyle: "italic" },
				".num": { color: theme.number },
				".op": { color: theme.operator },
				".type": { color: theme.type },
				".var": { color: theme.variable },
				"&::-webkit-scrollbar-thumb": {
					background: theme.scrollThumb,
					borderRadius: 3,
				},
				"&::-webkit-scrollbar-thumb:hover": {
					background: theme.scrollThumb,
					filter: "brightness(1.3)",
				},
			}),
		[theme],
	);

	const themedCursorCss = useMemo(
		() =>
			css(cursorLayoutCss, {
				background: theme.cursor,
				animation: `${blink} 1s step-end infinite`,
			}),
		[theme],
	);

	// ── Build flat line list ──
	// Throttle rebuilds: only recompute when block count changes or typing changes
	const blockCount = blockQueue.length;
	const prevBlockCount = useRef(blockCount);
	const cachedLines = useRef<FlatLine[]>([]);

	const flatLines = useMemo(() => {
		const lines = buildLineList(blockQueue, typing.lines);
		cachedLines.current = lines;
		prevBlockCount.current = blockCount;
		return lines;
	}, [blockQueue, typing.lines, blockCount]);

	const totalLines = flatLines.length + 1;

	// ── Virtualization state ──
	const [scrollTop, setScrollTop] = useState(0);
	const [viewportHeight, setViewportHeight] = useState(600);

	const onScroll = useCallback(() => {
		const el = editorRef.current;
		if (el) setScrollTop(el.scrollTop);
	}, []);

	useLayoutEffect(() => {
		const el = editorRef.current;
		if (!el) return;
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setViewportHeight(entry.contentRect.height);
			}
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	// Auto-scroll to bottom — only when new blocks are added (not consumed)
	const prevQueueLen = useRef(blockQueue.length);
	if (blockQueue.length > prevQueueLen.current) {
		queueMicrotask(() => {
			const el = editorRef.current;
			if (el) el.scrollTop = el.scrollHeight;
		});
	}
	prevQueueLen.current = blockQueue.length;

	// ── Compute visible window ──
	// Use a high-water mark so the scrollbar doesn't shrink on every consumed block
	const rawContentHeight = totalLines * LINE_HEIGHT;
	const highWaterRef = useRef(rawContentHeight);
	if (rawContentHeight > highWaterRef.current) {
		highWaterRef.current = rawContentHeight;
	} else if (rawContentHeight < highWaterRef.current * 0.5) {
		// Reset when content drops significantly (e.g. after big execution burst)
		highWaterRef.current = rawContentHeight;
	}
	const contentHeight = Math.max(rawContentHeight, highWaterRef.current);
	const startIdx = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - OVERSCAN);
	const visibleCount = Math.ceil(viewportHeight / LINE_HEIGHT) + OVERSCAN * 2;
	const endIdx = Math.min(totalLines, startIdx + visibleCount);

	const currentLineIdx = flatLines.length;
	const currentLineNumber =
		flatLines.length > 0 ? flatLines[flatLines.length - 1].lineNumber + 1 : 1;

	return (
		<>
			<div
				css={themedEditorCss}
				ref={editorRef}
				tabIndex={0}
				onScroll={onScroll}
			>
				<div style={{ height: contentHeight, position: "relative" }}>
					{flatLines.length === 0 && (
						<div css={hintCss} style={{ color: theme.comment }}>
							<span
								css={lineNumberLayoutCss}
								style={{ color: theme.lineNumbers }}
							>
								1
							</span>
							<span css={lineContentStyle}>
								{"// start typing to write code..."}
							</span>
						</div>
					)}
					<div
						style={{
							position: "absolute",
							top: startIdx * LINE_HEIGHT,
							left: 0,
							right: 0,
						}}
					>
						{Array.from({ length: endIdx - startIdx }, (_, i) => {
							const idx = startIdx + i;

							if (idx === currentLineIdx) {
								return (
									<div css={lineStyle} key="active">
										<span
											css={lineNumberLayoutCss}
											style={{ color: theme.lineNumbers }}
										>
											{currentLineNumber}
										</span>
										<span css={lineContentStyle}>
											<span
												dangerouslySetInnerHTML={{
													__html: typing.currentLine,
												}}
											/>
											<span css={themedCursorCss} />
										</span>
									</div>
								);
							}

							if (idx < flatLines.length) {
								const line = flatLines[idx];
								return (
									<EditorLine
										key={line.key}
										lineNumber={line.lineNumber}
										html={line.html}
										lineNumberColor={theme.lineNumbers}
									/>
								);
							}

							return null;
						})}
					</div>
				</div>
			</div>
			<div css={statusBarStyle}>
				<span>{formatNumber(totalLoc)} lines</span>
				<span>{locPerKey} LoC/key</span>
			</div>
		</>
	);
}
