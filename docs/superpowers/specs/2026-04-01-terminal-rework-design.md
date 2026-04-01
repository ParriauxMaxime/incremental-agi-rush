# Terminal Rework — Interactive Shell with Virtual Filesystem

**Date:** 2026-04-01
**Status:** Approved
**Mockup:** `.superpowers/brainstorm/1110656-1775041169/content/terminal-design.html`

## Summary

Replace the passive tutorial terminal with a fully interactive oh-my-zsh-styled shell. Players can navigate a virtual filesystem that mirrors game state, buy upgrades and research tech nodes from the command line with autocomplete, and receive tutorial/milestone notifications as inline tool-call blocks. The existing CliPrompt (AI diff streaming) stays separate but gains `!` prefix support for shell commands.

## Two Terminals, One Shell Engine

### 1. Tutorial Shell (bottom panel — `TutorialTip` today)
- Always available from game start
- oh-my-zsh themed prompt: `❯ ~/garage on ⎇ main`
- Interactive: player types commands, gets responses
- Tutorial messages appear as blue tool-call blocks
- Milestones appear as orange tool-call blocks
- Next milestone hint always visible (faded, shows one upcoming target)
- Auto-scrolls smoothly on new content
- SFX plays on tool-call block appearance (`event` sound)

### 2. CliPrompt (editor tab — unchanged role)
- Only appears when AI unlocked (T4+)
- Streams AI-generated code diffs as before
- **New:** typing `!<command>` forwards to the shell engine and displays the result inline
  - e.g. `!ls models/` shows the file listing inside CliPrompt
  - e.g. `!buy gpu_cluster` executes the purchase
  - The `!` prefix is stripped, command is evaluated by the shared shell engine, output rendered in CliPrompt's log

### Shared Shell Engine
A pure-logic module (no React) that:
- Maintains the virtual filesystem tree
- Parses and executes commands
- Returns structured output (lines with type/color metadata)
- Both terminals call into the same engine instance

## oh-my-zsh Prompt

```
❯ ~/garage on ⎇ main
$
```

### Prompt segments
- `❯` — arrow in success color (teal `#4ec9b0`)
- `~/garage` — current directory in locColor (blue `#61afef`), changes with tier
- `on ⎇ main` — git branch decoration in muted text
- `$` — command input prefix in success color
- Late game (T3+): cash shown in brackets `[$142M]` after branch

### Directory changes with tier
| Tier | Home dir |
|------|----------|
| T0 Garage | `~/garage` |
| T1 Freelancing | `~/freelancing` |
| T2 Startup | `~/startup` |
| T3 Tech Company | `~/tech-co` |
| T4 AI Lab | `~/ai-lab` |
| T5 AGI Race | `~/agi-race` |

The home dir updates automatically on tier transition. The prompt dir color uses the tier color.

## Virtual Filesystem

The filesystem mirrors game state. It's read-only for `cat`/`ls` but `buy` and `research` are action commands.

### Directory structure (evolves with unlocks)

```
~/garage/
├── README.md              # game intro text (cat-able)
├── .env                   # game config: FLOPS, tier, slider values
├── upgrades/
│   ├── tier0/
│   │   ├── cpu_upgrade.ts
│   │   ├── ram_stick.ts
│   │   └── storage.ts
│   ├── tier1/             # appears when T1 unlocked
│   │   ├── freelancer.ts
│   │   └── ...
│   └── ...
├── tech-tree/
│   ├── computer.ts        # owned nodes show as files
│   ├── coffee.ts
│   └── ...
├── models/                # appears when AI unlocked
│   ├── claude-4.onnx
│   └── ...
└── agi.py                 # always present, cat shows "coming soon..."
```

### File contents (cat output)
- **upgrade files** (e.g. `cat upgrades/tier0/cpu_upgrade.ts`):
  ```
  // CPU Upgrade — owned: 3/5
  // Effect: +10 FLOPS
  // Cost: $150 (next: $225)
  export const cpu_upgrade = { flops: 10, cost: 150 };
  ```
- **tech-tree files** (e.g. `cat tech-tree/freelancing.ts`):
  ```
  // Freelancing — Tier 1 unlock
  // Status: Researched ✓
  // Effect: Unlock freelancer hiring
  export const freelancing = { tier: 1, status: "researched" };
  ```
- **model files** (e.g. `cat models/claude-4.onnx`):
  ```
  // Claude 4 — active
  // Token consumption: 8,200/s
  // FLOPS demand: 24,000
  // LoC output: 12,400/s
  ```
- **README.md**: static intro text (same as current tutorial welcome)
- **.env**: live game config values (FLOPS_TOTAL, FLOP_SLIDER, TIER, AI_MODELS, etc.)
- **agi.py**: fun easter egg, content changes per tier

## Commands

### Navigation
| Command | Description |
|---------|-------------|
| `ls [path]` | List directory contents. Dirs in yellow, files in blue, locked in muted/dim |
| `cd <path>` | Change directory. Supports `..`, absolute paths, tab completion |
| `cat <file>` | Display file contents with syntax highlighting |
| `pwd` | Print working directory |
| `tree [path]` | Show directory tree (2 levels deep max) |

### Game actions
| Command | Description |
|---------|-------------|
| `buy <upgrade_id> [count]` | Purchase an upgrade. Shows cost, effect, confirms purchase. Count defaults to 1 |
| `research <tech_node_id>` | Research a tech node. Shows cost, requirements, confirms |
| `status` | Show current resources (cash, LoC, FLOPS, tokens) + tier |
| `help [command]` | List commands or show help for a specific command |

