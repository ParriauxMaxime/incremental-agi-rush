import { css } from "@emotion/react";
import { tiers, useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useEffect, useRef, useState } from "react";

const barCss = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	padding: "3px 12px",
	background: "#0d1117",
	borderTop: "1px solid #1e2630",
	fontSize: 13,
	fontFamily: "'Courier New', monospace",
	flexShrink: 0,
	height: 28,
});

const leftCss = css({
	display: "flex",
	alignItems: "center",
	gap: 16,
});

const rightCss = css({
	display: "flex",
	alignItems: "center",
	gap: 16,
});

const statCss = css({
	display: "flex",
	alignItems: "center",
	gap: 4,
	whiteSpace: "nowrap",
	fontVariantNumeric: "tabular-nums",
});

const rateCss = css({
	color: "#484f58",
	fontSize: 11,
});

function useRatePerSec(value: number): number {
	const valueRef = useRef(value);
	valueRef.current = value;
	const prevRef = useRef(value);
	const [rate, setRate] = useState(0);

	useEffect(() => {
		const id = setInterval(() => {
			setRate(Math.max(0, valueRef.current - prevRef.current));
			prevRef.current = valueRef.current;
		}, 1000);
		return () => clearInterval(id);
	}, []);

	return rate;
}

export function StatusBar() {
	const cash = useGameStore((s) => s.cash);
	const loc = useGameStore((s) => s.loc);
	const totalLoc = useGameStore((s) => s.totalLoc);
	const totalCash = useGameStore((s) => s.totalCash);
	const totalExecutedLoc = useGameStore((s) => s.totalExecutedLoc);
	const flops = useGameStore((s) => s.flops);
	const currentTierIndex = useGameStore((s) => s.currentTierIndex);
	const autoLocPerSec = useGameStore((s) => s.autoLocPerSec);

	const locRate = useRatePerSec(totalLoc);
	const cashRate = useRatePerSec(totalCash);
	const execRate = useRatePerSec(totalExecutedLoc);

	const tier = tiers[currentTierIndex];

	return (
		<div css={barCss}>
			<div css={leftCss}>
				<span css={statCss}>
					<span style={{ color: "#3fb950" }}>${formatNumber(cash, true)}</span>
					{cashRate > 0.1 && (
						<span css={rateCss}>(+${formatNumber(cashRate, true)}/s)</span>
					)}
				</span>
				<span css={statCss}>
					<span style={{ color: "#58a6ff" }}>◇ {formatNumber(loc)} LoC</span>
					{locRate > 0.1 && (
						<span css={rateCss}>(+{formatNumber(locRate)}/s)</span>
					)}
				</span>
				<span css={statCss}>
					<span style={{ color: "#fbbf24" }}>
						⚡ {formatNumber(flops)} FLOPS
					</span>
					{execRate > 0.1 && (
						<span css={rateCss}>({formatNumber(execRate)} exec/s)</span>
					)}
				</span>
				<span css={statCss}>
					<span style={{ color: "#c084fc" }}>
						{formatNumber(autoLocPerSec)} loc/s
					</span>
				</span>
			</div>
			<div css={rightCss}>
				<span style={{ color: "#8b949e" }}>{tier?.name ?? "—"}</span>
				<span style={{ color: "#484f58" }}>${tier?.cashPerLoc ?? 0}/loc</span>
				<span style={{ color: "#484f58" }}>Python</span>
			</div>
		</div>
	);
}
