import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ShellLine } from "../../terminal/types";

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
	openTabs: PageEnum[];
	splitEnabled: boolean;
	rightPage: PageEnum;
	editorTheme: EditorThemeEnum;
	seenTips: string[];
	terminalLog: ShellLine[];
	terminalOpen: boolean;
	techTreeViewport: TechTreeViewport;
	uiZoom: number;
	sidebarCollapsed: boolean;
	statsPanelCollapsed: boolean;
	setPage: (page: PageEnum) => void;
	openTab: (page: PageEnum) => void;
	closeTab: (page: PageEnum) => void;
	setRightPage: (page: PageEnum) => void;
	toggleSplit: () => void;
	toggleSidebar: () => void;
	toggleStatsPanel: () => void;
	toggleTerminal: () => void;
	setEditorTheme: (theme: EditorThemeEnum) => void;
	setUiZoom: (size: number) => void;
	showTip: (id: string) => void;
	pushTerminalLines: (lines: ShellLine[]) => void;
	resetAll: () => void;
	setTechTreeViewport: (viewport: TechTreeViewport) => void;
}

export const useUiStore = create<UiState>()(
	persist(
		(set, get) => ({
			page: PageEnum.game,
			openTabs: [PageEnum.game],
			splitEnabled: false,
			rightPage: PageEnum.tech_tree,
			editorTheme: EditorThemeEnum.one_dark,
			seenTips: [],
			terminalLog: [],
			terminalOpen: true,
			techTreeViewport: {
				x: -850,
				y: -200,
				zoom: 1,
			},
			uiZoom: 100,
			sidebarCollapsed: true,
			statsPanelCollapsed: true,
			setPage: (page) => set({ page }),
			openTab: (page) =>
				set((s) => ({
					openTabs: s.openTabs.includes(page)
						? s.openTabs
						: [...s.openTabs, page],
					page,
				})),
			closeTab: (page) =>
				set((s) => {
					const tabs = s.openTabs.filter((t) => t !== page);
					return {
						openTabs: tabs.length === 0 ? [PageEnum.game] : tabs,
						page:
							s.page === page
								? (tabs[tabs.length - 1] ?? PageEnum.game)
								: s.page,
					};
				}),
			setRightPage: (page) => set({ rightPage: page }),
			toggleSplit: () => set((s) => ({ splitEnabled: !s.splitEnabled })),
			toggleSidebar: () =>
				set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
			toggleStatsPanel: () =>
				set((s) => ({ statsPanelCollapsed: !s.statsPanelCollapsed })),
			toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
			setEditorTheme: (editorTheme) => set({ editorTheme }),
			setUiZoom: (value) => set({ uiZoom: Math.min(150, Math.max(75, value)) }),
			setTechTreeViewport: (viewport) => set({ techTreeViewport: viewport }),
			showTip: (id) => {
				const { seenTips } = get();
				if (seenTips.includes(id)) return;
				set({ seenTips: [...seenTips, id] });
			},
			pushTerminalLines: (lines) =>
				set((s) => ({
					terminalLog: [...s.terminalLog, ...lines],
					terminalOpen: true,
				})),
			resetAll: () => {
				set({
					seenTips: [],
					terminalLog: [],
					terminalOpen: true,
					page: PageEnum.game,
					openTabs: [PageEnum.game],
					splitEnabled: false,
					rightPage: PageEnum.tech_tree,
					sidebarCollapsed: true,
					statsPanelCollapsed: true,
					techTreeViewport: {
						x: -850,
						y: -200,
						zoom: 1,
					},
					uiZoom: 100,
				});
				localStorage.removeItem("flopsed-ui");
			},
		}),
		{
			name: "flopsed-ui",
			partialize: (state) => ({
				page: state.page,
				openTabs: state.openTabs,
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
