import { css } from "@emotion/react";
import { useAudioStore } from "@modules/audio";
import { tiers, useGameStore, useUiStore } from "@modules/game";
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
	contain: "layout style",
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

const toggleBtnCss = css({
	background: "none",
	border: "none",
	color: "inherit",
	cursor: "pointer",
	padding: "0 2px",
	fontSize: 12,
	display: "flex",
	alignItems: "center",
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
	const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
	const statsPanelCollapsed = useUiStore((s) => s.statsPanelCollapsed);
	const sidebarUnlocked = useGameStore(
		(s) => (s.ownedTechNodes.unlock_sidebar ?? 0) > 0,
	);
	const statsPanelUnlocked = useGameStore(
		(s) => (s.ownedTechNodes.unlock_stats_panel ?? 0) > 0,
	);
	const prestigeCount = useGameStore((s) => s.prestigeCount);
	const prestigeMultiplier = useGameStore((s) => s.prestigeMultiplier);
	const toggleSidebar = useUiStore((s) => s.toggleSidebar);
	const toggleStatsPanel = useUiStore((s) => s.toggleStatsPanel);
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
				<span css={statCss}>
					⚡ {tier?.name ?? "—"}
					{prestigeCount > 0 && (
						<span
							css={{
								marginLeft: 8,
								color: "#d29922",
								fontWeight: "bold",
								fontSize: 11,
							}}
						>
							{"★".repeat(prestigeCount)} {prestigeMultiplier.toFixed(1)}x
						</span>
					)}
				</span>
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
				{sidebarUnlocked && (
					<button
						type="button"
						css={toggleBtnCss}
						style={{ opacity: sidebarCollapsed ? 0.5 : 0.8 }}
						onClick={toggleSidebar}
						title={t("sidebar.title")}
					>
						<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
							<rect
								x="1.5"
								y="2.5"
								width="13"
								height="11"
								rx="1"
								stroke="currentColor"
								strokeWidth="1.2"
							/>
							<line
								x1="5"
								y1="3"
								x2="5"
								y2="13"
								stroke="currentColor"
								strokeWidth="1.2"
							/>
						</svg>
					</button>
				)}
				{statsPanelUnlocked && (
					<button
						type="button"
						css={toggleBtnCss}
						style={{ opacity: statsPanelCollapsed ? 0.5 : 0.8 }}
						onClick={toggleStatsPanel}
						title={t("stats_panel.title")}
					>
						<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
							<rect
								x="1.5"
								y="2.5"
								width="13"
								height="11"
								rx="1"
								stroke="currentColor"
								strokeWidth="1.2"
							/>
							<line
								x1="11"
								y1="3"
								x2="11"
								y2="13"
								stroke="currentColor"
								strokeWidth="1.2"
							/>
						</svg>
					</button>
				)}
			</div>
		</div>
	);
}
