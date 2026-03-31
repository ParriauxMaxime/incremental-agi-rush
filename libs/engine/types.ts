export const AiStrategyEnum = {
	balanced: "balanced",
	exec_heavy: "exec_heavy",
	ai_heavy: "ai_heavy",
} as const;
export type AiStrategyEnum =
	(typeof AiStrategyEnum)[keyof typeof AiStrategyEnum];

export const PurchaseTypeEnum = {
	upgrade: "upgrade",
	tier: "tier",
	tech: "tech",
	ai: "ai",
} as const;
export type PurchaseTypeEnum =
	(typeof PurchaseTypeEnum)[keyof typeof PurchaseTypeEnum];

export interface SimConfig {
	keysPerSec: number;
	skill: number;
	aiStrategy: AiStrategyEnum;
	maxMinutes: number;
}

export interface SimSnapshot {
	time: number;
	cash: number;
	loc: number;
	flops: number;
	quality: number;
	locPerSec: number;
	cashPerSec: number;
	tokensPerSec: number;
	tier: number;
}

export interface SimLogEntry {
	time: number;
	type: string;
	msg: string;
	cash: number;
	loc: number;
	flops: number;
}

export interface SimPurchaseSnapshot {
	cash: number;
	loc: number;
	flops: number;
	locPerSec: number;
	cashPerSec: number;
	tier: number;
	quality: number;
}

export interface SimPurchase {
	time: number;
	type: PurchaseTypeEnum;
	name: string;
	cost?: number;
	currency?: string;
	snapshot?: SimPurchaseSnapshot;
}

export interface IdleGap {
	start: number;
	end: number;
	duration: number;
	nextPurchase: string;
	tier: number;
}

export interface IdleStats {
	totalIdleTime: number;
	idlePercent: number;
	gaps: IdleGap[];
	avgGap: number;
	medianGap: number;
}

export interface SimResult {
	agiTime: number | null;
	endTime: number;
	purchaseCount: number;
	longestWait: number;
	tierTimes: Record<number, number>;
	totalCash: number;
	totalLoc: number;
	finalTier: number;
	finalQuality: number;
	aiModelsOwned: number;
	passed: boolean;
	failures: string[];
	snapshots: SimSnapshot[];
	log: SimLogEntry[];
	purchases: SimPurchase[];
	idle: IdleStats;
}

// Internal data interfaces used by balance-sim

export interface SimEventEffect {
	type: string;
	op?: string;
	value?: number | string;
	threshold?: string;
	reward?: string;
	upgradeId?: string;
	options?: Array<{
		label: string;
		effect: {
			type: string;
			op?: string;
			value?: number | string;
			duration?: number;
		};
	}>;
}

export interface SimEvent {
	id: string;
	name: string;
	minTier: string;
	maxTier?: string;
	duration: number;
	effects: SimEventEffect[];
	interaction?: { type: string; reductionPerKey: number };
	weight: number;
}

export interface AiModel {
	id: string;
	name: string;
	version: string;
	locPerSec: number;
	flopsCost: number;
	tokenCost: number;
	cost: number;
	requires?: string;
}

export interface TechNodeData {
	id: string;
	name: string;
	requires: string[];
	max: number;
	baseCost: number;
	costMultiplier: number;
	currency: string;
	effects: Array<{
		type: string;
		op: string;
		value: number | boolean | string;
	}>;
}

export interface UpgradeData {
	id: string;
	tier: string;
	name: string;
	baseCost: number;
	costMultiplier: number;
	max: number;
	costCategory?: string;
	effects: Array<{
		type: string;
		op: string;
		value: number | boolean | string;
	}>;
}

// Data parameter interface for passing live-edited data from editor
export interface SimData {
	aiModels: Array<{
		id: string;
		name: string;
		version: string;
		locPerSec: number;
		flopsCost: number;
		tokenCost: number;
		cost: number;
		requires?: string;
	}>;
	balance: {
		core: {
			startingFlops: number;
			startingLocPerKey: number;
			agiLocTarget?: number;
			[key: string]: unknown;
		};
		flopsAllocation: {
			defaultSplit: number;
			[key: string]: unknown;
		};
		[key: string]: unknown;
	};
	events: {
		events: Array<{
			id: string;
			name: string;
			minTier: string;
			duration: number;
			effects: Array<{
				type: string;
				op?: string;
				value?: number | string;
				threshold?: string;
				reward?: string;
				upgradeId?: string;
				options?: Array<{
					label: string;
					effect: {
						type: string;
						op?: string;
						value?: number | string;
						duration?: number;
					};
				}>;
			}>;
			interaction?: { type: string; reductionPerKey: number };
			weight: number;
		}>;
		eventConfig: {
			minIntervalSeconds: number;
			maxIntervalSeconds: number;
			[key: string]: unknown;
		};
	};
	techTree: {
		nodes: Array<{
			id: string;
			name: string;
			requires: string[];
			max: number;
			baseCost: number;
			costMultiplier: number;
			currency: string;
			effects: Array<{
				type: string;
				op: string;
				value: number | boolean | string;
			}>;
		}>;
	};
	tiers: {
		tiers: Array<{
			id: string;
			index: number;
			cashPerLoc: number;
			[key: string]: unknown;
		}>;
	};
	upgrades: {
		upgrades: Array<{
			id: string;
			tier: string;
			name: string;
			baseCost: number;
			costMultiplier: number;
			max: number;
			costCategory?: string;
			effects: Array<{
				type: string;
				op: string;
				value: number | boolean | string;
			}>;
		}>;
	};
}