### Utility
| Command | Description |
|---------|-------------|
| `clear` | Clear terminal output |
| `history` | Show command history |
| `grep <pattern> [path]` | Search file contents (searches upgrade/tech descriptions) |
| `find <name>` | Find files by name pattern |

### Autocomplete
- Tab completion for commands, paths, upgrade IDs, and tech node IDs
- Shows suggestions inline (like zsh) — if multiple matches, list them below the prompt
- Upgrade/tech IDs autocomplete from the domain data (e.g. typing `buy cpu` → `buy cpu_upgrade`)
- Path completion works with the virtual filesystem tree

## Tool-Call Blocks

Async notifications rendered inline in the terminal log, styled as bordered blocks.

### Types
| Type | Border color | Icon | When |
|------|-------------|------|------|
| Tutorial | `#528bff` (accent blue) | 🔧 | Game state triggers (welcome, tech tree unlock, sidebar, execution, AI lab) |
| Milestone | `#d4782f` (tier orange) | 🏆 | Milestone reached (100 LoC, first purchase, tier unlocks, etc.) |
| AI output | Model family color | 🤖 | AI model generates code (only in CliPrompt, not tutorial shell) |

### Rendering
```
┃ 🔧 tutorial.welcome()
┃ A keyboard. A dream. Every keystroke = Lines of Code.
┃ Type to fill the code queue. Execute to earn $$$.
```

- Left border (2px) in type color
- Subtle background tint (6% opacity of border color)
- Header: icon + function-call-style label
- Body: message text, can include highlighted values

### Tutorial triggers (same as current, improved messages)
| Trigger | Condition | Message |
|---------|-----------|---------|
| welcome | Game start | Intro + basic mechanics |
| tech_tree | `totalLoc >= 15` | Tech tree explanation + `cd tech-tree && ls` hint |
| sidebar | `unlock_sidebar` node | File explorer + browsing hint |
| execution | `unlock_stats_panel` node | type → queue → execute → $$$ flow |
| first_purchase | First upgrade bought | Congrats + upgrade effect explanation |
| first_tier | Tier 1 unlocked | New tier intro + what's new |
| ai_lab | AI unlocked | Token/FLOPS split explanation |
| singularity_hint | T5 + cash > $100T | Tease the endgame |

### Next Milestone Hint
Always one line visible below the latest content:
```
⏳ next: reach 15 LoC to unlock tech tree
```
- Faded text (muted color)
- Updates when current milestone is reached
- Shows the closest upcoming milestone the player hasn't hit yet

## Auto-Scroll
- Smooth scroll (`behavior: "smooth"`) to bottom when new content added
- Only auto-scrolls if user is already near the bottom (within 50px)
- If user has scrolled up to read history, don't force-scroll — show a "↓ new" indicator instead

## Sound Effects
- Tool-call block appears → play `event` SFX
- Milestone block appears → play `milestone` SFX
- Command executed → play `terminalKey` SFX
- Purchase via `buy` → play `purchase` SFX

## Architecture

### New/Modified Files

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/game/src/modules/terminal/shell-engine.ts` | Pure logic: filesystem tree, command parser, command executor |
| Create | `apps/game/src/modules/terminal/virtual-fs.ts` | Virtual filesystem builder from game state |
| Create | `apps/game/src/modules/terminal/commands/` | One file per command group (nav.ts, game-actions.ts, utility.ts) |
| Create | `apps/game/src/modules/terminal/autocomplete.ts` | Tab completion logic |
| Create | `apps/game/src/modules/terminal/types.ts` | ShellLine, ShellCommand, FsNode types |
| Rewrite | `apps/game/src/components/tutorial-screen.tsx` | TutorialTip becomes the interactive shell UI |
| Modify | `apps/game/src/components/cli-prompt.tsx` | Add `!` prefix command forwarding |
| Modify | `apps/game/src/modules/game/store/ui-store.ts` | Replace `terminalLog: string[]` with `terminalLog: ShellLine[]` |
| Modify | `apps/game/src/i18n/locales/*/tutorial.json` | Update tutorial messages, add command help text |

### Shell Engine (pure logic, no React)
```typescript
interface ShellEngine {
  execute(input: string): ShellLine[];
  autocomplete(partial: string): string[];
  getCwd(): string;
  getPromptSegments(): PromptSegment[];
  pushToolCall(type: "tutorial" | "milestone", header: string, body: string): void;
  getNextMilestone(): { label: string } | null;
}
```

- Single instance shared between TutorialTip and CliPrompt
- Reads game state via store selectors (not subscriptions — queries on demand)
- `buy`/`research` commands call store actions directly
- Filesystem tree rebuilt lazily when accessed (not on every tick)

### ShellLine type
```typescript
type ShellLineType =
  | "prompt"        // ❯ ~/dir on ⎇ main
  | "command"       // $ user input
  | "output"        // plain text output
  | "file"          // file name (blue)
  | "dir"           // directory name (yellow)
  | "error"         // error message (red)
  | "tool-header"   // 🔧 tutorial.welcome()
  | "tool-body"     // tool call content
  | "milestone-header"
  | "milestone-body"
  | "next-milestone" // ⏳ next: ...
  | "separator";

interface ShellLine {
  type: ShellLineType;
  text: string;
  color?: string;     // override color
  indent?: number;    // indentation level
}
```

## What Gets Removed
- The passive `terminalLog: string[]` in ui-store (replaced with `ShellLine[]`)
- The simple line-by-line rendering in current TutorialTip
- The `resolveLoadingLine()` hack for the tech tree loading animation

## What Stays Unchanged
- CliPrompt's core AI diff streaming behavior
- The SFX system (we just call it from new places)
- Tutorial trigger conditions (same game state thresholds)
- Keyboard shortcuts (Ctrl+T toggle)
