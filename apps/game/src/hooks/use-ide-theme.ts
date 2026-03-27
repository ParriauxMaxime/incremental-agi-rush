import type { EditorTheme } from "@modules/editor";
import { EDITOR_THEMES } from "@modules/editor";
import { useUiStore } from "@modules/game";

export function useIdeTheme(): EditorTheme {
	const themeId = useUiStore((s) => s.editorTheme);
	return EDITOR_THEMES[themeId];
}
