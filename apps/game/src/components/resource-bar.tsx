import { css, keyframes } from "@emotion/react";
import { aiModels, tiers, useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { RollingNumber } from "./rolling-number";

const statCellCss = css({
	flex: 1,
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	gap: 2,
	minWidth: 0,
	contain: "layout style",
});

const valueCss = css({
	fontSize: 22,
	fontWeight: "bold",
	lineHeight: 1.1,
	fontVariantNumeric: "tabular-nums",
	whiteSpace: "nowrap",
});

// ── Rate tracker: snapshot every 1s, display delta ──

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

const execPulse = keyframes({
	"0%": { boxShadow: "0 0 0 0 rgba(126, 231, 135, 0.4)" },
	"70%": { boxShadow: "0 0 0 6px rgba(126, 231, 135, 0)" },
	"100%": { boxShadow: "0 0 0 0 rgba(126, 231, 135, 0)" },
});

export function ResourceBar() {
	const theme = useIdeTheme();
	const { t } = useTranslation();

	const loc = useGameStore((s) => s.loc);
	const cash = useGameStore((s) => s.cash);
	const totalLoc = useGameStore((s) => s.totalLoc);
	const totalCash = useGameStore((s) => s.totalCash);
	const totalExecutedLoc = useGameStore((s) => s.totalExecutedLoc);
	const flops = useGameStore((s) => s.flops);
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);
	const unlockedModels = useGameStore((s) => s.unlockedModels);
	const currentTierIndex = useGameStore((s) => s.currentTierIndex);
	const cashMultiplier = useGameStore((s) => s.cashMultiplier);
	const autoExec = useGameStore((s) => s.autoExecuteEnabled);
	const executeManual = useGameStore((s) => s.executeManual);

	const locRate = useRatePerSec(totalLoc);
	const cashRate = useRatePerSec(totalCash);
	const execRate = useRatePerSec(totalExecutedLoc);

	const handleExec = useCallback(() => {
		executeManual();
	}, [executeManual]);

	const tier = tiers[currentTierIndex];
	const cashPerLoc = tier?.cashPerLoc ?? 0.1;

	// Compute FLOPS remaining after AI models consume their share
	let aiFlopsCost = 0;
	if (aiUnlocked) {
		for (const model of aiModels) {
			if (unlockedModels[model.id]) aiFlopsCost += model.flopsCost;
		}
	}
	const execFlops = Math.max(0, flops - Math.min(aiFlopsCost, flops));

	const barStyle = useMemo(
		() =>
			css({
				display: "flex",
				gap: 8,
				padding: "14px 12px 10px",
				borderBottom: `1px solid ${theme.border}`,
				background: theme.tabBarBg,
			}),
		[theme.border, theme.tabBarBg],
	);

	const labelStyle = useMemo(
		() =>
			css({
				fontSize: 10,
				textTransform: "uppercase",
				letterSpacing: 0.5,
				color: theme.textMuted,
			}),
		[theme.textMuted],
	);

	const rateStyle = useMemo(
		() =>
			css({
				fontSize: 10,
				color: theme.success,
				minHeight: 14,
			}),
		[theme.success],
	);

	const dividerStyle = useMemo(
		() =>
			css({
				width: 1,
				background: theme.border,
				alignSelf: "stretch",
				margin: "2px 0",
			}),
		[theme.border],
	);

	const execBarStyle = useMemo(
		() =>
			css({
				display: "flex",
				padding: "6px 12px",
				borderBottom: `1px solid ${theme.border}`,
				background: theme.tabBarBg,
			}),
		[theme.border, theme.tabBarBg],
	);

	const execBtnStyle = useMemo(
		() =>
			css({
				flex: 1,
				padding: "8px 0",
				fontSize: 12,
				fontWeight: "bold",
				fontFamily: "inherit",
				textTransform: "uppercase",
				letterSpacing: 1,
				border: `1px solid ${theme.success}`,
				borderRadius: 4,
				cursor: "pointer",
				transition: "all 0.1s",
				background: "transparent",
				color: theme.success,
				"&:hover": { background: theme.success, color: theme.background },
				"&:active": {
					transform: "scale(0.97)",
					animation: `${execPulse} 0.3s ease-out`,
				},
			}),
		[theme.success, theme.background],
	);

	const autoExecLabelStyle = useMemo(
		() =>
			css({
				flex: 1,
				padding: "8px 0",
				fontSize: 12,
				fontWeight: "bold",
				fontFamily: "inherit",
				textTransform: "uppercase",
				letterSpacing: 1,
				textAlign: "center",
				color: theme.success,
				border: `1px solid ${theme.success}80`,
				borderRadius: 4,
				background: `${theme.success}1a`,
			}),
		[theme.success],
	);

	return (
		<>
			<div css={barStyle}>
				<div css={statCellCss} data-tutorial="loc">
					<div css={valueCss}>
						<RollingNumber value={formatNumber(loc)} color={theme.accent} />
					</div>
					<div css={labelStyle}>{t("resource_bar.queued")}</div>
					<div css={rateStyle}>
						{locRate > 0.1
							? t("resource_bar.loc_rate", { rate: formatNumber(locRate) })
							: "\u00A0"}
					</div>
				</div>

				<div css={dividerStyle} />

				<div css={statCellCss} data-tutorial="cash">
					<div css={valueCss}>
						<RollingNumber
							value={`$${formatNumber(cash, true)}`}
							color="#d4a574"
						/>
					</div>
					<div css={labelStyle}>{t("resource_bar.cash")}</div>
					<div css={rateStyle}>
						{cashRate > 0.1
							? t("resource_bar.cash_rate", {
									rate: formatNumber(cashRate, true),
								})
							: "\u00A0"}
					</div>
				</div>

				<div css={dividerStyle} />

				<div css={statCellCss} data-tutorial="flops">
					<div css={valueCss}>
						<RollingNumber value={formatNumber(flops)} color={theme.keyword} />
					</div>
					<div css={labelStyle}>{t("resource_bar.flops")}</div>
					<div css={rateStyle}>
						{execRate > 0.1
							? t("resource_bar.loc_rate", { rate: formatNumber(execRate) })
							: "\u00A0"}
					</div>
				</div>
			</div>
			<div css={execBarStyle} data-tutorial="execute">
				{autoExec ? (
					<div css={autoExecLabelStyle}>
						{t("resource_bar.auto_execute", {
							rate: formatNumber(cashRate, true),
						})}
					</div>
				) : (
					(() => {
						const execLoc = Math.min(Math.floor(execFlops), Math.floor(loc));
						const earnPerExec = execLoc * cashPerLoc * cashMultiplier;
						return (
							<button
								type="button"
								css={execBtnStyle}
								onClick={handleExec}
								disabled={execLoc <= 0}
							>
								{t("resource_bar.execute", {
									loc: formatNumber(execLoc),
									earn: formatNumber(earnPerExec, true),
								})}
							</button>
						);
					})()
				)}
			</div>
		</>
	);
}
