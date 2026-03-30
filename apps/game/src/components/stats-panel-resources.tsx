import { css } from "@emotion/react";
import { type AiModelData, aiModels, tiers, useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { RollingNumber } from "./rolling-number";

// ── Rate tracker ──

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

// ── Layout-only styles (no colors) ──

const sectionCss = css({
	padding: "8px 12px",
});

const statRowCss = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	padding: "6px 0",
});

const statValueCss = css({
	fontSize: 22,
	fontWeight: "bold",
	fontVariantNumeric: "tabular-nums",
});

const sourceRowCss = css({
	display: "flex",
	alignItems: "center",
	gap: 6,
	height: 22,
});

const sourceNameCss = css({
	fontSize: 11,
	minWidth: 60,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
});

const barFillCss = css({
	height: "100%",
	borderRadius: 3,
	transition: "width 0.3s ease",
});

const sourceValueCss = css({
	fontSize: 11,
	minWidth: 50,
	textAlign: "right",
	fontVariantNumeric: "tabular-nums",
});

// ── AI model colors ──

function modelColor(model: AiModelData, fallback: string): string {
	const colors: Record<string, string> = {
		claude: "#d4a574",
		gpt: "#74b9ff",
		gemini: "#fbbf24",
		llama: "#a29bfe",
		mistral: "#fd79a8",
		grok: "#e17055",
		copilot: "#6c5ce7",
	};
	return colors[model.family] ?? fallback;
}

// ── Source row types ──

interface SourceRow {
	name: string;
	locPerSec: number;
	color: string;
	count?: number;
}

