import type { TechNode, Upgrade } from "@flopsed/domain";
import { aiModels, techNodes, tiers, upgrades } from "@flopsed/domain";
import { getTechNodeCost, getUpgradeCost } from "@flopsed/engine";
import { useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import type { FsNode } from "./types";
import { FsNodeKindEnum } from "./types";

/** Get live game state snapshot — called at runtime, not import time */
function getState() {
	return useGameStore.getState();
}

function makeFile(name: string, content: string[]): FsNode {
	return { name, kind: FsNodeKindEnum.file, content };
}

function makeDir(name: string, children: FsNode[], locked = false): FsNode {
	return { name, kind: FsNodeKindEnum.dir, children, locked };
}

function buildUpgradeFile(upgrade: Upgrade, owned: number): string[] {
	const cost = getUpgradeCost(upgrade, owned);
	const maxed = owned >= upgrade.max;
	const effectDesc = upgrade.effects
		.map((e) => `${e.op} ${e.type}: ${e.value}`)
		.join(", ");
	return [
		`// ${upgrade.name} — owned: ${owned}/${upgrade.max}`,
		`// Effect: ${effectDesc}`,
		maxed ? "// Status: MAXED" : `// Cost: $${formatNumber(cost)}`,
		`export const ${upgrade.id} = {`,
		`  cost: ${Math.floor(cost)},`,
		`  owned: ${owned},`,
		`  max: ${upgrade.max},`,
		"};",
	];
}

function buildTechFile(node: TechNode, owned: number): string[] {
	const cost = getTechNodeCost(node, owned);
	const maxed = owned >= node.max;
	const effectDesc = node.effects
		.map((e) => `${e.op} ${e.type}: ${e.value}`)
		.join(", ");
	return [
		`// ${node.name}`,
		`// Effect: ${effectDesc}`,
		maxed
			? "// Status: Researched ✓"
			: `// Cost: ${node.currency === "cash" ? "$" : ""}${formatNumber(cost)}${node.currency === "loc" ? " LoC" : ""}`,
		`export const ${node.id} = {`,
		`  status: "${maxed ? "researched" : "available"}",`,
		"};",
	];
}

export function buildFilesystem(): FsNode {
	const state = getState();
	const ownedUpgrades = state.ownedUpgrades;
	const ownedTechNodes = state.ownedTechNodes;
	const currentTierIndex = state.currentTierIndex;
	const aiUnlocked = state.aiUnlocked;
	const flops = state.flops;
	const flopSlider = state.flopSlider;
	const unlockedModels = state.unlockedModels;

	const tierNames = tiers.map((t) => t.id);

	// ── upgrades/ ──
	const upgradeTierDirs: FsNode[] = tiers.map((tier, i) => {
		const tierUpgrades = upgrades.filter((u) => u.tier === tier.id);
		const files = tierUpgrades.map((u) =>
			makeFile(`${u.id}.ts`, buildUpgradeFile(u, ownedUpgrades[u.id] ?? 0)),
		);
		return makeDir(`tier${i}/`, files, i > currentTierIndex);
	});

	// ── tech-tree/ ──
	const techFiles = techNodes
		.filter((n) => {
			const owned = ownedTechNodes[n.id] ?? 0;
			// Show if owned or if prerequisites are met
			if (owned > 0) return true;
			return n.requires.every((r) => (ownedTechNodes[r] ?? 0) > 0);
		})
		.map((n) =>
			makeFile(`${n.id}.ts`, buildTechFile(n, ownedTechNodes[n.id] ?? 0)),
		);

	// ── models/ (only if AI unlocked) ──
	const modelFiles = aiUnlocked
		? aiModels
				.filter((m) => unlockedModels[m.id])
				.map((m) =>
					makeFile(`${m.id}.onnx`, [
						`// ${m.name} ${m.version} — active`,
						`// Token consumption: ${formatNumber(m.tokenCost)}/s`,
						`// FLOPS demand: ${formatNumber(m.flopsCost)}`,
						`// LoC output: ${formatNumber(m.locPerSec)}/s`,
					]),
				)
		: [];

	// ── .env ──
	const tierName = tierNames[currentTierIndex] ?? "garage";
	const envContent = [
		`FLOPS_TOTAL=${Math.floor(flops)}`,
		`FLOP_SLIDER=${flopSlider.toFixed(2)} # ${Math.round(flopSlider * 100)}% exec, ${Math.round((1 - flopSlider) * 100)}% AI`,
		`TIER=${tierName}`,
		`TIER_INDEX=${currentTierIndex}`,
	];
	if (aiUnlocked) {
		const activeModels = aiModels
			.filter((m) => unlockedModels[m.id])
			.map((m) => m.id)
			.join(",");
		envContent.push(`AI_MODELS=${activeModels}`);
	}

	// ── README.md ──
	const readme = [
		"# Flopsed",
		"",
		"Type code. Execute it. Get paid.",
		"Every keystroke = Lines of Code.",
		"FLOPS burn through your code queue.",
		"Cash flows.",
		"",
		"Run `help` for available commands.",
		"Run `ls` to explore.",
	];

	// ── agi.py ──
	const agiContent =
		currentTierIndex >= 5
			? [
					"# The Singularity",
					"# It's closer than you think...",
					"import consciousness",
					"consciousness.awaken()",
				]
			: currentTierIndex >= 4
				? [
						"# agi.py — work in progress",
						"# TODO: figure out consciousness",
						"raise NotImplementedError('almost there...')",
					]
				: ["# agi.py", "# coming soon...", "pass"];

	// ── Root ──
	const children: FsNode[] = [
		makeDir("upgrades/", upgradeTierDirs),
		makeDir("tech-tree/", techFiles),
		makeFile("README.md", readme),
		makeFile(".env", envContent),
		makeFile("agi.py", agiContent),
	];

	if (aiUnlocked) {
		children.splice(2, 0, makeDir("models/", modelFiles));
	}

	return makeDir("~", children);
}

/** Resolve a path relative to cwd, returning the FsNode or null */
export function resolvePath(
	root: FsNode,
	cwd: string,
	path: string,
): FsNode | null {
	// Normalize: handle ~, .., absolute vs relative
	let segments: string[];
	if (path.startsWith("~/") || path === "~") {
		segments = path
			.slice(2)
			.split("/")
			.filter((s) => s !== "");
	} else if (path.startsWith("/")) {
		segments = path.split("/").filter((s) => s !== "");
	} else {
		// Relative to cwd
		const cwdParts = cwd
			.replace("~/", "")
			.split("/")
			.filter((s) => s !== "" && s !== "~");
		const pathParts = path.split("/").filter((s) => s !== "");
		segments = [...cwdParts, ...pathParts];
	}

	// Resolve ".."
	const resolved: string[] = [];
	for (const seg of segments) {
		if (seg === "..") resolved.pop();
		else if (seg !== ".") resolved.push(seg.replace(/\/$/, ""));
	}

	let node = root;
	for (const seg of resolved) {
		if (!node.children) return null;
		const child = node.children.find(
			(c) => c.name === seg || c.name === `${seg}/`,
		);
		if (!child) return null;
		node = child;
	}
	return node;
}

/** List children names for autocomplete */
export function listChildren(
	root: FsNode,
	cwd: string,
	partial: string,
): string[] {
	const dir = partial.includes("/")
		? resolvePath(root, cwd, partial.slice(0, partial.lastIndexOf("/")))
		: resolvePath(root, cwd, ".");
	if (!dir?.children) return [];
	const prefix = partial.includes("/")
		? partial.slice(partial.lastIndexOf("/") + 1)
		: partial;
	return dir.children
		.filter((c) => c.name.startsWith(prefix))
		.map((c) => c.name);
}
