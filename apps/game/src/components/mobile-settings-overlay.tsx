import { css } from "@emotion/react";
import {
	EDITOR_THEMES,
	type EditorTheme,
	type EditorThemeEnum,
} from "@modules/editor";
import { useGameStore, useUiStore } from "@modules/game";

interface MobileSettingsOverlayProps {
	onClose: () => void;
}

const backdropStyle = css({
	position: "fixed",
	inset: 0,
	background: "rgba(0,0,0,0.6)",
	zIndex: 200,
});

const panelStyle = css({
	position: "fixed",
	bottom: 0,
	left: 0,
	right: 0,
	maxHeight: "70vh",
	overflowY: "auto",
	background: "#0d1117",
	borderRadius: "12px 12px 0 0",
	borderTop: "1px solid #1e2630",
	padding: 16,
	zIndex: 201,
});

const headerStyle = css({
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	marginBottom: 16,
});

const titleStyle = css({
	fontSize: 18,
	fontWeight: 600,
	color: "#c9d1d9",
	margin: 0,
});

const closeButtonStyle = css({
	background: "none",
	border: "none",
	color: "#8b949e",
	fontSize: 20,
	cursor: "pointer",
	padding: "4px 8px",
	fontFamily: "inherit",
	"&:hover": {
		color: "#c9d1d9",
	},
});

const sectionLabelStyle = css({
	fontSize: 12,
	fontWeight: 600,
	color: "#8b949e",
	textTransform: "uppercase",
	letterSpacing: "0.05em",
	marginBottom: 8,
});

const themeGridStyle = css({
	display: "grid",
	gridTemplateColumns: "repeat(2, 1fr)",
	gap: 8,
	marginBottom: 16,
});

const swatchRowStyle = css({
	display: "flex",
	gap: 3,
	marginTop: 6,
});

const swatchDotStyle = css({
	width: 12,
	height: 12,
	borderRadius: "50%",
});

const toggleRowStyle = css({
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	padding: "12px 0",
	borderTop: "1px solid #1e2630",
});

const toggleLabelStyle = css({
	fontSize: 14,
	color: "#c9d1d9",
});

const toggleButtonStyle = css({
	padding: "6px 16px",
	borderRadius: 6,
	border: "1px solid #30363d",
	background: "none",
	color: "#c9d1d9",
	fontSize: 13,
	cursor: "pointer",
	fontFamily: "inherit",
});

const toggleActiveStyle = css({
	background: "#1f6feb",
	borderColor: "#1f6feb",
});

const resetButtonStyle = css({
	marginTop: 16,
	width: "100%",
	padding: "10px 0",
	borderRadius: 6,
	border: "1px solid #da3633",
	background: "none",
	color: "#da3633",
	fontSize: 14,
	fontWeight: 600,
	cursor: "pointer",
	fontFamily: "inherit",
});

const themeSwatches: ReadonlyArray<keyof EditorTheme> = [
	"keyword",
	"function",
	"string",
	"number",
];

function ThemeCard({
	themeKey,
	theme,
	isActive,
	onSelect,
}: {
	themeKey: EditorThemeEnum;
	theme: EditorTheme;
	isActive: boolean;
	onSelect: (key: EditorThemeEnum) => void;
}) {
	return (
		<button
			type="button"
			css={css({
				background: theme.background,
				border: isActive ? "2px solid #58a6ff" : "1px solid #30363d",
				borderRadius: 8,
				padding: 10,
				cursor: "pointer",
				textAlign: "left",
				fontFamily: "inherit",
			})}
			onClick={() => onSelect(themeKey)}
		>
			<span
				css={css({
					fontSize: 12,
					color: theme.foreground,
					display: "block",
				})}
			>
				{theme.name}
			</span>
			<div css={swatchRowStyle}>
				{themeSwatches.map((key) => (
					<span
						key={key}
						css={[swatchDotStyle, css({ background: theme[key] })]}
					/>
				))}
			</div>
		</button>
	);
}

export function MobileSettingsOverlay({ onClose }: MobileSettingsOverlayProps) {
	const editorTheme = useUiStore((s) => s.editorTheme);
	const setEditorTheme = useUiStore((s) => s.setEditorTheme);
	const autoTypeEnabled = useGameStore((s) => s.autoTypeEnabled);
	const toggleAutoType = useGameStore((s) => s.toggleAutoType);
	const ownedTechNodes = useGameStore((s) => s.ownedTechNodes);

	const autoTypeUnlocked = (ownedTechNodes.auto_type ?? 0) > 0;

	const handleReset = () => {
		useGameStore.getState().reset();
		window.location.reload();
	};

	return (
		<>
			<div
				css={backdropStyle}
				onClick={onClose}
				onKeyDown={undefined}
				role="presentation"
			/>
			<div css={panelStyle}>
				<div css={headerStyle}>
					<h2 css={titleStyle}>Settings</h2>
					<button type="button" css={closeButtonStyle} onClick={onClose}>
						X
					</button>
				</div>

				<div css={sectionLabelStyle}>Theme</div>
				<div css={themeGridStyle}>
					{Object.entries(EDITOR_THEMES).map(([key, theme]) => (
						<ThemeCard
							key={key}
							themeKey={key as EditorThemeEnum}
							theme={theme}
							isActive={key === editorTheme}
							onSelect={setEditorTheme}
						/>
					))}
				</div>

				{autoTypeUnlocked && (
					<div css={toggleRowStyle}>
						<span css={toggleLabelStyle}>Auto-type</span>
						<button
							type="button"
							css={[toggleButtonStyle, autoTypeEnabled && toggleActiveStyle]}
							onClick={toggleAutoType}
						>
							{autoTypeEnabled ? "ON" : "OFF"}
						</button>
					</div>
				)}

				<button type="button" css={resetButtonStyle} onClick={handleReset}>
					Reset Game
				</button>
			</div>
		</>
	);
}
