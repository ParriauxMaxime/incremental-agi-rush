import { css, keyframes } from "@emotion/react";
import { useGameStore, useUiStore } from "@modules/game";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

// ── Tip definitions ──

interface TipDef {
	id: string;
	anchor: string | null;
	title: string;
	lines: string[];
	placement?: "bottom" | "left" | "right" | "top";
}

const tips: TipDef[] = [
	{
		id: "welcome",
		anchor: null,
		title: "Start typing.",
		lines: [
			"You're in a garage with a laptop.",
			"Mash your keyboard to write code.",
			"",
			"Every keystroke produces Lines of Code.",
		],
	},
	{
		id: "loc_explain",
		anchor: null,
		title: "Lines of Code",
		lines: [
			"This counter tracks your LoC.",
			"Code piles up in a queue, waiting to be executed.",
			"",
			"It's raw material. Worthless until processed.",
		],
	},
	{
		id: "execute_explain",
		anchor: null,
		title: "Execute!",
		lines: [
			"Hit this button to run your code.",
			"Each click uses your FLOPS to execute LoC.",
			"",
			"  1 FLOP = 1 line executed",
			"  Each executed line = cash",
			"",
			"Type code, then execute it. That's the loop.",
		],
	},
	{
		id: "cash_explain",
		anchor: null,
		title: "Cash",
		lines: [
			"Money flows when you execute code.",
			"",
			"  type --> LoC --> execute --> $$$",
			"",
			"Spend cash on upgrades and research.",
		],
	},
	{
		id: "shop_explain",
		anchor: null,
		title: "The Shop",
		lines: [
			"Spend cash on upgrades.",
			"",
			"Buy hardware for more FLOPS.",
			"Buy keyboard upgrades for more LoC per key.",
			"",
			"The faster cash flows,",
			"the bigger upgrades you can afford.",
		],
	},
	{
		id: "tier_freelancing",
		anchor: null,
		title: "$ echo 'Level up!'",
		lines: [
			"Welcome to Freelancing!",
			"",
			"Clients now pay $0.25 per line (was $0.10).",
			"New upgrades and tech nodes are available.",
		],
	},
	{
		id: "tier_startup",
		anchor: null,
		title: "$ ./hire.sh",
		lines: [
			"You founded a Startup!",
			"",
			"You can now hire devs who write code for you.",
			"Your fingers get a break.",
			"Focus on buying the right upgrades.",
		],
	},
	{
		id: "tier_tech_company",
		anchor: null,
		title: "$ cat scale.conf",
		lines: [
			"You're a Tech Company now.",
			"",
			"Teams, managers, and GPU clusters are available.",
			"Managers boost your dev teams.",
		],
	},
	{
		id: "tier_ai_lab",
		anchor: null,
		title: "$ cat warning.log",
		lines: [
			"AI Lab unlocked.",
			"",
			"AI models write code fast, but they eat FLOPS.",
			"Each model has a FLOPS cost to run.",
			"",
			"  Total FLOPS - AI cost = Execution FLOPS",
			"",
			"Buy more AI → more LoC, less execution.",
			"Buy more hardware → feed both.",
		],
	},
	{
		id: "tier_agi_race",
		anchor: null,
		title: "$ cat endgame.sh",
		lines: ["The AGI Race begins.", "", "Buy The Singularity ($500T) to win."],
	},
];

const tipMap = new Map(tips.map((t) => [t.id, t]));

// ── Trigger conditions ──

type GameState = ReturnType<typeof useGameStore.getState>;

const triggers: Array<{ id: string; test: (s: GameState) => boolean }> = [
	{ id: "welcome", test: () => true },
	{ id: "loc_explain", test: (s) => s.totalLoc >= 10 },
	{ id: "execute_explain", test: (s) => s.totalLoc >= 20 },
	{ id: "cash_explain", test: (s) => s.totalCash >= 1 },
	{ id: "shop_explain", test: (s) => s.cash >= 10 },
	{ id: "tier_freelancing", test: (s) => s.currentTierIndex >= 1 },
	{ id: "tier_startup", test: (s) => s.currentTierIndex >= 2 },
	{ id: "tier_tech_company", test: (s) => s.currentTierIndex >= 3 },
	{ id: "tier_ai_lab", test: (s) => s.currentTierIndex >= 4 },
	{ id: "tier_agi_race", test: (s) => s.currentTierIndex >= 5 },
];

