import { css } from "@emotion/react";
import { useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/shallow";

const containerCss = css({
	padding: "10px 16px",
	borderBottom: "1px solid #1e2630",
	background: "#0d1117",
});

const titleCss = css({
	fontSize: 10,
	color: "#6272a4",
	textTransform: "uppercase",
	letterSpacing: 1,
	marginBottom: 8,
});

const rowCss = css({
	display: "flex",
	alignItems: "center",
	gap: 8,
	marginBottom: 6,
	fontSize: 11,
});

const labelCss = css({
	color: "#8b949e",
	width: 52,
	flexShrink: 0,
});

const barBgCss = css({
	flex: 1,
	height: 8,
	background: "#161b22",
	borderRadius: 4,
	overflow: "hidden",
	position: "relative",
});

const barFillCss = css({
	height: "100%",
	borderRadius: 4,
	transition: "width 0.3s",
});

const valCss = css({
	width: 50,
	textAlign: "right",
	flexShrink: 0,
	fontFamily: "monospace",
	fontSize: 10,
});

const bottleneckCss = css({
	display: "flex",
	alignItems: "center",
	gap: 6,
	marginTop: 8,
	padding: "6px 8px",
	borderRadius: 4,
	fontSize: 11,
	fontWeight: "bold",
});

function HardwareBar({
	label,
	value,
	max,
	color,
	isBottleneck,
}: {
	label: string;
	value: number;
	max: number;
	color: string;
	isBottleneck: boolean;
}) {
	const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
	return (
		<div css={rowCss}>
			<span css={[labelCss, isBottleneck && { color: "#e5c07b" }]}>
				{label}
			</span>
			<div css={barBgCss}>
				<div
					css={barFillCss}
					style={{
						width: `${pct}%`,
						background: isBottleneck ? "#e5c07b" : color,
					}}
				/>
			</div>
			<span css={[valCss, { color }]}>{formatNumber(value)}</span>
		</div>
	);
}

export function BottleneckIndicator() {
	const { t } = useTranslation();
	const state = useGameStore(
		useShallow((s) => ({
			cpuFlops: s.cpuFlops,
			ramFlops: s.ramFlops,
			storageFlops: s.storageFlops,
			flops: s.flops,
			locPerKey: s.locPerKey,
			autoLocPerSec: s.autoLocPerSec,
			autoTypeEnabled: s.autoTypeEnabled,
		})),
	);

	const { cpuFlops, ramFlops, storageFlops, flops } = state;

	const hasHardware = cpuFlops > 0 || ramFlops > 0 || storageFlops > 0;
	const maxHw = Math.max(cpuFlops, ramFlops, storageFlops, 1);

	// Determine hardware bottleneck
	const cpuBottleneck = hasHardware && cpuFlops < ramFlops;
	const ramBottleneck = hasHardware && ramFlops < cpuFlops;

	// Determine execution bottleneck (LoC production vs FLOPS)
	// Manual typing ~6 keys/s, auto-type adds ~5 keys/s when enabled
	// Each keystroke produces locPerKey LoC
	// Devs (autoLocPerSec) produce LoC independently of keystrokes
	const manualKeysPerSec = 6;
	const autoTypeKeysPerSec = state.autoTypeEnabled ? 5 : 0;
	const keystrokeLocPerSec =
		state.locPerKey * (manualKeysPerSec + autoTypeKeysPerSec);
	const estLocPerSec = keystrokeLocPerSec + state.autoLocPerSec;
	const execBottlenecked = estLocPerSec > flops;

	// Nothing to show yet
	if (!hasHardware && !execBottlenecked) return null;

	return (
		<div css={containerCss}>
			{hasHardware && (
				<>
					<div css={titleCss}>{t("hardware.title")}</div>
					<HardwareBar
						label={t("hardware.cpu")}
						value={cpuFlops}
						max={maxHw}
						color="#61afef"
						isBottleneck={cpuBottleneck}
					/>
					<HardwareBar
						label={t("hardware.ram")}
						value={ramFlops}
						max={maxHw}
						color="#c678dd"
						isBottleneck={ramBottleneck}
					/>
					<HardwareBar
						label={t("hardware.disk")}
						value={storageFlops}
						max={maxHw}
						color="#98c379"
						isBottleneck={false}
					/>
					{(cpuBottleneck || ramBottleneck) && (
						<div
							css={[bottleneckCss, { background: "#2d2000", color: "#e5c07b" }]}
						>
							{cpuBottleneck ? t("hardware.cpu_bottleneck") : t("hardware.ram_bottleneck")}
							<span css={{ fontWeight: "normal", color: "#8b949e" }}>
								{t("hardware.formula", { cpu: formatNumber(cpuFlops), ram: formatNumber(ramFlops), storage: formatNumber(storageFlops) })}
							</span>
						</div>
					)}
				</>
			)}
			{execBottlenecked && (
				<div
					css={[
						bottleneckCss,
						{ background: "#1a0e0e", color: "#e06c75" },
						!hasHardware && { marginTop: 0 },
					]}
				>
					{t("hardware.flops_bottleneck")}
					<span css={{ fontWeight: "normal", color: "#8b949e" }}>
						{t("hardware.flops_detail", { flops: formatNumber(flops), locPerSec: formatNumber(estLocPerSec) })}
					</span>
				</div>
			)}
		</div>
	);
}
