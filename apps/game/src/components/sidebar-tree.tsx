import type { Upgrade, UpgradeEffect } from "@agi-rush/domain";
import { css } from "@emotion/react";
import {
	aiModels,
	allMilestones,
	allUpgrades,
	getEffectiveMax,
	getUpgradeCost,
	tiers,
	useGameStore,
} from "@modules/game";
import { formatNumber } from "@utils/format";
import { useState } from "react";

// ── Styles ──

const sidebarCss = css({
	display: "flex",
	flexDirection: "column",
	width: 240,
	minWidth: 200,
	background: "#0d1117",
	borderRight: "1px solid #1e2630",
	overflow: "hidden",
	flexShrink: 0,
});

const scrollCss = css({
	flex: 1,
	overflowY: "auto",
	padding: "4px 0",
	"&::-webkit-scrollbar": { width: 6 },
	"&::-webkit-scrollbar-track": { background: "transparent" },
	"&::-webkit-scrollbar-thumb": { background: "#1e2630", borderRadius: 3 },
});

const sectionHeaderCss = css({
	fontSize: 11,
	textTransform: "uppercase",
	letterSpacing: 0.5,
	color: "#8b949e",
	padding: "8px 12px 4px",
	userSelect: "none",
});

const folderRowCss = css({
	display: "flex",
	alignItems: "center",
	gap: 4,
	padding: "3px 8px",
	fontSize: 13,
	cursor: "pointer",
	userSelect: "none",
	"&:hover": { background: "#141920" },
});

const folderLockedCss = css({
	color: "#484f58",
	cursor: "default",
	"&:hover": { background: "transparent" },
});

const itemCss = css({
	margin: "1px 8px 1px 20px",
	padding: "4px 6px",
	borderRadius: 4,
	background: "#141920",
	border: "1px solid #1e2630",
	cursor: "pointer",
	transition: "border-color 0.15s",
	"&:hover": { borderColor: "#58a6ff" },
});

const itemLockedCss = css({
	opacity: 0.4,
	cursor: "default",
	"&:hover": { borderColor: "#1e2630" },
});

const itemMaxedCss = css({
	borderColor: "#3fb950",
	opacity: 0.5,
	cursor: "default",
	"&:hover": { borderColor: "#3fb950" },
});

const itemRow1Css = css({
	display: "flex",
	alignItems: "center",
	gap: 6,
	fontSize: 13,
});

const itemNameCss = css({
	flex: 1,
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
});

const itemCountCss = css({
	fontSize: 11,
	flexShrink: 0,
});

const itemRow2Css = css({
	display: "flex",
	alignItems: "center",
	gap: 6,
	paddingLeft: 22,
	marginTop: 1,
});

const effectCss = css({
	fontSize: 11,
	flex: 1,
});

const priceBadgeCss = css({
	fontSize: 10,
	padding: "1px 5px",
	borderRadius: 3,
	flexShrink: 0,
});

const milestoneCss = css({
	padding: "2px 12px 2px 20px",
	fontSize: 12,
	lineHeight: 1.8,
});

const execWrapperCss = css({
	padding: "8px 8px",
	borderTop: "1px solid #1e2630",
	flexShrink: 0,
});

const execBtnCss = css({
	width: "100%",
	padding: "8px 0",
	fontSize: 12,
	fontWeight: "bold",
	fontFamily: "inherit",
	textTransform: "uppercase",
	letterSpacing: 1,
	border: "1px solid #7ee787",
	borderRadius: 4,
	cursor: "pointer",
	transition: "all 0.1s",
	background: "transparent",
	color: "#7ee787",
	"&:hover": { background: "#7ee787", color: "#0d1117" },
	"&:active": { transform: "scale(0.97)" },
	"&:disabled": {
		opacity: 0.3,
		cursor: "default",
		"&:hover": { background: "transparent", color: "#7ee787" },
	},
});

