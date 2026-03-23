import { css } from "@emotion/react";
import { match } from "ts-pattern";
import { Sidebar } from "./components/sidebar";
import { ToastContainer } from "./components/toast";
import { UpgradesPage } from "./pages/upgrades/upgrades-page";
import { PageEnum, useUiStore } from "./store/ui-store";

const containerStyle = css`
	display: flex;
	height: 100vh;
	width: 100vw;
`;

const mainStyle = css`
	flex: 1;
	padding: 24px;
	overflow: auto;
`;

const stubStyle = css`
	color: #777;
	font-size: 16px;
`;

function PageContent() {
	const activePage = useUiStore((s) => s.activePage);

	return match(activePage)
		.with(PageEnum.tech_tree, () => <div css={stubStyle}>Tech Tree coming soon</div>)
		.with(PageEnum.upgrades, () => <UpgradesPage />)
		.with(PageEnum.ai_models, () => <div css={stubStyle}>AI Models coming soon</div>)
		.with(PageEnum.events, () => <div css={stubStyle}>Events coming soon</div>)
		.with(PageEnum.milestones, () => (
			<div css={stubStyle}>Milestones coming soon</div>
		))
		.with(PageEnum.tiers, () => <div css={stubStyle}>Tiers coming soon</div>)
		.with(PageEnum.balance, () => <div css={stubStyle}>Balance coming soon</div>)
		.with(PageEnum.simulation, () => (
			<div css={stubStyle}>Simulation coming soon</div>
		))
		.exhaustive();
}

export function App() {
	return (
		<div css={containerStyle}>
			<Sidebar />
			<main css={mainStyle}>
				<PageContent />
			</main>
			<ToastContainer />
		</div>
	);
}
