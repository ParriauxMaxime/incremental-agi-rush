import { css } from "@emotion/react";
import { aiModels, useGameStore } from "@modules/game";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { shellEngine } from "../modules/terminal";
import {
	type ActionStep,
	AUTO_PROMPTS,
	type BashSnippet,
	type EditSnippet,
	pickPattern,
	type ReadSnippet,
	type WriteSnippet,
} from "./cli-prompt-content";

// ── Types ──

type LogEntryKind =
	| "user_prompt"
	| "queued_prompt"
	| "thinking"
	| "tool_header"
	| "tool_content"
	| "tool_result"
	| "response_text"
	| "completion"
	| "bash_command"
	| "bash_output"
	| "blank";

interface LogEntry {
	kind: LogEntryKind;
	text: string;
	color?: string;
	lineType?: "add" | "remove" | "context";
	/** For tool_header: which tool badge */
	toolName?: "Read" | "Edit" | "Write" | "Bash";
}

type Phase = "idle" | "thinking" | "executing" | "responding" | "completing";

// ── Constants ──

const MAX_LOG = 80;
const TRIM_TO = 40;

const SPINNER_FRAMES = [
	"\u280B",
	"\u2819",
	"\u2839",
	"\u2838",
	"\u283C",
	"\u2834",
	"\u2826",
	"\u2827",
	"\u2807",
	"\u280F",
];

const TOOL_COLORS = {
	Read: { fg: "#58a6ff", bg: "rgba(88,166,255,0.15)" },
	Edit: { fg: "#3fb950", bg: "rgba(63,185,80,0.15)" },
	Write: { fg: "#a78bfa", bg: "rgba(167,139,250,0.15)" },
	Bash: { fg: "#f0883e", bg: "rgba(240,136,62,0.15)" },
};

// ── Styles ──

const wrapperCss = css({
	display: "flex",
	flexDirection: "column",
	flex: 1,
	overflow: "hidden",
});

const logCss = css({
	flex: 1,
	overflowY: "auto",
	padding: "8px 12px",
	fontSize: 13,
	lineHeight: 1.7,
	fontFamily: "'Courier New', monospace",
	"&::-webkit-scrollbar": { width: 4 },
	"&::-webkit-scrollbar-track": { background: "transparent" },
});

const inputRowCss = css({
	display: "flex",
	alignItems: "center",
	padding: "8px 12px",
	gap: 6,
	flexShrink: 0,
});

const badgeCss = css({
	display: "inline-block",
	padding: "2px 6px",
	borderRadius: 4,
	fontSize: 11,
	fontWeight: 600,
});

const toolContentCss = css({
	display: "block",
	marginLeft: 16,
	fontSize: 12,
	lineHeight: 1.6,
});

// ── Helpers ──

function pickAutoPrompt(): string {
	return AUTO_PROMPTS[Math.floor(Math.random() * AUTO_PROMPTS.length)];
}

function getFlopScale(flops: number): number {
	return Math.max(1, 1 + Math.log10(Math.max(1, flops)) / 3);
}

function randomBetween(min: number, max: number): number {
	return min + Math.random() * (max - min);
}

function fakeCost(): string {
	const input = Math.floor(randomBetween(800, 4200));
	const output = Math.floor(randomBetween(200, 1200));
	const cost = ((input * 3 + output * 15) / 1_000_000).toFixed(4);
	return `$${cost}`;
}

// ── Component ──

