import { PrestigeModal } from "@components/prestige-modal";
import { css, keyframes } from "@emotion/react";
import type { EventEffect } from "@flopsed/domain";
import { events as allEvents } from "@flopsed/domain";
import { useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../../../hooks/use-ide-theme";
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
	from: { transform: "translateX(-50%) translateY(-20px)", opacity: 0 },
	to: { transform: "translateX(-50%) translateY(0)", opacity: 1 },
});

const toastWrapperCss = css({
	position: "fixed",
	top: 48,
	left: "50%",
	transform: "translateX(-50%)",
	zIndex: 1000,
	animation: `${slideIn} 0.2s ease-out`,
	minWidth: 320,
	maxWidth: 400,
});

const iconCss = css({
	fontSize: 18,
	flexShrink: 0,
	lineHeight: 1.4,
});

const contentCss = css({
	flex: 1,
	minWidth: 0,
});

const choiceRowCss = css({
	display: "flex",
	gap: 8,
	marginTop: 8,
	flexWrap: "wrap",
});

const milestoneBonusCss = css({
	fontSize: 12,
	color: "#3fb950",
	fontWeight: "bold",
	marginTop: 4,
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

function MilestoneToastCard() {
	const { t } = useTranslation();
	const { t: tMilestones } = useTranslation("milestones");
	const theme = useIdeTheme();
	const milestoneToast = useEventStore((s) => s.milestoneToast);

	const milestoneToastCss = useMemo(
		() =>
			css({
				background: theme.sidebarBg,
				border: `1px solid ${theme.border}`,
				borderLeft: "3px solid #3fb950",
				borderRadius: 3,
				padding: "10px 14px",
				display: "flex",
				alignItems: "flex-start",
				gap: 10,
				boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
				fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
				color: theme.foreground,
				fontSize: 13,
				marginBottom: 8,
			}),
		[theme],
	);

	const nameCss = useMemo(
		() =>
			css({
				fontWeight: "bold",
				fontSize: 13,
				color: theme.foreground,
				marginBottom: 2,
			}),
		[theme],
	);

	const descCss = useMemo(
		() =>
			css({
				fontSize: 12,
				color: theme.textMuted,
				lineHeight: 1.4,
			}),
		[theme],
	);

	if (!milestoneToast) return null;

	return (
		<div css={milestoneToastCss}>
			<div css={iconCss}>🏆</div>
			<div css={contentCss}>
				<div css={nameCss}>{tMilestones(`${milestoneToast.id}.name`)}</div>
				<div css={descCss}>
					{tMilestones(`${milestoneToast.id}.description`)}
				</div>
				<div css={milestoneBonusCss}>
					{t("events.bonus", {
						amount: formatNumber(milestoneToast.cashBonus),
					})}
				</div>
			</div>
		</div>
	);
}

export function EventToast() {
	const [showPrestigeModal, setShowPrestigeModal] = useState(false);
	const { t: tEvents } = useTranslation("events");
	const theme = useIdeTheme();
	const activeEvents = useEventStore((s) => s.activeEvents);
	const toastEvent = useEventStore((s) => s.toastEvent);
	const milestoneToast = useEventStore((s) => s.milestoneToast);
	const handleChoice = useEventStore((s) => s.handleChoice);
	const dismissToast = useEventStore((s) => s.dismissToast);
	const toastCountdown = useEventStore((s) => s.toastDismissCountdown);
	const cash = useGameStore((s) => s.cash);
	const loc = useGameStore((s) => s.loc);
	const autoLocPerSec = useGameStore((s) => s.autoLocPerSec);
	const currentTierIndex = useGameStore((s) => s.currentTierIndex);
	const applyEventReward = useGameStore((s) => s.applyEventReward);

	const nameCss = useMemo(
		() =>
			css({
				fontWeight: "bold",
				fontSize: 13,
				color: theme.foreground,
				marginBottom: 2,
			}),
		[theme],
	);

	const descCss = useMemo(
		() =>
			css({
				fontSize: 12,
				color: theme.textMuted,
				lineHeight: 1.4,
			}),
		[theme],
	);

	const timerCss = useMemo(
		() =>
			css({
				flexShrink: 0,
				fontSize: 13,
				color: theme.textMuted,
				fontVariantNumeric: "tabular-nums",
				alignSelf: "center",
				marginLeft: 8,
			}),
		[theme],
	);

	const dismissBtnCss = useMemo(
		() =>
			css({
				flexShrink: 0,
				alignSelf: "center",
				marginLeft: 8,
				background: "transparent",
				border: `1px solid ${theme.border}`,
				borderRadius: 4,
				color: theme.textMuted,
				fontSize: 12,
				fontFamily: "'Courier New', monospace",
				fontVariantNumeric: "tabular-nums",
				padding: "4px 8px",
				cursor: "pointer",
				transition: "all 0.15s",
				"&:hover": { background: theme.border, color: theme.foreground },
			}),
		[theme],
	);

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
		currentTierIndex,
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

					const accentBar =
						sentiment === "positive"
							? "#3794ff"
							: sentiment === "negative"
								? "#f14c4c"
								: "#cca700";

					const toastBodyStyle = css({
						background: theme.sidebarBg,
						border: `1px solid ${theme.border}`,
						borderLeft: `3px solid ${accentBar}`,
						borderRadius: 3,
						padding: "10px 14px",
						display: "flex",
						alignItems: "flex-start",
						gap: 10,
						boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
						fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
						color: theme.foreground,
						fontSize: 13,
					});

					return (
						<div
							css={[toastBodyStyle, !isChoice && { cursor: "pointer" }]}
							onClick={!isChoice ? dismissToast : undefined}
							onKeyDown={undefined}
							role={!isChoice ? "button" : undefined}
							tabIndex={!isChoice ? 0 : undefined}
						>
							<div css={iconCss}>{def.icon}</div>
							<div css={contentCss}>
								<div css={nameCss}>{tEvents(`${def.id}.name`)}</div>
								<div css={descCss}>{tEvents(`${def.id}.description`)}</div>
								{isChoice && choiceEffect.type === "choice" && (
									<div css={choiceRowCss}>
										{choiceEffect.options.map((opt, i) => (
											<button
												key={opt.label}
												type="button"
												css={choiceBtnCss(sentiment)}
												onClick={() => {
													const chosenEffect = opt.effect;
													if (
														chosenEffect.type === "prestige" &&
														"op" in chosenEffect &&
														chosenEffect.op === "trigger"
													) {
														setShowPrestigeModal(true);
														return;
													}
													const { cashDelta, locDelta } = resolveChoiceEffects(
														chosenEffect,
														ctx,
													);
													handleChoice(displayId, i, ctx);
													applyEventReward(cashDelta, locDelta);
												}}
											>
												{tEvents(
													`${def.id}.options.${opt.label.toLowerCase().replace(/ /g, "_")}`,
													{ defaultValue: opt.label },
												)}
											</button>
										))}
									</div>
								)}
							</div>
							{!isChoice &&
								(hasDuration ? (
									<div css={timerCss}>{Math.ceil(remainingDuration)}s</div>
								) : (
									<button
										type="button"
										css={dismissBtnCss}
										onClick={(e) => {
											e.stopPropagation();
											dismissToast();
										}}
									>
										{Math.ceil(toastCountdown)}s
									</button>
								))}
						</div>
					);
				})()}
			{showPrestigeModal && (
				<PrestigeModal
					onConfirm={() => {
						setShowPrestigeModal(false);
						useGameStore.getState().prestige();
					}}
					onCancel={() => setShowPrestigeModal(false)}
				/>
			)}
		</div>
	);
}
