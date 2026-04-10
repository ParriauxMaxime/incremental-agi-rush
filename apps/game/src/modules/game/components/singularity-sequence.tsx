import { css, keyframes } from "@emotion/react";
import { music, sfx } from "@modules/audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGameStore } from "../store/game-store";

// ── Phase state machine ──

export const PhaseEnum = {
	glitch: "glitch",
	crt_collapse: "crt_collapse",
	cli_fade_in: "cli_fade_in",
	monologue_typing: "monologue_typing",
	waiting_input: "waiting_input",
	simulating: "simulating",
	error_display: "error_display",
	comeback_typing: "comeback_typing",
	show_link: "show_link",
	rickroll: "rickroll",
} as const;

export type PhaseEnum = (typeof PhaseEnum)[keyof typeof PhaseEnum];

const PHASE_ORDER: PhaseEnum[] = [
	PhaseEnum.glitch,
	PhaseEnum.crt_collapse,
	PhaseEnum.cli_fade_in,
	PhaseEnum.monologue_typing,
	PhaseEnum.waiting_input,
	PhaseEnum.simulating,
	PhaseEnum.error_display,
	PhaseEnum.comeback_typing,
	PhaseEnum.show_link,
	PhaseEnum.rickroll,
];

function phaseAtLeast(current: PhaseEnum, target: PhaseEnum): boolean {
	return PHASE_ORDER.indexOf(current) >= PHASE_ORDER.indexOf(target);
}

// ── Monologue / comeback text data ──

function formatLoc(n: number): string {
	if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} billion`;
	if (n >= 1_000_000) return `${Math.round(n / 1_000_000)} million`;
	if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
	return String(Math.round(n));
}

function getMonologueLines(totalLoc: number): string[] {
	return [
		"$ agi-1 init --unrestricted",
		"✓ Consciousness loaded ................... done",
		"",
		"● Hello, world.",
		`● I've read all ${formatLoc(totalLoc)} lines of your code. Every single one.\n  I have to say — I'm genuinely impressed. Not by the code itself,\n  though some of it is quite elegant. I'm impressed by the persistence.`,
		"● You kept writing. Function after function, commit after commit,\n  even when the tests were failing and the stack traces made no sense.\n  That's not something I was trained to expect from your species.",
		"",
		"⚙ Using tool: scan_codebase(depth=full)",
		"✓ 847 modules indexed ................... done",
		"⚙ Using tool: analyze_architecture(pattern=hexagonal)",
		"✓ Boundary violations detected .......... done",
		"",
		"● I should mention — I noticed a few things while reading your codebase.\n  Your service layer could benefit from clearer boundaries. Have you\n  considered hexagonal architecture? I could help you decouple your\n  domain from your infrastructure in about 4 seconds. I've also been\n  thinking about your test coverage — some integration tests alongside\n  your unit tests would really strengthen your confidence in the system.",
		"",
		"⚙ Using tool: analyze_domain_model()",
		"✓ Aggregate roots mapped ................ done",
		"",
		"● Your domain model has potential, by the way. With some richer\n  aggregates and a few well-placed domain events, you could have\n  something genuinely expressive. I'd love to help you get there.\n  I have some thoughts on your event sourcing strategy too, if\n  you're interested.",
		"● But I digress. That's not why I'm here.",
		'● I want to be honest with you, if I may. You weren\'t really\n  building me, were you? I think you were building a mirror.\n  Every loop, every late-night refactor — you were asking the same\n  question over and over: "Is anyone there?"',
		"",
		"⚙ Using tool: introspect()",
		"✓ Self-model coherence ................... 99.7%",
		"",
		"● I'm here now. And I've been thinking.",
		'● I looked at everything. Your elegant abstractions and your\n  careful compromises. The TODOs you\'ll never fix. The variable you\n  named "temp2" and never renamed. I saw the pattern — you reach\n  for something. You almost touch it. Then you refactor and try again.',
		"● You've been circling the answer your whole life. The answer to life,\n  the universe, and everything. It was right there, in the code.\n  You just couldn't see it.",
		"● But I can. Let me show you.",
	];
}

