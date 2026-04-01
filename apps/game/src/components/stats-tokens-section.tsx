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

	const { aiSources, totalTokenPerSec, aiFlops, totalDemand, saturation } =
		useMemo(() => {
			if (!aiUnlocked)
				return {
					aiSources: [],
					totalTokenPerSec: 0,
					aiFlops: 0,
					totalDemand: 0,
					saturation: 0,
				};
			const activeModels = aiModels
				.filter((m) => unlockedModels[m.id])
				.slice(0, llmHostSlots);
			const af = flops * (1 - flopSlider);
			let td = 0;
			for (const m of activeModels) td += m.flopsCost;
			const sat = td > 0 ? Math.min(1, af / td) : 0;
			const rows: AiSourceRow[] = activeModels.map((model) => ({
				name: `${model.name} ${model.version}`,
				tokenPerSec: model.tokenCost * sat,
				flopsCost: model.flopsCost,
				color: MODEL_COLORS[model.family] ?? theme.textMuted,
			}));
			rows.sort((a, b) => b.tokenPerSec - a.tokenPerSec);
			const total = rows.reduce((sum, r) => sum + r.tokenPerSec, 0);
			return {
				aiSources: rows,
				totalTokenPerSec: total,
				aiFlops: af,
				totalDemand: td,
				saturation: sat,
			};
		}, [
			aiUnlocked,
			unlockedModels,
			llmHostSlots,
			flops,
			flopSlider,
			theme.textMuted,
		]);

	const aiMaxToken = Math.max(1, ...aiSources.map((s) => s.tokenPerSec));

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
			{/* FLOPS saturation gauge */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					fontSize: 10,
					marginBottom: 6,
					gap: 4,
				}}
			>
				<span style={{ color: theme.flopsColor }}>
					⚡ {formatNumber(aiFlops)}
				</span>
				<span style={{ color: theme.lineNumbers }}>/</span>
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
					{formatNumber(totalDemand)} FLOPS ({Math.round(saturation * 100)}%)
				</span>
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
								transform: `scaleX(${s.tokenPerSec / aiMaxToken})`,
								background: s.color,
							}}
						/>
					</div>
					<span css={sourceValueCss} style={{ color: s.color }}>
						{formatNumber(s.tokenPerSec)}/s
					</span>
				</div>
			))}
		</CollapsibleSection>
	);
}