export function CliPrompt() {
	const flops = useGameStore((s) => s.flops);
	const flopSlider = useGameStore((s) => s.flopSlider);
	const unlockedModels = useGameStore((s) => s.unlockedModels);
	const theme = useIdeTheme();
	const { t: tUi } = useTranslation();

	const [log, setLog] = useState<LogEntry[]>([]);
	const [input, setInput] = useState("");
	const [phase, setPhase] = useState<Phase>("idle");
	const [queue, setQueue] = useState<string[]>([]);

	// Refs for mutable state accessed in timeouts
	const logRef = useRef<HTMLDivElement>(null);
	const phaseRef = useRef(phase);
	phaseRef.current = phase;
	const queueRef = useRef(queue);
	queueRef.current = queue;
	const cancelRef = useRef<(() => void) | null>(null);

	// Spinner state for the thinking phase
	const [spinnerIdx, setSpinnerIdx] = useState(0);
	const [thinkElapsed, setThinkElapsed] = useState(0);

	const activeModels = useMemo(
		() => aiModels.filter((m) => unlockedModels[m.id]),
		[unlockedModels],
	);

	// ── Log management ──

	const appendEntry = useCallback((entry: LogEntry) => {
		setLog((prev) => {
			const next = [...prev, entry];
			return next.length > MAX_LOG ? next.slice(-TRIM_TO) : next;
		});
	}, []);

	const updateLastEntry = useCallback((updater: (e: LogEntry) => LogEntry) => {
		setLog((prev) => {
			if (prev.length === 0) return prev;
			const next = [...prev];
			next[next.length - 1] = updater(next[next.length - 1]);
			return next;
		});
	}, []);

	// ── Flop scale (memoized) ──

	const flopScale = useMemo(() => getFlopScale(flops), [flops]);

	// ── Process action steps ──

	const processSteps = useCallback(
		(steps: ActionStep[]) => {
			let stepIdx = 0;
			let subIdx = 0; // sub-index within a step (e.g., line index)
			let wordIdx = 0; // for response streaming
			let cancelled = false;

			const cancel = () => {
				cancelled = true;
			};
			cancelRef.current = cancel;

			function scheduleNext(delayMs: number, fn: () => void) {
				if (cancelled) return;
				const scaled = delayMs / flopScale;
				const timer = setTimeout(() => {
					if (cancelled) return;
					fn();
				}, scaled);
				// Store cleanup
				const prevCancel = cancel;
				cancelRef.current = () => {
					prevCancel();
					clearTimeout(timer);
				};
			}

			function advance() {
				if (cancelled || stepIdx >= steps.length) {
					setPhase("idle");
					return;
				}

				const step = steps[stepIdx];

				switch (step.type) {
					case "think": {
						setPhase("thinking");
						// Add thinking entry that will be updated in place
						appendEntry({
							kind: "thinking",
							text: `${SPINNER_FRAMES[0]} Thinking... (0s)`,
						});
						const thinkDuration = randomBetween(1500, 3000) / flopScale;
						scheduleNext(thinkDuration, () => {
							// Replace thinking line with final state
							const elapsed = (thinkDuration / 1000).toFixed(1);
							updateLastEntry(() => ({
								kind: "thinking",
								text: `${SPINNER_FRAMES[0]} Thinking... (${elapsed}s)`,
							}));
							stepIdx++;
							subIdx = 0;
							setPhase("executing");
							advance();
						});
						break;
					}

					case "read": {
						const snippet = step.snippet as ReadSnippet;
						if (subIdx === 0) {
							// Tool header
							appendEntry({
								kind: "tool_header",
								text: snippet.file,
								toolName: "Read",
							});
							subIdx = 1;
							scheduleNext(randomBetween(80, 150), advance);
						} else if (subIdx <= snippet.lines.length) {
							const lineIdx = subIdx - 1;
							appendEntry({
								kind: "tool_content",
								text: snippet.lines[lineIdx],
								lineType: "context",
							});
							subIdx++;
							scheduleNext(randomBetween(80, 150), advance);
						} else {
							appendEntry({
								kind: "tool_result",
								text: `${snippet.lines.length} lines read`,
							});
							stepIdx++;
							subIdx = 0;
							scheduleNext(randomBetween(80, 150), advance);
						}
						break;
					}

					case "edit": {
						const snippet = step.snippet as EditSnippet;
						if (subIdx === 0) {
							appendEntry({
								kind: "tool_header",
								text: snippet.file,
								toolName: "Edit",
							});
							subIdx = 1;
							scheduleNext(randomBetween(80, 150), advance);
						} else if (subIdx <= snippet.lines.length) {
							const lineIdx = subIdx - 1;
							const line = snippet.lines[lineIdx];
							const prefix =
								line.type === "add"
									? "+ "
									: line.type === "remove"
										? "- "
										: "  ";
							appendEntry({
								kind: "tool_content",
								text: `${prefix}${line.text}`,
								lineType: line.type,
							});
							subIdx++;
							scheduleNext(randomBetween(80, 150), advance);
						} else {
							const added = snippet.lines.filter(
								(l) => l.type === "add",
							).length;
							const removed = snippet.lines.filter(
								(l) => l.type === "remove",
							).length;
							appendEntry({
								kind: "tool_result",
								text: `${snippet.description} (+${added} -${removed})`,
							});
							stepIdx++;
							subIdx = 0;
							scheduleNext(randomBetween(80, 150), advance);
						}
						break;
					}

					case "write": {
						const snippet = step.snippet as WriteSnippet;
						if (subIdx === 0) {
							appendEntry({
								kind: "tool_header",
								text: snippet.file,
								toolName: "Write",
							});
							subIdx = 1;
							scheduleNext(randomBetween(80, 150), advance);
						} else if (subIdx <= snippet.lines.length) {
							const lineIdx = subIdx - 1;
							appendEntry({
								kind: "tool_content",
								text: snippet.lines[lineIdx],
								lineType: "context",
							});
							subIdx++;
							scheduleNext(randomBetween(80, 150), advance);
						} else {
							appendEntry({
								kind: "tool_result",
								text: `Wrote ${snippet.lines.length} lines to ${snippet.file}`,
							});
							stepIdx++;
							subIdx = 0;
							scheduleNext(randomBetween(80, 150), advance);
						}
						break;
					}

					case "bash": {
						const snippet = step.snippet as BashSnippet;
						if (subIdx === 0) {
							appendEntry({
								kind: "tool_header",
								text: snippet.command,
								toolName: "Bash",
							});
							subIdx = 1;
							scheduleNext(randomBetween(80, 150), advance);
						} else if (subIdx <= snippet.output.length) {
							const lineIdx = subIdx - 1;
							appendEntry({
								kind: "bash_output",
								text: snippet.output[lineIdx],
							});
							subIdx++;
							scheduleNext(randomBetween(80, 150), advance);
						} else {
							appendEntry({
								kind: "tool_result",
								text: `Command completed`,
							});
							stepIdx++;
							subIdx = 0;
							scheduleNext(randomBetween(80, 150), advance);
						}
						break;
					}

					case "respond": {
						setPhase("responding");
						const text = step.text ?? "";
						const words = text.split(" ");
						if (wordIdx === 0) {
							// Start with empty response entry
							appendEntry({ kind: "response_text", text: "" });
							wordIdx = 1;
						}
						if (wordIdx <= words.length) {
							const partial = words.slice(0, wordIdx).join(" ");
							updateLastEntry(() => ({
								kind: "response_text",
								text: partial,
							}));
							wordIdx++;
							scheduleNext(randomBetween(30, 60), advance);
						} else {
							stepIdx++;
							subIdx = 0;
							wordIdx = 0;
							advance();
						}
						break;
					}

					case "complete": {
						setPhase("completing");
						const elapsed = randomBetween(2, 12).toFixed(1);
						const tokens = Math.floor(randomBetween(1200, 8000));
						appendEntry({
							kind: "completion",
							text: `${elapsed}s \u00b7 ${tokens.toLocaleString()} tokens \u00b7 ${fakeCost()}`,
						});
						appendEntry({ kind: "blank", text: "" });
						scheduleNext(randomBetween(300, 600), () => {
							stepIdx++;
							subIdx = 0;
							setPhase("idle");
						});
						break;
					}

					default:
						stepIdx++;
						advance();
				}
			}

			advance();
		},
		[flopScale, appendEntry, updateLastEntry],
	);

	// ── Start processing a prompt ──

	const startProcessing = useCallback(
		(_promptText: string) => {
			if (activeModels.length === 0) return;
			const steps = pickPattern();
			processSteps(steps);
		},
		[activeModels.length, processSteps],
	);

	// ── Thinking spinner animation ──

	useEffect(() => {
		if (phase !== "thinking") return;

		const startTime = performance.now();
		const interval = setInterval(() => {
			const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
			setSpinnerIdx((prev) => (prev + 1) % SPINNER_FRAMES.length);
			setThinkElapsed(Number(elapsed));
			updateLastEntry(() => ({
				kind: "thinking",
				text: `thinking_placeholder`,
			}));
		}, 80);

		return () => clearInterval(interval);
	}, [phase, updateLastEntry]);

	// ── When phase goes idle, check queue or start auto-prompt ──

	const hasAiFlops = flopSlider < 1;

	useEffect(() => {
		if (phase !== "idle") return;
		if (activeModels.length === 0) return;
		if (!hasAiFlops) return;

		// Check queue first
		if (queueRef.current.length > 0) {
			const next = queueRef.current[0];
			setQueue((q) => q.slice(1));
			appendEntry({ kind: "user_prompt", text: next });
			startProcessing(next);
			return;
		}

		// Auto-prompt timer
		const baseDelay = randomBetween(500, 1500);
		const delay = baseDelay / flopScale;
		const timer = setTimeout(() => {
			if (phaseRef.current !== "idle") return;
			const prompt = pickAutoPrompt();
			appendEntry({ kind: "user_prompt", text: prompt });
			startProcessing(prompt);
		}, delay);

		return () => clearTimeout(timer);
	}, [
		phase,
		activeModels.length,
		hasAiFlops,
		flopScale,
		appendEntry,
		startProcessing,
	]);

	// ── Manual submit ──

	const handleSubmit = useCallback(() => {
		const text = input.trim();

		// Empty enter
		if (!text) {
			appendEntry({ kind: "user_prompt", text: "" });
			return;
		}

		// Shell command
		if (text.startsWith("!")) {
			const cmd = text.slice(1).trim();
			if (!cmd) return;
			setInput("");
			appendEntry({ kind: "user_prompt", text: `! ${cmd}` });
			const result = shellEngine.execute(cmd);
			for (const line of result.lines) {
				appendEntry({ kind: "response_text", text: line.text });
			}
			return;
		}

		setInput("");

		if (phase === "idle") {
			appendEntry({ kind: "user_prompt", text });
			startProcessing(text);
		} else {
			// Queue it
			appendEntry({ kind: "queued_prompt", text });
			setQueue((q) => [...q, text]);
		}
	}, [input, phase, appendEntry, startProcessing]);

	// ── Auto-scroll ──

	// biome-ignore lint/correctness/useExhaustiveDependencies: log triggers scroll
	useEffect(() => {
		logRef.current?.scrollTo({
			top: logRef.current.scrollHeight,
			behavior: "smooth",
		});
	}, [log]);

	// ── Cleanup on unmount ──

	useEffect(() => {
		return () => {
			cancelRef.current?.();
		};
	}, []);

	// ── Render helpers ──

	function renderEntry(entry: LogEntry, i: number) {
		switch (entry.kind) {
			case "user_prompt":
				return (
					<div key={i}>
						<span
							style={{
								color: theme.accent,
								fontWeight: "bold",
								marginRight: 6,
							}}
						>
							{"\u276F"}
						</span>
						<span style={{ color: theme.foreground }}>{entry.text}</span>
					</div>
				);

			case "queued_prompt":
				return (
					<div key={i}>
						<span
							style={{
								color: theme.accent,
								fontWeight: "bold",
								marginRight: 6,
							}}
						>
							{"\u276F"}
						</span>
						<span style={{ color: theme.foreground, marginRight: 8 }}>
							{entry.text}
						</span>
						<span
							css={badgeCss}
							style={{
								color: "#d29922",
								background: "rgba(210,153,34,0.15)",
							}}
						>
							Queued
						</span>
					</div>
				);

			case "thinking": {
				const frame = SPINNER_FRAMES[spinnerIdx % SPINNER_FRAMES.length];
				return (
					<div key={i} style={{ color: theme.textMuted }}>
						<span>{frame}</span>
						<span style={{ marginLeft: 6 }}>
							Thinking... ({thinkElapsed.toFixed(1)}s)
						</span>
					</div>
				);
			}

			case "tool_header": {
				const tool = entry.toolName ?? "Read";
				const colors = TOOL_COLORS[tool];
				return (
					<div key={i} style={{ marginTop: 4 }}>
						<span
							css={badgeCss}
							style={{
								color: colors.fg,
								background: colors.bg,
								marginRight: 8,
							}}
						>
							{tool}
						</span>
						<span style={{ color: theme.textMuted }}>{entry.text}</span>
					</div>
				);
			}

			case "tool_content": {
				const lt = entry.lineType ?? "context";
				const fg =
					lt === "add"
						? "#3fb950"
						: lt === "remove"
							? "#f85149"
							: theme.textMuted;
				const bg =
					lt === "add"
						? "rgba(63,185,80,0.08)"
						: lt === "remove"
							? "rgba(248,81,73,0.08)"
							: "transparent";
				return (
					<div
						key={i}
						css={toolContentCss}
						style={{ color: fg, background: bg }}
					>
						{entry.text}
					</div>
				);
			}

			case "tool_result":
				return (
					<div key={i} style={{ marginLeft: 16, marginTop: 2 }}>
						<span style={{ color: "#3fb950", marginRight: 6 }}>{"\u2713"}</span>
						<span style={{ color: theme.foreground, fontSize: 12 }}>
							{entry.text}
						</span>
					</div>
				);

			case "response_text":
				return (
					<div key={i} style={{ color: theme.foreground, marginTop: 4 }}>
						{entry.text}
					</div>
				);

			case "completion":
				return (
					<div key={i} style={{ color: theme.textMuted, fontSize: 12 }}>
						{entry.text}
					</div>
				);

			case "bash_command":
				return (
					<div key={i} style={{ marginLeft: 16 }}>
						<span style={{ color: theme.textMuted, marginRight: 6 }}>$</span>
						<span style={{ color: theme.foreground }}>{entry.text}</span>
					</div>
				);

			case "bash_output":
				return (
					<div key={i} style={{ color: theme.textMuted, marginLeft: 16 }}>
						{entry.text}
					</div>
				);

			case "blank":
				return <div key={i}>&nbsp;</div>;

			default:
				return null;
		}
	}

	return (
		<div css={wrapperCss} style={{ background: theme.panelBg }}>
			<div ref={logRef} css={logCss} style={{ color: theme.textMuted }}>
				{log.length === 0 && (
					<div style={{ color: theme.textMuted, opacity: 0.5 }}>
						<div>{tUi("cli.header")}</div>
						<div>{tUi("cli.loaded")}</div>
						<div>{""}</div>
					</div>
				)}
				{log.map((entry, i) => renderEntry(entry, i))}
			</div>
			<div
				css={inputRowCss}
				style={{
					borderTop: `1px solid ${theme.border}`,
					background: theme.background,
				}}
			>
				<span
					css={{ fontSize: 13, userSelect: "none", fontWeight: "bold" }}
					style={{ color: theme.accent }}
				>
					{"\u276F"}
				</span>
				<input
					css={{
						flex: 1,
						background: "transparent",
						border: "none",
						outline: "none",
						color: theme.foreground,
						fontFamily: "'Courier New', monospace",
						fontSize: 13,
						caretColor: theme.accent,
						"&::placeholder": {
							color: theme.textMuted,
							opacity: 0.4,
						},
					}}
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") handleSubmit();
					}}
					placeholder={tUi("cli.placeholder")}
					spellCheck={false}
					autoComplete="off"
				/>
			</div>
		</div>
	);
}
