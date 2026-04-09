import { css } from "@emotion/react";
import { BalanceSummaryTable } from "@flopsed/design-system";
import type { AiModelData } from "@flopsed/domain";
import type { SimResult } from "@flopsed/engine";
import { CashChart } from "./cash-chart";
import { FlopsChart } from "./flops-chart";
import { FlopsUtilChart } from "./flops-util-chart";
import { TierTimeline } from "./tier-timeline";

const bannerCss = (passed: boolean) =>
	css({
		background: passed ? "rgba(63, 185, 80, 0.1)" : "rgba(233, 69, 96, 0.1)",
		border: `1px solid ${passed ? "#3fb950" : "#e94560"}`,
		borderRadius: 6,
		color: passed ? "#3fb950" : "#e94560",
		fontWeight: "bold",
		textAlign: "center",
		padding: "12px 0",
		fontSize: 16,
		marginBottom: 16,
	});

const failuresCss = css({
	color: "#e94560",
	fontSize: 13,
	marginBottom: 16,
	"& > div": { padding: "2px 0" },
});

const metricsCss = css({
	display: "grid",
	gridTemplateColumns: "repeat(4, 1fr)",
	gap: 12,
	marginBottom: 24,
});

const metricCardCss = css({
	background: "#161b22",
	border: "1px solid #1e2630",
	borderRadius: 6,
	padding: 16,
	textAlign: "center",
});

const metricLabelCss = css({
	fontSize: 11,
	color: "#6272a4",
	textTransform: "uppercase",
	letterSpacing: 0.5,
	marginBottom: 4,
});

const metricValueCss = css({
	fontSize: 22,
	fontWeight: "bold",
	color: "#e0e0e0",
});

const sectionTitleCss = css({
	color: "#c678dd",
	fontSize: 14,
	fontWeight: "bold",
	margin: "20px 0 8px",
});

function formatTime(seconds: number | null): string {
	if (seconds === null) return "N/A";
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}

interface SimResultsProps {
	result: SimResult;
	aiModels: AiModelData[];
}

export function SimResults({ result, aiModels }: SimResultsProps) {
	const agi = result.agiTime;
	const snapshots =
		agi !== null
			? result.snapshots.filter((s) => s.time <= agi)
			: result.snapshots;
	const endTime = result.agiTime ?? result.endTime;

	return (
		<div>
			<div css={bannerCss(result.passed)}>
				{result.passed ? "ALL CHECKS PASSED" : "BALANCE BROKEN"}
			</div>

			{result.failures.length > 0 && (
				<div css={failuresCss}>
					{result.failures.map((f) => (
						<div key={f}>{f}</div>
					))}
				</div>
			)}

			<div css={metricsCss}>
				<div css={metricCardCss}>
					<div css={metricLabelCss}>AGI Time</div>
					<div css={metricValueCss}>{formatTime(result.agiTime)}</div>
				</div>
				<div css={metricCardCss}>
					<div css={metricLabelCss}>Total Purchases</div>
					<div css={metricValueCss}>{result.purchaseCount}</div>
				</div>
				<div css={metricCardCss}>
					<div css={metricLabelCss}>Longest Wait</div>
					<div css={metricValueCss}>{Math.round(result.longestWait)}s</div>
				</div>
				<div css={metricCardCss}>
					<div css={metricLabelCss}>Idle Time</div>
					<div css={metricValueCss}>{result.idle.idlePercent}%</div>
				</div>
			</div>

			<div css={metricsCss}>
				<div css={metricCardCss}>
					<div css={metricLabelCss}>Avg Gap</div>
					<div css={metricValueCss}>{Math.round(result.idle.avgGap)}s</div>
				</div>
				<div css={metricCardCss}>
					<div css={metricLabelCss}>Median Gap</div>
					<div css={metricValueCss}>{Math.round(result.idle.medianGap)}s</div>
				</div>
				<div css={metricCardCss}>
					<div css={metricLabelCss}>AI Models</div>
					<div css={metricValueCss}>{result.aiModelsOwned}</div>
				</div>
				<div css={metricCardCss}>
					<div css={metricLabelCss}>Final Tier</div>
					<div css={metricValueCss}>{result.finalTier}</div>
				</div>
			</div>

			<div css={sectionTitleCss}>Balance Summary</div>
			<BalanceSummaryTable result={result} />

			<div css={sectionTitleCss}>Top Idle Gaps</div>
			<div css={css({ fontSize: 13, marginBottom: 16 })}>
				{result.idle.gaps
					.sort((a, b) => b.duration - a.duration)
					.slice(0, 8)
					.map((g, i) => (
						<div
							key={i}
							css={css({
								display: "flex",
								justifyContent: "space-between",
								padding: "4px 8px",
								background: i % 2 === 0 ? "#161b22" : "transparent",
								borderRadius: 3,
							})}
						>
							<span css={css({ color: "#d19a66" })}>
								{Math.round(g.duration)}s
							</span>
							<span css={css({ color: "#8892b0" })}>
								saving for {g.nextPurchase}
							</span>
						</div>
					))}
			</div>

			<div css={sectionTitleCss}>Cash Over Time</div>
			<CashChart snapshots={snapshots} />

			<div css={sectionTitleCss}>Economy Over Time</div>
			<FlopsChart snapshots={snapshots} />

			<div css={sectionTitleCss}>FLOPS Utilization</div>
			<FlopsUtilChart
				snapshots={snapshots}
				purchases={result.purchases}
				aiModels={aiModels}
			/>

			<div css={sectionTitleCss}>Tier Timeline</div>
			<TierTimeline
				tierTimes={result.tierTimes}
				endTime={endTime}
				purchases={result.purchases}
			/>
		</div>
	);
}
