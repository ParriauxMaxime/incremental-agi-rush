import type { SimPurchase } from "@agi-rush/engine";
import { css } from "@emotion/react";
import { useMemo, useState } from "react";

const containerCss = css({
	background: "#161b22",
	border: "1px solid #1e2630",
	borderRadius: 6,
	padding: 16,
});

const purchaseRowCss = css({
	position: "relative",
	height: 24,
	marginBottom: 4,
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
	flexWrap: "wrap",
});

const legendItemCss = css({
	display: "flex",
	alignItems: "center",
	gap: 4,
});

const tooltipCss = css({
	position: "absolute",
	bottom: "100%",
	transform: "translateX(-50%)",
	background: "#2a2a4a",
	color: "#e0e0e0",
	fontSize: 10,
	padding: "3px 6px",
	borderRadius: 3,
	whiteSpace: "nowrap",
	pointerEvents: "none",
	zIndex: 10,
});

const TIER_COLORS = [
	"#3fb950",
	"#58a6ff",
	"#c678dd",
	"#e5c07b",
	"#e06c75",
	"#56b6c2",
];

const PURCHASE_COLORS: Record<string, string> = {
	upgrade: "#3fb950",
	tech: "#58a6ff",
	tier: "#e5c07b",
	ai: "#c678dd",
};

interface TierTimelineProps {
	tierTimes: Record<number, number>;
	endTime: number;
	purchases?: SimPurchase[];
}

export function TierTimeline({ tierTimes, endTime, purchases }: TierTimelineProps) {
	const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

	const segments = useMemo(() => {
		const entries = Object.entries(tierTimes)
			.map(([k, v]) => ({ tier: Number(k), time: v }))
			.sort((a, b) => a.tier - b.tier);

		return entries.map((entry, i) => {
			const nextTime = i < entries.length - 1 ? entries[i + 1].time : endTime;
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
			{purchases && purchases.length > 0 && (
				<div css={purchaseRowCss}>
					{purchases.map((p, i) => {
						const left = (p.time / endTime) * 100;
						const color = PURCHASE_COLORS[p.type] ?? "#888";
						return (
							<div
								key={i}
								onMouseEnter={() => setHoveredIdx(i)}
								onMouseLeave={() => setHoveredIdx(null)}
								css={css({
									position: "absolute",
									left: `${left}%`,
									bottom: 0,
									width: 2,
									height: 12,
									background: color,
									opacity: 0.7,
									cursor: "default",
									"&:hover": { opacity: 1, height: 18 },
								})}
							>
								{hoveredIdx === i && (
									<div css={tooltipCss}>
										{p.name} ({Math.round(p.time)}s)
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}
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
				{purchases && (
					<>
						<div css={css({ width: 1, background: "#2a2a4a", margin: "0 4px" })} />
						{Object.entries(PURCHASE_COLORS).map(([type, color]) => (
							<div key={type} css={legendItemCss}>
								<div
									css={css({
										width: 2,
										height: 10,
										background: color,
									})}
								/>
								{type}
							</div>
						))}
					</>
				)}
			</div>
		</div>
	);
}
