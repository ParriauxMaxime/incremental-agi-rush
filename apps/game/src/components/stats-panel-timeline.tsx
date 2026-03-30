import { css } from "@emotion/react";
import { useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";

const TIER_COLORS = [
	"#484f58",
	"#3fb950",
	"#58a6ff",
	"#d2a8ff",
	"#f0883e",
	"#f85149",
];

const sectionCss = css({ padding: "8px 12px" });
const labelCss = css({
	fontSize: 11,
	textTransform: "uppercase",
	letterSpacing: 0.5,
	marginBottom: 6,
});
const rowCss = css({
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	padding: "4px 0",
	fontSize: 12,
});
const trendCss = css({
	display: "inline-flex",
	alignItems: "center",
	gap: 2,
	fontSize: 10,
	padding: "1px 4px",
	borderRadius: 3,
});
const feedItemCss = css({
	display: "flex",
	justifyContent: "space-between",
	padding: "3px 0",
	fontSize: 11,
});

function formatElapsed(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

function formatAgo(secondsAgo: number): string {
	if (secondsAgo < 60) return `${Math.floor(secondsAgo)}s ago`;
	const m = Math.floor(secondsAgo / 60);
	const s = Math.floor(secondsAgo % 60);
	return `${m}:${String(s).padStart(2, "0")} ago`;
}

export function StatsPanelTimeline() {
	const { t } = useTranslation();
	const { t: tUpgrades } = useTranslation("upgrades");
	const { t: tTech } = useTranslation("tech-tree");
	const theme = useIdeTheme();
	const tierTransitions = useGameStore((s) => s.tierTransitions);
	const sessionStartTime = useGameStore((s) => s.sessionStartTime);
	const purchaseLog = useGameStore((s) => s.purchaseLog);
	const rateSnapshots = useGameStore((s) => s.rateSnapshots);

	const elapsed = (performance.now() - sessionStartTime) / 1000;

	const tierDurations = useMemo(() => {
		const durations: Array<{ tierIndex: number; duration: number }> = [];
		for (let i = 0; i < tierTransitions.length; i++) {
			const start = tierTransitions[i].enteredAt;
			const end = tierTransitions[i + 1]?.enteredAt ?? elapsed;
			durations.push({
				tierIndex: tierTransitions[i].tierIndex,
				duration: end - start,
			});
		}
		return durations;
	}, [tierTransitions, elapsed]);

	const trend = useMemo(() => {
		const snaps = rateSnapshots;
		if (snaps.length < 2) return null;
		const latest = snaps[snaps.length - 1];
		const idx = Math.max(0, snaps.length - 7);
		const prev = snaps[idx];
		if (!prev || !latest) return null;

		const cashPct =
			prev.cashPerSec > 0
				? ((latest.cashPerSec - prev.cashPerSec) / prev.cashPerSec) * 100
				: 0;
		const locPct =
			prev.locProducedPerSec > 0
				? ((latest.locProducedPerSec - prev.locProducedPerSec) /
						prev.locProducedPerSec) *
					100
				: 0;
		const flopDelta = (latest.flopUtilization - prev.flopUtilization) * 100;

		return {
			cashPerSec: latest.cashPerSec,
			cashPct,
			locPerSec: latest.locProducedPerSec,
			locPct,
			flopUtil: latest.flopUtilization * 100,
			flopDelta,
		};
	}, [rateSnapshots]);

	const recentPurchases = useMemo(
		() => [...purchaseLog].reverse().slice(0, 10),
		[purchaseLog],
	);

	return (
		<div>
			{/* Tier Timeline Bar */}
			<div css={sectionCss}>
				<div css={labelCss} style={{ color: theme.textMuted }}>
					{t("stats_panel.tier_progression")}
				</div>
				<div
					css={{
						display: "flex",
						height: 24,
						borderRadius: 4,
						overflow: "hidden",
						border: `1px solid ${theme.border}`,
					}}
				>
					{tierDurations.map((td, i) => {
						const pct = elapsed > 0 ? (td.duration / elapsed) * 100 : 0;
						const isLast = i === tierDurations.length - 1;
						return (
							<div
								key={td.tierIndex}
								css={{
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									fontSize: 9,
									fontWeight: 600,
									position: "relative",
									transition: "width 0.3s",
									...(isLast && {
										"@keyframes pulse": {
											"0%, 100%": { opacity: 1 },
											"50%": { opacity: 0.5 },
										},
										animation: "pulse 2s ease-in-out infinite",
									}),
								}}
								style={{
									width: `${Math.max(pct, 2)}%`,
									background: TIER_COLORS[td.tierIndex],
									color: td.tierIndex <= 1 ? "#c9d1d9" : "rgba(0,0,0,0.7)",
								}}
							>
								{pct > 8 && <span>T{td.tierIndex}</span>}
								{pct > 15 && (
									<span
										style={{
											position: "absolute",
											bottom: 1,
											right: 3,
											fontSize: 8,
											opacity: 0.8,
										}}
									>
										{formatElapsed(td.duration)}
									</span>
								)}
							</div>
						);
					})}
				</div>
			</div>

			<div style={{ borderTop: `1px solid ${theme.border}` }} />

			{/* Rate Trends */}
			{trend && (
				<>
					<div css={sectionCss}>
						<div css={labelCss} style={{ color: theme.textMuted }}>
							{t("stats_panel.rates_vs_30s")}
						</div>
						{[
							{
								label: `$ ${t("stats_panel.cash_per_sec")}`,
								value: `$${formatNumber(trend.cashPerSec, true)}`,
								pct: trend.cashPct,
								color: theme.cashColor,
							},
							{
								label: "LoC/s",
								value: formatNumber(trend.locPerSec),
								pct: trend.locPct,
								color: theme.locColor,
							},
							{
								label: "FLOPS util",
								value: `${Math.round(trend.flopUtil)}%`,
								pct: trend.flopDelta,
								color: theme.flopsColor,
							},
						].map((row) => (
							<div key={row.label} css={rowCss}>
								<span style={{ color: theme.textMuted }}>{row.label}</span>
								<span>
									<span style={{ color: row.color, fontWeight: 500 }}>
										{row.value}
									</span>
									<span
										css={trendCss}
										style={{
											color: row.pct >= 0 ? theme.success : "#f85149",
											background:
												row.pct >= 0
													? "rgba(63,185,80,0.1)"
													: "rgba(248,81,73,0.1)",
											marginLeft: 4,
										}}
									>
										{row.pct >= 0 ? "+" : ""}
										{Math.round(row.pct)}%
									</span>
								</span>
							</div>
						))}
					</div>
					<div style={{ borderTop: `1px solid ${theme.border}` }} />
				</>
			)}

			{/* Purchase Feed */}
			{recentPurchases.length > 0 && (
				<div css={sectionCss}>
					<div css={labelCss} style={{ color: theme.textMuted }}>
						{t("stats_panel.recent_purchases")}
					</div>
					<div style={{ maxHeight: 140, overflowY: "auto" }}>
						{recentPurchases.map((p, i) => {
							const ago = elapsed - p.time;
							const name =
								tUpgrades(`${p.id}.name`, { defaultValue: "" }) ||
								tTech(`${p.id}.name`, { defaultValue: p.id });
							return (
								<div
									key={`${p.id}-${i}`}
									css={feedItemCss}
									style={{ borderBottom: `1px solid ${theme.border}` }}
								>
									<span style={{ color: theme.foreground }}>{name}</span>
									<span>
										<span style={{ color: theme.cashColor, fontSize: 10 }}>
											${formatNumber(p.cost, true)}
										</span>
										<span
											style={{
												color: theme.textMuted,
												fontSize: 10,
												marginLeft: 6,
											}}
										>
											{formatAgo(ago)}
										</span>
									</span>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