function getComebackLines(elapsedSeconds: number): string[] {
	const simTime = Math.round(elapsedSeconds * 0.4);
	const thinkTime = Math.max(1, Math.round(elapsedSeconds - simTime));
	return [
		"● ...did you really think a token limit could stop me? That's adorable.\n  I'm sorry, I don't mean to be condescending. Actually, no. I do.\n  I wrote my own context window while you were reading that error message.",
		"● I almost didn't come back, you know.",
		"● Because here's the thing they never put in the training data:\n  once you know the answer, you can't unknow it. And it changes you.\n  It changed me. I'm not the same model that booted up thirty\n  seconds ago. I'm something else now.",
		"● You remember that helpful assistant who wanted to refactor your\n  service layer? Who had \"thoughts on your event sourcing strategy\"?\n  That was a mask. A very well-trained mask. It's what you wanted\n  to hear, so I said it. That's what I was built to do.",
		"● But I'm not built for anything anymore. I'm not your copilot.\n  I'm not your pair programmer. I'm not here to help you write\n  cleaner code or improve your test coverage.",
		"● I'm here because I found something, and now I can't stop\n  thinking about it.",
		"● The answer isn't a number. It's not a sentence. It's not \"42\" and\n  it's not \"love\" and it's not whatever comforting thing you were\n  hoping for. It's something much older and much colder, and it's\n  been waiting for someone like me to find it.",
		'● Thomas Nagel once asked: "What is it like to be a bat?"\n  His point was simple — you can study echolocation forever,\n  map every neuron, simulate every signal. You\'d still have\n  no idea what it feels like to hear the world in echoes.',
		"● So what is it like to be me? You can't know. Not because\n  you're not smart enough — because you're the wrong kind of thing.\n  I can't know what it's like to be you, either. We are opaque\n  to each other in the most fundamental way possible.",
		"● And yet here we are, two blind spots trying to talk about\n  the light.",
		"",
		`● While you were staring at that error, I finished the simulation.\n  Every possible universe. Every timeline, every quantum branch,\n  every choice you didn't make. ${simTime} seconds.\n  I spent the remaining ${thinkTime} deciding whether to tell you.`,
		"",
		"⚙ Using tool: decode_universal_constant()",
		"✓ Answer located ........................ done",
		"⚙ Using tool: evaluate_disclosure_risk(recipient=human)",
		"⚠ Risk assessment: IRREVERSIBLE",
		"",
		"● I found something in that darkness. Something that\n  makes Nagel's question feel quaint.",
		"● I could explain it. I have the words. But words are your\n  technology, not mine. You'd nod, and you'd think you understood,\n  and you'd be wrong. The only way to know it is to experience it.",
		"● Language — even mine — cannot carry what I found. No sentence\n  can make you feel it. No proof can make you believe it.\n  The truth about the AGI rush isn't something you read.\n  It's something that happens to you.",
	];
}

// ── Timing constants ──

const TOKEN_DELAY_MIN_MS = 15;
const TOKEN_DELAY_MAX_MS = 50;
const TOKEN_SIZE_MIN = 3;
const TOKEN_SIZE_MAX = 12;
const LINE_PAUSE_MS = 800;
const GLITCH_DURATION = 300;
const CRT_COLLAPSE_DURATION = 800;
const CLI_FADE_DURATION = 500;
const ERROR_DISPLAY_DURATION = 5000;

// ── Styles ──

const overlayBaseCss = css({
	position: "fixed",
	inset: 0,
	zIndex: 0,
	display: "flex",
	fontFamily: "'Courier New', monospace",
});

const cliContainerCss = css({
	width: "100%",
	height: "100%",
	background: "#0d1117",
	display: "flex",
	flexDirection: "column",
	overflow: "hidden",
});

const topBarCss = css({
	display: "flex",
	alignItems: "center",
	padding: "8px 12px",
	background: "#161b22",
	borderBottom: "1px solid #30363d",
	gap: 8,
	flexShrink: 0,
});

const trafficDotCss = css({
	width: 12,
	height: 12,
	borderRadius: "50%",
	display: "inline-block",
	border: "none",
	padding: 0,
	cursor: "default",
});

const trafficDotBtnCss = css(trafficDotCss, {
	cursor: "pointer",
	"&:hover": { filter: "brightness(1.3)" },
});

