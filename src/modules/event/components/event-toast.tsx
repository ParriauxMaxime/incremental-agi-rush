import { css, keyframes } from "@emotion/react";
import { useGameStore } from "@modules/game";
import { allEvents } from "../data/events";
import { resolveChoiceEffects, useEventStore } from "../store/event-store";
import type { EventEffect } from "../types";

// ---------------------------------------------------------------------------
// Sentiment helpers
// ---------------------------------------------------------------------------

function deriveSentiment(
	effects: EventEffect[],
): "positive" | "negative" | "neutral" {
	if (effects.some((e) => e.type === "choice")) return "neutral";

	const allPositive = effects.every((e) => {
		if (e.type === "instantCash" || e.type === "instantLoc") return true;
		if (e.type === "conditionalCash") return true;
		if ("value" in e && typeof e.value === "number") return e.value >= 1;
		return true;
	});

	return allPositive ? "positive" : "negative";
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const slideIn = keyframes({
	from: { transform: "translateY(20px)", opacity: 0 },
	to: { transform: "translateY(0)", opacity: 1 },
});

const toastWrapperCss = css({
	position: "fixed",
	bottom: 16,
	left: "50%",
	transform: "translateX(-50%)",
	zIndex: 1000,
	animation: `${slideIn} 0.2s ease-out`,
	minWidth: 320,
	maxWidth: 520,
});

function toastBodyCss(sentiment: "positive" | "negative" | "neutral") {
	const bg =
		sentiment === "positive"
			? "rgba(88, 166, 255, 0.15)"
			: sentiment === "negative"
				? "rgba(233, 69, 96, 0.15)"
				: "rgba(139, 148, 158, 0.15)";

	const border =
		sentiment === "positive"
			? "rgba(88, 166, 255, 0.4)"
			: sentiment === "negative"
				? "rgba(233, 69, 96, 0.4)"
				: "rgba(139, 148, 158, 0.4)";

	return css({
		background: bg,
		border: `1px solid ${border}`,
		borderRadius: 8,
		padding: "10px 14px",
		display: "flex",
		alignItems: "flex-start",
		gap: 10,
		backdropFilter: "blur(4px)",
		boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
		fontFamily: "'Courier New', monospace",
		color: "#c9d1d9",
		fontSize: 13,
	});
}

const iconCss = css({
	fontSize: 18,
	flexShrink: 0,
	lineHeight: 1.4,
});

const contentCss = css({
	flex: 1,
	minWidth: 0,
});

const nameCss = css({
	fontWeight: "bold",
	fontSize: 13,
	color: "#e6edf3",
	marginBottom: 2,
});

const descCss = css({
	fontSize: 12,
	color: "#8b949e",
	lineHeight: 1.4,
});

const timerCss = css({
	flexShrink: 0,
	fontSize: 13,
	color: "#8b949e",
	fontVariantNumeric: "tabular-nums",
	alignSelf: "center",
	marginLeft: 8,
});

const choiceRowCss = css({
	display: "flex",
	gap: 8,
	marginTop: 8,
	flexWrap: "wrap",
});

function choiceBtnCss(sentiment: "positive" | "negative" | "neutral") {
	const accent =
		sentiment === "positive"
			? "#58a6ff"
			: sentiment === "negative"
				? "#e94560"
				: "#8b949e";

	return css({
		fontFamily: "'Courier New', monospace",
		fontSize: 11,
		padding: "4px 10px",
		background: "transparent",
		color: accent,
		border: `1px solid ${accent}`,
		borderRadius: 4,
		cursor: "pointer",
		transition: "all 0.15s",
		"&:hover": { background: accent, color: "#0a0e14" },
	});
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EventToast() {
	const activeEvents = useEventStore((s) => s.activeEvents);
	const toastEvent = useEventStore((s) => s.toastEvent);
	const handleChoice = useEventStore((s) => s.handleChoice);
	const cash = useGameStore((s) => s.cash);
	const loc = useGameStore((s) => s.loc);
	const autoLocPerSec = useGameStore((s) => s.autoLocPerSec);
	const applyEventReward = useGameStore((s) => s.applyEventReward);

	// Find display event: first non-synthetic, non-resolved active event
	const activeDisplayEvent =
		activeEvents.find((ev) => !ev.synthetic && !ev.resolved) ?? null;

	const displayActiveId = activeDisplayEvent?.definitionId ?? null;
	const fallbackId = toastEvent?.definitionId ?? null;
	const displayId = displayActiveId ?? fallbackId;

	if (displayId === null) return null;

	const def = allEvents.find((e) => e.id === displayId);
	if (!def) return null;

	const sentiment = deriveSentiment(def.effects);
	const choiceEffect = def.effects.find((e) => e.type === "choice");
	const isChoice = choiceEffect !== undefined && choiceEffect.type === "choice";
	const remainingDuration = activeDisplayEvent?.remainingDuration ?? 0;
	const hasDuration = remainingDuration > 0;

	const ctx = {
		currentCash: cash,
		currentLoc: loc,
		currentLocPerSec: autoLocPerSec,
	};

	return (
		<div css={toastWrapperCss}>
			<div css={toastBodyCss(sentiment)}>
				<div css={iconCss}>{def.icon}</div>
				<div css={contentCss}>
					<div css={nameCss}>{def.name}</div>
					<div css={descCss}>{def.description}</div>
					{isChoice && choiceEffect.type === "choice" && (
						<div css={choiceRowCss}>
							{choiceEffect.options.map((opt, i) => (
								<button
									key={opt.label}
									type="button"
									css={choiceBtnCss(sentiment)}
									onClick={() => {
										const { cashDelta, locDelta } = resolveChoiceEffects(
											opt.effect,
											ctx,
										);
										handleChoice(displayId, i, ctx);
										applyEventReward(cashDelta, locDelta);
									}}
								>
									{opt.label}
								</button>
							))}
						</div>
					)}
				</div>
				{hasDuration && !isChoice && (
					<div css={timerCss}>{Math.ceil(remainingDuration)}s</div>
				)}
			</div>
		</div>
	);
}
