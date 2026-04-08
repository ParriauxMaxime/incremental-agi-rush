import type { TechNode, Upgrade } from "@flopsed/domain";

interface CostDiscounts {
	freelancerCostDiscount: number;
	internCostDiscount: number;
	devCostDiscount: number;
	teamCostDiscount: number;
	managerCostDiscount: number;
	llmCostDiscount: number;
	agentCostDiscount: number;
}

interface MaxBonuses {
	freelancerMaxBonus: number;
	internMaxBonus: number;
	teamMaxBonus: number;
	managerMaxBonus: number;
	llmMaxBonus: number;
	agentMaxBonus: number;
}

export function getEffectiveMax(
	upgrade: Upgrade,
	bonuses?: MaxBonuses,
): number {
	if (!bonuses || !upgrade.costCategory) return upgrade.max;
	let bonus = 0;
	if (upgrade.costCategory === "freelancer") bonus = bonuses.freelancerMaxBonus;
	if (upgrade.costCategory === "intern") bonus = bonuses.internMaxBonus;
	if (upgrade.costCategory === "team") bonus = bonuses.teamMaxBonus;
	if (upgrade.costCategory === "manager") bonus = bonuses.managerMaxBonus;
	if (upgrade.costCategory === "llm") bonus = bonuses.llmMaxBonus;
	if (upgrade.costCategory === "agent") bonus = bonuses.agentMaxBonus;
	return upgrade.max + bonus;
}

export function getUpgradeCost(
	upgrade: Upgrade,
	owned: number,
	discounts?: CostDiscounts,
): number {
	let cost = Math.min(
		Number.MAX_SAFE_INTEGER,
		Math.floor(upgrade.baseCost * upgrade.costMultiplier ** owned),
	);
	if (discounts) {
		if (upgrade.costCategory === "freelancer")
			cost = Math.floor(cost * discounts.freelancerCostDiscount);
		if (upgrade.costCategory === "intern")
			cost = Math.floor(cost * discounts.internCostDiscount);
		if (upgrade.costCategory === "dev")
			cost = Math.floor(cost * discounts.devCostDiscount);
		if (upgrade.costCategory === "team")
			cost = Math.floor(cost * discounts.teamCostDiscount);
		if (upgrade.costCategory === "manager")
			cost = Math.floor(cost * discounts.managerCostDiscount);
		if (upgrade.costCategory === "llm")
			cost = Math.floor(cost * discounts.llmCostDiscount);
		if (upgrade.costCategory === "agent")
			cost = Math.floor(cost * discounts.agentCostDiscount);
	}
	return Math.max(1, cost);
}

export function getTechNodeCost(node: TechNode, owned: number): number {
	return Math.min(
		Number.MAX_SAFE_INTEGER,
		Math.floor(node.baseCost * node.costMultiplier ** owned),
	);
}
