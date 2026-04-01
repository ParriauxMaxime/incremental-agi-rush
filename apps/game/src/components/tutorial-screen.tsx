import { css } from "@emotion/react";
import { useGameStore, useUiStore } from "@modules/game";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";
import i18n from "../i18n";
import { useAudioStore } from "../modules/audio";
import {
	playEvent,
	playPurchase,
	playTerminalKey,
} from "../modules/audio/sfx-engine";
import {
	type ShellLine,
	ShellLineTypeEnum,
	shellEngine,
} from "../modules/terminal";

// ── Trigger conditions ──

type GameState = ReturnType<typeof useGameStore.getState>;

const triggers: Array<{ id: string; test: (s: GameState) => boolean }> = [
	{ id: "welcome", test: () => true },
	{ id: "tech_tree_intro", test: (s) => s.totalLoc >= 15 },
	{
		id: "sidebar_intro",
		test: (s) => (s.ownedTechNodes.unlock_sidebar ?? 0) > 0,
	},
	{
		id: "execution_intro",
		test: (s) => (s.ownedTechNodes.unlock_stats_panel ?? 0) > 0,
	},
	{
		id: "first_purchase",
		test: (s) => Object.values(s.ownedUpgrades).some((v) => v > 0),
	},
	{
		id: "first_tier",
		test: (s) => s.currentTierIndex >= 1,
	},
	{
		id: "ai_lab_tokens",
		test: (s) => s.aiUnlocked,
	},
	{
		id: "singularity_hint",
		test: (s) => s.currentTierIndex >= 5 && s.cash > 100_000_000_000_000,
	},
];

// ── Watcher hook — pushes ShellLine[] to terminal log ──

export function useTutorialTriggers() {
	useEffect(() => {
		const tTutorial = i18n.getFixedT(null, "tutorial");

		const pushTutorial = (id: string) => {
			const header = tTutorial(`${id}.header`, {
				defaultValue: `tutorial.${id}()`,
			}) as string;
			const body = tTutorial(`${id}.body`, {
				defaultValue: `Tip: ${id}`,
			}) as string;

			const lines = shellEngine.pushToolCall("tutorial", header, body);

			// Append next milestone hint
			const next = shellEngine.getNextMilestone();
			if (next) {
				lines.push({
					type: ShellLineTypeEnum.next_milestone,
					text: next.label,
				});
			}

			const { sfxVolume, muted } = useAudioStore.getState();
			playEvent(sfxVolume, muted);

			useUiStore.getState().pushTerminalLines(lines);
		};

		const unsub = useGameStore.subscribe((state) => {
			const uiState = useUiStore.getState();
			for (const trigger of triggers) {
				if (uiState.seenTips.includes(trigger.id)) continue;
				if (trigger.test(state)) {
					uiState.showTip(trigger.id);
					if (trigger.id === "tech_tree_intro" && !uiState.splitEnabled) {
						uiState.toggleSplit();
					}
					pushTutorial(trigger.id);
					break;
				}
			}
		});

		// Initial check for welcome
		const uiState = useUiStore.getState();
		if (!uiState.seenTips.includes("welcome")) {
			uiState.showTip("welcome");
			pushTutorial("welcome");
		}

		return () => unsub();
	}, []);
}

// ── Keyboard shortcuts hook ──

/** @deprecated Keyboard shortcuts removed — conflicts with browser shortcuts */
export function useKeyboardShortcuts() {
	// No-op: Ctrl+T/B/S conflict with browser tab/bookmark/save shortcuts
}

// ── Line renderer helper ──

interface LineRendererProps {
	lines: ShellLine[];
	theme: ReturnType<typeof useIdeTheme>;
}

