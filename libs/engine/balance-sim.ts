import type {
	AiModel,
	SimConfig,
	SimData,
	SimEvent,
	SimEventEffect,
	SimLogEntry,
	SimPurchase,
	SimPurchaseSnapshot,
	SimResult,
	SimSnapshot,
	TechNodeData,
	UpgradeData,
} from "./types";
import { AiStrategyEnum, PurchaseTypeEnum } from "./types";

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

// ── Constants ──

const RULES = {
	agiMinMinutes: 25,
	agiMaxMinutes: 45,
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

export function runBalanceSim(
	data: SimData,
	config: Partial<SimConfig> = {},
): SimResult {
	const cfg = { ...DEFAULT_CONFIG, ...config };

	// ── Extract data ──
	const simEvents = data.events.events as SimEvent[];
	const simEventConfig = data.events.eventConfig;
	const tiers = data.tiers.tiers;
	const upgrades = data.upgrades.upgrades as UpgradeData[];
	const techNodes = data.techTree.nodes as TechNodeData[];
	const aiModels: AiModel[] = data.aiModels;
	const { core } = data.balance;

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
		llmHostSlots: 0,
		codeQuality: 100,
		currentTier: 0,
		owned: {} as Record<string, number>,
		ownedTech: {} as Record<string, number>,
		ownedModels: {} as Record<string, boolean>,
		aiUnlocked: false,
		autoTypeEnabled: false,
		autoExecuteEnabled: false,
		autoArbitrageEnabled: false,
		flopSlider: 0.7,
		manualExecCooldown: 0,
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
			(e) =>
				(tierIdToIndex[e.minTier] ?? 0) <= sim.currentTier &&
				(e.maxTier == null ||
					(tierIdToIndex[e.maxTier] ?? 5) >= sim.currentTier),
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

	/**
	 * Recalculate ALL derived stats from scratch — matches the game's
	 * recalcDerivedStats(). Loops over all owned upgrades and tech nodes,
	 * applying effects with val ** owned for multiply ops.
	 */
	function recalcSimStats(): void {
		// Reset to base values
		sim.locPerKey = core.startingLocPerKey;
		sim.locPerKeyMultiplier = 1;
		sim.flops = core.startingFlops;
		sim.cpuFlops = 0;
		sim.ramFlops = 0;
		sim.storageFlops = 0;
		sim.freelancerLoc = 0;
		sim.freelancerLocMultiplier = 1;
		sim.freelancerCostDiscount = 1;
		sim.freelancerMaxBonus = 0;
		sim.internLoc = 0;
		sim.internLocMultiplier = 1;
		sim.internCostDiscount = 1;
		sim.internMaxBonus = 0;
		sim.devLoc = 0;
		sim.devLocMultiplier = 1;
		sim.devCostDiscount = 1;
		sim.devSpeedMultiplier = 1;
		sim.teamLoc = 0;
		sim.teamLocMultiplier = 1;
		sim.teamCostDiscount = 1;
		sim.teamMaxBonus = 0;
		sim.managerCount = 0;
		sim.managerMultiplier = 1;
		sim.managerCostDiscount = 1;
		sim.managerMaxBonus = 0;
		sim.llmLoc = 0;
		sim.llmLocMultiplier = 1;
		sim.llmCostDiscount = 1;
		sim.llmMaxBonus = 0;
		sim.llmHostSlots = 0;
		sim.agentLoc = 0;
		sim.agentLocMultiplier = 1;
		sim.agentCostDiscount = 1;
		sim.agentMaxBonus = 0;
		sim.locProductionMultiplier = 1;
		sim.cashMultiplier = 1;
		sim.aiLocMultiplier = 1;
		sim.autoTypeEnabled = false;
		let tierIndex = sim.currentTier;

		function applyEffect(
			e: { type: string; op: string; value: number | boolean | string },
			owned: number,
		): void {
			const val = e.value as number;
			// Add effects scale linearly with owned count
			if (e.op === "add") {
				if (e.type === "locPerKey") sim.locPerKey += val * owned;
				if (e.type === "flops") sim.flops += val * owned;
				if (e.type === "cpuFlops") sim.cpuFlops += val * owned;
				if (e.type === "ramFlops") sim.ramFlops += val * owned;
				if (e.type === "storageFlops") sim.storageFlops += val * owned;
				if (e.type === "autoLoc") sim.devLoc += val * owned;
				if (e.type === "freelancerLoc") sim.freelancerLoc += val * owned;
				if (e.type === "freelancerMaxBonus")
					sim.freelancerMaxBonus += val * owned;
				if (e.type === "internLoc") sim.internLoc += val * owned;
				if (e.type === "devLoc") sim.devLoc += val * owned;
				if (e.type === "teamLoc") sim.teamLoc += val * owned;
				if (e.type === "managerLoc") sim.managerCount += val * owned;
				if (e.type === "internMaxBonus") sim.internMaxBonus += val * owned;
				if (e.type === "teamMaxBonus") sim.teamMaxBonus += val * owned;
				if (e.type === "managerMaxBonus") sim.managerMaxBonus += val * owned;
				if (e.type === "llmLoc") sim.llmLoc += val * owned;
				if (e.type === "agentLoc") sim.agentLoc += val * owned;
				if (e.type === "llmMaxBonus") sim.llmMaxBonus += val * owned;
				if (e.type === "agentMaxBonus") sim.agentMaxBonus += val * owned;
				if (e.type === "llmHostSlot") sim.llmHostSlots += val * owned;
			}
			// Multiply effects compound exponentially: val ** owned
			if (e.op === "multiply") {
				const mult = val ** owned;
				if (e.type === "locPerKey") sim.locPerKeyMultiplier *= mult;
				if (e.type === "locProductionSpeed")
					sim.locProductionMultiplier *= mult;
				if (e.type === "cashMultiplier") sim.cashMultiplier *= mult;
				if (e.type === "devSpeed") sim.devSpeedMultiplier *= mult;
				if (e.type === "freelancerLocMultiplier")
					sim.freelancerLocMultiplier *= mult;
				if (e.type === "freelancerCostDiscount")
					sim.freelancerCostDiscount *= mult;
				if (e.type === "internLocMultiplier") sim.internLocMultiplier *= mult;
				if (e.type === "devLocMultiplier") sim.devLocMultiplier *= mult;
				if (e.type === "teamLocMultiplier") sim.teamLocMultiplier *= mult;
				if (e.type === "managerMultiplier") sim.managerMultiplier *= mult;
				if (e.type === "internCostDiscount") sim.internCostDiscount *= mult;
				if (e.type === "devCostDiscount") sim.devCostDiscount *= mult;
				if (e.type === "teamCostDiscount") sim.teamCostDiscount *= mult;
				if (e.type === "managerCostDiscount") sim.managerCostDiscount *= mult;
				if (e.type === "llmLocMultiplier") sim.llmLocMultiplier *= mult;
				if (e.type === "agentLocMultiplier") sim.agentLocMultiplier *= mult;
				if (e.type === "llmCostDiscount") sim.llmCostDiscount *= mult;
				if (e.type === "agentCostDiscount") sim.agentCostDiscount *= mult;
				if (e.type === "aiLocMultiplier") sim.aiLocMultiplier *= mult;
			}
			if (e.type === "autoType" && e.op === "enable")
				sim.autoTypeEnabled = true;
			if (e.type === "autoExecute" && e.op === "enable")
				sim.autoExecuteEnabled = true;
			if (e.type === "autoArbitrage" && e.op === "enable")
				sim.autoArbitrageEnabled = true;
			if (e.type === "autoPoke" && e.op === "enable") {
				/* cosmetic only in sim */
			}
			if (e.type === "tierUnlock" && e.op === "set")
				tierIndex = Math.max(tierIndex, val);
			if (e.type === "modelUnlock" && e.op === "enable")
				sim.ownedModels[e.value as string] = true;
		}

		// Apply all tech node effects
		for (const node of techNodes) {
			const owned = sim.ownedTech[node.id] ?? 0;
			if (owned === 0) continue;
			for (const e of node.effects) applyEffect(e, owned);
		}

		// Apply all upgrade effects
		for (const u of upgrades) {
			const owned = sim.owned[u.id] ?? 0;
			if (owned === 0) continue;
			for (const e of u.effects) applyEffect(e, owned);
		}

		sim.currentTier = tierIndex;
		sim.aiUnlocked =
			sim.llmHostSlots > 0 && Object.values(sim.ownedModels).some(Boolean);
	}

	/** Apply effects for a newly purchased item (instant effects only — recalc handles the rest) */
	function applyInstantEffects(
		effects: Array<{
			type: string;
			op: string;
			value: number | boolean | string;
		}>,
	): void {
		for (const e of effects) {
			if (e.type === "instantCash" && e.op === "add") {
				const val = e.value as number;
				sim.cash += val;
				sim.totalCash += val;
			}
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

	function capturePurchaseSnapshot(): SimPurchaseSnapshot {
		const manualL = effLocPerKey() * cfg.keysPerSec;
		const autoTypeL = sim.autoTypeEnabled ? effLocPerKey() * 5 : 0;
		const autoL = calcAutoLoc();
		const totalLocS = manualL + autoTypeL + autoL;
		const fl = totalFlops();
		return {
			cash: sim.cash,
			loc: sim.loc,
			flops: fl,
			locPerSec: totalLocS,
			cashPerSec: Math.min(totalLocS, fl) * cashPerLoc(),
			tier: sim.currentTier,
			quality: sim.codeQuality,
		};
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
		const humanOutput = manualLoc + autoTypeLoc + autoLoc;

		// ── AI + token split + FLOPS slider + execution ──
		let aiLoc = 0;
		if (sim.aiUnlocked) {
			const activeModels = aiModels
				.filter((m) => sim.ownedModels[m.id])
				.sort((a, b) => a.flopsCost - b.flopsCost)
				.slice(0, sim.llmHostSlots);

			// Token split: humans produce tokens for AI, surplus → direct LoC
			let totalTokenDemand = 0;
			for (const m of activeModels) {
				totalTokenDemand += m.tokenCost;
			}
			const tokensProduced = Math.min(humanOutput, totalTokenDemand);
			const directLoc = humanOutput - tokensProduced;
			const tokenEfficiency =
				totalTokenDemand > 0 ? tokensProduced / totalTokenDemand : 0;

			// FLOPS slider split
			const aiFlops = flops * (1 - sim.flopSlider);
			const execFlops = flops * sim.flopSlider;

			// AI LoC (gated by tokens AND slider-allocated FLOPS, cheapest first)
			let remainingAiFlops = aiFlops;
			for (const m of activeModels) {
				const modelFlops = Math.min(m.flopsCost, remainingAiFlops);
				remainingAiFlops -= modelFlops;
				const ratio = m.flopsCost > 0 ? modelFlops / m.flopsCost : 0;
				aiLoc +=
					m.locPerSec *
					sim.aiLocMultiplier *
					tokenEfficiency *
					Math.min(1, ratio);
			}

			sim.loc += directLoc + aiLoc;
			sim.totalLoc += directLoc + aiLoc;
			const executed = Math.min(sim.loc, execFlops);
			sim.cash += executed * cashPerLoc();
			sim.totalCash += executed * cashPerLoc();
			sim.loc -= executed;

			// Auto-arbitrage: adjust slider for next tick
			if (sim.autoArbitrageEnabled) {
				let targetSlider = flops > 0 ? aiLoc / flops : 0.7;
				// Queue pressure bias
				if (sim.loc > execFlops * 5) targetSlider += 0.05;
				else if (sim.loc < execFlops * 1) targetSlider -= 0.05;
				targetSlider = Math.min(0.95, Math.max(0.1, targetSlider));
				sim.flopSlider += (targetSlider - sim.flopSlider) * 0.1;
				sim.flopSlider = Math.min(0.95, Math.max(0.1, sim.flopSlider));
			}
		} else if (sim.autoExecuteEnabled) {
			sim.loc += humanOutput;
			sim.totalLoc += humanOutput;
			const executed = Math.min(sim.loc, flops);
			sim.cash += executed * cashPerLoc();
			sim.totalCash += executed * cashPerLoc();
			sim.loc -= executed;
		} else {
			sim.loc += humanOutput;
			sim.totalLoc += humanOutput;
			// Manual execute: player clicks ~every 1.5-3s depending on skill
			// Each click executes (flops) LoC, same as game's executeManual()
			const clickInterval = 3 - cfg.skill * 1.5; // casual=2.1s, avg=1.8s, fast=1.58s
			sim.manualExecCooldown -= 1;
			if (sim.manualExecCooldown <= 0 && flops > 0 && sim.loc > 0) {
				const executed = Math.min(sim.loc, flops);
				sim.cash += executed * cashPerLoc();
				sim.totalCash += executed * cashPerLoc();
				sim.loc -= executed;
				sim.manualExecCooldown = clickInterval;
			}
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
				recalcSimStats();
				applyInstantEffects(freeNode.effects);
				purchaseCount++;
				const isTier = freeNode.effects.some((e) => e.type === "tierUnlock");
				purchases.push({
					time: t,
					type: isTier ? PurchaseTypeEnum.tier : PurchaseTypeEnum.tech,
					name: freeNode.name,
					cost: 0,
					currency: freeNode.currency,
					snapshot: capturePurchaseSnapshot(),
				});
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
				recalcSimStats();
				applyInstantEffects(gateNode.effects);
				purchaseCount++;
				const isTier = gateNode.effects.some((e) => e.type === "tierUnlock");
				purchases.push({
					time: t,
					type: isTier ? PurchaseTypeEnum.tier : PurchaseTypeEnum.tech,
					name: gateNode.name,
					cost,
					currency: gateNode.currency,
					snapshot: capturePurchaseSnapshot(),
				});
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
					if (e.type === "autoExecute") val += flops * cashPerLoc() * 10; // high priority: unlocks continuous execution
					if (
						e.type === "internLocMultiplier" ||
						e.type === "devLocMultiplier" ||
						e.type === "teamLocMultiplier" ||
						e.type === "freelancerLocMultiplier"
					)
						val += calcAutoLoc() * (ev - 1) * cashPerLoc();
					if (e.type === "freelancerCostDiscount") val += 100;
					if (e.type === "cashMultiplier")
						val +=
							(calcAutoLoc() + effLocPerKey() * cfg.keysPerSec) *
							cashPerLoc() *
							(ev - 1);
					if (
						e.type === "internCostDiscount" ||
						e.type === "devCostDiscount" ||
						e.type === "teamCostDiscount" ||
						e.type === "managerCostDiscount" ||
						e.type === "llmCostDiscount" ||
						e.type === "agentCostDiscount"
					)
						val += 100;
					if (e.type === "llmLocMultiplier")
						val += sim.llmLoc * sim.llmLocMultiplier * (ev - 1) * cashPerLoc();
					if (e.type === "agentLocMultiplier")
						val +=
							sim.agentLoc * sim.agentLocMultiplier * (ev - 1) * cashPerLoc();
					if (
						e.type === "llmMaxBonus" ||
						e.type === "agentMaxBonus" ||
						e.type === "internMaxBonus" ||
						e.type === "teamMaxBonus" ||
						e.type === "managerMaxBonus" ||
						e.type === "freelancerMaxBonus"
					)
						val += calcAutoLoc() * cashPerLoc() * 0.1;
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
			recalcSimStats();
			applyInstantEffects(bestTech.node.effects);
			purchaseCount++;
			const isModelUnlock = bestTech.node.effects.some(
				(e) => e.type === "modelUnlock",
			);
			purchases.push({
				time: t,
				type: isModelUnlock ? PurchaseTypeEnum.ai : PurchaseTypeEnum.tech,
				name: bestTech.node.name,
				cost: bestTech.cost,
				currency: bestTech.node.currency,
				snapshot: capturePurchaseSnapshot(),
			});
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
					if (e.type === "llmHostSlot") {
						const unlockedCount = Object.values(sim.ownedModels).filter(
							Boolean,
						).length;
						const activeCount = Math.min(unlockedCount, sim.llmHostSlots);
						if (activeCount < unlockedCount) {
							const sorted = aiModels
								.filter((m) => sim.ownedModels[m.id])
								.sort((a, b) => b.locPerSec - a.locPerSec);
							const nextModel = sorted[activeCount];
							if (nextModel) {
								val += nextModel.locPerSec * sim.aiLocMultiplier * cashPerLoc();
							}
						}
					}
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
				recalcSimStats();
				applyInstantEffects(u.effects);
				purchases.push({
					time: t,
					type: PurchaseTypeEnum.upgrade,
					name: u.name,
					cost: best.cost,
					currency: "cash",
					snapshot: capturePurchaseSnapshot(),
				});
			} else {
				const m = best.item as AiModel;
				sim.cash -= best.cost;
				sim.ownedModels[m.id] = true;
				recalcSimStats();
				purchases.push({
					time: t,
					type: PurchaseTypeEnum.ai,
					name: `${m.name} ${m.version}`,
					cost: best.cost,
					currency: "cash",
					snapshot: capturePurchaseSnapshot(),
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
			const snapExecFlops = sim.aiUnlocked ? flops * sim.flopSlider : flops;
			snapshots.push({
				time: t,
				cash: sim.totalCash,
				loc: sim.totalLoc,
				flops: totalFlops(),
				quality: sim.codeQuality,
				locPerSec: manualLoc + autoTypeLoc + autoLoc + aiLoc,
				cashPerSec:
					Math.min(manualLoc + autoTypeLoc + autoLoc + aiLoc, snapExecFlops) *
					cashPerLoc(),
				tokensPerSec: humanOutput,
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

	// Compute idle stats from purchase timestamps
	const gaps: import("./types").IdleGap[] = [];
	let prevPurchaseTime = 0;
	for (const p of purchases) {
		const gap = p.time - prevPurchaseTime;
		if (gap > 1) {
			gaps.push({
				start: prevPurchaseTime,
				end: p.time,
				duration: gap,
				nextPurchase: p.name,
				tier: tierTimes
					? Object.entries(tierTimes)
							.filter(([, t]) => t <= p.time)
							.sort(([, a], [, b]) => b - a)[0]?.[0]
						? Number(
								Object.entries(tierTimes)
									.filter(([, t]) => t <= p.time)
									.sort(([, a], [, b]) => b - a)[0][0],
							)
						: 0
					: 0,
			});
		}
		prevPurchaseTime = p.time;
	}
	const sortedGaps = [...gaps].sort((a, b) => a.duration - b.duration);
	const totalIdleTime = gaps.reduce((a, g) => a + g.duration, 0);
	const idle: import("./types").IdleStats = {
		totalIdleTime,
		idlePercent: endTime > 0 ? (totalIdleTime / endTime) * 100 : 0,
		gaps,
		avgGap: gaps.length > 0 ? totalIdleTime / gaps.length : 0,
		medianGap:
			sortedGaps.length > 0
				? sortedGaps[Math.floor(sortedGaps.length / 2)].duration
				: 0,
	};

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
		idle,
	};
}
