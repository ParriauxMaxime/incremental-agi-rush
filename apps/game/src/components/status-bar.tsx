import { css } from "@emotion/react";
import { tiers, useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useEffect, useRef, useState } from "react";
import { useIdeTheme } from "../hooks/use-ide-theme";

const barCss = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	padding: "0 12px",
	fontSize: 12,
	flexShrink: 0,
	height: 22,
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
	opacity: 0.7,
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
	const theme = useIdeTheme();

	const locRate = useRatePerSec(totalLoc);
	const cashRate = useRatePerSec(totalCash);
	const execRate = useRatePerSec(totalExecutedLoc);

	const tier = tiers[currentTierIndex];

	return (
		<div
			css={barCss}
			style={{
				background: theme.statusBarBg,
				color: theme.statusBarFg,
			}}
		>
			<div css={leftCss}>
				<span css={statCss}>⚡ {tier?.name ?? "—"}</span>
				<span css={statCss}>
					${formatNumber(cash, true)}
					{cashRate > 0.1 && (
						<span css={rateCss}> (+${formatNumber(cashRate, true)}/s)</span>
					)}
				</span>
				<span css={statCss}>
					◇ {formatNumber(loc)} LoC
					{locRate > 0.1 && (
						<span css={rateCss}> (+{formatNumber(locRate)}/s)</span>
					)}
				</span>
				<span css={statCss}>
					⚡ {formatNumber(flops)} FLOPS
					{execRate > 0.1 && (
						<span css={rateCss}> ({formatNumber(execRate)} exec/s)</span>
					)}
				</span>
			</div>
			<div css={rightCss}>
				<span>${tier?.cashPerLoc ?? 0}/loc</span>
				<span>Python</span>
				<span>UTF-8</span>
			</div>
		</div>
	);
}
