export const TierIdEnum = {
	garage: "garage",
	freelancing: "freelancing",
	startup: "startup",
	tech_company: "tech_company",
	ai_lab: "ai_lab",
	agi_race: "agi_race",
} as const;
export type TierIdEnum = (typeof TierIdEnum)[keyof typeof TierIdEnum];

/** Tier ID → numeric index (matches tiers.json order) */
export const TIER_INDEX: Record<TierIdEnum, number> = {
	garage: 0,
	freelancing: 1,
	startup: 2,
	tech_company: 3,
	ai_lab: 4,
	agi_race: 5,
};

export const EventEffectOpEnum = {
	add: "add",
	multiply: "multiply",
	set: "set",
} as const;
export type EventEffectOpEnum =
	(typeof EventEffectOpEnum)[keyof typeof EventEffectOpEnum];

export type EventEffect =
	| {
			type:
				| "flops"
				| "locPerKey"
				| "locProduction"
				| "autoLoc"
				| "cashMultiplier";
			op: "multiply";
			value: number;
	  }
	| { type: "flops"; op: "set"; value: number }
	| { type: "cash"; op: "multiply"; value: number }
	| { type: "instantCash"; op: "add"; value: string }
	| { type: "instantLoc"; op: "add"; value: number }
	| { type: "codeQuality"; op: "add"; value: number }
	| { type: "conditionalCash"; threshold: string; reward: string }
	| { type: "disableUpgrade"; upgradeId: string }
	| { type: "choice"; options: EventChoiceOption[] };

export interface EventChoiceOption {
	label: string;
	effect: EventEffect & { duration?: number };
}

export interface EventInteraction {
	type: "mash_keys";
	reductionPerKey: number;
}

export interface EventDefinition {
	id: string;
	name: string;
	description: string;
	icon: string;
	minTier: TierIdEnum;
	duration: number;
	effects: EventEffect[];
	interaction?: EventInteraction;
	weight: number;
}

export interface EventConfig {
	minIntervalSeconds: number;
	maxIntervalSeconds: number;
	maxConcurrent: number;
}

export interface ActiveEvent {
	definitionId: string;
	startedAt: number;
	remainingDuration: number;
	resolved: boolean;
	chosenOptionIndex?: number;
	/** true for synthetic events spawned by timed choice effects */
	synthetic: boolean;
	/** For synthetic events: parent event ID and chosen option index */
	parentEventId?: string;
	parentOptionIndex?: number;
}

export interface EventModifiers {
	flopsMultiplier: number;
	flopsOverride: number | null;
	locPerKeyMultiplier: number;
	autoLocMultiplier: number;
	cashMultiplier: number;
	locProductionMultiplier: number;
	disabledUpgrades: string[];
}

export const DEFAULT_EVENT_MODIFIERS: EventModifiers = {
	flopsMultiplier: 1,
	flopsOverride: null,
	locPerKeyMultiplier: 1,
	autoLocMultiplier: 1,
	cashMultiplier: 1,
	locProductionMultiplier: 1,
	disabledUpgrades: [],
};

export interface ExpressionContext {
	currentCash: number;
	currentLoc: number;
	currentLocPerSec: number;
}
