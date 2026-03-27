# Dynamic Editor Panel — Design Spec

## Overview

The left panel of the game evolves across tiers, reflecting the player's shifting role from hands-on coder to AI director. The code editor starts dominant, shrinks as the company grows, and is eventually replaced by an AI control center. All transitions are animated.

## Panel Width Progression

The three-panel layout (left / tech tree / sidebar) uses flex ratios that change on tier unlock. The sidebar stays fixed-width. All flex changes animate with `transition: flex 0.5s ease`.

| Tier | Left Panel | Tech Tree | Sidebar |
|------|-----------|-----------|---------|
| T0-T1 | ~55% (`flex: 5`) | ~25% (`flex: 2`) | ~20% (`flex: 1`, min 320px, max 400px) |
| T2-T3 | ~25% (`flex: 2`) | ~55% (`flex: 5`) | same |
| T4-T5 | ~15% (`flex: 1`) | ~65% (`flex: 5.5`) | same |

Min-width constraints prevent panels from collapsing on small screens:
- Left panel: 320px at T0-T1, 280px at T2-T3, 240px at T4-T5
- Sidebar: 320px (existing)

## Left Panel Content by Tier

### T0-T1 — "The Coder"

Full code editor, unchanged from current behavior. Single `agi.py` tab (splits into 3 sub-editors at T3 per existing EditorPanel logic).

```
┌──────────────┐
│ agi.py       │
│              │
│  Code Editor │
│  (full)      │
│              │
└──────────────┘
```

### T2-T3 — "The Manager"

Analytics dashboard slides in above the editor. The editor shrinks but remains functional for manual typing.

```
┌──────────────┐
│ analytics.live│
│              │
│  Dashboard   │
│  (human devs)│
│              │
├──────────────┤
│ agi.py       │
│ Code Editor  │
│ (smaller)    │
└──────────────┘
```

The dashboard appears when the player first hires a dev (unlocks any of: freelancer, intern, dev team). It grows from 0 height with a CSS transition (~0.3s ease).

Dashboard/editor split: dashboard takes `flex: 2`, editor takes `flex: 3` at T2. At T3, dashboard grows to `flex: 3`, editor shrinks to `flex: 2`.

### T4-T5 — "The AI Director"

The editor slides away (shrinks to 0 height), the CLI prompt slides in at the bottom. The FLOPS slider moves from the sidebar into this panel.

```
┌──────────────┐
│ analytics.live│
│              │
│  Dashboard   │
│ (human + AI) │
│              │
├──────────────┤
│ FLOPS Slider │
│ Exec 70%/30% │
├──────────────┤
│ $ prompt     │
│ > ...        │
│ ✓ Generating │
└──────────────┘
```

The transition on T4 unlock:
- Editor shrinks to 0 height (~0.5s ease) and is removed from DOM after transition
- CLI prompt grows from 0 height (~0.5s ease)
- FLOPS slider moves from sidebar into this panel (removed from sidebar when `aiUnlocked`)

## Analytics Dashboard

### Content

Real-time LoC production broken into two sections:

**Human Sources** (visible from T2+):
- Freelancers — aggregate LoC/s, count owned
- Interns — aggregate LoC/s, count owned
- Dev Teams — aggregate LoC/s, count owned
- Managers — boost %, count owned
- You (manual typing) — current LoC/s

**AI Sources** (visible from T4+, appears below human section):
- Each owned AI model — name, LoC/s, FLOPS consumption, quality %
- Total AI LoC/s and total AI FLOPS cost

**Footer stats** (always visible):
- Total LoC/s (all sources combined)
- Execution ratio: `executed / produced` (shows bottleneck)

### Visual treatment

Each source is a row with:
- Source name (left)
- Progress bar (middle, proportional to total production)
- LoC/s value (right)

Progress bars use existing theme colors. Human section header in green, AI section header in amber/gold. Bars update in real-time (every tick or throttled to 200ms).

## CLI Prompt (T4+)

### Layout

Bottom section of the left panel. Contains:
1. **FLOPS slider** — relocated from sidebar. Same component, same behavior.
2. **Prompt input** — single-line text input styled as a terminal prompt (`$ ` prefix, blinking cursor).
3. **Response area** — scrollable log above the input showing model "responses".

### Behavior

The prompt is **cosmetic only**. Typing and submitting a prompt:
- Triggers a short flavor text response from one of the active AI models (random selection weighted by LoC/s)
- Response appears in the log area with the model's name and color
- No gameplay effect — models keep auto-generating regardless of what the player types

Example flavor responses:
- Claude Sonnet: "Refactoring your auth layer... this is actually elegant."
- GPT-4: "I've written a comprehensive 47-page analysis of your request. Here's the executive summary..."
- Llama 70B: "on it. shipping fast. no tests needed. yolo."
- Grok: "lmao imagine not using AI to write code. anyway here's your function"

If the player doesn't type anything, the log occasionally shows idle messages from models (every ~30s).

## Transition Summary

All transitions use CSS animations, no hard cuts:

| Trigger | Animation |
|---------|-----------|
| T0→T1 tier unlock | Left panel flex: no change (stays ~55%) |
| First dev hired (T2+) | Dashboard slides in above editor (height 0 → flex:2, ~0.3s ease) |
| T2→T3 tier unlock | Left panel flex 5→2 (~0.5s ease), tech tree flex 2→5 |
| T3→T4 tier unlock | Left panel flex 2→1 (~0.5s), editor height→0 (~0.5s), CLI prompt height 0→flex (~0.5s), FLOPS slider moves to left panel |
| T4→T5 tier unlock | Left panel flex stays at 1, tech tree flex 5→5.5 |

## Files to Create/Modify

- `apps/game/src/components/editor-panel.tsx` — Major rework: tier-aware layout, dashboard + CLI prompt sections
- `apps/game/src/components/analytics-dashboard.tsx` — New component: real-time LoC production dashboard
- `apps/game/src/components/cli-prompt.tsx` — New component: cosmetic LLM prompt with flavor responses
- `apps/game/src/components/flops-slider.tsx` — Minor: conditionally render in sidebar vs left panel based on `aiUnlocked`
- `apps/game/src/components/sidebar.tsx` — Minor: remove FlopsSlider when AI is unlocked
- `apps/game/src/app.tsx` — Update flex ratios to be tier-dependent

## Out of Scope

- Mobile layout changes (MobileShell has its own layout)
- Prompt affecting gameplay (kept cosmetic intentionally)
- Code quality visualization in the dashboard
- Prestige/rewrite mechanics
