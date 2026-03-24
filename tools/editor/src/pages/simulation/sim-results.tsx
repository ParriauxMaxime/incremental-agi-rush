import { css } from "@emotion/react";
import type { SimResult } from "@shared/types";
import { CashChart } from "./cash-chart";
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
}

export function SimResults({ result }: SimResultsProps) {
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
					<div css={metricLabelCss}>Final Tier</div>
					<div css={metricValueCss}>{result.finalTier}</div>
				</div>
			</div>

			<div css={sectionTitleCss}>Cash Over Time</div>
			<CashChart snapshots={result.snapshots} />

			<div css={sectionTitleCss}>Tier Timeline</div>
			<TierTimeline tierTimes={result.tierTimes} endTime={result.endTime} />
		</div>
	);
}
