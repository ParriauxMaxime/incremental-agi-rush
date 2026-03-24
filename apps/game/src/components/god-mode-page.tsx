import { css } from "@emotion/react";
import type { GodModeOverrides } from "@modules/game";
import { tiers, useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { useShallow } from "zustand/shallow";
import { ResourceBar } from "./resource-bar";
import { SimPanel } from "./sim";

const pageCss = css({
	display: "flex",
	flexDirection: "column",
	height: "100%",
	overflow: "hidden",
	background: "#0a0e14",
	color: "#c5c8c6",
	fontFamily: "'Courier New', monospace",
	fontSize: 12,
});

const contentCss = css({
	display: "flex",
	flex: 1,
	overflow: "hidden",
	gap: 1,
});

const cheatColumnCss = css({
	flex: "0 0 320px",
	padding: 16,
	overflowY: "auto",
});

const simColumnCss = css({
	flex: 1,
	padding: 16,
	overflowY: "auto",
	borderLeft: "1px solid #1e2630",
});

const headingCss = css({
	fontSize: 14,
	color: "#e94560",
	textTransform: "uppercase",
	letterSpacing: 1,
	marginBottom: 12,
	fontWeight: "bold",
});

const rowCss = css({
	display: "flex",
	alignItems: "center",
	gap: 6,
	marginBottom: 6,
});

const labelCss = css({
	color: "#aaa",
	width: 72,
	flexShrink: 0,
});

const valueCss = css({
	color: "#6f6",
	width: 80,
	textAlign: "right",
	flexShrink: 0,
});

const bumpBtnCss = css({
	background: "#0f0f23",
	color: "#e94560",
	border: "1px solid #333",
	padding: "3px 8px",
	cursor: "pointer",
	fontFamily: "monospace",
	fontSize: 10,
	"&:hover": {
		background: "#e94560",
		color: "#fff",
	},
	"&:active": {
		background: "#c7354e",
	},
});

const resetBtnCss = css({
	background: "#0f0f23",
	color: "#e94560",
	border: "1px solid #e94560",
	padding: "6px 12px",
	cursor: "pointer",
	fontFamily: "monospace",
	fontSize: 11,
	width: "100%",
	marginTop: 12,
	"&:hover": {
		background: "#e94560",
		color: "#fff",
	},
});

function formatShort(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
	return n.toString();
}

interface FieldConfig {
	key: keyof GodModeOverrides;
	label: string;
	bumps: number[];
}

const resourceFields: FieldConfig[] = [
	{ key: "cash", label: "Cash", bumps: [100, 1_000, 10_000, 100_000] },
	{ key: "totalCash", label: "Tot. Cash", bumps: [1_000, 10_000, 100_000] },
	{ key: "loc", label: "LoC", bumps: [100, 1_000, 10_000] },
	{ key: "totalLoc", label: "Tot. LoC", bumps: [1_000, 10_000, 100_000] },
	{ key: "flops", label: "FLOPS", bumps: [10, 100, 1_000] },
];

function CheatsPanel() {
	const godSet = useGameStore((s) => s.godSet);
	const reset = useGameStore((s) => s.reset);
	const state = useGameStore(
		useShallow((s) => ({
			cash: s.cash,
			totalCash: s.totalCash,
			loc: s.loc,
			totalLoc: s.totalLoc,
			flops: s.flops,
			currentTierIndex: s.currentTierIndex,
			flopSlider: s.flopSlider,
			unlockedModels: s.unlockedModels,
		})),
	);

	const bump = (key: keyof GodModeOverrides, amount: number) => {
		godSet({ [key]: (state[key] ?? 0) + amount });
	};

	return (
		<div>
			{resourceFields.map((f) => (
				<div css={rowCss} key={f.key}>
					<span css={labelCss}>{f.label}</span>
					<span css={valueCss}>{formatNumber(state[f.key] ?? 0)}</span>
					{f.bumps.map((amt) => (
						<button
							css={bumpBtnCss}
							type="button"
							key={amt}
							onClick={() => bump(f.key, amt)}
						>
							+{formatShort(amt)}
						</button>
					))}
				</div>
			))}
			<div css={rowCss}>
				<span css={labelCss}>Tier</span>
				<span css={valueCss}>{state.currentTierIndex}</span>
				<button
					css={bumpBtnCss}
					type="button"
					onClick={() =>
						godSet({
							currentTierIndex: Math.max(0, state.currentTierIndex - 1),
						})
					}
				>
					-1
				</button>
				<button
					css={bumpBtnCss}
					type="button"
					onClick={() =>
						godSet({
							currentTierIndex: Math.min(
								tiers.length - 1,
								state.currentTierIndex + 1,
							),
						})
					}
				>
					+1
				</button>
			</div>
			<div css={[headingCss, { marginTop: 12 }]}>AI Models</div>
			<div css={rowCss}>
				<span css={labelCss}>Slider</span>
				<span css={valueCss}>{Math.round(state.flopSlider * 100)}%</span>
			</div>
			{["copilot", "claude_haiku", "claude_sonnet"].map((id) => (
				<div css={rowCss} key={id}>
					<span css={labelCss}>{id}</span>
					<span css={valueCss}>
						{state.unlockedModels[id] ? "\u2713" : "\u2014"}
					</span>
					<button
						css={bumpBtnCss}
						type="button"
						onClick={() => {
							const current = useGameStore.getState();
							useGameStore.setState({
								unlockedModels: {
									...current.unlockedModels,
									[id]: true,
								},
							});
							useGameStore.getState().recalc();
						}}
					>
						Grant
					</button>
				</div>
			))}
			<button
				css={resetBtnCss}
				type="button"
				onClick={() => {
					reset();
					window.location.reload();
				}}
			>
				Reset Game
			</button>
			<button
				css={[
					resetBtnCss,
					{
						borderColor: "#d4a574",
						color: "#d4a574",
						"&:hover": { background: "#d4a574", color: "#fff" },
					},
				]}
				type="button"
				onClick={() => {
					const current = useGameStore.getState();
					useGameStore.setState({
						ownedUpgrades: {
							...current.ownedUpgrades,
							the_singularity: 1,
						},
					});
					useGameStore.getState().recalc();
				}}
			>
				Trigger Singularity
			</button>
		</div>
	);
}

export function GodModePage() {
	return (
		<div css={pageCss}>
			<ResourceBar />
			<div css={contentCss}>
				<div css={cheatColumnCss}>
					<div css={headingCss}>Cheats</div>
					<CheatsPanel />
					<div
						css={{ marginTop: 12, borderTop: "1px solid #333", paddingTop: 12 }}
					>
						<div css={headingCss}>Tools</div>
						<a
							href="http://localhost:3738"
							target="_blank"
							rel="noreferrer"
							css={{
								display: "block",
								fontFamily: "inherit",
								fontSize: 11,
								padding: "6px 12px",
								border: "1px solid #c678dd",
								borderRadius: 4,
								background: "#0f0f23",
								color: "#c678dd",
								textDecoration: "none",
								textAlign: "center",
								"&:hover": { background: "#c678dd", color: "#fff" },
							}}
						>
							Tech Tree Editor
						</a>
						<a
							href="http://localhost:3738"
							target="_blank"
							rel="noreferrer"
							css={{
								display: "block",
								fontFamily: "inherit",
								fontSize: 11,
								padding: "6px 12px",
								marginTop: 6,
								border: "1px solid #d19a66",
								borderRadius: 4,
								background: "#0f0f23",
								color: "#d19a66",
								textDecoration: "none",
								textAlign: "center",
								"&:hover": { background: "#d19a66", color: "#fff" },
							}}
						>
							Item Pool Editor
						</a>
					</div>
				</div>
				<div css={simColumnCss}>
					<div css={headingCss}>Balance Simulation</div>
					<SimPanel autoRun />
				</div>
			</div>
		</div>
	);
}
