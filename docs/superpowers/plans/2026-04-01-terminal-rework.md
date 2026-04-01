# Terminal Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the passive tutorial terminal with an interactive oh-my-zsh-styled shell featuring a virtual filesystem, buy/research commands with autocomplete, and inline tool-call notification blocks.

**Architecture:** A pure-logic shell engine module (`modules/terminal/`) handles filesystem, command parsing, and execution. The UI layer (`TutorialTip` rewrite) renders shell output with oh-my-zsh prompt styling and tool-call blocks. The existing `CliPrompt` gains `!` prefix support to forward commands to the shared engine. Both terminals share one `ShellEngine` singleton.

**Tech Stack:** React 19, Emotion CSS-in-JS, Zustand, ts-pattern, Web Audio API (existing SFX), react-i18next.

**Spec:** `docs/superpowers/specs/2026-04-01-terminal-rework-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/game/src/modules/terminal/types.ts` | ShellLine, FsNode, ShellCommand types |
| Create | `apps/game/src/modules/terminal/virtual-fs.ts` | Build filesystem tree from game state |
| Create | `apps/game/src/modules/terminal/commands/nav.ts` | ls, cd, cat, pwd, tree commands |
| Create | `apps/game/src/modules/terminal/commands/game-actions.ts` | buy, research, status commands |
| Create | `apps/game/src/modules/terminal/commands/utility.ts` | help, clear, history, grep, find commands |
| Create | `apps/game/src/modules/terminal/autocomplete.ts` | Tab completion for commands, paths, IDs |
| Create | `apps/game/src/modules/terminal/shell-engine.ts` | Singleton orchestrator: parse, execute, manage state |
| Create | `apps/game/src/modules/terminal/index.ts` | Public API barrel export |
| Rewrite | `apps/game/src/components/tutorial-screen.tsx` | Interactive shell UI with oh-my-zsh prompt |
| Modify | `apps/game/src/components/cli-prompt.tsx` | Add `!` prefix forwarding |
| Modify | `apps/game/src/modules/game/store/ui-store.ts` | Change terminalLog type from `string[]` to `ShellLine[]` |
| Modify | `apps/game/src/i18n/locales/en/tutorial.json` | Updated tutorial messages + command help |
| Modify | `apps/game/src/i18n/locales/{fr,it,de,es,pl,zh,ru}/tutorial.json` | Mirror i18n changes |

---

## Task 1: Define Types

**Files:**
- Create: `apps/game/src/modules/terminal/types.ts`

- [ ] **Step 1: Create the types file**

```tsx
// ── Shell output line types ──

export const ShellLineTypeEnum = {
	prompt: "prompt",
	command: "command",
	output: "output",
	file: "file",
	dir: "dir",
	error: "error",
	tool_header: "tool_header",
	tool_body: "tool_body",
	milestone_header: "milestone_header",
	milestone_body: "milestone_body",
	next_milestone: "next_milestone",
	separator: "separator",
	blank: "blank",
} as const;

export type ShellLineTypeEnum =
	(typeof ShellLineTypeEnum)[keyof typeof ShellLineTypeEnum];

export interface ShellLine {
	type: ShellLineTypeEnum;
	text: string;
	color?: string;
	indent?: number;
}

// ── Prompt segments ──

export interface PromptSegment {
	text: string;
	color: string;
}

// ── Virtual filesystem ──

export const FsNodeKindEnum = {
	file: "file",
	dir: "dir",
} as const;

export type FsNodeKindEnum =
	(typeof FsNodeKindEnum)[keyof typeof FsNodeKindEnum];

export interface FsNode {
	name: string;
	kind: FsNodeKindEnum;
	children?: FsNode[];
	/** For files: content lines returned by `cat` */
	content?: string[];
	/** Visual: locked/dimmed directories not yet accessible */
	locked?: boolean;
}

// ── Command definition ──

export interface CommandResult {
	lines: ShellLine[];
	/** If set, changes the current working directory */
	newCwd?: string;
	/** If set, clears the terminal log */
	clear?: boolean;
}

export interface ShellCommand {
	name: string;
	description: string;
	usage: string;
	execute: (args: string[], cwd: string, fs: FsNode) => CommandResult;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/modules/terminal/types.ts
git commit -m "✨ Add terminal module types: ShellLine, FsNode, ShellCommand"
```

---

## Task 2: Virtual Filesystem Builder

**Files:**
- Create: `apps/game/src/modules/terminal/virtual-fs.ts`

This builds an FsNode tree from live game state. The tree is rebuilt on each access (lazy, not reactive).

- [ ] **Step 1: Create the filesystem builder**

