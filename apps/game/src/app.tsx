import { EditorPanel } from "@components/editor-panel";
import { GodModePage } from "@components/god-mode-page";
import { MobileShell } from "@components/mobile-shell";
import { SidebarTree } from "@components/sidebar-tree";
import { StatusBar } from "@components/status-bar";
import { TechTreePage } from "@components/tech-tree-page";
import { TutorialTip, useTutorialTriggers } from "@components/tutorial-screen";
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

// ── Shared tab bar styles ──

const tabBarCss = css({
	display: "flex",
	background: "#0d1117",
	borderBottom: "1px solid #1e2630",
	flexShrink: 0,
});

const tabCss = css({
	padding: "8px 16px",
	fontSize: 14,
	color: "#5c6370",
	background: "#0d1117",
	border: "none",
	borderRight: "1px solid #1e2630",
	cursor: "pointer",
	fontFamily: "inherit",
	whiteSpace: "nowrap",
	transition: "all 0.15s",
	"&:hover": { color: "#8b949e", background: "#141920" },
});

const tabActiveCss = css(tabCss, {
	color: "#c9d1d9",
	background: "#141920",
	borderBottom: "1px solid #141920",
	marginBottom: -1,
});

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
	{ page: PageEnum.tech_tree, filename: "tech_tree.svg" },
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

const themeCardActiveCss = css({
	borderColor: "#58a6ff",
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
	const autoTypeUnlocked = useGameStore(
		(s) => (s.ownedTechNodes.auto_type ?? 0) > 0,
	);
	const autoTypeEnabled = useGameStore((s) => s.autoTypeEnabled);
	const toggleAutoType = useGameStore((s) => s.toggleAutoType);
	const reset = useGameStore((s) => s.reset);
	const resetTips = useUiStore((s) => s.resetTips);
	const editorTheme = useUiStore((s) => s.editorTheme);
	const setEditorTheme = useUiStore((s) => s.setEditorTheme);

	return (
		<div css={settingsPageCss}>
			<div css={settingsSectionCss}>
				<div css={settingsHeadingCss}>{"// Editor Theme"}</div>
				<div css={themeGridCss}>
					{themeEntries.map(([id, theme]) => (
						<div
							key={id}
							css={[themeCardCss, editorTheme === id && themeCardActiveCss]}
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
				<div css={settingsHeadingCss}>{"// Gameplay"}</div>
				{autoTypeUnlocked && (
					<label css={settingsRowCss}>
						<input
							type="checkbox"
							checked={autoTypeEnabled}
							onChange={toggleAutoType}
							style={{ accentColor: "#58a6ff" }}
						/>
						{'"autoType":'} {autoTypeEnabled ? "true" : "false"}
					</label>
				)}
				{!autoTypeUnlocked && (
					<div css={[settingsRowCss, { color: "#484f58" }]}>
						{"// Auto-type locked — research it in tech_tree.svg"}
					</div>
				)}
			</div>
			<div css={settingsSectionCss}>
				<div css={[settingsHeadingCss, { color: "#e94560" }]}>
					{"// Danger Zone"}
				</div>
				<button
					type="button"
					css={{
						fontFamily: "inherit",
						fontSize: 12,
						padding: "6px 12px",
						background: "#0d1117",
						color: "#e94560",
						border: "1px solid #e94560",
						borderRadius: 4,
						cursor: "pointer",
						"&:hover": { background: "#e94560", color: "#fff" },
					}}
					onClick={() => {
						reset();
						resetTips();
						window.location.reload();
					}}
				>
					{'"resetGame": true'}
				</button>
			</div>
		</div>
	);
}

export function App() {
	useGameLoop();
	useTutorialTriggers();
	const isMobile = useIsMobile();
	const page = useUiStore((s) => s.page);
	const setPage = useUiStore((s) => s.setPage);
	const singularity = useGameStore((s) => s.singularity);
	const shellRef = useRef<HTMLDivElement>(null);
	const singularityOnMount = useRef(useGameStore.getState().singularity);
	const singularityAnimate = singularity && !singularityOnMount.current;

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
				<TutorialTip />
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
						height: "100vh",
						overflow: "hidden",
						background: "#0a0e14",
						color: "#c5c8c6",
						fontFamily: "'Courier New', monospace",
					},
					singularity && singularityAnimate && shellCollapseCss,
				]}
			>
				{/* Main area: sidebar + tabbed content */}
				<div css={{ display: "flex", flex: 1, overflow: "hidden" }}>
					<SidebarTree />

					{/* Tabbed main area */}
					<div css={[panelCss, { flex: 1 }]}>
						<div css={tabBarCss}>
							{middleTabs.map((t) => (
								<button
									key={t.page}
									type="button"
									css={t.page === page ? tabActiveCss : tabCss}
									onClick={() => setPage(t.page)}
								>
									{t.filename}
								</button>
							))}
						</div>
						<div css={contentCss}>
							{match(page)
								.with(PageEnum.game, () => <EditorPanel />)
								.with(PageEnum.tech_tree, () => <TechTreePage />)
								.with(PageEnum.settings, () => <SettingsPage />)
								.with(PageEnum.god_mode, () => <GodModePage />)
								.exhaustive()}
						</div>
					</div>
				</div>

				{/* Status bar */}
				<StatusBar />
			</div>
			<EventToast />
			<TutorialTip />
			{singularity && <SingularitySequence animate={singularityAnimate} />}
		</>
	);
}
