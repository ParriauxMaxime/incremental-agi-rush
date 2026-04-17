import { css, keyframes } from "@emotion/react";
import { useCallback, useEffect, useState } from "react";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { useTouchDevice } from "../hooks/use-touch-device";

const SESSION_KEY = "flopsed-mobile-dismissed";

const fadeIn = keyframes({
	from: { opacity: 0 },
	to: { opacity: 1 },
});

const overlayCss = css({
	position: "fixed",
	inset: 0,
	zIndex: 9999,
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	gap: 20,
	padding: 32,
	animation: `${fadeIn} 0.3s ease-out`,
	textAlign: "center",
});

const iconCss = css({
	fontSize: 48,
	lineHeight: 1,
});

const titleCss = css({
	fontSize: 20,
	fontWeight: 700,
	lineHeight: 1.3,
	maxWidth: 320,
});

const messageCss = css({
	fontSize: 14,
	lineHeight: 1.5,
	maxWidth: 300,
});

const buttonCss = css({
	marginTop: 12,
	padding: "10px 20px",
	fontSize: 13,
	fontWeight: 600,
	border: "none",
	borderRadius: 6,
	cursor: "pointer",
	transition: "opacity 0.15s",
	"&:hover": { opacity: 0.85 },
});

export function RotateNudge() {
	const isTouch = useTouchDevice();
	const theme = useIdeTheme();
	const [dismissed, setDismissed] = useState(
		() => sessionStorage.getItem(SESSION_KEY) === "1",
	);

	// Prevent zoom on touch devices (except tech tree which handles its own)
	useEffect(() => {
		if (!isTouch) return;
		const handler = (e: TouchEvent) => {
			if (e.touches.length > 1) {
				// Allow pinch zoom only inside tech tree
				const target = e.target as HTMLElement;
				if (!target.closest(".react-flow")) {
					e.preventDefault();
				}
			}
		};
		document.addEventListener("touchmove", handler, { passive: false });
		return () => document.removeEventListener("touchmove", handler);
	}, [isTouch]);

	const dismiss = useCallback(() => {
		setDismissed(true);
		sessionStorage.setItem(SESSION_KEY, "1");
	}, []);

	if (!isTouch || dismissed) return null;

	return (
		<div
			css={overlayCss}
			style={{
				background: theme.background,
				color: theme.foreground,
			}}
		>
			<div css={iconCss}>🖥️</div>
			<div css={titleCss}>Best experienced on desktop</div>
			<div css={messageCss} style={{ color: theme.foreground }}>
				Flopsed is an IDE-based game, a bigger screen makes everything better.
			</div>
			<button
				type="button"
				css={buttonCss}
				style={{
					background: theme.accent,
					color: theme.background,
				}}
				onClick={dismiss}
			>
				Continue anyway, you're not my boss
			</button>
		</div>
	);
}
