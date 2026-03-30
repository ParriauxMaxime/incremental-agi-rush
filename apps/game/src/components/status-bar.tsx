import { css } from "@emotion/react";
import { useAudioStore } from "@modules/audio";
import { tiers, useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";

const barCss = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	padding: "0 12px",
	fontSize: 12,
	flexShrink: 0,
	height: 22,
	boxShadow: "0 -1px 4px rgba(0,0,0,0.2)",
	zIndex: 2,
	position: "relative",
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

const muteBtnCss = css({
	background: "none",
	border: "none",
	color: "inherit",
	cursor: "pointer",
	padding: "0 2px",
	fontSize: 12,
	opacity: 0.7,
	"&:hover": { opacity: 1 },
});

export function StatusBar() {
	const cash = useGameStore((s) => s.cash);
	const loc = useGameStore((s) => s.loc);
	const flops = useGameStore((s) => s.flops);
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);
	const tokens = useGameStore((s) => s.tokens);
	const currentTierIndex = useGameStore((s) => s.currentTierIndex);
	const muted = useAudioStore((s) => s.muted);
	const toggleMute = useAudioStore((s) => s.toggleMute);
	const theme = useIdeTheme();
	const { t } = useTranslation();

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
				{aiUnlocked && (
					<span css={statCss}>
						{t("status_bar.tokens", { count: formatNumber(tokens) })}
					</span>
				)}
				<span css={statCss}>
					{t("status_bar.loc", { count: formatNumber(loc) })}
				</span>
				<span css={statCss}>
					{t("status_bar.flops", { count: formatNumber(flops) })}
				</span>
			</div>
			<div css={rightCss}>
				<span>
					{t("status_bar.cash_per_loc", { rate: tier?.cashPerLoc ?? 0 })}
				</span>
				<button
					type="button"
					css={muteBtnCss}
					onClick={toggleMute}
					title={muted ? t("settings.unmute") : t("settings.mute")}
				>
					{muted ? "🔇" : "🔊"}
				</button>
				<span>{t("status_bar.python")}</span>
				<span>{t("status_bar.utf8")}</span>
			</div>
		</div>
	);
}
