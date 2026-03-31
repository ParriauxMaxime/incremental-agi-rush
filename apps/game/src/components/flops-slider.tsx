import { css } from "@emotion/react";
import { aiModels, useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

const wrapperCss = css({
	padding: "8px 12px",
	background: "#131820",
	borderBottom: "1px solid #1e2630",
});

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

const sliderCss = css({
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
		background: "#e6edf3",
		border: "2px solid #0d1117",
		boxShadow: "0 0 4px rgba(0,0,0,0.5)",
		cursor: "grab",
	},
	"&::-moz-range-thumb": {
		width: 16,
		height: 16,
		borderRadius: "50%",
		background: "#e6edf3",
		border: "2px solid #0d1117",
		boxShadow: "0 0 4px rgba(0,0,0,0.5)",
		cursor: "grab",
	},
});

const ratesCss = css({
	display: "flex",
	justifyContent: "space-between",
	marginTop: 4,
});

const rateCss = css({
	fontSize: 9,
	color: "#484e58",
});

const arbitrageCss = css({
	display: "flex",
	alignItems: "center",
	gap: 8,
	marginTop: 6,
	padding: "4px 0",
});

export function FlopsSlider() {
	const { t } = useTranslation();
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);
	const flops = useGameStore((s) => s.flops);
	const flopSlider = useGameStore((s) => s.flopSlider);
	const unlockedModels = useGameStore((s) => s.unlockedModels);
	const llmHostSlots = useGameStore((s) => s.llmHostSlots);
	const autoArbitrageEnabled = useGameStore(
		(s) => s.autoArbitrageEnabled,
	);
	const setFlopSlider = useGameStore((s) => s.setFlopSlider);

	const { aiLocPerSec } = useMemo(() => {
		const active = aiModels
			.filter((m) => unlockedModels[m.id])
			.sort((a, b) => b.locPerSec - a.locPerSec)
			.slice(0, llmHostSlots);
		const aiFlops = flops * (1 - flopSlider);
		let totalLoc = 0;
		let remaining = aiFlops;
		for (const model of active) {
			const modelFlops = Math.min(model.flopsCost, remaining);
			remaining -= modelFlops;
			const ratio =
				model.flopsCost > 0 ? modelFlops / model.flopsCost : 0;
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

	if (!aiUnlocked) return null;

	const execFlops = flops * flopSlider;
	const aiFlops = flops * (1 - flopSlider);
	const execPct = Math.round(flopSlider * 100);

	// Build slider background gradient
	const sliderBg = `linear-gradient(90deg, #3fb950 0%, #3fb950 ${execPct}%, #c678dd ${execPct}%, #c678dd 100%)`;

	return (
		<div css={wrapperCss}>
			<div css={labelRowCss}>
				<span css={[labelCss, { color: "#3fb950" }]}>
					{t("flops_slider.exec_flops", {
						count: formatNumber(execFlops),
					})}
				</span>
				<span css={[labelCss, { color: "#c678dd" }]}>
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
				<span css={rateCss}>
					{t("flops_slider.exec_rate", {
						count: formatNumber(execFlops),
					})}
				</span>
				<span css={rateCss}>
					{t("flops_slider.ai_rate", {
						count: formatNumber(aiLocPerSec),
					})}
				</span>
			</div>
			{autoArbitrageEnabled && (
				<div css={arbitrageCss}>
					<span style={{ fontSize: 14 }}>{"⚖️"}</span>
					<span style={{ fontSize: 11, color: "#e5c07b" }}>
						{t("flops_slider.auto_arbitrage_active")}
					</span>
					<span
						style={{
							marginLeft: "auto",
							fontSize: 10,
							color: "#484e58",
						}}
					>
						{t("flops_slider.targeting", { pct: execPct })}
					</span>
				</div>
			)}
		</div>
	);
}