const autoExecLabelCss = css({
	width: "100%",
	padding: "8px 0",
	fontSize: 12,
	fontWeight: "bold",
	fontFamily: "inherit",
	textTransform: "uppercase",
	letterSpacing: 1,
	textAlign: "center",
	color: "#3fb950",
	border: "1px solid #238636",
	borderRadius: 4,
	background: "rgba(35, 134, 54, 0.1)",
});

// ── Effect summary ──

function formatEffect(effect: UpgradeEffect): { text: string; color: string } {
	const val = effect.value as number;
	if (effect.op === "enable" && effect.type === "singularity")
		return { text: "🌀 AGI", color: "#e94560" };
	if (effect.type === "instantCash")
		return { text: `+$${formatNumber(val)}`, color: "#3fb950" };
	if (effect.type === "llmHostSlot")
		return { text: `+${val} AI slot`, color: "#d4a574" };
	if (effect.type === "managerLoc")
		return { text: "+50% teams", color: "#c084fc" };

	if (effect.op === "multiply") return { text: `×${val}`, color: "#c084fc" };

	const locTypes = [
		"freelancerLoc",
		"internLoc",
		"devLoc",
		"teamLoc",
		"autoLoc",
		"agentLoc",
	];
	if (locTypes.includes(effect.type))
		return { text: `+${formatNumber(val)} loc/s`, color: "#58a6ff" };

	const flopTypes = ["flops", "cpuFlops", "ramFlops", "storageFlops"];
	if (flopTypes.includes(effect.type))
		return { text: `+${formatNumber(val)} flops`, color: "#fbbf24" };

	return { text: effect.type, color: "#8b949e" };
}

// ── Upgrade item ──

function UpgradeItem({ upgrade }: { upgrade: Upgrade }) {
	const cash = useGameStore((s) => s.cash);
	const owned = useGameStore((s) => s.ownedUpgrades[upgrade.id] ?? 0);
	const buyUpgrade = useGameStore((s) => s.buyUpgrade);
	const state = useGameStore((s) => s);

	const cost = getUpgradeCost(upgrade, owned, state);
	const effectiveMax = getEffectiveMax(upgrade, state);
	const canAfford = cash >= cost;
	const maxed = owned >= effectiveMax;

	const effect = upgrade.effects[0] ? formatEffect(upgrade.effects[0]) : null;

	const nameColor = canAfford || maxed ? "#c9d1d9" : "#6272a4";

	return (
		<div
			css={[
				itemCss,
				!canAfford && !maxed && itemLockedCss,
				maxed && itemMaxedCss,
			]}
			onClick={() => {
				if (canAfford && !maxed) buyUpgrade(upgrade);
			}}
			onKeyDown={(e) => {
				if (e.key === "Enter" && canAfford && !maxed) buyUpgrade(upgrade);
			}}
			role="button"
			tabIndex={0}
		>
			<div css={itemRow1Css}>
				<span>{upgrade.icon}</span>
				<span css={itemNameCss} style={{ color: nameColor }}>
					{upgrade.name}
				</span>
				<span
					css={itemCountCss}
					style={{ color: maxed ? "#3fb950" : "#484f58" }}
				>
					{effectiveMax === 1
						? owned > 0
							? "✓"
							: ""
						: `${owned}/${effectiveMax}`}
				</span>
			</div>
			<div css={itemRow2Css}>
				{effect && (
					<span css={effectCss} style={{ color: effect.color }}>
						{effect.text}
					</span>
				)}
				<span
					css={priceBadgeCss}
					style={{
						background: maxed ? "#1a3a2a" : "#2a2a1a",
						color: maxed ? "#3fb950" : "#d19a66",
					}}
				>
					{maxed ? "MAXED" : `$${formatNumber(cost)}`}
				</span>
			</div>
		</div>
	);
}

// ── Main sidebar ──

