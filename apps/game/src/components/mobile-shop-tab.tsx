import { css } from "@emotion/react";
import { MilestoneList, UpgradeList } from "@modules/upgrade";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TierProgress } from "./tier-progress";

const containerCss = css({
	flex: 1,
	display: "flex",
	flexDirection: "column",
	overflow: "hidden",
	background: "#0d1117",
});

const toggleBarCss = css({
	display: "flex",
	borderBottom: "1px solid #1e2630",
	flexShrink: 0,
});

const toggleBtnCss = css({
	flex: 1,
	padding: "8px 0",
	background: "none",
	border: "none",
	borderBottom: "2px solid transparent",
	fontFamily: "inherit",
	fontSize: 12,
	color: "#484f58",
	cursor: "pointer",
});

const toggleActiveCss = css(toggleBtnCss, {
	color: "#c9d1d9",
	borderBottomColor: "#58a6ff",
});

const listCss = css({
	flex: 1,
	overflowY: "auto",
	padding: 12,
});

export function MobileShopTab() {
	const { t } = useTranslation();
	const [tab, setTab] = useState<"upgrades" | "milestones">("upgrades");

	return (
		<div css={containerCss}>
			<TierProgress />
			<div css={toggleBarCss}>
				<button
					type="button"
					css={tab === "upgrades" ? toggleActiveCss : toggleBtnCss}
					onClick={() => setTab("upgrades")}
				>
					{t("mobile.upgrades")}
				</button>
				<button
					type="button"
					css={tab === "milestones" ? toggleActiveCss : toggleBtnCss}
					onClick={() => setTab("milestones")}
				>
					{t("mobile.milestones")}
				</button>
			</div>
			<div css={listCss}>
				{tab === "upgrades" ? <UpgradeList /> : <MilestoneList />}
			</div>
		</div>
	);
}
