import { css } from "@emotion/react";
import { useGameStore } from "@modules/game";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { FlopsSlider } from "./flops-slider";
import { StatsAiComputeSection } from "./stats-ai-compute-section";
import { StatsCashSection } from "./stats-cash-section";
import { StatsExecuteBar } from "./stats-execute-bar";
import { StatsFlopsSection } from "./stats-flops-section";
import { StatsHistory } from "./stats-history";
import { StatsLocSection } from "./stats-loc-section";
import { StatsTierBar } from "./stats-tier-bar";

const panelCss = css({
	display: "flex",
	flexDirection: "column",
	width: "100%",
	minWidth: 0,
	height: "100%",
	flexShrink: 0,
	overflow: "hidden",
});

const headerCss = css({
	padding: "0 12px",
	height: 35,
	display: "flex",
	alignItems: "center",
	gap: 8,
	fontSize: 12,
	fontWeight: 600,
	textTransform: "uppercase",
	letterSpacing: 0.5,
	flexShrink: 0,
});

const bodyCss = css({
	flex: 1,
	overflowY: "auto",
	overflowX: "hidden",
	"&::-webkit-scrollbar": { width: 6 },
	"&::-webkit-scrollbar-track": { background: "transparent" },
	"&::-webkit-scrollbar-thumb": { borderRadius: 3 },
});

export function StatsPanel({ onCollapse }: { onCollapse?: () => void }) {
	const { t } = useTranslation();
	const theme = useIdeTheme();
	const sessionStartTime = useGameStore((s) => s.sessionStartTime);
	const timelineUnlocked = useGameStore(
		(s) => (s.ownedTechNodes.unlock_session_timeline ?? 0) > 0,
	);

	const [elapsed, setElapsed] = useState(0);

	useEffect(() => {
		const id = setInterval(() => {
			setElapsed((performance.now() - sessionStartTime) / 1000);
		}, 1000);
		return () => clearInterval(id);
	}, [sessionStartTime]);

	const elapsedStr = `${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, "0")}`;

	return (
		<div
			css={panelCss}
			style={{
				background: theme.sidebarBg,
				borderLeft: `1px solid ${theme.border}`,
			}}
		>
			{/* Header */}
			<div
				css={headerCss}
				style={{
					background: theme.tabBarBg,
					borderBottom: `1px solid ${theme.border}`,
					color: theme.textMuted,
				}}
			>
				<span style={{ fontSize: 14, color: theme.flopsColor }}>⚡</span>
				<span style={{ flex: 1 }}>{t("stats_panel.title")}</span>
				<span
					style={{
						fontSize: 10,
						background: theme.hoverBg,
						padding: "2px 6px",
						borderRadius: 3,
						fontWeight: 400,
					}}
				>
					{elapsedStr}
				</span>
				{onCollapse && (
					<button
						type="button"
						onClick={onCollapse}
						title={t("stats_panel.hide")}
						css={{
							background: "none",
							border: "none",
							cursor: "pointer",
							color: theme.textMuted,
							padding: 2,
							display: "flex",
							alignItems: "center",
							"&:hover": { color: theme.foreground },
						}}
					>
						<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
							<path
								d="M5 4l4 4-4 4"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</button>
				)}
			</div>

			{/* Scrollable body */}
			<div
				css={[
					bodyCss,
					{ "&::-webkit-scrollbar-thumb": { background: theme.border } },
				]}
			>
				<StatsCashSection />
				<StatsLocSection />
				<FlopsSlider />
				<StatsAiComputeSection />
				<StatsFlopsSection />
				{timelineUnlocked && <StatsTierBar />}
				<StatsHistory />
			</div>

			{/* Sticky execute */}
			<StatsExecuteBar />
		</div>
	);
}
