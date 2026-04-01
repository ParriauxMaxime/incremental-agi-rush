import type { TechNode, Upgrade } from "@flopsed/domain";
import { techNodes, tiers, upgrades } from "@flopsed/domain";
import { getTechNodeCost, getUpgradeCost } from "@flopsed/engine";
import { useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import type { CommandResult, FsNode } from "../types";
import { ShellLineTypeEnum } from "../types";

type GameState = {
	cash: number;
	loc: number;
	flops: number;
	tokens: number;
	currentTierIndex: number;
	aiUnlocked: boolean;
	autoExecuteEnabled: boolean;
	ownedUpgrades: Record<string, number>;
	ownedTechNodes: Record<string, number>;
	cashMultiplier: number;
	flopSlider: number;
	buyUpgrade: (upgrade: Upgrade) => void;
	researchNode: (node: TechNode) => void;
	executeManual: () => void;
	toggleAutoExecute: () => void;
};

function getGameStore(): GameState {
	return useGameStore.getState() as unknown as GameState;
}

export function cmdBuy(
	args: string[],
	_cwd: string,
	_root: FsNode,
): CommandResult {
	if (args.length === 0) {
		return {
			lines: [
				{
					type: ShellLineTypeEnum.error,
					text: "usage: buy <upgrade_id> [count]",
				},
			],
		};
	}

	const id = args[0];
	const count = Math.max(1, Number.parseInt(args[1] ?? "1", 10) || 1);
	const upgrade = upgrades.find((u) => u.id === id);

	if (!upgrade) {
		return {
			lines: [
				{
					type: ShellLineTypeEnum.error,
					text: `buy: unknown upgrade '${id}'`,
				},
			],
		};
	}

	const state = getGameStore();
	const owned = state.ownedUpgrades[id] ?? 0;

	if (owned >= upgrade.max) {
		return {
			lines: [
				{
					type: ShellLineTypeEnum.output,
					text: `${upgrade.name} is already maxed (${owned}/${upgrade.max})`,
				},
			],
		};
	}

	let purchased = 0;

	for (let i = 0; i < count; i++) {
		// Re-read state each iteration so cash and owned counts are fresh
		const s = getGameStore();
		const currentOwned = s.ownedUpgrades[id] ?? 0;
		if (currentOwned >= upgrade.max) break;
		const cost = getUpgradeCost(upgrade, currentOwned);
		if (s.cash < cost) break;
		s.buyUpgrade(upgrade);
		purchased++;
	}

	if (purchased === 0) {
		const freshState = getGameStore();
		const currentOwned = freshState.ownedUpgrades[id] ?? 0;
		const cost = getUpgradeCost(upgrade, currentOwned);
		return {
			lines: [
				{
					type: ShellLineTypeEnum.error,
					text: `Not enough cash. Need $${formatNumber(cost)}, have $${formatNumber(freshState.cash)}`,
				},
			],
		};
	}

	const finalOwned = getGameStore().ownedUpgrades[id] ?? 0;
	return {
		lines: [
			{
				type: ShellLineTypeEnum.output,
				text: `✓ Purchased ${upgrade.name}${purchased > 1 ? ` x${purchased}` : ""} (${finalOwned}/${upgrade.max})`,
				color: "#4ec9b0",
			},
		],
	};
}

export function cmdResearch(
	args: string[],
	_cwd: string,
	_root: FsNode,
): CommandResult {
	if (args.length === 0) {
		return {
			lines: [
				{
					type: ShellLineTypeEnum.error,
					text: "usage: research <tech_node_id>",
				},
			],
		};
	}

	const id = args[0];
	const node = techNodes.find((n) => n.id === id);

	if (!node) {
		return {
			lines: [
				{
					type: ShellLineTypeEnum.error,
					text: `research: unknown tech node '${id}'`,
				},
			],
		};
	}

	const state = getGameStore();
	const ownedTechNodes = state.ownedTechNodes;
	const owned = ownedTechNodes[id] ?? 0;

	if (owned >= node.max) {
		return {
			lines: [
				{
					type: ShellLineTypeEnum.output,
					text: `${node.name} is already researched`,
				},
			],
		};
	}

	// Check prerequisites
	for (const reqId of node.requires) {
		if ((ownedTechNodes[reqId] ?? 0) === 0) {
			return {
				lines: [
					{
						type: ShellLineTypeEnum.error,
						text: `Cannot research: prerequisite '${reqId}' not met`,
					},
				],
			};
		}
	}

	// Check affordability
	const cost = getTechNodeCost(node, owned);
	const useLoc = node.currency === "loc";
	const resource = useLoc ? state.loc : state.cash;
	if (resource < cost) {
		return {
			lines: [
				{
					type: ShellLineTypeEnum.error,
					text: `Cannot research. Cost: ${node.currency === "cash" ? "$" : ""}${formatNumber(cost)}${useLoc ? " LoC" : ""}, have ${useLoc ? `${formatNumber(state.loc)} LoC` : `$${formatNumber(state.cash)}`}`,
				},
			],
		};
	}

	state.researchNode(node);

	return {
		lines: [
			{
				type: ShellLineTypeEnum.output,
				text: `✓ Researched: ${node.name}`,
				color: "#4ec9b0",
			},
		],
	};
}

export function cmdStatus(
	_args: string[],
	_cwd: string,
	_root: FsNode,
): CommandResult {
	const state = getGameStore();
	const { cash, loc, flops, tokens, currentTierIndex, aiUnlocked } = state;
	const tier = tiers[currentTierIndex];

	const lines: string[] = [
		`  Tier: ${tier?.name ?? "Unknown"} (T${currentTierIndex})`,
		`  Cash: $${formatNumber(cash, true)}`,
		`  LoC:  ${formatNumber(loc)}`,
		`  FLOPS: ${formatNumber(flops)}`,
	];

	if (aiUnlocked) {
		lines.push(`  Tokens: ${formatNumber(tokens)}`);
	}

	return {
		lines: lines.map((text) => ({
			type: ShellLineTypeEnum.output,
			text,
		})),
	};
}

export function cmdExecute(
	_args: string[],
	_cwd: string,
	_root: FsNode,
): CommandResult {
	const state = getGameStore();

	if (state.autoExecuteEnabled) {
		return {
			lines: [
				{
					type: ShellLineTypeEnum.output,
					text: "Auto-execute is enabled. Use `auto-execute` to toggle.",
				},
			],
		};
	}

	const {
		loc,
		flops,
		cash,
		currentTierIndex,
		aiUnlocked,
		flopSlider,
		cashMultiplier,
	} = state;
	const tier = tiers[currentTierIndex];
	const cashPerLoc = tier?.cashPerLoc ?? 0.1;
	const execFlops = aiUnlocked ? flops * flopSlider : flops;
	const execLoc = Math.min(Math.floor(execFlops), Math.floor(loc));

	if (execLoc <= 0) {
		return {
			lines: [
				{
					type: ShellLineTypeEnum.error,
					text: "Nothing to execute. Queue is empty or no FLOPS available.",
				},
			],
		};
	}

	const earned = execLoc * cashPerLoc * cashMultiplier;
	state.executeManual();

	return {
		lines: [
			{
				type: ShellLineTypeEnum.output,
				text: `✓ Executed ${formatNumber(execLoc)} LoC → +$${formatNumber(earned, true)}`,
				color: "#4ec9b0",
			},
		],
	};
}

export function cmdAutoExecute(
	_args: string[],
	_cwd: string,
	_root: FsNode,
): CommandResult {
	const state = getGameStore();
	const autoExecUnlocked = (state.ownedTechNodes.auto_execute ?? 0) > 0;

	if (!autoExecUnlocked) {
		return {
			lines: [
				{
					type: ShellLineTypeEnum.error,
					text: "auto-execute not yet researched. Research 'auto_execute' first.",
				},
			],
		};
	}

	state.toggleAutoExecute();
	const newState = getGameStore();

	return {
		lines: [
			{
				type: ShellLineTypeEnum.output,
				text: `✓ Auto-execute: ${newState.autoExecuteEnabled ? "ON" : "OFF"}`,
				color: "#4ec9b0",
			},
		],
	};
}
