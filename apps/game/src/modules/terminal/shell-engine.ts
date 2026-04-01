import { tierColors } from "@flopsed/design-system";
import { tiers } from "@flopsed/domain";
import { allMilestones, useGameStore } from "@modules/game";
import { formatNumber } from "@utils/format";
import { autocomplete } from "./autocomplete";
import {
	cmdAutoExecute,
	cmdBuy,
	cmdExecute,
	cmdResearch,
	cmdStatus,
} from "./commands/game-actions";
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
import { buildFilesystem } from "./virtual-fs";

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
	execute: cmdExecute,
	"auto-execute": cmdAutoExecute,
	status: cmdStatus,
	help: cmdHelp,
	clear: cmdClear,
	find: cmdFind,
	grep: cmdGrep,
	history: cmdHistory,
};

function getGameState() {
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
		const state = getGameState();
		const reached = (state.reachedMilestones ?? []) as string[];

		const next = allMilestones.find((m) => !reached.includes(m.id));
		if (!next) return null;

		return { label: next.description };
	}

	/** Export tier name for display purposes */
	getCurrentTierDir(): string {
		const state = getGameState();
		const tierIndex = (state.currentTierIndex ?? 0) as number;
		return TIER_DIRS[tierIndex] ?? "garage";
	}
}

/** Singleton instance */
export const shellEngine = new ShellEngineImpl();

/** Export tier list for use in prompt rendering */
export { tiers };
