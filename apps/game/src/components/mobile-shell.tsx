import { css } from "@emotion/react";
import { TapToCode } from "@modules/editor";
import { useGameStore } from "@modules/game";
import { useCallback, useEffect, useState } from "react";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { MobileResourceBar } from "./mobile-resource-bar";
import { MobileSettingsOverlay } from "./mobile-settings-overlay";
import { MobileShopTab } from "./mobile-shop-tab";
import { MobileTabBar, MobileTabEnum } from "./mobile-tab-bar";
import { TechTreePage } from "./tech-tree-page";

const shellCss = css({
	display: "flex",
	flexDirection: "column",
	height: "100vh",
	overflow: "hidden",
	background: "#0a0e14",
	color: "#c5c8c6",
	fontFamily: "'Courier New', monospace",
});

const contentCss = css({
	flex: 1,
	display: "flex",
	flexDirection: "column",
	overflow: "hidden",
});

export function MobileShell() {
	const [activeTab, setActiveTab] = useState<MobileTabEnum>(MobileTabEnum.code);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const theme = useIdeTheme();

	const handleKeystroke = useCallback(() => {}, []);

	// Auto-run on mobile — no Run/Stop button
	useEffect(() => {
		const state = useGameStore.getState();
		if (!state.running) {
			state.toggleRunning();
		}
	}, []);

	return (
		<div css={shellCss}>
			<MobileResourceBar onOpenSettings={() => setSettingsOpen(true)} />
			<div css={contentCss}>
				{activeTab === MobileTabEnum.code && (
					<TapToCode theme={theme} onKeystroke={handleKeystroke} />
				)}
				{activeTab === MobileTabEnum.tree && <TechTreePage />}
				{activeTab === MobileTabEnum.shop && <MobileShopTab />}
			</div>
			<MobileTabBar activeTab={activeTab} onTabChange={setActiveTab} />
			{settingsOpen && (
				<MobileSettingsOverlay onClose={() => setSettingsOpen(false)} />
			)}
		</div>
	);
}
