import { css } from "@emotion/react";
import { useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";

const wrapperCss = css({
	padding: "10px 14px",
	flexShrink: 0,
});

const labelRowCss = css({
	display: "flex",
	justifyContent: "space-between",
	marginBottom: 6,
	fontSize: 10,
	userSelect: "none",
});

const barWrapCss = css({
	position: "relative",
	height: 14,
	borderRadius: 7,
	overflow: "hidden",
	cursor: "grab",
	touchAction: "none",
	"&:active": { cursor: "grabbing" },
});

const handleCss = css({
	position: "absolute",
	top: -1,
	width: 16,
	height: 16,
	borderRadius: "50%",
	transform: "translateX(-50%)",
	boxShadow: "0 0 4px rgba(0,0,0,0.5)",
	zIndex: 1,
	pointerEvents: "none",
});

const rateRowCss = css({
	display: "flex",
	justifyContent: "space-between",
	marginTop: 4,
	fontSize: 9,
});

const arbitrageCss = css({
	display: "flex",
	alignItems: "center",
	gap: 8,
	marginTop: 6,
	padding: "4px 0",
	cursor: "pointer",
	userSelect: "none",
	"&:hover": { opacity: 0.8 },
});

const toggleTrackCss = css({
	width: 28,
	height: 14,
	borderRadius: 7,
	position: "relative" as const,
	transition: "background 0.2s",
	flexShrink: 0,
});

const toggleThumbCss = css({
	position: "absolute" as const,
	top: 2,
	width: 10,
	height: 10,
	borderRadius: "50%",
	background: "#e6edf3",
	transition: "left 0.2s",
	display: "block",
});

export function FlopsSlider() {
	const { t } = useTranslation();
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);
	const flops = useGameStore((s) => s.flops);
	const flopSlider = useGameStore((s) => s.flopSlider);
	const autoArbitrageEnabled = useGameStore((s) => s.autoArbitrageEnabled);
	const autoArbitrageUnlocked = useGameStore(
		(s) => (s.ownedTechNodes.auto_arbitrage ?? 0) > 0,
	);
	const setFlopSlider = useGameStore((s) => s.setFlopSlider);
	const toggleAutoArbitrage = useGameStore((s) => s.toggleAutoArbitrage);
	const theme = useIdeTheme();

	const barRef = useRef<HTMLDivElement>(null);
	const [dragging, setDragging] = useState(false);

	const updateSlider = useCallback(
		(clientX: number) => {
			const bar = barRef.current;
			if (!bar) return;
			const rect = bar.getBoundingClientRect();
			const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
			setFlopSlider(ratio);
		},
		[setFlopSlider],
	);

	const onPointerDown = useCallback(
		(e: React.PointerEvent) => {
			setDragging(true);
			(e.target as HTMLElement).setPointerCapture(e.pointerId);
			updateSlider(e.clientX);
		},
		[updateSlider],
	);

	const onPointerMove = useCallback(
		(e: React.PointerEvent) => {
			if (!dragging) return;
			updateSlider(e.clientX);
		},
		[dragging, updateSlider],
	);

	const onPointerUp = useCallback(() => {
		setDragging(false);
	}, []);

	if (!aiUnlocked) return null;

	const execFlops = flops * flopSlider;
	const aiFlops = flops * (1 - flopSlider);
	const execPct = Math.round(flopSlider * 100);
	const aiPct = 100 - execPct;

	// Blue = LoC generation (AI side), Gold = cash execution
	const locColor = theme.locColor ?? "#61afef";
	const cashColor = theme.cashColor ?? "#e5c07b";

	return (
		<div css={wrapperCss} style={{ borderBottom: `1px solid ${theme.border}` }}>
			{/* Labels */}
			<div css={labelRowCss}>
				<span style={{ color: cashColor, fontWeight: 600 }}>
					{t("flops_slider.exec_flops", { count: formatNumber(execFlops) })}
				</span>
				<span style={{ color: locColor, fontWeight: 600 }}>
					{t("flops_slider.ai_flops", { count: formatNumber(aiFlops) })}
				</span>
			</div>

			{/* Draggable split bar */}
			<div
				ref={barRef}
				css={barWrapCss}
				style={{ border: `1px solid ${theme.border}` }}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={onPointerUp}
			>
				<div
					style={{
						position: "absolute",
						left: 0,
						top: 0,
						bottom: 0,
						width: `${execPct}%`,
						background: cashColor,
						borderRadius: "6px 0 0 6px",
						transition: dragging ? "none" : "width 0.1s ease",
					}}
				/>
				<div
					style={{
						position: "absolute",
						right: 0,
						top: 0,
						bottom: 0,
						width: `${aiPct}%`,
						background: locColor,
						borderRadius: "0 6px 6px 0",
						transition: dragging ? "none" : "width 0.1s ease",
					}}
				/>
				{/* Drag handle */}
				<div
					css={handleCss}
					style={{
						left: `${execPct}%`,
						background: theme.foreground,
						border: `2px solid ${theme.background}`,
						transition: dragging ? "none" : "left 0.1s ease",
					}}
				/>
			</div>

			{/* Rate labels */}
			<div css={rateRowCss}>
				<span style={{ color: theme.textMuted }}>
					{formatNumber(execFlops)} LoC/s → $
				</span>
				<span style={{ color: theme.textMuted }}>
					{formatNumber(aiFlops)} → LoC
				</span>
			</div>

			{/* Auto-arbitrage toggle */}
			{autoArbitrageUnlocked && (
				<div css={arbitrageCss} onClick={toggleAutoArbitrage}>
					<span style={{ fontSize: 14 }}>{"⚖️"}</span>
					<span
						style={{
							fontSize: 11,
							color: autoArbitrageEnabled ? theme.type : theme.textMuted,
						}}
					>
						{t("flops_slider.auto_arbitrage_active")}
					</span>
					<div
						css={toggleTrackCss}
						style={{
							background: autoArbitrageEnabled ? theme.type : theme.border,
						}}
					>
						<span
							css={toggleThumbCss}
							style={{ left: autoArbitrageEnabled ? 16 : 2 }}
						/>
					</div>
					{autoArbitrageEnabled && (
						<span
							style={{
								marginLeft: "auto",
								fontSize: 10,
								color: theme.textMuted,
							}}
						>
							{t("flops_slider.targeting", { pct: execPct })}
						</span>
					)}
				</div>
			)}
		</div>
	);
}
