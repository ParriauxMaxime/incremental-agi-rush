import { css } from "@emotion/react";
import { aiModels, useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useCallback, useMemo, useState } from "react";
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
	agent: "#e17055",
} as const;

const MODEL_COLORS: Record<string, string> = {
	claude: "#d4a574",
	gpt: "#3fb950",
	gemini: "#58a6ff",
	llama: "#a29bfe",
	mistral: "#fd79a8",
	deepseek: "#00d4aa",
	copilot: "#6c5ce7",
	grok: "#e17055",
};

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

const aiSubHeaderCss = css({
	display: "flex",
	alignItems: "center",
	gap: 6,
	cursor: "pointer",
	userSelect: "none",
	marginTop: 6,
	marginBottom: 2,
	"&:hover": { opacity: 0.8 },
});

const aiChevronCss = css({
	fontSize: 10,
	transition: "transform 0.15s ease",
	display: "inline-block",
	width: 12,
	textAlign: "center",
});

const aiModelListCss = css({
	overflow: "hidden",
	transition: "max-height 0.2s ease, opacity 0.15s ease",
	overflowY: "auto",
	"&::-webkit-scrollbar": { width: 4 },
	"&::-webkit-scrollbar-thumb": { borderRadius: 2 },
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
	const agentLocPerSec = useGameStore((s) => s.agentLocPerSec);
	const tokenMultiplier = useGameStore((s) => s.tokenMultiplier);
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);
	const keysPerSec = useKeypressRate();

	// "You" = max(physical typing, auto-type) + auto-type base
	const youLocPerSec =
		Math.max(keysPerSec, autoTypeEnabled ? 5 : 0) * locPerKey;
	const locRate = autoLocPerSec + youLocPerSec + agentLocPerSec;
	const elapsed = (performance.now() - sessionStartTime) / 1000;

	const humanSources = useMemo((): SourceRow[] => {
		const rows: SourceRow[] = [];
		if ((ownedUpgrades.malt_freelancer ?? 0) > 0)
			rows.push({
				name: t("malt_freelancer.name", { ns: "upgrades" }),
				locPerSec: freelancerLocPerSec,
				color: SOURCE_COLORS.malt_freelancer,
				count: ownedUpgrades.malt_freelancer,
			});
		if ((ownedUpgrades.intern ?? 0) > 0)
			rows.push({
				name: t("intern.name", { ns: "upgrades" }),
				locPerSec: internLocPerSec,
				color: SOURCE_COLORS.intern,
				count: ownedUpgrades.intern,
			});
		if ((ownedUpgrades.dev_team ?? 0) > 0)
			rows.push({
				name: t("dev_team.name", { ns: "upgrades" }),
				locPerSec: teamLocPerSec,
				color: SOURCE_COLORS.dev_team,
				count: ownedUpgrades.dev_team,
			});
		if (devLocPerSec > 0 && (ownedUpgrades.dev_team ?? 0) === 0)
			rows.push({
				name: t("dev_team.name", { ns: "upgrades" }),
				locPerSec: devLocPerSec,
				color: SOURCE_COLORS.dev_team,
			});
		if ((ownedUpgrades.ai_agent ?? 0) > 0)
			rows.push({
				name: t("ai_agent.name", { ns: "upgrades" }),
				locPerSec: agentLocPerSec,
				color: SOURCE_COLORS.agent,
				count: ownedUpgrades.ai_agent,
			});
		rows.push({
			name: t("stats_panel.you"),
			locPerSec: youLocPerSec,
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
		agentLocPerSec,
		youLocPerSec,
		t,
	]);

	const aiModelAllocations = useGameStore((s) => s.aiModelAllocations);

	const aiSources = useMemo((): SourceRow[] => {
		if (!aiUnlocked) return [];
		return aiModelAllocations
			.map((alloc) => {
				const model = aiModels.find((m) => m.id === alloc.modelId);
				if (!model) return null;
				const flopRatio =
					alloc.flopsCap > 0 ? alloc.allocatedFlops / alloc.flopsCap : 0;
				const locOutput = model.locPerSec * flopRatio;
				return {
					name: `${model.name} ${model.version}`,
					locPerSec: locOutput,
					color: MODEL_COLORS[model.family] ?? "#8b949e",
				};
			})
			.filter((r): r is SourceRow => r !== null);
	}, [aiUnlocked, aiModelAllocations]);

	const totalAiLoc = aiSources.reduce((sum, s) => sum + s.locPerSec, 0);

	// Fraction of each producer's output diverted as tokens to feed AI models
	const tokenFraction = useMemo(() => {
		if (!aiUnlocked || aiModelAllocations.length === 0) return 0;
		// Total token demand from active models (proportional to their FLOPS allocation)
		let totalTokenDemand = 0;
		for (const alloc of aiModelAllocations) {
			const model = aiModels.find((m) => m.id === alloc.modelId);
			if (!model) continue;
			const flopRatio =
				alloc.flopsCap > 0 ? alloc.allocatedFlops / alloc.flopsCap : 0;
			totalTokenDemand += model.tokenCost * flopRatio;
		}
		const humanTokenOutput = locRate * tokenMultiplier;
		if (humanTokenOutput <= 0) return 0;
		return Math.min(1, totalTokenDemand / humanTokenOutput);
	}, [aiUnlocked, aiModelAllocations, locRate, tokenMultiplier]);

	const TOKEN_COLOR = "#6a9955";

	const allSources = useMemo(
		() => [...humanSources, ...aiSources],
		[humanSources, aiSources],
	);
	const maxLoc = Math.max(1, ...allSources.map((s) => s.locPerSec));

	const [aiExpanded, setAiExpanded] = useState(false);
	const toggleAi = useCallback(() => setAiExpanded((v) => !v), []);

	const { locProdData, locExecData, tokenConsumedData } = useMemo(
		() => ({
			locProdData: rateSnapshots.map((s) => s.locProducedPerSec),
			locExecData: rateSnapshots.map((s) => s.locExecutedPerSec),
			tokenConsumedData: rateSnapshots.map(
				(s) => s.tokensConsumedPerSec ?? 0,
			),
		}),
		[rateSnapshots],
	);
	const latest = rateSnapshots[rateSnapshots.length - 1];

	const unit = t("stats_panel.per_sec");

	return (
		<CollapsibleSection
			icon={<span style={{ color: theme.locColor }}>◇</span>}
			label={t("stats_panel.loc")}
			value={
				<RollingNumber
					value={formatNumber(loc)}
					color={theme.locColor}
				/>
			}
			rate={
				<span style={{ color: theme.locColor }}>
					{formatNumber(locRate + totalAiLoc)}
					{t("stats_panel.per_sec")}
				</span>
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
						data3={aiUnlocked ? tokenConsumedData : undefined}
						color3={TOKEN_COLOR}
						tierTransitions={tierTransitions}
						totalTime={elapsed}
					/>
					{aiUnlocked && (latest.tokensConsumedPerSec ?? 0) > 0 && (
						<div
							style={{
								display: "flex",
								gap: 8,
								fontSize: 9,
								color: theme.textMuted,
								marginTop: 2,
							}}
						>
							<span>
								<span
									style={{
										display: "inline-block",
										width: 8,
										height: 2,
										background: TOKEN_COLOR,
										marginRight: 3,
										verticalAlign: "middle",
									}}
								/>
								tokens → AI:{" "}
								{formatNumber(latest.tokensConsumedPerSec ?? 0)}/s
							</span>
						</div>
					)}
				</div>
			)}
			{/* Human source rows — bar split into LoC (source color) + token (token color) */}
			{humanSources.map((s) => {
				const scale = s.locPerSec / maxLoc;
				const locPct = aiUnlocked ? (1 - tokenFraction) * 100 : 100;
				const netLoc = s.locPerSec * (1 - tokenFraction);
				const tokenPart = s.locPerSec * tokenFraction;
				return (
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
									transform: `scaleX(${scale})`,
									background:
										aiUnlocked && tokenFraction > 0
											? `linear-gradient(90deg, ${s.color} ${locPct}%, ${TOKEN_COLOR} ${locPct}%)`
											: s.color,
								}}
							/>
						</div>
						{aiUnlocked && tokenFraction > 0.01 ? (
							<span css={sourceValueCss} style={{ fontSize: 10 }}>
								<span style={{ color: s.color }}>
									{formatNumber(netLoc)}
								</span>
								<span style={{ color: TOKEN_COLOR }}>
									+{formatNumber(tokenPart)}
								</span>
								{unit}
							</span>
						) : (
							<span css={sourceValueCss} style={{ color: s.color }}>
								{formatNumber(s.locPerSec)}
								{unit}
							</span>
						)}
					</div>
				);
			})}
			{/* Collapsible AI sub-section */}
			{aiUnlocked && aiSources.length > 0 && (
				<>
					<div css={aiSubHeaderCss} onClick={toggleAi}>
						<span
							css={aiChevronCss}
							style={{
								color: theme.textMuted,
								transform: aiExpanded ? "rotate(90deg)" : "none",
							}}
						>
							&#9654;
						</span>
						<span style={{ fontSize: 11, color: theme.flopsColor, flex: 1 }}>
							{t("stats_panel.ai_output")}
						</span>
						<span css={sourceValueCss} style={{ color: theme.flopsColor }}>
							{formatNumber(totalAiLoc)}
							{unit}
						</span>
					</div>
					<div
						css={aiModelListCss}
						style={{
							maxHeight: aiExpanded ? 200 : 0,
							opacity: aiExpanded ? 1 : 0,
						}}
					>
						{aiSources.map((s) => (
							<div css={sourceRowCss} key={s.name} style={{ paddingLeft: 18 }}>
								<span css={sourceNameCss} style={{ color: theme.textMuted }}>
									{s.name}
								</span>
								<div css={barTrackCss} style={{ background: theme.border }}>
									<div
										css={barFillCss}
										style={{
											transform: `scaleX(${s.locPerSec / maxLoc})`,
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
					</div>
				</>
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
