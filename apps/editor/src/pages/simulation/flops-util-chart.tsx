import { css } from "@emotion/react";
import type { SimPurchase, SimSnapshot } from "@flopsed/engine";
import { useMemo } from "react";

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
	fontSize: 11,
});

const legendItemCss = css({
	display: "flex",
	alignItems: "center",
	gap: 4,
});

const CHART_W = 700;
const CHART_H = 280;
const PAD = { top: 10, right: 10, bottom: 30, left: 60 };

const TIER_COLORS = [
	"#5c6b8a",
	"#2a9d8f",
	"#2d8a4e",
	"#d4782f",
	"#9a5cd0",
	"#d63a4a",
];

function formatValue(v: number): string {
	if (v >= 1e12) return `${(v / 1e12).toFixed(0)}T`;
	if (v >= 1e9) return `${(v / 1e9).toFixed(0)}B`;
	if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
	if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
	return `${v.toFixed(0)}`;
}

interface FlopsUtilChartProps {
	snapshots: SimSnapshot[];
	purchases: SimPurchase[];
	aiModels: Array<{
		id: string;
		name: string;
		version: string;
		flopsCost: number;
	}>;
}

interface DataPoint {
	time: number;
	tier: number;
	totalFlops: number;
	execUsed: number;
	aiUsed: number;
	wasted: number;
}

