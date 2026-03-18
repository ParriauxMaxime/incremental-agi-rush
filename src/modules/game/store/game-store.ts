import { useEventStore } from "@modules/event";
import { match } from "ts-pattern";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import balanceData from "../../../../specs/data/balance.json";
import milestonesData from "../../../../specs/data/milestones.json";
import techTreeData from "../../../../specs/data/tech-tree.json";
import tiersData from "../../../../specs/data/tiers.json";
import upgradesData from "../../../../specs/data/upgrades.json";
import type {
	GameActions,
	GameState,
	GodModeOverrides,
	Milestone,
	QueuedBlock,
	TechNode,
	Tier,
	Upgrade,
	UpgradeEffect,
} from "../types";

export const tiers: Tier[] = tiersData.tiers as Tier[];
export const allUpgrades: Upgrade[] = upgradesData.upgrades as Upgrade[];
export const allMilestones: Milestone[] = milestonesData.milestones;
export const allTechNodes: TechNode[] = techTreeData.nodes as TechNode[];

const { core } = balanceData;

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

	currentTierIndex: 0,
	ownedUpgrades: {},
	ownedTechNodes: { computer: 1 },
	autoTypeEnabled: false,
	running: true,
	reachedMilestones: [],
};

function getEffectiveMax(upgrade: Upgrade, state?: GameState): number {
	if (!state || !upgrade.costCategory) return upgrade.max;
	let bonus = 0;
	if (upgrade.costCategory === "freelancer") bonus = state.freelancerMaxBonus;
	if (upgrade.costCategory === "intern") bonus = state.internMaxBonus;
	if (upgrade.costCategory === "team") bonus = state.teamMaxBonus;
	if (upgrade.costCategory === "manager") bonus = state.managerMaxBonus;
	if (upgrade.costCategory === "llm") bonus = state.llmMaxBonus;
	if (upgrade.costCategory === "agent") bonus = state.agentMaxBonus;
	return upgrade.max + bonus;
}

function getUpgradeCost(
	upgrade: Upgrade,
	owned: number,
	state?: GameState,
): number {
	let cost = Math.floor(upgrade.baseCost * upgrade.costMultiplier ** owned);
	if (state) {
		if (upgrade.costCategory === "freelancer")
			cost = Math.floor(cost * state.freelancerCostDiscount);
		if (upgrade.costCategory === "intern")
			cost = Math.floor(cost * state.internCostDiscount);
		if (upgrade.costCategory === "dev")
			cost = Math.floor(cost * state.devCostDiscount);
		if (upgrade.costCategory === "team")
			cost = Math.floor(cost * state.teamCostDiscount);
		if (upgrade.costCategory === "manager")
			cost = Math.floor(cost * state.managerCostDiscount);
		if (upgrade.costCategory === "llm")
			cost = Math.floor(cost * state.llmCostDiscount);
		if (upgrade.costCategory === "agent")
			cost = Math.floor(cost * state.agentCostDiscount);
	}
	return Math.max(1, cost);
}

function getTechNodeCost(node: TechNode, owned: number): number {
	return Math.floor(node.baseCost * node.costMultiplier ** owned);
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
				const modelId = effect.value as string;
				unlockedModels[modelId] = true;
			})
			.otherwise(() => {});
	}

	const eventMods = useEventStore.getState().getEventModifiers();

	// Apply upgrade effects
	for (const upgrade of allUpgrades) {
		const owned = state.ownedUpgrades[upgrade.id] ?? 0;
		if (owned === 0) continue;
		if (eventMods.disabledUpgrades.includes(upgrade.id)) continue;
		for (const effect of upgrade.effects) {
			applyEffect(effect, owned);
		}
	}

	// Apply tech node effects
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

	// CPU and RAM bottleneck each other; storage is free
	const hardwareFlops = Math.min(cpuFlops, ramFlops) + storageFlops;

	// Managers multiply team output: each manager gives +50% * managerMultiplier
	const managerTeamBonus = 1 + managerCount * 0.5 * managerMultiplier;

	// Combine auto LoC:
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
}

