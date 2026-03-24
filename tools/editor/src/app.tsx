import { css } from "@emotion/react";
import { match } from "ts-pattern";
import { Sidebar } from "./components/sidebar";
import { ToastContainer } from "./components/toast";
import { AiModelsPage } from "./pages/ai-models/ai-models-page";
import { BalancePage } from "./pages/balance/balance-page";
import { EventsPage } from "./pages/events/events-page";
import { MilestonesPage } from "./pages/milestones/milestones-page";
import { SimulationPage } from "./pages/simulation/simulation-page";
import { TechTreePage } from "./pages/tech-tree/tech-tree-page";
import { TiersPage } from "./pages/tiers/tiers-page";
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


function PageContent() {
	const activePage = useUiStore((s) => s.activePage);

	return match(activePage)
		.with(PageEnum.tech_tree, () => <TechTreePage />)
		.with(PageEnum.upgrades, () => <UpgradesPage />)
		.with(PageEnum.ai_models, () => <AiModelsPage />)
		.with(PageEnum.events, () => <EventsPage />)
		.with(PageEnum.milestones, () => <MilestonesPage />)
		.with(PageEnum.tiers, () => <TiersPage />)
		.with(PageEnum.balance, () => <BalancePage />)
		.with(PageEnum.simulation, () => <SimulationPage />)
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
