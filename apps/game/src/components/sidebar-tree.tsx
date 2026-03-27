import type { Upgrade, UpgradeEffect } from "@agi-rush/domain";
import { css } from "@emotion/react";
import type { EditorTheme } from "@modules/editor";
import {
	allMilestones,
	allUpgrades,
	getEffectiveMax,
	getUpgradeCost,
	PageEnum,
	tiers,
	useGameStore,
	useUiStore,
} from "@modules/game";
import { formatNumber } from "@utils/format";
import { useState } from "react";
import { useIdeTheme } from "../hooks/use-ide-theme";

// ── Styles (layout-only, no colors) ──

const sidebarCss = css({
	display: "flex",
	flexDirection: "column",
	width: 260,
	minWidth: 200,
	overflow: "hidden",
	flexShrink: 0,
});

const scrollBaseCss = css({
	flex: 1,
	overflowY: "auto",
	padding: "4px 0",
	"&::-webkit-scrollbar": { width: 6 },
	"&::-webkit-scrollbar-track": { background: "transparent" },
});

const sectionHeaderBaseCss = css({
	fontSize: 11,
	textTransform: "uppercase",
	letterSpacing: 0.5,
	padding: "8px 12px 4px",
	userSelect: "none",
});

const folderRowBaseCss = css({
	display: "flex",
	alignItems: "center",
	gap: 4,
	padding: "3px 8px",
	fontSize: 13,
	cursor: "pointer",
	userSelect: "none",
});

