import { css } from "@emotion/react";
import { runBalanceSim } from "@shared/balance-sim";
import type { SimConfig, SimData, SimResult } from "@shared/types";
import { useCallback, useState } from "react";
import { type BalanceCheckResult, fetchData, runBalanceCheck } from "../../api/client";
import { CliOutput } from "./cli-output";
import { SimControls } from "./sim-controls";
import { SimResults } from "./sim-results";

const titleCss = css({
	fontSize: 22,
	fontWeight: "bold",
	color: "#e0e0e0",
	marginBottom: 20,
});

const errorCss = css({
	color: "#e94560",
	background: "rgba(233, 69, 96, 0.1)",
	border: "1px solid #e94560",
	borderRadius: 6,
	padding: 12,
	marginBottom: 16,
	fontSize: 13,
});

async function fetchSimData(): Promise<SimData> {
	const [aiModels, balance, events, techTree, tiers, upgrades] =
		await Promise.all([
			fetchData<SimData["aiModels"]>("ai-models"),
			fetchData<SimData["balance"]>("balance"),
			fetchData<SimData["events"]>("events"),
			fetchData<SimData["techTree"]>("tech-tree"),
			fetchData<SimData["tiers"]>("tiers"),
			fetchData<SimData["upgrades"]>("upgrades"),
		]);
	return { aiModels, balance, events, techTree, tiers, upgrades };
}

export function SimulationPage() {
	const [simResult, setSimResult] = useState<SimResult | null>(null);
	const [cliResult, setCliResult] = useState<BalanceCheckResult | null>(null);
	const [running, setRunning] = useState(false);
	const [cliRunning, setCliRunning] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleRun = useCallback(async (config: SimConfig) => {
		setRunning(true);
		setError(null);
		try {
			const data = await fetchSimData();
			const result = runBalanceSim(data, config);
			setSimResult(result);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Simulation failed");
		} finally {
			setRunning(false);
		}
	}, []);

	const handleCliCheck = useCallback(async () => {
		setCliRunning(true);
		setError(null);
		try {
			const result = await runBalanceCheck();
			setCliResult(result);
		} catch (e) {
			setError(e instanceof Error ? e.message : "CLI check failed");
		} finally {
			setCliRunning(false);
		}
	}, []);

	return (
		<div>
			<div css={titleCss}>Balance Simulation</div>
			<SimControls
				onRun={handleRun}
				onCliCheck={handleCliCheck}
				running={running}
				cliRunning={cliRunning}
			/>
			{error && <div css={errorCss}>{error}</div>}
			{simResult && <SimResults result={simResult} />}
			{cliResult && <CliOutput result={cliResult} />}
		</div>
	);
}