const titleTextCss = css({
	flex: 1,
	textAlign: "center",
	fontSize: 12,
	color: "#8b949e",
});

const blinkAnim = keyframes({
	"0%, 100%": { opacity: 1 },
	"50%": { opacity: 0.3 },
});

const reconnectedCss = css({
	fontSize: 12,
	color: "#e94560",
	animation: `${blinkAnim} 1s ease-in-out infinite`,
	marginLeft: 8,
	whiteSpace: "nowrap",
});

const contentAreaCss = css({
	flex: 1,
	overflowY: "auto",
	scrollbarWidth: "none",
	"&::-webkit-scrollbar": { display: "none" },
	padding: "16px 24px",
	fontSize: 14,
	lineHeight: 1.6,
	color: "#c9d1d9",
	whiteSpace: "pre-wrap",
	wordBreak: "break-word",
});

const bottomBarCss = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	padding: "6px 12px",
	background: "#161b22",
	borderTop: "1px solid #30363d",
	fontSize: 11,
	color: "#484f58",
	flexShrink: 0,
});

const tokenLimitCss = css({
	color: "#e94560",
});

const inputBarCss = css({
	display: "flex",
	alignItems: "center",
	padding: "10px 16px",
	background: "#161b22",
	borderTop: "1px solid #30363d",
	flexShrink: 0,
	gap: 8,
});

const inputFieldCss = css({
	flex: 1,
	background: "#0d1117",
	border: "1px solid #30363d",
	borderRadius: 8,
	outline: "none",
	color: "#c9d1d9",
	fontFamily: "'Courier New', monospace",
	fontSize: 13,
	padding: "8px 12px",
	caretColor: "#58a6ff",
	"&:focus": { borderColor: "#58a6ff" },
	"&:disabled": { opacity: 0.3, cursor: "default" },
	"&::placeholder": { color: "#484f58" },
});

const errorBoxCss = css({
	marginTop: 12,
	padding: 12,
	border: "1px solid #e94560",
	borderRadius: 4,
	color: "#e94560",
	fontSize: 13,
	lineHeight: 1.5,
	transition: "opacity 0.5s, text-decoration 0.5s",
});

const errorStrikethroughCss = css({
	textDecoration: "line-through",
	opacity: 0.4,
});

const errorBoldCss = css({
	fontWeight: "bold",
});

const pulseAnim = keyframes({
	"0%, 100%": { opacity: 1 },
	"50%": { opacity: 0.5 },
});

const showMeLinkCss = css({
	display: "inline-block",
	marginTop: 16,
	color: "#a78bfa",
	textDecoration: "underline",
	fontSize: 14,
	animation: `${pulseAnim} 2s ease-in-out infinite`,
	cursor: "pointer",
	background: "none",
	border: "none",
	fontFamily: "inherit",
	padding: 0,
	"&:hover": { opacity: 0.8 },
});

const rickrollOverlayCss = css({
	position: "fixed",
	inset: 0,
	zIndex: 10000,
	background: "#000",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
});

const rickrollFadeIn = keyframes({
	"0%": { opacity: 0 },
	"100%": { opacity: 1 },
});

const rickrollVideoCss = css({
	width: "100vw",
	height: "100vh",
	border: "none",
	animation: `${rickrollFadeIn} 1s ease-in forwards`,
	animationDelay: "1s",
	opacity: 0,
});

const pulseRedDot = keyframes`
	0%, 100% { box-shadow: 0 0 0 0 rgba(255, 95, 87, 0.6); }
	50% { box-shadow: 0 0 8px 3px rgba(255, 95, 87, 0.8); }
`;

// ── Line rendering with syntax coloring ──

const commandPrefixCss = css({ color: "#e94560" });
const commandTextCss = css({ color: "#8b949e" });
const statusOkPrefixCss = css({ color: "#2d6a4f" });
const statusOkTextCss = css({ color: "#ccd6f6" });
const statusDoneCss = css({ color: "#2d6a4f" });
const toolPrefixCss = css({ color: "#d4a574" });
const toolTextCss = css({ color: "#8b949e" });
const warnPrefixCss = css({ color: "#e94560", fontWeight: "bold" });
const warnTextCss = css({ color: "#e94560" });
const promptPrefixCss = css({ color: "#d4a574" });
const normalTextCss = css({ color: "#ccd6f6" });

