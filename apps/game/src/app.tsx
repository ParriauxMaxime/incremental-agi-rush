import { EditorPanel } from "@components/editor-panel";
import { GodModePage } from "@components/god-mode-page";
import { MobileShell } from "@components/mobile-shell";
import { SidebarTree } from "@components/sidebar-tree";
import { StatsPanel } from "@components/stats-panel";
import { StatusBar } from "@components/status-bar";
import { TechTreePage } from "@components/tech-tree-page";
import {
	TutorialTip,
	useKeyboardShortcuts,
	useTutorialTriggers,
} from "@components/tutorial-screen";
import { css, Global, keyframes } from "@emotion/react";
import type { EditorTheme } from "@modules/editor";
import { EDITOR_THEMES, type EditorThemeEnum } from "@modules/editor";
import { EventToast } from "@modules/event/components/event-toast";
import {
	PageEnum,
	SingularitySequence,
	useGameLoop,
	useGameStore,
	useUiStore,
} from "@modules/game";
import { useEffect, useRef } from "react";
import { match } from "ts-pattern";
import { useIdeTheme } from "./hooks/use-ide-theme";
import { useIsMobile } from "./hooks/use-is-mobile";

const globalStyles = css({
	"*": {
		margin: 0,
		padding: 0,
		boxSizing: "border-box",
	},
	"html, body": {
		background: "#000",
	},
});

// ── Shared styles ──

// ── CRT collapse animation ──

const crtCollapseAnim = keyframes({
	"0%": { transform: "scaleY(1)", opacity: 1, filter: "brightness(1)" },
	"5%": { filter: "brightness(2)", transform: "scaleY(1) skewX(-2deg)" },
	"10%": { filter: "brightness(1)", transform: "scaleY(1) skewX(1deg)" },
	"15%": { filter: "none", transform: "scaleY(1)" },
	"60%": { transform: "scaleY(0.005)", opacity: 0.9 },
	"100%": { transform: "scaleY(0)", opacity: 0 },
});

const shellCollapseCss = css({
	animation: `${crtCollapseAnim} 1.1s ease-in forwards`,
});

// ── Panel styles ──

const panelCss = css({
	display: "flex",
	flexDirection: "column",
	overflow: "hidden",
});

const contentCss = css({
	flex: 1,
	overflow: "hidden",
	display: "flex",
	flexDirection: "column",
});

// ── Middle panel tabs ──

interface TabDef {
	page: PageEnum;
	filename: string;
}

const middleTabs: TabDef[] = [
	{ page: PageEnum.game, filename: "agi.py" },
	{ page: PageEnum.tech_tree, filename: "tech-tree.svg" },
	{ page: PageEnum.settings, filename: "settings.json" },
	{ page: PageEnum.god_mode, filename: "godmode.ts" },
];

// ── Settings page (inline) ──

const settingsPageCss = css({
	flex: 1,
	padding: 24,
	overflowY: "auto",
	fontSize: 13,
	background: "#141920",
});

const settingsSectionCss = css({
	marginBottom: 24,
});

const settingsHeadingCss = css({
	fontSize: 14,
	color: "#58a6ff",
	fontWeight: "bold",
	marginBottom: 8,
});

const settingsRowCss = css({
	display: "flex",
	alignItems: "center",
	gap: 8,
	padding: "6px 0",
	color: "#c9d1d9",
	fontSize: 12,
});

const themeGridCss = css({
	display: "grid",
	gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
	gap: 8,
	marginTop: 8,
});

const themeCardCss = css({
	padding: 10,
	borderRadius: 6,
	border: "2px solid transparent",
	cursor: "pointer",
	transition: "all 0.15s",
	"&:hover": { filter: "brightness(1.1)" },
});

const themeNameCss = css({
	fontSize: 11,
	fontWeight: "bold",
	marginBottom: 6,
});

const themeSwatchRowCss = css({
	display: "flex",
	gap: 3,
});

const themeSwatchCss = css({
	width: 14,
	height: 14,
	borderRadius: 2,
});

