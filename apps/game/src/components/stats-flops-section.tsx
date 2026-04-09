import { css } from "@emotion/react";
import { useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { CollapsibleSection } from "./collapsible-section";
import { RollingNumber } from "./rolling-number";
import { Sparkline } from "./sparkline";

const splitBarCss = css({
	display: "flex",
	height: 10,
	borderRadius: 5,
	overflow: "hidden",
});

const splitLegendCss = css({
	display: "flex",
	justifyContent: "space-between",
	fontSize: 9,
	marginTop: 3,
});

export function StatsFlopsSection() {
	const { t } = useTranslation();
	const theme = useIdeTheme();
	const flops = useGameStore((s) => s.flops);
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);
	const flopSlider = useGameStore((s) => s.flopSlider);
	const graphsUnlocked = useGameStore(
		(s) => (s.ownedTechNodes.unlock_perf_graphs ?? 0) > 0,
	);
	const rateSnapshots = useGameStore((s) => s.rateSnapshots);
	const tierTransitions = useGameStore((s) => s.tierTransitions);
	const sessionStartTime = useGameStore((s) => s.sessionStartTime);

	const elapsed = (performance.now() - sessionStartTime) / 1000;

	const flopUtilData = useMemo(
		() => rateSnapshots.map((s) => s.flopUtilization * 100),
		[rateSnapshots],
	);
	const latest = rateSnapshots[rateSnapshots.length - 1];

	const execFlops = flops * flopSlider;
	const aiFlops = flops * (1 - flopSlider);
	const execPct = Math.round(flopSlider * 100);
	const aiPct = 100 - execPct;

	return (
		<CollapsibleSection
			icon={<span style={{ color: theme.flopsColor }}>⚡</span>}
			label={t("stats_panel.flops")}
			value={
				<RollingNumber value={formatNumber(flops)} color={theme.flopsColor} />
			}
			collapsible={graphsUnlocked}
			defaultOpen={false}
		>
			{/* Exec/AI split bar (only when AI unlocked) */}
			{aiUnlocked && (
				<div style={{ marginBottom: 8 }}>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							fontSize: 10,
							color: theme.textMuted,
							marginBottom: 4,
						}}
					>
						<span>
							{t("stats_panel.exec_ai_split", {
								defaultValue: "Exec / AI allocation",
							})}
						</span>
						<span>
							{execPct}% / {aiPct}%
						</span>
					</div>
					<div
						css={splitBarCss}
						style={{ border: `1px solid ${theme.border}` }}
					>
						<div
							style={{
								width: `${execPct}%`,
								background: theme.cashColor,
							}}
						/>
						<div
							style={{
								width: `${aiPct}%`,
								background: theme.locColor,
							}}
						/>
					</div>
					<div css={splitLegendCss}>
						<span style={{ color: theme.cashColor }}>
							● {t("stats_panel.exec_label")} {formatNumber(execFlops)}
						</span>
						<span style={{ color: theme.locColor }}>
							● {t("stats_panel.ai_label")} {formatNumber(aiFlops)}
						</span>
					</div>
				</div>
			)}
			{/* Utilization sparkline */}
			{latest && (
				<div>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							fontSize: 10,
							color: theme.textMuted,
							marginBottom: 4,
						}}
					>
						<span>{t("stats_panel.utilization")}</span>
						<span style={{ color: theme.flopsColor }}>
							{Math.round(latest.flopUtilization * 100)}%
						</span>
					</div>
					<Sparkline
						data={flopUtilData}
						color={theme.flopsColor ?? "#c678dd"}
						tierTransitions={tierTransitions}
						totalTime={elapsed}
					/>
				</div>
			)}
		</CollapsibleSection>
	);
}
