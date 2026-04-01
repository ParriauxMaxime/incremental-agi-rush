import { music, useAudioStore } from "@modules/audio";
import { allEvents, useEventStore } from "@modules/event";
import type { GodModeOverrides } from "@modules/game";
import {
	allTechNodes,
	allUpgrades,
	getEffectiveMax,
	tiers,
	useGameStore,
	useUiStore,
} from "@modules/game";
import { formatNumber } from "@utils/format";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/shallow";
import { useIdeTheme } from "../hooks/use-ide-theme";

// ── Helpers ──

function formatShort(n: number): string {
	if (n >= 1e12) return `${(n / 1e12).toFixed(0)}T`;
	if (n >= 1e9) return `${(n / 1e9).toFixed(0)}B`;
	if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
	if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
	return n.toString();
}

const stdBumps = [1_000, 1_000_000, 1_000_000_000, 1_000_000_000_000];

// ── Collapsible section ──

const GOD_MODE_STORAGE_KEY = "flopsed-godmode-sections";

function readSectionState(id: string, defaultOpen: boolean): boolean {
	try {
		const raw = localStorage.getItem(GOD_MODE_STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (id in parsed) return parsed[id] as boolean;
		}
	} catch {
		// ignore
	}
	return defaultOpen;
}

function writeSectionState(id: string, open: boolean) {
	try {
		const raw = localStorage.getItem(GOD_MODE_STORAGE_KEY);
		const parsed = raw ? JSON.parse(raw) : {};
		parsed[id] = open;
		localStorage.setItem(GOD_MODE_STORAGE_KEY, JSON.stringify(parsed));
	} catch {
		// ignore
	}
}

function Section({
	title,
	defaultOpen = true,
	children,
}: {
	title: string;
	defaultOpen?: boolean;
	children: React.ReactNode;
}) {
	const theme = useIdeTheme();
	const [open, setOpen] = useState(() => readSectionState(title, defaultOpen));

	const toggle = () => {
		const next = !open;
		setOpen(next);
		writeSectionState(title, next);
	};

	return (
		<div css={{ borderBottom: `1px solid ${theme.border}` }}>
			<button
				type="button"
				css={{
					display: "flex",
					alignItems: "center",
					gap: 6,
					width: "100%",
					padding: "8px 16px",
					background: "none",
					border: "none",
					color: theme.foreground,
					fontSize: 13,
					fontWeight: 600,
					fontFamily: "inherit",
					cursor: "pointer",
					textAlign: "left",
					"&:hover": { background: theme.hoverBg },
				}}
				onClick={toggle}
			>
				<span css={{ fontSize: 10, width: 12 }}>{open ? "▾" : "▸"}</span>
				{title}
			</button>
			{open && <div css={{ padding: "4px 16px 12px 34px" }}>{children}</div>}
		</div>
	);
}

// ── Bump button ──

function BumpBtn({ label, onClick }: { label: string; onClick: () => void }) {
	const theme = useIdeTheme();
	return (
		<button
			type="button"
			css={{
				background: "none",
				border: `1px solid ${theme.border}`,
				borderRadius: 3,
				color: theme.foreground,
				padding: "2px 8px",
				fontSize: 11,
				fontFamily: "inherit",
				cursor: "pointer",
				"&:hover": {
					borderColor: theme.accent,
					color: theme.accent,
				},
			}}
			onClick={onClick}
		>
			{label}
		</button>
	);
}

// ── Stem mixer (god mode audio testing) ──

