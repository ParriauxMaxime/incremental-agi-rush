import { css, keyframes } from "@emotion/react";
import type { EditorTheme } from "../data/editor-themes";
import { useGameStore } from "@modules/game";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

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
	position: "absolute",
	inset: 0,
	touchAction: "manipulation",
	userSelect: "none",
	overflow: "hidden",
	zIndex: 10,
});

const floatingCss = css({
	position: "absolute",
	pointerEvents: "none",
	fontWeight: 700,
	fontSize: 18,
	animation: `${floatUp} 800ms ease-out forwards`,
});

const hintCss = css({
	position: "absolute",
	bottom: 32,
	left: 0,
	right: 0,
	textAlign: "center",
	fontSize: 14,
	pointerEvents: "none",
});

const MAX_INDICATORS = 8;
const HOLD_INTERVAL_MS = 100;

interface TapToCodeProps {
	theme: EditorTheme;
	onKeystroke: () => void;
}

export function TapToCode({ theme, onKeystroke }: TapToCodeProps) {
	const addLoc = useGameStore((s) => s.addLoc);
	const locPerKey = useGameStore((s) => s.locPerKey);
	const { t } = useTranslation("ui");

	const [indicators, setIndicators] = useState<FloatingIndicator[]>([]);
	const nextIdRef = useRef(0);
	const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const lastTapRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

	const spawnIndicator = useCallback(
		(x: number, y: number) => {
			const id = nextIdRef.current++;
			setIndicators((prev) => {
				const next = [...prev, { id, x, y, amount: locPerKey }];
				return next.length > MAX_INDICATORS
					? next.slice(next.length - MAX_INDICATORS)
					: next;
			});
			setTimeout(() => {
				setIndicators((prev) => prev.filter((ind) => ind.id !== id));
			}, 800);
		},
		[locPerKey],
	);

	const handleKeystroke = useCallback(
		(x: number, y: number) => {
			addLoc(locPerKey);
			onKeystroke();
			spawnIndicator(x, y);
		},
		[addLoc, locPerKey, onKeystroke, spawnIndicator],
	);

	const startHold = useCallback(
		(x: number, y: number) => {
			lastTapRef.current = { x, y };
			handleKeystroke(x, y);
			holdIntervalRef.current = setInterval(() => {
				const { x: hx, y: hy } = lastTapRef.current;
				const jx = hx + (Math.random() - 0.5) * 40;
				const jy = hy + (Math.random() - 0.5) * 40;
				handleKeystroke(jx, jy);
			}, HOLD_INTERVAL_MS);
		},
		[handleKeystroke],
	);

	const stopHold = useCallback(() => {
		if (holdIntervalRef.current) {
			clearInterval(holdIntervalRef.current);
			holdIntervalRef.current = null;
		}
	}, []);

	useEffect(() => {
		return () => {
			if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
		};
	}, []);

	const onTouchStart = useCallback(
		(e: React.TouchEvent) => {
			e.preventDefault();
			const touch = e.touches[0];
			const rect = e.currentTarget.getBoundingClientRect();
			startHold(touch.clientX - rect.left, touch.clientY - rect.top);
		},
		[startHold],
	);

	const onTouchEnd = useCallback(() => {
		stopHold();
	}, [stopHold]);

	const onMouseDown = useCallback(
		(e: React.MouseEvent) => {
			const rect = e.currentTarget.getBoundingClientRect();
			startHold(e.clientX - rect.left, e.clientY - rect.top);
		},
		[startHold],
	);

	const onMouseUp = useCallback(() => {
		stopHold();
	}, [stopHold]);

	const onMouseLeave = useCallback(() => {
		stopHold();
	}, [stopHold]);

	const glowColor = useMemo(() => {
		const hex = theme.locColor.replace("#", "");
		const r = Number.parseInt(hex.substring(0, 2), 16);
		const g = Number.parseInt(hex.substring(2, 4), 16);
		const b = Number.parseInt(hex.substring(4, 6), 16);
		return `rgba(${r}, ${g}, ${b}, 0.5)`;
	}, [theme.locColor]);

	return (
		<div
			css={containerCss}
			onTouchStart={onTouchStart}
			onTouchEnd={onTouchEnd}
			onTouchCancel={onTouchEnd}
			onMouseDown={onMouseDown}
			onMouseUp={onMouseUp}
			onMouseLeave={onMouseLeave}
		>
			{indicators.map((ind) => (
				<span
					key={ind.id}
					css={floatingCss}
					style={{
						left: ind.x,
						top: ind.y,
						color: theme.locColor,
						textShadow: `0 0 6px ${glowColor}`,
					}}
				>
					+{ind.amount} LoC
				</span>
			))}

			<span css={hintCss} style={{ color: theme.comment }}>
				{t("mobile.tap_or_hold")}
			</span>
		</div>
	);
}
