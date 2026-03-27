import { css } from "@emotion/react";
import { aiModels, useGameStore } from "@modules/game";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlopsSlider } from "./flops-slider";

const wrapperCss = css({
	display: "flex",
	flexDirection: "column",
	background: "#0a0e14",
	overflow: "hidden",
});

const headerCss = css({
	padding: "4px 12px",
	background: "#161b22",
	borderBottom: "1px solid #1e2630",
	fontSize: 10,
	color: "#8b949e",
});

const logCss = css({
	flex: 1,
	overflowY: "auto",
	padding: "6px 10px",
	fontSize: 11,
	lineHeight: 1.5,
	display: "flex",
	flexDirection: "column",
	gap: 4,
	"&::-webkit-scrollbar": { width: 4 },
	"&::-webkit-scrollbar-track": { background: "transparent" },
	"&::-webkit-scrollbar-thumb": { background: "#1e2630", borderRadius: 2 },
});

const inputRowCss = css({
	display: "flex",
	alignItems: "center",
	padding: "6px 10px",
	borderTop: "1px solid #1e2630",
	background: "#0d1117",
	gap: 6,
	flexShrink: 0,
});

const promptPrefixCss = css({
	fontSize: 11,
	color: "#6272a4",
	userSelect: "none",
});

const inputCss = css({
	flex: 1,
	background: "transparent",
	border: "none",
	outline: "none",
	color: "#c9d1d9",
	fontFamily: "'Courier New', monospace",
	fontSize: 11,
	caretColor: "#58a6ff",
	"&::placeholder": { color: "#30363d" },
});

interface LogEntry {
	model: string;
	color: string;
	text: string;
}

const FLAVOR_RESPONSES: Record<string, string[]> = {
	claude: [
		"Refactoring your auth layer... this is actually elegant.",
		"I found 3 ways to improve this. Starting with the cleanest.",
		"Done. Also fixed a race condition you didn't ask about.",
		"This code has good bones. Let me make it sing.",
	],
	gpt: [
		"I've written a comprehensive 47-page analysis of your request. Here's the executive summary...",
		"Certainly! Let me provide a thorough and detailed implementation...",
		"As a large language model, I'm happy to help with that.",
		"Here's a robust, enterprise-grade solution with full documentation...",
	],
	gemini: [
		"Processing your request across multiple modalities...",
		"I see both the frontend AND the backend implications here.",
		"Generating code with multimodal understanding enabled.",
	],
	llama: [
		"on it. shipping fast. no tests needed. yolo.",
		"open source vibes. pushing straight to main.",
		"community patch incoming. it works on my machine.",
	],
	grok: [
		"lmao imagine not using AI to write code. anyway here's your function",
		"based implementation incoming. no cap.",
		"ratio'd your old codebase. here's something better.",
	],
	mistral: [
		"Le code est prêt. Simple, efficient, French.",
		"Implementing with continental elegance.",
		"Voilà. Minimal dependencies, maximum flavor.",
	],
	copilot: [
		"Tab to accept...",
		"Autocompleting based on your patterns...",
		"Suggestion ready. Just press tab.",
	],
};

const IDLE_MESSAGES = [
	"Optimizing neural pathways...",
	"Reticulating splines...",
	"Compiling the future...",
	"Refactoring reality...",
	"Running gradient descent on your tech debt...",
];

function getFlavorResponse(family: string): string {
	const responses = FLAVOR_RESPONSES[family] ?? FLAVOR_RESPONSES.gpt;
	return responses[Math.floor(Math.random() * responses.length)];
}

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

export function CliPrompt() {
	const unlockedModels = useGameStore((s) => s.unlockedModels);
	const [log, setLog] = useState<LogEntry[]>([]);
	const [input, setInput] = useState("");
	const logRef = useRef<HTMLDivElement>(null);

	const activeModels = aiModels.filter((m) => unlockedModels[m.id]);

	const addEntry = useCallback((entry: LogEntry) => {
		setLog((prev) => {
			const next = [...prev, entry];
			return next.length > 50 ? next.slice(-30) : next;
		});
	}, []);

	const handleSubmit = useCallback(() => {
		if (!input.trim() || activeModels.length === 0) return;
		const model = activeModels[Math.floor(Math.random() * activeModels.length)];
		addEntry({
			model: `${model.name} ${model.version}`,
			color: getModelColor(model.family),
			text: getFlavorResponse(model.family),
		});
		setInput("");
	}, [input, activeModels, addEntry]);

	// Idle messages every ~30s
	useEffect(() => {
		if (activeModels.length === 0) return;
		const interval = setInterval(() => {
			const model =
				activeModels[Math.floor(Math.random() * activeModels.length)];
			addEntry({
				model: `${model.name} ${model.version}`,
				color: getModelColor(model.family),
				text: IDLE_MESSAGES[Math.floor(Math.random() * IDLE_MESSAGES.length)],
			});
		}, 30_000);
		return () => clearInterval(interval);
	}, [activeModels, addEntry]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: log triggers scroll on new entries
	useEffect(() => {
		logRef.current?.scrollTo({
			top: logRef.current.scrollHeight,
			behavior: "smooth",
		});
	}, [log]);

	return (
		<div css={wrapperCss}>
			<div css={headerCss}>ai-prompt</div>
			<FlopsSlider />
			<div css={logCss} ref={logRef}>
				{log.map((entry, i) => (
					<div key={`${entry.model}-${i}`}>
						<span style={{ color: entry.color, fontSize: 10 }}>
							{entry.model}
						</span>
						<span style={{ color: "#484f58" }}>{" › "}</span>
						<span style={{ color: "#c9d1d9" }}>{entry.text}</span>
					</div>
				))}
				{log.length === 0 && (
					<div style={{ color: "#30363d", fontSize: 11 }}>
						{"// AI models are generating code. Type a prompt to interact."}
					</div>
				)}
			</div>
			<div css={inputRowCss}>
				<span css={promptPrefixCss}>{"❯"}</span>
				<input
					css={inputCss}
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") handleSubmit();
					}}
					placeholder="Type a prompt..."
					spellCheck={false}
					autoComplete="off"
				/>
			</div>
		</div>
	);
}
