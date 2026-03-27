import type {
	Milestone,
	TechNode,
	Tier,
	Upgrade,
	UpgradeEffect,
} from "@agi-rush/domain";
import {
	aiModels,
	milestones as allMilestonesData,
	techNodes as allTechNodesData,
	upgrades as allUpgradesData,
	balance,
	tiers as tiersData,
} from "@agi-rush/domain";
import {
	getEffectiveMax as engineGetEffectiveMax,
	getTechNodeCost as engineGetTechNodeCost,
	getUpgradeCost as engineGetUpgradeCost,
} from "@agi-rush/engine";
import { useEventStore } from "@modules/event";
import { match } from "ts-pattern";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const tiers: Tier[] = tiersData;
export const allUpgrades: Upgrade[] = allUpgradesData;
export const allMilestones: Milestone[] = allMilestonesData;
export const allTechNodes: TechNode[] = allTechNodesData;

const { core } = balance;

/** A completed code block waiting in the execution queue */
export interface QueuedBlock {
	/** Lines of HTML for display */
	lines: string[];
	/** How many LoC this block is worth */
	loc: number;
}

export interface GameState {
	loc: number;
	totalLoc: number;
	cash: number;
	totalCash: number;
	totalExecutedLoc: number;
	flops: number;
	cpuFlops: number;
	ramFlops: number;
	storageFlops: number;
	blockQueue: QueuedBlock[];
	executionProgress: number;
	locPerKey: number;
	autoLocPerSec: number;
	freelancerLocPerSec: number;
	internLocPerSec: number;
	devLocPerSec: number;
	teamLocPerSec: number;
	llmLocPerSec: number;
	agentLocPerSec: number;
	managerBonus: number;
	locProductionMultiplier: number;
	cashMultiplier: number;
	freelancerCostDiscount: number;
	internCostDiscount: number;
	devCostDiscount: number;
	teamCostDiscount: number;
	managerCostDiscount: number;
	llmCostDiscount: number;
	agentCostDiscount: number;
	freelancerMaxBonus: number;
	internMaxBonus: number;
	teamMaxBonus: number;
	managerMaxBonus: number;
	llmMaxBonus: number;
	agentMaxBonus: number;
	unlockedModels: Record<string, boolean>;
	flopSlider: number;
	aiLocAccumulator: number;
	autoLocAccumulator: number;
	aiUnlocked: boolean;
	currentTierIndex: number;
	ownedUpgrades: Record<string, number>;
	ownedTechNodes: Record<string, number>;
	autoTypeEnabled: boolean;
	autoExecuteEnabled: boolean;
	running: boolean;
	manualExecAccum: number;
	singularity: boolean;
	reachedMilestones: string[];
}

export interface GodModeOverrides {
	loc?: number;
	totalLoc?: number;
	cash?: number;
	totalCash?: number;
	flops?: number;
	currentTierIndex?: number;
}

export interface GameActions {
	addLoc: (amount: number) => void;
	enqueueBlock: (block: QueuedBlock) => void;
	tick: (dt: number) => void;
	buyUpgrade: (upgrade: Upgrade) => void;
	researchNode: (node: TechNode) => void;
	toggleAutoType: () => void;
	toggleRunning: () => void;
	executeManual: () => void;
	godSet: (overrides: GodModeOverrides) => void;
	reset: () => void;
	recalc: () => void;
	applyEventReward: (cashDelta: number, locDelta: number) => void;
	setFlopSlider: (value: number) => void;
}