export function SidebarTree() {
	const currentTierIndex = useGameStore((s) => s.currentTierIndex);
	const ownedTechNodes = useGameStore((s) => s.ownedTechNodes);
	const reachedMilestones = useGameStore((s) => s.reachedMilestones);
	const loc = useGameStore((s) => s.loc);
	const flops = useGameStore((s) => s.flops);
	const cashMultiplier = useGameStore((s) => s.cashMultiplier);
	const aiUnlocked = useGameStore((s) => s.aiUnlocked);
	const unlockedModels = useGameStore((s) => s.unlockedModels);
	const autoExec = useGameStore((s) => s.autoExecuteEnabled);
	const executeManual = useGameStore((s) => s.executeManual);
	const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
	const [milestonesOpen, setMilestonesOpen] = useState(true);

	const toggle = (id: string) =>
		setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

	const tier = tiers[currentTierIndex];
	const cashPerLoc = tier?.cashPerLoc ?? 0.1;
	let aiFlopsCost = 0;
	if (aiUnlocked) {
		for (const model of aiModels) {
			if (unlockedModels[model.id]) aiFlopsCost += model.flopsCost;
		}
	}
	const execFlops = Math.max(0, flops - Math.min(aiFlopsCost, flops));
	const execLoc = Math.min(Math.floor(execFlops), Math.floor(loc));
	const earnPerExec = execLoc * cashPerLoc * cashMultiplier;

	return (
		<div css={sidebarCss}>
			<div css={scrollCss}>
				<div css={sectionHeaderCss}>Upgrades</div>
				{tiers.map((tier) => {
					const locked = tier.index > currentTierIndex;
					const isOpen = !locked && !collapsed[tier.id];
					const tierUpgrades = allUpgrades.filter(
						(u) =>
							u.tier === tier.id &&
							(!u.requires ||
								u.requires.every((id) => (ownedTechNodes[id] ?? 0) > 0)),
					);

					return (
						<div key={tier.id}>
							<div
								css={[folderRowCss, locked && folderLockedCss]}
								onClick={() => {
									if (!locked) toggle(tier.id);
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter" && !locked) toggle(tier.id);
								}}
								role="button"
								tabIndex={locked ? -1 : 0}
							>
								<span style={{ fontSize: 10, width: 12 }}>
									{locked ? "▸" : isOpen ? "▾" : "▸"}
								</span>
								<span>📂</span>
								<span style={{ color: locked ? "#484f58" : "#c9d1d9" }}>
									{tier.id}/
								</span>
								{locked && (
									<span style={{ fontSize: 8, marginLeft: 4 }}>🔒</span>
								)}
							</div>
							{isOpen &&
								tierUpgrades.map((u) => <UpgradeItem key={u.id} upgrade={u} />)}
						</div>
					);
				})}

				{/* Milestones section */}
				<div
					css={[sectionHeaderCss, { cursor: "pointer" }]}
					onClick={() => setMilestonesOpen(!milestonesOpen)}
					onKeyDown={(e) => {
						if (e.key === "Enter") setMilestonesOpen(!milestonesOpen);
					}}
					role="button"
					tabIndex={0}
				>
					{milestonesOpen ? "▾" : "▸"} Milestones
				</div>
				{milestonesOpen &&
					allMilestones.map((m) => {
						const reached = reachedMilestones.includes(m.id);
						return (
							<div
								key={m.id}
								css={milestoneCss}
								style={{ color: reached ? "#3fb950" : "#484f58" }}
							>
								{reached ? "✓" : "○"} {m.name} — {formatNumber(m.threshold)}
							</div>
						);
					})}
			</div>

			{/* Execute button at bottom */}
			<div css={execWrapperCss}>
				{autoExec ? (
					<div css={autoExecLabelCss}>⚡ Auto-Execute</div>
				) : (
					<button
						type="button"
						css={execBtnCss}
						onClick={executeManual}
						disabled={execLoc <= 0}
					>
						⚡ Execute {formatNumber(execLoc)} → $
						{formatNumber(earnPerExec, true)}
					</button>
				)}
			</div>
		</div>
	);
}