export function FlopsUtilChart({
	snapshots,
	purchases,
	aiModels,
}: FlopsUtilChartProps) {
	const data = useMemo((): DataPoint[] => {
		if (snapshots.length === 0) return [];

		// Build model ownership timeline
		const modelTimeline: Array<{ time: number; modelId: string }> = [];
		const owned = new Set<string>();
		for (const p of purchases) {
			if (p.type === "ai") {
				const model = aiModels.find(
					(m) => `${m.name} ${m.version}` === p.name,
				);
				if (model && !owned.has(model.id)) {
					owned.add(model.id);
					modelTimeline.push({ time: p.time, modelId: model.id });
				}
			}
			if (p.type === "tech") {
				const model = aiModels.find(
					(m) =>
						p.name === `${m.name} ${m.version}` ||
						p.name === m.version,
				);
				if (model && !owned.has(model.id)) {
					owned.add(model.id);
					modelTimeline.push({ time: p.time, modelId: model.id });
				}
			}
		}

		return snapshots.map((s) => {
			const models = modelTimeline
				.filter((mp) => mp.time <= s.time)
				.map((mp) => aiModels.find((m) => m.id === mp.modelId)!)
				.filter(Boolean);

			const totalModelCap = models.reduce((sum, m) => sum + m.flopsCost, 0);
			const aiDemandFrac =
				s.flops > 0 ? Math.min(0.9, totalModelCap / s.flops) : 0;
			const slider = Math.max(0.1, 1 - aiDemandFrac);
			const execBudget = s.flops * slider;
			const aiBudget = s.flops * (1 - slider);

			const sorted = [...models].sort((a, b) => a.flopsCost - b.flopsCost);
			let remaining = aiBudget;
			let aiUsed = 0;
			for (const m of sorted) {
				const allocated = Math.min(m.flopsCost, remaining);
				remaining -= allocated;
				aiUsed += allocated;
			}
			const execUsed = Math.min(execBudget, s.locPerSec);

			return {
				time: s.time,
				tier: s.tier,
				totalFlops: s.flops,
				execUsed,
				aiUsed,
				wasted: s.flops - execUsed - aiUsed,
			};
		});
	}, [snapshots, purchases, aiModels]);

	const { paths, xTicks, yTicks, wastePctPoints, tierMarkers } =
		useMemo(() => {
			if (data.length === 0)
				return {
					paths: { total: "", exec: "", ai: "", execFill: "", aiFill: "", wasteFill: "" },
					xTicks: [],
					yTicks: [],
					wastePctPoints: "",
					tierMarkers: [] as Array<{ x: number; tier: number }>,
				};

			const maxTime = data[data.length - 1].time;
			const allVals = data.map((d) => d.totalFlops).filter((v) => v > 0);
			if (allVals.length === 0)
				return {
					paths: { total: "", exec: "", ai: "", execFill: "", aiFill: "", wasteFill: "" },
					xTicks: [],
					yTicks: [],
					wastePctPoints: "",
					tierMarkers: [],
				};

			const minLog = Math.floor(Math.log10(Math.min(...allVals)));
			const maxLog = Math.ceil(
				Math.log10(Math.max(...allVals, ...data.map((d) => d.execUsed + d.aiUsed).filter((v) => v > 0))),
			);
			const logRange = Math.max(maxLog - minLog, 1);
			const innerW = CHART_W - PAD.left - PAD.right;
			const innerH = CHART_H - PAD.top - PAD.bottom;

			const toX = (t: number) => PAD.left + (t / maxTime) * innerW;
			const toY = (v: number) => {
				if (v <= 0) return PAD.top + innerH;
				const logY = (Math.log10(v) - minLog) / logRange;
				return PAD.top + innerH - logY * innerH;
			};
			const baseY = PAD.top + innerH;

			// Paths
			const totalPts = data
				.filter((d) => d.totalFlops > 0)
				.map((d) => `${toX(d.time)},${toY(d.totalFlops)}`)
				.join(" ");
			const execPts = data
				.filter((d) => d.execUsed > 0)
				.map((d) => `${toX(d.time)},${toY(d.execUsed)}`)
				.join(" ");
			const aiPts = data
				.filter((d) => d.aiUsed > 0)
				.map((d) => `${toX(d.time)},${toY(d.aiUsed)}`)
				.join(" ");

			// Fill areas
			const execFillPts = data.filter((d) => d.execUsed > 0);
			const execFill =
				execFillPts.length > 0
					? execFillPts.map((d) => `${toX(d.time)},${toY(d.execUsed)}`).join(" ") +
						` ${toX(execFillPts[execFillPts.length - 1].time)},${baseY} ${toX(execFillPts[0].time)},${baseY}`
					: "";

			const aiFillPts = data.filter((d) => d.aiUsed > 0);
			const aiFill =
				aiFillPts.length > 0
					? aiFillPts.map((d) => `${toX(d.time)},${toY(d.aiUsed)}`).join(" ") +
						` ${toX(aiFillPts[aiFillPts.length - 1].time)},${baseY} ${toX(aiFillPts[0].time)},${baseY}`
					: "";

			// Waste fill (between total and used)
			const wasteTopPts = data.filter((d) => d.totalFlops > 0);
			const wasteBottomPts = data.filter(
				(d) => d.totalFlops > 0 && d.execUsed + d.aiUsed > 0,
			);
			let wasteFill = "";
			if (wasteTopPts.length > 1) {
				wasteFill =
					wasteTopPts.map((d) => `${toX(d.time)},${toY(d.totalFlops)}`).join(" ");
				const reversed = [...wasteTopPts].reverse();
				wasteFill +=
					" " +
					reversed
						.map(
							(d) =>
								`${toX(d.time)},${toY(Math.max(1, d.execUsed + d.aiUsed))}`,
						)
						.join(" ");
			}

			// Waste % line (secondary chart at bottom)
			const wastePct = data
				.map((d) => {
					const pct =
						d.totalFlops > 0 ? (d.wasted / d.totalFlops) * 100 : 0;
					return `${toX(d.time)},${PAD.top + innerH - (pct / 100) * 40}`;
				})
				.join(" ");

			// X ticks
			const xT = Array.from({ length: 5 }, (_, i) => ({
				x: PAD.left + (i / 4) * innerW,
				label: `${Math.floor(((maxTime / 4) * i) / 60)}m`,
			}));

			// Y ticks
			const yT: Array<{ y: number; label: string }> = [];
			for (let exp = minLog; exp <= maxLog; exp += 2) {
				yT.push({
					y: toY(10 ** exp),
					label: formatValue(10 ** exp),
				});
			}

			// Tier markers
			const markers: Array<{ x: number; tier: number }> = [];
			let prevTier = -1;
			for (const d of data) {
				if (d.tier !== prevTier) {
					markers.push({ x: toX(d.time), tier: d.tier });
					prevTier = d.tier;
				}
			}

			return {
				paths: {
					total: totalPts,
					exec: execPts,
					ai: aiPts,
					execFill,
					aiFill,
					wasteFill,
				},
				xTicks: xT,
				yTicks: yT,
				wastePctPoints: wastePct,
				tierMarkers: markers,
			};
		}, [data]);

	if (snapshots.length === 0) return null;

	// Compute summary stats
	const last = data[data.length - 1];
	const wastePct =
		last && last.totalFlops > 0
			? Math.round((last.wasted / last.totalFlops) * 100)
			: 0;

	return (
		<div css={containerCss}>
			<div css={legendCss}>
				<div css={legendItemCss}>
					<span
						style={{
							display: "inline-block",
							width: 14,
							height: 3,
							background: "#e5c07b",
							borderRadius: 1,
						}}
					/>
					<span style={{ color: "#e5c07b" }}>Exec Used</span>
				</div>
				<div css={legendItemCss}>
					<span
						style={{
							display: "inline-block",
							width: 14,
							height: 3,
							background: "#61afef",
							borderRadius: 1,
						}}
					/>
					<span style={{ color: "#61afef" }}>AI Used</span>
				</div>
				<div css={legendItemCss}>
					<span
						style={{
							display: "inline-block",
							width: 14,
							height: 3,
							background: "#e6edf3",
							borderRadius: 1,
							opacity: 0.3,
						}}
					/>
					<span style={{ color: "#8b949e" }}>Total Available</span>
				</div>
				<div css={legendItemCss}>
					<span
						style={{
							display: "inline-block",
							width: 14,
							height: 8,
							background: "#f4434633",
							borderRadius: 1,
						}}
					/>
					<span style={{ color: "#f44346" }}>Wasted</span>
				</div>
				{wastePct > 0 && (
					<span
						style={{
							marginLeft: "auto",
							color: wastePct > 80 ? "#f44346" : "#8b949e",
							fontWeight: wastePct > 80 ? 600 : 400,
						}}
					>
						Endgame waste: {wastePct}%
					</span>
				)}
			</div>
			<svg
				viewBox={`0 0 ${CHART_W} ${CHART_H}`}
				width="100%"
				preserveAspectRatio="xMidYMid meet"
			>
				{/* Grid */}
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

				{/* Tier markers */}
				{tierMarkers.map((m) => (
					<g key={m.tier}>
						<line
							x1={m.x}
							x2={m.x}
							y1={PAD.top}
							y2={CHART_H - PAD.bottom}
							stroke={TIER_COLORS[m.tier]}
							strokeWidth={1}
							strokeDasharray="4 4"
						/>
						<text
							x={m.x + 3}
							y={PAD.top + 10}
							fill={TIER_COLORS[m.tier]}
							fontSize={9}
							fontWeight="bold"
						>
							T{m.tier}
						</text>
					</g>
				))}

				{/* Waste fill */}
				{paths.wasteFill && (
					<polygon
						points={paths.wasteFill}
						fill="#f4434622"
					/>
				)}

				{/* Exec fill */}
				{paths.execFill && (
					<polygon points={paths.execFill} fill="#e5c07b22" />
				)}

				{/* AI fill */}
				{paths.aiFill && (
					<polygon points={paths.aiFill} fill="#61afef22" />
				)}

				{/* Lines */}
				{paths.total && (
					<polyline
						fill="none"
						stroke="#e6edf333"
						strokeWidth={1}
						points={paths.total}
					/>
				)}
				{paths.exec && (
					<polyline
						fill="none"
						stroke="#e5c07b"
						strokeWidth={2}
						points={paths.exec}
					/>
				)}
				{paths.ai && (
					<polyline
						fill="none"
						stroke="#61afef"
						strokeWidth={2}
						points={paths.ai}
					/>
				)}
			</svg>
		</div>
	);
}
