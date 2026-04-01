import { css } from "@emotion/react";
import type { SimResult } from "@flopsed/engine";
import { formatNumber, formatTime } from "@utils/format";

const gridCss = css({
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
	gap: 10,
	marginBottom: 16,
});

const cardCss = css({
	background: "#161b22",
	border: "1px solid #1e2630",
	borderRadius: 6,
	padding: 12,
	textAlign: "center",
});

const valueCss = css({
	fontSize: "1.4em",
	fontWeight: "bold",
	color: "#58a6ff",
});

const labelCss = css({
	fontSize: 11,
	color: "#6272a4",
	marginTop: 4,
});

function Card({
	value,
	label,
	color,
}: {
	value: string;
	label: string;
	color?: string;
}) {
	return (
		<div css={cardCss}>
			<div css={[valueCss, color ? { color } : undefined]}>{value}</div>
			<div css={labelCss}>{label}</div>
		</div>
	);
}

export function SimSummary({ result }: { result: SimResult }) {
	const agiReached = result.agiTime !== null;

	return (
		<div css={gridCss}>
			<Card
				value={formatTime(result.agiTime ?? result.endTime)}
				label={agiReached ? "AGI Reached" : "Sim Ended (no AGI)"}
			/>
			<Card value={`${result.purchaseCount}`} label="Total Purchases" />
			<Card value={formatTime(result.longestWait)} label="Longest Wait" />
			<Card
				value={`$${formatNumber(result.totalCash)}`}
				label="Lifetime Cash"
			/>
			<Card value={formatNumber(result.totalLoc)} label="Lifetime LoC" />
			<Card value={`${result.aiModelsOwned}`} label="AI Models" />
			<Card
				value={agiReached ? "YES" : "NO"}
				label="AGI Achieved"
				color={agiReached ? "#3fb950" : "#e06c75"}
			/>
		</div>
	);
}
