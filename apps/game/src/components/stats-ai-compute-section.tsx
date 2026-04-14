import { css } from "@emotion/react";
import { aiModels, useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { CollapsibleSection } from "./collapsible-section";
import { FlopsSlider } from "./flops-slider";
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

const FAMILY_LABELS: Record<string, string> = {
	claude: "Anthropic",
	gpt: "OpenAI",
	gemini: "Google",
	llama: "Meta",
	mistral: "Mistral",
	deepseek: "DeepSeek",
	copilot: "GitHub",
	grok: "xAI",
};

const modelRowCss = css({
	marginBottom: 4,
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
	marginTop: 2,
});

const capBarFillCss = css({
	height: "100%",
	borderRadius: 2,
	transition: "width 0.3s ease",
});

const familyHeaderCss = css({
	display: "flex",
	alignItems: "center",
	gap: 5,
	cursor: "pointer",
	userSelect: "none",
	padding: "3px 0",
	"&:hover": { opacity: 0.8 },
});

const familyChevronCss = css({
	fontSize: 9,
	transition: "transform 0.15s ease",
	display: "inline-block",
	width: 10,
	textAlign: "center",
});

const familyModelsCss = css({
	overflow: "hidden",
	transition: "max-height 0.2s ease, opacity 0.15s ease",
	paddingLeft: 15,
});

interface ModelRow {
	id: string;
	family: string;
	name: string;
	color: string;
	ratio: number;
	allocated: number;
	cap: number;
	pct: number;
}

interface FamilyGroup {
	family: string;
	label: string;
	color: string;
	models: ModelRow[];
	totalAllocated: number;
	totalCap: number;
}

export function StatsAiComputeSection() {
	const { t } = useTranslation();
	const theme = useIdeTheme();
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);
	const allocations = useGameStore((s) => s.aiModelAllocations);
	const totalCap = useGameStore((s) => s.totalAiFlopsCap);
	const totalConsumed = useGameStore((s) => s.totalAiFlopsConsumed);

	const [expandedFamilies, setExpandedFamilies] = useState<
		Record<string, boolean>
	>({});
	const toggleFamily = useCallback(
		(family: string) =>
			setExpandedFamilies((prev) => ({
				...prev,
				[family]: !prev[family],
			})),
		[],
	);

	const familyGroups = useMemo((): FamilyGroup[] => {
		const groups: Record<string, FamilyGroup> = {};

		for (const alloc of allocations) {
			const model = aiModels.find((m) => m.id === alloc.modelId);
			if (!model) continue;
			const color = MODEL_COLORS[model.family] ?? theme.textMuted;
			const pct =
				alloc.flopsCap > 0 ? alloc.allocatedFlops / alloc.flopsCap : 0;

			if (!groups[model.family]) {
				groups[model.family] = {
					family: model.family,
					label: FAMILY_LABELS[model.family] ?? model.family,
					color,
					models: [],
					totalAllocated: 0,
					totalCap: 0,
				};
			}

			groups[model.family].models.push({
				id: model.id,
				family: model.family,
				name: `${model.name} ${model.version}`,
				color,
				ratio: model.locPerToken,
				allocated: alloc.allocatedFlops,
				cap: alloc.flopsCap,
				pct,
			});
			groups[model.family].totalAllocated += alloc.allocatedFlops;
			groups[model.family].totalCap += alloc.flopsCap;
		}

		return Object.values(groups).sort(
			(a, b) => b.totalAllocated - a.totalAllocated,
		);
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
			{/* FLOPS allocation slider */}
			<FlopsSlider embedded />

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

			{/* Grouped model rows by family */}
			{familyGroups.map((group) => {
				const isExpanded = expandedFamilies[group.family] ?? false;
				const groupPct =
					group.totalCap > 0
						? Math.round((group.totalAllocated / group.totalCap) * 100)
						: 0;

				// Family group — collapsible
				return (
					<div key={group.family} style={{ marginBottom: 4 }}>
						<div
							css={familyHeaderCss}
							onClick={() => toggleFamily(group.family)}
						>
							<span
								css={familyChevronCss}
								style={{
									color: theme.textMuted,
									transform: isExpanded ? "rotate(90deg)" : "none",
								}}
							>
								&#9654;
							</span>
							<span css={modelNameCss} style={{ color: group.color, flex: 1 }}>
								{group.label}{" "}
								<span
									style={{
										color: theme.textMuted,
										fontWeight: 400,
									}}
								>
									({group.models.length})
								</span>
							</span>
							<span css={modelStatsCss} style={{ color: theme.textMuted }}>
								<span style={{ color: group.color }}>
									{formatNumber(group.totalAllocated)}
								</span>
								/{formatNumber(group.totalCap)}
							</span>
						</div>
						{/* Group summary bar */}
						<div css={capBarTrackCss} style={{ background: theme.border }}>
							<div
								css={capBarFillCss}
								style={{
									width: `${groupPct}%`,
									background: group.color,
								}}
							/>
						</div>
						{/* Expanded individual models */}
						<div
							css={familyModelsCss}
							style={{
								maxHeight: isExpanded ? group.models.length * 30 : 0,
								opacity: isExpanded ? 1 : 0,
							}}
						>
							{group.models.map((m) => (
								<div key={m.id} css={modelRowCss}>
									<div css={modelHeaderCss}>
										<span
											css={modelNameCss}
											style={{
												color: theme.textMuted,
												fontSize: 10,
											}}
										>
											{m.name}
										</span>
										<span
											css={modelStatsCss}
											style={{ color: theme.textMuted }}
										>
											{m.ratio}x &middot;{" "}
											<span style={{ color: m.color }}>
												{formatNumber(m.allocated)}
											</span>
											/{formatNumber(m.cap)}
										</span>
									</div>
									<div
										css={capBarTrackCss}
										style={{ background: theme.border }}
									>
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
						</div>
					</div>
				);
			})}
		</CollapsibleSection>
	);
}
