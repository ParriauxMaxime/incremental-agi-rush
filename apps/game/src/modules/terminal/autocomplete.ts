import { techNodes, upgrades } from "@flopsed/domain";
import { useGameStore } from "@modules/game";
import type { FsNode } from "./types";
import { listChildren } from "./virtual-fs";

const COMMANDS = [
	"ls",
	"cd",
	"cat",
	"pwd",
	"tree",
	"buy",
	"research",
	"execute",
	"auto-execute",
	"status",
	"help",
	"clear",
	"history",
	"grep",
	"find",
];

/** Path-completing commands */
const PATH_COMMANDS = new Set(["ls", "cd", "cat", "tree", "grep"]);

export function autocomplete(
	input: string,
	cwd: string,
	root: FsNode,
): string[] {
	const parts = input.split(/\s+/);

	// Completing the command name itself
	if (parts.length <= 1) {
		const partial = parts[0] ?? "";
		return COMMANDS.filter((c) => c.startsWith(partial));
	}

	const cmd = parts[0];
	const partial = parts[parts.length - 1] ?? "";

	// buy → only show upgrades that are available and not maxed
	if (cmd === "buy") {
		const state = useGameStore.getState();
		const owned = state.ownedUpgrades as Record<string, number>;
		const ownedNodes = state.ownedTechNodes as Record<string, number>;
		return upgrades
			.filter((u) => {
				const count = owned[u.id] ?? 0;
				if (count >= u.max) return false;
				// Only show if requirements are met (tech nodes owned)
				if (u.requires) {
					return u.requires.every((r) => (ownedNodes[r] ?? 0) > 0);
				}
				return true;
			})
			.map((u) => u.id)
			.filter((id) => id.startsWith(partial));
	}

	// research → only show nodes with met prerequisites and not maxed
	if (cmd === "research") {
		const state = useGameStore.getState();
		const ownedNodes = state.ownedTechNodes as Record<string, number>;
		return techNodes
			.filter((n) => {
				const count = ownedNodes[n.id] ?? 0;
				if (count >= n.max) return false;
				return n.requires.every((r) => (ownedNodes[r] ?? 0) > 0);
			})
			.map((n) => n.id)
			.filter((id) => id.startsWith(partial));
	}

	// help → autocomplete command names
	if (cmd === "help") {
		return COMMANDS.filter((c) => c.startsWith(partial));
	}

	// Path-based commands → autocomplete filesystem paths
	if (PATH_COMMANDS.has(cmd)) {
		return listChildren(root, cwd, partial);
	}

	return [];
}
