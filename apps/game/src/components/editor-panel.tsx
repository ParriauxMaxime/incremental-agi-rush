import { css } from "@emotion/react";
import { Editor, StreamingEditor, TapToCode } from "@modules/editor";
import { useGameStore } from "@modules/game";
import { useCallback, useRef } from "react";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { useTouchDevice } from "../hooks/use-touch-device";
import { CliPrompt } from "./cli-prompt";
import { FlopsSlider } from "./flops-slider";

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
	position: "relative",
});

const contentCss = css({
	flex: 1,
	overflow: "hidden",
	display: "flex",
	flexDirection: "column",
});

export function EditorPanel() {
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);
	const streamingMode = useGameStore((s) => s.editorStreamingMode);
	const theme = useIdeTheme();
	const isTouch = useTouchDevice();
	const keystrokeCallbackRef = useRef<(() => void) | null>(null);

	const onKeystroke = useCallback(() => {
		keystrokeCallbackRef.current?.();
	}, []);

	if (aiUnlocked) {
		return (
			<div css={wrapperCss} data-tutorial="editor">
				<FlopsSlider />
				<div css={contentCss} style={{ background: theme.panelBg }}>
					<CliPrompt />
				</div>
			</div>
		);
	}

	if (streamingMode) {
		return (
			<div css={wrapperCss} data-tutorial="editor">
				<div css={editorAreaCss} style={{ flex: 1 }}>
					<StreamingEditor />
					{isTouch && (
						<TapToCode theme={theme} onKeystroke={onKeystroke} />
					)}
				</div>
			</div>
		);
	}

	return (
		<div css={wrapperCss} data-tutorial="editor">
			<div css={editorAreaCss} style={{ flex: 1 }}>
				<Editor keystrokeCallbackRef={keystrokeCallbackRef} />
				{isTouch && (
					<TapToCode theme={theme} onKeystroke={onKeystroke} />
				)}
			</div>
		</div>
	);
}