const itemBaseCss = css({
	margin: "1px 8px 1px 20px",
	padding: "4px 6px",
	borderRadius: 4,
	cursor: "pointer",
	transition: "border-color 0.15s",
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

// ── Effect summary ──

function formatEffect(
	effect: UpgradeEffect,
	theme: EditorTheme,
): { text: string; color: string } {
	const val = effect.value as number;
	if (effect.op === "enable" && effect.type === "singularity")
		return { text: "🌀 AGI", color: "#e94560" };
	if (effect.type === "instantCash")
		return { text: `+$${formatNumber(val)}`, color: theme.cashColor };
	if (effect.type === "llmHostSlot")
		return { text: `+${val} AI slot`, color: theme.flopsColor };
	if (effect.type === "managerLoc")
		return { text: "+50% teams", color: theme.locColor };

	if (effect.op === "multiply")
		return { text: `×${val}`, color: theme.cashColor };

	const locTypes = [
		"freelancerLoc",
		"internLoc",
		"devLoc",
		"teamLoc",
		"autoLoc",
		"agentLoc",
	];
	if (locTypes.includes(effect.type))
		return { text: `+${formatNumber(val)} loc/s`, color: theme.locColor };

	const flopTypes = ["flops", "cpuFlops", "ramFlops", "storageFlops"];
	if (flopTypes.includes(effect.type))
		return { text: `+${formatNumber(val)} flops`, color: theme.flopsColor };

	return { text: effect.type, color: theme.textMuted };
}

// ── Upgrade item ──

function UpgradeItem({ upgrade }: { upgrade: Upgrade }) {
	const cash = useGameStore((s) => s.cash);
	const owned = useGameStore((s) => s.ownedUpgrades[upgrade.id] ?? 0);
	const buyUpgrade = useGameStore((s) => s.buyUpgrade);
	const state = useGameStore((s) => s);
	const theme = useIdeTheme();

	const cost = getUpgradeCost(upgrade, owned, state);
	const effectiveMax = getEffectiveMax(upgrade, state);
	const canAfford = cash >= cost;
	const maxed = owned >= effectiveMax;

	const effect = upgrade.effects[0]
		? formatEffect(upgrade.effects[0], theme)
		: null;

	const nameColor = canAfford || maxed ? theme.foreground : theme.textMuted;

	return (
		<div
			css={[itemBaseCss]}
			style={{
				background: theme.hoverBg,
				border: `1px solid ${maxed ? theme.success : theme.border}`,
				opacity: !canAfford && !maxed ? 0.4 : maxed ? 0.5 : undefined,
				cursor:
					!canAfford && !maxed ? "default" : maxed ? "default" : "pointer",
			}}
			onMouseEnter={(e) => {
				if (!maxed && (canAfford || (!canAfford && !maxed))) {
					const target = e.currentTarget;
					if (maxed) {
						target.style.borderColor = theme.success;
					} else if (!canAfford) {
						target.style.borderColor = theme.border;
					} else {
						target.style.borderColor = theme.accent;
					}
				}
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.borderColor = maxed
					? theme.success
					: theme.border;
			}}
			onClick={() => {
				if (canAfford && !maxed) buyUpgrade(upgrade);
			}}
			onKeyDown={(e) => {
				if (e.key === "Enter" && canAfford && !maxed) buyUpgrade(upgrade);
			}}
			role="button"
			tabIndex={0}
		>
			<div css={{ display: "flex", gap: 6 }}>
				{/* Left: icon + name + effect */}
				<div css={{ flex: 1, minWidth: 0 }}>
					<div css={itemRow1Css}>
						<span>{upgrade.icon}</span>
						<span css={itemNameCss} style={{ color: nameColor }}>
							{upgrade.name}
						</span>
						<span
							css={itemCountCss}
							style={{ color: maxed ? theme.success : theme.lineNumbers }}
						>
							{effectiveMax === 1
								? owned > 0
									? "✓"
									: ""
								: `${owned}/${effectiveMax}`}
						</span>
					</div>
					{effect && (
						<div css={itemRow2Css}>
							<span css={effectCss} style={{ color: effect.color }}>
								{effect.text}
							</span>
						</div>
					)}
				</div>
				{/* Right: price, right-aligned */}
				<span
					css={{
						display: "flex",
						alignItems: "center",
						fontSize: 12,
						fontWeight: 600,
						flexShrink: 0,
						fontVariantNumeric: "tabular-nums",
					}}
					style={{
						color: maxed ? theme.success : theme.cashColor,
					}}
				>
					{maxed ? "MAXED" : `$${formatNumber(cost)}`}
				</span>
			</div>
		</div>
	);
}

// ── Main sidebar ──

const pageFiles: Array<{ page: PageEnum; filename: string; dotColor: string }> =
	[
		{ page: PageEnum.game, filename: "agi.py", dotColor: "#519aba" },
		{
			page: PageEnum.tech_tree,
			filename: "tech-tree.svg",
			dotColor: "#f1c542",
		},
		{ page: PageEnum.settings, filename: "settings.json", dotColor: "#cbcb41" },
		{ page: PageEnum.god_mode, filename: "godmode.ts", dotColor: "#519aba" },
	];

export function SidebarTree({ onCollapse }: { onCollapse?: () => void }) {
	const page = useUiStore((s) => s.page);
	const setPage = useUiStore((s) => s.setPage);
	const currentTierIndex = useGameStore((s) => s.currentTierIndex);
	const ownedTechNodes = useGameStore((s) => s.ownedTechNodes);
	const reachedMilestones = useGameStore((s) => s.reachedMilestones);
	const theme = useIdeTheme();
	const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
	const [milestonesOpen, setMilestonesOpen] = useState(false);

	const toggle = (id: string) =>
		setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

	return (
		<div
			css={sidebarCss}
			style={{
				background: theme.sidebarBg,
				borderRight: `1px solid ${theme.border}`,
			}}
		>
			<div
				css={{
					padding: "10px 12px",
					fontSize: 11,
					fontWeight: 600,
					textTransform: "uppercase",
					letterSpacing: 0.5,
					color: theme.textMuted,
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
				}}
			>
				Explorer
				{onCollapse && (
					<button
						type="button"
						onClick={onCollapse}
						title="Hide sidebar"
						css={{
							background: "none",
							border: "none",
							cursor: "pointer",
							color: theme.textMuted,
							padding: 2,
							display: "flex",
							alignItems: "center",
							"&:hover": { color: theme.foreground },
						}}
					>
						<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
							<path
								d="M11 4L7 8l4 4"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</button>
				)}
			</div>
			<div
				css={scrollBaseCss}
				style={
					{
						"--scroll-thumb": theme.border,
					} as React.CSSProperties
				}
				className="sidebar-scroll"
			>
				<style>
					{`.sidebar-scroll::-webkit-scrollbar-thumb { background: ${theme.border}; border-radius: 3px; }`}
				</style>
				{/* Open Editors */}
				<div css={sectionHeaderBaseCss} style={{ color: theme.textMuted }}>
					&#9662; Open Editors
				</div>
				{pageFiles.map((f) => {
					const active = f.page === page;
					return (
						<div
							key={f.page}
							css={{
								padding: "2px 8px 2px 28px",
								display: "flex",
								alignItems: "center",
								gap: 6,
								fontSize: 13,
								height: 22,
								cursor: "pointer",
								background: active ? theme.activeBg : "transparent",
								color: active ? theme.foreground : theme.textMuted,
								"&:hover": {
									background: theme.activeBg,
									color: theme.foreground,
								},
							}}
							onClick={() => setPage(f.page)}
							onKeyDown={(e) => {
								if (e.key === "Enter") setPage(f.page);
							}}
							role="button"
							tabIndex={0}
						>
							<span
								css={{
									width: 6,
									height: 6,
									borderRadius: "50%",
									background: f.dotColor,
									flexShrink: 0,
								}}
							/>
							{f.filename}
						</div>
					);
				})}

				{/* Upgrades */}
				<div
					css={sectionHeaderBaseCss}
					style={{ color: theme.textMuted, marginTop: 8 }}
				>
					&#9662; Upgrades
				</div>
				{tiers
					.filter((tier) => tier.index <= currentTierIndex)
					.map((tier) => {
						const isOpen = !collapsed[tier.id];
						const tierUpgrades = allUpgrades.filter(
							(u) =>
								u.tier === tier.id &&
								(!u.requires ||
									u.requires.every((id) => (ownedTechNodes[id] ?? 0) > 0)),
						);

						return (
							<div key={tier.id}>
								<div
									css={folderRowBaseCss}
									style={{
										color: theme.foreground,
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.background = theme.hoverBg;
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.background = "transparent";
									}}
									onClick={() => toggle(tier.id)}
									onKeyDown={(e) => {
										if (e.key === "Enter") toggle(tier.id);
									}}
									role="button"
									tabIndex={0}
								>
									<span style={{ fontSize: 10, width: 12 }}>
										{isOpen ? "▾" : "▸"}
									</span>
									<span>📂</span>
									<span>{tier.id}/</span>
								</div>
								{isOpen &&
									tierUpgrades.map((u) => (
										<UpgradeItem key={u.id} upgrade={u} />
									))}
							</div>
						);
					})}

				{/* Milestones section */}
				<div
					css={[sectionHeaderBaseCss, { cursor: "pointer" }]}
					style={{ color: theme.textMuted, marginTop: 12 }}
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
					allMilestones
						.filter((m) => reachedMilestones.includes(m.id))
						.map((m) => (
							<div
								key={m.id}
								css={milestoneCss}
								style={{ color: theme.success }}
							>
								✓ {m.name} — {formatNumber(m.threshold)}
							</div>
						))}
			</div>
		</div>
	);
}
