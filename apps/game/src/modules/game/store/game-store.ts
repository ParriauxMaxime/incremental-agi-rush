import type {
	Milestone,
	TechNode,
	Tier,
	Upgrade,
	UpgradeEffect,
} from "@flopsed/domain";
import {
	aiModels,
	milestones as allMilestonesData,
	techNodes as allTechNodesData,
	upgrades as allUpgradesData,
	balance,
	tiers as tiersData,
} from "@flopsed/domain";
import {
	getEffectiveMax as engineGetEffectiveMax,
	getTechNodeCost as engineGetTechNodeCost,
	getUpgradeCost as engineGetUpgradeCost,
} from "@flopsed/engine";
import { sfx } from "@modules/audio";
import { useEventStore } from "@modules/event";
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

export interface TierTransition {
	tierIndex: number;
	enteredAt: number;
}

export interface PurchaseEntry {
	id: string;
	name: string;
	cost: number;
	time: number;
}

export interface RateSnapshot {
	t: number;
	cashPerSec: number;
	locProducedPerSec: number;
	locExecutedPerSec: number;
	flops: number;
	flopUtilization: number;
	tierIndex: number;
}

export interface GameState {
	loc: number;
	totalLoc: number;
	cash: number;
	totalCash: number;
	totalExecutedLoc: number;
	tokens: number;
	totalTokens: number;
	flops: number;
	cpuFlops: number;
	ramFlops: number;
	storageFlops: number;
	blockQueue: QueuedBlock[];
	executionProgress: number;
	locPerKey: number;
	effectiveLocPerKey: number;
	autoLocPerSec: number;
	autoTypeLocPerSec: number;
	freelancerLocPerSec: number;
	internLocPerSec: number;
	devLocPerSec: number;
	teamLocPerSec: number;
	llmLocPerSec: number;
	agentLocPerSec: number;
	managerBonus: number;
	locProductionMultiplier: number;
	cashMultiplier: number;
	tokenMultiplier: number;
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
	llmHostSlots: number;
	unlockedModels: Record<string, boolean>;
	aiLocAccumulator: number;
	autoLocAccumulator: number;
	aiUnlocked: boolean;
	currentTierIndex: number;
	ownedUpgrades: Record<string, number>;
	ownedTechNodes: Record<string, number>;
	autoTypeEnabled: boolean;
	autoExecuteEnabled: boolean;
	autoPokeEnabled: boolean;
	flopSlider: number;
	autoArbitrageEnabled: boolean;
	running: boolean;
	manualExecAccum: number;
	singularity: boolean;
	reachedMilestones: string[];
	sessionStartTime: number;
	tierTransitions: TierTransition[];
	purchaseLog: PurchaseEntry[];
	rateSnapshots: RateSnapshot[];
	lastSnapshotTime: number;
	prevTickTotalCash: number;
	prevTickTotalLoc: number;
	prevTickTotalExecLoc: number;
	_visualTick: number;
	editorStreamingMode: boolean;
	prestigeCount: number;
	prestigeMultiplier: number;
	hasReachedSingularity: boolean;
	endgameCompleted: boolean;
}

export interface GodModeOverrides {
	loc?: number;
	totalLoc?: number;
	cash?: number;
	totalCash?: number;
	tokens?: number;
	totalTokens?: number;
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
	setFlopSlider: (value: number) => void;
	setEffectiveLocPerKey: (value: number) => void;
	toggleAutoArbitrage: () => void;
	toggleAutoExecute: () => void;
	applyEventReward: (cashDelta: number, locDelta: number) => void;
	prestige: () => void;
}

