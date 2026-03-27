import { css } from "@emotion/react";
import { type AiModelData, aiModels, useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useMemo } from "react";

const wrapperCss = css({
	display: "flex",
	flexDirection: "column",
	background: "#0a0e14",
	overflow: "hidden",
});

const headerCss = css({
	padding: "4px 12px",
	background: "#161b22",
	borderBottom: "1px solid #1e2630",
	fontSize: 12,
	color: "#8b949e",
	display: "flex",
	justifyContent: "space-between",
});

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

const nameCss = css({
	fontSize: 12,
	color: "#8b949e",
	minWidth: 70,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
});

const barTrackCss = css({
	flex: 1,
	height: 5,
	background: "#1e2630",
	borderRadius: 3,
	overflow: "hidden",
	minWidth: 40,
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

const footerCss = css({
	padding: "4px 10px",
	borderTop: "1px solid #1e2630",
	display: "flex",
	justifyContent: "space-between",
	fontSize: 11,
	color: "#484f58",
});

const dividerCss = css({
	height: 1,
	background: "#1e2630",
	margin: "0 10px",
});

interface SourceRow {
	name: string;
	locPerSec: number;
	color: string;
	count?: number;
}

export function AnalyticsDashboard() {
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
				color: "#3fb950",
				count: ownedUpgrades.malt_freelancer,
			});
		if ((ownedUpgrades.intern ?? 0) > 0)
			rows.push({
				name: "Interns",
				locPerSec: internLocPerSec,
				color: "#58a6ff",
				count: ownedUpgrades.intern,
			});
		if ((ownedUpgrades.dev_team ?? 0) > 0)
			rows.push({
				name: "Dev Teams",
				locPerSec: teamLocPerSec,
				color: "#d2a8ff",
				count: ownedUpgrades.dev_team,
			});
		if (devLocPerSec > 0 && (ownedUpgrades.dev_team ?? 0) === 0)
			rows.push({
				name: "Devs",
				locPerSec: devLocPerSec,
				color: "#79c0ff",
			});
		rows.push({
			name: "You",
			locPerSec: locPerKey * 6,
			color: "#c084fc",
		});
		return rows;
	}, [
		ownedUpgrades,
		freelancerLocPerSec,
		internLocPerSec,
		devLocPerSec,
		teamLocPerSec,
		locPerKey,
	]);

	const aiSources = useMemo((): SourceRow[] => {
		if (!aiUnlocked) return [];
		const rows: SourceRow[] = [];
		for (const model of aiModels) {
			if (unlockedModels[model.id]) {
				rows.push({
					name: `${model.name} ${model.version}`,
					locPerSec: model.locPerSec,
					color: modelColor(model),
				});
			}
		}
		return rows;
	}, [aiUnlocked, unlockedModels]);

	const maxLoc = useMemo(() => {
		const all = [...humanSources, ...aiSources];
		return Math.max(1, ...all.map((s) => s.locPerSec));
	}, [humanSources, aiSources]);

	const totalLoc = autoLocPerSec + locPerKey * 6;
	const execRatio =
		flops > 0 && totalLoc > 0 ? Math.min(1, flops / totalLoc) : 1;

	return (
		<div css={wrapperCss}>
			<div css={headerCss}>
				<span>analytics.live</span>
				<span style={{ color: execRatio < 0.5 ? "#e94560" : "#484f58" }}>
					exec {Math.round(execRatio * 100)}%
				</span>
			</div>

			<div css={sectionCss}>
				<div css={[sectionLabelCss, { color: "#3fb950" }]}>Human</div>
				{humanSources.map((s) => (
					<div css={rowCss} key={s.name}>
						<span css={nameCss}>
							{s.name}
							{s.count !== undefined && (
								<span style={{ color: "#484f58" }}> x{s.count}</span>
							)}
						</span>
						<div css={barTrackCss}>
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
					<div css={[rowCss, { fontSize: 9, color: "#484f58" }]}>
						<span css={nameCss}>Managers</span>
						<span>+{Math.round((managerBonus - 1) * 100)}% team output</span>
					</div>
				)}
			</div>

			{aiSources.length > 0 && (
				<>
					<div css={dividerCss} />
					<div css={sectionCss}>
						<div css={[sectionLabelCss, { color: "#d4a574" }]}>AI Models</div>
						{aiSources.map((s) => (
							<div css={rowCss} key={s.name}>
								<span css={nameCss}>{s.name}</span>
								<div css={barTrackCss}>
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

			<div css={footerCss}>
				<span>Total: {formatNumber(totalLoc)}/s</span>
				<span>FLOPS: {formatNumber(flops)}</span>
			</div>
		</div>
	);
}

function modelColor(model: AiModelData): string {
	const colors: Record<string, string> = {
		claude: "#d4a574",
		gpt: "#74b9ff",
		gemini: "#fbbf24",
		llama: "#a29bfe",
		mistral: "#fd79a8",
		grok: "#e17055",
		copilot: "#6c5ce7",
	};
	return colors[model.family] ?? "#8b949e";
}
