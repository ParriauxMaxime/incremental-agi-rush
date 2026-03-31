import { css, keyframes } from "@emotion/react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { useTouchDevice } from "../hooks/use-touch-device";

const SESSION_KEY = "flopsed-rotate-dismissed";

const slideDown = keyframes({
	from: { transform: "translateY(-100%)" },
	to: { transform: "translateY(0)" },
});

const barCss = css({
	position: "fixed",
	top: 0,
	left: 0,
	right: 0,
	zIndex: 9999,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	gap: 12,
	padding: "8px 16px",
	fontSize: 13,
	animation: `${slideDown} 0.3s ease-out`,
});

const closeBtnCss = css({
	background: "none",
	border: "none",
	cursor: "pointer",
	fontSize: 16,
	padding: "0 4px",
	lineHeight: 1,
});

export function RotateNudge() {
	const isTouch = useTouchDevice();
	const { t } = useTranslation("ui");
	const theme = useIdeTheme();
	const [portrait, setPortrait] = useState(false);
	const [dismissed, setDismissed] = useState(
		() => sessionStorage.getItem(SESSION_KEY) === "1",
	);

	useEffect(() => {
		const mql = window.matchMedia("(orientation: portrait)");
		setPortrait(mql.matches);
		const handler = (e: MediaQueryListEvent) => setPortrait(e.matches);
		mql.addEventListener("change", handler);
		return () => mql.removeEventListener("change", handler);
	}, []);

	const dismiss = useCallback(() => {
		setDismissed(true);
		sessionStorage.setItem(SESSION_KEY, "1");
	}, []);

	if (!isTouch || !portrait || dismissed) return null;

	return (
		<div
			css={barCss}
			style={{
				background: theme.statusBarBg,
				color: theme.statusBarFg,
				borderBottom: `1px solid ${theme.border}`,
			}}
		>
			<span>{t("mobile.rotate_device")}</span>
			<button
				css={closeBtnCss}
				style={{ color: theme.textMuted }}
				onClick={dismiss}
				type="button"
			>
				×
			</button>
		</div>
	);
}
