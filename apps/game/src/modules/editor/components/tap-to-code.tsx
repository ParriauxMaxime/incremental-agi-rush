import { css, keyframes } from "@emotion/react";
import { useGameStore } from "@modules/game";
import { useCallback, useMemo, useRef, useState } from "react";

interface FloatingIndicator {
	id: number;
	x: number;
	y: number;
	amount: number;
}

const floatUp = keyframes({
	"0%": { opacity: 1, transform: "translateY(0)" },
	"100%": { opacity: 0, transform: "translateY(-60px)" },
});

const containerCss = css({
	position: "relative",
	flex: 1,
	touchAction: "manipulation",
	userSelect: "none",
	overflow: "hidden",
	display: "flex",
	flexDirection: "column",
});

const backgroundCss = css({
	position: "absolute",
	inset: 0,
	opacity: 0.15,
	fontSize: 12,
	lineHeight: 1.6,
	whiteSpace: "pre-wrap",
	wordBreak: "break-all",
	padding: 16,
	pointerEvents: "none",
	overflow: "hidden",
	color: "#8be9fd",
	fontFamily: "monospace",
});

const floatingCss = css({
	position: "absolute",
	pointerEvents: "none",
	fontWeight: 700,
	fontSize: 18,
	color: "#50fa7b",
	textShadow: "0 0 6px rgba(80, 250, 123, 0.5)",
	animation: `${floatUp} 800ms ease-out forwards`,
});

const hintCss = css({
	position: "absolute",
	bottom: 32,
	left: 0,
	right: 0,
	textAlign: "center",
	color: "#6272a4",
	fontSize: 14,
	pointerEvents: "none",
});

const MAX_INDICATORS = 8;

export function TapToCode() {
	const addLoc = useGameStore((s) => s.addLoc);
	const locPerKey = useGameStore((s) => s.locPerKey);
	const blockQueue = useGameStore((s) => s.blockQueue);

	const [indicators, setIndicators] = useState<FloatingIndicator[]>([]);
	const nextIdRef = useRef(0);

	const backgroundText = useMemo(() => {
		return blockQueue
			.flatMap((block) => block.lines)
			.map((line) => line.replace(/<[^>]*>/g, ""))
			.join("\n");
	}, [blockQueue]);

	const handleTap = useCallback(
		(x: number, y: number) => {
			addLoc(locPerKey);

			const id = nextIdRef.current++;
			setIndicators((prev) => {
				const next = [...prev, { id, x, y, amount: locPerKey }];
				if (next.length > MAX_INDICATORS) {
					return next.slice(next.length - MAX_INDICATORS);
				}
				return next;
			});

			setTimeout(() => {
				setIndicators((prev) => prev.filter((ind) => ind.id !== id));
			}, 800);
		},
		[addLoc, locPerKey],
	);

	const onTouchStart = useCallback(
		(e: React.TouchEvent) => {
			e.preventDefault();
			const touch = e.touches[0];
			const rect = e.currentTarget.getBoundingClientRect();
			handleTap(touch.clientX - rect.left, touch.clientY - rect.top);
		},
		[handleTap],
	);

	const onClick = useCallback(
		(e: React.MouseEvent) => {
			const rect = e.currentTarget.getBoundingClientRect();
			handleTap(e.clientX - rect.left, e.clientY - rect.top);
		},
		[handleTap],
	);

	return (
		<div css={containerCss} onClick={onClick} onTouchStart={onTouchStart}>
			<div css={backgroundCss}>{backgroundText}</div>

			{indicators.map((ind) => (
				<span
					key={ind.id}
					css={floatingCss}
					style={{ left: ind.x, top: ind.y }}
				>
					+{ind.amount} LoC
				</span>
			))}

			<span css={hintCss}>tap anywhere to code</span>
		</div>
	);
}
