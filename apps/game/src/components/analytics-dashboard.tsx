import { css } from "@emotion/react";
import { type AiModelData, aiModels, useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useMemo } from "react";
import { useIdeTheme } from "../hooks/use-ide-theme";

const sectionCss = css({
	padding: "6px 10px",
	display: "flex",
	flexDirection: "column",
	gap: 4,
});

const sectionLabelCss = css({
	fontSize: 11,
	textTransform: "uppercase",
	letterSpacing: 0.5,
	marginBottom: 2,
});

const rowCss = css({
	display: "flex",
	alignItems: "center",
	gap: 6,
	height: 22,
});

const barFillCss = css({
	height: "100%",
	borderRadius: 3,
	transition: "width 0.3s ease",
});

const valueCss = css({
	fontSize: 12,
	minWidth: 55,
	textAlign: "right",
	fontVariantNumeric: "tabular-nums",
});

interface SourceRow {
	name: string;
	locPerSec: number;
	color: string;
	count?: number;
}

export function AnalyticsDashboard() {
	const theme = useIdeTheme();

	const freelancerLocPerSec = useGameStore((s) => s.freelancerLocPerSec);
	const internLocPerSec = useGameStore((s) => s.internLocPerSec);
	const devLocPerSec = useGameStore((s) => s.devLocPerSec);
	const teamLocPerSec = useGameStore((s) => s.teamLocPerSec);
	const managerBonus = useGameStore((s) => s.managerBonus);
	const locPerKey = useGameStore((s) => s.locPerKey);
	const flops = useGameStore((s) => s.flops);
	const autoLocPerSec = useGameStore((s) => s.autoLocPerSec);
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);
	const unlockedModels = useGameStore((s) => s.unlockedModels);
	const ownedUpgrades = useGameStore((s) => s.ownedUpgrades);

	const humanSources = useMemo((): SourceRow[] => {
		const rows: SourceRow[] = [];
		if ((ownedUpgrades.malt_freelancer ?? 0) > 0)
			rows.push({
				name: "Freelancers",
				locPerSec: freelancerLocPerSec,
				color: theme.locColor,
				count: ownedUpgrades.malt_freelancer,
			});
		if ((ownedUpgrades.intern ?? 0) > 0)
			rows.push({
				name: "Interns",
				locPerSec: internLocPerSec,
				color: theme.locColor,
				count: ownedUpgrades.intern,
			});
		if ((ownedUpgrades.dev_team ?? 0) > 0)
			rows.push({
				name: "Dev Teams",
				locPerSec: teamLocPerSec,
				color: theme.locColor,
				count: ownedUpgrades.dev_team,
			});
		if (devLocPerSec > 0 && (ownedUpgrades.dev_team ?? 0) === 0)
			rows.push({
				name: "Devs",
				locPerSec: devLocPerSec,
				color: theme.locColor,
			});
		rows.push({
			name: "You",
			locPerSec: locPerKey * 6,
			color: theme.locColor,
		});
		return rows;
	}, [
		ownedUpgrades,
		freelancerLocPerSec,
		internLocPerSec,
		devLocPerSec,
		teamLocPerSec,
		locPerKey,
		theme,
	]);

	const aiSources = useMemo((): SourceRow[] => {
		if (!aiUnlocked) return [];
		const rows: SourceRow[] = [];
		for (const model of aiModels) {
			if (unlockedModels[model.id]) {
				rows.push({
					name: `${model.name} ${model.version}`,
					locPerSec: model.locPerSec,
					color: modelColor(model, theme.textMuted),
				});
			}
		}
		return rows;
	}, [aiUnlocked, unlockedModels, theme]);

	const maxLoc = useMemo(() => {
		const all = [...humanSources, ...aiSources];
		return Math.max(1, ...all.map((s) => s.locPerSec));
	}, [humanSources, aiSources]);

	const totalLoc = autoLocPerSec + locPerKey * 6;
	const execRatio =
		flops > 0 && totalLoc > 0 ? Math.min(1, flops / totalLoc) : 1;

	return (
		<div
			css={css({
				display: "flex",
				flexDirection: "column",
				background: theme.background,
				overflow: "hidden",
			})}
		>
			<div
				css={css({
					padding: "4px 12px",
					background: theme.tabBarBg,
					borderBottom: `1px solid ${theme.border}`,
					fontSize: 12,
					color: theme.textMuted,
					display: "flex",
					justifyContent: "space-between",
				})}
			>
				<span>analytics.live</span>
				<span
					style={{
						color: execRatio < 0.5 ? "#e94560" : theme.lineNumbers,
					}}
				>
					exec {Math.round(execRatio * 100)}%
				</span>
			</div>

			<div css={sectionCss}>
				<div css={[sectionLabelCss, { color: theme.locColor }]}>Human</div>
				{humanSources.map((s) => (
					<div css={rowCss} key={s.name}>
						<span
							css={css({
								fontSize: 12,
								color: theme.textMuted,
								minWidth: 70,
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							})}
						>
							{s.name}
							{s.count !== undefined && (
								<span style={{ color: theme.lineNumbers }}> x{s.count}</span>
							)}
						</span>
						<div
							css={css({
								flex: 1,
								height: 5,
								background: theme.border,
								borderRadius: 3,
								overflow: "hidden",
								minWidth: 40,
							})}
						>
							<div
								css={barFillCss}
								style={{
									width: `${(s.locPerSec / maxLoc) * 100}%`,
									background: s.color,
								}}
							/>
						</div>
						<span css={valueCss} style={{ color: s.color }}>
							{formatNumber(s.locPerSec)}/s
						</span>
					</div>
				))}
				{managerBonus > 1 && (
					<div css={[rowCss, { fontSize: 9, color: theme.lineNumbers }]}>
						<span
							css={css({
								fontSize: 12,
								color: theme.textMuted,
								minWidth: 70,
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							})}
						>
							Managers
						</span>
						<span>+{Math.round((managerBonus - 1) * 100)}% team output</span>
					</div>
				)}
			</div>

			{aiSources.length > 0 && (
				<>
					<div
						css={css({
							height: 1,
							background: theme.border,
							margin: "0 10px",
						})}
					/>
					<div css={sectionCss}>
						<div css={[sectionLabelCss, { color: theme.number }]}>
							AI Models
						</div>
						{aiSources.map((s) => (
							<div css={rowCss} key={s.name}>
								<span
									css={css({
										fontSize: 12,
										color: theme.textMuted,
										minWidth: 70,
										whiteSpace: "nowrap",
										overflow: "hidden",
										textOverflow: "ellipsis",
									})}
								>
									{s.name}
								</span>
								<div
									css={css({
										flex: 1,
										height: 5,
										background: theme.border,
										borderRadius: 3,
										overflow: "hidden",
										minWidth: 40,
									})}
								>
									<div
										css={barFillCss}
										style={{
											width: `${(s.locPerSec / maxLoc) * 100}%`,
											background: s.color,
										}}
									/>
								</div>
								<span css={valueCss} style={{ color: s.color }}>
									{formatNumber(s.locPerSec)}/s
								</span>
							</div>
						))}
					</div>
				</>
			)}

			<div
				css={css({
					padding: "4px 10px",
					borderTop: `1px solid ${theme.border}`,
					display: "flex",
					justifyContent: "space-between",
					fontSize: 11,
					color: theme.lineNumbers,
				})}
			>
				<span>Total: {formatNumber(totalLoc)}/s</span>
				<span>FLOPS: {formatNumber(flops)}</span>
			</div>
		</div>
	);
}

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
