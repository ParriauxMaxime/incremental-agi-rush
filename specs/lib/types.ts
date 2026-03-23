// ── Enum-style constants ──

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

// ── Simulation config & result types ──

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

export interface SimPurchase {
	time: number;
	type: PurchaseTypeEnum;
	name: string;
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
}

// ── Internal data interfaces ──

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

// ── Raw data parameter shape ──

export interface SimData {
	aiModels: AiModel[];
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
		events: SimEvent[];
		eventConfig: {
			minIntervalSeconds: number;
			maxIntervalSeconds: number;
			[key: string]: unknown;
		};
	};
	techTree: {
		nodes: TechNodeData[];
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
		upgrades: UpgradeData[];
	};
}
