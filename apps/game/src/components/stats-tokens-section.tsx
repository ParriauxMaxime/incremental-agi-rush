import { css } from "@emotion/react";
import { aiModels, useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { CollapsibleSection } from "./collapsible-section";
import { RollingNumber } from "./rolling-number";

// ── AI model family colors ──
const MODEL_COLORS: Record<string, string> = {
	claude: "#d4a574",
	gpt: "#3fb950",
	gemini: "#58a6ff",
	llama: "#a29bfe",
	mistral: "#fd79a8",
	deepseek: "#00d4aa",
	copilot: "#6c5ce7",
};

const TOKEN_COLOR = "#6a9955";

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

interface AiSourceRow {
	name: string;
	tokenPerSec: number;
	locPerSec: number;
	flopsCost: number;
	color: string;
}

export function StatsTokensSection() {
	const { t } = useTranslation();
	const theme = useIdeTheme();
	const tokens = useGameStore((s) => s.tokens);
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);
	const unlockedModels = useGameStore((s) => s.unlockedModels);
	const llmHostSlots = useGameStore((s) => s.llmHostSlots);
	const flops = useGameStore((s) => s.flops);
	const flopSlider = useGameStore((s) => s.flopSlider);

	const autoLocPerSec = useGameStore((s) => s.autoLocPerSec);
	const tokenMultiplier = useGameStore((s) => s.tokenMultiplier);

	const {
		aiSources,
		totalTokenPerSec,
		totalAiLocPerSec,
		saturation,
		tokenEfficiency,
		tokenProduction,
		tokenDemand,
		tokensConsumed,
		surplusAsLoc,
	} = useMemo(() => {
		if (!aiUnlocked)
			return {
				aiSources: [],
				totalTokenPerSec: 0,
				totalAiLocPerSec: 0,
				saturation: 0,
				tokenEfficiency: 0,
				tokenProduction: 0,
				tokenDemand: 0,
				tokensConsumed: 0,
				surplusAsLoc: 0,
			};
		const activeModels = aiModels
			.filter((m) => unlockedModels[m.id])
			.sort((a, b) => a.flopsCost - b.flopsCost)
			.slice(0, llmHostSlots);
		const af = flops * (1 - flopSlider);
		let td = 0;
		for (const m of activeModels) td += m.flopsCost;
		const sat = td > 0 ? Math.min(1, af / td) : 0;

		// Token economy: human output → split between tokens (for AI) and direct LoC
		let totalTokenDemand = 0;
		for (const m of activeModels) totalTokenDemand += m.tokenCost;
		const humanTokenOutput = autoLocPerSec * tokenMultiplier;
		const tokensConsumed = Math.min(humanTokenOutput, totalTokenDemand);
		const surplusAsLoc = humanTokenOutput - tokensConsumed;
		const tokEff =
			totalTokenDemand > 0
				? Math.min(1, humanTokenOutput / totalTokenDemand)
				: 0;

		const rows: AiSourceRow[] = activeModels.map((model) => ({
			name: `${model.name} ${model.version}`,
			tokenPerSec: model.tokenCost * tokEff,
			locPerSec: model.locPerSec * tokEff * sat,
			flopsCost: model.flopsCost,
			color: MODEL_COLORS[model.family] ?? theme.textMuted,
		}));
		rows.sort((a, b) => b.locPerSec - a.locPerSec);
		const totalTok = rows.reduce((sum, r) => sum + r.tokenPerSec, 0);
		const totalLoc = rows.reduce((sum, r) => sum + r.locPerSec, 0);
		return {
			aiSources: rows,
			totalTokenPerSec: totalTok,
			totalAiLocPerSec: totalLoc,
			saturation: sat,
			tokenEfficiency: tokEff,
			tokenProduction: humanTokenOutput,
			tokenDemand: totalTokenDemand,
			tokensConsumed,
			surplusAsLoc,
		};
	}, [
		aiUnlocked,
		unlockedModels,
		llmHostSlots,
		flops,
		flopSlider,
		autoLocPerSec,
		tokenMultiplier,
		theme.textMuted,
	]);

	if (!aiUnlocked) return null;

	return (
		<CollapsibleSection
			icon={<span style={{ color: TOKEN_COLOR }}>🪙</span>}
			label={t("stats_panel.tokens")}
			value={<RollingNumber value={formatNumber(tokens)} color={TOKEN_COLOR} />}
			rate={
				<span style={{ color: TOKEN_COLOR }}>
					{formatNumber(totalTokenPerSec)}
					{t("stats_panel.tokens_per_sec")}
				</span>
			}
			collapsible={true}
			defaultOpen={true}
		>
			{/* Token pipeline */}
			<div
				style={{
					fontSize: 10,
					marginBottom: 8,
					display: "flex",
					flexDirection: "column",
					gap: 4,
				}}
			>
				{/* Production → Demand bar */}
				<div style={{ display: "flex", alignItems: "center", gap: 4 }}>
					<span style={{ color: theme.textMuted }}>Produced</span>
					<span style={{ color: TOKEN_COLOR, fontWeight: 600 }}>
						{formatNumber(tokenProduction)}/s
					</span>
				</div>
				<div
					style={{
						height: 6,
						borderRadius: 3,
						background: theme.border,
						overflow: "hidden",
						display: "flex",
					}}
				>
					{/* Consumed portion */}
					<div
						style={{
							width: `${tokenProduction > 0 ? (tokensConsumed / tokenProduction) * 100 : 0}%`,
							background: TOKEN_COLOR,
							borderRadius: "3px 0 0 3px",
							transition: "width 0.3s ease",
						}}
					/>
					{/* Surplus portion */}
					<div
						style={{
							flex: 1,
							background: `${theme.locColor}40`,
							borderRadius: "0 3px 3px 0",
						}}
					/>
				</div>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						gap: 4,
					}}
				>
					<span style={{ color: TOKEN_COLOR }}>
						🪙 {formatNumber(tokensConsumed)}/s →{" "}
						{formatNumber(totalAiLocPerSec)} LoC/s
					</span>
					{surplusAsLoc > 0 && (
						<span style={{ color: theme.locColor }}>
							+{formatNumber(surplusAsLoc)} direct
						</span>
					)}
				</div>
				{/* Demand vs supply */}
				{tokenDemand > 0 && (
					<div
						style={{
							display: "flex",
							gap: 8,
							color: theme.textMuted,
						}}
					>
						<span>
							Demand:{" "}
							<span
								style={{
									color:
										tokenEfficiency < 0.5
											? "#f44336"
											: tokenEfficiency < 0.9
												? "#fbbf24"
												: theme.success,
								}}
							>
								{formatNumber(tokenDemand)}/s (
								{Math.round(tokenEfficiency * 100)}%)
							</span>
						</span>
						<span>
							FLOPS:{" "}
							<span
								style={{
									color:
										saturation < 0.5
											? "#f44336"
											: saturation < 0.9
												? "#fbbf24"
												: theme.success,
								}}
							>
								{Math.round(saturation * 100)}%
							</span>
						</span>
					</div>
				)}
			</div>
			{/* AI model rows */}
			{aiSources.map((s) => (
				<div css={sourceRowCss} key={s.name}>
					<span css={sourceNameCss} style={{ color: theme.textMuted }}>
						{s.name}
					</span>
					<div css={barTrackCss} style={{ background: theme.border }}>
						<div
							css={barFillCss}
							style={{
								transform: `scaleX(${s.locPerSec / Math.max(1, ...aiSources.map((x) => x.locPerSec))})`,
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
		</CollapsibleSection>
	);
}
