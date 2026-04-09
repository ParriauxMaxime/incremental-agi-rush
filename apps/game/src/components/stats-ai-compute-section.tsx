import { css } from "@emotion/react";
import { aiModels, useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { CollapsibleSection } from "./collapsible-section";
import { RollingNumber } from "./rolling-number";

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

const modelRowCss = css({
	marginBottom: 6,
});

const modelHeaderCss = css({
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
});

const modelNameCss = css({
	fontSize: 11,
	fontWeight: 500,
});

const modelStatsCss = css({
	fontSize: 10,
	fontVariantNumeric: "tabular-nums",
});

const capBarTrackCss = css({
	height: 3,
	borderRadius: 2,
	overflow: "hidden",
	marginTop: 3,
});

const capBarFillCss = css({
	height: "100%",
	borderRadius: 2,
	transition: "width 0.3s ease",
});

export function StatsAiComputeSection() {
	const { t } = useTranslation();
	const theme = useIdeTheme();
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);
	const allocations = useGameStore((s) => s.aiModelAllocations);
	const totalCap = useGameStore((s) => s.totalAiFlopsCap);
	const totalConsumed = useGameStore((s) => s.totalAiFlopsConsumed);

	const modelRows = useMemo(() => {
		return allocations
			.map((alloc) => {
				const model = aiModels.find((m) => m.id === alloc.modelId);
				if (!model) return null;
				const color = MODEL_COLORS[model.family] ?? theme.textMuted;
				const pct =
					alloc.flopsCap > 0 ? alloc.allocatedFlops / alloc.flopsCap : 0;
				return {
					id: model.id,
					name: `${model.name} ${model.version}`,
					color,
					ratio: model.locPerToken,
					allocated: alloc.allocatedFlops,
					cap: alloc.flopsCap,
					pct,
				};
			})
			.filter((r) => r !== null);
	}, [allocations, theme.textMuted]);

	if (!aiUnlocked) return null;

	const usagePct =
		totalCap > 0 ? Math.round((totalConsumed / totalCap) * 100) : 0;

	return (
		<CollapsibleSection
			icon={<span style={{ color: theme.flopsColor }}>&#x1F916;</span>}
			label={t("stats_panel.ai_compute")}
			value={
				<RollingNumber
					value={formatNumber(totalConsumed)}
					color={theme.flopsColor}
				/>
			}
			rate={
				<span style={{ color: theme.textMuted }}>
					/ {formatNumber(totalCap)} cap
				</span>
			}
			collapsible={true}
			defaultOpen={true}
		>
			{/* Total FLOPS budget bar */}
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					fontSize: 10,
					color: theme.textMuted,
					marginBottom: 3,
				}}
			>
				<span>{t("stats_panel.flops_usage")}</span>
				<span style={{ color: theme.flopsColor }}>{usagePct}%</span>
			</div>
			<div
				style={{
					height: 6,
					borderRadius: 3,
					background: theme.border,
					overflow: "hidden",
					marginBottom: 10,
				}}
			>
				<div
					style={{
						width: `${usagePct}%`,
						height: "100%",
						background: theme.flopsColor,
						borderRadius: 3,
						transition: "width 0.3s ease",
					}}
				/>
			</div>

			{/* Model rows — two-line compact */}
			{modelRows.map((m) => (
				<div key={m.id} css={modelRowCss}>
					<div css={modelHeaderCss}>
						<span css={modelNameCss} style={{ color: m.color }}>
							{m.name}
						</span>
						<span css={modelStatsCss} style={{ color: theme.textMuted }}>
							{m.ratio}x &middot;{" "}
							<span style={{ color: m.color }}>
								{formatNumber(m.allocated)}
							</span>
							/{formatNumber(m.cap)}
						</span>
					</div>
					<div css={capBarTrackCss} style={{ background: theme.border }}>
						<div
							css={capBarFillCss}
							style={{
								width: `${Math.round(m.pct * 100)}%`,
								background: m.color,
							}}
						/>
					</div>
				</div>
			))}

		</CollapsibleSection>
	);
}
