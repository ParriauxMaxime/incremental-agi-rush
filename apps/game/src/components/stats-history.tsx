import { css } from "@emotion/react";
import { tierColors } from "@flopsed/design-system";
import { useGameStore } from "@modules/game";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";

const TIER_COLORS = [
	tierColors.garage,
	tierColors.freelancing,
	tierColors.startup,
	tierColors.tech_company,
	tierColors.ai_lab,
	tierColors.agi_race,
];

const VISIBLE_COUNT = 5;

const headerCss = css({
	display: "flex",
	alignItems: "center",
	cursor: "pointer",
	userSelect: "none",
	marginBottom: 8,
});

const chevronCss = css({
	fontSize: 12,
	marginRight: 6,
	transition: "transform 0.15s ease",
	display: "inline-block",
	width: 14,
	textAlign: "center",
});

const rowCss = css({
	display: "flex",
	alignItems: "center",
	gap: 6,
	padding: "3px 0",
	fontSize: 11,
});

const shaCss = css({
	fontSize: 10,
	flexShrink: 0,
	letterSpacing: 0.3,
});

const nameCss = css({
	flex: 1,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
});

const timeCss = css({
	fontSize: 10,
	flexShrink: 0,
});

const overflowCss = css({
	overflow: "hidden",
	transition: "max-height 0.25s ease",
});

function formatAgo(secondsAgo: number): string {
	if (secondsAgo < 60) return `${Math.floor(secondsAgo)}s`;
	const m = Math.floor(secondsAgo / 60);
	return `${m}m`;
}

/** Generate a deterministic-looking 5-char hex suffix from a string + index */
function pseudoHash(id: string, index: number): string {
	let h = index * 2654435761;
	for (let i = 0; i < id.length; i++) {
		h = ((h << 5) - h + id.charCodeAt(i)) | 0;
	}
	return Math.abs(h).toString(16).slice(0, 5).padEnd(5, "0");
}

export function StatsHistory() {
	const { t } = useTranslation();
	const theme = useIdeTheme();
	const purchaseLog = useGameStore((s) => s.purchaseLog);
	const sessionStartTime = useGameStore((s) => s.sessionStartTime);
	const tierTransitions = useGameStore((s) => s.tierTransitions);

	const { t: tUpgrades } = useTranslation("upgrades");
	const { t: tTech } = useTranslation("tech-tree");

	const [expanded, setExpanded] = useState(false);
	const toggleExpand = useCallback(() => setExpanded((e) => !e), []);

	const elapsed = (performance.now() - sessionStartTime) / 1000;

	const entries = useMemo(() => {
		const reversed = [...purchaseLog].reverse();
		return reversed.map((p, i) => {
			// Determine which tier this purchase was in
			let tier = 0;
			for (const tt of tierTransitions) {
				if (p.time >= tt.enteredAt) tier = tt.tierIndex;
			}
			const name =
				tUpgrades(`${p.id}.name`, { defaultValue: "" }) ||
				tTech(`${p.id}.name`, { defaultValue: p.id });
			return {
				id: `${p.id}-${i}`,
				name,
				tier,
				ago: elapsed - p.time,
				sha: `t${tier}${pseudoHash(p.id, i)}`,
			};
		});
	}, [purchaseLog, elapsed, tierTransitions, tUpgrades, tTech]);

	const visibleEntries = entries.slice(0, VISIBLE_COUNT);
	const overflowEntries = entries.slice(VISIBLE_COUNT);
	const hasOverflow = overflowEntries.length > 0;

	const renderEntry = (entry: (typeof entries)[0], isLast: boolean) => (
		<div key={entry.id}>
			<div css={rowCss}>
				<span style={{ color: theme.accent, fontSize: 12 }}>●</span>
				<span css={shaCss}>
					<span style={{ color: TIER_COLORS[entry.tier], fontWeight: 600 }}>
						t{entry.tier}
					</span>
					<span style={{ color: theme.lineNumbers }}>{entry.sha.slice(2)}</span>
				</span>
				<span css={nameCss} style={{ color: theme.foreground }}>
					{entry.name}
				</span>
				<span css={timeCss} style={{ color: theme.lineNumbers }}>
					{formatAgo(entry.ago)}
				</span>
			</div>
			{!isLast && (
				<div
					style={{
						marginLeft: 5,
						color: theme.border,
						lineHeight: 1,
						fontSize: 13,
					}}
				>
					│
				</div>
			)}
		</div>
	);

	if (entries.length === 0) {
		return (
			<div style={{ padding: "8px 14px" }}>
				<div
					style={{
						fontSize: 10,
						textTransform: "uppercase",
						letterSpacing: 0.5,
						color: theme.lineNumbers,
						marginBottom: 8,
					}}
				>
					{t("stats_panel.history", { defaultValue: "History" })}
				</div>
				<div
					style={{
						color: theme.lineNumbers,
						fontStyle: "italic",
						textAlign: "center",
						padding: "12px 0",
						fontSize: 11,
					}}
				>
					{t("stats_panel.no_purchases", {
						defaultValue: "No purchases yet",
					})}
				</div>
			</div>
		);
	}

	return (
		<div style={{ padding: "8px 14px" }}>
			{/* Header — clickable to expand if overflow */}
			<div
				css={hasOverflow ? headerCss : undefined}
				onClick={hasOverflow ? toggleExpand : undefined}
				style={
					hasOverflow
						? undefined
						: {
								fontSize: 10,
								textTransform: "uppercase",
								letterSpacing: 0.5,
								color: theme.lineNumbers,
								marginBottom: 8,
							}
				}
			>
				{hasOverflow && (
					<span
						css={chevronCss}
						style={{
							color: theme.lineNumbers,
							transform: expanded ? "rotate(90deg)" : "none",
						}}
					>
						▶
					</span>
				)}
				<span
					style={{
						fontSize: 10,
						textTransform: "uppercase",
						letterSpacing: 0.5,
						color: theme.lineNumbers,
					}}
				>
					{t("stats_panel.history", { defaultValue: "History" })}
				</span>
			</div>

			{/* Visible entries (always shown) */}
			{visibleEntries.map((entry, i) => {
				const isLastVisible = i === visibleEntries.length - 1 && !hasOverflow;
				return renderEntry(entry, isLastVisible);
			})}

			{/* Overflow entries */}
			{hasOverflow && (
				<>
					<div
						css={overflowCss}
						style={{
							maxHeight: expanded ? 500 : 0,
							overflowY: expanded ? "auto" : "hidden",
						}}
					>
						{overflowEntries.map((entry, i) =>
							renderEntry(entry, i === overflowEntries.length - 1),
						)}
					</div>
					{!expanded && (
						<div
							style={{
								marginLeft: 5,
								color: theme.lineNumbers,
								fontSize: 13,
							}}
						>
							⋮
						</div>
					)}
				</>
			)}
		</div>
	);
}