const initialState: GameState = {
	loc: 0,
	totalLoc: 0,
	cash: core.startingCash,
	totalCash: 0,
	totalExecutedLoc: 0,
	tokens: 0,
	totalTokens: 0,
	flops: core.startingFlops,
	cpuFlops: 0,
	ramFlops: 0,
	storageFlops: 0,
	blockQueue: [],
	executionProgress: 0,
	locPerKey: core.startingLocPerKey,
	effectiveLocPerKey: core.startingLocPerKey,
	autoLocPerSec: 0,
	autoTypeLocPerSec: 0,
	freelancerLocPerSec: 0,
	internLocPerSec: 0,
	devLocPerSec: 0,
	teamLocPerSec: 0,
	llmLocPerSec: 0,
	agentLocPerSec: 0,
	managerBonus: 0,
	locProductionMultiplier: 1,
	cashMultiplier: 1,
	tokenMultiplier: 1,
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
	llmHostSlots: 0,
	unlockedModels: {},
	aiLocAccumulator: 0,
	autoLocAccumulator: 0,
	aiUnlocked: false,
	currentTierIndex: 0,
	ownedUpgrades: {},
	ownedTechNodes: { computer: 1 },
	autoTypeEnabled: false,
	autoExecuteEnabled: false,
	autoPokeEnabled: false,
	flopSlider: 0.7,
	autoArbitrageEnabled: false,
	running: true,
	manualExecAccum: 0,
	singularity: false,
	reachedMilestones: [],
	sessionStartTime: performance.now(),
	tierTransitions: [{ tierIndex: 0, enteredAt: 0 }],
	purchaseLog: [],
	rateSnapshots: [],
	lastSnapshotTime: 0,
	prevTickTotalCash: 0,
	prevTickTotalLoc: 0,
	prevTickTotalExecLoc: 0,
	_visualTick: 0,
	editorStreamingMode: false,
	prestigeCount: 0,
	prestigeMultiplier: 1,
	hasReachedSingularity: false,
	endgameCompleted: false,
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
	let tokenMultiplier = 1;
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
	let llmHostSlots = 0;
	let tierIndex = state.currentTierIndex;
	const unlockedModels: Record<string, boolean> = {};
	let singularity = false;

	// Fast lookup table replaces ts-pattern match() — ~30 patterns checked
	// per effect would create closures/objects on every call. With 120+ effects
	// at T3, this saves significant allocation in the recalc hot path.
	function applyEffect(effect: UpgradeEffect, owned: number) {
		const val = effect.value as number;
		const key = `${effect.type}:${effect.op}`;

		switch (key) {
			// ── LoC production ──
			case "locPerKey:add":
				locPerKey += val * owned;
				break;
			case "locPerKey:multiply":
				locPerKey *= val ** owned;
				break;
			case "autoLoc:add":
				devLoc += val * owned;
				break;
			case "freelancerLoc:add":
				freelancerLoc += val * owned;
				break;
			case "internLoc:add":
				internLoc += val * owned;
				break;
			case "devLoc:add":
				devLoc += val * owned;
				break;
			case "teamLoc:add":
				teamLoc += val * owned;
				break;
			case "managerLoc:add":
				managerCount += val * owned;
				break;
			case "llmLoc:add":
				llmLoc += val * owned;
				break;
			case "agentLoc:add":
				agentLoc += val * owned;
				break;

			// ── FLOPS ──
			case "flops:add":
				baseFlops += val * owned;
				break;
			case "cpuFlops:add":
				cpuFlops += val * owned;
				break;
			case "ramFlops:add":
				ramFlops += val * owned;
				break;
			case "storageFlops:add":
				storageFlops += val * owned;
				break;

			// ── Multipliers ──
			case "locProductionSpeed:multiply":
				locProductionMultiplier *= val ** owned;
				break;
			case "cashMultiplier:multiply":
				cashMultiplier *= val ** owned;
				break;
			case "tokenMultiplier:multiply":
				tokenMultiplier *= val ** owned;
				break;
			case "devSpeed:multiply":
				devSpeedMultiplier *= val ** owned;
				break;
			case "freelancerLocMultiplier:multiply":
				freelancerLocMultiplier *= val ** owned;
				break;
			case "internLocMultiplier:multiply":
				internLocMultiplier *= val ** owned;
				break;
			case "devLocMultiplier:multiply":
				devLocMultiplier *= val ** owned;
				break;
			case "teamLocMultiplier:multiply":
				teamLocMultiplier *= val ** owned;
				break;
			case "managerMultiplier:multiply":
				managerMultiplier *= val ** owned;
				break;
			case "llmLocMultiplier:multiply":
				llmLocMultiplier *= val ** owned;
				break;
			case "agentLocMultiplier:multiply":
				agentLocMultiplier *= val ** owned;
				break;

			// ── Cost discounts ──
			case "freelancerCostDiscount:multiply":
				freelancerCostDiscount *= val ** owned;
				break;
			case "internCostDiscount:multiply":
				internCostDiscount *= val ** owned;
				break;
			case "devCostDiscount:multiply":
				devCostDiscount *= val ** owned;
				break;
			case "teamCostDiscount:multiply":
				teamCostDiscount *= val ** owned;
				break;
			case "managerCostDiscount:multiply":
				managerCostDiscount *= val ** owned;
				break;
			case "llmCostDiscount:multiply":
				llmCostDiscount *= val ** owned;
				break;
			case "agentCostDiscount:multiply":
				agentCostDiscount *= val ** owned;
				break;

			// ── Max bonuses ──
			case "freelancerMaxBonus:add":
				freelancerMaxBonus += val * owned;
				break;
			case "internMaxBonus:add":
				internMaxBonus += val * owned;
				break;
			case "teamMaxBonus:add":
				teamMaxBonus += val * owned;
				break;
			case "managerMaxBonus:add":
				managerMaxBonus += val * owned;
				break;
			case "llmMaxBonus:add":
				llmMaxBonus += val * owned;
				break;
			case "agentMaxBonus:add":
				agentMaxBonus += val * owned;
				break;
			case "llmHostSlot:add":
				llmHostSlots += val * owned;
				break;

			// ── Special ──
			case "tierUnlock:set":
				tierIndex = Math.max(tierIndex, val);
				break;
			case "modelUnlock:enable":
				unlockedModels[effect.value as string] = true;
				break;
			case "singularity:enable":
				singularity = true;
				break;
			// autoPoke:enable, autoArbitrage:enable — no-op (handled elsewhere)
		}
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
	cashMultiplier *= state.prestigeMultiplier;

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
	if (!state.editorStreamingMode && state.autoLocPerSec > locPerKey * 8) {
		state.editorStreamingMode = true;
	}
	// In streaming mode, auto-type doesn't go through advanceTokens (no visual editor),
	// so include its LoC production in autoLocPerSec for the tick to handle.
	const autoTypeLoc = state.autoTypeEnabled
		? 5 * locPerKey * locProductionMultiplier * eventMods.autoLocMultiplier
		: 0;
	state.autoTypeLocPerSec = autoTypeLoc;
	if (state.editorStreamingMode) {
		state.autoLocPerSec += autoTypeLoc;
	}
	state.effectiveLocPerKey = locPerKey;
	state.freelancerLocPerSec =
		freelancerLoc *
		freelancerLocMultiplier *
		locProductionMultiplier *
		eventMods.autoLocMultiplier;
	state.internLocPerSec =
		internLoc *
		internLocMultiplier *
		locProductionMultiplier *
		eventMods.autoLocMultiplier;
	state.devLocPerSec =
		devLoc *
		devLocMultiplier *
		devSpeedMultiplier *
		locProductionMultiplier *
		eventMods.autoLocMultiplier;
	state.teamLocPerSec =
		teamLoc *
		teamLocMultiplier *
		managerTeamBonus *
		locProductionMultiplier *
		eventMods.autoLocMultiplier;
	state.llmLocPerSec =
		llmLoc *
		llmLocMultiplier *
		locProductionMultiplier *
		eventMods.autoLocMultiplier;
	state.agentLocPerSec =
		agentLoc *
		agentLocMultiplier *
		locProductionMultiplier *
		eventMods.autoLocMultiplier;
	state.managerBonus = managerTeamBonus;
	const computedFlops = baseFlops + hardwareFlops;
	state.flops =
		eventMods.flopsOverride !== null
			? eventMods.flopsOverride
			: computedFlops * eventMods.flopsMultiplier;
	state.locProductionMultiplier = locProductionMultiplier;
	state.cashMultiplier = cashMultiplier;
	state.tokenMultiplier = tokenMultiplier;
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
	state.llmHostSlots = llmHostSlots;
	if (tierIndex !== state.currentTierIndex) {
		const elapsed = (performance.now() - state.sessionStartTime) / 1000;
		state.tierTransitions = [
			...state.tierTransitions,
			{ tierIndex, enteredAt: elapsed },
		];
	}
	state.currentTierIndex = tierIndex;
	state.unlockedModels = unlockedModels;
	state.aiUnlocked =
		llmHostSlots > 0 && Object.values(unlockedModels).some(Boolean);
	state.singularity = singularity;
	if (singularity) {
		state.hasReachedSingularity = true;
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
					let { tokens, totalTokens } = s;
					const tier = tiers[s.currentTierIndex];
					const aiUnlocked = s.aiUnlocked;

					// ── 1. Production ──
					const humanOutput = s.autoLocPerSec * dt;
					let aiProduced = 0;

					if (aiUnlocked && s.running) {
						// Get event modifier for token production
						const eventMods = useEventStore.getState().getEventModifiers();
						const eventTokenMult = eventMods.tokenProductionMultiplier;

						// Apply both tech tree token multiplier and event modifier
						const adjustedHumanOutput =
							humanOutput * s.tokenMultiplier * eventTokenMult;

						// Compute AI token demand
						const activeModels = aiModels
							.filter((m) => s.unlockedModels[m.id])
							.sort((a, b) => a.flopsCost - b.flopsCost)
							.slice(0, s.llmHostSlots);

						let totalTokenDemand = 0;
						for (const model of activeModels) {
							totalTokenDemand += model.tokenCost * dt;
						}

						// Split: tokens first (capped at demand), surplus → direct LoC
						const tokensProduced = Math.min(
							adjustedHumanOutput,
							totalTokenDemand,
						);
						const directLoc = adjustedHumanOutput - tokensProduced;
						const tokenEfficiency =
							totalTokenDemand > 0 ? tokensProduced / totalTokenDemand : 0;

						// AI LoC output (gated by tokens AND proportional FLOPS)
						const aiFlops = s.flops * (1 - s.flopSlider);
						let totalFlopsDemand = 0;
						for (const model of activeModels) {
							totalFlopsDemand += model.flopsCost;
						}
						// Proportional: all models share FLOPS fairly
						const flopSaturation =
							totalFlopsDemand > 0
								? Math.min(1, aiFlops / totalFlopsDemand)
								: 0;
						for (const model of activeModels) {
							const flopRatio = flopSaturation;
							aiProduced +=
								model.locPerSec * tokenEfficiency * Math.min(1, flopRatio) * dt;
						}

						loc += directLoc + aiProduced;
						totalLoc += directLoc + aiProduced;
						tokens += tokensProduced;
						totalTokens += tokensProduced;
					} else {
						// Pre-T4: all human output goes to LoC directly
						loc += humanOutput;
						totalLoc += humanOutput;
					}

					// ── 2. Execution ──
					const execFlops = aiUnlocked ? s.flops * s.flopSlider : s.flops;
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
						sfx.execute();
					}

					loc = Math.max(0, loc);

					// ── 3. Visual block queue (capped, for editor only) ──
					// Skip at T4+ (CLI prompt) and T2+ streaming mode
					let blockQueue = s.blockQueue;
					const visualTick = (s._visualTick ?? 0) + 1;
					if (aiUnlocked || s.editorStreamingMode) {
						// T4+ or streaming: no block tracking needed
						if (blockQueue.length > 0) blockQueue = [];
					} else {
						const visualProduced = Math.floor(humanOutput + aiProduced);
						if (visualProduced > 0 && visualTick % 5 === 0) {
							blockQueue =
								blockQueue.length >= 100
									? blockQueue.slice(-99)
									: [...blockQueue];
							blockQueue.push({ lines: [], loc: visualProduced * 5 });
						}
					}

					const next: Partial<GameState> = {
						loc,
						totalLoc,
						cash,
						totalCash,
						totalExecutedLoc,
						tokens,
						totalTokens,
						blockQueue,
						manualExecAccum,
						_visualTick: visualTick,
					};

					let newMilestones: string[] | null = null;
					for (const m of allMilestones) {
						if (s.reachedMilestones.includes(m.id)) continue;
						let reached = false;
						if (m.metric === "totalLoc") reached = totalLoc >= m.threshold;
						if (m.metric === "totalCash") reached = totalCash >= m.threshold;
						if (reached) {
							newMilestones ??= [];
							newMilestones.push(m.id);
						}
					}
					if (newMilestones !== null) {
						next.reachedMilestones = [...s.reachedMilestones, ...newMilestones];
						// Award cash bonuses and show toasts for new milestones
						for (const mid of newMilestones) {
							const m = allMilestones.find((ms) => ms.id === mid);
							if (m?.cashBonus) {
								next.cash = (next.cash ?? cash) + m.cashBonus;
								next.totalCash = (next.totalCash ?? totalCash) + m.cashBonus;
								useEventStore
									.getState()
									.showMilestoneToast(m.id, m.name, m.description, m.cashBonus);
								sfx.milestone();
							}
						}
					}

					// ── 4. Session analytics snapshots (every 5s) ──
					const elapsed = (performance.now() - s.sessionStartTime) / 1000;
					if (elapsed - s.lastSnapshotTime >= 5) {
						const cashDelta = totalCash - s.prevTickTotalCash;
						const locDelta = totalLoc - s.prevTickTotalLoc;
						const execDelta = totalExecutedLoc - s.prevTickTotalExecLoc;
						const dtSnap = elapsed - s.lastSnapshotTime;
						const flopUtil =
							s.flops > 0 ? Math.min(1, loc / Math.max(1, s.flops)) : 0;

						const snapshot: RateSnapshot = {
							t: elapsed,
							cashPerSec: dtSnap > 0 ? cashDelta / dtSnap : 0,
							locProducedPerSec: dtSnap > 0 ? locDelta / dtSnap : 0,
							locExecutedPerSec: dtSnap > 0 ? execDelta / dtSnap : 0,
							flops: s.flops,
							flopUtilization: flopUtil,
							tierIndex: s.currentTierIndex,
						};

						const snapshots = [...s.rateSnapshots, snapshot].slice(-720);
						next.rateSnapshots = snapshots;
						next.lastSnapshotTime = elapsed;
						next.prevTickTotalCash = totalCash;
						next.prevTickTotalLoc = totalLoc;
						next.prevTickTotalExecLoc = totalExecutedLoc;
					}

					// ── 5. Auto-arbitrage (smooth slider adjustment) ──
					if (s.autoArbitrageEnabled && aiUnlocked) {
						const activeForCalc = aiModels
							.filter((m) => s.unlockedModels[m.id])
							.slice(0, s.llmHostSlots);

						// Compute total AI FLOPS demand
						let totalAiDemand = 0;
						for (const model of activeForCalc) {
							totalAiDemand += model.flopsCost;
						}

						// Ideal split: give AI what it needs, rest to exec
						// Target AI fraction = demand / total FLOPS (capped)
						const idealAiFraction =
							s.flops > 0 ? Math.min(0.9, totalAiDemand / s.flops) : 0.3;
						let targetSlider = 1 - idealAiFraction;

						// Queue pressure bias
						const currentExecFlops = s.flops * s.flopSlider;
						if (loc > currentExecFlops * 5) {
							targetSlider += 0.05; // queue backing up → more exec
						} else if (loc < currentExecFlops * 1) {
							targetSlider -= 0.05; // queue nearly empty → more AI
						}

						// Clamp
						targetSlider = Math.min(0.9, Math.max(0.1, targetSlider));

						// Smooth lerp
						const newSlider =
							s.flopSlider + (targetSlider - s.flopSlider) * 0.02;
						next.flopSlider = Math.min(0.9, Math.max(0.1, newSlider));
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
				sfx.purchase();
				{
					const elapsed = (performance.now() - get().sessionStartTime) / 1000;
					set((s) => ({
						purchaseLog: [
							...s.purchaseLog.slice(-49),
							{
								id: upgrade.id,
								name: upgrade.id,
								cost,
								time: elapsed,
							},
						],
					}));
				}
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
					if (node.id === "auto_poke") newState.autoPokeEnabled = true;
					if (node.id === "auto_arbitrage")
						newState.autoArbitrageEnabled = true;
					recalcDerivedStats(newState);
					return newState;
				});
				sfx.purchase();
				{
					const elapsed = (performance.now() - get().sessionStartTime) / 1000;
					set((s) => ({
						purchaseLog: [
							...s.purchaseLog.slice(-49),
							{
								id: node.id,
								name: node.id,
								cost,
								time: elapsed,
							},
						],
					}));
				}
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
				const execFlops = s.aiUnlocked ? s.flops * s.flopSlider : s.flops;
				if (execFlops <= 0) return;
				set({ manualExecAccum: s.manualExecAccum + execFlops });
			},

			reset: () => {
				const {
					prestigeCount,
					prestigeMultiplier,
					hasReachedSingularity,
					endgameCompleted,
				} = get();
				set({
					...initialState,
					prestigeCount,
					prestigeMultiplier,
					hasReachedSingularity,
					endgameCompleted,
				});
				localStorage.removeItem("flopsed-editor");
				useEventStore.getState().reset();
			},

			prestige: () => {
				const s = get();
				if (s.prestigeCount >= 5) return;
				const keptCash = s.cash * 0.05;
				const newCount = s.prestigeCount + 1;
				const newMult = 1.7 ** newCount;
				set({
					...initialState,
					prestigeCount: newCount,
					prestigeMultiplier: newMult,
					cash: keptCash,
					totalCash: keptCash,
					endgameCompleted: s.endgameCompleted,
				});
				localStorage.removeItem("flopsed-editor");
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

			setFlopSlider: (value: number) => {
				set({
					flopSlider: Math.min(1, Math.max(0, value)),
					autoArbitrageEnabled: false,
				});
			},
			setEffectiveLocPerKey: (value: number) => {
				set({ effectiveLocPerKey: value });
			},
			toggleAutoArbitrage: () => {
				set((s) => ({
					autoArbitrageEnabled: !s.autoArbitrageEnabled,
				}));
			},
			toggleAutoExecute: () => {
				set((s) => ({
					autoExecuteEnabled: !s.autoExecuteEnabled,
				}));
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
			name: "flopsed-save",
			partialize: (state) => ({
				loc: state.loc,
				totalLoc: state.totalLoc,
				cash: state.cash,
				totalCash: state.totalCash,
				tokens: state.tokens,
				blockQueue: state.blockQueue.slice(-20).map((b) => ({
					lines: [],
					loc: b.loc,
				})),
				currentTierIndex: state.currentTierIndex,
				ownedUpgrades: state.ownedUpgrades,
				ownedTechNodes: state.ownedTechNodes,
				autoTypeEnabled: state.autoTypeEnabled,
				autoExecuteEnabled: state.autoExecuteEnabled,
				autoPokeEnabled: state.autoPokeEnabled,
				flopSlider: state.flopSlider,
				autoArbitrageEnabled: state.autoArbitrageEnabled,
				reachedMilestones: state.reachedMilestones,
				editorStreamingMode: state.editorStreamingMode,
				tierTransitions: state.tierTransitions,
				purchaseLog: state.purchaseLog,
				/** Persist elapsed seconds so the session timer survives reload */
				_savedElapsed: (performance.now() - state.sessionStartTime) / 1000,
			}),
			onRehydrateStorage: () => (state) => {
				if (state) {
					// Restore sessionStartTime from persisted elapsed time
					const saved = (state as unknown as Record<string, unknown>)
						._savedElapsed as number | undefined;
					if (saved != null && saved > 0) {
						state.sessionStartTime = performance.now() - saved * 1000;
					}
					recalcDerivedStats(state);
				}
			},
		},
	),
);

export { getEffectiveMax, getTechNodeCost, getUpgradeCost };
