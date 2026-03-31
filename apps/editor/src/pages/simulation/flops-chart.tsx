import { css } from "@emotion/react";
import type { SimSnapshot } from "@flopsed/engine";
import { useMemo, useState } from "react";

const containerCss = css({
	background: "#161b22",
	border: "1px solid #1e2630",
	borderRadius: 6,
	padding: 16,
});

const legendCss = css({
	display: "flex",
	gap: 12,
	marginBottom: 8,
	flexWrap: "wrap",
});

const legendItemCss = css({
	display: "flex",
	alignItems: "center",
	gap: 4,
	fontSize: 11,
	cursor: "pointer",
	userSelect: "none",
	padding: "2px 6px",
	borderRadius: 3,
	"&:hover": { background: "#1e2630" },
});

const CHART_W = 700;
const CHART_H = 250;
const PAD = { top: 10, right: 10, bottom: 30, left: 60 };

function formatValue(v: number): string {
	if (v >= 1e12) return `${(v / 1e12).toFixed(0)}T`;
	if (v >= 1e9) return `${(v / 1e9).toFixed(0)}B`;
	if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
	if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
	return `${v.toFixed(0)}`;
}

interface Series {
	key: string;
	label: string;
	color: string;
	dash?: string;
	getValue: (s: SimSnapshot) => number;
}

const ALL_SERIES: Series[] = [
	{
		key: "cash",
		label: "Cash",
		color: "#e5c07b",
		getValue: (s) => s.cash,
	},
	{
		key: "flops",
		label: "FLOPS",
		color: "#c678dd",
		getValue: (s) => s.flops,
	},
	{
		key: "locPerSec",
		label: "LoC/s",
		color: "#61afef",
		dash: "4 2",
		getValue: (s) => s.locPerSec,
	},
	{
		key: "cashPerSec",
		label: "Cash/s",
		color: "#e5c07b",
		dash: "2 2",
		getValue: (s) => s.cashPerSec,
	},
	{
		key: "tokensPerSec",
		label: "Tokens/s",
		color: "#e5a54b",
		dash: "6 3",
		getValue: (s) => s.tokensPerSec,
	},
];

const DEFAULT_ENABLED = new Set(["cash", "flops", "locPerSec", "tokensPerSec"]);

interface FlopsChartProps {
	snapshots: SimSnapshot[];
}

export function FlopsChart({ snapshots }: FlopsChartProps) {
	const [enabled, setEnabled] = useState<Set<string>>(DEFAULT_ENABLED);

	const toggle = (key: string) => {
		setEnabled((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	};

	const { seriesPoints, xTicks, yTicks } = useMemo(() => {
		if (snapshots.length === 0)
			return { seriesPoints: {}, xTicks: [], yTicks: [] };

		const activeSeries = ALL_SERIES.filter((s) => enabled.has(s.key));
		const mTime = snapshots[snapshots.length - 1].time;

		// Collect all positive values across all enabled series for axis range
		const allValues: number[] = [];
		for (const series of activeSeries) {
			for (const snap of snapshots) {
				const v = series.getValue(snap);
				if (v > 0) allValues.push(v);
			}
		}
		if (allValues.length === 0)
			return { seriesPoints: {}, xTicks: [], yTicks: [] };

		const minLog = Math.floor(Math.log10(Math.min(...allValues)));
		const maxLog = Math.ceil(Math.log10(Math.max(...allValues)));
		const logRange = Math.max(maxLog - minLog, 1);

		const innerW = CHART_W - PAD.left - PAD.right;
		const innerH = CHART_H - PAD.top - PAD.bottom;

		const toPoint = (time: number, value: number) => {
			const x = PAD.left + (time / mTime) * innerW;
			const logY = (Math.log10(Math.max(value, 1)) - minLog) / logRange;
			const y = PAD.top + innerH - logY * innerH;
			return `${x},${y}`;
		};

		const pts: Record<string, string> = {};
		for (const series of activeSeries) {
			pts[series.key] = snapshots
				.filter((s) => series.getValue(s) > 0)
				.map((s) => toPoint(s.time, series.getValue(s)))
				.join(" ");
		}

		const xT = Array.from({ length: 5 }, (_, i) => {
			const t = (mTime / 4) * i;
			return {
				x: PAD.left + (t / mTime) * innerW,
				label: `${Math.floor(t / 60)}m`,
			};
		});

		const yT: { y: number; label: string }[] = [];
		for (let exp = minLog; exp <= maxLog; exp++) {
			const logY = (exp - minLog) / logRange;
			yT.push({
				y: PAD.top + innerH - logY * innerH,
				label: formatValue(10 ** exp),
			});
		}

		return { seriesPoints: pts, xTicks: xT, yTicks: yT };
	}, [snapshots, enabled]);

	if (snapshots.length === 0) return null;

	return (
		<div css={containerCss}>
			<div css={legendCss}>
				{ALL_SERIES.map((s) => (
					<div
						key={s.key}
						css={legendItemCss}
						style={{ opacity: enabled.has(s.key) ? 1 : 0.35 }}
						onClick={() => toggle(s.key)}
					>
						<span
							style={{
								display: "inline-block",
								width: 14,
								height: 3,
								background: s.color,
								borderRadius: 1,
							}}
						/>
						<span style={{ color: s.color }}>{s.label}</span>
					</div>
				))}
			</div>
			<svg
				viewBox={`0 0 ${CHART_W} ${CHART_H}`}
				width="100%"
				preserveAspectRatio="xMidYMid meet"
			>
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
				{ALL_SERIES.filter((s) => enabled.has(s.key)).map((s) => (
					<polyline
						key={s.key}
						fill="none"
						stroke={s.color}
						strokeWidth={s.dash ? 1.5 : 2}
						strokeDasharray={s.dash}
						points={seriesPoints[s.key] ?? ""}
					/>
				))}
			</svg>
		</div>
	);
}
