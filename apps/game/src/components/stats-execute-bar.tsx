import { css } from "@emotion/react";
import { tiers, useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";

function useRatePerSec(value: number): number {
	const valueRef = useRef(value);
	valueRef.current = value;
	const prevRef = useRef(value);
	const [rate, setRate] = useState(0);

	useEffect(() => {
		const id = setInterval(() => {
			setRate(Math.max(0, valueRef.current - prevRef.current));
			prevRef.current = valueRef.current;
		}, 1000);
		return () => clearInterval(id);
	}, []);

	return rate;
}

const wrapCss = css({
	display: "flex",
	alignItems: "center",
	gap: 8,
});

const btnCss = css({
	flex: 1,
	padding: "9px 0",
	fontSize: 13,
	fontWeight: "bold",
	fontFamily: "inherit",
	textTransform: "uppercase",
	letterSpacing: 1,
	borderRadius: 4,
	cursor: "pointer",
	transition: "all 0.1s",
});

const toggleColCss = css({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	gap: 3,
	flexShrink: 0,
});

const toggleTrackCss = css({
	width: 28,
	height: 14,
	borderRadius: 7,
	position: "relative",
	cursor: "pointer",
	transition: "background 0.2s",
});

const toggleThumbCss = css({
	position: "absolute",
	top: 2,
	width: 10,
	height: 10,
	borderRadius: "50%",
	background: "#e0e0e0",
	transition: "left 0.2s",
});

export function StatsExecuteBar() {
	const { t } = useTranslation();
	const theme = useIdeTheme();
	const loc = useGameStore((s) => s.loc);
	const flops = useGameStore((s) => s.flops);
	const totalCash = useGameStore((s) => s.totalCash);
	const currentTierIndex = useGameStore((s) => s.currentTierIndex);
	const cashMultiplier = useGameStore((s) => s.cashMultiplier);
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);
	const autoExec = useGameStore((s) => s.autoExecuteEnabled);
	const autoExecUnlocked = useGameStore(
		(s) => (s.ownedTechNodes.auto_execute ?? 0) > 0,
	);
	const toggleAutoExecute = useGameStore((s) => s.toggleAutoExecute);
	const executeManual = useGameStore((s) => s.executeManual);
	const flopSlider = useGameStore((s) => s.flopSlider);

	const cashRate = useRatePerSec(totalCash);

	const tier = tiers[currentTierIndex];
	const cashPerLoc = tier?.cashPerLoc ?? 0.1;

	const execFlops = aiUnlocked ? flops * flopSlider : flops;
	const execLoc = Math.min(Math.floor(execFlops), Math.floor(loc));
	const earnPerExec = execLoc * cashPerLoc * cashMultiplier;

	const autoDisplay = (
		<div
			style={{
				flex: 1,
				textAlign: "center",
				padding: "9px 0",
				fontSize: 13,
				fontWeight: "bold",
				fontFamily: "inherit",
				textTransform: "uppercase",
				letterSpacing: 1,
				color: theme.success,
				border: `1px solid ${theme.success}80`,
				borderRadius: 4,
				background: `${theme.success}1A`,
			}}
		>
			⚡ ${formatNumber(cashRate, true)}/s
		</div>
	);

	const manualButton = (
		<button
			type="button"
			css={btnCss}
			onClick={executeManual}
			disabled={execLoc <= 0}
			style={{
				border: `1px solid ${theme.success}`,
				background: "transparent",
				color: theme.success,
			}}
		>
			{t("stats_panel.execute", {
				loc: formatNumber(execLoc),
				earn: formatNumber(earnPerExec, true),
			})}
		</button>
	);

	const toggleSwitch = (
		<div css={toggleColCss}>
			<span
				style={{
					fontSize: 9,
					textTransform: "uppercase",
					letterSpacing: 0.5,
					color: theme.textMuted,
					lineHeight: 1,
				}}
			>
				Auto
			</span>
			<div
				css={toggleTrackCss}
				onClick={toggleAutoExecute}
				style={{
					background: autoExec ? theme.success : theme.lineNumbers,
				}}
			>
				<span css={toggleThumbCss} style={{ left: autoExec ? 16 : 2 }} />
			</div>
		</div>
	);

	return (
		<div
			style={{
				padding: "8px 12px",
				borderTop: `1px solid ${theme.border}`,
				flexShrink: 0,
			}}
		>
			{autoExecUnlocked ? (
				<div css={wrapCss}>
					{autoExec ? autoDisplay : manualButton}
					{toggleSwitch}
				</div>
			) : (
				manualButton
			)}
		</div>
	);
}
