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

// ── Keypress rate tracker ──
// Three modes:
//   idle (no input for 3s)  → 0 keys/sec (auto-type handled separately)
//   active (discrete presses) → actual non-repeat keypress rate (3s window)
//   held (key repeat)        → capped at 12 keys/sec (fast sustained typing)

const IGNORED_KEYS = new Set([
	"Shift",
	"Control",
	"Alt",
	"Meta",
	"Tab",
	"Escape",
	"CapsLock",
]);
const HELD_CAP = 12;
const IDLE_TIMEOUT = 3000;

function useKeypressRate(): number {
	const pressTimestamps = useRef<number[]>([]);
	const heldRef = useRef(false);
	const lastKeyTime = useRef(0);
	const [rate, setRate] = useState(0);

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (IGNORED_KEYS.has(e.key)) return;
			lastKeyTime.current = performance.now();
			if (e.repeat) {
				heldRef.current = true;
			} else {
				heldRef.current = false;
				pressTimestamps.current.push(performance.now());
			}
		}
		function onKeyUp() {
			heldRef.current = false;
		}

		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);

		const id = setInterval(() => {
			const now = performance.now();
			if (now - lastKeyTime.current > IDLE_TIMEOUT) {
				// Idle: no keys for 3s
				pressTimestamps.current.length = 0;
				setRate(0);
			} else if (heldRef.current) {
				// Held: cap at reasonable fast typing speed
				setRate(HELD_CAP);
			} else {
				// Active: count non-repeat presses in last 3s
				const cutoff = now - IDLE_TIMEOUT;
				const ts = pressTimestamps.current;
				while (ts.length > 0 && ts[0] < cutoff) ts.shift();
				setRate(ts.length / 3);
			}
		}, 500);

		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			clearInterval(id);
		};
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
	contain: "layout style",
});

const statValueCss = css({
	fontSize: 22,
	fontWeight: "bold",
	fontVariantNumeric: "tabular-nums",
	contain: "layout style",
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
	width: "100%",
	transformOrigin: "left",
	transition: "transform 0.3s ease",
});

const sourceValueCss = css({
	fontSize: 11,
	minWidth: 50,
	textAlign: "right",
	fontVariantNumeric: "tabular-nums",
});

const resourcesWrapCss = css({
	padding: "8px 0",
	flexShrink: 0,
});

const sourcesHeaderCss = css({
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
});

const sourcesTotalCss = css({
	fontSize: 12,
	fontVariantNumeric: "tabular-nums",
});

const autoExecRowCss = css({
	display: "flex",
	alignItems: "center",
	gap: 8,
});

const toggleWrapCss = css({
	display: "flex",
	alignItems: "center",
	cursor: "pointer",
	userSelect: "none",
	flexShrink: 0,
	"&:hover": { opacity: 0.8 },
});

