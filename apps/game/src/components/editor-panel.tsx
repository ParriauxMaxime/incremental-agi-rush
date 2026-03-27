import { css } from "@emotion/react";
import { Editor } from "@modules/editor";
import { useGameStore } from "@modules/game";
import { useIdeTheme } from "../hooks/use-ide-theme";
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
	border: "none",
	background: "none",
	fontFamily: "inherit",
});

const bottomContentCss = css({
	flex: 1,
	overflow: "hidden",
	display: "flex",
	flexDirection: "column",
});

export function EditorPanel() {
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);
	const theme = useIdeTheme();

	return (
		<div css={wrapperCss} data-tutorial="editor">
			<div css={editorAreaCss}>
				<Editor />
			</div>

			{/* Terminal panel (appears when AI unlocked) */}
			{aiUnlocked && (
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
						<span
							css={bottomTabCss}
							style={{
								color: theme.foreground,
								borderBottom: `1px solid ${theme.foreground}`,
							}}
						>
							Terminal
						</span>
					</div>
					<div css={bottomContentCss} style={{ background: theme.panelBg }}>
						<CliPrompt />
					</div>
				</div>
			)}
		</div>
	);
}
