import { css, keyframes } from "@emotion/react";
import { allEvents, useEventStore } from "@modules/event";
import { useGameStore, useUiStore } from "@modules/game";
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
	overflowY: "auto",
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

const blockSepLayoutCss = css({
	height: LINE_HEIGHT,
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
	isSeparator?: boolean;
}

// Only render the last N blocks to avoid unbounded growth
const MAX_DISPLAY_BLOCKS = 50;

function buildLineList(
	blockQueue: Array<{ lines: string[] }>,
	typingLines: string[],
): FlatLine[] {
	const result: FlatLine[] = [];

	// Skip old blocks that would never be visible anyway
	const startBlock = Math.max(0, blockQueue.length - MAX_DISPLAY_BLOCKS);

	// Count lines from skipped blocks to keep line numbers correct
	let lineNumber = 1;
	for (let bIdx = 0; bIdx < startBlock; bIdx++) {
		lineNumber += blockQueue[bIdx].lines.length;
	}

	for (let bIdx = startBlock; bIdx < blockQueue.length; bIdx++) {
		const block = blockQueue[bIdx];
		for (let lIdx = 0; lIdx < block.lines.length; lIdx++) {
			result.push({
				key: `b${bIdx}-${lIdx}`,
				lineNumber,
				html: block.lines[lIdx],
			});
			lineNumber++;
		}
		result.push({
			key: `sep-${bIdx}`,
			lineNumber: -1,
			html: "",
			isSeparator: true,
		});
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

	const themedBlockSepCss = useMemo(
		() =>
			css(blockSepLayoutCss, {
				borderBottom: `1px solid ${theme.lineNumbers}33`,
			}),
		[theme],
	);

	// ── Build flat line list ──
	const flatLines = useMemo(
		() => buildLineList(blockQueue, typing.lines),
		[blockQueue, typing.lines],
	);
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

	// Auto-scroll to bottom when new blocks arrive
	const prevQueueLenRef = useRef(blockQueue.length);
	if (blockQueue.length !== prevQueueLenRef.current) {
		prevQueueLenRef.current = blockQueue.length;
		queueMicrotask(() => {
			const el = editorRef.current;
			if (el) el.scrollTop = el.scrollHeight;
		});
	}

	// ── Compute visible window ──
	const totalHeight = totalLines * LINE_HEIGHT;
	const startIdx = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - OVERSCAN);
	const visibleCount = Math.ceil(viewportHeight / LINE_HEIGHT) + OVERSCAN * 2;
	const endIdx = Math.min(totalLines, startIdx + visibleCount);

	const currentLineIdx = flatLines.length;
	const currentLineNumber =
		flatLines.length > 0
			? flatLines[flatLines.length - 1].isSeparator
				? flatLines.length > 1
					? flatLines[flatLines.length - 2].lineNumber + 1
					: 1
				: flatLines[flatLines.length - 1].lineNumber + 1
			: 1;

	return (
		<>
			<div
				css={themedEditorCss}
				ref={editorRef}
				tabIndex={0}
				onScroll={onScroll}
			>
				<div style={{ height: totalHeight, position: "relative" }}>
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
								if (line.isSeparator) {
									return <div css={themedBlockSepCss} key={line.key} />;
								}
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
				<span>{Math.floor(totalLoc)} lines</span>
				<span>{locPerKey} LoC/key</span>
			</div>
		</>
	);
}