const initialState: GameState = {
	loc: 0,
	totalLoc: 0,
	cash: core.startingCash,
	totalCash: 0,
	totalExecutedLoc: 0,
	flops: core.startingFlops,
	cpuFlops: 0,
	ramFlops: 0,
	storageFlops: 0,
	blockQueue: [],
	executionProgress: 0,
	locPerKey: core.startingLocPerKey,
	autoLocPerSec: 0,
	freelancerLocPerSec: 0,
	internLocPerSec: 0,
	devLocPerSec: 0,
	teamLocPerSec: 0,
	llmLocPerSec: 0,
	agentLocPerSec: 0,
	managerBonus: 0,
	locProductionMultiplier: 1,
	cashMultiplier: 1,
	freelancerCostDiscount: 1,
	internCostDiscount: 1,
	devCostDiscount: 1,
	teamCostDiscount: 1,
	managerCostDiscount: 1,
	llmCostDiscount: 1,
	agentCostDiscount: 1,
	freelancerMaxBonus: 0,
	internMaxBonus: 0,
	teamMaxBonus: 0,
	managerMaxBonus: 0,
	llmMaxBonus: 0,
	agentMaxBonus: 0,
	unlockedModels: {},
	flopSlider: 0.7,
	aiLocAccumulator: 0,
	autoLocAccumulator: 0,
	aiUnlocked: false,
	currentTierIndex: 0,
	ownedUpgrades: {},
	ownedTechNodes: { computer: 1 },
	autoTypeEnabled: false,
	autoExecuteEnabled: false,
	running: true,
	manualExecAccum: 0,
	singularity: false,
	reachedMilestones: [],
};

function getEffectiveMax(upgrade: Upgrade, state?: GameState): number {
	if (!state) return engineGetEffectiveMax(upgrade);
	return engineGetEffectiveMax(upgrade, state);
}

function getUpgradeCost(
	upgrade: Upgrade,
	owned: number,
	state?: GameState,
): number {
	if (!state) return engineGetUpgradeCost(upgrade, owned);
	return engineGetUpgradeCost(upgrade, owned, state);
}

function getTechNodeCost(node: TechNode, owned: number): number {
	return engineGetTechNodeCost(node, owned);
}

