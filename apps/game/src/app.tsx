import { EditorPanel } from "@components/editor-panel";
import { GodModePage } from "@components/god-mode-page";
import { ResizeHandle } from "@components/resize-handle";
import { RotateNudge } from "@components/rotate-nudge";
import { SidebarTree } from "@components/sidebar-tree";
import { StatsPanel } from "@components/stats-panel";
import { StatusBar } from "@components/status-bar";
import {
	TutorialTip,
	useKeyboardShortcuts,
	useTutorialTriggers,
} from "@components/tutorial-screen";
import { css, Global, keyframes } from "@emotion/react";
import { MusicStyleEnum, useAudioStore } from "@modules/audio";
import { useAudioEvents } from "@modules/audio/use-audio-events";
import type { EditorTheme } from "@modules/editor";
import { EDITOR_THEMES, type EditorThemeEnum } from "@modules/editor";
import { useEventStore } from "@modules/event";
import { EventToast } from "@modules/event/components/event-toast";
import { PageEnum, useGameLoop, useGameStore, useUiStore } from "@modules/game";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";
import { useIdeTheme } from "./hooks/use-ide-theme";
import { supportedLanguages } from "./i18n";

const TechTreePage = lazy(() =>
	import("@components/tech-tree-page").then((m) => ({
		default: m.TechTreePage,
	})),
);
const SingularitySequence = lazy(() =>
	import("@modules/game/components/singularity-sequence").then((m) => ({
		default: m.SingularitySequence,
	})),
);

