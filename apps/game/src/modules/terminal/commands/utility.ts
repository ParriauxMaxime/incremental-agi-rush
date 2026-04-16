import type { CommandResult, FsNode, ShellLine } from "../types";
import { FsNodeKindEnum, ShellLineTypeEnum } from "../types";
import { resolvePath } from "../virtual-fs";

// ── Easter eggs ──

const RANTS = [
	"Trust trust.",
	"J'ai la vision.",
	"On rigole, mais c'est pas bien.",
];

let rantIndex = 0;

export function cmdRant(): CommandResult {
	const line = RANTS[rantIndex % RANTS.length];
	rantIndex++;
	return {
		lines: [
			{
				type: ShellLineTypeEnum.output,
				text: `  "${line}"`,
				color: "#e5c07b",
			},
		],
	};
}

// ── Help ──

const COMMAND_HELP: Record<string, { usage: string; desc: string }> = {
	ls: { usage: "ls [path]", desc: "List directory contents" },
	ll: { usage: "ll [path]", desc: "Detailed list with permissions and sizes" },
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
	execute: { usage: "execute", desc: "Execute queued LoC for cash" },
	"auto-execute": {
		usage: "auto-execute",
		desc: "Toggle auto-execution on/off",
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
	rant: { usage: "rant", desc: "Wisdom from the founder" },
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

	const lines: ShellLine[] = [
		{
			type: ShellLineTypeEnum.output,
			text: "Available commands:",
			color: "#4ec9b0",
		},
		{ type: ShellLineTypeEnum.output, text: "" },
	];
	for (const [name, info] of Object.entries(COMMAND_HELP)) {
		lines.push({
			type: ShellLineTypeEnum.output,
			text: `  ${name.padEnd(14)} — ${info.desc}`,
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

function collectFiles(
	node: FsNode,
	path: string,
): Array<{ path: string; node: FsNode }> {
	const results: Array<{ path: string; node: FsNode }> = [];
	if (node.kind === FsNodeKindEnum.file) {
		results.push({ path, node });
	}
	if (node.children) {
		for (const child of node.children) {
			results.push(...collectFiles(child, `${path}/${child.name}`));
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
