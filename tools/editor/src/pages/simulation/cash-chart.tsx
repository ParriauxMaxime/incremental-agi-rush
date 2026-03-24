import { css } from "@emotion/react";
import type { SimSnapshot } from "@shared/types";
import { useMemo } from "react";

const containerCss = css({
	background: "#161b22",
	border: "1px solid #1e2630",
	borderRadius: 6,
	padding: 16,
});

const CHART_W = 700;
const CHART_H = 200;
const PAD = { top: 10, right: 10, bottom: 30, left: 60 };

interface CashChartProps {
	snapshots: SimSnapshot[];
}

export function CashChart({ snapshots }: CashChartProps) {
	const { points, xTicks, yTicks, maxCash, maxTime } = useMemo(() => {
		if (snapshots.length === 0)
			return { points: "", xTicks: [], yTicks: [], maxCash: 0, maxTime: 0 };

		const mTime = snapshots[snapshots.length - 1].time;
		const mCash = Math.max(...snapshots.map((s) => s.cash), 1);

		const innerW = CHART_W - PAD.left - PAD.right;
		const innerH = CHART_H - PAD.top - PAD.bottom;

		const pts = snapshots
			.map((s) => {
				const x = PAD.left + (s.time / mTime) * innerW;
				const y = PAD.top + innerH - (s.cash / mCash) * innerH;
				return `${x},${y}`;
			})
			.join(" ");

		const xT = Array.from({ length: 5 }, (_, i) => {
			const t = (mTime / 4) * i;
			return {
				x: PAD.left + (t / mTime) * innerW,
				label: `${Math.floor(t / 60)}m`,
			};
		});

		const yT = Array.from({ length: 4 }, (_, i) => {
			const v = (mCash / 3) * i;
			return {
				y: PAD.top + innerH - (v / mCash) * innerH,
				label: v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v.toFixed(0)}`,
			};
		});

		return { points: pts, xTicks: xT, yTicks: yT, maxCash: mCash, maxTime: mTime };
	}, [snapshots]);

	if (snapshots.length === 0) return null;

	return (
		<div css={containerCss}>
			<svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} width="100%" preserveAspectRatio="xMidYMid meet">
				{/* grid lines */}
				{yTicks.map((t) => (
					<line
						key={t.label}
						x1={PAD.left}
						x2={CHART_W - PAD.right}
						y1={t.y}
						y2={t.y}
						stroke="#1e2630"
						strokeWidth={1}
					/>
				))}
				{/* axis labels */}
				{xTicks.map((t) => (
					<text
						key={t.label}
						x={t.x}
						y={CHART_H - 5}
						fill="#6272a4"
						fontSize={10}
						textAnchor="middle"
					>
						{t.label}
					</text>
				))}
				{yTicks.map((t) => (
					<text
						key={t.label}
						x={PAD.left - 8}
						y={t.y + 3}
						fill="#6272a4"
						fontSize={10}
						textAnchor="end"
					>
						{t.label}
					</text>
				))}
				{/* data line */}
				<polyline
					fill="none"
					stroke="#3fb950"
					strokeWidth={2}
					points={points}
				/>
			</svg>
		</div>
	);
}
