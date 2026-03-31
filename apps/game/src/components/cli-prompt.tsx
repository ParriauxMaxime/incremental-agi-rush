import { css, keyframes } from "@emotion/react";
import { aiModels, useGameStore } from "@modules/game";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";
import {
	type DiffLine,
	type DiffSnippet,
	pickDiffSnippet,
} from "./diff-snippets";

// ── Types ──

interface LogEntry {
	kind: "prompt" | "model-header" | "file-header" | "diff-line" | "blank";
	text: string;
	color?: string;
	diffType?: DiffLine["type"];
}

type StreamState =
	| { phase: "idle" }
	| {
			phase: "streaming";
			model: string;
			color: string;
			snippet: DiffSnippet;
			lineIdx: number;
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
	lineHeight: 1.6,
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

function diffLinePrefix(type: DiffLine["type"]): string {
	if (type === "add") return "+ ";
	if (type === "remove") return "- ";
	return "  ";
}

function diffLineColor(
	type: DiffLine["type"],
	theme: { success: string; textMuted: string },
): string {
	if (type === "add") return theme.success;
	if (type === "remove") return "#f85149";
	return theme.textMuted;
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

			// Show model header + file after a short delay
			setTimeout(
				() => {
					addEntry({
						kind: "model-header",
						text: modelLabel,
						color,
					});
					addEntry({
						kind: "file-header",
						text: snippet.file,
					});
					setStream({
						phase: "streaming",
						model: modelLabel,
						color,
						snippet,
						lineIdx: 0,
					});
				},
				200 + Math.random() * 300,
			);
		},
		[activeModels, addEntry],
	);

	// ── Stream diff lines one by one ──
	useEffect(() => {
		if (stream.phase !== "streaming") return;

		const { snippet, lineIdx } = stream;

		if (lineIdx >= snippet.lines.length) {
			// Done streaming — add blank line and go idle
			addEntry({ kind: "blank", text: "" });
			setStream({ phase: "done" });
			return;
		}

		const line = snippet.lines[lineIdx];
		// Speed scales with AI FLOPS share: slider=0 → full AI (speed x1), slider=0.9 → almost no AI (speed x0.1)
		const aiShare = Math.max(0.05, 1 - flopSlider);
		const baseDelay =
			line.type === "context"
				? 60 + Math.random() * 80
				: 100 + Math.random() * 150;
		const delay = baseDelay / aiShare;

		const timer = setTimeout(() => {
			addEntry({
				kind: "diff-line",
				text: `${diffLinePrefix(line.type)}${line.text}`,
				diffType: line.type,
			});
			setStream((prev) =>
				prev.phase === "streaming"
					? { ...prev, lineIdx: prev.lineIdx + 1 }
					: prev,
			);
		}, delay);

		return () => clearTimeout(timer);
	}, [stream, addEntry]);

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
		if (!hasAiFlops) return; // slider at 100% exec → frozen

		const aiShare = Math.max(0.05, 1 - flopSlider);
		const baseDelay = autoPokeEnabled
			? 500 + Math.random() * 1000
			: 3000 + Math.random() * 4000;
		const delay = baseDelay / aiShare;
		const timer = setTimeout(() => {
			startPrompt(pickPrompt());
		}, delay);
		return () => clearTimeout(timer);
	}, [autoPokeEnabled, stream.phase, activeModels.length, startPrompt, hasAiFlops]);

	// ── Manual submit ──
	const handleSubmit = useCallback(() => {
		const text = input.trim();
		if (!text || activeModels.length === 0 || !hasAiFlops) return;
		if (stream.phase === "streaming") return; // don't interrupt
		setInput("");
		startPrompt(text);
	}, [input, activeModels, stream.phase, startPrompt, hasAiFlops]);

	// ── Auto-scroll ──
	// biome-ignore lint/correctness/useExhaustiveDependencies: log triggers scroll
	useEffect(() => {
		logRef.current?.scrollTo({
			top: logRef.current.scrollHeight,
			behavior: "smooth",
		});
	}, [log]);

	const isStreaming = stream.phase === "streaming";

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
					<div key={i}>
						{entry.kind === "prompt" && (
							<>
								<span style={{ color: theme.textMuted }}>{"$ "}</span>
								<span style={{ color: theme.foreground }}>{entry.text}</span>
							</>
						)}
						{entry.kind === "model-header" && (
							<>
								<span css={spinnerCss} style={{ color: entry.color }} />{" "}
								<span
									style={{
										color: entry.color,
										fontWeight: "bold",
									}}
								>
									{entry.text}
								</span>
								<span style={{ color: theme.textMuted }}> editing...</span>
							</>
						)}
						{entry.kind === "file-header" && (
							<span
								style={{
									color: theme.accent,
									fontSize: 12,
									opacity: 0.7,
								}}
							>
								{"  "}
								{entry.text}
							</span>
						)}
						{entry.kind === "diff-line" && (
							<span
								style={{
									color: diffLineColor(entry.diffType ?? "context", theme),
									fontSize: 12,
								}}
							>
								{"    "}
								{entry.text}
							</span>
						)}
						{entry.kind === "blank" && <br />}
					</div>
				))}
				{isStreaming && (
					<div>
						<span css={cursorCss} style={{ background: theme.accent }} />
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
					css={{ fontSize: 13, userSelect: "none" }}
					style={{ color: theme.textMuted }}
				>
					{"$"}
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
