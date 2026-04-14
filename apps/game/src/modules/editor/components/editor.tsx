import { css, keyframes } from "@emotion/react";
import { sfx } from "@modules/audio";
import { allEvents, useEventStore } from "@modules/event";
import { useGameStore, useUiStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import type { MutableRefObject } from "react";
import {
	memo,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { CODE_BLOCKS } from "../data/code-tokens";
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

// Pre-generate a flat pool of code lines from all code blocks.
// The editor picks lines from this pool based on the loc counter.
const ALL_CODE_LINES: string[] = [];
for (const block of CODE_BLOCKS) {
	for (const line of block.lines) {
		ALL_CODE_LINES.push(line);
	}
	ALL_CODE_LINES.push(""); // blank line between blocks
}

interface EditorProps {
	keystrokeCallbackRef?: MutableRefObject<(() => void) | null>;
}

export function Editor({ keystrokeCallbackRef }: EditorProps) {
	const totalLoc = useGameStore((s) => s.totalLoc);
	const loc = useGameStore((s) => s.loc);
	const locPerKey = useGameStore((s) => s.locPerKey);
	const editorTheme = useUiStore((s) => s.editorTheme);
	const editorRef = useRef<HTMLDivElement>(null);

	const { advanceTokens } = useCodeTyping();

	const running = useGameStore((s) => s.running);

	const addLoc = useGameStore((s) => s.addLoc);

	const onKeystroke = useCallback(() => {
		sfx.typing();
		addLoc(locPerKey);
		advanceTokens(1); // purely visual: advance 1 token

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
	}, [addLoc, advanceTokens, locPerKey, running]);

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

	// Editor is a pure display of the loc counter. O(1) — no array allocation.
	// 1 LoC = 1 line. Partial line for the fractional part.
	// Cap displayed lines to avoid hitting browser scrollHeight limits (~33M px).
	const MAX_DISPLAY_LINES = 5000;
	const fullLines = Math.max(0, Math.floor(loc));
	const fraction = loc > 0 ? loc - fullLines : 0;
	const rawLineCount = fullLines + (fraction > 0 ? 1 : 0);
	const lineCount = Math.min(rawLineCount, MAX_DISPLAY_LINES);
	const lineOffset = Math.max(0, rawLineCount - MAX_DISPLAY_LINES);
	const totalLines = lineCount + 1; // +1 for cursor line

	// Compute partial line HTML (only for the fractional last line)
	const partialHtml = useMemo(() => {
		if (fraction <= 0) return "";
		const nextLine = ALL_CODE_LINES[fullLines % ALL_CODE_LINES.length];
		const rawText = nextLine.replace(/<[^>]*>/g, "");
		const charsToShow = Math.max(1, Math.ceil(rawText.length * fraction));
		let shown = 0;
		let htmlIdx = 0;
		let partial = "";
		while (shown < charsToShow && htmlIdx < nextLine.length) {
			if (nextLine[htmlIdx] === "<") {
				const tagEnd = nextLine.indexOf(">", htmlIdx);
				partial += nextLine.slice(htmlIdx, tagEnd + 1);
				htmlIdx = tagEnd + 1;
			} else {
				partial += nextLine[htmlIdx];
				htmlIdx++;
				shown++;
			}
		}
		const openSpans = (partial.match(/<span[^>]*>/g) ?? []).length;
		const closeSpans = (partial.match(/<\/span>/g) ?? []).length;
		for (let s = 0; s < openSpans - closeSpans; s++) {
			partial += "</span>";
		}
		return partial;
	}, [fullLines, fraction]);

	/** Look up a line by display index — O(1), offset into the pool */
	const getLine = useCallback(
		(displayIdx: number): { html: string; lineNumber: number } => {
			const realIdx = displayIdx + lineOffset;
			if (realIdx === fullLines && fraction > 0) {
				return { html: partialHtml, lineNumber: realIdx + 1 };
			}
			return {
				html: ALL_CODE_LINES[realIdx % ALL_CODE_LINES.length],
				lineNumber: realIdx + 1,
			};
		},
		[fullLines, fraction, partialHtml, lineOffset],
	);

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

	// Auto-scroll: to bottom when lines grow, clamp when lines shrink
	const prevLineCount = useRef(lineCount);
	const prev = prevLineCount.current;
	if (lineCount !== prev) {
		const grew = lineCount > prev;
		prevLineCount.current = lineCount;
		queueMicrotask(() => {
			const el = editorRef.current;
			if (!el) return;
			if (grew) {
				el.scrollTop = el.scrollHeight;
			} else {
				const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
				if (el.scrollTop > maxScroll) {
					el.scrollTop = maxScroll;
				}
			}
		});
	}

	// ── Compute visible window ──
	const contentHeight = totalLines * LINE_HEIGHT;
	const startIdx = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - OVERSCAN);
	const visibleCount = Math.ceil(viewportHeight / LINE_HEIGHT) + OVERSCAN * 2;
	const endIdx = Math.min(totalLines, startIdx + visibleCount);

	const currentLineIdx = lineCount; // cursor is after last displayed line
	const currentLineNumber = lineOffset + lineCount + 1;

	return (
		<>
			<div
				css={themedEditorCss}
				ref={editorRef}
				tabIndex={0}
				onScroll={onScroll}
			>
				<div style={{ height: contentHeight, position: "relative" }}>
					{lineCount === 0 && (
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
											<span css={themedCursorCss} />
										</span>
									</div>
								);
							}

							if (idx < lineCount) {
								const line = getLine(idx);
								return (
									<EditorLine
										key={`L${idx}`}
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
				<span>{Math.round(locPerKey * 10) / 10} LoC/key</span>
			</div>
		</>
	);
}
