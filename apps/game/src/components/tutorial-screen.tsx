import { css, keyframes } from "@emotion/react";
import { useGameStore, useUiStore } from "@modules/game";
import { useCallback, useEffect, useRef } from "react";
import { useIdeTheme } from "../hooks/use-ide-theme";

// ── Tip definitions ──

interface TipDef {
	id: string;
	title: string;
	lines: string[];
	duration: number; // auto-dismiss in seconds
}

const tips: TipDef[] = [
	{
		id: "welcome",
		title: "Start typing.",
		duration: 8,
		lines: [
			"You're in a garage with a laptop.",
			"Mash your keyboard to write code.",
			"Every keystroke produces Lines of Code.",
		],
	},
	{
		id: "tech_tree_intro",
		title: "The Tech Tree",
		duration: 10,
		lines: [
			"The tech tree just opened on the right →",
			"Research upgrades to boost your output.",
			"Passive upgrades, hardware, and new hires live here.",
		],
	},
	{
		id: "sidebar_intro",
		title: "The Shop",
		duration: 12,
		lines: [
			"← The sidebar just unlocked.",
			"Browse upgrades organized by tier.",
			"Buy hardware for more FLOPS, hire devs for more LoC.",
			"The faster cash flows, the bigger upgrades you can afford.",
		],
	},
	{
		id: "execution_intro",
		title: "Execution",
		duration: 12,
		lines: [
			"Your code piles up in a queue as you type.",
			"FLOPS execute queued LoC — each executed line earns cash.",
			"",
			"  type → LoC queue → FLOPS execute → $$$",
			"",
			"The stats panel on the right shows your production in real-time.",
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

// ── Watcher hook ──

export function useTutorialTriggers() {
	const cooldownRef = useRef(false);

	useEffect(() => {
		const unsubUi = useUiStore.subscribe((cur, prev) => {
			if (prev.activeTip !== null && cur.activeTip === null) {
				cooldownRef.current = true;
				setTimeout(() => {
					cooldownRef.current = false;
				}, 3000);
			}
		});

		const unsub = useGameStore.subscribe((state) => {
			if (cooldownRef.current) return;
			const uiState = useUiStore.getState();
			if (uiState.activeTip !== null) return;
			for (const trigger of triggers) {
				if (uiState.seenTips.includes(trigger.id)) continue;
				if (trigger.test(state)) {
					uiState.showTip(trigger.id);
					// Auto-open split when tech tree tip triggers
					if (trigger.id === "tech_tree_intro" && !uiState.splitEnabled) {
						uiState.toggleSplit();
					}
					break;
				}
			}
		});

		// Initial check for welcome
		const { seenTips, activeTip, showTip } = useUiStore.getState();
		if (!seenTips.includes("welcome") && activeTip === null) {
			showTip("welcome");
		}

		return () => {
			unsub();
			unsubUi();
		};
	}, []);
}

// ── Countdown button animation ──

function countdownBorder(duration: number, color: string) {
	const anim = keyframes({
		from: {
			backgroundSize: "100% 2px, 2px 100%, 100% 2px, 2px 100%",
		},
		to: {
			backgroundSize: "0% 2px, 2px 0%, 0% 2px, 2px 0%",
		},
	});

	return css({
		position: "relative",
		fontSize: 12,
		padding: "5px 16px",
		borderRadius: 3,
		cursor: "pointer",
		fontFamily: "inherit",
		transition: "background 0.15s, color 0.15s",
		border: "1px solid transparent",
		background: "transparent",
		// Animated border using gradients
		backgroundImage: `
			linear-gradient(${color}, ${color}),
			linear-gradient(${color}, ${color}),
			linear-gradient(${color}, ${color}),
			linear-gradient(${color}, ${color})
		`,
		backgroundPosition: "top left, top right, bottom right, bottom left",
		backgroundRepeat: "no-repeat",
		backgroundSize: "100% 2px, 2px 100%, 100% 2px, 2px 100%",
		animation: `${anim} ${duration}s linear forwards`,
	});
}

// ── Styles ──

const panelCss = css({
	display: "flex",
	flexDirection: "column",
	flexShrink: 0,
	overflow: "hidden",
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

const contentCss = css({
	padding: "10px 16px",
	fontSize: 13,
	lineHeight: 1.7,
});

// ── Component ──

export function TutorialTip() {
	const activeTip = useUiStore((s) => s.activeTip);
	const dismiss = useUiStore((s) => s.dismissTip);
	const theme = useIdeTheme();
	const tip = activeTip ? tipMap.get(activeTip) : null;
	const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	const handleDismiss = useCallback(() => {
		if (timerRef.current) clearTimeout(timerRef.current);
		dismiss();
	}, [dismiss]);

	// Auto-dismiss timer
	useEffect(() => {
		if (!tip) return;
		timerRef.current = setTimeout(() => {
			dismiss();
		}, tip.duration * 1000);
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, [tip, dismiss]);

	// Dismiss on Escape
	useEffect(() => {
		if (!activeTip) return;
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				e.preventDefault();
				handleDismiss();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [activeTip, handleDismiss]);

	if (!tip) return null;

	const btnCss = countdownBorder(tip.duration, theme.success);

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
						color: theme.success,
						borderBottom: `1px solid ${theme.success}`,
					}}
				>
					Tutorial
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
					onClick={handleDismiss}
					title="Dismiss"
				>
					×
				</button>
			</div>
			<div
				css={contentCss}
				style={{ background: theme.panelBg, color: theme.foreground }}
			>
				<div
					css={{
						fontSize: 14,
						fontWeight: 600,
						color: theme.success,
						marginBottom: 6,
					}}
				>
					{tip.title}
				</div>
				{tip.lines.map((line, i) => (
					<div
						key={i}
						style={{
							color: line.startsWith("  ") ? theme.foreground : theme.textMuted,
						}}
					>
						{line || "\u00A0"}
					</div>
				))}
				<div
					css={{
						marginTop: 10,
						display: "flex",
						justifyContent: "flex-end",
					}}
				>
					<button
						type="button"
						css={btnCss}
						style={{ color: theme.success }}
						onClick={handleDismiss}
						onMouseEnter={(e) => {
							e.currentTarget.style.background = theme.success;
							e.currentTarget.style.color = theme.background;
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.background = "transparent";
							e.currentTarget.style.color = theme.success;
						}}
					>
						got it
					</button>
				</div>
			</div>
		</div>
	);
}
