import { css } from "@emotion/react";
import { aiModels, useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";

const labelRowCss = css({
	display: "flex",
	justifyContent: "space-between",
	marginBottom: 4,
});

const labelCss = css({
	fontSize: 9,
	textTransform: "uppercase",
	letterSpacing: 0.5,
});

const ratesCss = css({
	display: "flex",
	justifyContent: "space-between",
	marginTop: 4,
});

const arbitrageCss = css({
	display: "flex",
	alignItems: "center",
	gap: 8,
	marginTop: 6,
	padding: "4px 0",
	cursor: "pointer",
	userSelect: "none",
	"&:hover": { opacity: 0.8 },
});

const toggleTrackCss = css({
	width: 28,
	height: 14,
	borderRadius: 7,
	position: "relative" as const,
	transition: "background 0.2s",
	flexShrink: 0,
});

const toggleThumbCss = css({
	position: "absolute" as const,
	top: 2,
	width: 10,
	height: 10,
	borderRadius: "50%",
	background: "#e6edf3",
	transition: "left 0.2s",
	display: "block",
});

export function FlopsSlider() {
	const { t } = useTranslation();
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);
	const flops = useGameStore((s) => s.flops);
	const flopSlider = useGameStore((s) => s.flopSlider);
	const unlockedModels = useGameStore((s) => s.unlockedModels);
	const llmHostSlots = useGameStore((s) => s.llmHostSlots);
	const autoArbitrageEnabled = useGameStore((s) => s.autoArbitrageEnabled);
	const autoArbitrageUnlocked = useGameStore(
		(s) => (s.ownedTechNodes.auto_arbitrage ?? 0) > 0,
	);
	const setFlopSlider = useGameStore((s) => s.setFlopSlider);
	const toggleAutoArbitrage = useGameStore((s) => s.toggleAutoArbitrage);
	const theme = useIdeTheme();

	const { aiLocPerSec } = useMemo(() => {
		const active = aiModels
			.filter((m) => unlockedModels[m.id])
			.sort((a, b) => a.flopsCost - b.flopsCost)
			.slice(0, llmHostSlots);
		const aiFlops = flops * (1 - flopSlider);
		let totalLoc = 0;
		let remaining = aiFlops;
		for (const model of active) {
			const modelFlops = Math.min(model.flopsCost, remaining);
			remaining -= modelFlops;
			const ratio = model.flopsCost > 0 ? modelFlops / model.flopsCost : 0;
			totalLoc += model.locPerSec * Math.min(1, ratio);
		}
		return { aiLocPerSec: totalLoc };
	}, [unlockedModels, flops, flopSlider, llmHostSlots]);

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setFlopSlider(Number.parseFloat(e.target.value));
		},
		[setFlopSlider],
	);

	const wrapperCss = useMemo(
		() =>
			css({
				padding: "8px 12px",
				background: theme.panelBg,
				borderBottom: `1px solid ${theme.border}`,
			}),
		[theme.panelBg, theme.border],
	);

	const sliderCss = useMemo(
		() =>
			css({
				width: "100%",
				height: 10,
				borderRadius: 5,
				appearance: "none",
				outline: "none",
				cursor: "grab",
				"&:active": { cursor: "grabbing" },
				"&::-webkit-slider-thumb": {
					appearance: "none",
					width: 16,
					height: 16,
					borderRadius: "50%",
					background: theme.foreground,
					border: `2px solid ${theme.background}`,
					boxShadow: "0 0 4px rgba(0,0,0,0.5)",
					cursor: "grab",
				},
				"&::-moz-range-thumb": {
					width: 16,
					height: 16,
					borderRadius: "50%",
					background: theme.foreground,
					border: `2px solid ${theme.background}`,
					boxShadow: "0 0 4px rgba(0,0,0,0.5)",
					cursor: "grab",
				},
			}),
		[theme.foreground, theme.background],
	);

	if (!aiUnlocked) return null;

	const execFlops = flops * flopSlider;
	const aiFlops = flops * (1 - flopSlider);
	const execPct = Math.round(flopSlider * 100);

	const sliderBg = `linear-gradient(90deg, ${theme.success} 0%, ${theme.success} ${execPct}%, ${theme.keyword} ${execPct}%, ${theme.keyword} 100%)`;

	return (
		<div css={wrapperCss}>
			<div css={labelRowCss}>
				<span css={[labelCss, { color: theme.success }]}>
					{t("flops_slider.exec_flops", {
						count: formatNumber(execFlops),
					})}
				</span>
				<span css={[labelCss, { color: theme.keyword }]}>
					{t("flops_slider.ai_flops", {
						count: formatNumber(aiFlops),
					})}
				</span>
			</div>
			<input
				type="range"
				min={0}
				max={1}
				step={0.01}
				value={flopSlider}
				onChange={handleChange}
				css={sliderCss}
				style={{ background: sliderBg }}
			/>
			<div css={ratesCss}>
				<span style={{ fontSize: 9, color: theme.textMuted }}>
					{t("flops_slider.exec_rate", {
						count: formatNumber(execFlops),
					})}
				</span>
				<span style={{ fontSize: 9, color: theme.textMuted }}>
					{t("flops_slider.ai_rate", {
						count: formatNumber(aiLocPerSec),
					})}
				</span>
			</div>
			{autoArbitrageUnlocked && (
				<div css={arbitrageCss} onClick={toggleAutoArbitrage}>
					<span style={{ fontSize: 14 }}>{"⚖️"}</span>
					<span
						style={{
							fontSize: 11,
							color: autoArbitrageEnabled ? theme.type : theme.textMuted,
						}}
					>
						{t("flops_slider.auto_arbitrage_active")}
					</span>
					<div
						css={toggleTrackCss}
						style={{
							background: autoArbitrageEnabled ? theme.type : theme.border,
						}}
					>
						<span
							css={toggleThumbCss}
							style={{ left: autoArbitrageEnabled ? 16 : 2 }}
						/>
					</div>
					{autoArbitrageEnabled && (
						<span
							style={{
								marginLeft: "auto",
								fontSize: 10,
								color: theme.textMuted,
							}}
						>
							{t("flops_slider.targeting", { pct: execPct })}
						</span>
					)}
				</div>
			)}
		</div>
	);
}
