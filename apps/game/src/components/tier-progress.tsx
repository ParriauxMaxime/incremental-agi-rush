import { css } from "@emotion/react";
import { tiers, useGameStore } from "@modules/game";
import { useTranslation } from "react-i18next";

const containerStyle = css({
	padding: "8px 16px",
	borderBottom: "1px solid #1e2630",
	background: "#0f1318",
	fontSize: 11,
	color: "#8be9fd",
	textTransform: "uppercase",
	letterSpacing: 1,
	textAlign: "center",
});

export function TierProgress() {
	const { t: tTiers } = useTranslation("tiers");
	const currentTierIndex = useGameStore((s) => s.currentTierIndex);
	const tier = tiers[currentTierIndex];

	return (
		<div css={containerStyle}>
			{tTiers(`${tier.id}.name`)} — {tTiers(`${tier.id}.tagline`)}
		</div>
	);
}
