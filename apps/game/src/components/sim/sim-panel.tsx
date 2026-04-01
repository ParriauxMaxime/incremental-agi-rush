import { css } from "@emotion/react";
import { BalanceSummaryTable } from "@flopsed/design-system";
import {
	aiModelsJson,
	balanceJson,
	eventsJson,
	milestonesJson,
	techTreeJson,
	tiersJson,
	upgradesJson,
} from "@flopsed/domain";
import {
	runBalanceSim as runBalanceSimCore,
	type SimConfig,
	type SimData,
	type SimResult,
} from "@flopsed/engine";
import { useCallback, useEffect, useRef, useState } from "react";
import { PurchaseDensity } from "./purchase-density";
import { SimChart } from "./sim-chart";
import { SimControls } from "./sim-controls";
import { SimEventLog } from "./sim-event-log";
import { SimSummary } from "./sim-summary";
import { TierTimeline } from "./tier-timeline";

const bundledData: SimData = {
	aiModels: aiModelsJson.models as SimData["aiModels"],
	balance: balanceJson as SimData["balance"],
	events: eventsJson as SimData["events"],
	techTree: techTreeJson as SimData["techTree"],
	tiers: tiersJson as SimData["tiers"],
	upgrades: upgradesJson as SimData["upgrades"],
	milestones: milestonesJson.milestones as SimData["milestones"],
};

function runBalanceSim(config?: Partial<SimConfig>) {
	return runBalanceSimCore(bundledData, config);
}

const sectionTitleCss = css({
	color: "#c678dd",
	fontSize: 13,
	fontWeight: "bold",
	margin: "16px 0 8px",
});

const passCss = css({
	color: "#3fb950",
	fontWeight: "bold",
	textAlign: "center",
	padding: "8px 0",
	fontSize: 14,
});

const failCss = css({
	color: "#e94560",
	fontWeight: "bold",
	textAlign: "center",
	padding: "8px 0",
	fontSize: 14,
});

const failuresCss = css({
	color: "#e94560",
	fontWeight: "bold",
	fontSize: 12,
	marginBottom: 8,
});

export function SimPanel({ autoRun = false }: { autoRun?: boolean }) {
	const [result, setResult] = useState<SimResult | null>(null);
	const [running, setRunning] = useState(false);
	const hasRun = useRef(false);

	const run = useCallback((config?: SimConfig) => {
		setRunning(true);
		requestAnimationFrame(() => {
			const r = runBalanceSim(config);
			setResult(r);
			setRunning(false);
		});
	}, []);

	useEffect(() => {
		if (autoRun && !hasRun.current) {
			hasRun.current = true;
			run();
		}
	}, [autoRun, run]);

	return (
		<div>
			<SimControls onRun={run} running={running} />

			{result && (
				<>
					<div css={result.passed ? passCss : failCss}>
						{result.passed ? "ALL CHECKS PASSED" : "BALANCE BROKEN"}
					</div>
					{result.failures.length > 0 && (
						<div css={failuresCss}>
							{result.failures.map((f) => (
								<div key={f}>{f}</div>
							))}
						</div>
					)}

					<SimSummary result={result} />

					<div css={sectionTitleCss}>Balance Summary</div>
					<BalanceSummaryTable result={result} />

					<div css={sectionTitleCss}>Purchase Density</div>
					<PurchaseDensity
						purchases={result.purchases}
						endTime={result.endTime}
					/>

					<div css={sectionTitleCss}>Tier Timeline</div>
					<TierTimeline tierTimes={result.tierTimes} endTime={result.endTime} />

					<div css={sectionTitleCss}>Cash Curve</div>
					<SimChart
						snapshots={result.snapshots}
						dataKey="cash"
						color="#3fb950"
						label="Total Cash ($)"
					/>

					<div css={sectionTitleCss}>LoC Curve</div>
					<SimChart
						snapshots={result.snapshots}
						dataKey="loc"
						color="#58a6ff"
						label="Total LoC"
					/>

					<div css={sectionTitleCss}>Event Log</div>
					<SimEventLog log={result.log} />
				</>
			)}
		</div>
	);
}
