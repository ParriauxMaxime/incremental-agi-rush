import { css } from "@emotion/react";
import { useGameStore } from "@modules/game";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { StatsPanelGraphs } from "./stats-panel-graphs";
import { StatsPanelResources } from "./stats-panel-resources";
import { StatsPanelTimeline } from "./stats-panel-timeline";

// ── Layout-only styles (no colors) ──

const panelCss = css({
	display: "flex",
	flexDirection: "column",
	width: 280,
	minWidth: 280,
	flexShrink: 0,
	overflow: "hidden",
});

const headerCss = css({
	padding: "0 12px",
	height: 35,
	display: "flex",
	alignItems: "center",
	gap: 8,
	fontSize: 11,
	fontWeight: 600,
	textTransform: "uppercase",
	letterSpacing: 0.5,
	flexShrink: 0,
});

export function StatsPanel({ onCollapse }: { onCollapse?: () => void }) {
	const { t } = useTranslation();
	const theme = useIdeTheme();

	const timelineUnlocked = useGameStore(
		(s) => (s.ownedTechNodes.unlock_session_timeline ?? 0) > 0,
	);
	const graphsUnlocked = useGameStore(
		(s) => (s.ownedTechNodes.unlock_perf_graphs ?? 0) > 0,
	);
	const sessionStartTime = useGameStore((s) => s.sessionStartTime);

	const [activeTab, setActiveTab] = useState<
		"resources" | "timeline" | "graphs"
	>("resources");
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
				<span style={{ fontSize: 13 }}>⚡</span>
				<span css={{ flex: 1 }}>{t("stats_panel.title")}</span>
				<span
					style={{
						fontSize: 10,
						background: theme.hoverBg,
						padding: "1px 5px",
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

			{/* Inner tab bar (visible when timeline is unlocked) */}
			{timelineUnlocked && (
				<div
					css={{
						display: "flex",
						flexShrink: 0,
						borderBottom: `1px solid ${theme.border}`,
						background: theme.tabBarBg,
					}}
				>
					{[
						"resources" as const,
						"timeline" as const,
						...(graphsUnlocked ? (["graphs"] as const) : ([] as const)),
					].map((tab) => (
						<button
							key={tab}
							type="button"
							onClick={() => setActiveTab(tab)}
							css={{
								flex: 1,
								padding: "6px 0",
								fontSize: 11,
								cursor: "pointer",
								background:
									activeTab === tab ? theme.background : "transparent",
								color: activeTab === tab ? theme.foreground : theme.textMuted,
								borderBottom:
									activeTab === tab
										? "2px solid #519aba"
										: "2px solid transparent",
								border: "none",
								borderTop: "none",
								fontFamily: "inherit",
								"&:hover": { color: theme.foreground },
							}}
						>
							{t(`stats_panel.tab_${tab}`)}
						</button>
					))}
				</div>
			)}

			{/* Body */}
			{activeTab === "resources" && <StatsPanelResources />}
			{activeTab === "timeline" && <StatsPanelTimeline />}
			{activeTab === "graphs" && <StatsPanelGraphs />}
		</div>
	);
}
