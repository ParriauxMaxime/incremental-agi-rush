import { css } from "@emotion/react";
import { sfx } from "@modules/audio";
import { Editor, TapToCode } from "@modules/editor";
import { allEvents, useEventStore } from "@modules/event";
import { useGameStore } from "@modules/game";
import { useCallback, useEffect, useRef } from "react";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { useTouchDevice } from "../hooks/use-touch-device";
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
	position: "relative",
});

const contentCss = css({
	flex: 1,
	overflow: "hidden",
	display: "flex",
	flexDirection: "column",
});

const IGNORED_KEYS = new Set([
	"Shift",
	"Control",
	"Alt",
	"Meta",
	"Tab",
	"Escape",
	"CapsLock",
]);

export function EditorPanel() {
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);
	const locPerKey = useGameStore((s) => s.locPerKey);
	const addLoc = useGameStore((s) => s.addLoc);
	const running = useGameStore((s) => s.running);
	const theme = useIdeTheme();
	const isTouch = useTouchDevice();
	const keystrokeCallbackRef = useRef<(() => void) | null>(null);

	const onKeystroke = useCallback(() => {
		keystrokeCallbackRef.current?.();
	}, []);

	// T4+ CLI mode: keystrokes still generate LoC via window listener
	useEffect(() => {
		if (!aiUnlocked) return;

		function handleKeyDown(e: KeyboardEvent) {
			if (IGNORED_KEYS.has(e.key)) return;
			const target = e.target as HTMLElement;
			if (target.closest("[data-sidebar]") || target.closest("[data-terminal]"))
				return;

			sfx.typing();
			addLoc(locPerKey);

			if (running) {
				const es = useEventStore.getState();
				const interactive = es.getActiveInteractiveEvent();
				if (interactive) {
					const def = allEvents.find(
						(ev) => ev.id === interactive.definitionId,
					);
					if (def?.interaction?.type === "mash_keys") {
						es.handleMashKey(interactive.definitionId);
					}
				}
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [aiUnlocked, addLoc, locPerKey, running]);

	if (aiUnlocked) {
		return (
			<div css={wrapperCss} data-tutorial="editor">
				<div css={contentCss} style={{ background: theme.panelBg }}>
					<CliPrompt />
				</div>
			</div>
		);
	}

	return (
		<div css={wrapperCss} data-tutorial="editor">
			<div css={editorAreaCss} style={{ flex: 1 }}>
				<Editor keystrokeCallbackRef={keystrokeCallbackRef} />
				{isTouch && <TapToCode theme={theme} onKeystroke={onKeystroke} />}
			</div>
		</div>
	);
}