function renderLineGroup(
	lines: ShellLine[],
	startIndex: number,
	theme: ReturnType<typeof useIdeTheme>,
): { element: React.ReactNode; consumed: number } {
	const line = lines[startIndex];

	// Group tool_header + tool_body into a bordered block
	if (line.type === ShellLineTypeEnum.tool_header) {
		const bodyLines: ShellLine[] = [];
		let j = startIndex + 1;
		while (j < lines.length && lines[j].type === ShellLineTypeEnum.tool_body) {
			bodyLines.push(lines[j]);
			j++;
		}
		return {
			element: (
				<div
					key={startIndex}
					css={toolBlockCss}
					style={{
						borderLeftColor: "#528bff",
						background: "rgba(82, 139, 255, 0.06)",
					}}
				>
					<div css={blockHeaderCss} style={{ color: "#528bff" }}>
						{"🔧 "}
						{line.text}
					</div>
					{bodyLines.map((bl, bi) => (
						<div
							key={`${startIndex}-b-${bi}`}
							style={{ color: theme.foreground, paddingLeft: 20 }}
						>
							{bl.text || "\u00A0"}
						</div>
					))}
				</div>
			),
			consumed: 1 + bodyLines.length,
		};
	}

	// Group milestone_header + milestone_body
	if (line.type === ShellLineTypeEnum.milestone_header) {
		const bodyLines: ShellLine[] = [];
		let j = startIndex + 1;
		while (
			j < lines.length &&
			lines[j].type === ShellLineTypeEnum.milestone_body
		) {
			bodyLines.push(lines[j]);
			j++;
		}
		return {
			element: (
				<div
					key={startIndex}
					css={toolBlockCss}
					style={{
						borderLeftColor: "#d4782f",
						background: "rgba(212, 120, 47, 0.06)",
					}}
				>
					<div css={blockHeaderCss} style={{ color: "#d4782f" }}>
						{"🏆 "}
						{line.text}
					</div>
					{bodyLines.map((bl, bi) => (
						<div
							key={`${startIndex}-b-${bi}`}
							style={{ color: theme.foreground, paddingLeft: 20 }}
						>
							{bl.text || "\u00A0"}
						</div>
					))}
				</div>
			),
			consumed: 1 + bodyLines.length,
		};
	}

	// Single-line types
	let content: React.ReactNode;
	let color = theme.textMuted;

	switch (line.type) {
		case ShellLineTypeEnum.prompt:
			// Prompt lines are rendered inline by the prompt area, skip in log
			return { element: null, consumed: 1 };
		case ShellLineTypeEnum.command:
			color = theme.success;
			content = `$ ${line.text}`;
			break;
		case ShellLineTypeEnum.output:
			color = line.color ?? theme.foreground;
			content = line.text || "\u00A0";
			break;
		case ShellLineTypeEnum.file:
			color = theme.locColor;
			content = line.text;
			break;
		case ShellLineTypeEnum.dir:
			color = theme.cashColor;
			content = line.text;
			break;
		case ShellLineTypeEnum.error:
			color = "#e06c75";
			content = line.text;
			break;
		case ShellLineTypeEnum.next_milestone:
			color = theme.textMuted;
			content = `⏳ ${line.text}`;
			break;
		case ShellLineTypeEnum.separator:
			return {
				element: (
					<div
						key={startIndex}
						css={css({
							borderBottom: `1px solid ${theme.border}`,
							margin: "6px 0",
						})}
					/>
				),
				consumed: 1,
			};
		case ShellLineTypeEnum.blank:
			return {
				element: <div key={startIndex} style={{ height: 8 }} />,
				consumed: 1,
			};
		default:
			content = line.text || "\u00A0";
	}

	return {
		element: (
			<div
				key={startIndex}
				style={{
					color,
					paddingLeft: line.indent ? line.indent * 16 : undefined,
				}}
			>
				{content}
			</div>
		),
		consumed: 1,
	};
}

function ShellLineRenderer({ lines, theme }: LineRendererProps) {
	const elements: React.ReactNode[] = [];
	let i = 0;
	while (i < lines.length) {
		const { element, consumed } = renderLineGroup(lines, i, theme);
		if (element) elements.push(element);
		i += consumed;
	}
	return <>{elements}</>;
}

// ── Prompt segments renderer ──