const toggleTrackCss = css({
	width: 28,
	height: 14,
	borderRadius: 7,
	position: "relative" as const,
	transition: "background 0.2s",
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

const aiDividerCss = css({
	height: 1,
	margin: "6px 0",
});

// ── AI model colors ──

function modelColor(model: AiModelData, fallback: string): string {
	const colors: Record<string, string> = {
		claude: "#d4a574",
		gpt: "#74b9ff",
		gemini: "#fbbf24",
		llama: "#a29bfe",
		mistral: "#fd79a8",
		deepseek: "#00d4aa",
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
	/** AI models: LoC output corresponding to token consumption */
	locOutput?: number;
	/** AI models: FLOPS demand */
	flopsCost?: number;
	/** AI models: FLOPS saturation percentage (0-1) */
	flopsPct?: number;
}

export function StatsPanelResources() {
	const { t } = useTranslation();
	const loc = useGameStore((s) => s.loc);
	const cash = useGameStore((s) => s.cash);
	const totalCash = useGameStore((s) => s.totalCash);
	const tokens = useGameStore((s) => s.tokens);
	const flops = useGameStore((s) => s.flops);
	const currentTierIndex = useGameStore((s) => s.currentTierIndex);
	const cashMultiplier = useGameStore((s) => s.cashMultiplier);
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);
	const unlockedModels = useGameStore((s) => s.unlockedModels);
	const autoExec = useGameStore((s) => s.autoExecuteEnabled);
	const autoExecUnlocked = useGameStore(
		(s) => (s.ownedTechNodes.auto_execute ?? 0) > 0,
	);
	const toggleAutoExecute = useGameStore((s) => s.toggleAutoExecute);
	const executeManual = useGameStore((s) => s.executeManual);
	const llmHostSlots = useGameStore((s) => s.llmHostSlots);
	const freelancerLocPerSec = useGameStore((s) => s.freelancerLocPerSec);
	const internLocPerSec = useGameStore((s) => s.internLocPerSec);
	const devLocPerSec = useGameStore((s) => s.devLocPerSec);
	const teamLocPerSec = useGameStore((s) => s.teamLocPerSec);
	const managerBonus = useGameStore((s) => s.managerBonus);
	const locPerKey = useGameStore((s) => s.locPerKey);
	const autoTypeEnabled = useGameStore((s) => s.autoTypeEnabled);
	const autoLocPerSec = useGameStore((s) => s.autoLocPerSec);
	const ownedUpgrades = useGameStore((s) => s.ownedUpgrades);
	const theme = useIdeTheme();
	const keysPerSec = useKeypressRate();

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
		// "You" rate: actual keypresses (3s window) + auto-type baseline (5 keys/s)
		const autoTypeKeysPerSec = autoTypeEnabled ? 5 : 0;
		const effectiveKeysPerSec = Math.max(keysPerSec, autoTypeKeysPerSec);
		rows.push({
			name: t("stats_panel.you"),
			locPerSec: effectiveKeysPerSec * locPerKey,
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
		autoTypeEnabled,
		keysPerSec,
		theme,
		t,
	]);

	const flopSlider = useGameStore((s) => s.flopSlider);
	const aiSources = useMemo((): SourceRow[] => {
		if (!aiUnlocked) return [];
		const activeModels = aiModels
			.filter((m) => unlockedModels[m.id])
			.slice(0, llmHostSlots);
		// Proportional FLOPS: all models share fairly
		const aiFlops = flops * (1 - flopSlider);
		let totalDemand = 0;
		for (const m of activeModels) totalDemand += m.flopsCost;
		const saturation = totalDemand > 0 ? Math.min(1, aiFlops / totalDemand) : 0;
		const rows = activeModels.map((model) => ({
			name: `${model.name} ${model.version}`,
			locPerSec: model.tokenCost * saturation,
			locOutput: model.locPerSec * saturation,
			flopsCost: model.flopsCost,
			flopsPct: saturation,
			color: modelColor(model, theme.textMuted),
		}));
		// Display sorted by consumption descending (hungriest first)
		rows.sort((a, b) => b.locPerSec - a.locPerSec);
		return rows;
	}, [aiUnlocked, unlockedModels, llmHostSlots, flops, flopSlider, theme]);

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
			<div css={resourcesWrapCss}>
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

					{aiUnlocked && (
						<div css={statRowCss}>
							<div css={statLabelCss}>
								<span style={{ color: theme.tokenColor }}>🪙</span>{" "}
								{t("stats_panel.tokens")}
							</div>
							<div>
								<div css={statValueCss}>
									<RollingNumber
										value={formatNumber(tokens)}
										color={theme.tokenColor}
									/>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Scrollable: LoC Sources + FLOPS slider */}
			<div css={scrollCss}>
				{/* LoC Sources + AI Models (analytics unlock) */}
				{showSources && (
					<>
						<div css={dividerCss} />
						<div css={sectionCss}>
							<div css={sourcesHeaderCss}>
								<div css={sectionLabelCss}>
									{aiUnlocked
										? t("stats_panel.token_sources")
										: t("stats_panel.loc_sources")}
								</div>
								<span
									css={sourcesTotalCss}
									style={{
										color: aiUnlocked ? theme.cashColor : theme.locColor,
									}}
								>
									{formatNumber(
										autoLocPerSec +
											Math.max(keysPerSec, autoTypeEnabled ? 5 : 0) *
												locPerKey +
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
												transform: `scaleX(${s.locPerSec / humanMaxLoc})`,
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
										css={aiDividerCss}
										style={{ background: theme.border }}
									/>
									<div css={sourcesHeaderCss} style={{ marginBottom: 2 }}>
										<span css={sectionLabelCss} style={{ fontSize: 10 }}>
											🔥{" "}
											{t("stats_panel.token_consumers", {
												defaultValue: "Token Consumers",
											})}
										</span>
										<span
											css={sourcesTotalCss}
											style={{ color: theme.tokenColor }}
										>
											{formatNumber(
												aiSources.reduce((sum, s) => sum + s.locPerSec, 0),
											)}{" "}
											tok/s
										</span>
									</div>
									<div
										css={sourceRowCss}
										style={{
											height: 16,
											fontSize: 10,
											marginBottom: 2,
										}}
									>
										<span style={{ color: theme.flopsColor }}>
											⚡ {formatNumber(flops * (1 - flopSlider))}
										</span>
										<span style={{ color: theme.textMuted }}>/</span>
										<span
											style={{
												color:
													(aiSources[0]?.flopsPct ?? 0) < 0.5
														? "#f44336"
														: (aiSources[0]?.flopsPct ?? 0) < 0.9
															? "#fbbf24"
															: theme.success,
											}}
										>
											{formatNumber(
												aiSources.reduce(
													(sum, s) => sum + (s.flopsCost ?? 0),
													0,
												),
											)}{" "}
											FLOPS ({Math.round((aiSources[0]?.flopsPct ?? 0) * 100)}%)
										</span>
									</div>
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
														transform: `scaleX(${s.locPerSec / aiMaxLoc})`,
														background: s.color,
													}}
												/>
											</div>
											<span css={sourceValueCss} style={{ color: s.color }}>
												{formatNumber(s.locOutput ?? 0)}/s
												<span
													style={{
														color:
															(s.flopsPct ?? 0) < 0.5
																? "#f44336"
																: (s.flopsPct ?? 0) < 0.9
																	? "#fbbf24"
																	: theme.success,
														marginLeft: 3,
														fontSize: 9,
													}}
												>
													⚡{formatNumber(s.flopsCost ?? 0)}
												</span>
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
					<div css={autoExecRowCss}>
						<div css={autoExecLabelCss} style={{ flex: 1 }}>
							{t("stats_panel.auto_exec", {
								rate: formatNumber(cashRate, true),
							})}
						</div>
						<div
							css={toggleWrapCss}
							onClick={toggleAutoExecute}
							style={{ color: theme.success }}
						>
							<div css={toggleTrackCss} style={{ background: theme.success }}>
								<span css={toggleThumbCss} style={{ left: 16 }} />
							</div>
						</div>
					</div>
				) : autoExecUnlocked ? (
					<div css={autoExecRowCss}>
						<button
							type="button"
							css={execBtnCss}
							onClick={executeManual}
							disabled={execLoc <= 0}
							style={{ flex: 1 }}
						>
							{t("stats_panel.execute", {
								loc: formatNumber(execLoc),
								earn: formatNumber(earnPerExec, true),
							})}
						</button>
						<div
							css={toggleWrapCss}
							onClick={toggleAutoExecute}
							style={{ color: theme.textMuted }}
						>
							<div css={toggleTrackCss} style={{ background: "#30363d" }}>
								<span css={toggleThumbCss} style={{ left: 2 }} />
							</div>
						</div>
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
