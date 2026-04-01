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

export const PaneEnum = {
	left: "left",
	right: "right",
} as const;

export type PaneEnum = (typeof PaneEnum)[keyof typeof PaneEnum];

interface TechTreeViewport {
	x: number;
	y: number;
	zoom: number;
}

interface UiState {
	page: PageEnum;
	openTabs: PageEnum[];
	rightPage: PageEnum;
	rightOpenTabs: PageEnum[];
	lastActivePane: PaneEnum;
	splitEnabled: boolean;
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
	openRightTab: (page: PageEnum) => void;
	closeRightTab: (page: PageEnum) => void;
	focusPane: (pane: PaneEnum) => void;
	/** Opens a tab in the last-focused pane */
	openInActivePane: (page: PageEnum) => void;
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

function addToTabs(tabs: PageEnum[], page: PageEnum): PageEnum[] {
	return tabs.includes(page) ? tabs : [...tabs, page];
}

function removeFromTabs(
	tabs: PageEnum[],
	page: PageEnum,
	activePage: PageEnum,
): { tabs: PageEnum[]; newActive: PageEnum } {
	const next = tabs.filter((t) => t !== page);
	const safe = next.length === 0 ? [PageEnum.game] : next;
	const newActive =
		activePage === page ? (safe[safe.length - 1] ?? PageEnum.game) : activePage;
	return { tabs: safe, newActive };
}

export const useUiStore = create<UiState>()(
	persist(
		(set, get) => ({
			page: PageEnum.game,
			openTabs: [PageEnum.game],
			rightPage: PageEnum.tech_tree,
			rightOpenTabs: [PageEnum.tech_tree],
			lastActivePane: PaneEnum.left,
			splitEnabled: false,
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

			// Left pane
			setPage: (page) => set({ page, lastActivePane: PaneEnum.left }),
			openTab: (page) =>
				set((s) => ({
					openTabs: addToTabs(s.openTabs, page),
					page,
					lastActivePane: PaneEnum.left,
				})),
			closeTab: (page) =>
				set((s) => {
					const { tabs, newActive } = removeFromTabs(s.openTabs, page, s.page);
					return { openTabs: tabs, page: newActive };
				}),

			// Right pane
			setRightPage: (page) =>
				set({ rightPage: page, lastActivePane: PaneEnum.right }),
			openRightTab: (page) =>
				set((s) => ({
					rightOpenTabs: addToTabs(s.rightOpenTabs, page),
					rightPage: page,
					lastActivePane: PaneEnum.right,
				})),
			closeRightTab: (page) =>
				set((s) => {
					const { tabs, newActive } = removeFromTabs(
						s.rightOpenTabs,
						page,
						s.rightPage,
					);
					return { rightOpenTabs: tabs, rightPage: newActive };
				}),

			focusPane: (pane) => set({ lastActivePane: pane }),

			// Sidebar: open in whichever pane was last touched
			openInActivePane: (page) => {
				const s = get();
				if (s.splitEnabled && s.lastActivePane === PaneEnum.right) {
					set({
						rightOpenTabs: addToTabs(s.rightOpenTabs, page),
						rightPage: page,
						lastActivePane: PaneEnum.right,
					});
				} else {
					set({
						openTabs: addToTabs(s.openTabs, page),
						page,
						lastActivePane: PaneEnum.left,
					});
				}
			},

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
					rightPage: PageEnum.tech_tree,
					rightOpenTabs: [PageEnum.tech_tree],
					lastActivePane: PaneEnum.left,
					splitEnabled: false,
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
				rightPage: state.rightPage,
				rightOpenTabs: state.rightOpenTabs,
				lastActivePane: state.lastActivePane,
				splitEnabled: state.splitEnabled,
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
