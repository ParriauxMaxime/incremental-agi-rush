import { css } from "@emotion/react";
import { tiers, useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
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

export function StatusBar() {
	const cash = useGameStore((s) => s.cash);
	const loc = useGameStore((s) => s.loc);
	const flops = useGameStore((s) => s.flops);
	const currentTierIndex = useGameStore((s) => s.currentTierIndex);
	const theme = useIdeTheme();

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
				<span css={statCss}>${formatNumber(cash, true)}</span>
				<span css={statCss}>◇ {formatNumber(loc)} LoC</span>
				<span css={statCss}>⚡ {formatNumber(flops)} FLOPS</span>
			</div>
			<div css={rightCss}>
				<span>${tier?.cashPerLoc ?? 0}/loc</span>
				<span>Python</span>
				<span>UTF-8</span>
			</div>
		</div>
	);
}