// ── Watcher hook ──

export function useTutorialTriggers() {
	const cooldownRef = useRef(false);

	useEffect(() => {
		// Listen for dismissals to set a cooldown
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
			const { seenTips, activeTip, showTip } = useUiStore.getState();
			if (activeTip !== null) return;
			for (const trigger of triggers) {
				if (seenTips.includes(trigger.id)) continue;
				if (trigger.test(state)) {
					showTip(trigger.id);
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

// ── Spotlight positioning ──

function useAnchorRect(anchor: string | null | undefined, active: boolean) {
	const [rect, setRect] = useState<DOMRect | null>(null);

	useLayoutEffect(() => {
		if (!active || !anchor) {
			setRect(null);
			return;
		}
		const el = document.querySelector(`[data-tutorial="${anchor}"]`);
		if (el) {
			setRect(el.getBoundingClientRect());
		}
	}, [anchor, active]);

	// Update on resize
	useEffect(() => {
		if (!active || !anchor) return;
		const update = () => {
			const el = document.querySelector(`[data-tutorial="${anchor}"]`);
			if (el) setRect(el.getBoundingClientRect());
		};
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, [anchor, active]);

	return rect;
}

// ── Styles ──

const fadeIn = keyframes({
	from: { opacity: 0 },
	to: { opacity: 1 },
});

const slideIn = keyframes({
	from: { opacity: 0, transform: "translateY(8px)" },
	to: { opacity: 1, transform: "translateY(0)" },
});

const pulseGlow = keyframes({
	"0%, 100%": { boxShadow: "0 0 0 2px rgba(126, 231, 135, 0.4)" },
	"50%": { boxShadow: "0 0 0 6px rgba(126, 231, 135, 0.15)" },
});

const overlayBaseCss = css({
	position: "fixed",
	inset: 0,
	zIndex: 9998,
	animation: `${fadeIn} 0.2s ease-out`,
});

const tooltipCss = css({
	position: "fixed",
	zIndex: 10000,
	background: "#0d1117",
	border: "1px solid #7ee787",
	borderRadius: 8,
	padding: "16px 20px",
	maxWidth: 340,
	width: "max-content",
	boxShadow: "0 12px 40px rgba(0, 0, 0, 0.7)",
	animation: `${slideIn} 0.2s ease-out`,
	fontFamily: "'Courier New', monospace",
});

const titleCss = css({
	color: "#7ee787",
	fontSize: 14,
	fontWeight: 700,
	marginBottom: 10,
});

const lineCss = css({
	fontSize: 12,
	lineHeight: 1.7,
	color: "#8b949e",
	minHeight: "1.7em",
});

const highlightLineCss = css({
	color: "#c9d1d9",
});

const btnRowCss = css({
	marginTop: 14,
	display: "flex",
	justifyContent: "flex-end",
});

const okBtnCss = css({
	fontFamily: "'Courier New', monospace",
	fontSize: 12,
	padding: "6px 18px",
	border: "1px solid #7ee787",
	borderRadius: 4,
	cursor: "pointer",
	background: "transparent",
	color: "#7ee787",
	transition: "all 0.15s",
	"&:hover": { background: "#7ee787", color: "#0d1117" },
});

const spotlightPadding = 6;

// ── Tooltip placement ──

const tooltipWidth = 340;
const tooltipMargin = 12;

function getTooltipPosition(
	rect: DOMRect,
	placement: string,
): { top: number; left: number } {
	const gap = 12;
	const vw = window.innerWidth;
	const vh = window.innerHeight;

	let top: number;
	let left: number;

	switch (placement) {
		case "bottom":
			top = rect.bottom + gap;
			left = rect.left + rect.width / 2 - tooltipWidth / 2;
			break;
		case "top":
			top = rect.top - gap - 200;
			left = rect.left + rect.width / 2 - tooltipWidth / 2;
			break;
		case "right":
			top = rect.top + rect.height / 2 - 60;
			left = rect.right + gap;
			break;
		case "left":
			top = rect.top + rect.height / 2 - 60;
			left = rect.left - gap - tooltipWidth;
			break;
		default:
			top = rect.bottom + gap;
			left = rect.left;
	}

	// Clamp to viewport
	left = Math.max(
		tooltipMargin,
		Math.min(left, vw - tooltipWidth - tooltipMargin),
	);
	top = Math.max(tooltipMargin, Math.min(top, vh - tooltipMargin - 100));

	return { top, left };
}

// ── Component ──

export function TutorialTip() {
	const activeTip = useUiStore((s) => s.activeTip);
	const dismiss = useUiStore((s) => s.dismissTip);
	const tip = activeTip ? tipMap.get(activeTip) : null;
	const anchorRect = useAnchorRect(tip?.anchor, activeTip !== null);
	const tooltipRef = useRef<HTMLDivElement>(null);

	const handleDismiss = useCallback(() => {
		dismiss();
	}, [dismiss]);

	useEffect(() => {
		if (!activeTip) return;
		function onKey(e: KeyboardEvent) {
			if (e.key === "Enter" || e.key === "Escape" || e.key === " ") {
				e.preventDefault();
				handleDismiss();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [activeTip, handleDismiss]);

	if (!tip) return null;

	const hasAnchor = tip.anchor && anchorRect;
	const placement = tip.placement ?? "bottom";
	const tooltipPos = hasAnchor
		? getTooltipPosition(anchorRect, placement)
		: null;

	return (
		<>
			{/* SVG overlay with spotlight cutout (only when anchored) */}
			{hasAnchor ? (
				<svg css={overlayBaseCss} onClick={handleDismiss}>
					<defs>
						<mask id="spotlight-mask">
							<rect width="100%" height="100%" fill="white" />
							<rect
								x={anchorRect.left - spotlightPadding}
								y={anchorRect.top - spotlightPadding}
								width={anchorRect.width + spotlightPadding * 2}
								height={anchorRect.height + spotlightPadding * 2}
								rx={8}
								fill="black"
							/>
						</mask>
					</defs>
					<rect
						width="100%"
						height="100%"
						fill="rgba(0, 0, 0, 0.75)"
						mask="url(#spotlight-mask)"
					/>
				</svg>
			) : (
				<div
					css={[overlayBaseCss, { background: "rgba(0, 0, 0, 0.5)" }]}
					onClick={handleDismiss}
				/>
			)}

			{/* Spotlight border glow */}
			{hasAnchor && (
				<div
					css={css({
						position: "fixed",
						zIndex: 9999,
						pointerEvents: "none",
						borderRadius: 8,
						animation: `${pulseGlow} 2s ease-in-out infinite`,
					})}
					style={{
						top: anchorRect.top - spotlightPadding,
						left: anchorRect.left - spotlightPadding,
						width: anchorRect.width + spotlightPadding * 2,
						height: anchorRect.height + spotlightPadding * 2,
					}}
				/>
			)}

			{/* Tooltip */}
			<div
				ref={tooltipRef}
				css={tooltipCss}
				style={
					tooltipPos
						? { top: tooltipPos.top, left: tooltipPos.left }
						: {
								top: "50%",
								left: "50%",
								transform: "translate(-50%, -50%)",
							}
				}
				onClick={(e) => e.stopPropagation()}
			>
				<div css={titleCss}>{tip.title}</div>
				{tip.lines.map((line, i) => (
					<div key={i} css={lineCss}>
						{line.startsWith("  ") ? (
							<span css={highlightLineCss}>{line}</span>
						) : (
							line || "\u00A0"
						)}
					</div>
				))}
				<div css={btnRowCss}>
					<button type="button" css={okBtnCss} onClick={handleDismiss}>
						got it
					</button>
				</div>
			</div>
		</>
	);
}
