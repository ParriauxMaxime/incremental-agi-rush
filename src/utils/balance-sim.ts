import aiModelsData from "../../specs/data/ai-models.json";
import balanceData from "../../specs/data/balance.json";
import eventsData from "../../specs/data/events.json";
import techTreeData from "../../specs/data/tech-tree.json";
import tiersData from "../../specs/data/tiers.json";
import upgradesData from "../../specs/data/upgrades.json";
import { runBalanceSim as runBalanceSimCore } from "../../specs/lib/balance-sim";
import type { SimConfig, SimData } from "../../specs/lib/types";

export {
	AiStrategyEnum,
	PurchaseTypeEnum,
} from "../../specs/lib/types";

export type {
	AiModel,
	SimConfig,
	SimData,
	SimEvent,
	SimEventEffect,
	SimLogEntry,
	SimPurchase,
	SimResult,
	SimSnapshot,
	TechNodeData,
	UpgradeData,
} from "../../specs/lib/types";

const bundledData: SimData = {
	aiModels: aiModelsData.models as SimData["aiModels"],
	balance: balanceData as SimData["balance"],
	events: eventsData as SimData["events"],
	techTree: techTreeData as SimData["techTree"],
	tiers: tiersData as SimData["tiers"],
	upgrades: upgradesData as SimData["upgrades"],
};

export function runBalanceSim(config: Partial<SimConfig> = {}) {
	return runBalanceSimCore(bundledData, config);
}