```tsx
import type { TechNode, Upgrade } from "@flopsed/domain";
import {
	aiModels,
	allTechNodes,
	allUpgrades,
	getUpgradeCost,
	getTechNodeCost,
	tiers,
} from "@flopsed/domain";
import { formatNumber } from "@utils/format";
import type { FsNode } from "./types";
import { FsNodeKindEnum } from "./types";

/** Get live game state snapshot (import store lazily to avoid circular deps) */
function getState() {
	// Dynamic import pattern — the store is a singleton
	const { useGameStore } = require("@modules/game") as {
		useGameStore: { getState: () => Record<string, unknown> };
	};
	return useGameStore.getState();
}

function makeFile(name: string, content: string[]): FsNode {
	return { name, kind: FsNodeKindEnum.file, content };
}

function makeDir(
	name: string,
	children: FsNode[],
	locked = false,
): FsNode {
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
		maxed
			? "// Status: MAXED"
			: `// Cost: $${formatNumber(cost)}`,
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
	const ownedUpgrades = (state.ownedUpgrades ?? {}) as Record<string, number>;
	const ownedTechNodes = (state.ownedTechNodes ?? {}) as Record<
		string,
		number
	>;
	const currentTierIndex = (state.currentTierIndex ?? 0) as number;
	const aiUnlocked = (state.aiUnlocked ?? false) as boolean;
	const flops = (state.flops ?? 0) as number;
	const flopSlider = (state.flopSlider ?? 0.7) as number;
	const unlockedModels = (state.unlockedModels ?? {}) as Record<
		string,
		boolean
	>;

	const tierNames = tiers.map((t) => t.id);

	// ── upgrades/ ──
	const upgradeTierDirs: FsNode[] = tiers.map((tier, i) => {
		const tierUpgrades = allUpgrades.filter((u) => u.tier === tier.id);
		const files = tierUpgrades.map((u) =>
			makeFile(
				`${u.id}.ts`,
				buildUpgradeFile(u, ownedUpgrades[u.id] ?? 0),
			),
		);
		return makeDir(`tier${i}/`, files, i > currentTierIndex);
	});

	// ── tech-tree/ ──
	const techFiles = allTechNodes
		.filter((n) => {
			const owned = ownedTechNodes[n.id] ?? 0;
			// Show if owned or if prerequisites are met
			if (owned > 0) return true;
			return n.requires.every((r) => (ownedTechNodes[r] ?? 0) > 0);
		})
		.map((n) =>
			makeFile(
				`${n.id}.ts`,
				buildTechFile(n, ownedTechNodes[n.id] ?? 0),
			),
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
				: [
						"# agi.py",
						"# coming soon...",
						"pass",
					];

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
		segments = path
			.split("/")
			.filter((s) => s !== "");
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
		? resolvePath(
				root,
				cwd,
				partial.slice(0, partial.lastIndexOf("/")),
			)
		: resolvePath(root, cwd, ".");
	if (!dir?.children) return [];
	const prefix = partial.includes("/")
		? partial.slice(partial.lastIndexOf("/") + 1)
		: partial;
	return dir.children
		.filter((c) => c.name.startsWith(prefix))
		.map((c) => c.name);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`

Note: The `require("@modules/game")` dynamic import may need adjustment. If TypeScript complains, use a callback pattern instead — pass `getState` as a parameter to `buildFilesystem`. Check and adapt.

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/modules/terminal/virtual-fs.ts
git commit -m "✨ Add virtual filesystem builder from game state"
```

---

## Task 3: Navigation Commands (ls, cd, cat, pwd, tree)

**Files:**
- Create: `apps/game/src/modules/terminal/commands/nav.ts`

- [ ] **Step 1: Create the navigation commands**

```tsx
import type { CommandResult, FsNode, ShellLine } from "../types";
import { FsNodeKindEnum, ShellLineTypeEnum } from "../types";
import { resolvePath } from "../virtual-fs";

export function cmdLs(
	args: string[],
	cwd: string,
	root: FsNode,
): CommandResult {
	const target = args[0] ?? ".";
	const node = resolvePath(root, cwd, target);
	if (!node) {
		return {
			lines: [
				{
					type: ShellLineTypeEnum.error,
					text: `ls: cannot access '${target}': No such file or directory`,
				},
			],
		};
	}
	if (node.kind === FsNodeKindEnum.file) {
		return {
			lines: [{ type: ShellLineTypeEnum.file, text: node.name }],
		};
	}
	if (!node.children || node.children.length === 0) {
		return { lines: [] };
	}
	const lines: ShellLine[] = [];
	// Sort: dirs first, then files
	const sorted = [...node.children].sort((a, b) => {
		if (a.kind !== b.kind)
			return a.kind === FsNodeKindEnum.dir ? -1 : 1;
		return a.name.localeCompare(b.name);
	});
	for (const child of sorted) {
		lines.push({
			type:
				child.kind === FsNodeKindEnum.dir
					? ShellLineTypeEnum.dir
					: ShellLineTypeEnum.file,
			text: child.name,
			color: child.locked ? undefined : undefined,
			// locked dirs get dimmed via the UI renderer
		});
	}
	return { lines };
}

export function cmdCd(
	args: string[],
	cwd: string,
	root: FsNode,
): CommandResult {
	const target = args[0] ?? "~";
	if (target === "~" || target === "~/") {
		return { lines: [], newCwd: "~" };
	}
	const node = resolvePath(root, cwd, target);
	if (!node) {
		return {
			lines: [
				{
					type: ShellLineTypeEnum.error,
					text: `cd: no such directory: ${target}`,
				},
			],
		};
	}
	if (node.kind !== FsNodeKindEnum.dir) {
		return {
			lines: [
				{
					type: ShellLineTypeEnum.error,
					text: `cd: not a directory: ${target}`,
				},
			],
		};
	}
	if (node.locked) {
		return {
			lines: [
				{
					type: ShellLineTypeEnum.error,
					text: `cd: permission denied: ${target} (tier not unlocked)`,
				},
			],
		};
	}

	// Build absolute path
	let newCwd: string;
	if (target.startsWith("~/") || target === "~") {
		newCwd = target === "~" ? "~" : target;
	} else if (target === "..") {
		const parts = cwd.split("/").filter((s) => s !== "");
		parts.pop();
		newCwd = parts.length === 0 ? "~" : parts.join("/");
	} else {
		newCwd =
			cwd === "~" ? `~/${target.replace(/\/$/, "")}` : `${cwd}/${target.replace(/\/$/, "")}`;
	}
	return { lines: [], newCwd };
}

export function cmdCat(
	args: string[],
	cwd: string,
	root: FsNode,
): CommandResult {
	if (args.length === 0) {
		return {
			lines: [
				{
					type: ShellLineTypeEnum.error,
					text: "cat: missing file argument",
				},
			],
		};
	}
	const target = args[0];
	const node = resolvePath(root, cwd, target);
	if (!node) {
		return {
			lines: [
				{
					type: ShellLineTypeEnum.error,
					text: `cat: ${target}: No such file or directory`,
				},
			],
		};
	}
	if (node.kind === FsNodeKindEnum.dir) {
		return {
			lines: [
				{
					type: ShellLineTypeEnum.error,
					text: `cat: ${target}: Is a directory`,
				},
			],
		};
	}
	return {
		lines: (node.content ?? []).map((line) => ({
			type: ShellLineTypeEnum.output,
			text: line,
		})),
	};
}

export function cmdPwd(
	_args: string[],
	cwd: string,
	_root: FsNode,
): CommandResult {
	return {
		lines: [
			{
				type: ShellLineTypeEnum.output,
				text: cwd.startsWith("~")
					? `/home/player/${cwd.slice(2)}`
					: cwd,
			},
		],
	};
}

function treeHelper(
	node: FsNode,
	prefix: string,
	depth: number,
	maxDepth: number,
): ShellLine[] {
	if (depth > maxDepth || !node.children) return [];
	const lines: ShellLine[] = [];
	const children = [...node.children].sort((a, b) => {
		if (a.kind !== b.kind)
			return a.kind === FsNodeKindEnum.dir ? -1 : 1;
		return a.name.localeCompare(b.name);
	});
	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		const isLast = i === children.length - 1;
		const connector = isLast ? "└── " : "├── ";
		lines.push({
			type:
				child.kind === FsNodeKindEnum.dir
					? ShellLineTypeEnum.dir
					: ShellLineTypeEnum.file,
			text: `${prefix}${connector}${child.name}`,
		});
		if (child.kind === FsNodeKindEnum.dir) {
			const childPrefix = prefix + (isLast ? "    " : "│   ");
			lines.push(
				...treeHelper(child, childPrefix, depth + 1, maxDepth),
			);
		}
	}
	return lines;
}

export function cmdTree(
	args: string[],
	cwd: string,
	root: FsNode,
): CommandResult {
	const target = args[0] ?? ".";
	const node = resolvePath(root, cwd, target);
	if (!node || node.kind !== FsNodeKindEnum.dir) {
		return {
			lines: [
				{
					type: ShellLineTypeEnum.error,
					text: `tree: ${target}: not a directory`,
				},
			],
		};
	}
	const header: ShellLine = {
		type: ShellLineTypeEnum.dir,
		text: target === "." ? cwd : target,
	};
	return { lines: [header, ...treeHelper(node, "", 0, 2)] };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/modules/terminal/commands/nav.ts
git commit -m "✨ Add navigation commands: ls, cd, cat, pwd, tree"
```

---

## Task 4: Game Action Commands (buy, research, status)

**Files:**
- Create: `apps/game/src/modules/terminal/commands/game-actions.ts`

- [ ] **Step 1: Create the game action commands**

These commands interact with the game store to purchase upgrades and research tech nodes.

```tsx
import {
	allTechNodes,
	allUpgrades,
	getTechNodeCost,
	getUpgradeCost,
	tiers,
} from "@flopsed/domain";
import { formatNumber } from "@utils/format";
import type { CommandResult, FsNode } from "../types";
import { ShellLineTypeEnum } from "../types";

function getGameStore() {
	const { useGameStore } = require("@modules/game") as {
		useGameStore: { getState: () => Record<string, unknown> };
	};
	return useGameStore.getState() as Record<string, unknown>;
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
	const upgrade = allUpgrades.find((u) => u.id === id);

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
	const ownedUpgrades = state.ownedUpgrades as Record<string, number>;
	const owned = ownedUpgrades[id] ?? 0;
	const cash = state.cash as number;
	const buyUpgrade = state.buyUpgrade as (id: string) => boolean;

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

	const results: string[] = [];
	let purchased = 0;

	for (let i = 0; i < count; i++) {
		const success = buyUpgrade(id);
		if (success) {
			purchased++;
		} else {
			break;
		}
	}

	if (purchased === 0) {
		const cost = getUpgradeCost(upgrade, owned);
		return {
			lines: [
				{
					type: ShellLineTypeEnum.error,
					text: `Not enough cash. Need $${formatNumber(cost)}, have $${formatNumber(cash)}`,
				},
			],
		};
	}

	return {
		lines: [
			{
				type: ShellLineTypeEnum.output,
				text: `✓ Purchased ${upgrade.name}${purchased > 1 ? ` x${purchased}` : ""} (${owned + purchased}/${upgrade.max})`,
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
	const node = allTechNodes.find((n) => n.id === id);

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
	const ownedTechNodes = state.ownedTechNodes as Record<string, number>;
	const owned = ownedTechNodes[id] ?? 0;
	const buyTechNode = state.buyTechNode as (id: string) => boolean;

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

	const success = buyTechNode(id);
	if (!success) {
		const cost = getTechNodeCost(node, owned);
		return {
			lines: [
				{
					type: ShellLineTypeEnum.error,
					text: `Cannot research. Cost: ${node.currency === "cash" ? "$" : ""}${formatNumber(cost)}${node.currency === "loc" ? " LoC" : ""}`,
				},
			],
		};
	}

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
	const cash = state.cash as number;
	const loc = state.loc as number;
	const flops = state.flops as number;
	const tokens = state.tokens as number;
	const currentTierIndex = state.currentTierIndex as number;
	const aiUnlocked = state.aiUnlocked as boolean;
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`

Note: `buyUpgrade` and `buyTechNode` must exist as actions on the game store. Check the store and use the correct action names. Read `apps/game/src/modules/game/store/game-store.ts` to confirm the exact function signatures. Adapt the calls accordingly.

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/modules/terminal/commands/game-actions.ts
git commit -m "✨ Add game action commands: buy, research, status"
```

---

## Task 5: Utility Commands (help, clear, history, grep, find)

**Files:**
- Create: `apps/game/src/modules/terminal/commands/utility.ts`

- [ ] **Step 1: Create the utility commands**

```tsx
import type { CommandResult, FsNode, ShellLine } from "../types";
import { FsNodeKindEnum, ShellLineTypeEnum } from "../types";
import { resolvePath } from "../virtual-fs";

const COMMAND_HELP: Record<string, { usage: string; desc: string }> = {
	ls: { usage: "ls [path]", desc: "List directory contents" },
	cd: { usage: "cd <path>", desc: "Change directory" },
	cat: { usage: "cat <file>", desc: "Display file contents" },
	pwd: { usage: "pwd", desc: "Print working directory" },
	tree: { usage: "tree [path]", desc: "Show directory tree" },
	buy: {
		usage: "buy <upgrade_id> [count]",
		desc: "Purchase an upgrade",
	},
	research: {
		usage: "research <tech_node_id>",
		desc: "Research a tech node",
	},
	status: { usage: "status", desc: "Show current resources and tier" },
	help: {
		usage: "help [command]",
		desc: "Show available commands",
	},
	clear: { usage: "clear", desc: "Clear terminal output" },
	history: { usage: "history", desc: "Show command history" },
	grep: {
		usage: "grep <pattern> [path]",
		desc: "Search file contents",
	},
	find: { usage: "find <name>", desc: "Find files by name" },
};

export function cmdHelp(
	args: string[],
	_cwd: string,
	_root: FsNode,
): CommandResult {
	if (args.length > 0) {
		const cmd = COMMAND_HELP[args[0]];
		if (!cmd) {
			return {
				lines: [
					{
						type: ShellLineTypeEnum.error,
						text: `help: unknown command '${args[0]}'`,
					},
				],
			};
		}
		return {
			lines: [
				{
					type: ShellLineTypeEnum.output,
					text: `  ${cmd.usage}`,
					color: "#4ec9b0",
				},
				{
					type: ShellLineTypeEnum.output,
					text: `  ${cmd.desc}`,
				},
			],
		};
	}

	const lines: ShellLine[] = [];
	for (const [name, info] of Object.entries(COMMAND_HELP)) {
		lines.push({
			type: ShellLineTypeEnum.output,
			text: `  ${name.padEnd(10)} ${info.desc}`,
		});
	}
	return { lines };
}

export function cmdClear(): CommandResult {
	return { lines: [], clear: true };
}

export function cmdHistory(
	_args: string[],
	_cwd: string,
	_root: FsNode,
	commandHistory: string[],
): CommandResult {
	if (commandHistory.length === 0) {
		return {
			lines: [
				{
					type: ShellLineTypeEnum.output,
					text: "  (no history)",
				},
			],
		};
	}
	return {
		lines: commandHistory.map((cmd, i) => ({
			type: ShellLineTypeEnum.output,
			text: `  ${String(i + 1).padStart(3)}  ${cmd}`,
		})),
	};
}

function collectFiles(node: FsNode, path: string): Array<{ path: string; node: FsNode }> {
	const results: Array<{ path: string; node: FsNode }> = [];
	if (node.kind === FsNodeKindEnum.file) {
		results.push({ path, node });
	}
	if (node.children) {
		for (const child of node.children) {
			results.push(
				...collectFiles(child, `${path}/${child.name}`),
			);
		}
	}
	return results;
}

export function cmdGrep(
	args: string[],
	cwd: string,
	root: FsNode,
): CommandResult {
	if (args.length === 0) {
		return {
			lines: [
				{
					type: ShellLineTypeEnum.error,
					text: "usage: grep <pattern> [path]",
				},
			],
		};
	}

	const pattern = args[0].toLowerCase();
	const searchPath = args[1] ?? ".";
	const searchNode = resolvePath(root, cwd, searchPath);

	if (!searchNode) {
		return {
			lines: [
				{
					type: ShellLineTypeEnum.error,
					text: `grep: ${searchPath}: No such file or directory`,
				},
			],
		};
	}

	const files = collectFiles(searchNode, searchPath);
	const lines: ShellLine[] = [];

	for (const { path, node } of files) {
		if (!node.content) continue;
		for (const line of node.content) {
			if (line.toLowerCase().includes(pattern)) {
				lines.push({
					type: ShellLineTypeEnum.output,
					text: `${path}: ${line}`,
				});
			}
		}
	}

	if (lines.length === 0) {
		lines.push({
			type: ShellLineTypeEnum.output,
			text: `  (no matches for '${pattern}')`,
		});
	}

	return { lines: lines.slice(0, 20) }; // Cap output
}

export function cmdFind(
	args: string[],
	cwd: string,
	root: FsNode,
): CommandResult {
	if (args.length === 0) {
		return {
			lines: [
				{
					type: ShellLineTypeEnum.error,
					text: "usage: find <name>",
				},
			],
		};
	}

	const pattern = args[0].toLowerCase();
	const searchNode = resolvePath(root, cwd, "~");
	if (!searchNode) return { lines: [] };

	const allFiles = collectFiles(searchNode, "~");
	const matches = allFiles
		.filter(({ node }) => node.name.toLowerCase().includes(pattern))
		.slice(0, 20);

	if (matches.length === 0) {
		return {
			lines: [
				{
					type: ShellLineTypeEnum.output,
					text: `  (no files matching '${pattern}')`,
				},
			],
		};
	}

	return {
		lines: matches.map(({ path, node }) => ({
			type:
				node.kind === FsNodeKindEnum.dir
					? ShellLineTypeEnum.dir
					: ShellLineTypeEnum.file,
			text: path,
		})),
	};
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/modules/terminal/commands/utility.ts
git commit -m "✨ Add utility commands: help, clear, history, grep, find"
```

---

## Task 6: Autocomplete

**Files:**
- Create: `apps/game/src/modules/terminal/autocomplete.ts`

- [ ] **Step 1: Create autocomplete module**

```tsx
import { allTechNodes, allUpgrades } from "@flopsed/domain";
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

	// buy → autocomplete upgrade IDs
	if (cmd === "buy") {
		return allUpgrades
			.map((u) => u.id)
			.filter((id) => id.startsWith(partial));
	}

	// research → autocomplete tech node IDs
	if (cmd === "research") {
		return allTechNodes
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/modules/terminal/autocomplete.ts
git commit -m "✨ Add tab autocomplete for commands, paths, and game IDs"
```

---

## Task 7: Shell Engine (Singleton Orchestrator)

**Files:**
- Create: `apps/game/src/modules/terminal/shell-engine.ts`
- Create: `apps/game/src/modules/terminal/index.ts`

- [ ] **Step 1: Create the shell engine**

```tsx
import { tierColors } from "@flopsed/design-system";
import { tiers } from "@flopsed/domain";
import { autocomplete } from "./autocomplete";
import { cmdBuy, cmdResearch, cmdStatus } from "./commands/game-actions";
import { cmdCat, cmdCd, cmdLs, cmdPwd, cmdTree } from "./commands/nav";
import {
	cmdClear,
	cmdFind,
	cmdGrep,
	cmdHelp,
	cmdHistory,
} from "./commands/utility";
import type { CommandResult, FsNode, PromptSegment, ShellLine } from "./types";
import { ShellLineTypeEnum } from "./types";
import { buildFilesystem, resolvePath } from "./virtual-fs";

const TIER_DIRS = [
	"garage",
	"freelancing",
	"startup",
	"tech-co",
	"ai-lab",
	"agi-race",
];

const TIER_COLOR_LIST = [
	tierColors.garage,
	tierColors.freelancing,
	tierColors.startup,
	tierColors.tech_company,
	tierColors.ai_lab,
	tierColors.agi_race,
];

type CommandFn = (
	args: string[],
	cwd: string,
	root: FsNode,
	history: string[],
) => CommandResult;

const COMMANDS: Record<string, CommandFn> = {
	ls: cmdLs,
	cd: cmdCd,
	cat: cmdCat,
	pwd: cmdPwd,
	tree: cmdTree,
	buy: cmdBuy,
	research: cmdResearch,
	status: cmdStatus,
	help: cmdHelp,
	clear: cmdClear,
	find: cmdFind,
	grep: cmdGrep,
	history: cmdHistory,
};

function getGameState(): Record<string, unknown> {
	const { useGameStore } = require("@modules/game") as {
		useGameStore: { getState: () => Record<string, unknown> };
	};
	return useGameStore.getState();
}

class ShellEngineImpl {
	private cwd = "~";
	private commandHistory: string[] = [];
	private fs: FsNode | null = null;
	private lastFsBuild = 0;

	/** Rebuild FS if stale (>500ms old) */
	private getFs(): FsNode {
		const now = Date.now();
		if (!this.fs || now - this.lastFsBuild > 500) {
			this.fs = buildFilesystem();
			this.lastFsBuild = now;
		}
		return this.fs;
	}

	/** Update cwd based on current tier (home dir changes) */
	private syncHomeTier(): void {
		const state = getGameState();
		const tierIndex = (state.currentTierIndex ?? 0) as number;
		const tierDir = TIER_DIRS[tierIndex] ?? "garage";
		// Only update if cwd is still at home level
		if (
			this.cwd === "~" ||
			TIER_DIRS.some((d) => this.cwd === `~/${d}` || this.cwd === `~`)
		) {
			// Keep cwd as ~ — the prompt renders tier name separately
		}
	}

	execute(input: string): {
		lines: ShellLine[];
		clear?: boolean;
	} {
		const trimmed = input.trim();
		if (!trimmed) return { lines: [] };

		this.commandHistory.push(trimmed);

		// Support chained commands with &&
		const commands = trimmed.split("&&").map((s) => s.trim());
		const allLines: ShellLine[] = [];
		let shouldClear = false;

		for (const cmd of commands) {
			const parts = cmd.split(/\s+/);
			const name = parts[0];
			const args = parts.slice(1);

			const handler = COMMANDS[name];
			if (!handler) {
				allLines.push({
					type: ShellLineTypeEnum.error,
					text: `zsh: command not found: ${name}`,
				});
				break; // Stop chain on error
			}

			const fs = this.getFs();
			const result = handler(args, this.cwd, fs, this.commandHistory);

			if (result.clear) {
				shouldClear = true;
			}
			if (result.newCwd) {
				this.cwd = result.newCwd;
			}
			allLines.push(...result.lines);
		}

		return { lines: allLines, clear: shouldClear };
	}

	autocomplete(input: string): string[] {
		const fs = this.getFs();
		return autocomplete(input, this.cwd, fs);
	}

	getCwd(): string {
		return this.cwd;
	}

	getPromptSegments(): PromptSegment[] {
		const state = getGameState();
		const tierIndex = (state.currentTierIndex ?? 0) as number;
		const tierDir = TIER_DIRS[tierIndex] ?? "garage";
		const dirColor = TIER_COLOR_LIST[tierIndex] ?? "#61afef";

		// Build display path: replace ~ root with tier name
		const displayCwd =
			this.cwd === "~"
				? `~/${tierDir}`
				: this.cwd.startsWith("~/")
					? `~/${tierDir}${this.cwd.slice(1)}`
					: this.cwd;

		const segments: PromptSegment[] = [
			{ text: "❯ ", color: "#4ec9b0" },
			{ text: displayCwd, color: dirColor },
			{ text: " on ", color: "#5c6370" },
			{ text: "⎇ ", color: "#c678dd" },
			{ text: "main", color: "#e5c07b" },
		];

		// Show cash in brackets at T3+
		if (tierIndex >= 3) {
			const cash = (state.cash ?? 0) as number;
			const { formatNumber } = require("@utils/format") as {
				formatNumber: (n: number, isCash?: boolean) => string;
			};
			segments.push(
				{ text: " [", color: "#5c6370" },
				{ text: `$${formatNumber(cash, true)}`, color: "#e5c07b" },
				{ text: "]", color: "#5c6370" },
			);
		}

		return segments;
	}

	getCommandHistory(): string[] {
		return this.commandHistory;
	}

	/** Push a tool-call notification (tutorial or milestone) */
	pushToolCall(
		kind: "tutorial" | "milestone",
		header: string,
		body: string,
	): ShellLine[] {
		const headerType =
			kind === "tutorial"
				? ShellLineTypeEnum.tool_header
				: ShellLineTypeEnum.milestone_header;
		const bodyType =
			kind === "tutorial"
				? ShellLineTypeEnum.tool_body
				: ShellLineTypeEnum.milestone_body;

		return [
			{ type: headerType, text: header },
			...body.split("\n").map((line) => ({
				type: bodyType,
				text: line,
			})),
		];
	}

	/** Get the next milestone hint */
	getNextMilestone(): { label: string } | null {
		const { allMilestones } = require("@modules/game") as {
			allMilestones: Array<{
				id: string;
				name: string;
				description: string;
				condition: string;
				threshold: number;
				metric: string;
			}>;
		};
		const state = getGameState();
		const reached = (state.reachedMilestones ?? []) as string[];

		const next = allMilestones.find((m) => !reached.includes(m.id));
		if (!next) return null;

		return { label: next.description };
	}
}

/** Singleton instance */
export const shellEngine = new ShellEngineImpl();
```

- [ ] **Step 2: Create barrel export**

```tsx
// apps/game/src/modules/terminal/index.ts
export { shellEngine } from "./shell-engine";
export type {
	CommandResult,
	FsNode,
	PromptSegment,
	ShellCommand,
	ShellLine,
} from "./types";
export { ShellLineTypeEnum } from "./types";
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run typecheck`

Note: The `require()` calls are used to avoid circular dependency with `@modules/game`. If TypeScript strict mode rejects them, convert to a `setGameStoreAccessor` pattern where the game module passes its store reference to the terminal module at init time.

- [ ] **Step 4: Commit**

```bash
git add apps/game/src/modules/terminal/
git commit -m "✨ Add ShellEngine singleton with command routing and prompt builder"
```

---

## Task 8: Update UI Store (ShellLine type)

**Files:**
- Modify: `apps/game/src/modules/game/store/ui-store.ts`

- [ ] **Step 1: Update terminalLog type**

Change the `terminalLog` type from `string[]` to `ShellLine[]`. Update `pushTerminalLine` to accept `ShellLine` or `ShellLine[]`. Remove `resolveLoadingLine` (no longer needed).

Read the current `ui-store.ts` file first, then make these changes:

1. Add import: `import type { ShellLine } from "@modules/terminal";`
2. Change `terminalLog: string[]` → `terminalLog: ShellLine[]`
3. Change `pushTerminalLine: (line: string) => void` → `pushTerminalLines: (lines: ShellLine[]) => void`
4. Update the implementation to append arrays
5. Remove `resolveLoadingLine`
6. Update the `partialize` to persist `terminalLog` (it may already be persisted or excluded — check)

- [ ] **Step 2: Update game module index.ts**

Re-export the terminal module from the game module's index if needed, or keep them as separate imports. The simplest approach is to have components import from `@modules/terminal` directly.

- [ ] **Step 3: Verify it compiles**

Run: `npm run typecheck`
Expected: Errors in `tutorial-screen.tsx` (uses old API) — that's fine, we'll rewrite it next.

- [ ] **Step 4: Commit**

```bash
git add apps/game/src/modules/game/store/ui-store.ts
git commit -m "♻️ Update ui-store terminalLog from string[] to ShellLine[]"
```

---

## Task 9: Rewrite TutorialTip as Interactive Shell

**Files:**
- Rewrite: `apps/game/src/components/tutorial-screen.tsx`

This is the largest task. The component becomes an interactive terminal with:
- oh-my-zsh prompt rendering
- Input field with tab autocomplete
- Tool-call block rendering (tutorial, milestone)
- Next milestone hint
- Auto-scroll with "near bottom" detection
- SFX on events
- Command history navigation (up/down arrows)

- [ ] **Step 1: Rewrite the component**

Read the full spec at `docs/superpowers/specs/2026-04-01-terminal-rework-design.md` and the existing file. The new component should:

1. **Prompt rendering**: Use `shellEngine.getPromptSegments()` to render the colored oh-my-zsh prompt above the input
2. **Input handling**: On Enter, call `shellEngine.execute(input)`, append prompt + command + result lines to `terminalLog` via `pushTerminalLines`
3. **Tab autocomplete**: On Tab, call `shellEngine.autocomplete(input)`. If one match, complete inline. If multiple, show list below prompt.
4. **Arrow keys**: Up/Down cycle through `shellEngine.getCommandHistory()`
5. **Tool-call blocks**: Render `tool_header`/`tool_body` with blue left border, `milestone_header`/`milestone_body` with orange left border
6. **Next milestone**: Render `next_milestone` type as faded hint
7. **Line coloring**: `output` = foreground, `file` = locColor, `dir` = cashColor, `error` = red, etc.
8. **Auto-scroll**: Smooth scroll if within 50px of bottom. Show "↓ new" indicator otherwise.
9. **SFX**: Play `terminalKey` on command submit, `event` on tutorial blocks, `milestone` on milestone blocks, `purchase` on successful buy

Keep the `useTutorialTriggers` hook but update it to use `shellEngine.pushToolCall()` and `pushTerminalLines()` instead of raw strings. Keep `useKeyboardShortcuts` unchanged.

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`

- [ ] **Step 3: Run the dev server and test**

Run: `npm run dev`

Test:
- Terminal shows on game start with welcome tool-call block
- Type `help` → shows command list
- Type `ls` → shows directory listing
- Type `cd upgrades && ls` → navigates and lists
- Type `cat README.md` → shows file contents
- Type `status` → shows resources
- Tab completion works for commands and paths
- Up arrow recalls previous commands
- Prompt shows `❯ ~/garage on ⎇ main`

- [ ] **Step 4: Commit**

```bash
git add apps/game/src/components/tutorial-screen.tsx
git commit -m "✨ Rewrite TutorialTip as interactive oh-my-zsh shell"
```

---

## Task 10: Add `!` Prefix to CliPrompt

**Files:**
- Modify: `apps/game/src/components/cli-prompt.tsx`

- [ ] **Step 1: Add shell command forwarding**

In the `handleSubmit` callback (around line 414), add a check: if the input starts with `!`, strip the prefix and forward to `shellEngine.execute()`. Display the result in the CliPrompt's own log.

Read the file first. Find `handleSubmit` and the `addEntry` function. Then:

1. Import `shellEngine` from `@modules/terminal`
2. In `handleSubmit`, before the existing AI prompt logic, add:

```tsx
if (text.startsWith("!")) {
  const cmd = text.slice(1).trim();
  if (!cmd) return;
  setInput("");
  // Add the command as a prompt entry
  addEntry({ kind: "prompt", text: `! ${cmd}` });
  // Execute and add results
  const result = shellEngine.execute(cmd);
  for (const line of result.lines) {
    addEntry({ kind: "text", text: line.text, color: line.color });
  }
  return;
}
```

Adapt the `addEntry` call to match the existing `LogEntry` shape (check the `kind` union type and properties).

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/components/cli-prompt.tsx
git commit -m "✨ Add ! prefix shell command forwarding to CliPrompt"
```

---

## Task 11: Update i18n

**Files:**
- Modify: `apps/game/src/i18n/locales/en/tutorial.json`
- Modify: `apps/game/src/i18n/locales/{fr,it,de,es,pl,zh,ru}/tutorial.json`

- [ ] **Step 1: Update English tutorial content**

Replace the current tutorial.json with updated messages that work as tool-call block content (shorter, punchier, with command hints):

```json
{
  "welcome": {
    "header": "tutorial.welcome()",
    "body": "A keyboard. A dream. Every keystroke = Lines of Code.\nType to fill the code queue. Execute to earn $$$."
  },
  "tech_tree": {
    "header": "tutorial.tech_tree()",
    "body": "Tech tree unlocked! Research upgrades with cash and LoC.\nRun `cd tech-tree && ls` to browse nodes."
  },
  "sidebar": {
    "header": "tutorial.sidebar()",
    "body": "File explorer unlocked! Browse and buy upgrades by tier.\nRun `ls upgrades/` to see what's available."
  },
  "execution": {
    "header": "tutorial.execution()",
    "body": "type → queue → execute → $$$\nCode piles up. FLOPS burn through it. Cash flows."
  },
  "first_purchase": {
    "header": "tutorial.first_purchase()",
    "body": "First upgrade purchased! Check your stats with `status`."
  },
  "first_tier": {
    "header": "tutorial.tier_unlocked()",
    "body": "New tier reached! More upgrades, more power.\nRun `ls upgrades/` to see what's new."
  },
  "ai_lab": {
    "header": "tutorial.ai_lab()",
    "body": "AI Lab online. Workers now produce tokens instead of LoC.\nAI models consume tokens + FLOPS → massive LoC output."
  },
  "singularity_hint": {
    "header": "tutorial.endgame()",
    "body": "The Singularity is within reach.\nCheck `cat agi.py` for a hint..."
  },
  "terminal_label": "Terminal",
  "terminal_shortcut": "Ctrl+T",
  "close_terminal": "Close terminal (Ctrl+T)",
  "new_content": "↓ new"
}
```

- [ ] **Step 2: Mirror to all other locales**

Translate the `header` fields and `body` fields for fr, it, de, es, pl, zh, ru.

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/i18n/
git commit -m "🌐 Update tutorial i18n for interactive shell tool-call format"
```

---

## Task 12: Lint, Format, and Final Verification

**Files:** All modified/created files

- [ ] **Step 1: Run biome check and fix**

```bash
npm run check:fix
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Run balance simulation**

```bash
npm run sim
```

Expected: All 3 profiles pass (terminal changes don't affect game balance)

- [ ] **Step 4: Run the game end to end**

```bash
npm run dev
```

Manual verification checklist:
- Terminal shows with welcome tool-call block on game start
- oh-my-zsh prompt displays `❯ ~/garage on ⎇ main`
- `ls` shows directory listing with colored dirs/files
- `cd upgrades/tier0 && ls` navigates correctly
- `cat upgrades/tier0/cpu_upgrade.ts` shows file with stats
- `buy cpu_upgrade` purchases the upgrade (if affordable)
- `research better_keyboard` researches the node (if affordable)
- `status` shows current resources
- Tab autocomplete works for commands, paths, upgrade IDs, tech IDs
- Up/Down arrow navigates command history
- `help` shows all commands
- `grep` and `find` search the filesystem
- `clear` clears the terminal
- Tutorial tool-call blocks appear at correct triggers
- Milestone blocks appear with orange border
- Next milestone hint visible at bottom
- Auto-scroll works, stops when user scrolls up
- SFX plays on command submit and notifications
- CliPrompt `!ls` forwards to shell and shows results
- Prompt changes dir name and color on tier transition
- Cash appears in brackets at T3+
- No console errors

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "✨ Terminal rework complete — interactive shell with virtual filesystem"
```
