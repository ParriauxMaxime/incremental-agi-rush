import { css } from "@emotion/react";
import type { Upgrade, UpgradeEffect } from "@flopsed/domain";
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
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";

// ── Styles (layout-only, no colors) ──

const sidebarCss = css({
	display: "flex",
	flexDirection: "column",
	width: "100%",
	minWidth: 0,
	height: "100%",
	overflow: "hidden",
	flexShrink: 0,
	boxShadow: "2px 0 6px rgba(0,0,0,0.15)",
	zIndex: 1,
	position: "relative",
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

const milestoneCss = css({
	padding: "2px 12px 2px 20px",
	fontSize: 12,
	lineHeight: 1.8,
});

const priceCss = css({
	display: "flex",
	alignItems: "center",
	fontSize: 12,
	fontWeight: 600,
	flexShrink: 0,
	fontVariantNumeric: "tabular-nums",
});

// ── Effect summary ──

/** Map from LoC effect type to the per-type LoC/s state key */
const LOC_RATE_KEY: Record<string, keyof GameState> = {
	freelancerLoc: "freelancerLocPerSec",
	internLoc: "internLocPerSec",
	devLoc: "devLocPerSec",
	teamLoc: "teamLocPerSec",
	agentLoc: "agentLocPerSec",
};

type GameState = ReturnType<typeof useGameStore.getState>;

/** Simplified formatEffect that takes a pre-selected rate value instead of full state */
function formatEffectSimple(
	effect: UpgradeEffect,
	theme: EditorTheme,
	rateValue: number,
	owned?: number,
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
	if (effect.op === "multiply") {
		const multiplyLabels: Record<string, { label: string; color: string }> = {
			cashMultiplier: { label: "$/loc", color: theme.cashColor },
			locProductionSpeed: { label: "loc/s", color: theme.locColor },
			locPerKey: { label: "loc/key", color: theme.locColor },
			llmLocMultiplier: { label: "AI loc", color: theme.flopsColor },
			tokenMultiplier: { label: "tokens", color: theme.flopsColor },
			agentLocMultiplier: { label: "agent loc", color: theme.locColor },
			freelancerLocMultiplier: { label: "freelancer", color: theme.locColor },
			internLocMultiplier: { label: "intern", color: theme.locColor },
			devLocMultiplier: { label: "dev loc", color: theme.locColor },
			teamLocMultiplier: { label: "team loc", color: theme.locColor },
			managerMultiplier: { label: "managers", color: theme.locColor },
			freelancerCostDiscount: { label: "freelancer cost", color: theme.cashColor },
			internCostDiscount: { label: "intern cost", color: theme.cashColor },
			devCostDiscount: { label: "dev cost", color: theme.cashColor },
			teamCostDiscount: { label: "team cost", color: theme.cashColor },
			managerCostDiscount: { label: "manager cost", color: theme.cashColor },
			llmCostDiscount: { label: "AI cost", color: theme.cashColor },
			agentCostDiscount: { label: "agent cost", color: theme.cashColor },
		};
		const info = multiplyLabels[effect.type];
		const label = info?.label ?? effect.type;
		const color = info?.color ?? theme.cashColor;
		return { text: `×${val} ${label}`, color };
	}

	if (LOC_RATE_KEY[effect.type] && rateValue > 0 && owned && owned > 0) {
		const effectivePerUnit = rateValue / owned;
		return {
			text: `+${formatNumber(effectivePerUnit)} loc/s`,
			color: theme.locColor,
		};
	}

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

const UpgradeItem = memo(function UpgradeItem({
	upgrade,
}: {
	upgrade: Upgrade;
}) {
	const { t } = useTranslation();
	const buyUpgrade = useGameStore((s) => s.buyUpgrade);
	const theme = useIdeTheme();

	// Compute cost/max/canAfford in a single selector that returns discrete values.
	// canAfford is a boolean — only flips when cash crosses the cost threshold,
	// not every tick like raw cash would.
	const owned = useGameStore((s) => s.ownedUpgrades[upgrade.id] ?? 0);
	const cost = useGameStore((s) => {
		const o = s.ownedUpgrades[upgrade.id] ?? 0;
		return getUpgradeCost(upgrade, o, s);
	});
	const effectiveMax = useGameStore((s) => getEffectiveMax(upgrade, s));
	const canAfford = useGameStore((s) => {
		const o = s.ownedUpgrades[upgrade.id] ?? 0;
		return s.cash >= getUpgradeCost(upgrade, o, s);
	});
	const maxed = owned >= effectiveMax;

	// Only select the specific rate key this upgrade's effect needs
	const rateKey = upgrade.effects[0]
		? LOC_RATE_KEY[upgrade.effects[0].type]
		: undefined;
	const rateValue = useGameStore((s) => (rateKey ? (s[rateKey] as number) : 0));
	const effect = upgrade.effects[0]
		? formatEffectSimple(upgrade.effects[0], theme, rateValue, owned)
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
			onClick={(e) => {
				if (canAfford && !maxed) {
					const el = e.currentTarget;
					el.style.outline = `2px solid ${theme.success}`;
					el.style.outlineOffset = "-2px";
					el.style.filter = "brightness(1.4)";
					setTimeout(() => {
						el.style.outline = "";
						el.style.outlineOffset = "";
						el.style.filter = "";
					}, 150);
					buyUpgrade(upgrade);
				}
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
							{t(`${upgrade.id}.name`, { ns: "upgrades" })}
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
					css={priceCss}
					style={{
						color: maxed ? theme.success : theme.cashColor,
					}}
				>
					{maxed ? "MAXED" : `$${formatNumber(cost)}`}
				</span>
			</div>
		</div>
	);
});

// ── Main sidebar ──

interface FileEntry {
	page: PageEnum;
	filename: string;
	folder?: string;
	dotColor: string;
}

const basePageFiles: FileEntry[] = [
	{
		page: PageEnum.game,
		filename: "agi.py",
		folder: "src",
		dotColor: "#519aba",
	},
	{
		page: PageEnum.tech_tree,
		filename: "tech-tree.svg",
		folder: "src",
		dotColor: "#f1c542",
	},
	{
		page: PageEnum.settings,
		filename: "settings.json",
		folder: "utils",
		dotColor: "#cbcb41",
	},
	{ page: PageEnum.readme, filename: "README.md", dotColor: "#519aba" },
];

const godModeEntry: FileEntry = {
	page: PageEnum.god_mode,
	filename: "godmode.ts",
	folder: "utils",
	dotColor: "#519aba",
};

const IS_DEV = location.hostname === "localhost";

export function SidebarTree({ onCollapse }: { onCollapse?: () => void }) {
	const page = useUiStore((s) => s.page);
	const openTabs = useUiStore((s) => s.openTabs);
	const rightOpenTabs = useUiStore((s) => s.rightOpenTabs);
	const splitEnabled = useUiStore((s) => s.splitEnabled);
	const rightPage = useUiStore((s) => s.rightPage);
	const openInActivePane = useUiStore((s) => s.openInActivePane);
	const currentTierIndex = useGameStore((s) => s.currentTierIndex);
	const ownedTechNodes = useGameStore((s) => s.ownedTechNodes);
	const reachedMilestones = useGameStore((s) => s.reachedMilestones);
	const hasReachedSingularity = useGameStore((s) => s.hasReachedSingularity);
	const allPageFiles =
		IS_DEV || hasReachedSingularity
			? [...basePageFiles, godModeEntry]
			: basePageFiles;
	const allOpenPages = new Set([
		...openTabs,
		...(splitEnabled ? rightOpenTabs : []),
	]);
	const { t } = useTranslation();
	const theme = useIdeTheme();
	const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
	const [editorsOpen, setEditorsOpen] = useState(false);
	const [filesOpen, setFilesOpen] = useState(true);
	const [upgradesOpen, setUpgradesOpen] = useState(true);
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
				{t("sidebar.title")}
				{onCollapse && (
					<button
						type="button"
						onClick={onCollapse}
						title={t("sidebar.hide")}
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
				{(() => {
					const leftFiles = allPageFiles.filter((f) =>
						openTabs.includes(f.page),
					);
					const rightFiles = splitEnabled
						? allPageFiles.filter((f) => rightOpenTabs.includes(f.page))
						: [];
					if (leftFiles.length === 0 && rightFiles.length === 0) return null;

					const renderEditorFile = (f: FileEntry, activePage: PageEnum) => {
						const active = f.page === activePage;
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
								onClick={() => openInActivePane(f.page)}
								onKeyDown={(e) => {
									if (e.key === "Enter") openInActivePane(f.page);
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
								{f.folder ? `${f.folder}/${f.filename}` : f.filename}
							</div>
						);
					};

					return (
						<>
							<div
								css={[sectionHeaderBaseCss, { cursor: "pointer" }]}
								style={{ color: theme.textMuted }}
								onClick={() => setEditorsOpen(!editorsOpen)}
								onKeyDown={(e) => {
									if (e.key === "Enter") setEditorsOpen(!editorsOpen);
								}}
								role="button"
								tabIndex={0}
							>
								{editorsOpen ? "▾" : "▸"} {t("sidebar.open_editors")}
							</div>
							{editorsOpen &&
								!splitEnabled &&
								leftFiles.map((f) => renderEditorFile(f, page))}
							{editorsOpen && splitEnabled && (
								<>
									<div
										css={{
											padding: "2px 8px 2px 16px",
											fontSize: 10,
											color: theme.textMuted,
											textTransform: "uppercase",
											letterSpacing: 0.5,
											marginTop: 2,
										}}
									>
										Left
									</div>
									{leftFiles.map((f) => renderEditorFile(f, page))}
									<div
										css={{
											padding: "2px 8px 2px 16px",
											fontSize: 10,
											color: theme.textMuted,
											textTransform: "uppercase",
											letterSpacing: 0.5,
											marginTop: 4,
										}}
									>
										Right
									</div>
									{rightFiles.map((f) => renderEditorFile(f, rightPage))}
								</>
							)}
						</>
					);
				})()}

				{/* Files */}
				<div
					css={[sectionHeaderBaseCss, { cursor: "pointer" }]}
					style={{ color: theme.textMuted, marginTop: 8 }}
					onClick={() => setFilesOpen(!filesOpen)}
					onKeyDown={(e) => {
						if (e.key === "Enter") setFilesOpen(!filesOpen);
					}}
					role="button"
					tabIndex={0}
				>
					{filesOpen ? "▾" : "▸"}{" "}
					{t("sidebar.files", { defaultValue: "Files" })}
				</div>
				{filesOpen &&
					(() => {
						const folders = new Map<string, FileEntry[]>();
						const rootFiles: FileEntry[] = [];
						for (const f of allPageFiles) {
							if (f.folder) {
								if (!folders.has(f.folder)) folders.set(f.folder, []);
								folders.get(f.folder)?.push(f);
							} else {
								rootFiles.push(f);
							}
						}
						// Sort folders alphabetically, root files after
						const sortedFolders = [...folders.entries()].sort((a, b) =>
							a[0].localeCompare(b[0]),
						);

						const renderFile = (f: FileEntry, indent: number) => {
							const active = f.page === page;
							const isOpen = allOpenPages.has(f.page);
							return (
								<div
									key={`file-${f.page}`}
									css={{
										padding: `2px 8px 2px ${indent}px`,
										display: "flex",
										alignItems: "center",
										gap: 6,
										fontSize: 13,
										height: 22,
										cursor: "pointer",
										background: active ? theme.activeBg : "transparent",
										color: isOpen ? theme.foreground : theme.textMuted,
										"&:hover": {
											background: theme.activeBg,
											color: theme.foreground,
										},
									}}
									onClick={() => openInActivePane(f.page)}
									onKeyDown={(e) => {
										if (e.key === "Enter") openInActivePane(f.page);
									}}
									role="button"
									tabIndex={0}
								>
									<span
										css={{
											width: 6,
											height: 6,
											borderRadius: "50%",
											background: isOpen ? f.dotColor : "transparent",
											border: isOpen ? "none" : `1px solid ${f.dotColor}`,
											flexShrink: 0,
										}}
									/>
									{f.filename}
								</div>
							);
						};

						return (
							<>
								{sortedFolders.map(([folder, files]) => (
									<div key={folder}>
										<div
											css={{
												padding: "2px 8px 2px 16px",
												fontSize: 13,
												height: 22,
												display: "flex",
												alignItems: "center",
												gap: 4,
												color: theme.textMuted,
											}}
										>
											<span style={{ fontSize: 11 }}>📁</span>
											{folder}/
										</div>
										{files.map((f) => renderFile(f, 36))}
									</div>
								))}
								{rootFiles.map((f) => renderFile(f, 16))}
							</>
						);
					})()}

				{/* Upgrades */}
				<div
					css={[sectionHeaderBaseCss, { cursor: "pointer" }]}
					style={{ color: theme.textMuted, marginTop: 8 }}
					onClick={() => setUpgradesOpen(!upgradesOpen)}
					onKeyDown={(e) => {
						if (e.key === "Enter") setUpgradesOpen(!upgradesOpen);
					}}
					role="button"
					tabIndex={0}
				>
					{upgradesOpen ? "▾" : "▸"} {t("sidebar.upgrades")}
				</div>
				{upgradesOpen &&
					tiers
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
					{milestonesOpen ? "▾" : "▸"} {t("sidebar.milestones")}
				</div>
				{milestonesOpen &&
					allMilestones
						.filter((m) => reachedMilestones.includes(m.id))
						.map((m) => {
							const isCash = m.metric === "totalCash";
							const color = isCash ? theme.cashColor : theme.locColor;
							return (
								<div
									key={m.id}
									css={milestoneCss}
									style={{ color: theme.success }}
								>
									{"✓ "}
									{t(`${m.id}.name`, { ns: "milestones" })}
									{" — "}
									<span style={{ color }}>
										{isCash ? "$" : ""}
										{formatNumber(m.threshold)}
										{isCash ? "" : " LoC"}
									</span>
								</div>
							);
						})}
			</div>
		</div>
	);
}
