import { css } from "@emotion/react";
import { aiModels, useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

const wrapperCss = css({
	padding: "8px 12px",
	background: "#131820",
	borderBottom: "1px solid #1e2630",
});

const labelCss = css({
	fontSize: 9,
	textTransform: "uppercase",
	letterSpacing: 0.5,
});

const barCss = css({
	height: 6,
	borderRadius: 3,
	background: "#1e2630",
	overflow: "hidden",
	margin: "6px 0",
	display: "flex",
});

const execSegCss = css({
	height: "100%",
	background: "#3fb950",
	transition: "width 0.3s",
});

const aiSegCss = css({
	height: "100%",
	background: "#c678dd",
	transition: "width 0.3s",
});

const ratesCss = css({
	display: "flex",
	justifyContent: "space-between",
});

const rateCss = css({
	fontSize: 9,
	color: "#484e58",
});

export function FlopsSlider() {
	const { t } = useTranslation();
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);
	const flops = useGameStore((s) => s.flops);
	const unlockedModels = useGameStore((s) => s.unlockedModels);

	const { aiFlopsCost, aiLocPerSec } = useMemo(() => {
		const active = aiModels.filter((m) => unlockedModels[m.id]);
		let totalCost = 0;
		let totalLoc = 0;
		let remaining = flops;
		for (const model of active) {
			const modelFlops = Math.min(model.flopsCost, remaining);
			totalCost += modelFlops;
			remaining -= modelFlops;
			const ratio = model.flopsCost > 0 ? modelFlops / model.flopsCost : 0;
			totalLoc += model.locPerSec * Math.min(1, ratio);
		}
		return { aiFlopsCost: totalCost, aiLocPerSec: totalLoc };
	}, [unlockedModels, flops]);

	if (!aiUnlocked) return null;

	const execFlops = Math.max(0, flops - aiFlopsCost);
	const execPct = flops > 0 ? (execFlops / flops) * 100 : 100;
	const aiPct = flops > 0 ? (aiFlopsCost / flops) * 100 : 0;

	return (
		<div css={wrapperCss}>
			<div
				css={{
					display: "flex",
					justifyContent: "space-between",
					marginBottom: 2,
				}}
			>
				<span css={[labelCss, { color: "#3fb950" }]}>
					{t("flops_slider.exec_flops", { count: formatNumber(execFlops) })}
				</span>
				<span css={[labelCss, { color: "#c678dd" }]}>
					{t("flops_slider.ai_flops", { count: formatNumber(aiFlopsCost) })}
				</span>
			</div>
			<div css={barCss}>
				<div css={execSegCss} style={{ width: `${execPct}%` }} />
				<div css={aiSegCss} style={{ width: `${aiPct}%` }} />
			</div>
			<div css={ratesCss}>
				<span css={rateCss}>{t("flops_slider.exec_rate", { count: formatNumber(execFlops) })}</span>
				<span css={rateCss}>{t("flops_slider.ai_rate", { count: formatNumber(aiLocPerSec) })}</span>
			</div>
		</div>
	);
}
