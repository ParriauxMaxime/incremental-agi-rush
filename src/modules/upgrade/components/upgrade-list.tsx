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
				{upgrade.icon} {upgrade.name}
			</div>
			<div css={descStyle}>{upgrade.description}</div>
			<div css={costStyle}>{maxed ? "MAXED" : `$${formatNumber(cost)}`}</div>
			<div css={ownedStyle}>
				{upgrade.max === 1 ? (owned > 0 ? "✓" : "") : `${owned}/${upgrade.max}`}
			</div>
		</button>
	);
}

export function UpgradeList() {
	const currentTierIndex = useGameStore((s) => s.currentTierIndex);

	const availableTierIds = tiers
		.filter((t) => t.index <= currentTierIndex)
		.map((t) => t.id);

	const visibleUpgrades = allUpgrades.filter((u) =>
		availableTierIds.includes(u.tier),
	);

	return (
		<div>
			{visibleUpgrades.map((upgrade) => (
				<UpgradeCard key={upgrade.id} upgrade={upgrade} />
			))}
		</div>
	);
}
