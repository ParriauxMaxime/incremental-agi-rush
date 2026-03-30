import { css } from "@emotion/react";
import { useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { Sparkline } from "./sparkline";

const sectionCss = css({ padding: "8px 12px" });
const sparkRowCss = css({ padding: "6px 0" });
const sparkHeaderCss = css({
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	marginBottom: 4,
});
const sparkLabelCss = css({ fontSize: 11 });
const sparkValueCss = css({ fontSize: 11, fontWeight: 500 });

export function StatsPanelGraphs() {
	const { t } = useTranslation();
	const theme = useIdeTheme();
	const rateSnapshots = useGameStore((s) => s.rateSnapshots);
	const tierTransitions = useGameStore((s) => s.tierTransitions);
	const sessionStartTime = useGameStore((s) => s.sessionStartTime);

	const elapsed = (performance.now() - sessionStartTime) / 1000;

	const { cashData, locProdData, locExecData, flopUtilData, latest } =
		useMemo(() => {
			const snaps = rateSnapshots;
			return {
				cashData: snaps.map((s) => s.cashPerSec),
				locProdData: snaps.map((s) => s.locProducedPerSec),
				locExecData: snaps.map((s) => s.locExecutedPerSec),
				flopUtilData: snaps.map((s) => s.flopUtilization * 100),
				latest: snaps.length > 0 ? snaps[snaps.length - 1] : null,
			};
		}, [rateSnapshots]);

	if (!latest) {
		return (
			<div css={sectionCss}>
				<div
					style={{
						color: theme.textMuted,
						fontSize: 12,
						padding: "20px 0",
						textAlign: "center",
					}}
				>
					{t("stats_panel.graphs_collecting")}
				</div>
			</div>
		);
	}

	return (
		<div css={sectionCss}>
			<div css={sparkRowCss}>
				<div css={sparkHeaderCss}>
					<span css={sparkLabelCss} style={{ color: theme.textMuted }}>
						{t("stats_panel.cash_per_sec")}
					</span>
					<span css={sparkValueCss} style={{ color: theme.cashColor }}>
						${formatNumber(latest.cashPerSec, true)}/s
					</span>
				</div>
				<Sparkline
					data={cashData}
					color={theme.cashColor ?? "#3fb950"}
					tierTransitions={tierTransitions}
					totalTime={elapsed}
				/>
			</div>

			<div
				style={{ borderTop: `1px solid ${theme.border}`, margin: "4px 0" }}
			/>

			<div css={sparkRowCss}>
				<div css={sparkHeaderCss}>
					<span css={sparkLabelCss} style={{ color: theme.textMuted }}>
						LoC {t("stats_panel.produced_vs_executed")}
					</span>
					<span css={sparkValueCss} style={{ color: theme.locColor }}>
						{formatNumber(latest.locProducedPerSec)} /{" "}
						{formatNumber(latest.locExecutedPerSec)}
					</span>
				</div>
				<Sparkline
					data={locProdData}
					color={theme.locColor ?? "#58a6ff"}
					data2={locExecData}
					color2={theme.flopsColor ?? "#d2a8ff"}
					tierTransitions={tierTransitions}
					totalTime={elapsed}
				/>
			</div>

			<div
				style={{ borderTop: `1px solid ${theme.border}`, margin: "4px 0" }}
			/>

			<div css={sparkRowCss}>
				<div css={sparkHeaderCss}>
					<span css={sparkLabelCss} style={{ color: theme.textMuted }}>
						FLOPS {t("stats_panel.utilization")}
					</span>
					<span css={sparkValueCss} style={{ color: theme.flopsColor }}>
						{Math.round(latest.flopUtilization * 100)}%
					</span>
				</div>
				<Sparkline
					data={flopUtilData}
					color={theme.flopsColor ?? "#d2a8ff"}
					tierTransitions={tierTransitions}
					totalTime={elapsed}
				/>
			</div>
		</div>
	);
}
