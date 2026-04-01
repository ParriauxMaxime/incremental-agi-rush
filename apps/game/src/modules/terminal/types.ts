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