function PromptDisplay() {
	const segments = shellEngine.getPromptSegments();
	return (
		<span>
			{segments.map((seg, i) => (
				<span key={i} style={{ color: seg.color }}>
					{seg.text}
				</span>
			))}
		</span>
	);
}

// ── Styles ──

const panelCss = css({
	display: "flex",
	flexDirection: "column",
	flexShrink: 0,
	overflow: "hidden",
	minHeight: 80,
	boxShadow: "0 -2px 6px rgba(0,0,0,0.15)",
	zIndex: 1,
	position: "relative",
});

const tabBarCss = css({
	display: "flex",
	alignItems: "center",
	height: 28,
	flexShrink: 0,
});

const tabCss = css({
	padding: "0 12px",
	height: "100%",
	display: "flex",
	alignItems: "center",
	fontSize: 12,
	textTransform: "uppercase",
	letterSpacing: 0.5,
	border: "none",
	background: "none",
	fontFamily: "inherit",
	cursor: "pointer",
});

const logCss = css({
	flex: 1,
	overflowY: "auto",
	padding: "8px 16px",
	fontFamily: "'Courier New', monospace",
	fontSize: 13,
	lineHeight: 1.7,
	"&::-webkit-scrollbar": { width: 6 },
	"&::-webkit-scrollbar-track": { background: "transparent" },
});

const toolBlockCss = css({
	borderLeft: "2px solid",
	padding: "6px 10px",
	borderRadius: "0 4px 4px 0",
	margin: "8px 0",
});

const blockHeaderCss = css({
	fontWeight: 600,
	marginBottom: 2,
});

const inputRowCss = css({
	display: "flex",
	alignItems: "center",
	padding: "4px 0",
	fontFamily: "'Courier New', monospace",
	fontSize: 13,
	gap: 4,
});

const inputCss = css({
	flex: 1,
	background: "none",
	border: "none",
	outline: "none",
	fontFamily: "inherit",
	fontSize: "inherit",
	padding: 0,
	caretColor: "currentColor",
});

const newIndicatorCss = css({
	position: "absolute",
	bottom: 40,
	right: 16,
	padding: "2px 8px",
	borderRadius: 4,
	fontSize: 11,
	cursor: "pointer",
	opacity: 0.9,
	"&:hover": { opacity: 1 },
});

// ── Terminal panel component ──

