import { css } from "@emotion/react";
import { useCallback, useRef } from "react";
import { useIdeTheme } from "../hooks/use-ide-theme";

const handleCss = css({
	width: 4,
	flexShrink: 0,
	cursor: "col-resize",
	position: "relative",
	zIndex: 3,
	"&::after": {
		content: '""',
		position: "absolute",
		top: 0,
		bottom: 0,
		left: -2,
		right: -2,
	},
	"&:hover, &:active": {
		"& > div": { opacity: 1 },
	},
});

interface ResizeHandleProps {
	onResize: (delta: number) => void;
}

export function ResizeHandle({ onResize }: ResizeHandleProps) {
	const theme = useIdeTheme();
	const startXRef = useRef(0);
	const onResizeRef = useRef(onResize);
	onResizeRef.current = onResize;

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		startXRef.current = e.clientX;

		const handleMouseMove = (ev: MouseEvent) => {
			const delta = ev.clientX - startXRef.current;
			startXRef.current = ev.clientX;
			onResizeRef.current(delta);
		};

		const handleMouseUp = () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
		};

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
	}, []);

	return (
		<div
			css={handleCss}
			style={{ background: theme.border }}
			onMouseDown={handleMouseDown}
		>
			<div
				css={{
					position: "absolute",
					top: 0,
					bottom: 0,
					left: 0,
					right: 0,
					opacity: 0,
					transition: "opacity 0.15s",
				}}
				style={{ background: theme.accent }}
			/>
		</div>
	);
}