function recalcDerivedStats(state: GameState): void {
	let locPerKey = core.startingLocPerKey;
	let freelancerLoc = 0;
	let internLoc = 0;
	let devLoc = 0;
	let teamLoc = 0;
	let llmLoc = 0;
	let agentLoc = 0;
	let managerCount = 0;
	let baseFlops = core.startingFlops;
	let cpuFlops = 0;
	let ramFlops = 0;
	let storageFlops = 0;
	let locProductionMultiplier = 1;
	let cashMultiplier = 1;
	let freelancerLocMultiplier = 1;
	let internLocMultiplier = 1;
	let devLocMultiplier = 1;
	let teamLocMultiplier = 1;
	let llmLocMultiplier = 1;
	let agentLocMultiplier = 1;
	let managerMultiplier = 1;
	let devSpeedMultiplier = 1;
	let freelancerCostDiscount = 1;
	let internCostDiscount = 1;
	let devCostDiscount = 1;
	let teamCostDiscount = 1;
	let managerCostDiscount = 1;
	let llmCostDiscount = 1;
	let agentCostDiscount = 1;
	let freelancerMaxBonus = 0;
	let internMaxBonus = 0;
	let teamMaxBonus = 0;
	let managerMaxBonus = 0;
	let llmMaxBonus = 0;
	let agentMaxBonus = 0;
	let tierIndex = state.currentTierIndex;
	const unlockedModels: Record<string, boolean> = {};
	let singularity = false;

	function applyEffect(effect: UpgradeEffect, owned: number) {
		const val = effect.value as number;
		match(effect)
			.with({ type: "locPerKey", op: "add" }, () => {
				locPerKey += val * owned;
			})
			.with({ type: "locPerKey", op: "multiply" }, () => {
				locPerKey *= val ** owned;
			})
			.with({ type: "autoLoc", op: "add" }, () => {
				devLoc += val * owned;
			})
			.with({ type: "freelancerLoc", op: "add" }, () => {
				freelancerLoc += val * owned;
			})
			.with({ type: "internLoc", op: "add" }, () => {
				internLoc += val * owned;
			})
			.with({ type: "devLoc", op: "add" }, () => {
				devLoc += val * owned;
			})
			.with({ type: "teamLoc", op: "add" }, () => {
				teamLoc += val * owned;
			})
			.with({ type: "managerLoc", op: "add" }, () => {
				managerCount += val * owned;
			})
			.with({ type: "flops", op: "add" }, () => {
				baseFlops += val * owned;
			})
			.with({ type: "cpuFlops", op: "add" }, () => {
				cpuFlops += val * owned;
			})
			.with({ type: "ramFlops", op: "add" }, () => {
				ramFlops += val * owned;
			})
			.with({ type: "storageFlops", op: "add" }, () => {
				storageFlops += val * owned;
			})
			.with({ type: "locProductionSpeed", op: "multiply" }, () => {
				locProductionMultiplier *= val ** owned;
			})
			.with({ type: "cashMultiplier", op: "multiply" }, () => {
				cashMultiplier *= val ** owned;
			})
			.with({ type: "devSpeed", op: "multiply" }, () => {
				devSpeedMultiplier *= val ** owned;
			})
			.with({ type: "freelancerLocMultiplier", op: "multiply" }, () => {
				freelancerLocMultiplier *= val ** owned;
			})
			.with({ type: "internLocMultiplier", op: "multiply" }, () => {
				internLocMultiplier *= val ** owned;
			})
			.with({ type: "devLocMultiplier", op: "multiply" }, () => {
				devLocMultiplier *= val ** owned;
			})
			.with({ type: "teamLocMultiplier", op: "multiply" }, () => {
				teamLocMultiplier *= val ** owned;
			})
			.with({ type: "managerMultiplier", op: "multiply" }, () => {
				managerMultiplier *= val ** owned;
			})
			.with({ type: "freelancerCostDiscount", op: "multiply" }, () => {
				freelancerCostDiscount *= val ** owned;
			})
			.with({ type: "internCostDiscount", op: "multiply" }, () => {
				internCostDiscount *= val ** owned;
			})
			.with({ type: "devCostDiscount", op: "multiply" }, () => {
				devCostDiscount *= val ** owned;
			})
			.with({ type: "teamCostDiscount", op: "multiply" }, () => {
				teamCostDiscount *= val ** owned;
			})
			.with({ type: "managerCostDiscount", op: "multiply" }, () => {
				managerCostDiscount *= val ** owned;
			})
			.with({ type: "llmLoc", op: "add" }, () => {
				llmLoc += val * owned;
			})
			.with({ type: "agentLoc", op: "add" }, () => {
				agentLoc += val * owned;
			})
			.with({ type: "llmLocMultiplier", op: "multiply" }, () => {
				llmLocMultiplier *= val ** owned;
			})
			.with({ type: "agentLocMultiplier", op: "multiply" }, () => {
				agentLocMultiplier *= val ** owned;
			})
			.with({ type: "llmCostDiscount", op: "multiply" }, () => {
				llmCostDiscount *= val ** owned;
			})
			.with({ type: "agentCostDiscount", op: "multiply" }, () => {
				agentCostDiscount *= val ** owned;
			})
			.with({ type: "freelancerMaxBonus", op: "add" }, () => {
				freelancerMaxBonus += val * owned;
			})
			.with({ type: "internMaxBonus", op: "add" }, () => {
				internMaxBonus += val * owned;
			})
			.with({ type: "teamMaxBonus", op: "add" }, () => {
				teamMaxBonus += val * owned;
			})
			.with({ type: "managerMaxBonus", op: "add" }, () => {
				managerMaxBonus += val * owned;
			})
			.with({ type: "llmMaxBonus", op: "add" }, () => {
				llmMaxBonus += val * owned;
			})
			.with({ type: "agentMaxBonus", op: "add" }, () => {
				agentMaxBonus += val * owned;
			})
			.with({ type: "tierUnlock", op: "set" }, () => {
				tierIndex = Math.max(tierIndex, val);
			})
			.with({ type: "modelUnlock", op: "enable" }, () => {
				unlockedModels[effect.value as string] = true;
			})
			.with({ type: "singularity", op: "enable" }, () => {
				singularity = true;
			})
			.otherwise(() => {});
	}

	const eventMods = useEventStore.getState().getEventModifiers();

	for (const upgrade of allUpgrades) {
		const owned = state.ownedUpgrades[upgrade.id] ?? 0;
		if (owned === 0) continue;
		if (eventMods.disabledUpgrades.includes(upgrade.id)) continue;
		for (const effect of upgrade.effects) {
			applyEffect(effect, owned);
		}
	}

	for (const node of allTechNodes) {
		const owned = state.ownedTechNodes[node.id] ?? 0;
		if (owned === 0) continue;
		for (const effect of node.effects) {
			applyEffect(effect, owned);
		}
	}

	locPerKey *= eventMods.locPerKeyMultiplier;
	locProductionMultiplier *= eventMods.locProductionMultiplier;
	cashMultiplier *= eventMods.cashMultiplier;

	const hardwareFlops = Math.min(cpuFlops, ramFlops) + storageFlops;
	const managerTeamBonus = 1 + managerCount * 0.5 * managerMultiplier;
	const totalAutoLoc =
		freelancerLoc * freelancerLocMultiplier +
		internLoc * internLocMultiplier +
		devLoc * devLocMultiplier * devSpeedMultiplier +
		teamLoc * teamLocMultiplier * managerTeamBonus +
		llmLoc * llmLocMultiplier +
		agentLoc * agentLocMultiplier;

	state.cpuFlops = cpuFlops;
	state.ramFlops = ramFlops;
	state.storageFlops = storageFlops;
	state.locPerKey = locPerKey;
	state.autoLocPerSec =
		totalAutoLoc * locProductionMultiplier * eventMods.autoLocMultiplier;
	state.freelancerLocPerSec =
		freelancerLoc * freelancerLocMultiplier * locProductionMultiplier * eventMods.autoLocMultiplier;
	state.internLocPerSec =
		internLoc * internLocMultiplier * locProductionMultiplier * eventMods.autoLocMultiplier;
	state.devLocPerSec =
		devLoc * devLocMultiplier * devSpeedMultiplier * locProductionMultiplier * eventMods.autoLocMultiplier;
	state.teamLocPerSec =
		teamLoc * teamLocMultiplier * managerTeamBonus * locProductionMultiplier * eventMods.autoLocMultiplier;
	state.llmLocPerSec =
		llmLoc * llmLocMultiplier * locProductionMultiplier * eventMods.autoLocMultiplier;
	state.agentLocPerSec =
		agentLoc * agentLocMultiplier * locProductionMultiplier * eventMods.autoLocMultiplier;
	state.managerBonus = managerTeamBonus;
	const computedFlops = baseFlops + hardwareFlops;
	state.flops =
		eventMods.flopsOverride !== null
			? eventMods.flopsOverride
			: computedFlops * eventMods.flopsMultiplier;
	state.locProductionMultiplier = locProductionMultiplier;
	state.cashMultiplier = cashMultiplier;
	state.freelancerCostDiscount = freelancerCostDiscount;
	state.internCostDiscount = internCostDiscount;
	state.devCostDiscount = devCostDiscount;
	state.teamCostDiscount = teamCostDiscount;
	state.managerCostDiscount = managerCostDiscount;
	state.llmCostDiscount = llmCostDiscount;
	state.agentCostDiscount = agentCostDiscount;
	state.freelancerMaxBonus = freelancerMaxBonus;
	state.internMaxBonus = internMaxBonus;
	state.teamMaxBonus = teamMaxBonus;
	state.managerMaxBonus = managerMaxBonus;
	state.llmMaxBonus = llmMaxBonus;
	state.agentMaxBonus = agentMaxBonus;
	state.currentTierIndex = tierIndex;
	state.unlockedModels = unlockedModels;
	state.aiUnlocked = Object.values(unlockedModels).some(Boolean);
	state.singularity = singularity;
	if (singularity) {
		state.running = false;
	}
}

