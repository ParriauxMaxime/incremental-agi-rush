import aiModelsData from "../../specs/data/ai-models.json";
import balanceData from "../../specs/data/balance.json";
import eventsData from "../../specs/data/events.json";
import techTreeData from "../../specs/data/tech-tree.json";
import tiersData from "../../specs/data/tiers.json";
import upgradesData from "../../specs/data/upgrades.json";

// ── Event types ──

interface SimEventEffect {
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

interface SimEvent {
	id: string;
	name: string;
	minTier: string;
	duration: number;
	effects: SimEventEffect[];
	interaction?: { type: string; reductionPerKey: number };
	weight: number;
}

const simEvents = eventsData.events as SimEvent[];
const simEventConfig = eventsData.eventConfig;

// ── Seeded PRNG (mulberry32) ──

function createPrng(seed: number): () => number {
	let s = seed;
	return () => {
		s |= 0;
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// ── Types ──

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

// ── Data ──

interface AiModel {
	id: string;
	name: string;
	version: string;
	locPerSec: number;
	flopsCost: number;
	cost: number;
	requires?: string;
}

interface TechNodeData {
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

interface UpgradeData {
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

const tiers = tiersData.tiers;
const upgrades = upgradesData.upgrades as UpgradeData[];
const techNodes = techTreeData.nodes as TechNodeData[];
const aiModels: AiModel[] = aiModelsData.models as AiModel[];
const { core, flopsAllocation } = balanceData;

const RULES = {
	agiMinMinutes: 18,
	agiMaxMinutes: 40,
	maxWaitSeconds: 300,
	minPurchases: 80,
	maxPurchases: 500,
};

const DEFAULT_CONFIG: SimConfig = {
	keysPerSec: 6,
	skill: 0.8,
	aiStrategy: AiStrategyEnum.balanced,
	maxMinutes: 60,
};

// ── Simulation (synced with specs/balance-check.js) ──

export function runBalanceSim(config: Partial<SimConfig> = {}): SimResult {
	const cfg = { ...DEFAULT_CONFIG, ...config };

	const sim = {
		cash: 0,
		totalCash: 0,
		loc: 0,
		totalLoc: 0,
		flops: core.startingFlops,
		cpuFlops: 0,
		ramFlops: 0,
		storageFlops: 0,
		locPerKey: core.startingLocPerKey,
		locPerKeyMultiplier: 1,
		locProductionMultiplier: 1,
		internLoc: 0,
		devLoc: 0,
		teamLoc: 0,
		managerCount: 0,
		internLocMultiplier: 1,
		devLocMultiplier: 1,
		teamLocMultiplier: 1,
		managerMultiplier: 1,
		devSpeedMultiplier: 1,
		cashMultiplier: 1,
		aiLocMultiplier: 1,
		freelancerLoc: 0,
		freelancerLocMultiplier: 1,
		freelancerCostDiscount: 1,
		freelancerMaxBonus: 0,
		internCostDiscount: 1,
		devCostDiscount: 1,
		teamCostDiscount: 1,
		managerCostDiscount: 1,
		llmLoc: 0,
		agentLoc: 0,
		llmLocMultiplier: 1,
		agentLocMultiplier: 1,
		llmCostDiscount: 1,
		agentCostDiscount: 1,
		internMaxBonus: 0,
		teamMaxBonus: 0,
		managerMaxBonus: 0,
		llmMaxBonus: 0,
		agentMaxBonus: 0,
		codeQuality: 100,
		currentTier: 0,
		owned: {} as Record<string, number>,
		ownedTech: {} as Record<string, number>,
		ownedModels: {} as Record<string, boolean>,
		aiUnlocked: false,
		flopSlider: flopsAllocation.defaultSplit,
		autoTypeEnabled: false,
	};

	// ── Event simulation state ──
	const prng = createPrng(42);
	let nextEventSpawn =
		simEventConfig.minIntervalSeconds +
		prng() *
			(simEventConfig.maxIntervalSeconds - simEventConfig.minIntervalSeconds);
	let activeSimEvent: {
		id: string;
		remainingDuration: number;
		effects: SimEventEffect[];
	} | null = null;

	// Event modifier accumulators
	let eventFlopsMultiplier = 1;
	let eventFlopsOverride: number | null = null;
	let eventCashMultiplier = 1;
	let eventLocProductionMultiplier = 1;
	let eventLocPerKeyMultiplier = 1;
	let eventAutoLocMultiplier = 1;

	const tierIdToIndex: Record<string, number> = {};
	for (let i = 0; i < tiers.length; i++) {
		tierIdToIndex[tiers[i].id] = i;
	}

	function resolveSimExpression(expr: number | string): number {
		if (typeof expr === "number") return expr;
		const locPerSec =
			effLocPerKey() * cfg.keysPerSec +
			(sim.autoTypeEnabled ? effLocPerKey() * 5 : 0) +
			calcAutoLoc();
		return expr
			.replace(/currentCash/g, String(sim.cash))
			.replace(/currentLoc/g, String(sim.loc))
			.replace(/currentLocPerSec/g, String(locPerSec))
			.split("*")
			.map((s) => Number.parseFloat(s.trim()))
			.reduce((a, b) => a * b, 1);
	}

	function pickSimEvent(): SimEvent | null {
		const eligible = simEvents.filter(
			(e) => (tierIdToIndex[e.minTier] ?? 0) <= sim.currentTier,
		);
		if (eligible.length === 0) return null;
		const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
		let roll = prng() * totalWeight;
		for (const e of eligible) {
			roll -= e.weight;
			if (roll <= 0) return e;
		}
		return eligible[eligible.length - 1];
	}

	function resetEventModifiers(): void {
		eventFlopsMultiplier = 1;
		eventFlopsOverride = null;
		eventCashMultiplier = 1;
		eventLocProductionMultiplier = 1;
		eventLocPerKeyMultiplier = 1;
		eventAutoLocMultiplier = 1;
	}

	function applySimEventModifiers(): void {
		resetEventModifiers();
		if (!activeSimEvent) return;
		for (const eff of activeSimEvent.effects) {
			if (
				eff.type === "flops" &&
				eff.op === "multiply" &&
				typeof eff.value === "number"
			)
				eventFlopsMultiplier *= eff.value;
			if (
				eff.type === "flops" &&
				eff.op === "set" &&
				typeof eff.value === "number"
			)
				eventFlopsOverride = eff.value;
			if (
				eff.type === "locPerKey" &&
				eff.op === "multiply" &&
				typeof eff.value === "number"
			)
				eventLocPerKeyMultiplier *= eff.value;
			if (
				eff.type === "locProduction" &&
				eff.op === "multiply" &&
				typeof eff.value === "number"
			)
				eventLocProductionMultiplier *= eff.value;
			if (
				eff.type === "autoLoc" &&
				eff.op === "multiply" &&
				typeof eff.value === "number"
			)
				eventAutoLocMultiplier *= eff.value;
			if (
				eff.type === "cashMultiplier" &&
				eff.op === "multiply" &&
				typeof eff.value === "number"
			)
				eventCashMultiplier *= eff.value;
			if (
				eff.type === "codeQuality" &&
				eff.op === "add" &&
				typeof eff.value === "number"
			)
				sim.codeQuality = Math.max(
					0,
					Math.min(100, sim.codeQuality + eff.value),
				);
			// disableUpgrade: skip in sim (minor effect, upgrade temporarily disabled)
		}
	}

	const techGatedModels: Record<string, string> = {
		gpt_3: "openai_gpt3",
		gpt_35: "openai_gpt35",
		gpt_4: "openai_gpt4",
		gpt_41: "openai_gpt41",
		gpt_5: "openai_gpt5",
		claude_haiku: "anthropic_haiku",
		claude_sonnet: "anthropic_sonnet",
		claude_opus: "anthropic_opus",
	};

	const log: SimLogEntry[] = [];
	const snapshots: SimSnapshot[] = [];
	const purchases: SimPurchase[] = [];

	function getEffMax(u: UpgradeData): number {
		let bonus = 0;
		if (u.costCategory === "freelancer") bonus = sim.freelancerMaxBonus;
		if (u.costCategory === "intern") bonus = sim.internMaxBonus;
		if (u.costCategory === "team") bonus = sim.teamMaxBonus;
		if (u.costCategory === "manager") bonus = sim.managerMaxBonus;
		if (u.costCategory === "llm") bonus = sim.llmMaxBonus;
		if (u.costCategory === "agent") bonus = sim.agentMaxBonus;
		return u.max + bonus;
	}

	function getTechCost(node: TechNodeData): number {
		const owned = sim.ownedTech[node.id] ?? 0;
		return Math.floor(node.baseCost * node.costMultiplier ** owned);
	}

	function getCost(u: UpgradeData): number {
		const owned = sim.owned[u.id] ?? 0;
		let cost = Math.floor(u.baseCost * u.costMultiplier ** owned);
		if (u.costCategory === "freelancer")
			cost = Math.floor(cost * sim.freelancerCostDiscount);
		if (u.costCategory === "intern")
			cost = Math.floor(cost * sim.internCostDiscount);
		if (u.costCategory === "dev") cost = Math.floor(cost * sim.devCostDiscount);
		if (u.costCategory === "team")
			cost = Math.floor(cost * sim.teamCostDiscount);
		if (u.costCategory === "manager")
			cost = Math.floor(cost * sim.managerCostDiscount);
		if (u.costCategory === "llm") cost = Math.floor(cost * sim.llmCostDiscount);
		if (u.costCategory === "agent")
			cost = Math.floor(cost * sim.agentCostDiscount);
		return Math.max(1, cost);
	}

	function totalFlops(): number {
		if (eventFlopsOverride !== null) return eventFlopsOverride;
		const hw = Math.min(sim.cpuFlops, sim.ramFlops) + sim.storageFlops;
		return (sim.flops + hw) * eventFlopsMultiplier;
	}

	function cashPerLoc(): number {
		return (
			tiers[sim.currentTier].cashPerLoc *
			sim.cashMultiplier *
			eventCashMultiplier *
			(sim.codeQuality / 100)
		);
	}

	function effLocPerKey(): number {
		return sim.locPerKey * sim.locPerKeyMultiplier * eventLocPerKeyMultiplier;
	}

	function applyEffects(
		effects: Array<{
			type: string;
			op: string;
			value: number | boolean | string;
		}>,
	): void {
		for (const e of effects) {
			const val = e.value as number;
			if (e.type === "locPerKey" && e.op === "add") sim.locPerKey += val;
			if (e.type === "locPerKey" && e.op === "multiply")
				sim.locPerKeyMultiplier *= val;
			if (e.type === "flops" && e.op === "add") sim.flops += val;
			if (e.type === "cpuFlops" && e.op === "add") sim.cpuFlops += val;
			if (e.type === "ramFlops" && e.op === "add") sim.ramFlops += val;
			if (e.type === "storageFlops" && e.op === "add") sim.storageFlops += val;
			if (e.type === "autoLoc" && e.op === "add") sim.devLoc += val;
			if (e.type === "freelancerLoc" && e.op === "add")
				sim.freelancerLoc += val;
			if (e.type === "freelancerLocMultiplier" && e.op === "multiply")
				sim.freelancerLocMultiplier *= val;
			if (e.type === "freelancerCostDiscount" && e.op === "multiply")
				sim.freelancerCostDiscount *= val;
			if (e.type === "freelancerMaxBonus" && e.op === "add")
				sim.freelancerMaxBonus += val;
			if (e.type === "internLoc" && e.op === "add") sim.internLoc += val;
			if (e.type === "devLoc" && e.op === "add") sim.devLoc += val;
			if (e.type === "teamLoc" && e.op === "add") sim.teamLoc += val;
			if (e.type === "managerLoc" && e.op === "add") sim.managerCount += val;
			if (e.type === "devSpeed" && e.op === "multiply")
				sim.devSpeedMultiplier *= val;
			if (e.type === "locProductionSpeed" && e.op === "multiply")
				sim.locProductionMultiplier *= val;
			if (e.type === "cashMultiplier" && e.op === "multiply")
				sim.cashMultiplier *= val;
			if (e.type === "internLocMultiplier" && e.op === "multiply")
				sim.internLocMultiplier *= val;
			if (e.type === "devLocMultiplier" && e.op === "multiply")
				sim.devLocMultiplier *= val;
			if (e.type === "teamLocMultiplier" && e.op === "multiply")
				sim.teamLocMultiplier *= val;
			if (e.type === "managerMultiplier" && e.op === "multiply")
				sim.managerMultiplier *= val;
			if (e.type === "internCostDiscount" && e.op === "multiply")
				sim.internCostDiscount *= val;
			if (e.type === "devCostDiscount" && e.op === "multiply")
				sim.devCostDiscount *= val;
			if (e.type === "teamCostDiscount" && e.op === "multiply")
				sim.teamCostDiscount *= val;
			if (e.type === "managerCostDiscount" && e.op === "multiply")
				sim.managerCostDiscount *= val;
			if (e.type === "llmLoc" && e.op === "add") sim.llmLoc += val;
			if (e.type === "agentLoc" && e.op === "add") sim.agentLoc += val;
			if (e.type === "llmLocMultiplier" && e.op === "multiply")
				sim.llmLocMultiplier *= val;
			if (e.type === "agentLocMultiplier" && e.op === "multiply")
				sim.agentLocMultiplier *= val;
			if (e.type === "llmCostDiscount" && e.op === "multiply")
				sim.llmCostDiscount *= val;
			if (e.type === "agentCostDiscount" && e.op === "multiply")
				sim.agentCostDiscount *= val;
			if (e.type === "aiLocMultiplier" && e.op === "multiply")
				sim.aiLocMultiplier *= val;
			if (e.type === "instantCash" && e.op === "add") {
				sim.cash += val;
				sim.totalCash += val;
			}
			if (e.type === "internMaxBonus" && e.op === "add")
				sim.internMaxBonus += val;
			if (e.type === "teamMaxBonus" && e.op === "add") sim.teamMaxBonus += val;
			if (e.type === "managerMaxBonus" && e.op === "add")
				sim.managerMaxBonus += val;
			if (e.type === "llmMaxBonus" && e.op === "add") sim.llmMaxBonus += val;
			if (e.type === "agentMaxBonus" && e.op === "add")
				sim.agentMaxBonus += val;
			if (e.type === "autoType" && e.op === "enable")
				sim.autoTypeEnabled = true;
			if (e.type === "tierUnlock" && e.op === "set")
				sim.currentTier = Math.max(sim.currentTier, val);
		}
	}

	function calcAutoLoc(): number {
		const managerTeamBonus = 1 + sim.managerCount * 0.5 * sim.managerMultiplier;
		return (
			(sim.freelancerLoc * sim.freelancerLocMultiplier +
				sim.internLoc * sim.internLocMultiplier +
				sim.devLoc * sim.devLocMultiplier * sim.devSpeedMultiplier +
				sim.teamLoc * sim.teamLocMultiplier * managerTeamBonus +
				sim.llmLoc * sim.llmLocMultiplier +
				sim.agentLoc * sim.agentLocMultiplier) *
			sim.locProductionMultiplier *
			eventAutoLocMultiplier *
			eventLocProductionMultiplier
		);
	}

	const agiTarget =
		"agiLocTarget" in core ? (core.agiLocTarget as number) : 200000000;
	const maxSeconds = cfg.maxMinutes * 60;
	let purchaseCount = 0;
	let lastPurchaseTime = 0;
	let longestWait = 0;
	let agiTime: number | null = null;
	const tierTimes: Record<number, number> = { 0: 0 };
	let endTime = 0;

	for (let t = 0; t < maxSeconds; t++) {
		endTime = t;
		// ── Event tick ──
		if (activeSimEvent) {
			if (
				activeSimEvent.effects.some(
					(e) =>
						e.type !== "choice" &&
						e.type !== "disableUpgrade" &&
						e.type !== "codeQuality",
				)
			) {
				// Mash events: reduce duration by keysPerSec * reductionPerKey per second
				const mashInteraction = simEvents.find(
					(e) => e.id === activeSimEvent?.id,
				)?.interaction;
				if (mashInteraction?.type === "mash_keys") {
					activeSimEvent.remainingDuration -=
						cfg.keysPerSec * mashInteraction.reductionPerKey;
				}
			}
			activeSimEvent.remainingDuration -= 1;
			if (activeSimEvent.remainingDuration <= 0) {
				activeSimEvent = null;
				resetEventModifiers();
			}
		}

		if (!activeSimEvent && t >= nextEventSpawn) {
			const picked = pickSimEvent();
			if (picked) {
				if (picked.duration === 0) {
					// Instant event
					for (const eff of picked.effects) {
						if (eff.type === "instantCash" && eff.value !== undefined) {
							const amount = resolveSimExpression(eff.value);
							sim.cash += amount;
							sim.totalCash += amount;
						}
						if (eff.type === "instantLoc" && eff.value !== undefined) {
							const amount = resolveSimExpression(eff.value);
							sim.loc += amount;
							sim.totalLoc += amount;
						}
						if (
							eff.type === "codeQuality" &&
							eff.op === "add" &&
							typeof eff.value === "number"
						) {
							sim.codeQuality = Math.max(
								0,
								Math.min(100, sim.codeQuality + eff.value),
							);
						}
						if (
							eff.type === "conditionalCash" &&
							eff.threshold !== undefined &&
							eff.reward !== undefined
						) {
							const threshold = resolveSimExpression(eff.threshold);
							const locPerSec =
								effLocPerKey() * cfg.keysPerSec +
								(sim.autoTypeEnabled ? effLocPerKey() * 5 : 0) +
								calcAutoLoc();
							if (locPerSec >= threshold) {
								const reward = resolveSimExpression(eff.reward);
								sim.cash += reward;
								sim.totalCash += reward;
							}
						}
						if (
							eff.type === "choice" &&
							eff.options &&
							eff.options.length > 0
						) {
							// Simplification: always pick first option (safe choice)
							const chosen = eff.options[0];
							const chosenEff = chosen.effect;
							if (
								chosenEff.type === "cash" &&
								chosenEff.op === "multiply" &&
								typeof chosenEff.value === "number"
							) {
								sim.cash *= chosenEff.value;
							}
							if (
								chosenEff.type === "instantCash" &&
								chosenEff.value !== undefined
							) {
								const amount = resolveSimExpression(chosenEff.value);
								sim.cash += amount;
								sim.totalCash += amount;
							}
							if (
								chosenEff.type === "codeQuality" &&
								chosenEff.op === "add" &&
								typeof chosenEff.value === "number"
							) {
								sim.codeQuality = Math.max(
									0,
									Math.min(100, sim.codeQuality + chosenEff.value),
								);
							}
							// If choice option has a duration, spawn as timed buff
							if (chosenEff.duration && chosenEff.duration > 0) {
								activeSimEvent = {
									id: picked.id,
									remainingDuration: chosenEff.duration,
									effects: [
										{
											type: chosenEff.type,
											op: chosenEff.op,
											value: chosenEff.value,
										},
									],
								};
							}
						}
					}
				} else {
					// Duration-based event
					activeSimEvent = {
						id: picked.id,
						remainingDuration: picked.duration,
						effects: picked.effects,
					};
				}
			}
			// Schedule next spawn
			nextEventSpawn =
				t +
				simEventConfig.minIntervalSeconds +
				prng() *
					(simEventConfig.maxIntervalSeconds -
						simEventConfig.minIntervalSeconds);
		}

		applySimEventModifiers();

		const flops = totalFlops();

		// ── Produce LoC ──
		const manualLoc = effLocPerKey() * cfg.keysPerSec;
		const autoTypeLoc = sim.autoTypeEnabled ? effLocPerKey() * 5 : 0;
		const autoLoc = calcAutoLoc();
		sim.loc += manualLoc + autoTypeLoc + autoLoc;
		sim.totalLoc += manualLoc + autoTypeLoc + autoLoc;

		// ── AI + execution ──
		let aiLoc = 0;
		if (sim.aiUnlocked) {
			const aiFlops = flops * (1 - sim.flopSlider);
			let totalAiLoc = 0;
			let totalAiFlops = 0;
			for (const [id, v] of Object.entries(sim.ownedModels)) {
				if (!v) continue;
				const m = aiModels.find((x) => x.id === id);
				if (m) {
					totalAiLoc += m.locPerSec * sim.aiLocMultiplier;
					totalAiFlops += m.flopsCost;
				}
			}
			if (totalAiFlops > 0) {
				aiLoc = totalAiLoc * Math.min(1, aiFlops / totalAiFlops);
				sim.loc += aiLoc;
				sim.totalLoc += aiLoc;
			}
			const execFlops = flops * sim.flopSlider;
			const executed = Math.min(sim.loc, execFlops);
			sim.cash += executed * cashPerLoc();
			sim.totalCash += executed * cashPerLoc();
			sim.loc -= executed;
		} else {
			const executed = Math.min(sim.loc, flops);
			sim.cash += executed * cashPerLoc();
			sim.totalCash += executed * cashPerLoc();
			sim.loc -= executed;
		}
		sim.loc = Math.max(0, sim.loc);

		// ── Research tech nodes ──
		for (let b = 0; b < 5; b++) {
			const availTech = techNodes.filter((n) => {
				const owned = sim.ownedTech[n.id] ?? 0;
				if (owned >= n.max) return false;
				return n.requires.every((r) => (sim.ownedTech[r] ?? 0) > 0);
			});

			const freeNode = availTech.find((n) => getTechCost(n) === 0);
			if (freeNode) {
				sim.ownedTech[freeNode.id] = (sim.ownedTech[freeNode.id] ?? 0) + 1;
				applyEffects(freeNode.effects);
				purchaseCount++;
				continue;
			}

			const gateNode = availTech.find((n) => {
				const cost = getTechCost(n);
				const useLoc = n.currency === "loc";
				const canAfford = useLoc ? sim.loc >= cost : sim.cash >= cost;
				const isGate =
					n.effects.length === 0 ||
					n.effects.every((e) => e.type === "tierUnlock");
				return canAfford && isGate;
			});
			if (gateNode) {
				const cost = getTechCost(gateNode);
				if (gateNode.currency === "loc") sim.loc -= cost;
				else sim.cash -= cost;
				sim.ownedTech[gateNode.id] = (sim.ownedTech[gateNode.id] ?? 0) + 1;
				applyEffects(gateNode.effects);
				purchaseCount++;
				continue;
			}

			let bestTech: { node: TechNodeData; cost: number } | null = null;
			let bestTechVal = 0;

			for (const n of availTech) {
				const cost = getTechCost(n);
				const useLoc = n.currency === "loc";
				if (useLoc && cost > sim.loc) continue;
				if (!useLoc && cost > sim.cash) continue;
				let val = 0;
				for (const e of n.effects) {
					const ev = e.value as number;
					if (e.type === "flops") val += ev * cashPerLoc() * 2;
					if (e.type === "cpuFlops" || e.type === "ramFlops")
						val += ev * cashPerLoc() * 1.5;
					if (e.type === "storageFlops") val += ev * cashPerLoc();
					if (e.type === "locPerKey" && e.op === "add")
						val += ev * cfg.keysPerSec * cashPerLoc();
					if (e.type === "locPerKey" && e.op === "multiply")
						val += sim.locPerKey * (ev - 1) * cfg.keysPerSec * cashPerLoc();
					if (e.type === "locProductionSpeed" && e.op === "multiply")
						val += calcAutoLoc() * (ev - 1) * cashPerLoc();
					if (e.type === "autoType") val += 5 * effLocPerKey() * cashPerLoc();
					if (
						e.type === "internLocMultiplier" ||
						e.type === "devLocMultiplier" ||
						e.type === "teamLocMultiplier"
					)
						val += calcAutoLoc() * (ev - 1) * cashPerLoc();
					if (e.type === "cashMultiplier")
						val +=
							(calcAutoLoc() + effLocPerKey() * cfg.keysPerSec) *
							cashPerLoc() *
							(ev - 1);
					if (
						e.type === "internCostDiscount" ||
						e.type === "devCostDiscount" ||
						e.type === "teamCostDiscount" ||
						e.type === "managerCostDiscount"
					)
						val += 100;
					if (e.type === "modelUnlock") {
						const modelId = e.value as string;
						const model = aiModels.find((x) => x.id === modelId);
						if (model) {
							val +=
								(model.locPerSec * sim.aiLocMultiplier * cashPerLoc()) /
								(model.cost + cost);
						}
					}
				}
				if (cost > 0 && val / cost > bestTechVal) {
					bestTechVal = val / cost;
					bestTech = { node: n, cost };
				}
			}

			if (!bestTech) break;
			if (bestTech.node.currency === "loc") sim.loc -= bestTech.cost;
			else sim.cash -= bestTech.cost;
			sim.ownedTech[bestTech.node.id] =
				(sim.ownedTech[bestTech.node.id] ?? 0) + 1;
			applyEffects(bestTech.node.effects);
			purchaseCount++;
		}

		// ── Buy items ──
		let boughtThisTick = false;
		for (let b = 0; b < 5; b++) {
			const avail = upgrades.filter((u) => {
				const tier = tiers.find((t2) => t2.id === u.tier);
				return (
					tier &&
					tier.index <= sim.currentTier &&
					(sim.owned[u.id] ?? 0) < getEffMax(u)
				);
			});
			const availModels =
				sim.currentTier >= 4
					? aiModels.filter((m) => {
							if (sim.ownedModels[m.id]) return false;
							if (m.requires && !sim.ownedModels[m.requires]) return false;
							const gateNode = techGatedModels[m.id];
							if (gateNode && !(sim.ownedTech[gateNode] ?? 0)) return false;
							return true;
						})
					: [];

			const totalLocS =
				effLocPerKey() * cfg.keysPerSec + autoTypeLoc + calcAutoLoc() + aiLoc;
			const execCap = sim.aiUnlocked ? flops * sim.flopSlider : flops;
			const bottlenecked = totalLocS > execCap;

			let best: {
				type: "u" | "m";
				item: UpgradeData | AiModel;
				cost: number;
			} | null = null;
			let bestVal = 0;

			for (const u of avail) {
				const cost = getCost(u);
				if (cost > sim.cash) continue;
				let val = 0;
				for (const e of u.effects) {
					const ev = e.value as number;
					if (e.type === "flops")
						val += ev * cashPerLoc() * (bottlenecked ? 2 : 0.5);
					if (e.type === "locPerKey" && e.op === "add")
						val +=
							ev * cfg.keysPerSec * cashPerLoc() * (bottlenecked ? 0.3 : 1);
					if (
						e.type === "autoLoc" ||
						e.type === "freelancerLoc" ||
						e.type === "internLoc" ||
						e.type === "devLoc"
					)
						val += ev * cashPerLoc() * (bottlenecked ? 0.3 : 1);
					if (e.type === "teamLoc")
						val +=
							ev *
							cashPerLoc() *
							(1 + sim.managerCount * 0.5) *
							(bottlenecked ? 0.3 : 1);
					if (e.type === "managerLoc")
						val += sim.teamLoc * 0.5 * cashPerLoc() * (bottlenecked ? 0.3 : 1);
					if (e.type === "llmLoc" || e.type === "agentLoc")
						val += ev * cashPerLoc() * (bottlenecked ? 0.3 : 1);
					if (e.type === "cashMultiplier")
						val += Math.min(totalLocS, execCap) * cashPerLoc() * (ev - 1);
					if (e.type === "instantCash") val += ev / 60;
					if (e.type === "devSpeed" || e.type === "locProductionSpeed")
						val +=
							calcAutoLoc() *
							(ev - 1) *
							cashPerLoc() *
							(bottlenecked ? 0.3 : 1);
				}
				if (cost > 0 && val / cost > bestVal) {
					bestVal = val / cost;
					best = { type: "u", item: u, cost };
				}
			}

			for (const m of availModels) {
				if (m.cost > sim.cash) continue;
				const val = (m.locPerSec * sim.aiLocMultiplier * cashPerLoc()) / m.cost;
				if (val > bestVal) {
					bestVal = val;
					best = { type: "m", item: m, cost: m.cost };
				}
			}

			if (!best) break;

			if (best.type === "u") {
				const u = best.item as UpgradeData;
				sim.cash -= best.cost;
				sim.owned[u.id] = (sim.owned[u.id] ?? 0) + 1;
				applyEffects(u.effects);
				purchases.push({
					time: t,
					type: PurchaseTypeEnum.upgrade,
					name: u.name,
				});
			} else {
				const m = best.item as AiModel;
				sim.cash -= best.cost;
				sim.ownedModels[m.id] = true;
				if (!sim.aiUnlocked) {
					sim.aiUnlocked = true;
					if (cfg.aiStrategy === AiStrategyEnum.exec_heavy)
						sim.flopSlider = 0.7;
					else if (cfg.aiStrategy === AiStrategyEnum.ai_heavy)
						sim.flopSlider = 0.3;
					else sim.flopSlider = 0.5;
				}
				purchases.push({
					time: t,
					type: PurchaseTypeEnum.ai,
					name: `${m.name} ${m.version}`,
				});
			}
			purchaseCount++;
			boughtThisTick = true;
		}

		if (boughtThisTick) {
			const wait = t - lastPurchaseTime;
			if (wait > longestWait) longestWait = wait;
			lastPurchaseTime = t;
		}

		// ── Track tier changes ──
		if (!tierTimes[sim.currentTier]) {
			tierTimes[sim.currentTier] = t;
		}

		// ── Snapshot every 10s ──
		if (t % 10 === 0) {
			snapshots.push({
				time: t,
				cash: sim.totalCash,
				loc: sim.totalLoc,
				flops: totalFlops(),
				quality: sim.codeQuality,
				locPerSec: manualLoc + autoTypeLoc + autoLoc + aiLoc,
				cashPerSec:
					Math.min(manualLoc + autoTypeLoc + autoLoc + aiLoc, flops) *
					cashPerLoc(),
				tier: sim.currentTier,
			});
		}

		// ── AGI check ──
		if (sim.totalLoc >= agiTarget) {
			agiTime = t;
			break;
		}
	}

	// ── Validate ──
	const failures: string[] = [];
	if (agiTime === null) {
		failures.push("AGI never reached");
	} else {
		const min = agiTime / 60;
		if (min < RULES.agiMinMinutes)
			failures.push(`AGI too fast: ${min.toFixed(1)}m`);
		if (min > RULES.agiMaxMinutes)
			failures.push(`AGI too slow: ${min.toFixed(1)}m`);
	}
	if (purchaseCount < RULES.minPurchases)
		failures.push(`Too few purchases: ${purchaseCount}`);
	if (purchaseCount > RULES.maxPurchases)
		failures.push(`Too many purchases: ${purchaseCount}`);
	if (longestWait > RULES.maxWaitSeconds)
		failures.push(`Longest wait: ${longestWait}s`);

	return {
		agiTime,
		endTime,
		purchaseCount,
		longestWait,
		tierTimes,
		totalCash: sim.totalCash,
		totalLoc: sim.totalLoc,
		finalTier: sim.currentTier,
		finalQuality: sim.codeQuality,
		aiModelsOwned: Object.values(sim.ownedModels).filter(Boolean).length,
		passed: failures.length === 0,
		failures,
		snapshots,
		log,
		purchases,
	};
}
