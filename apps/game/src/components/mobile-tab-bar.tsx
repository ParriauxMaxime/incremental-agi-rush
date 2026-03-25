import { css } from "@emotion/react";

export const MobileTabEnum = {
	code: "code",
	tree: "tree",
	shop: "shop",
} as const;

export type MobileTabEnum = (typeof MobileTabEnum)[keyof typeof MobileTabEnum];

interface MobileTabBarProps {
	activeTab: MobileTabEnum;
	onTabChange: (tab: MobileTabEnum) => void;
}

const tabs = [
	{ key: MobileTabEnum.code, label: "Code", icon: "⌨️" },
	{ key: MobileTabEnum.tree, label: "Tree", icon: "🌳" },
	{ key: MobileTabEnum.shop, label: "Shop", icon: "🛒" },
];

const barStyle = css({
	position: "fixed",
	bottom: 0,
	left: 0,
	right: 0,
	display: "flex",
	flexDirection: "row",
	background: "#0d1117",
	borderTop: "1px solid #1e2630",
	zIndex: 100,
});

const tabButtonBase = css({
	flex: 1,
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	gap: 2,
	padding: "8px 0",
	background: "none",
	border: "none",
	fontFamily: "inherit",
	cursor: "pointer",
});

const activeTabStyle = css({
	borderTop: "2px solid #58a6ff",
	color: "#c9d1d9",
});

const inactiveTabStyle = css({
	color: "#484f58",
});

const iconStyle = css({
	fontSize: 16,
});

const labelStyle = css({
	fontSize: 10,
});

export function MobileTabBar({ activeTab, onTabChange }: MobileTabBarProps) {
	return (
		<div css={barStyle}>
			{tabs.map((tab) => (
				<button
					key={tab.key}
					type="button"
					css={[
						tabButtonBase,
						tab.key === activeTab ? activeTabStyle : inactiveTabStyle,
					]}
					onClick={() => onTabChange(tab.key)}
				>
					<span css={iconStyle}>{tab.icon}</span>
					<span css={labelStyle}>{tab.label}</span>
				</button>
			))}
		</div>
	);
}
