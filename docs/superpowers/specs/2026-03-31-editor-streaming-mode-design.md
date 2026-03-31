# Editor Streaming Mode

## Problem

The editor's `blockQueue` system allocates a new array every few ticks to track individual code blocks. At T2+ with auto-producers (freelancers, interns, dev teams), this creates thousands of DOM mutations/sec and unnecessary memory pressure. Players aren't watching individual code blocks at this stage — they're managing upgrades and economy.

## Current Architecture

```
Tick (20fps)
  └── blockQueue = [...blockQueue] + push({ lines: [], loc })
        └── Editor reads blockQueue
              └── buildLineList() → last 8 blocks → flat line array
                    └── Virtual renderer → visible lines only
                          └── use-code-typing token animation
```

- `blockQueue`: capped at 100 elements, copied every 5th tick when `visualProduced > 0`
- Editor shows last `MAX_DISPLAY_BLOCKS = 8` blocks with virtual scrolling
- Typing animation runs token-by-token at 50ms visual refresh
- At T4+ the editor is replaced by `<CliPrompt />` entirely

## Design

### Two Editor Modes

**Block mode** (T0 – early T2): Current behavior. Individual blocks are tracked, token-by-token typing animation plays, each keystroke feels connected to visible code appearing. This is the core early-game feel.

**Streaming mode** (mid T2 – T3): Simplified visual. No per-block tracking. The editor reads `loc` and `autoLocPerSec` directly from the game store and renders a visual state:

- **Filling**: `loc` is growing (production > execution). Code scrolls upward continuously via CSS animation. The scroll speed is proportional to `autoLocPerSec`. Pre-rendered code lines cycle through — no per-tick DOM updates needed.
- **Draining**: `loc` is falling (execution > production). Lines fade/disappear from the top. Scroll slows and stops.
- **Idle**: `loc` is near zero. Editor shows a few static lines with a blinking cursor, similar to early game but without active typing.

### Transition Trigger

Switch from block mode to streaming mode when:

```
autoLocPerSec > locPerKey * 8
```

This means auto-producers generate more than ~8 keystrokes/sec worth of LoC — roughly when a player with a couple of freelancers stops being the primary code source. The threshold should use `locPerKey * 8` (not a fixed number) so upgrades to `locPerKey` delay the transition naturally.

The transition is **one-way per session** — once streaming mode activates, it stays. No flip-flopping. Store a boolean `editorStreamingMode` in the game store, set it once when the threshold is crossed.

### Streaming Mode Visual

The streaming editor is a purely CSS-driven scrolling display:

1. **Pre-built line buffer**: On mount, render ~40 lines of code from the existing `code-tokens.ts` data (the same Python AGI code). These are static DOM — no per-tick updates.
2. **CSS scroll animation**: A `@keyframes` animation that `translateY`s the line container upward. The `animation-duration` is derived from `autoLocPerSec` — faster production = faster scroll.
3. **Opacity mask**: CSS gradient masks at top and bottom edges to fade lines in/out smoothly.
4. **Fill indicator**: A subtle vertical progress bar on the right gutter showing `loc / maxVisualLoc` — gives the player a sense of the queue filling/draining without per-line DOM updates.

When `autoExecuteEnabled` is true and execution keeps up, the scroll speed stabilizes. When the queue empties (`loc < threshold`), the animation pauses and the last few lines remain visible with a blinking cursor.

### Game Loop Changes

In `tick()`, the blockQueue section becomes:

```typescript
// ── 3. Visual block queue ──
let blockQueue = s.blockQueue;
if (aiUnlocked) {
    // T4+: editor replaced by CLI prompt
    if (blockQueue.length > 0) blockQueue = [];
} else if (s.editorStreamingMode) {
    // T2-T3 streaming: no block tracking needed
    if (blockQueue.length > 0) blockQueue = [];
} else {
    // T0-early T2: per-block tracking
    const visualProduced = Math.floor(humanOutput + aiProduced);
    if (visualProduced > 0 && visualTick % 5 === 0) {
        blockQueue = blockQueue.length >= 100
            ? blockQueue.slice(-99)
            : [...blockQueue];
        blockQueue.push({ lines: [], loc: visualProduced * 5 });
    }
}
```

When `editorStreamingMode` is true, zero array allocations per tick.

### Transition Detection

In `recalcDerivedStats` (already runs on purchase/event), after computing `autoLocPerSec` and `locPerKey`:

```typescript
if (!state.editorStreamingMode && state.autoLocPerSec > state.locPerKey * 8) {
    state.editorStreamingMode = true;
}
```

### EditorPanel Routing

```typescript
function EditorPanel() {
    const aiUnlocked = useGameStore((s) => s.aiUnlocked);
    const streamingMode = useGameStore((s) => s.editorStreamingMode);

    if (aiUnlocked) return <CliPrompt />;
    if (streamingMode) return <StreamingEditor />;
    return <Editor />;  // current block-based editor
}
```

## Performance Impact

| Metric | Block mode (current) | Streaming mode |
|--------|---------------------|----------------|
| Array allocs/tick | 1 (blockQueue copy) | 0 |
| DOM mutations/sec | ~200+ (line rendering) | ~0 (CSS animation only) |
| React re-renders | Every tick (blockQueue ref changes) | Only on mode/speed changes |
| Memory pressure | ~100 KB/sec | Negligible |

## Scope

### In scope
- `StreamingEditor` component with CSS-driven scroll animation
- `editorStreamingMode` flag in game store + transition logic
- Skip blockQueue in tick when streaming
- Persist the flag in save data

### Out of scope
- Changing T0-T1 typing feel
- Changing T4+ CLI prompt behavior
- Visual transition animation between modes (just swap instantly)
- Reverse transition (streaming → block)

## Files to Change

1. `apps/game/src/modules/game/store/game-store.ts` — add `editorStreamingMode` to state, transition logic in recalc, skip blockQueue in tick
2. `apps/game/src/components/editor-panel.tsx` — route to StreamingEditor
3. `apps/game/src/modules/editor/components/streaming-editor.tsx` — new component
4. `apps/game/src/modules/editor/index.ts` — export StreamingEditor
