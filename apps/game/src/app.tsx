import { EditorPanel } from "@components/editor-panel";
import { GodModePage } from "@components/god-mode-page";
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
import { EventToast } from "@modules/event/components/event-toast";
import { PageEnum, useGameLoop, useGameStore, useUiStore } from "@modules/game";
import { lazy, Suspense, useEffect, useRef } from "react";
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
	const { t } = useTranslation();

	return (
		<div css={[panelCss, { flex: 1 }]}>
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
						title={splitActive ? t("tabs.close_split") : t("tabs.split_editor")}
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
	useAudioEvents();
	useTutorialTriggers();
	useKeyboardShortcuts();
	const { t } = useTranslation();
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
							width: sidebarUnlocked && !sidebarCollapsed ? 260 : 0,
							transition: "width 0.25s ease",
						}}
					>
						<SidebarTree onCollapse={toggleSidebar} />
					</div>

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
						<div css={{ display: "flex", flex: 1, overflow: "hidden" }}>
							<TabbedPane
								activePage={page}
								onSetPage={setPage}
								showSplitBtn
								splitActive={splitEnabled}
								onToggleSplit={toggleSplit}
							/>
							{splitEnabled && (
								<>
									<div
										css={{
											width: 1,
											background: theme.border,
											flexShrink: 0,
										}}
									/>
									<TabbedPane activePage={rightPage} onSetPage={setRightPage} />
								</>
							)}
						</div>
						<TutorialTip />
					</div>

					{/* Right stats panel (full height) */}
					<div
						css={{
							overflow: "hidden",
							flexShrink: 0,
							width: statsPanelUnlocked && !statsPanelCollapsed ? 280 : 0,
							transition: "width 0.25s ease",
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
