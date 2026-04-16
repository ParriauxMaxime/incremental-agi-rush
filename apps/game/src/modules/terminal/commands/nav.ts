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
		if (a.kind !== b.kind) return a.kind === FsNodeKindEnum.dir ? -1 : 1;
		return a.name.localeCompare(b.name);
	});
	for (const child of sorted) {
		lines.push({
			type:
				child.kind === FsNodeKindEnum.dir
					? ShellLineTypeEnum.dir
					: ShellLineTypeEnum.file,
			text: child.name,
			// locked dirs get dimmed via the UI renderer
		});
	}
	return { lines };
}

/** ls -l style: one entry per line with type indicator and content count */
export function cmdLl(
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
					text: `ll: cannot access '${target}': No such file or directory`,
				},
			],
		};
	}
	if (node.kind === FsNodeKindEnum.file) {
		const lineCount = node.content?.length ?? 0;
		return {
			lines: [
				{
					type: ShellLineTypeEnum.file,
					text: `  -rw-r--r--  ${String(lineCount).padStart(3)} lines  ${node.name}`,
				},
			],
		};
	}
	if (!node.children || node.children.length === 0) {
		return { lines: [] };
	}
	const sorted = [...node.children].sort((a, b) => {
		if (a.kind !== b.kind) return a.kind === FsNodeKindEnum.dir ? -1 : 1;
		return a.name.localeCompare(b.name);
	});
	const lines: ShellLine[] = [];
	for (const child of sorted) {
		const isDir = child.kind === FsNodeKindEnum.dir;
		const count = isDir
			? `${child.children?.length ?? 0} items`
			: `${String(child.content?.length ?? 0).padStart(3)} lines`;
		lines.push({
			type: isDir ? ShellLineTypeEnum.dir : ShellLineTypeEnum.file,
			text: `  ${isDir ? "drwxr-xr-x" : "-rw-r--r--"}  ${count.padStart(8)}  ${child.name}`,
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
	// Block escaping root
	if (target === ".." && cwd === "~") {
		return {
			lines: [
				{
					type: ShellLineTypeEnum.error,
					text: "cd: permission denied: cannot escape project root",
				},
			],
		};
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
			cwd === "~"
				? `~/${target.replace(/\/$/, "")}`
				: `${cwd}/${target.replace(/\/$/, "")}`;
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
				text: cwd.startsWith("~") ? `/home/player/${cwd.slice(2)}` : cwd,
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
		if (a.kind !== b.kind) return a.kind === FsNodeKindEnum.dir ? -1 : 1;
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
			lines.push(...treeHelper(child, childPrefix, depth + 1, maxDepth));
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