export const useGameStore = create<GameState & GameActions>()(
	persist(
		(set, get) => ({
			...initialState,

			addLoc: (amount: number) => {
				set((s) => {
					const gained = amount * s.locProductionMultiplier;
					return {
						loc: s.loc + gained,
						totalLoc: s.totalLoc + gained,
					};
				});
			},

			enqueueBlock: (block: QueuedBlock) => {
				set((s) => ({
					blockQueue: [...s.blockQueue, block],
				}));
			},

			tick: (dt: number) => {
				set((s) => {
					let { loc, totalLoc, cash, totalCash, totalExecutedLoc } = s;
					let blockQueue = s.blockQueue;
					const tier = tiers[s.currentTierIndex];

					// Auto-generate LoC (added as raw number, not blocks — blocks come from editor)
					if (s.autoLocPerSec > 0) {
						const autoGained = s.autoLocPerSec * dt;
						loc += autoGained;
						totalLoc += autoGained;
					}

					// Execute lines from queue via accumulated FLOPS (1 FLOP = 1 line)
					// When stopped, FLOPS don't execute — LoC piles up, no cash earned
					let progress = s.running
						? s.executionProgress + s.flops * dt
						: s.executionProgress;
					let mutated = false;

					while (
						s.running &&
						blockQueue.length > 0 &&
						progress >= 1 &&
						loc >= 1
					) {
						const block = blockQueue[0];
						if (block.lines.length > 0) {
							progress -= 1;
							const earned = tier.cashPerLoc * s.cashMultiplier;
							cash += earned;
							totalCash += earned;
							loc -= 1;
							totalExecutedLoc += 1;

							if (!mutated) {
								blockQueue = blockQueue.slice();
								mutated = true;
							}
							const updatedBlock = {
								...block,
								lines: block.lines.slice(1),
								loc: block.loc - 1,
							};
							if (updatedBlock.lines.length === 0) {
								blockQueue.shift();
							} else {
								blockQueue[0] = updatedBlock;
							}
						} else {
							if (!mutated) {
								blockQueue = blockQueue.slice();
								mutated = true;
							}
							blockQueue.shift();
						}
					}

					loc = Math.max(0, loc);

					const next: Partial<GameState> = {
						loc,
						totalLoc,
						cash,
						totalCash,
						totalExecutedLoc,
						blockQueue,
						executionProgress: progress,
					};

					// Check milestones
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
					if (effect.type === "instantCash" && effect.op === "add") {
						cashBonus += effect.value as number;
					}
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

				// Check prerequisites
				for (const reqId of node.requires) {
					if ((s.ownedTechNodes[reqId] ?? 0) === 0) return;
				}

				const cost = getTechNodeCost(node, owned);
				const useLoc = node.currency === "loc";
				if (useLoc && s.loc < cost) return;
				if (!useLoc && s.cash < cost) return;

				set((s) => {
					const newOwned = (s.ownedTechNodes[node.id] ?? 0) + 1;

					// When spending LoC, also consume lines from the editor queue
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
						ownedTechNodes: {
							...s.ownedTechNodes,
							[node.id]: newOwned,
						},
					};

					// Auto-enable auto-type when researching the auto_type node
					if (node.id === "auto_type") {
						newState.autoTypeEnabled = true;
					}

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

			reset: () => {
				set(initialState);
				localStorage.removeItem("agi-rush-editor");
				useEventStore.getState().reset();
			},

			godSet: (overrides: GodModeOverrides) => {
				set((s) => {
					const next = { ...s, ...overrides };
					if (overrides.loc !== undefined && overrides.totalLoc === undefined) {
						next.totalLoc = Math.max(s.totalLoc, next.loc);
					}
					if (
						overrides.cash !== undefined &&
						overrides.totalCash === undefined
					) {
						next.totalCash = Math.max(s.totalCash, next.cash);
					}
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
		}),
		{
			name: "agi-rush-save",
			partialize: (state) => ({
				loc: state.loc,
				totalLoc: state.totalLoc,
				cash: state.cash,
				totalCash: state.totalCash,
				blockQueue: state.blockQueue,
				executionProgress: state.executionProgress,
				currentTierIndex: state.currentTierIndex,
				ownedUpgrades: state.ownedUpgrades,
				ownedTechNodes: state.ownedTechNodes,
				autoTypeEnabled: state.autoTypeEnabled,
				reachedMilestones: state.reachedMilestones,
			}),
			onRehydrateStorage: () => (state) => {
				if (state) recalcDerivedStats(state);
			},
		},
	),
);

export { getEffectiveMax, getTechNodeCost, getUpgradeCost };