export function StatsPanelResources() {
	const { t } = useTranslation();
	const loc = useGameStore((s) => s.loc);
	const cash = useGameStore((s) => s.cash);
	const totalCash = useGameStore((s) => s.totalCash);
	const flops = useGameStore((s) => s.flops);
	const currentTierIndex = useGameStore((s) => s.currentTierIndex);
	const cashMultiplier = useGameStore((s) => s.cashMultiplier);
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);
	const unlockedModels = useGameStore((s) => s.unlockedModels);
	const autoExec = useGameStore((s) => s.autoExecuteEnabled);
	const executeManual = useGameStore((s) => s.executeManual);
	const llmHostSlots = useGameStore((s) => s.llmHostSlots);
	const freelancerLocPerSec = useGameStore((s) => s.freelancerLocPerSec);
	const internLocPerSec = useGameStore((s) => s.internLocPerSec);
	const devLocPerSec = useGameStore((s) => s.devLocPerSec);
	const teamLocPerSec = useGameStore((s) => s.teamLocPerSec);
	const managerBonus = useGameStore((s) => s.managerBonus);
	const locPerKey = useGameStore((s) => s.locPerKey);
	const autoLocPerSec = useGameStore((s) => s.autoLocPerSec);
	const ownedUpgrades = useGameStore((s) => s.ownedUpgrades);
	const theme = useIdeTheme();

	const cashRate = useRatePerSec(totalCash);

	const tier = tiers[currentTierIndex];
	const cashPerLoc = tier?.cashPerLoc ?? 0.1;

	let aiFlopsCost = 0;
	if (aiUnlocked) {
		for (const model of aiModels) {
			if (unlockedModels[model.id]) aiFlopsCost += model.flopsCost;
		}
	}
	const execFlops = Math.max(0, flops - Math.min(aiFlopsCost, flops));
	const execLoc = Math.min(Math.floor(execFlops), Math.floor(loc));
	const earnPerExec = execLoc * cashPerLoc * cashMultiplier;

	// ── Analytics sources ──

	const humanSources = useMemo((): SourceRow[] => {
		const rows: SourceRow[] = [];
		if ((ownedUpgrades.malt_freelancer ?? 0) > 0)
			rows.push({
				name: t("malt_freelancer.name", { ns: "upgrades" }),
				locPerSec: freelancerLocPerSec,
				color: theme.success,
				count: ownedUpgrades.malt_freelancer,
			});
		if ((ownedUpgrades.intern ?? 0) > 0)
			rows.push({
				name: t("intern.name", { ns: "upgrades" }),
				locPerSec: internLocPerSec,
				color: theme.accent,
				count: ownedUpgrades.intern,
			});
		if ((ownedUpgrades.dev_team ?? 0) > 0)
			rows.push({
				name: t("dev_team.name", { ns: "upgrades" }),
				locPerSec: teamLocPerSec,
				color: theme.keyword,
				count: ownedUpgrades.dev_team,
			});
		if (devLocPerSec > 0 && (ownedUpgrades.dev_team ?? 0) === 0)
			rows.push({
				name: t("dev_team.name", { ns: "upgrades" }),
				locPerSec: devLocPerSec,
				color: theme.accent,
			});
		rows.push({
			name: t("stats_panel.you"),
			locPerSec: locPerKey * 6,
			color: theme.keyword,
		});
		rows.sort((a, b) => b.locPerSec - a.locPerSec);
		return rows;
	}, [
		ownedUpgrades,
		freelancerLocPerSec,
		internLocPerSec,
		devLocPerSec,
		teamLocPerSec,
		locPerKey,
		theme,
		t,
	]);

	const aiSources = useMemo((): SourceRow[] => {
		if (!aiUnlocked) return [];
		const activeModels = aiModels
			.filter((m) => unlockedModels[m.id])
			.sort((a, b) => b.locPerSec - a.locPerSec)
			.slice(0, llmHostSlots);
		let remaining = flops;
		return activeModels.map((model) => {
			const modelFlops = Math.min(model.flopsCost, remaining);
			remaining -= modelFlops;
			const ratio = model.flopsCost > 0 ? modelFlops / model.flopsCost : 0;
			return {
				name: `${model.name} ${model.version}`,
				locPerSec: model.locPerSec * Math.min(1, ratio),
				color: modelColor(model, theme.textMuted),
			};
		});
	}, [aiUnlocked, unlockedModels, llmHostSlots, flops, theme]);

	const humanMaxLoc = Math.max(1, ...humanSources.map((s) => s.locPerSec));
	const aiMaxLoc = Math.max(1, ...aiSources.map((s) => s.locPerSec));
	const analyticsUnlocked = useGameStore(
		(s) => (s.ownedTechNodes.unlock_analytics ?? 0) > 0,
	);
	const showSources =
		analyticsUnlocked && (autoLocPerSec > 0 || humanSources.length > 1);

	// ── Themed styles ──

	const scrollCss = useMemo(
		() =>
			css({
				flex: 1,
				overflowY: "auto",
				padding: "8px 0",
				"&::-webkit-scrollbar": { width: 6 },
				"&::-webkit-scrollbar-track": { background: "transparent" },
				"&::-webkit-scrollbar-thumb": {
					background: theme.border,
					borderRadius: 3,
				},
			}),
		[theme.border],
	);

	const sectionLabelCss = useMemo(
		() =>
			css({
				fontSize: 11,
				textTransform: "uppercase",
				letterSpacing: 0.5,
				color: theme.textMuted,
				marginBottom: 8,
				display: "flex",
				alignItems: "center",
				gap: 6,
			}),
		[theme.textMuted],
	);

	const statLabelCss = useMemo(
		() =>
			css({
				fontSize: 12,
				color: theme.textMuted,
				display: "flex",
				alignItems: "center",
				gap: 6,
			}),
		[theme.textMuted],
	);

	const dividerCss = useMemo(
		() =>
			css({
				height: 1,
				background: theme.border,
				margin: "4px 12px",
			}),
		[theme.border],
	);

	const barTrackCss = useMemo(
		() =>
			css({
				flex: 1,
				height: 4,
				background: theme.border,
				borderRadius: 3,
				overflow: "hidden",
				minWidth: 30,
			}),
		[theme.border],
	);

	const execBarCss = useMemo(
		() =>
			css({
				padding: "8px 12px",
				borderTop: `1px solid ${theme.border}`,
				flexShrink: 0,
			}),
		[theme.border],
	);

	const execBtnCss = useMemo(
		() =>
			css({
				width: "100%",
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
				"&:active": { transform: "scale(0.97)" },
				"&:disabled": {
					opacity: 0.3,
					cursor: "default",
					"&:hover": {
						background: "transparent",
						color: theme.success,
					},
				},
			}),
		[theme.success, theme.background],
	);

	const autoExecLabelCss = useMemo(
		() =>
			css({
				width: "100%",
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
				background: `${theme.success}1A`,
			}),
		[theme.success],
	);

	return (
		<>
			{/* Resources (fixed, no scroll) */}
			<div css={{ padding: "8px 0", flexShrink: 0 }}>
				<div css={sectionCss}>
					<div css={sectionLabelCss}>{t("stats_panel.resources")}</div>

					<div css={statRowCss}>
						<div css={statLabelCss}>
							<span style={{ color: theme.cashColor }}>$</span>{" "}
							{t("stats_panel.cash")}
						</div>
						<div>
							<div css={statValueCss}>
								<RollingNumber
									value={`$${formatNumber(cash, true)}`}
									color={theme.cashColor}
								/>
							</div>
						</div>
					</div>

					<div css={statRowCss}>
						<div css={statLabelCss}>
							<span style={{ color: theme.locColor }}>◇</span>{" "}
							{t("stats_panel.loc")}
						</div>
						<div>
							<div css={statValueCss}>
								<RollingNumber
									value={formatNumber(loc)}
									color={theme.locColor}
								/>
							</div>
						</div>
					</div>

					<div css={statRowCss}>
						<div css={statLabelCss}>
							<span style={{ color: theme.flopsColor }}>⚡</span>{" "}
							{t("stats_panel.flops")}
						</div>
						<div>
							<div css={statValueCss}>
								<RollingNumber
									value={formatNumber(flops)}
									color={theme.flopsColor}
								/>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Scrollable: LoC Sources + FLOPS slider */}
			<div css={scrollCss}>
				{/* LoC Sources + AI Models (analytics unlock) */}
				{showSources && (
					<>
						<div css={dividerCss} />
						<div css={sectionCss}>
							<div
								css={{
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
								}}
							>
								<div css={sectionLabelCss}>
									{aiUnlocked
										? t("stats_panel.token_sources")
										: t("stats_panel.loc_sources")}
								</div>
								<span
									css={{
										fontSize: 12,
										fontVariantNumeric: "tabular-nums",
									}}
									style={{
										color: aiUnlocked ? theme.cashColor : theme.locColor,
									}}
								>
									{formatNumber(
										autoLocPerSec +
											locPerKey * 6 +
											(aiUnlocked
												? 0
												: aiSources.reduce((sum, s) => sum + s.locPerSec, 0)),
									)}{" "}
									{aiUnlocked
										? t("stats_panel.tokens_per_sec")
										: t("stats_panel.per_sec")}
								</span>
							</div>
							{humanSources.map((s) => (
								<div css={sourceRowCss} key={s.name}>
									<span css={sourceNameCss} style={{ color: theme.textMuted }}>
										{s.name}
										{s.count !== undefined && (
											<span style={{ color: theme.lineNumbers }}>
												{" "}
												x{s.count}
											</span>
										)}
									</span>
									<div css={barTrackCss}>
										<div
											css={barFillCss}
											style={{
												width: `${(s.locPerSec / humanMaxLoc) * 100}%`,
												background: s.color,
											}}
										/>
									</div>
									<span css={sourceValueCss} style={{ color: s.color }}>
										{formatNumber(s.locPerSec)}
										{t("stats_panel.per_sec")}
									</span>
								</div>
							))}
							{managerBonus > 1 && (
								<div
									css={sourceRowCss}
									style={{ fontSize: 9, color: theme.lineNumbers }}
								>
									<span css={sourceNameCss} style={{ color: theme.textMuted }}>
										{t("stats_panel.managers")}
									</span>
									<span>
										{t("stats_panel.manager_bonus", {
											bonus: Math.round((managerBonus - 1) * 100),
										})}
									</span>
								</div>
							)}
							{aiSources.length > 0 && (
								<>
									<div
										css={{
											height: 1,
											background: theme.border,
											margin: "6px 0",
										}}
									/>
									{aiSources.map((s) => (
										<div css={sourceRowCss} key={s.name}>
											<span
												css={sourceNameCss}
												style={{ color: theme.textMuted }}
											>
												{s.name}
											</span>
											<div css={barTrackCss}>
												<div
													css={barFillCss}
													style={{
														width: `${(s.locPerSec / aiMaxLoc) * 100}%`,
														background: s.color,
													}}
												/>
											</div>
											<span css={sourceValueCss} style={{ color: s.color }}>
												{formatNumber(s.locPerSec)}
												{t("stats_panel.per_sec")}
											</span>
										</div>
									))}
								</>
							)}
						</div>
					</>
				)}
			</div>

			{/* Execute button */}
			<div css={execBarCss}>
				{autoExec ? (
					<div css={autoExecLabelCss}>
						{t("stats_panel.auto_exec", { rate: formatNumber(cashRate, true) })}
					</div>
				) : (
					<button
						type="button"
						css={execBtnCss}
						onClick={executeManual}
						disabled={execLoc <= 0}
					>
						{t("stats_panel.execute", {
							loc: formatNumber(execLoc),
							earn: formatNumber(earnPerExec, true),
						})}
					</button>
				)}
			</div>
		</>
	);
}
