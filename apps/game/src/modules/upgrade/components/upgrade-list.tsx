import { css } from "@emotion/react";
import type { Upgrade } from "@modules/game";
import {
	allUpgrades,
	getEffectiveMax,
	getUpgradeCost,
	tiers,
	useGameStore,
} from "@modules/game";
import { formatNumber } from "@utils/format";
import { useTranslation } from "react-i18next";

const upgradeStyle = css({
	display: "block",
	width: "100%",
	textAlign: "left",
	fontFamily: "inherit",
	fontSize: "inherit",
	color: "inherit",
	background: "#161b22",
	border: "1px solid #1e2630",
	borderRadius: 6,
	padding: 12,
	marginBottom: 8,
	cursor: "pointer",
	transition: "all 0.15s",
	position: "relative",
	"&:hover": { borderColor: "#58a6ff", background: "#1a2030" },
	"&:active:not(:disabled)": {
		transform: "scale(0.97)",
		background: "rgba(63, 185, 80, 0.15)",
		borderColor: "#3fb950",
		transition: "all 0.05s",
	},
});

const lockedStyle = css({
	opacity: 0.4,
	cursor: "default",
	"&:hover": { borderColor: "#1e2630", background: "#161b22" },
});

const maxedStyle = css({
	borderColor: "#3fb950",
	opacity: 0.6,
	cursor: "default",
	"&:hover": { borderColor: "#3fb950", background: "#161b22" },
});

const nameStyle = css({
	fontSize: 14,
	fontWeight: "bold",
	color: "#c9d1d9",
	marginBottom: 4,
});

const descStyle = css({
	fontSize: 12,
	color: "#6272a4",
	marginBottom: 6,
	lineHeight: 1.4,
});

const costStyle = css({
	fontSize: 12,
	color: "#d19a66",
});

const ownedStyle = css({
	position: "absolute",
	top: 12,
	right: 12,
	fontSize: 12,
	color: "#3fb950",
});

function UpgradeCard({ upgrade }: { upgrade: Upgrade }) {
	const { t } = useTranslation();
	const { t: tUpgrades } = useTranslation("upgrades");
	const cash = useGameStore((s) => s.cash);
	const owned = useGameStore((s) => s.ownedUpgrades[upgrade.id] ?? 0);
	const buyUpgrade = useGameStore((s) => s.buyUpgrade);
	const state = useGameStore((s) => s);

	const cost = getUpgradeCost(upgrade, owned, state);
	const effectiveMax = getEffectiveMax(upgrade, state);
	const canAfford = cash >= cost;
	const maxed = owned >= effectiveMax;

	return (
		<button
			type="button"
			css={[
				upgradeStyle,
				!canAfford && !maxed && lockedStyle,
				maxed && maxedStyle,
			]}
			onClick={() => {
				if (canAfford && !maxed) buyUpgrade(upgrade);
			}}
			disabled={maxed || !canAfford}
		>
			<div css={nameStyle}>
				{upgrade.icon} {tUpgrades(`${upgrade.id}.name`)}
			</div>
			<div css={descStyle}>{tUpgrades(`${upgrade.id}.description`)}</div>
			<div css={costStyle}>
				{maxed
					? t("upgrades.maxed")
					: t("upgrades.cost", { cost: formatNumber(cost) })}
			</div>
			<div css={ownedStyle}>
				{effectiveMax === 1
					? owned > 0
						? "✓"
						: ""
					: t("upgrades.count", { owned, max: effectiveMax })}
			</div>
		</button>
	);
}

export function UpgradeList() {
	const currentTierIndex = useGameStore((s) => s.currentTierIndex);
	const ownedTechNodes = useGameStore((s) => s.ownedTechNodes);

	const availableTierIds = tiers
		.filter((t) => t.index <= currentTierIndex)
		.map((t) => t.id);

	const state = useGameStore((s) => s);

	const visibleUpgrades = allUpgrades.filter(
		(u) =>
			availableTierIds.includes(u.tier) &&
			(!u.requires || u.requires.every((id) => (ownedTechNodes[id] ?? 0) > 0)),
	);

	const sorted = [...visibleUpgrades].sort((a, b) => {
		const aOwned = state.ownedUpgrades[a.id] ?? 0;
		const bOwned = state.ownedUpgrades[b.id] ?? 0;
		const aMaxed = aOwned >= getEffectiveMax(a, state) ? 1 : 0;
		const bMaxed = bOwned >= getEffectiveMax(b, state) ? 1 : 0;
		if (aMaxed !== bMaxed) return aMaxed - bMaxed;
		return getUpgradeCost(a, aOwned, state) - getUpgradeCost(b, bOwned, state);
	});

	return (
		<div>
			{sorted.map((upgrade) => (
				<UpgradeCard key={upgrade.id} upgrade={upgrade} />
			))}
		</div>
	);
}
