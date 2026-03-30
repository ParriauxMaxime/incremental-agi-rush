import { css } from "@emotion/react";
import { Editor } from "@modules/editor";
import { useGameStore } from "@modules/game";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { CliPrompt } from "./cli-prompt";

const wrapperCss = css({
	display: "flex",
	flexDirection: "column",
	flex: 1,
	overflow: "hidden",
});

const editorAreaCss = css({
	overflow: "hidden",
	display: "flex",
	flexDirection: "column",
	minHeight: 0,
	boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)",
});

const bottomPanelCss = css({
	display: "flex",
	flexDirection: "column",
	overflow: "hidden",
	boxShadow: "0 -2px 6px rgba(0,0,0,0.15)",
	zIndex: 1,
	position: "relative",
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
	const { t } = useTranslation();
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);
	const theme = useIdeTheme();

	if (aiUnlocked) {
		// T4+: CLI prompt is primary, editor is a small preview at top
		return (
			<div css={wrapperCss} data-tutorial="editor">
				{/* Miniature editor preview — code being auto-generated */}
				<div css={editorAreaCss} style={{ flex: "0 0 30%", maxHeight: "35%" }}>
					<Editor />
				</div>

				{/* CLI prompt takes over as main panel */}
				<div
					css={bottomPanelCss}
					style={{
						flex: 1,
						borderTop: `1px solid ${theme.border}`,
					}}
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
							{t("editor.terminal")}
						</span>
					</div>
					<div css={bottomContentCss} style={{ background: theme.panelBg }}>
						<CliPrompt />
					</div>
				</div>
			</div>
		);
	}

	// T0-T3: Full editor
	return (
		<div css={wrapperCss} data-tutorial="editor">
			<div css={editorAreaCss} style={{ flex: 1 }}>
				<Editor />
			</div>
		</div>
	);
}
