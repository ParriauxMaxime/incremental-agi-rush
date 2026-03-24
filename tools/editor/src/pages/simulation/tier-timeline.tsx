import { css } from "@emotion/react";
import { useMemo } from "react";

const containerCss = css({
	background: "#161b22",
	border: "1px solid #1e2630",
	borderRadius: 6,
	padding: 16,
});

const barContainerCss = css({
	display: "flex",
	height: 32,
	borderRadius: 4,
	overflow: "hidden",
	marginBottom: 8,
});

const legendCss = css({
	display: "flex",
	gap: 16,
	fontSize: 11,
	color: "#6272a4",
});

const legendItemCss = css({
	display: "flex",
	alignItems: "center",
	gap: 4,
});

const TIER_COLORS = [
	"#3fb950",
	"#58a6ff",
	"#c678dd",
	"#e5c07b",
	"#e06c75",
	"#56b6c2",
];

interface TierTimelineProps {
	tierTimes: Record<number, number>;
	endTime: number;
}

export function TierTimeline({ tierTimes, endTime }: TierTimelineProps) {
	const segments = useMemo(() => {
		const entries = Object.entries(tierTimes)
			.map(([k, v]) => ({ tier: Number(k), time: v }))
			.sort((a, b) => a.tier - b.tier);

		return entries.map((entry, i) => {
			const nextTime =
				i < entries.length - 1 ? entries[i + 1].time : endTime;
			const duration = nextTime - entry.time;
			const pct = (duration / endTime) * 100;
			return {
				tier: entry.tier,
				pct: Math.max(pct, 1),
				duration,
				color: TIER_COLORS[entry.tier % TIER_COLORS.length],
			};
		});
	}, [tierTimes, endTime]);

	return (
		<div css={containerCss}>
			<div css={barContainerCss}>
				{segments.map((s) => (
					<div
						key={s.tier}
						css={css({
							width: `${s.pct}%`,
							background: s.color,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							fontSize: 11,
							fontWeight: "bold",
							color: "#0d1117",
							minWidth: 20,
						})}
						title={`Tier ${s.tier}: ${Math.round(s.duration)}s`}
					>
						T{s.tier}
					</div>
				))}
			</div>
			<div css={legendCss}>
				{segments.map((s) => (
					<div key={s.tier} css={legendItemCss}>
						<div
							css={css({
								width: 10,
								height: 10,
								borderRadius: 2,
								background: s.color,
							})}
						/>
						Tier {s.tier}: {Math.round(s.duration)}s
					</div>
				))}
			</div>
		</div>
	);
}
