`# Session Analytics Design

## Overview

Add temporal analytics to the current game session — how the player got where they are, not just where they are now. Complements the existing stats panel (current resources) and analytics dashboard (live rates) with historical data.

## What Exists Today

- **Stats panel** (tech unlock, 5 cash): current resources, lifetime totals, $/s rate
- **Analytics dashboard** (tech unlock, 200 cash): live LoC/s breakdown by source, execution ratio

Both show the *present*. Neither tracks *history*.

## New Feature: Session Timeline + Rate Graphs

### Session Timeline (unlock ~T1, cheap ~50 cash tech node)

Displays temporal context for the current session:

- **Session clock** — elapsed time since game start (or since last reset)
- **Tier timeline** — horizontal stacked bar showing time spent in each tier, color-coded by tier. Current tier animates/pulses
- **Purchase feed** — last 10 purchases with relative timestamps ("RAM Stick — 45s ago"), scrollable
- **Trend indicators** — on key metrics (cash/s, LoC/s), show arrow + percentage vs 30 seconds ago (e.g., "cash/s: $12.5 +23%")

### Performance Graphs (unlock ~T2-T3, 2000-5000 cash tech node)

Sparkline graphs tracking rates over time:

- **Cash/s** over session (primary metric)
- **LoC/s produced** vs **LoC/s executed** (shows queue health)
- **FLOPS utilization** — % of FLOPS actually executing LoC (100% = queue never empty)

Sampling: snapshot every 5 seconds into a ring buffer of 720 entries (1 hour max). Each snapshot: `{ t, cashPerSec, locProduced, locExecuted, flops, flopUtil, tier }`.

### UI Placement

New tab in the existing analytics area (bottom panel). Two sub-tabs: "Timeline" and "Graphs". Graphs use simple inline SVG sparklines — no charting library needed.

## New State Required

Added to game store (persisted with save):

```typescript
interface SessionAnalytics {
  sessionStartTime: number;              // Date.now() at game start
  tierTransitions: TierTransition[];     // { tier, enteredAt, exitedAt? }
  purchaseLog: PurchaseEntry[];          // { id, name, cost, time } — ring buffer, 50 max
  rateSnapshots: RateSnapshot[];         // ring buffer, 720 max (1hr at 5s intervals)
  lastSnapshotTime: number;              // for throttling
}

interface TierTransition {
  tierIndex: number;
  enteredAt: number;   // seconds since sessionStartTime
  exitedAt?: number;
}

interface PurchaseEntry {
  id: string;
  name: string;
  cost: number;
  time: number;        // seconds since sessionStartTime
}

interface RateSnapshot {
  t: number;           // seconds since sessionStartTime
  cashPerSec: number;
  locProducedPerSec: number;
  locExecutedPerSec: number;
  flops: number;
  flopUtilization: number;
  tierIndex: number;
}
```

## Tech Tree Nodes

Two new tech nodes in `tech-tree.json`:

1. **`unlock_session_timeline`** — cost: 50 cash, requires: `unlock_stats_panel`. Unlocks the Timeline tab.
2. **`unlock_perf_graphs`** — cost: 3000 cash, requires: `unlock_session_timeline` + `tier_startup`. Unlocks the Graphs tab.

## Data Collection

- **Tier transitions**: append on `currentTierIndex` change (already in store)
- **Purchase log**: append in existing `buyUpgrade` / `researchNode` actions
- **Rate snapshots**: in game loop tick, check if 5s elapsed since last snapshot, push to ring buffer
- **Trend calculation**: compare latest snapshot to snapshot from ~30s ago (6 entries back)

## Sparkline Rendering

Inline SVG, no library. Each sparkline is a `<svg>` with a `<polyline>` mapping snapshot values to x/y coordinates. Tier transitions shown as vertical dashed lines with tier color. ~50 lines of code per sparkline component.
