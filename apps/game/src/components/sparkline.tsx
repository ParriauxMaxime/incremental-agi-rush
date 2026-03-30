import { css } from "@emotion/react";
import type { TierTransition } from "@modules/game";
import { useMemo } from "react";

const svgCss = css({ width: "100%", height: 32, display: "block" });

const TIER_COLORS = [
	"#484f58",
	"#3fb950",
	"#58a6ff",
	"#d2a8ff",
	"#f0883e",
	"#f85149",
];

interface SparklineProps {
	data: number[];
	color: string;
	data2?: number[];
	color2?: string;
	tierTransitions?: TierTransition[];
	totalTime?: number;
}

export function Sparkline({
	data,
	color,
	data2,
	color2,
	tierTransitions,
	totalTime,
}: SparklineProps) {
	const { points, points2, markers } = useMemo(() => {
		const W = 256;
		const H = 32;
		const allValues = [...data, ...(data2 ?? [])];
		const maxVal = Math.max(1, ...allValues);

		const toPoints = (values: number[]) =>
			values
				.map((v, i) => {
					const x = values.length > 1 ? (i / (values.length - 1)) * W : W / 2;
					const y = H - (v / maxVal) * (H - 4) - 2;
					return `${x},${y}`;
				})
				.join(" ");

		const pts = toPoints(data);
		const pts2 = data2 ? toPoints(data2) : undefined;

		const mkrs: Array<{ x: number; color: string; label: string }> = [];
		if (tierTransitions && totalTime && totalTime > 0) {
			for (const tt of tierTransitions) {
				if (tt.tierIndex === 0) continue;
				const x = (tt.enteredAt / totalTime) * W;
				if (x > 0 && x < W) {
					mkrs.push({
						x,
						color: TIER_COLORS[tt.tierIndex] ?? "#484f58",
						label: `T${tt.tierIndex}`,
					});
				}
			}
		}

		return { points: pts, points2: pts2, markers: mkrs };
	}, [data, data2, tierTransitions, totalTime]);

	const areaPoints = `0,32 ${points} 256,32`;

	return (
		<svg css={svgCss} viewBox="0 0 256 32" preserveAspectRatio="none">
			{markers.map((m) => (
				<g key={m.label}>
					<line
						x1={m.x}
						y1={0}
						x2={m.x}
						y2={32}
						stroke={m.color}
						strokeWidth={0.5}
						strokeDasharray="2,2"
					/>
					<text x={m.x + 2} y={8} fill={m.color} fontSize={5}>
						{m.label}
					</text>
				</g>
			))}
			<polygon fill={color} opacity={0.12} points={areaPoints} />
			<polyline fill="none" stroke={color} strokeWidth={1.5} points={points} />
			{points2 && (
				<polyline
					fill="none"
					stroke={color2 ?? "#888"}
					strokeWidth={1.2}
					strokeDasharray="3,2"
					points={points2}
				/>
			)}
		</svg>
	);
}
