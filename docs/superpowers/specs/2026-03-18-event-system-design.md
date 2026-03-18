# Event System Design

## Overview

Add a random event system to AGI Rush. Events fire periodically during gameplay, applying temporary buffs/debuffs, instant effects, or presenting player choices. Events appear as non-blocking toast banners at the bottom of the screen.

## Decisions

- **UI style:** Toast/banner — non-blocking, inline with gameplay
- **Interactions:** Inline in the toast (buttons for choices, keystroke counting for mash events)
- **Event timing:** Follow spec as-is — garage-tier events fire from game start
- **Architecture:** Separate `src/modules/event/` module with its own Zustand store
- **Balance sim:** Update sim alongside game system to maintain parity
- **Pause behavior:** Event timers freeze when `running === false`. No new events spawn while paused. Mash interaction does not work while paused. This prevents pausing as an exploit to wait out debuffs.
- **Persistence:** Active events are NOT persisted across page reloads. On reload, `nextSpawnAt` is reset to now + random interval. This avoids timestamp invalidation issues and keeps things simple — events are short-lived enough that losing one on reload is fine.
- **Code quality:** The `codeQuality` field already exists in the balance sim but not in `GameState`. For this implementation, `codeQuality` effects (from `ai_hallucination` and `security_audit`) are deferred — those events will skip quality effects until `codeQuality` is added to the game store in a future PR. All other effects on those events still apply.

## Data Model

### EventEffect (discriminated union covering all shapes in events.json)

```typescript
type EventEffect =
  | { type: "flops" | "locPerKey" | "locProduction" | "autoLoc" | "cashMultiplier"; op: "multiply"; value: number }
  | { type: "flops"; op: "set"; value: number }
  | { type: "instantCash"; op: "add"; value: string }       // string expression, e.g. "currentCash * 0.02"
  | { type: "instantLoc"; op: "add"; value: number }
  | { type: "codeQuality"; op: "add"; value: number }       // deferred until codeQuality in GameState
  | { type: "conditionalCash"; threshold: string; reward: string }
  | { type: "disableUpgrade"; upgradeId: string }
  | { type: "choice"; options: EventChoiceOption[] }

interface EventChoiceOption {
  label: string
  effect: EventEffect & { duration?: number }               // optional duration = spawns timed buff
}
```

### Expression evaluation

String expression values (e.g. `"currentCash * 0.02"`) are evaluated at **spawn time** (or choice-resolution time) using a simple resolver function — NOT `eval()`. The resolver receives the current game state and supports a fixed set of variables:

```typescript
const resolveExpression = (expr: string, ctx: ExpressionContext): number => { ... }

interface ExpressionContext {
  currentCash: number
  currentLoc: number
  currentLocPerSec: number   // autoLocPerSec from game state
}
```

Implementation: split on `*`, `/`, `+`, `-` operators with a simple parser. Only simple `variable * constant` or `variable + constant` patterns exist in the data — no nested expressions needed.

### EventDefinition (loaded from `specs/data/events.json`)

```typescript
interface EventDefinition {
  id: string
  name: string
  description: string
  icon: string
  minTier: TierIdEnum
  duration: number             // seconds, 0 = instant
  effects: EventEffect[]
  interaction?: EventInteraction
  weight: number
}

type EventInteraction =
  | { type: "mash_keys"; reductionPerKey: number }
```

Note: Choice events use `{ type: "choice" }` inside `effects[]`, not via `interaction`. The `interaction` field is reserved for physical player actions (mash keys). This matches the JSON spec structure.

### ActiveEvent (runtime state)

```typescript
interface ActiveEvent {
  definitionId: string
  startedAt: number            // performance.now() timestamp
  remainingDuration: number    // seconds (dt unit), counts down each tick
  resolved: boolean            // for choice events: has the player chosen?
  chosenOptionIndex?: number
}
```

### EventModifiers (computed from active events, consumed by game store)

```typescript
interface EventModifiers {
  flopsMultiplier: number       // default 1.0
  flopsOverride: number | null  // null = no override; 0 = power_outage zeroes FLOPS
  locPerKeyMultiplier: number   // default 1.0
  autoLocMultiplier: number     // default 1.0
  cashMultiplier: number        // default 1.0
  locProductionMultiplier: number // default 1.0
  disabledUpgrades: string[]    // upgrade IDs temporarily disabled
}
```

`flopsOverride` takes precedence over `flopsMultiplier` when non-null. Only one `set` operation can be active at a time (max 1 concurrent event enforces this). In `recalcDerivedStats()`: if `flopsOverride !== null`, use it directly instead of `flops * flopsMultiplier`.

All multipliers default to 1.0. Multiple active effects stack multiplicatively.

### Timed choice effects

