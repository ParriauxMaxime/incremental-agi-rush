import type { EventEffect } from "@agi-rush/domain";
import { events as allEvents } from "@agi-rush/domain";
import { css, keyframes } from "@emotion/react";
import { useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { resolveChoiceEffects, useEventStore } from "../store/event-store";

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
	bottom: 30,
	right: 12,
	zIndex: 1000,
	animation: `${slideIn} 0.2s ease-out`,
	minWidth: 320,
	maxWidth: 400,
});

function toastBodyCss(sentiment: "positive" | "negative" | "neutral") {
	const accentBar =
		sentiment === "positive"
			? "#3794ff"
			: sentiment === "negative"
				? "#f14c4c"
				: "#cca700";

	return css({
		background: "#252526",
		border: "1px solid #454545",
		borderLeft: `3px solid ${accentBar}`,
		borderRadius: 3,
		padding: "10px 14px",
		display: "flex",
		alignItems: "flex-start",
		gap: 10,
		boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
		fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
		color: "#cccccc",
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

const milestoneToastCss = css({
	background: "#252526",
	border: "1px solid #454545",
	borderLeft: "3px solid #3fb950",
	borderRadius: 3,
	padding: "10px 14px",
	display: "flex",
	alignItems: "flex-start",
	gap: 10,
	boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
	fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
	color: "#cccccc",
	fontSize: 13,
	marginBottom: 8,
});

const milestoneBonusCss = css({
	fontSize: 12,
	color: "#3fb950",
	fontWeight: "bold",
	marginTop: 4,
});

function MilestoneToastCard() {
	const milestoneToast = useEventStore((s) => s.milestoneToast);
	if (!milestoneToast) return null;

	return (
		<div css={milestoneToastCss}>
			<div css={iconCss}>🏆</div>
			<div css={contentCss}>
				<div css={nameCss}>{milestoneToast.name}</div>
				<div css={descCss}>{milestoneToast.description}</div>
				<div css={milestoneBonusCss}>
					+${formatNumber(milestoneToast.cashBonus)} bonus
				</div>
			</div>
		</div>
	);
}

export function EventToast() {
	const activeEvents = useEventStore((s) => s.activeEvents);
	const toastEvent = useEventStore((s) => s.toastEvent);
	const milestoneToast = useEventStore((s) => s.milestoneToast);
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

	if (displayId === null && !milestoneToast) return null;

	const def = displayId ? allEvents.find((e) => e.id === displayId) : null;

	const ctx = {
		currentCash: cash,
		currentLoc: loc,
		currentLocPerSec: autoLocPerSec,
	};

	return (
		<div css={toastWrapperCss}>
			<MilestoneToastCard />
			{def &&
				displayId &&
				(() => {
					const sentiment = deriveSentiment(def.effects);
					const choiceEffect = def.effects.find((e) => e.type === "choice");
					const isChoice =
						choiceEffect !== undefined && choiceEffect.type === "choice";
					const remainingDuration = activeDisplayEvent?.remainingDuration ?? 0;
					const hasDuration = remainingDuration > 0;

					return (
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
					);
				})()}
		</div>
	);
}