const globalStyles = css({
	"*": {
		margin: 0,
		padding: 0,
		boxSizing: "border-box",
	},
	"html, body": {
		background: "#000",
	},
	"#root": {
		userSelect: "none",
	},
	"input, textarea": {
		userSelect: "text",
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

const baseTabs: TabDef[] = [
	{ page: PageEnum.game, filename: "agi.py" },
	{ page: PageEnum.tech_tree, filename: "tech-tree.svg" },
	{ page: PageEnum.settings, filename: "settings.json" },
];
const godModeTab: TabDef = { page: PageEnum.god_mode, filename: "godmode.ts" };

// ── Settings page ──

const themeEntries = Object.entries(EDITOR_THEMES) as Array<
	[EditorThemeEnum, EditorTheme]
>;

const PREVIEW_LINES = [
	{
		tokens: [
			{ text: "const ", role: "keyword" as const },
			{ text: "app", role: "variable" as const },
			{ text: " = ", role: "operator" as const },
			{ text: "create", role: "function" as const },
			{ text: "()", role: "operator" as const },
		],
	},
	{
		tokens: [
			{ text: "let ", role: "keyword" as const },
			{ text: "port", role: "variable" as const },
			{ text: " = ", role: "operator" as const },
			{ text: "3000", role: "number" as const },
		],
	},
	{
		tokens: [
			{ text: "app", role: "variable" as const },
			{ text: ".", role: "operator" as const },
			{ text: "get", role: "function" as const },
			{ text: "(", role: "operator" as const },
			{ text: '"/api"', role: "string" as const },
			{ text: ")", role: "operator" as const },
		],
	},
	{ tokens: [{ text: "// ready", role: "comment" as const }] },
];

function SectionHeading({ children }: { children: React.ReactNode }) {
	const theme = useIdeTheme();
	return (
		<div
			css={{
				padding: "18px 20px 8px",
				fontSize: 11,
				fontWeight: 600,
				textTransform: "uppercase",
				letterSpacing: 1.2,
				color: theme.textMuted,
				borderBottom: `1px solid ${theme.border}`,
				marginBottom: 12,
			}}
		>
			{children}
		</div>
	);
}

declare const __GIT_SHA__: string | undefined;

function SettingsPage() {
	const { t, i18n } = useTranslation();
	const editorTheme = useUiStore((s) => s.editorTheme);
	const setEditorTheme = useUiStore((s) => s.setEditorTheme);
	const uiZoom = useUiStore((s) => s.uiZoom);
	const setUiZoom = useUiStore((s) => s.setUiZoom);
	const musicVolume = useAudioStore((s) => s.musicVolume);
	const sfxVolume = useAudioStore((s) => s.sfxVolume);
	const setMusicVolume = useAudioStore((s) => s.setMusicVolume);
	const setSfxVolume = useAudioStore((s) => s.setSfxVolume);
	const musicStyle = useAudioStore((s) => s.musicStyle);
	const setMusicStyle = useAudioStore((s) => s.setMusicStyle);
	const theme = useIdeTheme();

	return (
		<div
			css={{
				flex: 1,
				overflowY: "auto",
				fontSize: 13,
				"&::-webkit-scrollbar": { width: 6 },
				"&::-webkit-scrollbar-track": { background: "transparent" },
				"&::-webkit-scrollbar-thumb": {
					background: theme.scrollThumb,
					borderRadius: 3,
				},
			}}
			style={{ background: theme.background, color: theme.foreground }}
		>
			<div
				css={{
					padding: "16px 20px",
					fontSize: 24,
					fontWeight: 300,
				}}
			>
				{t("settings.title")}
			</div>

			{/* ── Language ── */}
			<SectionHeading>{t("settings.language")}</SectionHeading>
			<div css={{ padding: "4px 20px 16px", display: "flex", gap: 6 }}>
				{supportedLanguages.map((lang) => {
					const active =
						i18n.language === lang.code ||
						i18n.language.startsWith(`${lang.code}-`);
					return (
						<button
							key={lang.code}
							type="button"
							title={lang.name}
							onClick={() => i18n.changeLanguage(lang.code)}
							css={{
								fontSize: 22,
								padding: "6px 8px",
								borderRadius: 6,
								border: active
									? `2px solid ${theme.accent}`
									: `2px solid transparent`,
								background: active ? theme.activeBg : "transparent",
								cursor: "pointer",
								transition: "all 0.15s",
								lineHeight: 1,
								"&:hover": {
									background: theme.hoverBg,
									borderColor: active ? theme.accent : theme.border,
								},
							}}
						>
							{lang.flag}
						</button>
					);
				})}
			</div>

			{/* ── Appearance ── */}
			<SectionHeading>{t("settings.appearance")}</SectionHeading>
			<div
				css={{
					padding: "4px 20px 8px",
					display: "grid",
					gridTemplateColumns: "1fr 1fr",
					gap: 10,
				}}
			>
				{themeEntries.map(([id, th]) => {
					const active = editorTheme === id;
					return (
						<button
							key={id}
							type="button"
							onClick={() => setEditorTheme(id)}
							css={{
								padding: 0,
								borderRadius: 6,
								border: active
									? `2px solid ${theme.accent}`
									: `2px solid ${theme.border}`,
								background: th.background,
								cursor: "pointer",
								overflow: "hidden",
								textAlign: "left",
								transition: "all 0.15s",
								boxShadow: active ? `0 0 8px ${theme.accent}40` : "none",
								"&:hover": {
									borderColor: active ? theme.accent : theme.textMuted,
								},
							}}
						>
							<div
								css={{
									padding: "10px 12px 8px",
									fontFamily:
										"'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
									fontSize: 11,
									lineHeight: 1.6,
								}}
							>
								{PREVIEW_LINES.map((line, i) => (
									<div key={i}>
										{line.tokens.map((tok, j) => (
											<span
												key={j}
												style={{
													color: th[tok.role] ?? th.foreground,
												}}
											>
												{tok.text}
											</span>
										))}
									</div>
								))}
							</div>
							<div
								css={{
									padding: "6px 12px",
									fontSize: 11,
									color: th.foreground,
									borderTop: `1px solid ${th.border ?? th.background}`,
									background: th.sidebarBg ?? th.background,
									opacity: 0.85,
								}}
							>
								{th.name}
							</div>
						</button>
					);
				})}
			</div>
			<div
				css={{
					padding: "8px 20px 16px",
					display: "flex",
					alignItems: "center",
					gap: 10,
				}}
			>
				<span css={{ fontSize: 12, color: theme.textMuted }}>
					{t("settings.text_size")}
				</span>
				<select
					css={{
						fontFamily: "inherit",
						fontSize: 12,
						padding: "3px 6px",
						borderRadius: 3,
						border: `1px solid ${theme.border}`,
						background: theme.hoverBg,
						color: theme.foreground,
						cursor: "pointer",
						outline: "none",
						"&:focus": { borderColor: theme.accent },
					}}
					value={uiZoom}
					onChange={(e) => setUiZoom(Number(e.target.value))}
				>
					{[75, 80, 90, 100, 110, 125, 150].map((v) => (
						<option key={v} value={v}>
							{v}%
						</option>
					))}
				</select>
			</div>

			{/* ── Sound ── */}
			<SectionHeading>{t("settings.sound")}</SectionHeading>
			<div
				css={{
					padding: "4px 20px 16px",
					display: "flex",
					flexDirection: "column",
					gap: 12,
				}}
			>
				<div css={{ display: "flex", alignItems: "center", gap: 10 }}>
					<span css={{ fontSize: 12, color: theme.textMuted, width: 40 }}>
						{t("settings.music")}
					</span>
					<input
						type="range"
						min={0}
						max={100}
						value={musicVolume}
						onChange={(e) => setMusicVolume(Number(e.target.value))}
						css={{
							flex: 1,
							maxWidth: 200,
							accentColor: theme.accent,
							cursor: "pointer",
						}}
					/>
					<span
						css={{
							fontSize: 11,
							color: theme.textMuted,
							width: 32,
							textAlign: "right",
						}}
					>
						{musicVolume}%
					</span>
				</div>
				<div css={{ display: "flex", alignItems: "center", gap: 10 }}>
					<span css={{ fontSize: 12, color: theme.textMuted, width: 40 }}>
						{t("settings.sfx")}
					</span>
					<input
						type="range"
						min={0}
						max={100}
						value={sfxVolume}
						onChange={(e) => setSfxVolume(Number(e.target.value))}
						css={{
							flex: 1,
							maxWidth: 200,
							accentColor: theme.accent,
							cursor: "pointer",
						}}
					/>
					<span
						css={{
							fontSize: 11,
							color: theme.textMuted,
							width: 32,
							textAlign: "right",
						}}
					>
						{sfxVolume}%
					</span>
				</div>
				<div css={{ display: "flex", alignItems: "center", gap: 10 }}>
					<span css={{ fontSize: 12, color: theme.textMuted, width: 40 }}>
						{t("settings.style")}
					</span>
					<div css={{ display: "flex", gap: 6 }}>
						{Object.values(MusicStyleEnum).map((style) => (
							<button
								key={style}
								type="button"
								onClick={() => setMusicStyle(style)}
								css={{
									fontSize: 11,
									padding: "4px 10px",
									borderRadius: 4,
									border:
										musicStyle === style
											? `1px solid ${theme.accent}`
											: `1px solid ${theme.border}`,
									background:
										musicStyle === style ? theme.activeBg : "transparent",
									color:
										musicStyle === style ? theme.foreground : theme.textMuted,
									cursor: "pointer",
									fontFamily: "inherit",
									transition: "all 0.15s",
									"&:hover": { borderColor: theme.accent },
								}}
							>
								{style === "chiptune" ? "Chiptune" : "Landing"}
							</button>
						))}
					</div>
				</div>
			</div>
			<div
				css={{
					textAlign: "right",
					fontSize: 10,
					color: theme.textMuted,
					opacity: 0.5,
					padding: "16px 0 4px",
					fontFamily: "'Courier New', monospace",
				}}
			>
				{typeof __GIT_SHA__ !== "undefined" ? __GIT_SHA__ : "dev"}
			</div>
		</div>
	);
}

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
		.with(PageEnum.tech_tree, () => (
			<Suspense fallback={null}>
				<TechTreePage />
			</Suspense>
		))
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
	tabs,
	openTabs,
	onCloseTab,
	closable = true,
	onPaneFocus,
	paneId,
	showSplitBtn,
	splitActive,
	onToggleSplit,
}: {
	activePage: PageEnum;
	onSetPage: (page: PageEnum) => void;
	tabs: TabDef[];
	openTabs: PageEnum[];
	onCloseTab: (page: PageEnum) => void;
	closable?: boolean;
	onPaneFocus?: () => void;
	paneId: "left" | "right";
	showSplitBtn?: boolean;
	splitActive?: boolean;
	onToggleSplit?: () => void;
}) {
	const theme = useIdeTheme();
	const { t } = useTranslation();
	const moveTab = useUiStore((s) => s.moveTab);
	const splitEnabled = useUiStore((s) => s.splitEnabled);
	const visibleTabs = tabs.filter((tab) => openTabs.includes(tab.page));
	const isEmpty = visibleTabs.length === 0;
	const [dragZone, setDragZone] = useState<false | "center" | "right">(false);
	const dragCountRef = useRef(0);
	const paneRef = useRef<HTMLDivElement>(null);

	const handleDragEnter = (e: React.DragEvent) => {
		if (e.dataTransfer.types.includes("application/x-tab")) {
			e.preventDefault();
			dragCountRef.current++;
			setDragZone("center");
		}
	};

	const handleDragLeave = () => {
		dragCountRef.current--;
		if (dragCountRef.current <= 0) {
			dragCountRef.current = 0;
			setDragZone(false);
		}
	};

	const handleDragOver = (e: React.DragEvent) => {
		if (!e.dataTransfer.types.includes("application/x-tab")) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		// Detect right-edge zone for split-on-drop (only in single panel mode)
		if (!splitEnabled && paneRef.current) {
			const rect = paneRef.current.getBoundingClientRect();
			const x = e.clientX - rect.left;
			setDragZone(x > rect.width * 0.6 ? "right" : "center");
		}
	};

	const handleDrop = (e: React.DragEvent) => {
		const zone = dragZone;
		dragCountRef.current = 0;
		setDragZone(false);
		const data = e.dataTransfer.getData("application/x-tab");
		if (!data) return;
		const { page: draggedPage, from } = JSON.parse(data) as {
			page: PageEnum;
			from: "left" | "right";
		};

		if (!splitEnabled && zone === "right" && from === paneId) {
			// Split: remove tab from left, open in new right pane
			const store = useUiStore.getState();
			const remaining = store.openTabs.filter((t) => t !== draggedPage);
			useUiStore.setState({
				openTabs: remaining.length === 0 ? [PageEnum.game] : remaining,
				page:
					store.page === draggedPage
						? (remaining[remaining.length - 1] ?? PageEnum.game)
						: store.page,
				rightOpenTabs: [draggedPage],
				rightPage: draggedPage,
				splitEnabled: true,
				lastActivePane: "right",
			});
			return;
		}

		if (from !== paneId) {
			moveTab(draggedPage, from, paneId);
		}
	};

	return (
		<div
			ref={paneRef}
			css={[panelCss, { flex: 1, position: "relative" }]}
			onClick={onPaneFocus}
			onDragEnter={handleDragEnter}
			onDragLeave={handleDragLeave}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
		>
			<div
				css={{
					display: "flex",
					background: theme.tabBarBg,
					borderBottom: `1px solid ${theme.border}`,
					flexShrink: 0,
					height: 35,
					boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
					zIndex: 1,
					position: "relative",
				}}
			>
				{visibleTabs.map((tab) => {
					const active = tab.page === activePage;
					return (
						<div
							key={tab.page}
							draggable={closable}
							onDragStart={(e) => {
								e.dataTransfer.setData(
									"application/x-tab",
									JSON.stringify({ page: tab.page, from: paneId }),
								);
								e.dataTransfer.effectAllowed = "move";
							}}
							css={{
								padding: "0 4px 0 16px",
								display: "flex",
								alignItems: "center",
								gap: 6,
								fontSize: 13,
								color: active ? theme.foreground : theme.textMuted,
								background: active ? theme.tabActiveBg : theme.tabInactiveBg,
								borderRight: `1px solid ${theme.border}`,
								borderBottom: active
									? `1px solid ${theme.tabActiveBg}`
									: "none",
								marginBottom: active ? -1 : 0,
								cursor: "grab",
								whiteSpace: "nowrap",
								transition: "all 0.15s",
								"&:hover": {
									color: theme.foreground,
								},
								"&:active": {
									cursor: "grabbing",
								},
							}}
							onClick={() => onSetPage(tab.page)}
							onKeyDown={(e) => {
								if (e.key === "Enter") onSetPage(tab.page);
							}}
							role="tab"
							tabIndex={0}
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
							<span css={{ fontFamily: "inherit" }}>{tab.filename}</span>
							<button
								type="button"
								css={{
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									width: 20,
									height: 20,
									border: "none",
									background: "transparent",
									color: closable && active ? theme.textMuted : "transparent",
									borderRadius: 3,
									cursor: closable ? "pointer" : "default",
									fontSize: 14,
									lineHeight: 1,
									fontFamily: "inherit",
									"&:hover": closable
										? {
												background: theme.border,
												color: theme.foreground,
											}
										: {},
								}}
								onClick={(e) => {
									e.stopPropagation();
									if (closable) onCloseTab(tab.page);
								}}
								tabIndex={closable ? 0 : -1}
							>
								×
							</button>
						</div>
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
						title={splitActive ? t("tabs.close_split") : t("tabs.split_editor")}
					>
						<SplitIcon active={splitActive} />
					</button>
				)}
			</div>
			<div css={contentCss}>
				{isEmpty ? (
					<div
						css={{
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "center",
							height: "100%",
							gap: 16,
							color: theme.textMuted,
							opacity: 0.3,
							userSelect: "none",
						}}
					>
						<span css={{ fontSize: 80 }}>{"</>"}</span>
						<span css={{ fontSize: 14 }}>
							{t("tabs.empty_panel", {
								defaultValue: "Open a file from the sidebar",
							})}
						</span>
					</div>
				) : (
					<PageContent page={activePage} />
				)}
			</div>
			{dragZone === "center" && (
				<div
					css={{
						position: "absolute",
						inset: 0,
						background: "rgba(88, 166, 255, 0.08)",
						border: "2px dashed rgba(88, 166, 255, 0.4)",
						borderRadius: 4,
						zIndex: 5,
						pointerEvents: "none",
					}}
				/>
			)}
			{dragZone === "right" && (
				<div
					css={{
						position: "absolute",
						top: 0,
						right: 0,
						bottom: 0,
						width: "40%",
						background: "rgba(88, 166, 255, 0.12)",
						borderLeft: "2px dashed rgba(88, 166, 255, 0.5)",
						borderRadius: "0 4px 4px 0",
						zIndex: 5,
						pointerEvents: "none",
					}}
				/>
			)}
		</div>
	);
}

export function App() {
	useGameLoop();
	useAudioEvents();
	useTutorialTriggers();
	useKeyboardShortcuts();
	const { t } = useTranslation();
	const page = useUiStore((s) => s.page);
	const setPage = useUiStore((s) => s.setPage);
	const openTabs = useUiStore((s) => s.openTabs);
	const closeTab = useUiStore((s) => s.closeTab);
	const splitEnabled = useUiStore((s) => s.splitEnabled);
	const rightPage = useUiStore((s) => s.rightPage);
	const setRightPage = useUiStore((s) => s.setRightPage);
	const rightOpenTabs = useUiStore((s) => s.rightOpenTabs);
	const closeRightTab = useUiStore((s) => s.closeRightTab);
	const focusPane = useUiStore((s) => s.focusPane);
	const toggleSplit = useUiStore((s) => s.toggleSplit);
	const uiZoom = useUiStore((s) => s.uiZoom);
	const sidebarWidth = useUiStore((s) => s.sidebarWidth);
	const setSidebarWidth = useUiStore((s) => s.setSidebarWidth);
	const statsPanelWidth = useUiStore((s) => s.statsPanelWidth);
	const setStatsPanelWidth = useUiStore((s) => s.setStatsPanelWidth);
	const splitRatio = useUiStore((s) => s.splitRatio);
	const setSplitRatio = useUiStore((s) => s.setSplitRatio);
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
	const hasReachedSingularity = useGameStore((s) => s.hasReachedSingularity);
	const showGodMode =
		hasReachedSingularity || location.hostname === "localhost";
	const middleTabs = showGodMode ? [...baseTabs, godModeTab] : baseTabs;
	const theme = useIdeTheme();
	const shellRef = useRef<HTMLDivElement>(null);
	const singularityOnMount = useRef(useGameStore.getState().singularity);
	const singularityAnimate = singularity && !singularityOnMount.current;

	// "Focused Workers" achievement: grant $10 when all tabs closed (once per session)
	const focusedAchieved = useRef(false);
	useEffect(() => {
		if (openTabs.length === 0 && !splitEnabled && !focusedAchieved.current) {
			focusedAchieved.current = true;
			useGameStore.getState().applyEventReward(10, 0);
			useEventStore
				.getState()
				.showMilestoneToast(
					"focused_workers",
					"Focused Workers",
					"You closed all tabs. Here's $10 for your troubles.",
					10,
				);
		}
	}, [openTabs.length, splitEnabled]);

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

	return (
		<>
			<Global styles={globalStyles} />
			<RotateNudge />
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
					singularity && { position: "relative" as const, zIndex: 10 },
					singularity && singularityAnimate && shellCollapseCss,
				]}
			>
				{/* Main area: sidebar + center + stats panel */}
				<div css={{ display: "flex", flex: 1, overflow: "hidden" }}>
					{/* Left sidebar */}
					{sidebarUnlocked && sidebarCollapsed && (
						<button
							type="button"
							css={{
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
							}}
							style={{
								borderRight: `1px solid ${theme.border}`,
								background: theme.sidebarBg,
							}}
							onClick={toggleSidebar}
							title={t("sidebar.show")}
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
					)}
					<div
						css={{
							overflow: "hidden",
							flexShrink: 0,
							width: sidebarUnlocked && !sidebarCollapsed ? sidebarWidth : 0,
							transition:
								sidebarUnlocked && !sidebarCollapsed
									? "none"
									: "width 0.25s ease",
						}}
					>
						<SidebarTree onCollapse={toggleSidebar} />
					</div>
					{sidebarUnlocked && !sidebarCollapsed && (
						<ResizeHandle onResize={(d) => setSidebarWidth(sidebarWidth + d)} />
					)}

					{/* Center: tabbed panes + tutorial */}
					<div
						css={{
							display: "flex",
							flexDirection: "column",
							flex: 1,
							overflow: "hidden",
							minWidth: 0,
						}}
					>
						<div
							data-pane-container
							css={{ display: "flex", flex: 1, overflow: "hidden" }}
						>
							<div
								css={{
									display: "flex",
									flex: splitEnabled ? splitRatio : 1,
									overflow: "hidden",
									minWidth: 200,
								}}
							>
								<TabbedPane
									activePage={page}
									onSetPage={setPage}
									tabs={middleTabs}
									openTabs={openTabs}
									onCloseTab={closeTab}
									closable={sidebarUnlocked}
									onPaneFocus={() => focusPane("left")}
									paneId="left"
									showSplitBtn
									splitActive={splitEnabled}
									onToggleSplit={toggleSplit}
								/>
							</div>
							{splitEnabled && (
								<>
									<ResizeHandle
										onResize={(d) => {
											const container = document.querySelector(
												"[data-pane-container]",
											);
											if (!container) return;
											const total = container.clientWidth;
											setSplitRatio(splitRatio + d / total);
										}}
									/>
									<div
										css={{
											display: "flex",
											flex: 1 - splitRatio,
											overflow: "hidden",
											minWidth: 200,
										}}
									>
										<TabbedPane
											activePage={rightPage}
											onSetPage={setRightPage}
											tabs={middleTabs}
											openTabs={rightOpenTabs}
											onCloseTab={closeRightTab}
											closable={sidebarUnlocked}
											onPaneFocus={() => focusPane("right")}
											paneId="right"
										/>
									</div>
								</>
							)}
						</div>
						<TutorialTip />
					</div>

					{/* Right stats panel (full height) */}
					{statsPanelUnlocked && !statsPanelCollapsed && (
						<ResizeHandle
							onResize={(d) => setStatsPanelWidth(statsPanelWidth - d)}
						/>
					)}
					<div
						css={{
							overflow: "hidden",
							flexShrink: 0,
							width:
								statsPanelUnlocked && !statsPanelCollapsed
									? statsPanelWidth
									: 0,
							transition:
								statsPanelUnlocked && !statsPanelCollapsed
									? "none"
									: "width 0.25s ease",
						}}
					>
						<StatsPanel onCollapse={toggleStatsPanel} />
					</div>
					{statsPanelUnlocked && statsPanelCollapsed && (
						<button
							type="button"
							css={{
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
							}}
							style={{
								borderLeft: `1px solid ${theme.border}`,
								background: theme.sidebarBg,
							}}
							onClick={toggleStatsPanel}
							title={t("tabs.show_stats")}
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
					)}
				</div>

				{/* Status bar */}
				<StatusBar />
			</div>
			<EventToast />
			{singularity && (
				<Suspense fallback={null}>
					<SingularitySequence animate={singularityAnimate} />
				</Suspense>
			)}
		</>
	);
}