When a choice option has `duration` (e.g. acquihire's "Stay indie" → +10% cash for 120s), resolving the choice spawns a **synthetic ActiveEvent** with:
- `definitionId`: `"{parentEventId}_choice_{optionIndex}"`
- `remainingDuration`: the option's `duration`
- `resolved: true` (no further interaction)
- The option's effect applied as a normal duration event

This synthetic event does NOT count toward `maxConcurrent` — it's a buff, not a new random event. The event store tracks these in the same `activeEvents` array.

### disabledUpgrades behavior

When an upgrade ID is in `disabledUpgrades`, `recalcDerivedStats()` skips ALL effects from that upgrade (all owned copies) during effect accumulation. The upgrade is not removed from `ownedUpgrades` — it's temporarily invisible to the effect system. When the event expires, the next `recalcDerivedStats()` call re-includes it.

## Event Store

Module: `src/modules/event/store/event-store.ts`

### State

- `activeEvents: ActiveEvent[]` — currently running events (max 1 random + any synthetic choice buffs)
- `nextSpawnAt: number` — `performance.now()` timestamp for next event roll
- `eventLog: string[]` — recent event IDs for toast history display (capped ~20, newest first)

### Actions

- `tick(dt, currentTierIndex, running)` — `dt` is in **seconds** (fractional, same unit as game store):
  1. If `running === false`: return false (no updates while paused)
  2. Count down `remainingDuration` on active events by `dt`
  3. Remove expired events (remainingDuration <= 0)
  4. If `performance.now() >= nextSpawnAt` and no non-synthetic active event: roll weighted random event filtered by `minTier <= currentTierIndex`
  5. Schedule next spawn: `performance.now() + random(30s–90s) * 1000`
  6. Return boolean indicating if event state changed (event started, expired, or resolved)
- `spawnEvent(eventId)` — create ActiveEvent; apply instant effects (instantCash, instantLoc) via game store actions; evaluate string expressions at spawn time
- `handleChoice(eventId, optionIndex)` — mark resolved, apply chosen effect; if effect has `duration`, spawn synthetic ActiveEvent
- `handleMashKey(eventId)` — reduce `remainingDuration` by `reductionPerKey` (only if `running === true`)
- `getEventModifiers()` — scan active (non-resolved-choice) events, compute combined multipliers + flopsOverride + disabledUpgrades

### Spawn Algorithm

1. Filter `events.json` entries by `minTier <= currentTierIndex`
2. Sum weights of eligible events
3. Roll random, pick by weighted selection
4. Instant events (duration 0, no choice): apply immediately, push to `eventLog`, don't occupy active slot
5. Duration/choice events: push to `activeEvents`

## Game Store Integration

Minimal changes to `src/modules/game/store/game-store.ts`:

### tick(dt)

- Call `useEventStore.getState().tick(dt, state.currentTierIndex, state.running)`
- If event state changed (returned true), call `recalcDerivedStats()`

### recalcDerivedStats()

- After computing all upgrade/tech multipliers, call `useEventStore.getState().getEventModifiers()`
- For `disabledUpgrades`: skip those upgrade IDs during effect accumulation loop
- Apply multipliers: `flops *= modifiers.flopsMultiplier`, `cashMultiplier *= modifiers.cashMultiplier`, etc.
- If `flopsOverride !== null`: set `flops = flopsOverride` (overrides both base + multiplied value)

### Keystroke handling

- On keypress, check for active mash-type event and call `useEventStore.getState().handleMashKey(eventId)`

### Instant effects

- `spawnEvent()` and `handleChoice()` call game store actions (public API) for instant cash/LoC changes

## UI: Toast Component

Component: `src/modules/event/components/event-toast.tsx`
Rendered in `App` shell, fixed-position at the bottom of the screen.

### Behavior by event type

| Type | Display | Interaction |
|------|---------|-------------|
| Passive buff/debuff | Icon + name + description + countdown timer | None |
| Mash event | Pulsing indicator + countdown that drops as you type | Any keystroke reduces timer |
| Choice event | Description + two inline buttons | Click a button to resolve |
| Instant event | Brief confirmation toast, auto-dismiss after 3-4s | None |

### Styling

- Negative events: warm/red-tinted background
- Positive events: green/blue-tinted background
- Choice events: neutral background with highlighted buttons
- Dark IDE aesthetic consistent with existing theme
- Slide-in/out animation via CSS `transform: translateY()`, 200ms ease

## Balance Simulation Integration

Changes to `src/utils/balance-sim.ts` and `specs/balance-check.js`:

### Sim event engine

- Event scheduler in sim loop: same config (30-90s interval, max 1 concurrent)
- Seeded PRNG passed as parameter to event tick (not replacing `Math.random()` globally)
- Same weighted selection, filtered by sim tier
- Events are ticked **after production, before purchases** in the sim loop — this matches real gameplay flow where events affect the current tick's output

### Effect application

- Duration events: apply multipliers for simulated duration, count down each sim second
- Instant events: apply immediately (resolve expressions against sim state)
- Choice events: sim picks optimal option (highest expected value)
- Mash events: sim assumes player mashes at configured keys/sec, reducing duration proportionally
- Conditional events (investor demo): evaluate threshold against sim state
- Timed choice effects: spawn synthetic events in sim, same as real game
- `codeQuality` effects: applied in sim (sim already tracks quality), deferred in real game

### Balance impact

- Events are roughly net-neutral by design (mix of positive/negative, similar weights)
- No changes to balance thresholds — run checker after implementation and adjust only if needed

## Module Structure

```
src/modules/event/
├── index.ts                           # Public API
├── types.ts                           # EventEffect, EventDefinition, ActiveEvent, EventModifiers
├── store/
│   └── event-store.ts                 # Zustand store
├── components/
│   └── event-toast.tsx                # Toast UI component
├── utils/
│   └── expression-resolver.ts         # resolveExpression() for string value evaluation
└── data/
    └── events.ts                      # Import and type events.json
```

## Event Config (from spec)

```json
{
  "minIntervalSeconds": 30,
  "maxIntervalSeconds": 90,
  "maxConcurrent": 1
}
```
