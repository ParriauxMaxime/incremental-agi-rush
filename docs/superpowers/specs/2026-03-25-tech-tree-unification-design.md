# Tech Tree Unification

## Summary

Replace the game's custom SVG tech tree renderer with React Flow (already used by the editor). Both apps share a single `TechNodeComponent` from `libs/design-system` with a `state` prop for game-specific visuals. Positions set in the editor render identically in-game.

## Problem

The game and editor render tech tree nodes independently:
- **Game**: custom SVG (172×58 nodes, dagre 40/60, custom pan/zoom, custom popover)
- **Editor**: React Flow + `TechNodeComponent` (160×60 nodes, dagre 60/80)

This means positions set in the editor don't look the same in-game, and node appearance is maintained in two places.

## Design

### NodeStateEnum

Add to `libs/design-system/tech-tree/types.ts`:

```typescript
export const NodeStateEnum = {
  locked: "locked",
  visible: "visible",
  affordable: "affordable",
  owned: "owned",
} as const;

export type NodeStateEnum = (typeof NodeStateEnum)[keyof typeof NodeStateEnum];
```

### Extended TechNodeComponent

`libs/design-system/tech-tree/tech-node.tsx` gets a `state` prop via its `data`:

```typescript
data: {
  ...TechNode fields,
  state: NodeStateEnum,
  owned?: number,     // current level (game only)
  cost?: number,      // formatted cost (game only)
}
```

Visual mapping:
| State | Opacity | Border | Notes |
|-------|---------|--------|-------|
| `locked` | 0.4 | `#1e2630` | Dimmed, no hover |
| `visible` | 0.6 | `#1e2630` | Seen but can't afford |
| `affordable` | 1.0 | `#58a6ff` | Highlighted, cursor pointer |
| `owned` | 0.8 | `#3fb950` | Green, shows "Researched" or level |

The component renders: icon + name + optional level/cost subtitle. Current editor rendering (icon + name + cost) is the baseline; game states extend it.

Editor passes `state: "visible"` for all nodes (or `"owned"` if previewing).

### Game Tech Tree Page Rewrite

`apps/game/src/components/tech-tree-page.tsx` is rewritten to use React Flow:

- Import `TechNodeComponent` and `useTechTreeFlow` from `@agi-rush/design-system`
- Map game state to `NodeStateEnum` for each node:
  - `prereqsMet === false` → `locked`
  - `prereqsMet && !canAfford && !maxed` → `visible`
  - `prereqsMet && canAfford && !maxed` → `affordable`
  - `owned >= max` → `owned`
- Nodes with `state === "locked"` are hidden (not rendered) — same as current behavior where nodes are invisible until prereqs are met
- Use React Flow's built-in pan/zoom/minimap (delete the custom `usePanZoom` hook)
- `onNodeClick` triggers research (if affordable) or shows popover

### Popover

The game's `NodePopover` stays as a game-specific component. It renders as an absolutely-positioned overlay triggered by node hover/click, showing: name, description, cost, level, requirements, status. It uses React Flow's node position + viewport transform to position itself.

### Positions & Layout

- Both apps use the same node dimensions: **160×60**
- Positions from `tech-tree.json` (`x`, `y` fields) are used directly
- The editor's dagre re-layout stays at `nodesep: 60, ranksep: 80`
- The game no longer has its own dagre fallback — it uses whatever positions are in the data (the editor is the source of truth for layout)

## Files

### Modified

- `libs/design-system/tech-tree/types.ts` — Add `NodeStateEnum`
- `libs/design-system/tech-tree/tech-node.tsx` — Add `state` prop, visual variants, optional level/cost display
- `libs/design-system/index.ts` — Export `NodeStateEnum`
- `apps/game/src/components/tech-tree-page.tsx` — Full rewrite: SVG → React Flow
- `apps/editor/src/pages/tech-tree/tech-tree-page.tsx` — Pass `state: "visible"` to nodes

### Deleted (code within game tech-tree-page.tsx)

- `SvgNode` component
- `usePanZoom` hook (inline in tech-tree-page.tsx)
- `computeLayout` with dagre fallback
- Custom SVG edge rendering

### Not changed

- `apps/editor/src/pages/tech-tree/node-inspector.tsx` — No changes
- `libs/design-system/tech-tree/use-tech-tree-flow.ts` — No changes needed (already handles positions and edges)
- Game store logic (`researchNode`, `getTechNodeCost`) — No changes
- `tech-tree.json` data — No changes

## Edge Cases

- **No positions in data**: If `x`/`y` are undefined for a node, default to `(0, 0)`. The editor's re-layout button fixes this.
- **Hidden nodes**: Nodes with `state === "locked"` are filtered out of the React Flow nodes array entirely (not rendered), matching current game behavior.
- **Hidden edges**: Edges where either source or target is locked are also filtered out.

## Non-goals

- Custom popover styling changes (keep current look)
- Adding game state to editor (editor stays stateless)
- Changing tech tree data schema
- Adding zoom-to-fit or other React Flow features beyond what's needed for parity
