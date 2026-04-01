import { css, keyframes } from "@emotion/react";
import { aiModels, useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { shellEngine } from "../modules/terminal";
import {
	type DiffLine,
	type DiffSnippet,
	pickDiffSnippet,
} from "./diff-snippets";

// ── Types ──

interface LogEntry {
	kind:
		| "prompt"
		| "text"
		| "tool-header"
		| "tool-summary"
		| "diff-line"
		| "status"
		| "blank";
	text: string;
	color?: string;
	diffType?: DiffLine["type"];
	lineNum?: number;
}

type StreamState =
	| { phase: "idle" }
	| {
			phase: "streaming";
			model: string;
			color: string;
			snippet: DiffSnippet;
			lineIdx: number;
			startTime: number;
			tokenScale: number;
	  }
	| { phase: "done" };

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

const blink = keyframes({
	"50%": { opacity: 0 },
});

const cursorCss = css({
	display: "inline-block",
	width: 7,
	height: 14,
	verticalAlign: "text-bottom",
	animation: `${blink} 1s step-end infinite`,
});

const spin = keyframes({
	"0%": { content: '"⠋"' },
	"10%": { content: '"⠙"' },
	"20%": { content: '"⠹"' },
	"30%": { content: '"⠸"' },
	"40%": { content: '"⠼"' },
	"50%": { content: '"⠴"' },
	"60%": { content: '"⠦"' },
	"70%": { content: '"⠧"' },
	"80%": { content: '"⠇"' },
	"90%": { content: '"⠏"' },
});

const spinnerCss = css({
	"&::before": {
		content: '"⠋"',
		animation: `${spin} 0.8s steps(1) infinite`,
	},
});

const dotCss = css({
	display: "inline-block",
	width: 8,
	height: 8,
	borderRadius: "50%",
	marginRight: 8,
	verticalAlign: "middle",
});

const diffLineCss = css({
	display: "flex",
	fontSize: 12,
	lineHeight: 1.6,
	borderRadius: 2,
	margin: "0 0 0 16px",
});

const lineNumCss = css({
	display: "inline-block",
	width: 32,
	textAlign: "right",
	paddingRight: 8,
	userSelect: "none",
	flexShrink: 0,
});

// ── Prompt suggestions ──

const PROMPT_SUGGESTIONS = [
	"Refactor the attention mechanism",
	"Add chain-of-thought reasoning",
	"Optimize the training loop",
	"Implement RLHF pipeline",
	"Scale to 2048 GPUs",
	"Fix the alignment loss function",
	"Add mixture of experts routing",
	"Implement self-reflection module",
	"Build autonomous agent framework",
	"Deploy world model predictor",
	"Compress the tokenizer vocabulary",
	"Profile memory bottlenecks",
	"Add safety guardrails",
	"Improve benchmark evaluation",
	"Implement emergent capability detection",
	"Upgrade to flash attention",
	"Add speculative decoding",
	"Tune hyperparameters",
	"Build data preprocessing pipeline",
	"Implement tool-use capabilities",
];

function pickPrompt(): string {
	return PROMPT_SUGGESTIONS[
		Math.floor(Math.random() * PROMPT_SUGGESTIONS.length)
	];
}

// ── Helpers ──

function getModelColor(family: string): string {
	const colors: Record<string, string> = {
		claude: "#d4a574",
		gpt: "#74b9ff",
		gemini: "#fbbf24",
		llama: "#a29bfe",
		mistral: "#fd79a8",
		grok: "#e17055",
		copilot: "#6c5ce7",
	};
	return colors[family] ?? "#8b949e";
}

function diffBg(type: DiffLine["type"]): string {
	if (type === "add") return "rgba(46, 160, 67, 0.15)";
	if (type === "remove") return "rgba(248, 81, 73, 0.15)";
	return "transparent";
}

function diffFg(
	type: DiffLine["type"],
	theme: { success: string; textMuted: string },
): string {
	if (type === "add") return theme.success;
	if (type === "remove") return "#f85149";
	return theme.textMuted;
}

function diffPrefix(type: DiffLine["type"]): string {
	if (type === "add") return "+";
	if (type === "remove") return "-";
	return " ";
}

function countDiffLines(snippet: DiffSnippet): {
	added: number;
	removed: number;
} {
	let added = 0;
	let removed = 0;
	for (const l of snippet.lines) {
		if (l.type === "add") added++;
		if (l.type === "remove") removed++;
	}
	return { added, removed };
}

// ── Thinking verbs (Claude Code style) ──

const THINKING_VERBS = [
	"Reasoning",
	"Analyzing",
	"Thinking",
	"Planning",
	"Evaluating",
	"Considering",
	"Processing",
	"Synthesizing",
	"Examining",
	"Reviewing",
];

function pickThinkingVerb(): string {
	return THINKING_VERBS[Math.floor(Math.random() * THINKING_VERBS.length)];
}

// ── Max visible log entries ──
const MAX_LOG = 80;
const TRIM_TO = 40;

// ── Component ──

export function CliPrompt() {
	const unlockedModels = useGameStore((s) => s.unlockedModels);
	const autoPokeEnabled = useGameStore((s) => s.autoPokeEnabled);
	const flopSlider = useGameStore((s) => s.flopSlider);
	const theme = useIdeTheme();
	const { t: tUi } = useTranslation();

	const [log, setLog] = useState<LogEntry[]>([]);
	const [input, setInput] = useState("");
	const [stream, setStream] = useState<StreamState>({ phase: "idle" });
	const logRef = useRef<HTMLDivElement>(null);
	const streamRef = useRef(stream);
	streamRef.current = stream;

	const activeModels = useMemo(
		() => aiModels.filter((m) => unlockedModels[m.id]),
		[unlockedModels],
	);

	const addEntry = useCallback((entry: LogEntry) => {
		setLog((prev) => {
			const next = [...prev, entry];
			return next.length > MAX_LOG ? next.slice(-TRIM_TO) : next;
		});
	}, []);

	// ── Start a prompt run ──
	const startPrompt = useCallback(
		(promptText: string) => {
			if (activeModels.length === 0) return;

			// Show user prompt
			addEntry({ kind: "prompt", text: promptText });

			// Pick model + snippet
			const model =
				activeModels[Math.floor(Math.random() * activeModels.length)];
			const snippet = pickDiffSnippet();
			const modelLabel = `${model.name} ${model.version}`;
			const color = getModelColor(model.family);
			const { added, removed } = countDiffLines(snippet);

			// Token scale based on model power: GPT-3 (500) → ~1K, Universe (50M) → ~500M
			const logPower = Math.log10(Math.max(1, model.locPerSec));
			const tokenScale = 10 ** (logPower * 1.1 + 0.2);

			// Show thinking text, then tool header + summary after a short delay
			setTimeout(
				() => {
					addEntry({
						kind: "text",
						text: `${pickThinkingVerb()}...`,
						color,
					});
				},
				100 + Math.random() * 150,
			);

			setTimeout(
				() => {
					addEntry({
						kind: "tool-header",
						text: `Update(${snippet.file})`,
						color,
					});
					addEntry({
						kind: "tool-summary",
						text: `Added ${added} lines, removed ${removed} lines`,
					});
					setStream({
						phase: "streaming",
						model: modelLabel,
						color,
						snippet,
						lineIdx: 0,
						startTime: performance.now(),
						tokenScale,
					});
				},
				400 + Math.random() * 300,
			);
		},
		[activeModels, addEntry],
	);

	// ── Stream diff lines one by one ──
	useEffect(() => {
		if (stream.phase !== "streaming") return;

		const { snippet, lineIdx } = stream;

		if (lineIdx >= snippet.lines.length) {
			// Done streaming — add completion text and go idle
			const elapsed = Math.round((performance.now() - stream.startTime) / 1000);
			const tokenCount = Math.round(
				stream.tokenScale * (0.8 + Math.random() * 0.4),
			);
			addEntry({ kind: "blank", text: "" });
			addEntry({
				kind: "text",
				text: `Done (${elapsed}s · ↑ ${formatNumber(tokenCount)} tokens)`,
				color: stream.color,
			});
			addEntry({ kind: "blank", text: "" });
			setStream({ phase: "done" });
			return;
		}

		const line = snippet.lines[lineIdx];
		// Speed scales with AI FLOPS share
		const aiShare = Math.max(0.05, 1 - flopSlider);
		const baseDelay =
			line.type === "context"
				? 60 + Math.random() * 80
				: 100 + Math.random() * 150;
		const delay = baseDelay / aiShare;

		// Compute a fake line number starting from a random base
		const baseLineNum =
			snippet.lines.length > 0 ? 42 + Math.floor(Math.random() * 200) : 42;
		const contextOffset = snippet.lines
			.slice(0, lineIdx)
			.filter((l) => l.type !== "remove").length;

		const timer = setTimeout(() => {
			addEntry({
				kind: "diff-line",
				text: `${diffPrefix(line.type)} ${line.text}`,
				diffType: line.type,
				lineNum: baseLineNum + contextOffset,
			});
			setStream((prev) =>
				prev.phase === "streaming"
					? { ...prev, lineIdx: prev.lineIdx + 1 }
					: prev,
			);
		}, delay);

		return () => clearTimeout(timer);
	}, [stream, addEntry, flopSlider]);

	// ── After streaming done, go back to idle (allow auto-poke) ──
	useEffect(() => {
		if (stream.phase !== "done") return;
		const aiShare = Math.max(0.05, 1 - flopSlider);
		const timer = setTimeout(
			() => {
				setStream({ phase: "idle" });
			},
			(500 + Math.random() * 500) / aiShare,
		);
		return () => clearTimeout(timer);
	}, [stream.phase, flopSlider]);

	// ── Auto-prompt: AI models produce when active + AI FLOPS available ──
	const hasAiFlops = flopSlider < 1;
	useEffect(() => {
		if (stream.phase !== "idle") return;
		if (activeModels.length === 0) return;
		if (!hasAiFlops) return;

		const aiShare = Math.max(0.05, 1 - flopSlider);
		const baseDelay = autoPokeEnabled
			? 500 + Math.random() * 1000
			: 3000 + Math.random() * 4000;
		const delay = baseDelay / aiShare;
		const timer = setTimeout(() => {
			startPrompt(pickPrompt());
		}, delay);
		return () => clearTimeout(timer);
	}, [
		autoPokeEnabled,
		stream.phase,
		activeModels.length,
		startPrompt,
		hasAiFlops,
		flopSlider,
	]);

	// ── Manual submit ──
	const handleSubmit = useCallback(() => {
		const text = input.trim();
		if (!text) return;

		if (text.startsWith("!")) {
			const cmd = text.slice(1).trim();
			if (!cmd) return;
			setInput("");
			addEntry({ kind: "prompt", text: `! ${cmd}` });
			const result = shellEngine.execute(cmd);
			for (const line of result.lines) {
				addEntry({ kind: "text", text: line.text });
			}
			return;
		}

		if (activeModels.length === 0 || !hasAiFlops) return;
		if (stream.phase === "streaming") return;
		setInput("");
		startPrompt(text);
	}, [input, activeModels, stream.phase, startPrompt, hasAiFlops, addEntry]);

	// ── Auto-scroll ──
	// biome-ignore lint/correctness/useExhaustiveDependencies: log triggers scroll
	useEffect(() => {
		logRef.current?.scrollTo({
			top: logRef.current.scrollHeight,
			behavior: "smooth",
		});
	}, [log]);

	const isStreaming = stream.phase === "streaming";

	// ── Status line for active streaming ──
	const statusText = useMemo(() => {
		if (stream.phase !== "streaming") return null;
		const elapsed = Math.round((performance.now() - stream.startTime) / 1000);
		return `${pickThinkingVerb()}… (${elapsed}s)`;
	}, [stream]);

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
				{log.map((entry, i) => (
					<div
						key={i}
						style={{
							marginTop:
								entry.kind === "text" || entry.kind === "tool-header" ? 4 : 0,
						}}
					>
						{entry.kind === "prompt" && (
							<>
								<span
									style={{
										color: theme.accent,
										fontWeight: "bold",
										marginRight: 6,
									}}
								>
									{"❯"}
								</span>
								<span style={{ color: theme.foreground }}>{entry.text}</span>
							</>
						)}
						{entry.kind === "text" && (
							<>
								<span
									css={dotCss}
									style={{ background: entry.color ?? theme.success }}
								/>
								<span style={{ color: theme.foreground }}>{entry.text}</span>
							</>
						)}
						{entry.kind === "tool-header" && (
							<>
								<span
									css={dotCss}
									style={{ background: entry.color ?? theme.success }}
								/>
								<span
									style={{
										color: theme.foreground,
										fontWeight: "bold",
									}}
								>
									{entry.text}
								</span>
							</>
						)}
						{entry.kind === "tool-summary" && (
							<span
								style={{
									color: theme.textMuted,
									fontSize: 12,
									marginLeft: 18,
								}}
							>
								{"└ "}
								{entry.text}
							</span>
						)}
						{entry.kind === "diff-line" && (
							<div
								css={diffLineCss}
								style={{
									background: diffBg(entry.diffType ?? "context"),
								}}
							>
								<span
									css={lineNumCss}
									style={{
										color:
											entry.diffType === "remove"
												? "#f8514966"
												: theme.lineNumbers,
									}}
								>
									{entry.diffType === "remove" ? "" : entry.lineNum}
								</span>
								<span
									style={{
										color: diffFg(entry.diffType ?? "context", theme),
									}}
								>
									{entry.text}
								</span>
							</div>
						)}
						{entry.kind === "status" && (
							<>
								<span
									css={spinnerCss}
									style={{ color: entry.color ?? "#e5c07b" }}
								/>
								<span
									style={{
										color: theme.textMuted,
										fontSize: 12,
										marginLeft: 6,
									}}
								>
									{entry.text}
								</span>
							</>
						)}
						{entry.kind === "blank" && <br />}
					</div>
				))}
				{isStreaming && (
					<div style={{ marginTop: 4 }}>
						<span
							css={spinnerCss}
							style={{
								color:
									stream.phase === "streaming" ? stream.color : theme.accent,
							}}
						/>
						<span
							style={{
								color: theme.textMuted,
								fontSize: 12,
								marginLeft: 6,
							}}
						>
							{statusText}
						</span>
						<span
							css={cursorCss}
							style={{ background: theme.accent, marginLeft: 4 }}
						/>
					</div>
				)}
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
					{"❯"}
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
					placeholder={isStreaming ? "" : tUi("cli.placeholder")}
					disabled={isStreaming}
					spellCheck={false}
					autoComplete="off"
				/>
			</div>
		</div>
	);
}
