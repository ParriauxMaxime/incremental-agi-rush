import { css } from "@emotion/react";
import type { StoreApi, UseBoundStore } from "zustand";
import {
	useAiModelsStore,
	useBalanceStore,
	useEventsStore,
	useMilestonesStore,
	useTechTreeStore,
	useTiersStore,
	useUpgradesStore,
} from "../store/data-store";
import { type PageEnum, useUiStore } from "../store/ui-store";

interface PageConfig {
	key: PageEnum;
	label: string;
	icon: string;
	store: UseBoundStore<StoreApi<{ dirty: boolean }>> | null;
}

const pages: PageConfig[] = [
	{ key: "tech_tree", label: "Tech Tree", icon: "\u{1F333}", store: useTechTreeStore },
	{ key: "upgrades", label: "Upgrades", icon: "\u{1F6D2}", store: useUpgradesStore },
	{ key: "ai_models", label: "AI Models", icon: "\u{1F916}", store: useAiModelsStore },
	{ key: "events", label: "Events", icon: "\u26A1", store: useEventsStore },
	{ key: "milestones", label: "Milestones", icon: "\u{1F3C6}", store: useMilestonesStore },
	{ key: "tiers", label: "Tiers", icon: "\u{1F4CA}", store: useTiersStore },
	{ key: "balance", label: "Balance", icon: "\u2696\uFE0F", store: useBalanceStore },
	{ key: "simulation", label: "Simulation", icon: "\u{1F9EA}", store: null },
];

const sidebarStyle = css`
	width: 220px;
	background: #16213e;
	border-right: 1px solid #2a2a35;
	padding: 16px;
	display: flex;
	flex-direction: column;
	gap: 4px;
	flex-shrink: 0;
`;

const headingStyle = css`
	font-size: 14px;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: #8892b0;
	margin-bottom: 12px;
	padding: 0 8px;
`;

const itemStyle = css`
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 12px;
	border-radius: 6px;
	cursor: pointer;
	color: #8892b0;
	font-size: 14px;
	border: none;
	background: none;
	width: 100%;
	text-align: left;
	transition: background 0.15s, color 0.15s;

	&:hover {
		background: rgba(255, 255, 255, 0.05);
	}
`;

const activeItemStyle = css`
	${itemStyle};
	background: #1a1a2e;
	color: #fff;

	&:hover {
		background: #1a1a2e;
	}
`;

const dirtyDotStyle = css`
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: #e94560;
	margin-left: auto;
	flex-shrink: 0;
`;

function SidebarItem({ config }: { config: PageConfig }) {
	const activePage = useUiStore((s) => s.activePage);
	const setPage = useUiStore((s) => s.setPage);
	const dirty = config.store ? config.store((s) => s.dirty) : false;
	const isActive = activePage === config.key;

	return (
		<button
			type="button"
			css={isActive ? activeItemStyle : itemStyle}
			onClick={() => setPage(config.key)}
		>
			<span>{config.icon}</span>
			<span>{config.label}</span>
			{dirty && <span css={dirtyDotStyle} />}
		</button>
	);
}

export function Sidebar() {
	return (
		<nav css={sidebarStyle}>
			<h2 css={headingStyle}>Editor</h2>
			{pages.map((page) => (
				<SidebarItem key={page.key} config={page} />
			))}
		</nav>
	);
}
