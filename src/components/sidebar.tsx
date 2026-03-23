import { css } from "@emotion/react";
import { useGameStore } from "@modules/game";
import { MilestoneList, UpgradeList } from "@modules/upgrade";
import { useState } from "react";
import { FlopsSlider } from "./flops-slider";
import { ResourceBar } from "./resource-bar";
import { TierProgress } from "./tier-progress";

const sidebarStyle = css({
	flex: 1,
	display: "flex",
	flexDirection: "column",
	background: "#0d1117",
	minWidth: 320,
	maxWidth: 400,
});

const tabBarStyle = css({
	display: "flex",
	background: "#161b22",
	borderBottom: "1px solid #1e2630",
});

const tabStyle = css({
	flex: 1,
	padding: 8,
	textAlign: "center",
	fontSize: 11,
	textTransform: "uppercase",
	letterSpacing: 1,
	cursor: "pointer",
	color: "#6272a4",
	background: "none",
	border: "none",
	borderBottom: "2px solid transparent",
	fontFamily: "inherit",
	transition: "all 0.2s",
	"&:hover": { color: "#c5c8c6" },
});

const activeTabStyle = css({
	color: "#58a6ff",
	borderBottomColor: "#58a6ff",
});

const tabContentStyle = css({
	flex: 1,
	overflowY: "auto",
	padding: 12,
	"&::-webkit-scrollbar": { width: 6 },
	"&::-webkit-scrollbar-track": { background: "transparent" },
	"&::-webkit-scrollbar-thumb": { background: "#1e2630", borderRadius: 3 },
	"&::-webkit-scrollbar-thumb:hover": { background: "#2d3748" },
});

const runBarCss = css({
	display: "flex",
	padding: "8px 12px",
	borderTop: "1px solid #1e2630",
	background: "#0d1117",
	flexShrink: 0,
});

const runBtnCss = css({
	flex: 1,
	padding: "8px 0",
	fontSize: 12,
	fontWeight: "bold",
	fontFamily: "inherit",
	textTransform: "uppercase",
	letterSpacing: 1,
	border: "1px solid #238636",
	borderRadius: 4,
	cursor: "pointer",
	transition: "all 0.15s",
	background: "#238636",
	color: "#fff",
	"&:hover": { background: "#2ea043" },
});

const stopBtnCss = css(runBtnCss, {
	background: "#0d1117",
	color: "#e06c75",
	borderColor: "#e06c75",
	"&:hover": { background: "#e06c75", color: "#fff" },
});

type Tab = "upgrades" | "milestones";

export function Sidebar() {
	const [activeTab, setActiveTab] = useState<Tab>("upgrades");
	const running = useGameStore((s) => s.running);
	const toggleRunning = useGameStore((s) => s.toggleRunning);

	return (
		<div css={sidebarStyle} data-sidebar>
			<ResourceBar />
			<FlopsSlider />
			<TierProgress />
			<div css={tabBarStyle} role="tablist">
				<button
					type="button"
					css={[tabStyle, activeTab === "upgrades" && activeTabStyle]}
					onClick={() => setActiveTab("upgrades")}
					role="tab"
					aria-selected={activeTab === "upgrades"}
				>
					Upgrades
				</button>
				<button
					type="button"
					css={[tabStyle, activeTab === "milestones" && activeTabStyle]}
					onClick={() => setActiveTab("milestones")}
					role="tab"
					aria-selected={activeTab === "milestones"}
				>
					Milestones
				</button>
			</div>
			<div css={tabContentStyle}>
				{activeTab === "upgrades" ? <UpgradeList /> : <MilestoneList />}
			</div>
			<div css={runBarCss}>
				<button
					type="button"
					css={running ? runBtnCss : stopBtnCss}
					onClick={toggleRunning}
				>
					{running ? "▶ Run" : "■ Stop"}
				</button>
			</div>
		</div>
	);
}
