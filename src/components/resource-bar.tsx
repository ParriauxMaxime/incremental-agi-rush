import { css } from "@emotion/react";
import { useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useEffect, useRef, useState } from "react";

const barStyle = css({
	display: "flex",
	gap: 8,
	padding: "14px 12px 10px",
	borderBottom: "1px solid #1e2630",
	background: "#161b22",
});

const statCellCss = css({
	flex: 1,
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	gap: 2,
	minWidth: 0,
});

const valueCss = css({
	fontSize: 22,
	fontWeight: "bold",
	lineHeight: 1.1,
	fontVariantNumeric: "tabular-nums",
	whiteSpace: "nowrap",
});

const labelCss = css({
	fontSize: 10,
	textTransform: "uppercase",
	letterSpacing: 0.5,
	color: "#6272a4",
});

const rateCss = css({
	fontSize: 10,
	color: "#3fb950",
	minHeight: 14,
});

const dividerCss = css({
	width: 1,
	background: "#1e2630",
	alignSelf: "stretch",
	margin: "2px 0",
});

// ── Rate tracker: snapshot every 1s, display delta ──

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

export function ResourceBar() {
	const loc = useGameStore((s) => s.loc);
	const cash = useGameStore((s) => s.cash);
	const totalLoc = useGameStore((s) => s.totalLoc);
	const totalCash = useGameStore((s) => s.totalCash);
	const totalExecutedLoc = useGameStore((s) => s.totalExecutedLoc);
	const flops = useGameStore((s) => s.flops);

	const locRate = useRatePerSec(totalLoc);
	const cashRate = useRatePerSec(totalCash);
	const execRate = useRatePerSec(totalExecutedLoc);

	return (
		<div css={barStyle}>
			<div css={statCellCss}>
				<div css={[valueCss, { color: "#58a6ff" }]}>{formatNumber(loc)}</div>
				<div css={labelCss}>LoC</div>
				<div css={rateCss}>
					{locRate > 0.1 ? `${formatNumber(locRate)} loc/s` : ""}
				</div>
			</div>

			<div css={dividerCss} />

			<div css={statCellCss}>
				<div css={[valueCss, { color: "#d19a66" }]}>
					${formatNumber(cash, true)}
				</div>
				<div css={labelCss}>Cash</div>
				<div css={rateCss}>
					{cashRate > 0.1 ? `+$${formatNumber(cashRate, true)}/s` : ""}
				</div>
			</div>

			<div css={dividerCss} />

			<div css={statCellCss}>
				<div css={[valueCss, { color: "#c678dd" }]}>{formatNumber(flops)}</div>
				<div css={labelCss}>FLOPS</div>
				<div css={rateCss}>
					{execRate > 0.1 ? `${formatNumber(execRate)} loc/s` : ""}
				</div>
			</div>
		</div>
	);
}
