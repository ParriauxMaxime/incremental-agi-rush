import { css } from "@emotion/react";
import { aiModels, useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { useKeypressRate } from "../hooks/use-keypress-rate";
import { CollapsibleSection } from "./collapsible-section";
import { RollingNumber } from "./rolling-number";
import { Sparkline } from "./sparkline";

// ── Tier colors for human sources ──
const SOURCE_COLORS = {
	you: "#5c6b8a",
	malt_freelancer: "#2a9d8f",
	intern: "#2a9d8f",
	dev_team: "#2d8a4e",
} as const;

// ── Styles ──

const sourceRowCss = css({
	display: "flex",
	alignItems: "center",
	gap: 6,
	height: 24,
});

const sourceNameCss = css({
	minWidth: 64,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
	fontSize: 11,
});

const barTrackCss = css({
	flex: 1,
	height: 4,
	borderRadius: 3,
	overflow: "hidden",
	minWidth: 30,
});

const barFillCss = css({
	height: "100%",
	borderRadius: 3,
	width: "100%",
	transformOrigin: "left",
	transition: "transform 0.3s ease",
});

const sourceValueCss = css({
	minWidth: 50,
	textAlign: "right",
	fontVariantNumeric: "tabular-nums",
	fontSize: 11,
});

interface SourceRow {
	name: string;
	locPerSec: number;
	color: string;
	count?: number;
}

export function StatsLocSection() {
	const { t } = useTranslation();
	const theme = useIdeTheme();
	const loc = useGameStore((s) => s.loc);
	const analyticsUnlocked = useGameStore(
		(s) => (s.ownedTechNodes.unlock_analytics ?? 0) > 0,
	);
	const graphsUnlocked = useGameStore(
		(s) => (s.ownedTechNodes.unlock_perf_graphs ?? 0) > 0,
	);
	const ownedUpgrades = useGameStore((s) => s.ownedUpgrades);
	const freelancerLocPerSec = useGameStore((s) => s.freelancerLocPerSec);
	const internLocPerSec = useGameStore((s) => s.internLocPerSec);
	const devLocPerSec = useGameStore((s) => s.devLocPerSec);
	const teamLocPerSec = useGameStore((s) => s.teamLocPerSec);
	const managerBonus = useGameStore((s) => s.managerBonus);
	const locPerKey = useGameStore((s) => s.locPerKey);
	const autoTypeEnabled = useGameStore((s) => s.autoTypeEnabled);
	const rateSnapshots = useGameStore((s) => s.rateSnapshots);
	const tierTransitions = useGameStore((s) => s.tierTransitions);
	const sessionStartTime = useGameStore((s) => s.sessionStartTime);

	const autoLocPerSec = useGameStore((s) => s.autoLocPerSec);
	const autoTypeLocPerSec = useGameStore((s) => s.autoTypeLocPerSec);
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);
	const tokenMultiplier = useGameStore((s) => s.tokenMultiplier);
	const keysPerSec = useKeypressRate();

	// "You" = max(physical typing, auto-type) + auto-type base
	const youLocPerSec = Math.max(keysPerSec, autoTypeEnabled ? 5 : 0) * locPerKey;
	const locRate = autoLocPerSec + youLocPerSec;
	const elapsed = (performance.now() - sessionStartTime) / 1000;

	// When AI is unlocked, workers become "token producers" — show tokens/s
	const tokenScale = aiUnlocked ? tokenMultiplier : 1;

	const humanSources = useMemo((): SourceRow[] => {
		const rows: SourceRow[] = [];
		if ((ownedUpgrades.malt_freelancer ?? 0) > 0)
			rows.push({
				name: t("malt_freelancer.name", { ns: "upgrades" }),
				locPerSec: freelancerLocPerSec * tokenScale,
				color: SOURCE_COLORS.malt_freelancer,
				count: ownedUpgrades.malt_freelancer,
			});
		if ((ownedUpgrades.intern ?? 0) > 0)
			rows.push({
				name: t("intern.name", { ns: "upgrades" }),
				locPerSec: internLocPerSec * tokenScale,
				color: SOURCE_COLORS.intern,
				count: ownedUpgrades.intern,
			});
		if ((ownedUpgrades.dev_team ?? 0) > 0)
			rows.push({
				name: t("dev_team.name", { ns: "upgrades" }),
				locPerSec: teamLocPerSec * tokenScale,
				color: SOURCE_COLORS.dev_team,
				count: ownedUpgrades.dev_team,
			});
		if (devLocPerSec > 0 && (ownedUpgrades.dev_team ?? 0) === 0)
			rows.push({
				name: t("dev_team.name", { ns: "upgrades" }),
				locPerSec: devLocPerSec * tokenScale,
				color: SOURCE_COLORS.dev_team,
			});
		rows.push({
			name: t("stats_panel.you"),
			locPerSec: youLocPerSec * tokenScale,
			color: SOURCE_COLORS.you,
		});
		rows.sort((a, b) => b.locPerSec - a.locPerSec);
		return rows;
	}, [
		ownedUpgrades,
		freelancerLocPerSec,
		internLocPerSec,
		devLocPerSec,
		teamLocPerSec,
		youLocPerSec,
		tokenScale,
		t,
	]);

	// AI LoC/s (same computation as flops-slider.tsx)
	const flops = useGameStore((s) => s.flops);
	const flopSlider = useGameStore((s) => s.flopSlider);
	const unlockedModels = useGameStore((s) => s.unlockedModels);
	const llmHostSlots = useGameStore((s) => s.llmHostSlots);

	const aiLocPerSec = useMemo(() => {
		if (!aiUnlocked) return 0;
		const active = aiModels
			.filter((m) => unlockedModels[m.id])
			.sort((a, b) => a.flopsCost - b.flopsCost)
			.slice(0, llmHostSlots);
		const aiFlops = flops * (1 - flopSlider);
		let totalTokenDemand = 0;
		for (const m of active) totalTokenDemand += m.tokenCost;
		const humanTokenOutput = autoLocPerSec * tokenMultiplier;
		const tokenEff =
			totalTokenDemand > 0
				? Math.min(1, humanTokenOutput / totalTokenDemand)
				: 0;
		let totalLoc = 0;
		let remaining = aiFlops;
		for (const model of active) {
			const modelFlops = Math.min(model.flopsCost, remaining);
			remaining -= modelFlops;
			const flopRatio =
				model.flopsCost > 0 ? modelFlops / model.flopsCost : 0;
			totalLoc += model.locPerSec * tokenEff * Math.min(1, flopRatio);
		}
		return totalLoc;
	}, [
		aiUnlocked,
		unlockedModels,
		flops,
		flopSlider,
		llmHostSlots,
		autoLocPerSec,
		tokenMultiplier,
	]);

	const humanMaxLoc = Math.max(1, ...humanSources.map((s) => s.locPerSec));

	const { locProdData, locExecData } = useMemo(
		() => ({
			locProdData: rateSnapshots.map((s) => s.locProducedPerSec),
			locExecData: rateSnapshots.map((s) => s.locExecutedPerSec),
		}),
		[rateSnapshots],
	);
	const latest = rateSnapshots[rateSnapshots.length - 1];

	const totalTokensPerSec = locRate * tokenMultiplier;
	const unit = aiUnlocked
		? t("stats_panel.tokens_per_sec")
		: t("stats_panel.per_sec");

	return (
		<CollapsibleSection
			icon={<span style={{ color: theme.locColor }}>◇</span>}
			label={
				aiUnlocked
					? t("stats_panel.token_producers")
					: t("stats_panel.loc")
			}
			value={
				aiUnlocked ? (
					<RollingNumber
						value={`${formatNumber(totalTokensPerSec)} tok/s`}
						color={theme.locColor}
					/>
				) : (
					<RollingNumber
						value={formatNumber(loc)}
						color={theme.locColor}
					/>
				)
			}
			rate={
				aiUnlocked ? (
					<span style={{ color: "#c678dd" }}>
						{"AI: "}
						{formatNumber(aiLocPerSec)}
						{t("stats_panel.per_sec")}
					</span>
				) : (
					<span style={{ color: theme.locColor }}>
						{formatNumber(locRate)}
						{t("stats_panel.per_sec")}
					</span>
				)
			}
			collapsible={analyticsUnlocked}
			defaultOpen={true}
		>
			{/* Produced vs Executed sparkline */}
			{graphsUnlocked && latest && (
				<div style={{ marginBottom: 8 }}>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							fontSize: 10,
							color: theme.textMuted,
							marginBottom: 4,
						}}
					>
						<span>{t("stats_panel.produced_vs_executed")}</span>
						<span>
							<span style={{ color: theme.locColor }}>
								{formatNumber(latest.locProducedPerSec)}
							</span>
							<span style={{ color: theme.textMuted }}> / </span>
							<span style={{ color: theme.flopsColor }}>
								{formatNumber(latest.locExecutedPerSec)}
							</span>
						</span>
					</div>
					<Sparkline
						data={locProdData}
						color={theme.locColor ?? "#61afef"}
						data2={locExecData}
						color2={theme.flopsColor ?? "#c678dd"}
						tierTransitions={tierTransitions}
						totalTime={elapsed}
					/>
				</div>
			)}
			{/* Source rows */}
			{humanSources.map((s) => (
				<div css={sourceRowCss} key={s.name}>
					<span css={sourceNameCss} style={{ color: theme.textMuted }}>
						{s.name}
						{s.count !== undefined && (
							<span style={{ color: theme.textMuted }}> x{s.count}</span>
						)}
					</span>
					<div css={barTrackCss} style={{ background: theme.border }}>
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
						{unit}
					</span>
				</div>
			))}
			{aiUnlocked && aiLocPerSec > 0 && (
				<div css={sourceRowCss}>
					<span css={sourceNameCss} style={{ color: "#c678dd" }}>
						{t("stats_panel.ai_output")}
					</span>
					<div css={barTrackCss} style={{ background: theme.border }}>
						<div
							css={barFillCss}
							style={{
								transform: "scaleX(1)",
								background: "#c678dd",
							}}
						/>
					</div>
					<span css={sourceValueCss} style={{ color: "#c678dd" }}>
						{formatNumber(aiLocPerSec)}
						{t("stats_panel.per_sec")}
					</span>
				</div>
			)}
			{managerBonus > 1 && (
				<div style={{ fontSize: 10, color: theme.textMuted, marginTop: 3 }}>
					{t("stats_panel.manager_bonus", {
						bonus: Math.round((managerBonus - 1) * 100),
					})}
				</div>
			)}
		</CollapsibleSection>
	);
}