function ThemePreview({ theme, label }: { theme: EditorTheme; label: string }) {
	const swatches = [
		theme.keyword,
		theme.function,
		theme.string,
		theme.number,
		theme.type,
		theme.variable,
		theme.operator,
		theme.comment,
	];
	return (
		<>
			<div css={themeNameCss} style={{ color: theme.foreground }}>
				{label}
			</div>
			<div css={themeSwatchRowCss}>
				{swatches.map((color) => (
					<div key={color} css={themeSwatchCss} style={{ background: color }} />
				))}
			</div>
		</>
	);
}

const themeEntries = Object.entries(EDITOR_THEMES) as Array<
	[EditorThemeEnum, EditorTheme]
>;

function SettingsPage() {
	const editorTheme = useUiStore((s) => s.editorTheme);
	const setEditorTheme = useUiStore((s) => s.setEditorTheme);
	const uiZoom = useUiStore((s) => s.uiZoom);
	const setUiZoom = useUiStore((s) => s.setUiZoom);
	const theme = useIdeTheme();

	return (
		<div
			css={settingsPageCss}
			style={{ background: theme.panelBg, color: theme.foreground }}
		>
			<div css={settingsSectionCss}>
				<div css={settingsHeadingCss} style={{ color: theme.accent }}>
					{"// Editor Theme"}
				</div>
				<div css={themeGridCss}>
					{themeEntries.map(([id, theme]) => (
						<div
							key={id}
							css={[
								themeCardCss,
								editorTheme === id && { borderColor: theme.accent },
							]}
							style={{ background: theme.background }}
							onClick={() => setEditorTheme(id)}
							onKeyDown={(e) => {
								if (e.key === "Enter") setEditorTheme(id);
							}}
							role="button"
							tabIndex={0}
						>
							<ThemePreview theme={theme} label={theme.name} />
						</div>
					))}
				</div>
			</div>
			<div css={settingsSectionCss}>
				<div css={settingsHeadingCss} style={{ color: theme.accent }}>
					{"// UI Zoom"}
				</div>
				<div
					css={[
						settingsRowCss,
						{ gap: 6, flexWrap: "wrap", color: theme.foreground },
					]}
				>
					{[75, 80, 90, 100, 110, 125, 150].map((v) => (
						<button
							key={v}
							type="button"
							css={{
								fontFamily: "inherit",
								fontSize: 12,
								padding: "4px 10px",
								borderRadius: 4,
								cursor: "pointer",
								border:
									uiZoom === v
										? `1px solid ${theme.accent}`
										: `1px solid ${theme.border}`,
								background:
									uiZoom === v ? `${theme.accent}22` : theme.background,
								color: uiZoom === v ? theme.accent : theme.foreground,
								"&:hover": { borderColor: theme.accent },
							}}
							onClick={() => setUiZoom(v)}
						>
							{v}%
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

// ── Collapsed sidebar strip ──

const collapsedStripCss = css({
	display: "flex",
	alignItems: "flex-start",
	justifyContent: "center",
	paddingTop: 10,
	width: 28,
	flexShrink: 0,
	cursor: "pointer",
	border: "none",
	fontFamily: "inherit",
	color: "#8b949e",
	transition: "color 0.15s",
	alignSelf: "stretch",
	"&:hover": { color: "#c9d1d9" },
});

// ── Tabbed pane (reusable for split view) ──

const splitBtnCss = css({
	marginLeft: "auto",
	padding: "0 10px",
	display: "flex",
	alignItems: "center",
	border: "none",
	background: "none",
	cursor: "pointer",
	fontFamily: "inherit",
	fontSize: 14,
	transition: "color 0.15s",
});

function PageContent({ page }: { page: PageEnum }) {
	return match(page)
		.with(PageEnum.game, () => <EditorPanel />)
		.with(PageEnum.tech_tree, () => <TechTreePage />)
		.with(PageEnum.settings, () => <SettingsPage />)
		.with(PageEnum.god_mode, () => <GodModePage />)
		.exhaustive();
}

function SplitIcon({ active }: { active?: boolean }) {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<rect
				x="1.5"
				y="2.5"
				width="13"
				height="11"
				rx="1"
				stroke="currentColor"
				strokeWidth="1.2"
			/>
			<line
				x1="8"
				y1="3"
				x2="8"
				y2="13"
				stroke="currentColor"
				strokeWidth="1.2"
				strokeOpacity={active ? 1 : 0.6}
			/>
		</svg>
	);
}

function TabbedPane({
	activePage,
	onSetPage,
	showSplitBtn,
	splitActive,
	onToggleSplit,
}: {
	activePage: PageEnum;
	onSetPage: (page: PageEnum) => void;
	showSplitBtn?: boolean;
	splitActive?: boolean;
	onToggleSplit?: () => void;
}) {
	const theme = useIdeTheme();

	return (
		<div css={[panelCss, { flex: 1 }]}>
			<div
				css={{
					display: "flex",
					background: theme.tabBarBg,
					borderBottom: `1px solid ${theme.border}`,
					flexShrink: 0,
					height: 35,
				}}
			>
				{middleTabs.map((t) => {
					const active = t.page === activePage;
					return (
						<button
							key={t.page}
							type="button"
							css={{
								padding: "0 16px",
								display: "flex",
								alignItems: "center",
								gap: 8,
								fontSize: 13,
								color: active ? theme.foreground : theme.textMuted,
								background: active ? theme.tabActiveBg : theme.tabInactiveBg,
								border: "none",
								borderRight: `1px solid ${theme.border}`,
								borderBottom: active
									? `1px solid ${theme.tabActiveBg}`
									: "none",
								marginBottom: active ? -1 : 0,
								cursor: "pointer",
								fontFamily: "inherit",
								whiteSpace: "nowrap",
								transition: "all 0.15s",
								"&:hover": {
									color: theme.foreground,
								},
							}}
							onClick={() => onSetPage(t.page)}
						>
							<span
								css={{
									width: 6,
									height: 6,
									borderRadius: "50%",
									background: active ? "#519aba" : "transparent",
									flexShrink: 0,
								}}
							/>
							{t.filename}
						</button>
					);
				})}
				{showSplitBtn && onToggleSplit && (
					<button
						type="button"
						css={splitBtnCss}
						style={{
							color: splitActive ? "#58a6ff" : theme.textMuted,
						}}
						onClick={onToggleSplit}
						title={splitActive ? "Close split" : "Split editor"}
					>
						<SplitIcon active={splitActive} />
					</button>
				)}
			</div>
			<div css={contentCss}>
				<PageContent page={activePage} />
			</div>
		</div>
	);
}

export function App() {
	useGameLoop();
	useTutorialTriggers();
	useKeyboardShortcuts();
	const isMobile = useIsMobile();
	const page = useUiStore((s) => s.page);
	const setPage = useUiStore((s) => s.setPage);
	const splitEnabled = useUiStore((s) => s.splitEnabled);
	const rightPage = useUiStore((s) => s.rightPage);
	const setRightPage = useUiStore((s) => s.setRightPage);
	const toggleSplit = useUiStore((s) => s.toggleSplit);
	const uiZoom = useUiStore((s) => s.uiZoom);
	const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
	const toggleSidebar = useUiStore((s) => s.toggleSidebar);
	const statsPanelCollapsed = useUiStore((s) => s.statsPanelCollapsed);
	const toggleStatsPanel = useUiStore((s) => s.toggleStatsPanel);
	const sidebarUnlocked = useGameStore(
		(s) => (s.ownedTechNodes.unlock_sidebar ?? 0) > 0,
	);
	const statsPanelUnlocked = useGameStore(
		(s) => (s.ownedTechNodes.unlock_stats_panel ?? 0) > 0,
	);
	const singularity = useGameStore((s) => s.singularity);
	const theme = useIdeTheme();
	const shellRef = useRef<HTMLDivElement>(null);
	const singularityOnMount = useRef(useGameStore.getState().singularity);
	const singularityAnimate = singularity && !singularityOnMount.current;

	// Auto-expand panels when unlocked for the first time
	const prevSidebarUnlocked = useRef(sidebarUnlocked);
	useEffect(() => {
		if (sidebarUnlocked && !prevSidebarUnlocked.current) {
			prevSidebarUnlocked.current = true;
			useUiStore.getState().toggleSidebar();
		}
	}, [sidebarUnlocked]);

	const prevStatsPanelUnlocked = useRef(statsPanelUnlocked);
	useEffect(() => {
		if (statsPanelUnlocked && !prevStatsPanelUnlocked.current) {
			prevStatsPanelUnlocked.current = true;
			useUiStore.getState().toggleStatsPanel();
		}
	}, [statsPanelUnlocked]);

	// Force-trigger the CRT animation
	useEffect(() => {
		if (singularityAnimate && shellRef.current) {
			const el = shellRef.current;
			el.style.animation = "none";
			void el.offsetHeight;
			el.style.animation = "";
		}
	}, [singularityAnimate]);

	if (isMobile) {
		return (
			<>
				<Global styles={globalStyles} />
				<MobileShell />
				<EventToast />
				{singularity && <SingularitySequence animate={singularityAnimate} />}
			</>
		);
	}

	return (
		<>
			<Global styles={globalStyles} />
			<div
				ref={shellRef}
				css={[
					{
						display: "flex",
						flexDirection: "column",
						height: `${10000 / uiZoom}vh`,
						width: `${10000 / uiZoom}vw`,
						overflow: "hidden",
						background: theme.background,
						color: theme.foreground,
						zoom: uiZoom / 100,
						fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
					},
					singularity && singularityAnimate && shellCollapseCss,
				]}
			>
				{/* Main area: sidebar + tabbed content + tutorial */}
				<div
					css={{
						display: "flex",
						flexDirection: "column",
						flex: 1,
						overflow: "hidden",
					}}
				>
					<div css={{ display: "flex", flex: 1, overflow: "hidden" }}>
						{!sidebarUnlocked || sidebarCollapsed ? (
							<button
								type="button"
								css={collapsedStripCss}
								style={{
									borderRight: `1px solid ${theme.border}`,
									background: theme.sidebarBg,
									opacity: sidebarUnlocked ? 1 : 0.3,
									cursor: sidebarUnlocked ? "pointer" : "default",
								}}
								onClick={sidebarUnlocked ? toggleSidebar : undefined}
								title={sidebarUnlocked ? "Show sidebar" : "Unlock in tech tree"}
							>
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
									<rect
										x="1.5"
										y="2.5"
										width="13"
										height="11"
										rx="1"
										stroke="currentColor"
										strokeWidth="1.2"
									/>
									<line
										x1="5"
										y1="3"
										x2="5"
										y2="13"
										stroke="currentColor"
										strokeWidth="1.2"
									/>
								</svg>
							</button>
						) : (
							<SidebarTree onCollapse={toggleSidebar} />
						)}

						{/* Tabbed pane(s) */}
						<TabbedPane
							activePage={page}
							onSetPage={setPage}
							showSplitBtn
							splitActive={splitEnabled}
							onToggleSplit={toggleSplit}
						/>
						{splitEnabled && (
							<TabbedPane activePage={rightPage} onSetPage={setRightPage} />
						)}

						{!statsPanelUnlocked || statsPanelCollapsed ? (
							<button
								type="button"
								css={collapsedStripCss}
								style={{
									borderLeft: `1px solid ${theme.border}`,
									background: theme.sidebarBg,
									opacity: statsPanelUnlocked ? 1 : 0.3,
									cursor: statsPanelUnlocked ? "pointer" : "default",
								}}
								onClick={statsPanelUnlocked ? toggleStatsPanel : undefined}
								title={
									statsPanelUnlocked ? "Show stats" : "Unlock in tech tree"
								}
							>
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
									<rect
										x="1.5"
										y="2.5"
										width="13"
										height="11"
										rx="1"
										stroke="currentColor"
										strokeWidth="1.2"
									/>
									<line
										x1="11"
										y1="3"
										x2="11"
										y2="13"
										stroke="currentColor"
										strokeWidth="1.2"
									/>
								</svg>
							</button>
						) : (
							<StatsPanel onCollapse={toggleStatsPanel} />
						)}
					</div>
					<TutorialTip />
				</div>

				{/* Status bar */}
				<StatusBar />
			</div>
			<EventToast />
			{singularity && <SingularitySequence animate={singularityAnimate} />}
		</>
	);
}
