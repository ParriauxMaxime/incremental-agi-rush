import { css } from "@emotion/react";
import { useGameStore } from "@modules/game";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useIdeTheme } from "../hooks/use-ide-theme";

const TIER_COLORS = [
	"#6272a4",
	"#8be9fd",
	"#3fb950",
	"#d19a66",
	"#c678dd",
	"#e94560",
];

const barCss = css({
	display: "flex",
	height: 22,
	borderRadius: 4,
	overflow: "hidden",
});

const segCss = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	fontSize: 9,
	fontWeight: 600,
	position: "relative",
	transition: "width 0.3s",
});

function formatElapsed(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

export function StatsTierBar() {
	const { t } = useTranslation();
	const theme = useIdeTheme();
	const tierTransitions = useGameStore((s) => s.tierTransitions);
	const sessionStartTime = useGameStore((s) => s.sessionStartTime);

	const elapsed = (performance.now() - sessionStartTime) / 1000;

	const tierDurations = useMemo(() => {
		const durations: Array<{ tierIndex: number; duration: number }> = [];
		for (let i = 0; i < tierTransitions.length; i++) {
			const start = tierTransitions[i].enteredAt;
			const end = tierTransitions[i + 1]?.enteredAt ?? elapsed;
			durations.push({
				tierIndex: tierTransitions[i].tierIndex,
				duration: end - start,
			});
		}
		return durations;
	}, [tierTransitions, elapsed]);

	return (
		<div style={{ padding: "8px 14px 4px" }}>
			<div
				style={{
					fontSize: 10,
					textTransform: "uppercase",
					letterSpacing: 0.5,
					color: theme.lineNumbers,
					marginBottom: 6,
				}}
			>
				{t("stats_panel.tier_progression")}
			</div>
			<div css={barCss} style={{ border: `1px solid ${theme.border}` }}>
				{tierDurations.map((td, i) => {
					const pct = elapsed > 0 ? (td.duration / elapsed) * 100 : 0;
					const isLast = i === tierDurations.length - 1;
					return (
						<div
							key={td.tierIndex}
							css={segCss}
							style={{
								width: `${Math.max(pct, 2)}%`,
								background: TIER_COLORS[td.tierIndex],
								color: td.tierIndex <= 1 ? "#c9d1d9" : "rgba(0,0,0,0.7)",
								...(isLast
									? { animation: "tier-pulse 2s ease-in-out infinite" }
									: {}),
							}}
						>
							{pct > 8 && <span>T{td.tierIndex}</span>}
							{pct > 15 && (
								<span
									style={{
										position: "absolute",
										bottom: 1,
										right: 3,
										fontSize: 7,
										opacity: 0.7,
									}}
								>
									{formatElapsed(td.duration)}
								</span>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