function StemMixer() {
	const theme = useIdeTheme();
	const musicStyle = useAudioStore((s) => s.musicStyle);
	const packStems = music.getPackStems();
	const [enabledStems, setEnabledStems] = useState<Record<string, boolean>>(
		() => {
			const init: Record<string, boolean> = {};
			for (const s of packStems) init[s] = false;
			return init;
		},
	);

	const toggle = (name: string) => {
		const next = !enabledStems[name];
		setEnabledStems((prev) => ({ ...prev, [name]: next }));
		music.setStemGain(name, next);
	};

	const allOn = () => {
		const next: Record<string, boolean> = {};
		for (const s of packStems) {
			next[s] = true;
			music.setStemGain(s, true);
		}
		setEnabledStems(next);
	};

	const allOff = () => {
		const next: Record<string, boolean> = {};
		for (const s of packStems) {
			next[s] = false;
			music.setStemGain(s, false);
		}
		setEnabledStems(next);
	};

	return (
		<Section title={`Stems — ${musicStyle}`} defaultOpen>
			<div css={{ display: "flex", gap: 6, marginBottom: 8 }}>
				<BumpBtn label="All on" onClick={allOn} />
				<BumpBtn label="All off" onClick={allOff} />
			</div>
			<div css={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
				{packStems.map((name) => (
					<label
						key={name}
						css={{
							display: "flex",
							alignItems: "center",
							gap: 6,
							padding: "6px 12px",
							borderRadius: 4,
							border: `1px solid ${enabledStems[name] ? theme.accent : theme.border}`,
							background: enabledStems[name]
								? `${theme.accent}18`
								: "transparent",
							cursor: "pointer",
							fontSize: 12,
							transition: "all 0.15s",
							"&:hover": { borderColor: theme.accent },
						}}
					>
						<input
							type="checkbox"
							checked={enabledStems[name] ?? false}
							onChange={() => toggle(name)}
							css={{ accentColor: theme.accent, cursor: "pointer" }}
						/>
						<span
							style={{
								color: enabledStems[name] ? theme.foreground : theme.textMuted,
							}}
						>
							{name}
						</span>
					</label>
				))}
			</div>
		</Section>
	);
}

// ── Main page ──

export function GodModePage() {
	const theme = useIdeTheme();
	const { t } = useTranslation();
	const godSet = useGameStore((s) => s.godSet);
	const reset = useGameStore((s) => s.reset);
	const resetAll = useUiStore((s) => s.resetAll);
	const recalc = useGameStore((s) => s.recalc);
	const state = useGameStore(
		useShallow((s) => ({
			cash: s.cash,
			totalCash: s.totalCash,
			loc: s.loc,
			totalLoc: s.totalLoc,
			tokens: s.tokens,
			totalTokens: s.totalTokens,
			flops: s.flops,
			currentTierIndex: s.currentTierIndex,
			unlockedModels: s.unlockedModels,
		})),
	);

	const bump = (key: keyof GodModeOverrides, amount: number) => {
		const current = useGameStore.getState();
		const val = (current[key] ?? 0) as number;
		godSet({ [key]: val + amount });
	};

	const resourceRows: Array<{
		key: keyof GodModeOverrides;
		label: string;
		color: string;
		bumps: number[];
	}> = [
		{
			key: "cash",
			label: t("god_mode.cash"),
			color: theme.cashColor,
			bumps: stdBumps,
		},
		{
			key: "totalCash",
			label: t("god_mode.total_cash"),
			color: theme.cashColor,
			bumps: stdBumps,
		},
		{
			key: "loc",
			label: t("god_mode.loc"),
			color: theme.locColor,
			bumps: stdBumps,
		},
		{
			key: "totalLoc",
			label: t("god_mode.total_loc"),
			color: theme.locColor,
			bumps: stdBumps,
		},
		{
			key: "flops",
			label: t("god_mode.flops"),
			color: theme.flopsColor,
			bumps: [100, 1_000, 10_000, 100_000],
		},
		{
			key: "tokens",
			label: t("god_mode.tokens"),
			color: "#d4a574",
			bumps: [1_000, 100_000, 10_000_000],
		},
	];

	return (
		<div
			css={{
				flex: 1,
				overflowY: "auto",
				background: theme.background,
				color: theme.foreground,
				fontSize: 13,
				"&::-webkit-scrollbar": { width: 6 },
				"&::-webkit-scrollbar-track": { background: "transparent" },
				"&::-webkit-scrollbar-thumb": {
					background: theme.scrollThumb,
					borderRadius: 3,
				},
			}}
		>
			<div css={{ padding: "16px 16px 8px", fontSize: 24, fontWeight: 300 }}>
				{t("god_mode.title")}
			</div>

			<Section title={t("god_mode.resources")}>
				<div css={{ display: "flex", flexDirection: "column", gap: 8 }}>
					{resourceRows.map((r) => (
						<div
							key={r.key}
							css={{
								display: "flex",
								alignItems: "center",
								gap: 12,
								padding: "8px 12px",
								borderRadius: 6,
								border: `1px solid ${theme.border}`,
								background: `${r.color}08`,
							}}
						>
							<div css={{ flex: "0 0 80px" }}>
								<div
									css={{
										fontSize: 11,
										color: theme.textMuted,
										marginBottom: 2,
									}}
								>
									{r.label}
								</div>
								<div
									css={{
										fontSize: 20,
										fontWeight: 700,
										fontVariantNumeric: "tabular-nums",
										letterSpacing: -0.5,
									}}
									style={{ color: r.color }}
								>
									{formatNumber(state[r.key] ?? 0)}
								</div>
							</div>
							<div
								css={{
									display: "flex",
									gap: 4,
									flexWrap: "wrap",
									marginLeft: "auto",
								}}
							>
								{r.bumps.map((amt) => (
									<button
										key={amt}
										type="button"
										css={{
											background: "none",
											border: `1px solid ${r.color}44`,
											borderRadius: 3,
											color: r.color,
											padding: "4px 10px",
											fontSize: 11,
											fontFamily: "inherit",
											cursor: "pointer",
											fontWeight: 600,
											transition: "all 0.15s",
											"&:hover": {
												background: r.color,
												color: theme.background,
												borderColor: r.color,
											},
										}}
										onClick={() => bump(r.key, amt)}
									>
										+{formatShort(amt)}
									</button>
								))}
							</div>
						</div>
					))}
				</div>
			</Section>

			<Section title={t("god_mode.tier")}>
				<div css={{ display: "flex", alignItems: "center", gap: 8 }}>
					<span css={{ color: theme.textMuted }}>{t("god_mode.current")}</span>
					<span css={{ fontWeight: 600 }}>
						{tiers[state.currentTierIndex]?.name ?? "—"} (T
						{state.currentTierIndex})
					</span>
					<BumpBtn
						label="−1"
						onClick={() =>
							godSet({
								currentTierIndex: Math.max(0, state.currentTierIndex - 1),
							})
						}
					/>
					<BumpBtn
						label="+1"
						onClick={() =>
							godSet({
								currentTierIndex: Math.min(
									tiers.length - 1,
									state.currentTierIndex + 1,
								),
							})
						}
					/>
				</div>
			</Section>

			<Section title={t("god_mode.ai_models")} defaultOpen={false}>
				{["copilot", "claude_haiku", "claude_sonnet", "openai_gpt3"].map(
					(id) => (
						<div
							key={id}
							css={{
								display: "flex",
								alignItems: "center",
								gap: 8,
								marginBottom: 4,
							}}
						>
							<span css={{ width: 120, color: theme.textMuted }}>{id}</span>
							<span
								css={{ width: 20 }}
								style={{
									color: state.unlockedModels[id]
										? theme.success
										: theme.textMuted,
								}}
							>
								{state.unlockedModels[id] ? "✓" : "—"}
							</span>
							{!state.unlockedModels[id] && (
								<BumpBtn
									label={t("god_mode.grant")}
									onClick={() => {
										const current = useGameStore.getState();
										useGameStore.setState({
											unlockedModels: {
												...current.unlockedModels,
												[id]: true,
											},
										});
										recalc();
									}}
								/>
							)}
						</div>
					),
				)}
			</Section>

			<Section title={t("god_mode.tools")} defaultOpen={false}>
				<div css={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
					<a
						href="http://localhost:3738"
						target="_blank"
						rel="noreferrer"
						css={{
							fontSize: 12,
							padding: "6px 14px",
							border: `1px solid ${theme.accent}`,
							borderRadius: 3,
							color: theme.accent,
							textDecoration: "none",
							"&:hover": { background: theme.accent, color: theme.background },
						}}
					>
						{t("god_mode.data_editor")}
					</a>
				</div>
			</Section>

			<Section title="Events" defaultOpen={false}>
				<div css={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
					{allEvents.map((ev) => (
						<button
							key={ev.id}
							type="button"
							css={{
								fontSize: 11,
								padding: "4px 10px",
								border: `1px solid ${theme.border}`,
								borderRadius: 3,
								background: "transparent",
								color: theme.foreground,
								cursor: "pointer",
								fontFamily: "inherit",
								"&:hover": {
									background: theme.border,
								},
							}}
							onClick={() => {
								const gs = useGameStore.getState();
								useEventStore.getState().spawnEvent(ev.id, {
									currentCash: gs.cash,
									currentLoc: gs.loc,
									currentLocPerSec: gs.autoLocPerSec,
								});
							}}
						>
							{ev.icon} {ev.name}
						</button>
					))}
				</div>
			</Section>

			<StemMixer />

			<Section title={t("god_mode.danger_zone")} defaultOpen={false}>
				<div css={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
					<button
						type="button"
						css={{
							fontSize: 12,
							padding: "6px 14px",
							border: "1px solid #e94560",
							borderRadius: 3,
							background: "none",
							color: "#e94560",
							fontFamily: "inherit",
							cursor: "pointer",
							"&:hover": { background: "#e94560", color: "#fff" },
						}}
						onClick={() => {
							reset();
							resetAll();
							window.location.reload();
						}}
					>
						{t("god_mode.reset_game")}
					</button>
					<button
						type="button"
						css={{
							fontSize: 12,
							padding: "6px 14px",
							border: `1px solid ${theme.cashColor}`,
							borderRadius: 3,
							background: "none",
							color: theme.cashColor,
							fontFamily: "inherit",
							cursor: "pointer",
							"&:hover": {
								background: theme.cashColor,
								color: theme.background,
							},
						}}
						onClick={() => {
							const current = useGameStore.getState();
							useGameStore.setState({
								ownedTechNodes: {
									...current.ownedTechNodes,
									the_singularity: 1,
								},
							});
							recalc();
						}}
					>
						{t("god_mode.trigger_singularity")}
					</button>
					<button
						type="button"
						css={{
							fontSize: 12,
							padding: "6px 14px",
							border: `1px solid ${theme.accent}`,
							borderRadius: 3,
							background: "none",
							color: theme.accent,
							fontFamily: "inherit",
							cursor: "pointer",
							"&:hover": {
								background: theme.accent,
								color: theme.background,
							},
						}}
						onClick={() => {
							const current = useGameStore.getState();
							const nodes: Record<string, number> = {
								...current.ownedTechNodes,
							};
							for (const n of allTechNodes) {
								nodes[n.id] = n.max;
							}
							useGameStore.setState({ ownedTechNodes: nodes });
							recalc();
						}}
					>
						{t("god_mode.unlock_all_tech")}
					</button>
					<button
						type="button"
						css={{
							fontSize: 12,
							padding: "6px 14px",
							border: `1px solid ${theme.success}`,
							borderRadius: 3,
							background: "none",
							color: theme.success,
							fontFamily: "inherit",
							cursor: "pointer",
							"&:hover": {
								background: theme.success,
								color: theme.background,
							},
						}}
						onClick={() => {
							const current = useGameStore.getState();
							const upgrades: Record<string, number> = {
								...current.ownedUpgrades,
							};
							for (const u of allUpgrades) {
								if (u.id === "the_singularity") continue;
								upgrades[u.id] = getEffectiveMax(u, current);
							}
							useGameStore.setState({ ownedUpgrades: upgrades });
							recalc();
						}}
					>
						{t("god_mode.max_all_upgrades")}
					</button>
				</div>
			</Section>
		</div>
	);
}
