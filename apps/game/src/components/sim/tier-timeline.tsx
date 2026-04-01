import { css } from "@emotion/react";
import { formatTime } from "@utils/format";

const barCss = css({
	display: "flex",
	height: 40,
	borderRadius: 4,
	overflow: "hidden",
	marginBottom: 4,
});

const segmentCss = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	fontSize: 10,
	fontWeight: "bold",
	color: "#fff",
	textShadow: "0 1px 2px rgba(0,0,0,0.5)",
	minWidth: 2,
	overflow: "hidden",
});

const timeLabelsCss = css({
	display: "flex",
	justifyContent: "space-between",
	fontSize: 10,
	color: "#484f58",
	marginTop: 4,
	marginBottom: 16,
});

const TIER_COLORS = [
	"#5c6b8a",
	"#2a9d8f",
	"#2d8a4e",
	"#d4782f",
	"#9a5cd0",
	"#d63a4a",
];

const TIER_NAMES = [
	"Garage",
	"Freelancing",
	"Startup",
	"Tech Co",
	"AI Lab",
	"AGI Race",
];

export function TierTimeline({
	tierTimes,
	endTime,
}: {
	tierTimes: Record<number, number>;
	endTime: number;
}) {
	const total = Math.max(endTime, 1);
	const entries = Object.entries(tierTimes)
		.map(([idx, time]) => ({ index: Number(idx), time: time as number }))
		.sort((a, b) => a.time - b.time);

	const segments = entries.map((entry, i) => {
		const start = entry.time;
		const end = i + 1 < entries.length ? entries[i + 1].time : total;
		const pct = ((end - start) / total) * 100;
		return {
			index: entry.index,
			start,
			end,
			pct,
			name: TIER_NAMES[entry.index] ?? `T${entry.index}`,
			color: TIER_COLORS[entry.index] ?? TIER_COLORS[5],
		};
	});

	const maxMin = Math.ceil(total / 60);

	return (
		<>
			<div css={barCss}>
				{segments.map((s) => (
					<div
						key={s.index}
						css={segmentCss}
						style={{ width: `${s.pct}%`, background: s.color }}
						title={`${s.name}: ${formatTime(s.start)} - ${formatTime(s.end)}`}
					>
						{s.pct > 8 ? s.name : ""}
					</div>
				))}
			</div>
			<div css={timeLabelsCss}>
				{Array.from({ length: Math.floor(maxMin / 5) + 1 }, (_, i) => (
					<span key={i}>{i * 5}m</span>
				))}
			</div>
		</>
	);
}
