import { create } from "zustand";
import { persist } from "zustand/middleware";

export const PageEnum = {
	game: "game",
	tech_tree: "tech_tree",
	settings: "settings",
	god_mode: "god_mode",
} as const;

export type PageEnum = (typeof PageEnum)[keyof typeof PageEnum];

export const EditorThemeEnum = {
	one_dark: "one_dark",
	monokai: "monokai",
	github_dark: "github_dark",
	github_light: "github_light",
	solarized_dark: "solarized_dark",
	solarized_light: "solarized_light",
	dracula: "dracula",
	nord: "nord",
} as const;

export type EditorThemeEnum =
	(typeof EditorThemeEnum)[keyof typeof EditorThemeEnum];

interface TechTreeViewport {
	x: number;
	y: number;
	zoom: number;
}

interface UiState {
	page: PageEnum;
	splitEnabled: boolean;
	rightPage: PageEnum;
	editorTheme: EditorThemeEnum;
	seenTips: string[];
	activeTip: string | null;
	techTreeViewport: TechTreeViewport;
	uiZoom: number;
	sidebarCollapsed: boolean;
	statsPanelCollapsed: boolean;
	setPage: (page: PageEnum) => void;
	setRightPage: (page: PageEnum) => void;
	toggleSplit: () => void;
	toggleSidebar: () => void;
	toggleStatsPanel: () => void;
	setEditorTheme: (theme: EditorThemeEnum) => void;
	setUiZoom: (size: number) => void;
	showTip: (id: string) => void;
	dismissTip: () => void;
	resetTips: () => void;
	setTechTreeViewport: (viewport: TechTreeViewport) => void;
}

export const useUiStore = create<UiState>()(
	persist(
		(set, get) => ({
			page: PageEnum.game,
			splitEnabled: false,
			rightPage: PageEnum.tech_tree,
			editorTheme: EditorThemeEnum.one_dark,
			seenTips: [],
			activeTip: null,
			techTreeViewport: {
				x: -(1254 - 300) * 2,
				y: -(566 - 200) * 2,
				zoom: 2,
			},
			uiZoom: 100,
			sidebarCollapsed: true,
			statsPanelCollapsed: true,
			setPage: (page) => set({ page }),
			setRightPage: (page) => set({ rightPage: page }),
			toggleSplit: () => set((s) => ({ splitEnabled: !s.splitEnabled })),
			toggleSidebar: () =>
				set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
			toggleStatsPanel: () =>
				set((s) => ({ statsPanelCollapsed: !s.statsPanelCollapsed })),
			setEditorTheme: (editorTheme) => set({ editorTheme }),
			setUiZoom: (value) => set({ uiZoom: Math.min(150, Math.max(75, value)) }),
			setTechTreeViewport: (viewport) => set({ techTreeViewport: viewport }),
			showTip: (id) => {
				const { seenTips, activeTip } = get();
				if (seenTips.includes(id) || activeTip !== null) return;
				set({ activeTip: id, seenTips: [...seenTips, id] });
			},
			dismissTip: () => set({ activeTip: null }),
			resetTips: () => {
				set({ seenTips: [], activeTip: null });
				// Flush to localStorage synchronously so reload picks it up
				try {
					const raw = localStorage.getItem("agi-rush-ui");
					if (raw) {
						const parsed = JSON.parse(raw);
						parsed.state.seenTips = [];
						localStorage.setItem("agi-rush-ui", JSON.stringify(parsed));
					}
				} catch {
					// ignore
				}
			},
		}),
		{
			name: "agi-rush-ui",
			partialize: (state) => ({
				page: state.page,
				splitEnabled: state.splitEnabled,
				rightPage: state.rightPage,
				sidebarCollapsed: state.sidebarCollapsed,
				statsPanelCollapsed: state.statsPanelCollapsed,
				techTreeViewport: state.techTreeViewport,
				editorTheme: state.editorTheme,
				uiZoom: state.uiZoom,
				seenTips: state.seenTips,
			}),
		},
	),
);
