import { css } from "@emotion/react";
import { useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { CollapsibleSection } from "./collapsible-section";
import { RollingNumber } from "./rolling-number";
import { Sparkline } from "./sparkline";

// ── Tier colors for human sources ──
const SOURCE_COLORS = {
	you: "#6272a4",
	malt_freelancer: "#8be9fd",
	intern: "#8be9fd",
	dev_team: "#3fb950",
} as const;

// ── Rate trackers (moved from stats-panel-resources) ──

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
				pressTimestamps.current.length = 0;
				setRate(0);
			} else if (heldRef.current) {
				setRate(HELD_CAP);
			} else {
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
	const totalLoc = useGameStore((s) => s.totalLoc);
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

	const keysPerSec = useKeypressRate();
	const locRate = useRatePerSec(totalLoc);
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
		const autoTypeKeysPerSec = autoTypeEnabled ? 5 : 0;
		const effectiveKeysPerSec = Math.max(keysPerSec, autoTypeKeysPerSec);
		rows.push({
			name: t("stats_panel.you"),
			locPerSec: effectiveKeysPerSec * locPerKey,
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
		locPerKey,
		autoTypeEnabled,
		keysPerSec,
		t,
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

	return (
		<CollapsibleSection
			icon={<span style={{ color: theme.locColor }}>◇</span>}
			label={t("stats_panel.loc")}
			value={<RollingNumber value={formatNumber(loc)} color={theme.locColor} />}
			rate={
				<span style={{ color: theme.locColor }}>
					{formatNumber(locRate)}
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
							color: theme.lineNumbers,
							marginBottom: 4,
						}}
					>
						<span>{t("stats_panel.produced_vs_executed")}</span>
						<span>
							<span style={{ color: theme.locColor }}>
								{formatNumber(latest.locProducedPerSec)}
							</span>
							<span style={{ color: theme.lineNumbers }}> / </span>
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
							<span style={{ color: theme.lineNumbers }}> x{s.count}</span>
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
						{t("stats_panel.per_sec")}
					</span>
				</div>
			))}
			{managerBonus > 1 && (
				<div style={{ fontSize: 10, color: theme.lineNumbers, marginTop: 3 }}>
					{t("stats_panel.manager_bonus", {
						bonus: Math.round((managerBonus - 1) * 100),
					})}
				</div>
			)}
		</CollapsibleSection>
	);
}