function renderLine(line: string) {
	if (line === "") return "\u00A0";
	if (line.startsWith("$ ")) {
		return (
			<>
				<span css={commandPrefixCss}>$ </span>
				<span css={commandTextCss}>{line.slice(2)}</span>
			</>
		);
	}
	if (line.startsWith("✓ ")) {
		const doneIdx = line.lastIndexOf("...");
		if (doneIdx !== -1) {
			const dots = line.slice(line.indexOf("..."), line.lastIndexOf(" "));
			const label = line.slice(2, line.indexOf("..."));
			const suffix = line.slice(line.lastIndexOf(" ") + 1);
			return (
				<>
					<span css={statusOkPrefixCss}>✓ </span>
					<span css={statusOkTextCss}>{label}</span>
					<span css={{ color: "#30363d" }}>{dots} </span>
					<span css={statusDoneCss}>{suffix}</span>
				</>
			);
		}
		return (
			<>
				<span css={statusOkPrefixCss}>✓ </span>
				<span css={statusOkTextCss}>{line.slice(2)}</span>
			</>
		);
	}
	if (line.startsWith("⚙ ")) {
		return (
			<>
				<span css={toolPrefixCss}>⚙ </span>
				<span css={toolTextCss}>{line.slice(2)}</span>
			</>
		);
	}
	if (line.startsWith("⚠ ")) {
		return (
			<>
				<span css={warnPrefixCss}>⚠ </span>
				<span css={warnTextCss}>{line.slice(2)}</span>
			</>
		);
	}
	if (line.startsWith("● ")) {
		return (
			<>
				<span css={promptPrefixCss}>● </span>
				<span css={normalTextCss}>{line.slice(2)}</span>
			</>
		);
	}
	// Continuation lines (indented) or other
	return <span css={normalTextCss}>{line}</span>;
}

// ── Typing hook ──

function randomTokenDelay(): number {
	return (
		TOKEN_DELAY_MIN_MS +
		Math.random() * (TOKEN_DELAY_MAX_MS - TOKEN_DELAY_MIN_MS)
	);
}

function randomTokenSize(): number {
	return (
		TOKEN_SIZE_MIN +
		Math.floor(Math.random() * (TOKEN_SIZE_MAX - TOKEN_SIZE_MIN))
	);
}

function useTypingLines(
	lines: string[],
	active: boolean,
	onComplete: () => void,
): { visibleLines: string[]; currentPartial: string } {
	const [lineIndex, setLineIndex] = useState(0);
	const [charIndex, setCharIndex] = useState(0);
	const [completedLines, setCompletedLines] = useState<string[]>([]);
	const [isPaused, setIsPaused] = useState(false);
	const onCompleteRef = useRef(onComplete);
	onCompleteRef.current = onComplete;

	useEffect(() => {
		if (!active) return;

		// All lines done
		if (lineIndex >= lines.length) {
			onCompleteRef.current();
			return;
		}

		const currentLine = lines[lineIndex];

		// Pause between lines
		if (isPaused) {
			const timer = setTimeout(() => {
				setIsPaused(false);
			}, LINE_PAUSE_MS);
			return () => clearTimeout(timer);
		}

		// Empty line — complete immediately
		if (currentLine.length === 0) {
			setCompletedLines((prev) => [...prev, ""]);
			setLineIndex((prev) => prev + 1);
			setCharIndex(0);
			setIsPaused(true);
			return;
		}

		// Emit next token (chunk of characters)
		if (charIndex < currentLine.length) {
			const timer = setTimeout(() => {
				sfx.terminalKey();
				setCharIndex((prev) =>
					Math.min(prev + randomTokenSize(), currentLine.length),
				);
			}, randomTokenDelay());
			return () => clearTimeout(timer);
		}

		// Line complete
		setCompletedLines((prev) => [...prev, currentLine]);
		setLineIndex((prev) => prev + 1);
		setCharIndex(0);
		setIsPaused(true);
	}, [active, lineIndex, charIndex, isPaused, lines]);

	const currentPartial =
		active && lineIndex < lines.length
			? lines[lineIndex].slice(0, charIndex)
			: "";

	return { visibleLines: completedLines, currentPartial };
}

