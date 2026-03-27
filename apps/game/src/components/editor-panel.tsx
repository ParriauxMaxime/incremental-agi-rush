import { css } from "@emotion/react";
import { Editor } from "@modules/editor";
import { useGameStore } from "@modules/game";
import { useState } from "react";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { AnalyticsDashboard } from "./analytics-dashboard";
import { CliPrompt } from "./cli-prompt";

const wrapperCss = css({
	display: "flex",
	flexDirection: "column",
	flex: 1,
	overflow: "hidden",
});

const editorAreaCss = css({
	flex: 1,
	overflow: "hidden",
	display: "flex",
	flexDirection: "column",
	minHeight: 0,
});

const bottomPanelCss = css({
	display: "flex",
	flexDirection: "column",
	overflow: "hidden",
	flexShrink: 0,
	maxHeight: "40%",
	minHeight: 120,
});

const bottomTabBarCss = css({
	display: "flex",
	alignItems: "center",
	height: 28,
	flexShrink: 0,
});

const bottomTabCss = css({
	padding: "0 12px",
	height: "100%",
	display: "flex",
	alignItems: "center",
	fontSize: 12,
	textTransform: "uppercase",
	letterSpacing: 0.5,
	cursor: "pointer",
	border: "none",
	background: "none",
	fontFamily: "inherit",
	transition: "color 0.15s",
});

const bottomContentCss = css({
	flex: 1,
	overflow: "hidden",
	display: "flex",
	flexDirection: "column",
});

const BottomTabEnum = {
	analytics: "analytics",
	prompt: "prompt",
} as const;

type BottomTabEnum = (typeof BottomTabEnum)[keyof typeof BottomTabEnum];

export function EditorPanel() {
	const tierIndex = useGameStore((s) => s.currentTierIndex);
	const autoLocPerSec = useGameStore((s) => s.autoLocPerSec);
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);
	const theme = useIdeTheme();
	const [bottomTab, setBottomTab] = useState<BottomTabEnum>(
		BottomTabEnum.analytics,
	);

	const showBottomPanel = autoLocPerSec > 0 || tierIndex >= 2;
	const showPromptTab = aiUnlocked;

	return (
		<div css={wrapperCss} data-tutorial="editor">
			{/* Main editor area (always visible) */}
			<div css={editorAreaCss}>
				<Editor />
			</div>

			{/* Bottom panel (VS Code terminal-style, appears at T2+) */}
			{showBottomPanel && (
				<div
					css={bottomPanelCss}
					style={{ borderTop: `1px solid ${theme.border}` }}
				>
					<div
						css={bottomTabBarCss}
						style={{
							background: theme.tabBarBg,
							borderBottom: `1px solid ${theme.border}`,
						}}
					>
						<button
							type="button"
							css={bottomTabCss}
							style={{
								color:
									bottomTab === BottomTabEnum.analytics
										? theme.foreground
										: theme.textMuted,
								borderBottom:
									bottomTab === BottomTabEnum.analytics
										? `1px solid ${theme.foreground}`
										: "1px solid transparent",
							}}
							onClick={() => setBottomTab(BottomTabEnum.analytics)}
						>
							Analytics
						</button>
						{showPromptTab && (
							<button
								type="button"
								css={bottomTabCss}
								style={{
									color:
										bottomTab === BottomTabEnum.prompt
											? theme.foreground
											: theme.textMuted,
									borderBottom:
										bottomTab === BottomTabEnum.prompt
											? `1px solid ${theme.foreground}`
											: "1px solid transparent",
								}}
								onClick={() => setBottomTab(BottomTabEnum.prompt)}
							>
								Terminal
							</button>
						)}
					</div>
					<div css={bottomContentCss} style={{ background: theme.panelBg }}>
						{bottomTab === BottomTabEnum.analytics && <AnalyticsDashboard />}
						{bottomTab === BottomTabEnum.prompt && showPromptTab && (
							<CliPrompt />
						)}
					</div>
				</div>
			)}
		</div>
	);
}