export const useGameStore = create<GameState & GameActions>()(
	persist(
		(set, get) => ({
			...initialState,

			addLoc: (amount: number) => {
				set((s) => {
					const gained = amount * s.locProductionMultiplier;
					return { loc: s.loc + gained, totalLoc: s.totalLoc + gained };
				});
			},

			enqueueBlock: (block: QueuedBlock) => {
				set((s) => ({ blockQueue: [...s.blockQueue, block] }));
			},

			tick: (dt: number) => {
				set((s) => {
					let { loc, totalLoc, cash, totalCash, totalExecutedLoc } = s;
					const tier = tiers[s.currentTierIndex];

					// ── 1. LoC production (rate-based) ──
					const autoProduced = s.autoLocPerSec * dt;
					loc += autoProduced;
					totalLoc += autoProduced;

					// AI production: models consume FLOPS from the total pool
					const aiUnlocked = s.aiUnlocked;
					let aiFlopsCost = 0;
					let aiProduced = 0;
					if (aiUnlocked && s.running) {
						let totalAiLoc = 0;
						let totalAiFlops = 0;
						for (const model of aiModels) {
							if (s.unlockedModels[model.id]) {
								totalAiLoc += model.locPerSec;
								totalAiFlops += model.flopsCost;
							}
						}
						if (totalAiFlops > 0) {
							// AI gets what it needs, capped by available FLOPS
							aiFlopsCost = Math.min(totalAiFlops, s.flops);
							const aiEfficiency = aiFlopsCost / totalAiFlops;
							aiProduced = totalAiLoc * aiEfficiency * dt;
						}
					}
					loc += aiProduced;
					totalLoc += aiProduced;

					// ── 2. Execution: remaining FLOPS after AI ──
					const execFlops = Math.max(0, s.flops - aiFlopsCost);
					let manualExecAccum = s.manualExecAccum;
					let execCapacity: number;
					if (s.autoExecuteEnabled && s.running) {
						execCapacity = execFlops * dt;
					} else if (manualExecAccum > 0) {
						execCapacity = manualExecAccum;
						manualExecAccum = 0;
					} else {
						execCapacity = 0;
					}

					const executed = Math.min(execCapacity, loc);
					if (executed > 0) {
						const earnRate = tier.cashPerLoc * s.cashMultiplier;
						cash += executed * earnRate;
						totalCash += executed * earnRate;
						loc -= executed;
						totalExecutedLoc += executed;
					}

					loc = Math.max(0, loc);

					// ── 3. Visual block queue (capped, for editor only) ──
					let blockQueue = s.blockQueue;
					const visualProduced = Math.floor(autoProduced + aiProduced);
					if (visualProduced > 0) {
						blockQueue = blockQueue.slice(-99);
						blockQueue.push({ lines: [], loc: visualProduced });
					}

					const next: Partial<GameState> = {
						loc,
						totalLoc,
						cash,
						totalCash,
						totalExecutedLoc,
						blockQueue,
						manualExecAccum,
					};

					const newMilestones: string[] = [];
					for (const m of allMilestones) {
						if (s.reachedMilestones.includes(m.id)) continue;
						let reached = false;
						if (m.metric === "totalLoc") reached = totalLoc >= m.threshold;
						if (m.metric === "totalCash") reached = totalCash >= m.threshold;
						if (reached) newMilestones.push(m.id);
					}
					if (newMilestones.length > 0) {
						next.reachedMilestones = [...s.reachedMilestones, ...newMilestones];
					}

					return next;
				});
			},

			buyUpgrade: (upgrade: Upgrade) => {
				const s = get();
				const owned = s.ownedUpgrades[upgrade.id] ?? 0;
				if (owned >= getEffectiveMax(upgrade, s)) return;
				const cost = getUpgradeCost(upgrade, owned, s);
				if (s.cash < cost) return;
				let cashBonus = 0;
				for (const effect of upgrade.effects) {
					if (effect.type === "instantCash" && effect.op === "add")
						cashBonus += effect.value as number;
				}
				set((s) => {
					const newState = {
						...s,
						cash: s.cash - cost + cashBonus,
						totalCash: s.totalCash + cashBonus,
						ownedUpgrades: {
							...s.ownedUpgrades,
							[upgrade.id]: (s.ownedUpgrades[upgrade.id] ?? 0) + 1,
						},
					};
					recalcDerivedStats(newState);
					return newState;
				});
			},

			researchNode: (node: TechNode) => {
				const s = get();
				const owned = s.ownedTechNodes[node.id] ?? 0;
				if (owned >= node.max) return;
				for (const reqId of node.requires) {
					if ((s.ownedTechNodes[reqId] ?? 0) === 0) return;
				}
				const cost = getTechNodeCost(node, owned);
				const useLoc = node.currency === "loc";
				if (useLoc && s.loc < cost) return;
				if (!useLoc && s.cash < cost) return;
				set((s) => {
					const newOwned = (s.ownedTechNodes[node.id] ?? 0) + 1;
					let blockQueue = s.blockQueue;
					if (useLoc) {
						let linesToRemove = Math.ceil(cost);
						blockQueue = blockQueue.slice();
						while (blockQueue.length > 0 && linesToRemove > 0) {
							const block = blockQueue[0];
							if (block.lines.length <= linesToRemove) {
								linesToRemove -= block.lines.length;
								blockQueue.shift();
							} else {
								blockQueue[0] = {
									...block,
									lines: block.lines.slice(linesToRemove),
									loc: block.loc - linesToRemove,
								};
								linesToRemove = 0;
							}
						}
					}
					const newState = {
						...s,
						loc: useLoc ? s.loc - cost : s.loc,
						cash: useLoc ? s.cash : s.cash - cost,
						blockQueue,
						ownedTechNodes: { ...s.ownedTechNodes, [node.id]: newOwned },
					};
					if (node.id === "auto_type") newState.autoTypeEnabled = true;
					if (node.id === "auto_execute") newState.autoExecuteEnabled = true;
					recalcDerivedStats(newState);
					return newState;
				});
			},

			toggleAutoType: () => {
				set((s) => ({ autoTypeEnabled: !s.autoTypeEnabled }));
			},
			toggleRunning: () => {
				set((s) => ({ running: !s.running }));
			},
			executeManual: () => {
				const s = get();
				if (s.autoExecuteEnabled || s.flops <= 0) return;
				// Remaining FLOPS after AI models consume their share
				let aiFlopsCost = 0;
				if (s.aiUnlocked) {
					for (const model of aiModels) {
						if (s.unlockedModels[model.id]) aiFlopsCost += model.flopsCost;
					}
				}
				const execFlops = Math.max(0, s.flops - Math.min(aiFlopsCost, s.flops));
				if (execFlops <= 0) return;
				set({ manualExecAccum: s.manualExecAccum + execFlops });
			},

			reset: () => {
				set(initialState);
				localStorage.removeItem("agi-rush-editor");
				useEventStore.getState().reset();
			},

			godSet: (overrides: GodModeOverrides) => {
				set((s) => {
					const next = { ...s, ...overrides };
					if (overrides.loc !== undefined && overrides.totalLoc === undefined)
						next.totalLoc = Math.max(s.totalLoc, next.loc);
					if (overrides.cash !== undefined && overrides.totalCash === undefined)
						next.totalCash = Math.max(s.totalCash, next.cash);
					return next;
				});
			},

			recalc: () => {
				set((s) => {
					const next = { ...s };
					recalcDerivedStats(next);
					return next;
				});
			},

			applyEventReward: (cashDelta: number, locDelta: number) => {
				set((s) => ({
					cash: s.cash + cashDelta,
					totalCash: cashDelta > 0 ? s.totalCash + cashDelta : s.totalCash,
					loc: s.loc + locDelta,
					totalLoc: locDelta > 0 ? s.totalLoc + locDelta : s.totalLoc,
				}));
			},

			setFlopSlider: (value: number) => {
				set({ flopSlider: Math.min(1, Math.max(0, value)) });
			},
		}),
		{
			name: "agi-rush-save",
			partialize: (state) => ({
				loc: state.loc,
				totalLoc: state.totalLoc,
				cash: state.cash,
				totalCash: state.totalCash,
				blockQueue: state.blockQueue.slice(-20).map((b) => ({
					lines: [],
					loc: b.loc,
				})),
				currentTierIndex: state.currentTierIndex,
				ownedUpgrades: state.ownedUpgrades,
				ownedTechNodes: state.ownedTechNodes,
				autoTypeEnabled: state.autoTypeEnabled,
				autoExecuteEnabled: state.autoExecuteEnabled,
				reachedMilestones: state.reachedMilestones,
				flopSlider: state.flopSlider,
			}),
			onRehydrateStorage: () => (state) => {
				if (state) recalcDerivedStats(state);
			},
		},
	),
);

export { getEffectiveMax, getTechNodeCost, getUpgradeCost };