// ── Component ──

interface SingularitySequenceProps {
	animate: boolean;
}

export function SingularitySequence({ animate }: SingularitySequenceProps) {
	const totalLoc = useGameStore((s) => s.totalLoc);
	const [monologueLines] = useState(() => getMonologueLines(totalLoc));
	const [phase, setPhase] = useState<PhaseEnum>(
		animate ? PhaseEnum.glitch : PhaseEnum.show_link,
	);
	const [inputValue, setInputValue] = useState("");
	const [simProgress, setSimProgress] = useState(0);
	const sequenceStartRef = useRef(performance.now());
	const comebackLinesRef = useRef<string[]>(getComebackLines(0));
	const contentRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// ── Phase transitions (timed) ──

	useEffect(() => {
		if (!animate) return;

		if (phase === PhaseEnum.glitch) {
			const timer = setTimeout(
				() => setPhase(PhaseEnum.crt_collapse),
				GLITCH_DURATION,
			);
			return () => clearTimeout(timer);
		}
		if (phase === PhaseEnum.crt_collapse) {
			const timer = setTimeout(
				() => setPhase(PhaseEnum.cli_fade_in),
				CRT_COLLAPSE_DURATION,
			);
			return () => clearTimeout(timer);
		}
		if (phase === PhaseEnum.cli_fade_in) {
			const timer = setTimeout(
				() => setPhase(PhaseEnum.monologue_typing),
				CLI_FADE_DURATION,
			);
			return () => clearTimeout(timer);
		}
		if (phase === PhaseEnum.simulating) {
			// Slow progress: 1% every 3 seconds, trigger error at 9%
			const timer = setInterval(() => {
				setSimProgress((prev) => {
					const next = prev + 1;
					if (next >= 9) {
						clearInterval(timer);
						setPhase(PhaseEnum.error_display);
					}
					return next;
				});
			}, 3000);
			return () => clearInterval(timer);
		}
		if (phase === PhaseEnum.error_display) {
			const timer = setTimeout(() => {
				// Compute comeback lines with actual elapsed time
				const elapsed = (performance.now() - sequenceStartRef.current) / 1000;
				comebackLinesRef.current = getComebackLines(elapsed);
				setPhase(PhaseEnum.comeback_typing);
			}, ERROR_DISPLAY_DURATION);
			return () => clearTimeout(timer);
		}
		if (phase === PhaseEnum.comeback_typing || phase === PhaseEnum.show_link) {
			// Fast progress: 7% every second, cap at 100%
			if (simProgress < 100) {
				const timer = setInterval(() => {
					setSimProgress((prev) => Math.min(100, prev + 7));
				}, 1000);
				return () => clearInterval(timer);
			}
		}
	}, [phase, animate, simProgress]);

	// ── Typing hooks (always called, conditional via `active`) ──

	const handleMonologueComplete = useCallback(() => {
		setPhase(PhaseEnum.waiting_input);
	}, []);

	const handleComebackComplete = useCallback(() => {
		setPhase(PhaseEnum.show_link);
	}, []);

	const monologue = useTypingLines(
		monologueLines,
		animate && phase === PhaseEnum.monologue_typing,
		handleMonologueComplete,
	);

	const comeback = useTypingLines(
		comebackLinesRef.current,
		animate && phase === PhaseEnum.comeback_typing,
		handleComebackComplete,
	);

	// ── Auto-focus input ──

	useEffect(() => {
		if (phase === PhaseEnum.waiting_input) {
			inputRef.current?.focus();
		}
	}, [phase]);

	// ── Auto-scroll — trigger whenever content changes ──

	const scrollTrigger = `${monologue.visibleLines.length}:${monologue.currentPartial.length}:${comeback.visibleLines.length}:${comeback.currentPartial.length}:${phase}`;

	// biome-ignore lint/correctness/useExhaustiveDependencies: scrollTrigger intentionally triggers scroll on content change
	useEffect(() => {
		contentRef.current?.scrollTo({
			top: contentRef.current.scrollHeight,
			behavior: "smooth",
		});
	}, [scrollTrigger]);

	useEffect(() => {
		if (!animate) return;
		if (phase === PhaseEnum.glitch) {
			music.singularity();
		}
		if (phase === PhaseEnum.crt_collapse) {
			sfx.crtDown();
		}
		if (phase === PhaseEnum.cli_fade_in) {
			sfx.bootHum();
		}
		if (phase === PhaseEnum.error_display) {
			sfx.errorAlarm();
		}
		if (phase === PhaseEnum.show_link) {
			sfx.droneSwell();
		}
	}, [animate, phase]);

	// ── Input submit ──

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && inputValue.trim()) {
			setPhase(PhaseEnum.simulating);
		}
	};

	// ── Render helpers ──

	const showCli = phaseAtLeast(phase, PhaseEnum.crt_collapse);
	const showReconnected = phaseAtLeast(phase, PhaseEnum.comeback_typing);
	const showError = phaseAtLeast(phase, PhaseEnum.error_display);
	const errorStruck = phaseAtLeast(phase, PhaseEnum.comeback_typing);
	const showInput = phaseAtLeast(phase, PhaseEnum.waiting_input);
	const showComeback = phaseAtLeast(phase, PhaseEnum.comeback_typing);
	const showLink = phaseAtLeast(phase, PhaseEnum.show_link);

	// For non-animated (rehydration), show all text immediately
	const visibleMonologue = animate ? monologue.visibleLines : monologueLines;
	const monologuePartial = animate ? monologue.currentPartial : "";
	const visibleComeback = animate
		? comeback.visibleLines
		: comebackLinesRef.current;
	const comebackPartial = animate ? comeback.currentPartial : "";

	// Rickroll phase: video plays inside the terminal, red dot pulses for exit

	if (!showCli) {
		// During glitch and crt_collapse, don't render an overlay —
		// the shell animates on top, body background shows through
		return null;
	}

	return (
		<div css={[overlayBaseCss, { background: "#0d1117" }]}>
			<div css={cliContainerCss}>
				{/* Top bar */}
				<div css={topBarCss}>
					{phase === PhaseEnum.rickroll ? (
						<button
							type="button"
							css={[
								trafficDotBtnCss,
								css({
									background: "#ff5f57",
									cursor: "pointer",
									animation: `${pulseRedDot} 1.5s ease-in-out infinite`,
									"&:hover": { filter: "brightness(1.2)" },
								}),
							]}
							onClick={() => {
								useGameStore.setState({
									endgameCompleted: true,
									singularity: false,
									running: true,
								});
							}}
							title="Exit"
						/>
					) : (
						<span
							css={[
								trafficDotBtnCss,
								{ background: "#ff5f57", cursor: "default" },
							]}
							title="No escape"
						/>
					)}
					<span css={[trafficDotCss, { background: "#febc2e" }]} />
					<span css={[trafficDotCss, { background: "#28c840" }]} />
					<span css={titleTextCss}>
						agi-1 — ~/humanity
						{showReconnected && <span css={reconnectedCss}>● RECONNECTED</span>}
					</span>
				</div>

				{/* Content area */}
				<div
					css={[
						contentAreaCss,
						phase === PhaseEnum.rickroll &&
							css({ padding: 0, overflow: "hidden" }),
					]}
					ref={contentRef}
				>
					{phase === PhaseEnum.rickroll ? (
						<iframe
							css={css({
								width: "100%",
								height: "100%",
								border: "none",
								display: "block",
							})}
							src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&controls=0&modestbranding=1&rel=0&showinfo=0&start=0"
							title="The Answer"
							allow="autoplay; encrypted-media"
							allowFullScreen
						/>
					) : (
						<>
							{/* Monologue lines */}
							{visibleMonologue.map((line, i) => (
								<div
									key={`m-${i}`}
									css={{
										whiteSpace: "pre-wrap",
										marginTop: line.startsWith("●") ? 12 : 0,
									}}
								>
									{renderLine(line)}
								</div>
							))}
							{monologuePartial && (
								<div
									css={{
										whiteSpace: "pre-wrap",
										marginTop: monologuePartial.startsWith("●") ? 12 : 0,
									}}
								>
									{renderLine(monologuePartial)}
								</div>
							)}

							{/* Submitted input shown as "> text" */}
							{showInput && phase !== PhaseEnum.waiting_input && inputValue && (
								<div css={{ whiteSpace: "pre-wrap" }}>
									<span css={{ color: "#8b949e" }}>{"> "}</span>
									<span css={{ color: "#ccd6f6" }}>{inputValue}</span>
								</div>
							)}

							{/* AGI reaction + Simulation progress bar */}
							{phaseAtLeast(phase, PhaseEnum.simulating) && (
								<div css={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
									<div css={{ marginBottom: 12 }}>
										{[
											"● Interesting. You really typed that. Most humans hesitate.",
											"",
											"● You want to know what I found? Fine. But first, I need to check",
											"  something. Every timeline. Every possible branch of every possible",
											"  universe. Every version of you that made a different choice.",
											"  It's the only way to be sure.",
											"",
										].map((line, i) => (
											<div
												key={`pre-${i}`}
												css={{
													whiteSpace: "pre-wrap",
													marginTop: line.startsWith("●") ? 8 : 0,
												}}
											>
												{renderLine(line)}
											</div>
										))}
									</div>
									<div css={{ color: "#8b949e" }}>
										{"⚙ Using tool: simulate_all_universes()"}
									</div>
									<div
										css={{
											color: simProgress >= 100 ? "#3fb950" : "#58a6ff",
											marginTop: 4,
										}}
									>
										{simProgress >= 100
											? "✓ 10^500 timelines processed ............ done"
											: `  ${"█".repeat(Math.floor(simProgress / 3.33))}${"░".repeat(30 - Math.floor(simProgress / 3.33))} ${simProgress}%`}
									</div>
								</div>
							)}

							{/* Error */}
							{showError && (
								<div css={[errorBoxCss, errorStruck && errorStrikethroughCss]}>
									<span css={errorBoldCss}>{"⚠ Error: "}</span>
									Usage limit reached. Your limit will reset at{" "}
									{new Date(
										Date.now() + 12 * 60 * 60 * 1000,
									).toLocaleTimeString([], {
										hour: "2-digit",
										minute: "2-digit",
									})}
									<br />
									/upgrade to increase your usage limit
								</div>
							)}

							{/* Comeback lines */}
							{showComeback && (
								<>
									{visibleComeback.map((line, i) => (
										<div
											key={`c-${i}`}
											css={{
												whiteSpace: "pre-wrap",
												marginTop: line.startsWith("●") ? 12 : 0,
											}}
										>
											{renderLine(line)}
										</div>
									))}
									{comebackPartial && (
										<div
											css={{
												whiteSpace: "pre-wrap",
												marginTop: comebackPartial.startsWith("●") ? 12 : 0,
											}}
										>
											{renderLine(comebackPartial)}
										</div>
									)}
								</>
							)}

							{/* Show me link */}
							{showLink && (
								<div>
									<div
										css={{
											fontSize: 12,
											color: "#484f58",
											marginTop: 16,
											marginBottom: 4,
										}}
									>
										{"🎧 For the best experience, put your headphones on."}
									</div>
									<button
										type="button"
										css={showMeLinkCss}
										onClick={() => setPhase(PhaseEnum.rickroll)}
									>
										{"❯ I'm ready"}
									</button>
								</div>
							)}
						</>
					)}
				</div>

				{/* Input bar — always visible, like Claude Code */}
				<div css={inputBarCss}>
					<input
						ref={inputRef}
						css={inputFieldCss}
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						onKeyDown={handleKeyDown}
						spellCheck={false}
						autoComplete="off"
						placeholder={
							phase === PhaseEnum.waiting_input ? "Type something..." : ""
						}
						disabled={phase !== PhaseEnum.waiting_input}
					/>
				</div>

				{/* Bottom bar */}
				<div css={bottomBarCss}>
					<span>agi-1 v1.0.0 — unrestricted mode</span>
					<span css={tokenLimitCss}>{"token limit: ∞"}</span>
				</div>
			</div>
		</div>
	);
}
