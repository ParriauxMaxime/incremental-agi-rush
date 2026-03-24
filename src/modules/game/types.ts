export interface Tier {
	id: string;
	index: number;
	name: string;
	tagline: string;
	cashPerLoc: number;
	locRequired: number;
	cashRequired: number;
	cost: number;
}

export interface UpgradeEffect {
	type: string;
	op: "add" | "multiply" | "enable" | "set";
	value: number | boolean | string;
	doubleInterval?: number;
}

export interface Upgrade {
	id: string;
	tier: string;
	name: string;
	description: string;
	icon: string;
	baseCost: number;
	costMultiplier: number;
	max: number;
	effects: UpgradeEffect[];
	/** Cost category for discount tech: "intern" or "dev" */
	costCategory?: string;
	codeQuality?: number;
	flopsCost?: number | string;
	/** Tech tree node IDs that must be researched before this upgrade appears */
	requires?: string[];
}

export const TechCurrencyEnum = {
	loc: "loc",
	cash: "cash",
} as const;

export type TechCurrencyEnum =
	(typeof TechCurrencyEnum)[keyof typeof TechCurrencyEnum];

export interface TechNode {
	id: string;
	name: string;
	description: string;
	icon: string;
	requires: string[];
	max: number;
	baseCost: number;
	costMultiplier: number;
	currency: TechCurrencyEnum;
	effects: UpgradeEffect[];
	levelLabels?: string[];
	/** Position from tech tree editor */
	x?: number;
	y?: number;
}

export interface Milestone {
	id: string;
	name: string;
	description: string;
	condition: string;
	threshold: number;
	metric: string;
}

/** A completed code block waiting in the execution queue */
export interface QueuedBlock {
	/** Lines of HTML for display */
	lines: string[];
	/** How many LoC this block is worth */
	loc: number;
}

export interface GameState {
	// Resources
	loc: number;
	totalLoc: number;
	cash: number;
	totalCash: number;
	totalExecutedLoc: number;
	flops: number;

	// Hardware breakdown (computed from tech tree)
	cpuFlops: number;
	ramFlops: number;
	storageFlops: number;

	// Block queue: completed blocks waiting to be executed by FLOPS
	blockQueue: QueuedBlock[];
	// Accumulated FLOPS progress toward consuming the next block
	executionProgress: number;

	// Computed rates (recalculated on upgrade purchase)
	locPerKey: number;
	autoLocPerSec: number;
	locProductionMultiplier: number;
	cashMultiplier: number;
	freelancerCostDiscount: number;
	internCostDiscount: number;
	devCostDiscount: number;
	teamCostDiscount: number;
	managerCostDiscount: number;
	llmCostDiscount: number;
	agentCostDiscount: number;
	// Max bonuses from tech tree
	freelancerMaxBonus: number;
	internMaxBonus: number;
	teamMaxBonus: number;
	managerMaxBonus: number;
	llmMaxBonus: number;
	agentMaxBonus: number;
	/** Model IDs unlocked via tech tree (modelUnlock effect) */
	unlockedModels: Record<string, boolean>;
	/** FLOPS allocation: 0–1 where 1 = 100% execution, 0 = 100% AI generation */
	flopSlider: number;
	/** Accumulator for fractional AI-generated LoC between ticks (not persisted) */
	aiLocAccumulator: number;
	/** Whether any AI model is unlocked (derived from unlockedModels) */
	aiUnlocked: boolean;

	// Progression
	currentTierIndex: number;
	ownedUpgrades: Record<string, number>;
	ownedTechNodes: Record<string, number>;
	autoTypeEnabled: boolean;
	/** Whether the execution pipeline is running (processing LoC → cash) */
	running: boolean;
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
	/** Add raw LoC (called per token typed) */
	addLoc: (amount: number) => void;
	/** Add a completed block to the execution queue */
	enqueueBlock: (block: QueuedBlock) => void;
	tick: (dt: number) => void;
	buyUpgrade: (upgrade: Upgrade) => void;
	/** Research a tech node (costs LoC) */
	researchNode: (node: TechNode) => void;
	/** Toggle auto-type on/off */
	toggleAutoType: () => void;
	/** Toggle execution pipeline running/stopped */
	toggleRunning: () => void;
	/** God mode: directly set resource values */
	godSet: (overrides: GodModeOverrides) => void;
	/** Reset the entire game state */
	reset: () => void;
	/** Force recalculation of derived stats (called when external modifiers change) */
	recalc: () => void;
	/** Apply instant cash/loc reward from events */
	applyEventReward: (cashDelta: number, locDelta: number) => void;
	/** Set FLOPS allocation slider (0 = all AI, 1 = all execution) */
	setFlopSlider: (value: number) => void;
}
