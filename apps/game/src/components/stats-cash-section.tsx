import { useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";
import { CollapsibleSection } from "./collapsible-section";
import { RollingNumber } from "./rolling-number";
import { Sparkline } from "./sparkline";

export function StatsCashSection() {
	const { t } = useTranslation();
	const theme = useIdeTheme();
	const cash = useGameStore((s) => s.cash);
	const graphsUnlocked = useGameStore(
		(s) => (s.ownedTechNodes.unlock_perf_graphs ?? 0) > 0,
	);
	const rateSnapshots = useGameStore((s) => s.rateSnapshots);
	const tierTransitions = useGameStore((s) => s.tierTransitions);
	const sessionStartTime = useGameStore((s) => s.sessionStartTime);

	const elapsed = (performance.now() - sessionStartTime) / 1000;
	const cashData = useMemo(
		() => rateSnapshots.map((s) => s.cashPerSec),
		[rateSnapshots],
	);
	const latest = rateSnapshots[rateSnapshots.length - 1];

	return (
		<CollapsibleSection
			icon={<span style={{ color: theme.cashColor }}>$</span>}
			label={t("stats_panel.cash")}
			value={
				<RollingNumber
					value={`$${formatNumber(cash, true)}`}
					color={theme.cashColor}
				/>
			}
			collapsible={graphsUnlocked}
			defaultOpen={false}
		>
			{latest && (
				<div>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							fontSize: 10,
							color: theme.textMuted,
							marginBottom: 4,
						}}
					>
						<span>$/s</span>
						<span style={{ color: theme.cashColor }}>
							${formatNumber(latest.cashPerSec, true)}/s
						</span>
					</div>
					<Sparkline
						data={cashData}
						color={theme.cashColor ?? "#e5c07b"}
						tierTransitions={tierTransitions}
						totalTime={elapsed}
					/>
				</div>
			)}
		</CollapsibleSection>
	);
}