export function TutorialTip() {
	const terminalOpen = useUiStore((s) => s.terminalOpen);
	const terminalLog = useUiStore((s) => s.terminalLog);
	const toggleTerminal = useUiStore((s) => s.toggleTerminal);
	const theme = useIdeTheme();
	const { t: tTutorial } = useTranslation("tutorial");

	const logRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const [input, setInput] = useState("");
	const [historyIndex, setHistoryIndex] = useState(-1);
	const tabMatches = useRef<string[]>([]);
	const tabIndex = useRef(-1);
	const tabOriginal = useRef("");
	const [isNearBottom, setIsNearBottom] = useState(true);
	const [hasNew, setHasNew] = useState(false);
	const prevLogLen = useRef(terminalLog.length);
	const [contentHeight, setContentHeight] = useState(200);
	const isDragging = useRef(false);

	// Drag-to-resize handler
	const handleDragStart = useCallback(
		(e: React.MouseEvent) => {
			if (!terminalOpen) return;
			e.preventDefault();
			isDragging.current = true;
			const startY = e.clientY;
			const startHeight = contentHeight;

			const onMove = (ev: MouseEvent) => {
				const delta = startY - ev.clientY;
				const newHeight = Math.max(
					80,
					Math.min(window.innerHeight * 0.7, startHeight + delta),
				);
				setContentHeight(newHeight);
			};

			const onUp = () => {
				isDragging.current = false;
				document.removeEventListener("mousemove", onMove);
				document.removeEventListener("mouseup", onUp);
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
			};

			document.body.style.cursor = "row-resize";
			document.body.style.userSelect = "none";
			document.addEventListener("mousemove", onMove);
			document.addEventListener("mouseup", onUp);
		},
		[terminalOpen, contentHeight],
	);

	// Auto-focus input when terminal is open
	useEffect(() => {
		if (terminalOpen) {
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [terminalOpen]);

	// Auto-scroll when near bottom — only if content overflows
	useEffect(() => {
		if (terminalLog.length > prevLogLen.current) {
			const el = logRef.current;
			if (isNearBottom && el) {
				// Only scroll if content actually overflows the container
				if (el.scrollHeight > el.clientHeight) {
					requestAnimationFrame(() => {
						logRef.current?.scrollTo({
							top: logRef.current.scrollHeight,
							behavior: "smooth",
						});
					});
				}
			} else if (el && el.scrollHeight > el.clientHeight) {
				setHasNew(true);
			}
		}
		prevLogLen.current = terminalLog.length;
	}, [terminalLog.length, isNearBottom]);

	const handleScroll = useCallback(() => {
		if (!logRef.current) return;
		const { scrollTop, scrollHeight, clientHeight } = logRef.current;
		const near = scrollHeight - clientHeight - scrollTop < 50;
		setIsNearBottom(near);
		if (near) setHasNew(false);
	}, []);

	const scrollToBottom = useCallback(() => {
		logRef.current?.scrollTo({
			top: logRef.current.scrollHeight,
			behavior: "smooth",
		});
		setHasNew(false);
	}, []);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			const { sfxVolume, muted } = useAudioStore.getState();

			// Reset tab cycling on any key that isn't Tab
			if (e.key !== "Tab") {
				tabOriginal.current = "";
				tabMatches.current = [];
				tabIndex.current = -1;
			}

			if (e.key === "Enter") {
				e.preventDefault();
				const value = input.trim();
				if (!value) return;

				playTerminalKey(sfxVolume, muted);

				// Build prompt + command lines
				const promptSegments = shellEngine.getPromptSegments();
				const promptLine: ShellLine = {
					type: ShellLineTypeEnum.prompt,
					text: promptSegments.map((s) => s.text).join(""),
				};
				const commandLine: ShellLine = {
					type: ShellLineTypeEnum.command,
					text: value,
				};

				const result = shellEngine.execute(value);

				if (result.clear) {
					useUiStore.getState().pushTerminalLines([]);
					// Clear is handled by setting log to empty + new result
					useUiStore.setState({ terminalLog: [...result.lines] });
				} else {
					const allLines: ShellLine[] = [
						promptLine,
						commandLine,
						...result.lines,
					];
					useUiStore.getState().pushTerminalLines(allLines);
				}

				// Play purchase SFX if buy command succeeded
				if (
					value.startsWith("buy") &&
					result.lines.some(
						(l) =>
							l.type === ShellLineTypeEnum.output &&
							l.text.includes("Purchased"),
					)
				) {
					playPurchase(sfxVolume, muted);
				}

				setInput("");
				setHistoryIndex(-1);
				// Re-focus input after command execution
				requestAnimationFrame(() => inputRef.current?.focus());
				return;
			}

			if (e.key === "Tab") {
				e.preventDefault();

				// First tab press or input changed — build match list
				if (tabOriginal.current !== input) {
					tabOriginal.current = input;
					tabMatches.current = shellEngine.autocomplete(input);
					tabIndex.current = -1;
				}

				const matches = tabMatches.current;
				if (matches.length === 0) return;

				// Cycle to next match
				tabIndex.current = (tabIndex.current + 1) % matches.length;
				const match = matches[tabIndex.current];

				// Rebuild input: keep everything up to the last word,
				// then append the match with its parent path prefix
				const parts = input.split(/\s+/);
				const lastWord = parts[parts.length - 1] ?? "";

				// Preserve parent path prefix for path completions
				const slashIdx = lastWord.lastIndexOf("/");
				const prefix = slashIdx >= 0 ? lastWord.slice(0, slashIdx + 1) : "";

				parts[parts.length - 1] = prefix + match;
				setInput(parts.join(" "));
				return;
			}

			if (e.key === "ArrowUp") {
				e.preventDefault();
				const history = shellEngine.getCommandHistory();
				if (history.length === 0) return;
				const newIdx =
					historyIndex === -1
						? history.length - 1
						: Math.max(0, historyIndex - 1);
				setHistoryIndex(newIdx);
				setInput(history[newIdx]);
				return;
			}

			if (e.key === "ArrowDown") {
				e.preventDefault();
				const history = shellEngine.getCommandHistory();
				if (historyIndex === -1) return;
				const newIdx = historyIndex + 1;
				if (newIdx >= history.length) {
					setHistoryIndex(-1);
					setInput("");
				} else {
					setHistoryIndex(newIdx);
					setInput(history[newIdx]);
				}
				return;
			}
		},
		[input, historyIndex],
	);

	// Single wrapper — tab bar always visible, content slides
	return (
		<div
			data-terminal
			ref={panelRef}
			css={panelCss}
			style={{ borderTop: `1px solid ${theme.border}` }}
		>
			{/* Drag handle — only when expanded */}
			{terminalOpen && (
				<div
					css={{
						height: 4,
						cursor: "row-resize",
						flexShrink: 0,
						"&:hover": { background: theme.accent },
					}}
					onMouseDown={handleDragStart}
				/>
			)}
			{/* Tab header — always visible, clickable when collapsed */}
			<div
				css={tabBarCss}
				style={{
					background: theme.tabBarBg,
					borderBottom: terminalOpen ? `1px solid ${theme.border}` : "none",
					cursor: terminalOpen ? "default" : "pointer",
				}}
				onClick={terminalOpen ? undefined : toggleTerminal}
				onKeyDown={undefined}
			>
				<span
					css={tabCss}
					style={{
						color: terminalOpen ? theme.foreground : theme.textMuted,
						borderBottom: terminalOpen
							? `1px solid ${theme.foreground}`
							: "none",
					}}
				>
					{tTutorial("terminal_label", { defaultValue: "Terminal" })}
				</span>
				<button
					type="button"
					css={[
						tabCss,
						{
							marginLeft: "auto",
							color: theme.textMuted,
							fontSize: terminalOpen ? 14 : 12,
							"&:hover": { color: theme.foreground },
						},
					]}
					onClick={(e) => {
						e.stopPropagation();
						toggleTerminal();
					}}
				>
					{terminalOpen ? "×" : "▲"}
				</button>
			</div>

			{/* Sliding content area */}
			<div
				css={{
					overflow: "hidden",
					transition: isDragging.current ? "none" : "height 0.25s ease",
					height: terminalOpen ? contentHeight : 0,
					display: "flex",
					flexDirection: "column",
				}}
			>
				{/* Scrollable log + prompt (prompt inside scroll area) */}
				<div
					ref={logRef}
					css={logCss}
					style={{ background: theme.panelBg, color: theme.textMuted }}
					onScroll={handleScroll}
					onClick={() => inputRef.current?.focus()}
					onKeyDown={() => {}}
					role="textbox"
					tabIndex={-1}
				>
					<ShellLineRenderer lines={terminalLog} theme={theme} />

					{/* New content indicator */}
					{hasNew && (
						<div
							css={newIndicatorCss}
							style={{ background: theme.accent, color: theme.background }}
							onClick={scrollToBottom}
							onKeyDown={(e) => e.key === "Enter" && scrollToBottom()}
							role="button"
							tabIndex={0}
						>
							{"↓ new"}
						</div>
					)}

					{/* Prompt + input — inside the scroll area, right after content */}
					<div
						css={inputRowCss}
						style={{
							color: theme.foreground,
						}}
					>
						<PromptDisplay />
						<span style={{ color: theme.success, marginLeft: 4 }}>{"$ "}</span>
						<input
							ref={inputRef}
							css={inputCss}
							style={{ color: theme.foreground }}
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={handleKeyDown}
							spellCheck={false}
							autoComplete="off"
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
