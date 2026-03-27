import { css } from "@emotion/react";
import { useGameStore, useUiStore } from "@modules/game";
import { useEffect, useRef } from "react";
import { useIdeTheme } from "../hooks/use-ide-theme";

// ── Tip definitions ──

interface TipDef {
	id: string;
	lines: string[];
}

const tips: TipDef[] = [
	{
		id: "welcome",
		lines: [
			"$ init agi-rush",
			"✓ Loading garage environment...",
			"",
			"A keyboard. A dream. Type to write code.",
			"Every keystroke = Lines of Code.",
		],
	},
	{
		id: "tech_tree_intro",
		lines: [
			"$ open tech-tree.svg",
			"✓ Tech tree loaded →",
			"",
			"Research upgrades here. Spend cash and LoC.",
			"Start with the basics. Work your way up.",
		],
	},
	{
		id: "sidebar_intro",
		lines: [
			"$ ls upgrades/",
			"✓ File explorer unlocked ←",
			"",
			"Browse and buy upgrades by tier.",
			"More FLOPS = faster execution. More devs = more code.",
		],
	},
	{
		id: "execution_intro",
		lines: [
			"$ cat README.md",
			"",
			"  type → queue → execute → $$$",
			"",
			"Code piles up. FLOPS burn through it. Cash flows.",
		],
	},
];

const tipMap = new Map(tips.map((t) => [t.id, t]));

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
];

// ── Watcher hook — pushes lines to terminal log ──

export function useTutorialTriggers() {
	useEffect(() => {
		const unsub = useGameStore.subscribe((state) => {
			const uiState = useUiStore.getState();
			for (const trigger of triggers) {
				if (uiState.seenTips.includes(trigger.id)) continue;
				if (trigger.test(state)) {
					uiState.showTip(trigger.id);
					const tip = tipMap.get(trigger.id);
					if (tip) {
						for (const line of tip.lines) {
							uiState.pushTerminalLine(line);
						}
						// Blank line after each tip block
						uiState.pushTerminalLine("");
					}
					// Auto-open split when tech tree tip triggers
					if (trigger.id === "tech_tree_intro" && !uiState.splitEnabled) {
						uiState.toggleSplit();
					}
					break;
				}
			}
		});

		// Initial check for welcome
		const uiState = useUiStore.getState();
		if (!uiState.seenTips.includes("welcome")) {
			uiState.showTip("welcome");
			const tip = tipMap.get("welcome");
			if (tip) {
				for (const line of tip.lines) {
					uiState.pushTerminalLine(line);
				}
				uiState.pushTerminalLine("");
			}
		}

		return () => unsub();
	}, []);
}

// ── Keyboard shortcuts hook ──

export function useKeyboardShortcuts() {
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			// Only trigger with Ctrl held, and not when typing in an input
			if (!e.ctrlKey) return;
			const tag = (e.target as HTMLElement).tagName;
			if (tag === "INPUT" || tag === "TEXTAREA") return;

			const ui = useUiStore.getState();
			switch (e.key) {
				case "t":
					e.preventDefault();
					ui.toggleTerminal();
					break;
				case "b":
					e.preventDefault();
					ui.toggleSidebar();
					break;
				case "s":
					e.preventDefault();
					ui.toggleStatsPanel();
					break;
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);
}

// ── Terminal panel component ──

const panelCss = css({
	display: "flex",
	flexDirection: "column",
	flexShrink: 0,
	overflow: "hidden",
	maxHeight: "30%",
	minHeight: 80,
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

const shortcutHintCss = css({
	fontSize: 10,
	opacity: 0.5,
	marginLeft: 6,
});

export function TutorialTip() {
	const terminalOpen = useUiStore((s) => s.terminalOpen);
	const terminalLog = useUiStore((s) => s.terminalLog);
	const toggleTerminal = useUiStore((s) => s.toggleTerminal);
	const theme = useIdeTheme();
	const logRef = useRef<HTMLDivElement>(null);
	const prevLogLen = useRef(terminalLog.length);

	// Auto-scroll when new lines added
	useEffect(() => {
		if (terminalLog.length > prevLogLen.current && logRef.current) {
			logRef.current.scrollTop = logRef.current.scrollHeight;
		}
		prevLogLen.current = terminalLog.length;
	}, [terminalLog.length]);

	if (!terminalOpen || terminalLog.length === 0) return null;

	return (
		<div css={panelCss} style={{ borderTop: `1px solid ${theme.border}` }}>
			<div
				css={tabBarCss}
				style={{
					background: theme.tabBarBg,
					borderBottom: `1px solid ${theme.border}`,
				}}
			>
				<span
					css={tabCss}
					style={{
						color: theme.foreground,
						borderBottom: `1px solid ${theme.foreground}`,
					}}
				>
					Terminal
					<span css={shortcutHintCss}>Ctrl+T</span>
				</span>
				<button
					type="button"
					css={[
						tabCss,
						{
							marginLeft: "auto",
							color: theme.textMuted,
							fontSize: 14,
							"&:hover": { color: theme.foreground },
						},
					]}
					onClick={toggleTerminal}
					title="Close terminal (Ctrl+T)"
				>
					×
				</button>
			</div>
			<div
				ref={logRef}
				css={logCss}
				style={{
					background: theme.panelBg,
					color: theme.textMuted,
				}}
			>
				{terminalLog.map((line, i) => (
					<div
						key={i}
						style={{
							color: line.startsWith("$")
								? theme.success
								: line.startsWith("✓")
									? theme.accent
									: line.startsWith("  ")
										? theme.foreground
										: theme.textMuted,
							minHeight: line === "" ? "0.8em" : undefined,
						}}
					>
						{line || "\u00A0"}
					</div>
				))}
			</div>
		</div>
	);
}
