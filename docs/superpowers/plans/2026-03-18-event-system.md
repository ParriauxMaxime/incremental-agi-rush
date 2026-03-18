# Event System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a random event system that fires periodic buffs, debuffs, choices, and interactive events during gameplay, displayed as toast banners.

**Architecture:** Separate `src/modules/event/` module with its own Zustand store. The event store manages spawn timers, active events, and computed modifiers. The game store calls into the event store each tick and applies modifiers during `recalcDerivedStats()`. A toast component renders active events with inline interactions (buttons for choices, mash-key counting).

**Tech Stack:** React 19, Emotion CSS-in-JS, Zustand, ts-pattern, TypeScript strict mode

**Spec:** `docs/superpowers/specs/2026-03-18-event-system-design.md`

---

### Task 1: Event Types & Data Loader

**Files:**
- Create: `src/modules/event/types.ts`
- Create: `src/modules/event/data/events.ts`

- [ ] **Step 1: Create event types**

Create `src/modules/event/types.ts` with all type definitions:

```typescript
import type { TierIdEnum } from "./data/events";

export const EventEffectOpEnum = {
	add: "add",
	multiply: "multiply",
	set: "set",
} as const;
export type EventEffectOpEnum =
	(typeof EventEffectOpEnum)[keyof typeof EventEffectOpEnum];

export type EventEffect =
	| { type: "flops" | "locPerKey" | "locProduction" | "autoLoc" | "cashMultiplier"; op: "multiply"; value: number }
	| { type: "flops"; op: "set"; value: number }
	| { type: "cash"; op: "multiply"; value: number }
	| { type: "instantCash"; op: "add"; value: string }
	| { type: "instantLoc"; op: "add"; value: number }
	| { type: "codeQuality"; op: "add"; value: number }
	| { type: "conditionalCash"; threshold: string; reward: string }
	| { type: "disableUpgrade"; upgradeId: string }
	| { type: "choice"; options: EventChoiceOption[] };

export interface EventChoiceOption {
	label: string;
	effect: EventEffect & { duration?: number };
}

export interface EventInteraction {
	type: "mash_keys";
	reductionPerKey: number;
}

export interface EventDefinition {
	id: string;
	name: string;
	description: string;
	icon: string;
	minTier: TierIdEnum;
	duration: number;
	effects: EventEffect[];
	interaction?: EventInteraction;
	weight: number;
}

export interface EventConfig {
	minIntervalSeconds: number;
	maxIntervalSeconds: number;
	maxConcurrent: number;
}

export interface ActiveEvent {
	definitionId: string;
	startedAt: number;
	remainingDuration: number;
	resolved: boolean;
	chosenOptionIndex?: number;
	/** true for synthetic events spawned by timed choice effects */
	synthetic: boolean;
	/** For synthetic events: parent event ID and chosen option index */
	parentEventId?: string;
	parentOptionIndex?: number;
}

export interface EventModifiers {
	flopsMultiplier: number;
	flopsOverride: number | null;
	locPerKeyMultiplier: number;
	autoLocMultiplier: number;
	cashMultiplier: number;
	locProductionMultiplier: number;
	disabledUpgrades: string[];
}

export const DEFAULT_EVENT_MODIFIERS: EventModifiers = {
	flopsMultiplier: 1,
	flopsOverride: null,
	locPerKeyMultiplier: 1,
	autoLocMultiplier: 1,
	cashMultiplier: 1,
	locProductionMultiplier: 1,
	disabledUpgrades: [],
};

export interface ExpressionContext {
	currentCash: number;
	currentLoc: number;
	currentLocPerSec: number;
}
```

- [ ] **Step 2: Create data loader**

Create `src/modules/event/data/events.ts` — loads and types the JSON:

```typescript
import eventsData from "../../../../specs/data/events.json";
import type { EventConfig, EventDefinition } from "../types";

export const TierIdEnum = {
	garage: "garage",
	freelancing: "freelancing",
	startup: "startup",
	tech_company: "tech_company",
	ai_lab: "ai_lab",
	agi_race: "agi_race",
} as const;
export type TierIdEnum = (typeof TierIdEnum)[keyof typeof TierIdEnum];

/** Tier ID → numeric index (matches tiers.json order) */
export const TIER_INDEX: Record<TierIdEnum, number> = {
	garage: 0,
	freelancing: 1,
	startup: 2,
	tech_company: 3,
	ai_lab: 4,
	agi_race: 5,
};

export const allEvents: EventDefinition[] =
	eventsData.events as EventDefinition[];

export const eventConfig: EventConfig =
	eventsData.eventConfig as EventConfig;
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS (new files are self-contained, no consumers yet)

- [ ] **Step 4: Commit**

```bash
git add src/modules/event/types.ts src/modules/event/data/events.ts
git commit -m "✨ Add event types and data loader"
```

---

### Task 2: Expression Resolver

**Files:**
- Create: `src/modules/event/utils/expression-resolver.ts`

- [ ] **Step 1: Implement expression resolver**

Create `src/modules/event/utils/expression-resolver.ts`:

```typescript
import type { ExpressionContext } from "../types";

/**
 * Resolve simple expressions like "currentCash * 0.02" or "currentLocPerSec * 0.8".
 * Only supports: variable, variable * constant, variable + constant, variable - constant.
 * No nested expressions or parentheses needed — data only uses simple patterns.
 */
export function resolveExpression(
	expr: string | number,
	ctx: ExpressionContext,
): number {
	if (typeof expr === "number") return expr;

	const trimmed = expr.trim();

	// Try pure number
	const asNum = Number(trimmed);
	if (!Number.isNaN(asNum)) return asNum;

	// Try "variable * constant" or "variable + constant" etc.
	const match = trimmed.match(
		/^(\w+)\s*([+\-*/])\s*([0-9.]+)$/,
	);
	if (match) {
		const variable = lookupVariable(match[1], ctx);
		const op = match[2];
		const constant = Number(match[3]);
		if (op === "*") return variable * constant;
		if (op === "+") return variable + constant;
		if (op === "-") return variable - constant;
		if (op === "/") return constant !== 0 ? variable / constant : 0;
	}

	// Try bare variable name
	return lookupVariable(trimmed, ctx);
}

function lookupVariable(name: string, ctx: ExpressionContext): number {
	if (name === "currentCash") return ctx.currentCash;
	if (name === "currentLoc") return ctx.currentLoc;
	if (name === "currentLocPerSec") return ctx.currentLocPerSec;
	return 0;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/modules/event/utils/expression-resolver.ts
git commit -m "✨ Add expression resolver for event string values"
```

---

### Task 3: Event Store — Core State & Spawn Logic

**Files:**
- Create: `src/modules/event/store/event-store.ts`

This is the core of the event system. The store manages active events, spawn timing, and exposes modifiers.

- [ ] **Step 1: Create the event store**

Create `src/modules/event/store/event-store.ts`:

```typescript
import { create } from "zustand";
import { allEvents, eventConfig, TIER_INDEX } from "../data/events";
import type {
	ActiveEvent,
	EventDefinition,
	EventModifiers,
	ExpressionContext,
} from "../types";
import { DEFAULT_EVENT_MODIFIERS } from "../types";
import { resolveExpression } from "../utils/expression-resolver";

interface EventState {
	activeEvents: ActiveEvent[];
	nextSpawnAt: number;
	eventLog: string[];
	/** Most recent toast to display (includes instant events that aren't "active") */
	toastEvent: { definitionId: string; remainingDuration: number } | null;
	/** Remaining seconds until toast auto-dismisses (counts down with dt, pauses when game pauses) */
	toastDismissCountdown: number;
}

interface EventActions {
	/**
	 * Called every frame from the game loop.
	 * Returns true if event state changed (caller should recalc).
	 * dt is in seconds. running = game execution state.
	 */
	tick: (dt: number, currentTierIndex: number, running: boolean) => boolean;
	spawnEvent: (eventId: string, ctx: ExpressionContext) => void;
	handleChoice: (
		eventId: string,
		optionIndex: number,
		ctx: ExpressionContext,
	) => void;
	handleMashKey: (eventId: string) => void;
	getEventModifiers: () => EventModifiers;
	/** Get the currently active event requiring interaction (for UI) */
	getActiveInteractiveEvent: () => {
		event: ActiveEvent;
		definition: EventDefinition;
	} | null;
	reset: () => void;
}

function randomInterval(): number {
	const { minIntervalSeconds, maxIntervalSeconds } = eventConfig;
	const delay =
		minIntervalSeconds +
		Math.random() * (maxIntervalSeconds - minIntervalSeconds);
	return performance.now() + delay * 1000;
}

function pickWeightedEvent(tierIndex: number): EventDefinition | null {
	const eligible = allEvents.filter(
		(e) => TIER_INDEX[e.minTier] <= tierIndex,
	);
	if (eligible.length === 0) return null;

	const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
	let roll = Math.random() * totalWeight;
	for (const event of eligible) {
		roll -= event.weight;
		if (roll <= 0) return event;
	}
	return eligible[eligible.length - 1];
}

const initialState: EventState = {
	activeEvents: [],
	nextSpawnAt: randomInterval(),
	eventLog: [],
	toastEvent: null,
	toastDismissCountdown: 0,
};

export const useEventStore = create<EventState & EventActions>()(
	(set, get) => ({
		...initialState,

		tick: (dt, currentTierIndex, running) => {
			if (!running) return false;

			const state = get();
			let changed = false;
			let activeEvents = state.activeEvents;

			// Count down durations
			const updated: ActiveEvent[] = [];
			for (const event of activeEvents) {
				if (event.remainingDuration > 0 && !event.resolved) {
					const next = {
						...event,
						remainingDuration: event.remainingDuration - dt,
					};
					if (next.remainingDuration <= 0) {
						changed = true;
						// Expired — don't add to updated
					} else {
						updated.push(next);
					}
				} else if (event.resolved && event.remainingDuration > 0) {
					// Choice already resolved but has remaining duration (waiting for timed effect)
					// Actually resolved choice events without synthetic effects should be removed
					changed = true;
				} else {
					updated.push(event);
				}
			}

			// Also count down synthetic events (timed choice buffs)
			const finalEvents: ActiveEvent[] = [];
			for (const event of updated) {
				if (event.synthetic && event.remainingDuration > 0) {
					const next = {
						...event,
						remainingDuration: event.remainingDuration - dt,
					};
					if (next.remainingDuration <= 0) {
						changed = true;
					} else {
						finalEvents.push(next);
					}
				} else {
					finalEvents.push(event);
				}
			}

			activeEvents = finalEvents;

			// Check toast dismiss
			let toastEvent = state.toastEvent;
			let toastDismissCountdown = state.toastDismissCountdown;
			if (toastEvent && toastDismissCountdown > 0) {
				toastDismissCountdown -= dt; // pauses naturally when tick isn't called
				if (toastDismissCountdown <= 0) {
					toastEvent = null;
					toastDismissCountdown = 0;
				}
			}

			// Try spawning a new event
			const hasNonSyntheticActive = activeEvents.some((e) => !e.synthetic);
			if (
				!hasNonSyntheticActive &&
				performance.now() >= state.nextSpawnAt
			) {
				const def = pickWeightedEvent(currentTierIndex);
				if (def) {
					// We'll call spawnEvent separately to handle instant effects
					// For now, just set the flag — actual spawning in a separate action
					// to keep tick pure (no side effects on game store)
					set({
						activeEvents,
						nextSpawnAt: randomInterval(),
						toastEvent,
						toastDismissCountdown,
					});
					// Return the event ID to spawn via a different mechanism
					// Actually, let's handle it inline since tick needs to be self-contained
					const isInstant =
						def.duration === 0 &&
						!def.effects.some((e) => e.type === "choice");
					const isChoice = def.effects.some(
						(e) => e.type === "choice",
					);

					const CHOICE_TIMEOUT = 60; // seconds — auto-dismiss if player doesn't choose

					if (isInstant) {
						// Instant events: add to log + show toast briefly
						const newLog = [def.id, ...state.eventLog].slice(0, 20);
						set({
							activeEvents,
							nextSpawnAt: randomInterval(),
							eventLog: newLog,
							toastEvent: {
								definitionId: def.id,
								remainingDuration: 0,
							},
							toastDismissCountdown: 4,  // seconds, counts down with dt
						});
						// Caller handles instant effects via pendingSpawn
						return true;
					}

					const newEvent: ActiveEvent = {
						definitionId: def.id,
						startedAt: performance.now(),
						remainingDuration: isChoice ? CHOICE_TIMEOUT : def.duration,
						resolved: false,
						synthetic: false,
					};
					const newLog = [def.id, ...state.eventLog].slice(0, 20);
					set({
						activeEvents: [...activeEvents, newEvent],
						nextSpawnAt: randomInterval(),
						eventLog: newLog,
						toastEvent: {
							definitionId: def.id,
							remainingDuration: newEvent.remainingDuration,
						},
						toastDismissCountdown: 0,
					});
					return true;
				}
			}

			if (changed) {
				set({ activeEvents, toastEvent, toastDismissAt });
			}

			return changed;
		},

		spawnEvent: (eventId, ctx) => {
			const def = allEvents.find((e) => e.id === eventId);
			if (!def) return;

			const state = get();
			const isInstant =
				def.duration === 0 &&
				!def.effects.some((e) => e.type === "choice");

			if (isInstant) {
				set({
					eventLog: [def.id, ...state.eventLog].slice(0, 20),
					toastEvent: { definitionId: def.id, remainingDuration: 0 },
					toastDismissCountdown: 4,  // seconds, counts down with dt
				});
				return;
			}

			const isChoice = def.effects.some((e) => e.type === "choice");
			const newEvent: ActiveEvent = {
				definitionId: def.id,
				startedAt: performance.now(),
				remainingDuration: isChoice ? CHOICE_TIMEOUT : def.duration,
				resolved: false,
				synthetic: false,
			};

			set({
				activeEvents: [...state.activeEvents, newEvent],
				eventLog: [def.id, ...state.eventLog].slice(0, 20),
				toastEvent: {
					definitionId: def.id,
					remainingDuration: newEvent.remainingDuration,
				},
				toastDismissCountdown: 0,
			});
		},

		handleChoice: (eventId, optionIndex, ctx) => {
			const state = get();
			const eventIndex = state.activeEvents.findIndex(
				(e) => e.definitionId === eventId && !e.resolved,
			);
			if (eventIndex === -1) return;

			const def = allEvents.find((e) => e.id === eventId);
			if (!def) return;

			const choiceEffect = def.effects.find(
				(e) => e.type === "choice",
			);
			if (!choiceEffect || choiceEffect.type !== "choice") return;

			const option = choiceEffect.options[optionIndex];
			if (!option) return;

			const updated = [...state.activeEvents];
			updated[eventIndex] = {
				...updated[eventIndex],
				resolved: true,
				chosenOptionIndex: optionIndex,
				remainingDuration: 0,
			};

			// If the chosen option has a duration, spawn a synthetic event
			if (option.effect.duration && option.effect.duration > 0) {
				const syntheticEvent: ActiveEvent = {
					definitionId: `${eventId}_choice_${optionIndex}`,
					startedAt: performance.now(),
					remainingDuration: option.effect.duration,
					resolved: true,
					synthetic: true,
					parentEventId: eventId,
					parentOptionIndex: optionIndex,
				};
				updated.push(syntheticEvent);
			}

			set({ activeEvents: updated });
		},

		handleMashKey: (eventId) => {
			const state = get();
			const eventIndex = state.activeEvents.findIndex(
				(e) => e.definitionId === eventId && !e.resolved,
			);
			if (eventIndex === -1) return;

			const def = allEvents.find((e) => e.id === eventId);
			if (!def?.interaction || def.interaction.type !== "mash_keys")
				return;

			const updated = [...state.activeEvents];
			const event = updated[eventIndex];
			const newDuration =
				event.remainingDuration - def.interaction.reductionPerKey;

			if (newDuration <= 0) {
				// Event resolved by mashing
				updated.splice(eventIndex, 1);
			} else {
				updated[eventIndex] = {
					...event,
					remainingDuration: newDuration,
				};
			}

			set({ activeEvents: updated });
		},

		getEventModifiers: () => {
			const { activeEvents } = get();
			if (activeEvents.length === 0) return DEFAULT_EVENT_MODIFIERS;

			const modifiers = { ...DEFAULT_EVENT_MODIFIERS };
			const disabledUpgrades: string[] = [];

			for (const event of activeEvents) {
				if (event.resolved && !event.synthetic) continue;

				const def = allEvents.find(
					(e) => e.id === event.definitionId,
				);
				if (!def) {
					// Synthetic event from choice — use stored parent info
					if (event.parentEventId == null || event.parentOptionIndex == null) continue;
					const parentDef = allEvents.find(
						(e) => e.id === event.parentEventId,
					);
					if (!parentDef) continue;

					const choiceEffect = parentDef.effects.find(
						(e) => e.type === "choice",
					);
					if (
						choiceEffect?.type === "choice" &&
						choiceEffect.options[event.parentOptionIndex]
					) {
						const opt = choiceEffect.options[event.parentOptionIndex];
						applyModifier(modifiers, disabledUpgrades, opt.effect);
					}
					continue;
				}

				for (const effect of def.effects) {
					if (effect.type === "choice") continue;
					applyModifier(modifiers, disabledUpgrades, effect);
				}
			}

			modifiers.disabledUpgrades = disabledUpgrades;
			return modifiers;
		},

		getActiveInteractiveEvent: () => {
			const { activeEvents } = get();
			for (const event of activeEvents) {
				if (event.synthetic || event.resolved) continue;
				const def = allEvents.find(
					(e) => e.id === event.definitionId,
				);
				if (!def) continue;
				if (
					def.interaction ||
					def.effects.some((e) => e.type === "choice")
				) {
					return { event, definition: def };
				}
			}
			return null;
		},

		reset: () => set(initialState),
	}),
);

function applyModifier(
	modifiers: EventModifiers,
	disabledUpgrades: string[],
	effect: { type: string; op?: string; value?: number | string; upgradeId?: string },
): void {
	match(effect)
		.with({ type: "flops", op: "multiply" }, (e) => {
			modifiers.flopsMultiplier *= e.value as number;
		})
		.with({ type: "flops", op: "set" }, (e) => {
			modifiers.flopsOverride = e.value as number;
		})
		.with({ type: "locPerKey", op: "multiply" }, (e) => {
			modifiers.locPerKeyMultiplier *= e.value as number;
		})
		.with({ type: "autoLoc", op: "multiply" }, (e) => {
			modifiers.autoLocMultiplier *= e.value as number;
		})
		.with({ type: "locProduction", op: "multiply" }, (e) => {
			modifiers.locProductionMultiplier *= e.value as number;
		})
		.with({ type: "cashMultiplier", op: "multiply" }, (e) => {
			modifiers.cashMultiplier *= e.value as number;
		})
		.with({ type: "cash", op: "multiply" }, (e) => {
			modifiers.cashMultiplier *= e.value as number;
		})
		.with({ type: "disableUpgrade" }, (e) => {
			if (e.upgradeId) disabledUpgrades.push(e.upgradeId);
		})
		.otherwise(() => {});
}

/** Resolve instant effects from an event, returns cash/loc deltas */
export function resolveInstantEffects(
	def: EventDefinition,
	ctx: ExpressionContext,
): { cashDelta: number; locDelta: number } {
	let cashDelta = 0;
	let locDelta = 0;

	for (const effect of def.effects) {
		if (effect.type === "instantCash" && effect.op === "add") {
			cashDelta += resolveExpression(effect.value, ctx);
		} else if (effect.type === "instantLoc" && effect.op === "add") {
			locDelta += effect.value;
		} else if (effect.type === "conditionalCash") {
			const threshold = resolveExpression(effect.threshold, ctx);
			if (ctx.currentLocPerSec >= threshold) {
				cashDelta += resolveExpression(effect.reward, ctx);
			}
		}
	}

	return { cashDelta, locDelta };
}

/** Resolve instant effects from a choice option */
export function resolveChoiceEffects(
	effect: { type: string; op?: string; value?: number | string },
	ctx: ExpressionContext,
): { cashDelta: number; locDelta: number } {
	let cashDelta = 0;
	let locDelta = 0;

	if (effect.type === "instantCash" && effect.op === "add") {
		cashDelta += resolveExpression(
			effect.value as string | number,
			ctx,
		);
	} else if (effect.type === "cash" && effect.op === "multiply") {
		// "Pay fine" = multiply current cash (e.g. 0.95 = lose 5%)
		cashDelta += ctx.currentCash * ((effect.value as number) - 1);
	}

	return { cashDelta, locDelta };
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/modules/event/store/event-store.ts
git commit -m "✨ Add event store with spawn logic, modifiers, and instant effects"
```

---

### Task 4: Module Public API

**Files:**
- Create: `src/modules/event/index.ts`

- [ ] **Step 1: Create the public API**

Create `src/modules/event/index.ts`:

```typescript
export {
	resolveChoiceEffects,
	resolveInstantEffects,
	useEventStore,
} from "./store/event-store";
export { allEvents, eventConfig, TIER_INDEX } from "./data/events";
export type {
	ActiveEvent,
	EventDefinition,
	EventModifiers,
	ExpressionContext,
} from "./types";
export { DEFAULT_EVENT_MODIFIERS } from "./types";
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/modules/event/index.ts
git commit -m "✨ Add event module public API"
```

---

### Task 5: Game Store Integration

**Files:**
- Modify: `src/modules/game/store/game-store.ts` (lines 111-330 recalcDerivedStats, lines 353-437 tick)
- Modify: `src/modules/game/hooks/use-game-loop.ts`

- [ ] **Step 1: Import event store in game-store.ts**

At the top of `src/modules/game/store/game-store.ts`, add after the existing imports:

```typescript
import {
	resolveInstantEffects,
	useEventStore,
} from "@modules/event";
import type { ExpressionContext } from "@modules/event";
```

- [ ] **Step 2: Integrate event modifiers into recalcDerivedStats**

In `recalcDerivedStats()`, after the tech node effects loop (after line 290), add event modifier application:

```typescript
	// Apply event modifiers
	const eventMods = useEventStore.getState().getEventModifiers();
	locPerKey *= eventMods.locPerKeyMultiplier;
	locProductionMultiplier *= eventMods.locProductionMultiplier;
	cashMultiplier *= eventMods.cashMultiplier;
```

Then update the FLOPS assignment (replace the line `state.flops = baseFlops + hardwareFlops;` around line 312):

```typescript
	const computedFlops = baseFlops + hardwareFlops;
	state.flops =
		eventMods.flopsOverride !== null
			? eventMods.flopsOverride
			: computedFlops * eventMods.flopsMultiplier;
```

And update `state.autoLocPerSec` assignment to include autoLoc multiplier:

```typescript
	state.autoLocPerSec = totalAutoLoc * locProductionMultiplier * eventMods.autoLocMultiplier;
```

For `disabledUpgrades`, modify the upgrade effects loop (around lines 275-281). Change:

```typescript
	for (const upgrade of allUpgrades) {
		const owned = state.ownedUpgrades[upgrade.id] ?? 0;
		if (owned === 0) continue;
		for (const effect of upgrade.effects) {
			applyEffect(effect, owned);
		}
	}
```

To:

```typescript
	for (const upgrade of allUpgrades) {
		const owned = state.ownedUpgrades[upgrade.id] ?? 0;
		if (owned === 0) continue;
		if (eventMods.disabledUpgrades.includes(upgrade.id)) continue;
		for (const effect of upgrade.effects) {
			applyEffect(effect, owned);
		}
	}
```

- [ ] **Step 3: Add `recalc` and `applyEventReward` actions to game store**

In `types.ts`, add to `GameActions`:
```typescript
/** Force recalculation of derived stats (called when external modifiers change) */
recalc: () => void;
/** Apply instant cash/loc reward from events (not a cheat — dedicated action) */
applyEventReward: (cashDelta: number, locDelta: number) => void;
```

In `game-store.ts`, add these actions:
```typescript
recalc: () => {
	set((s) => {
		const next = { ...s };
		recalcDerivedStats(next);
		return next;
	});
},

applyEventReward: (cashDelta: number, locDelta: number) => {
	set((s) => ({
		cash: s.cash + cashDelta,
		totalCash: cashDelta > 0 ? s.totalCash + cashDelta : s.totalCash,
		loc: s.loc + locDelta,
		totalLoc: locDelta > 0 ? s.totalLoc + locDelta : s.totalLoc,
	}));
},
```

- [ ] **Step 4: Integrate event tick into game loop**

Modify `src/modules/game/hooks/use-game-loop.ts`:

```typescript
import { useEffect, useRef } from "react";
import {
	allEvents,
	resolveInstantEffects,
	useEventStore,
} from "@modules/event";
import type { ExpressionContext } from "@modules/event";
import { useGameStore } from "../store/game-store";

export function useGameLoop() {
	const tick = useGameStore((s) => s.tick);
	const lastTickRef = useRef(performance.now());
	const lastEventLogLenRef = useRef(0);

	useEffect(() => {
		let rafId: number;

		function loop() {
			const now = performance.now();
			const dt = (now - lastTickRef.current) / 1000;
			lastTickRef.current = now;

			// Tick events
			const gameState = useGameStore.getState();
			const eventStore = useEventStore.getState();
			const ctx: ExpressionContext = {
				currentCash: gameState.cash,
				currentLoc: gameState.loc,
				currentLocPerSec: gameState.autoLocPerSec,
			};
			const eventChanged = eventStore.tick(
				dt,
				gameState.currentTierIndex,
				gameState.running,
			);

			// Apply instant effects for newly spawned events
			const newEventState = useEventStore.getState();
			if (newEventState.eventLog.length > lastEventLogLenRef.current) {
				const latestEventId = newEventState.eventLog[0];
				const def = allEvents.find((e) => e.id === latestEventId);
				if (def) {
					const { cashDelta, locDelta } = resolveInstantEffects(
						def,
						ctx,
					);
					if (cashDelta !== 0 || locDelta !== 0) {
						useGameStore.getState().applyEventReward(cashDelta, locDelta);
					}
				}
			}
			lastEventLogLenRef.current = newEventState.eventLog.length;

			// Tick game
			tick(dt);

			// Recalc if events changed
			if (eventChanged) {
				useGameStore.getState().recalc();
			}

			rafId = requestAnimationFrame(loop);
		}

		// Reset event log tracking on mount
		lastEventLogLenRef.current = useEventStore.getState().eventLog.length;

		rafId = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(rafId);
	}, [tick]);
}
```

Note: `lastEventLogLenRef` is initialized from current event log length on mount to avoid stale tracking after game reset.

- [ ] **Step 4: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Run dev server and verify no crashes**

Run: `npm run dev`
Open browser, verify game loads without errors. Events should start firing after 30-90s.

- [ ] **Step 6: Commit**

```bash
git add src/modules/game/store/game-store.ts src/modules/game/hooks/use-game-loop.ts src/modules/game/types.ts
git commit -m "✨ Integrate event store into game loop and recalcDerivedStats"
```

---

### Task 6: Mash-Key Integration in Editor

**Files:**
- Modify: `src/modules/editor/components/editor.tsx` (around line 162, the `onKeystroke` callback)

- [ ] **Step 1: Add mash-key handling to keystroke callback**

In `src/modules/editor/components/editor.tsx`, find the `onKeystroke` callback. Modify it to also call `handleMashKey` when a mash event is active:

```typescript
import { useEventStore } from "@modules/event";

// Inside the Editor component, modify onKeystroke:
const onKeystroke = useCallback(() => {
	advanceTokens(locPerKey);

	// Check for mash-key event interaction
	const eventStore = useEventStore.getState();
	const interactive = eventStore.getActiveInteractiveEvent();
	if (
		interactive &&
		interactive.definition.interaction?.type === "mash_keys"
	) {
		eventStore.handleMashKey(interactive.event.definitionId);
	}
}, [advanceTokens, locPerKey]);
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/modules/editor/components/editor.tsx
git commit -m "✨ Add mash-key event interaction to editor keystrokes"
```

---

### Task 7: Event Toast UI Component

**Files:**
- Create: `src/modules/event/components/event-toast.tsx`
- Modify: `src/app.tsx` (add toast to shell)

- [ ] **Step 1: Create the toast component**

Create `src/modules/event/components/event-toast.tsx`:

```typescript
import { css, keyframes } from "@emotion/react";
import { useEventStore } from "../store/event-store";
import { allEvents } from "../data/events";
import type { ExpressionContext } from "../types";
import { resolveChoiceEffects } from "../store/event-store";
import { useGameStore } from "@modules/game";

const slideIn = keyframes`
	from { transform: translateY(100%); opacity: 0; }
	to { transform: translateY(0); opacity: 1; }
`;

const slideOut = keyframes`
	from { transform: translateY(0); opacity: 1; }
	to { transform: translateY(100%); opacity: 0; }
`;

const toastContainerCss = css({
	position: "fixed",
	bottom: 16,
	left: "50%",
	transform: "translateX(-50%)",
	zIndex: 1000,
	animation: `${slideIn} 200ms ease`,
});

const toastCss = css({
	display: "flex",
	alignItems: "center",
	gap: 12,
	padding: "12px 20px",
	borderRadius: 8,
	fontFamily: "'Courier New', monospace",
	fontSize: 13,
	color: "#c9d1d9",
	minWidth: 320,
	maxWidth: 500,
	boxShadow: "0 4px 24px rgba(0, 0, 0, 0.5)",
	border: "1px solid",
});

const negativeCss = css(toastCss, {
	background: "rgba(233, 69, 96, 0.15)",
	borderColor: "rgba(233, 69, 96, 0.3)",
});

const positiveCss = css(toastCss, {
	background: "rgba(88, 166, 255, 0.15)",
	borderColor: "rgba(88, 166, 255, 0.3)",
});

const neutralCss = css(toastCss, {
	background: "rgba(139, 148, 158, 0.15)",
	borderColor: "rgba(139, 148, 158, 0.3)",
});

const iconCss = css({
	fontSize: 24,
	flexShrink: 0,
});

const contentCss = css({
	flex: 1,
	minWidth: 0,
});

const nameCss = css({
	fontWeight: "bold",
	marginBottom: 2,
});

const descCss = css({
	fontSize: 11,
	color: "#8b949e",
});

const timerCss = css({
	fontSize: 16,
	fontWeight: "bold",
	color: "#58a6ff",
	flexShrink: 0,
	fontVariantNumeric: "tabular-nums",
});

const choiceBtnCss = css({
	display: "flex",
	gap: 8,
	marginTop: 8,
});

const btnCss = css({
	fontFamily: "'Courier New', monospace",
	fontSize: 11,
	padding: "4px 12px",
	borderRadius: 4,
	border: "1px solid #30363d",
	background: "#21262d",
	color: "#c9d1d9",
	cursor: "pointer",
	transition: "all 0.15s",
	"&:hover": {
		background: "#30363d",
		borderColor: "#58a6ff",
	},
});

/** Derive sentiment from effects — no hardcoded event IDs */
import type { EventDefinition } from "../types";

function getEventSentiment(def: EventDefinition): "positive" | "negative" | "neutral" {
	const hasChoice = def.effects.some((e) => e.type === "choice");
	if (hasChoice) return "neutral";

	// Positive if multipliers > 1 or instant gains
	const isPositive = def.effects.every((e) => {
		if ("op" in e && e.op === "multiply" && "value" in e) return (e.value as number) >= 1;
		if (e.type === "instantCash" || e.type === "instantLoc") return true;
		if (e.type === "conditionalCash") return true;
		return false;
	});
	return isPositive ? "positive" : "negative";
}

function getToastStyle(def: EventDefinition) {
	const sentiment = getEventSentiment(def);
	if (sentiment === "positive") return positiveCss;
	if (sentiment === "neutral") return neutralCss;
	return negativeCss;
}

export function EventToast() {
	const activeEvents = useEventStore((s) => s.activeEvents);
	const toastEvent = useEventStore((s) => s.toastEvent);
	const handleChoice = useEventStore((s) => s.handleChoice);
	const cash = useGameStore((s) => s.cash);
	const loc = useGameStore((s) => s.loc);
	const autoLocPerSec = useGameStore((s) => s.autoLocPerSec);

	// Find the event to display: prefer active non-synthetic, fallback to toast
	const displayEvent = activeEvents.find((e) => !e.synthetic && !e.resolved);
	const eventId = displayEvent?.definitionId ?? toastEvent?.definitionId;

	if (!eventId) return null;

	const def = allEvents.find((e) => e.id === eventId);
	if (!def) return null;

	const isChoice = def.effects.some((e) => e.type === "choice");
	const choiceEffect = def.effects.find((e) => e.type === "choice");
	const remaining = displayEvent?.remainingDuration ?? 0;
	const showTimer = !isChoice && remaining > 0;

	const ctx: ExpressionContext = {
		currentCash: cash,
		currentLoc: loc,
		currentLocPerSec: autoLocPerSec,
	};

	const onChoice = (optionIndex: number) => {
		handleChoice(eventId, optionIndex, ctx);

		// Apply instant effects from the choice
		if (choiceEffect?.type === "choice") {
			const option = choiceEffect.options[optionIndex];
			if (option) {
				const { cashDelta, locDelta } = resolveChoiceEffects(
					option.effect,
					ctx,
				);
				if (cashDelta !== 0 || locDelta !== 0) {
					useGameStore.getState().applyEventReward(cashDelta, locDelta);
				}
			}
		}
	};

	return (
		<div css={toastContainerCss}>
			<div css={getToastStyle(def)}>
				<span css={iconCss}>{def.icon}</span>
				<div css={contentCss}>
					<div css={nameCss}>{def.name}</div>
					<div css={descCss}>{def.description}</div>
					{isChoice &&
						choiceEffect?.type === "choice" &&
						!displayEvent?.resolved && (
							<div css={choiceBtnCss}>
								{choiceEffect.options.map((opt, i) => (
									<button
										key={opt.label}
										type="button"
										css={btnCss}
										onClick={() => onChoice(i)}
									>
										{opt.label}
									</button>
								))}
							</div>
						)}
				</div>
				{showTimer && (
					<span css={timerCss}>{Math.ceil(remaining)}s</span>
				)}
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Add EventToast to App shell**

In `src/app.tsx`, add the import and render the toast:

Import at top:
```typescript
import { EventToast } from "@modules/event/components/event-toast";
```

Inside the `App` component's return, after the `<div css={shellCss}>...</div>` and before the closing `</>`, add:
```typescript
<EventToast />
```

- [ ] **Step 3: Update event module index to export the component**

Add to `src/modules/event/index.ts`:
```typescript
export { EventToast } from "./components/event-toast";
```

- [ ] **Step 4: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Manual test**

Run: `npm run dev`
- Wait 30-90s for first event to fire
- Verify toast appears at bottom center
- Verify it has correct colors (red for negative, blue for positive)
- Verify timer counts down
- Use GodMode to set tier to 2+ to test choice events (security_audit, acquihire_offer)
- Verify choice buttons work
- Verify mash events (production_down) respond to typing

- [ ] **Step 6: Commit**

```bash
git add src/modules/event/components/event-toast.tsx src/modules/event/index.ts src/app.tsx
git commit -m "✨ Add event toast UI component"
```

---

### Task 8: Balance Simulation — Event Engine

**Files:**
- Modify: `src/utils/balance-sim.ts`

- [ ] **Step 1: Add seeded PRNG and event types to balance sim**

At the top of `balance-sim.ts`, after the existing imports, add:

```typescript
import eventsData from "../../specs/data/events.json";

interface SimEvent {
	id: string;
	name: string;
	minTier: string;
	duration: number;
	effects: Array<{
		type: string;
		op?: string;
		value?: number | string;
		threshold?: string;
		reward?: string;
		upgradeId?: string;
		options?: Array<{
			label: string;
			effect: { type: string; op?: string; value?: number | string; duration?: number };
		}>;
	}>;
	interaction?: { type: string; reductionPerKey: number };
	weight: number;
}

const simEvents = eventsData.events as SimEvent[];
const simEventConfig = eventsData.eventConfig;

/** Simple seeded PRNG (mulberry32) */
function createPrng(seed: number): () => number {
	let s = seed;
	return () => {
		s |= 0;
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
```

- [ ] **Step 2: Add event simulation state and logic**

Inside `runBalanceSim`, after the existing `sim` object initialization, add:

```typescript
	// Event simulation state
	const prng = createPrng(42);
	let nextEventSpawn =
		simEventConfig.minIntervalSeconds +
		prng() *
			(simEventConfig.maxIntervalSeconds -
				simEventConfig.minIntervalSeconds);
	let activeSimEvent: {
		id: string;
		remainingDuration: number;
		effects: SimEvent["effects"];
	} | null = null;

	// Event modifier accumulators (reset each tick if event active)
	let eventFlopsMultiplier = 1;
	let eventFlopsOverride: number | null = null;
	let eventCashMultiplier = 1;
	let eventLocProductionMultiplier = 1;
	let eventLocPerKeyMultiplier = 1;
	let eventAutoLocMultiplier = 1;

	function resolveSimExpression(expr: string | number): number {
		if (typeof expr === "number") return expr;
		const m = expr.match(/^(\w+)\s*([+\-*/])\s*([0-9.]+)$/);
		if (m) {
			let base = 0;
			if (m[1] === "currentCash") base = sim.cash;
			if (m[1] === "currentLoc") base = sim.loc;
			if (m[1] === "currentLocPerSec")
				base = calcAutoLoc() + effLocPerKey() * cfg.keysPerSec;
			const c = Number(m[3]);
			if (m[2] === "*") return base * c;
			if (m[2] === "+") return base + c;
			if (m[2] === "-") return base - c;
			if (m[2] === "/") return c !== 0 ? base / c : 0;
		}
		return 0;
	}

	function pickSimEvent(): SimEvent | null {
		const tierOrder = [
			"garage",
			"freelancing",
			"startup",
			"tech_company",
			"ai_lab",
			"agi_race",
		];
		const eligible = simEvents.filter(
			(e) => tierOrder.indexOf(e.minTier) <= sim.currentTier,
		);
		if (eligible.length === 0) return null;
		const totalWeight = eligible.reduce((s2, e) => s2 + e.weight, 0);
		let roll = prng() * totalWeight;
		for (const ev of eligible) {
			roll -= ev.weight;
			if (roll <= 0) return ev;
		}
		return eligible[eligible.length - 1];
	}

	function resetEventModifiers(): void {
		eventFlopsMultiplier = 1;
		eventFlopsOverride = null;
		eventCashMultiplier = 1;
		eventLocProductionMultiplier = 1;
		eventLocPerKeyMultiplier = 1;
		eventAutoLocMultiplier = 1;
	}

	function applySimEventModifiers(): void {
		resetEventModifiers();
		if (!activeSimEvent) return;
		for (const eff of activeSimEvent.effects) {
			if (eff.type === "flops" && eff.op === "multiply")
				eventFlopsMultiplier *= eff.value as number;
			if (eff.type === "flops" && eff.op === "set")
				eventFlopsOverride = eff.value as number;
			if (eff.type === "cashMultiplier" && eff.op === "multiply")
				eventCashMultiplier *= eff.value as number;
			if (eff.type === "locProduction" && eff.op === "multiply")
				eventLocProductionMultiplier *= eff.value as number;
			if (eff.type === "locPerKey" && eff.op === "multiply")
				eventLocPerKeyMultiplier *= eff.value as number;
			if (eff.type === "autoLoc" && eff.op === "multiply")
				eventAutoLocMultiplier *= eff.value as number;
			if (eff.type === "codeQuality" && eff.op === "add")
				sim.codeQuality = Math.max(0, sim.codeQuality + (eff.value as number));
			// disableUpgrade: sim ignores this (minor effect, not worth complexity)
		}
	}
```

- [ ] **Step 3: Integrate event ticking into the main sim loop**

Inside the main `for` loop, right after `const flops = totalFlops();` and before `// ── Produce LoC ──`, add event simulation:

```typescript
		// ── Tick events ──
		if (activeSimEvent) {
			// Mash events: reduce duration by keysPerSec * reductionPerKey
			const mashDef = simEvents.find((e) => e.id === activeSimEvent?.id);
			if (mashDef?.interaction?.type === "mash_keys") {
				const mashReduction = cfg.keysPerSec * mashDef.interaction.reductionPerKey;
				activeSimEvent.remainingDuration -= mashReduction;
			}
			activeSimEvent.remainingDuration -= 1; // 1 second per tick
			if (activeSimEvent.remainingDuration <= 0) {
				activeSimEvent = null;
				resetEventModifiers();
			}
		}

		if (!activeSimEvent && t >= nextEventSpawn) {
			const ev = pickSimEvent();
			if (ev) {
				const isChoice = ev.effects.some((e) => e.type === "choice");
				const isInstant = ev.duration === 0 && !isChoice;

				if (isInstant) {
					// Apply instant effects
					for (const eff of ev.effects) {
						if (eff.type === "instantCash" && eff.value) {
							const val = resolveSimExpression(eff.value);
							sim.cash += val;
							sim.totalCash += val;
						}
						if (eff.type === "instantLoc" && eff.value) {
							const val = eff.value as number;
							sim.loc += val;
							sim.totalLoc += val;
						}
						if (eff.type === "codeQuality" && eff.op === "add") {
							sim.codeQuality = Math.max(0, sim.codeQuality + (eff.value as number));
						}
						if (eff.type === "conditionalCash" && eff.threshold && eff.reward) {
							const threshold = resolveSimExpression(eff.threshold);
							const currentLps = calcAutoLoc() + effLocPerKey() * cfg.keysPerSec;
							if (currentLps >= threshold) {
								const reward = resolveSimExpression(eff.reward);
								sim.cash += reward;
								sim.totalCash += reward;
							}
						}
					}
				} else if (isChoice) {
					// Sim picks optimal choice
					const choiceEff = ev.effects.find((e) => e.type === "choice");
					if (choiceEff?.options && choiceEff.options.length > 0) {
						// Simplification: always pick first option (safe/conservative choice)
					// For security_audit: "Pay fine" (-5% cash) vs "Ignore it" (-20% quality)
					// For acquihire_offer: "Sell out" (2x cash now) vs "Stay indie" (+10% 120s)
						const opt = choiceEff.options[0];
						if (opt.effect.type === "cash" && opt.effect.op === "multiply") {
							const delta = sim.cash * ((opt.effect.value as number) - 1);
							sim.cash += delta;
						}
						if (opt.effect.type === "instantCash" && opt.effect.value) {
							const val = resolveSimExpression(opt.effect.value);
							sim.cash += val;
							sim.totalCash += val;
						}
						// If option has duration, create active event with that effect
						if (opt.effect.duration && opt.effect.duration > 0) {
							activeSimEvent = {
								id: `${ev.id}_choice`,
								remainingDuration: opt.effect.duration,
								effects: [opt.effect],
							};
							applySimEventModifiers();
						}
					}
				} else {
					// Duration event
					activeSimEvent = {
						id: ev.id,
						remainingDuration: ev.duration,
						effects: ev.effects,
					};
					applySimEventModifiers();
				}
			}
			nextEventSpawn =
				t +
				simEventConfig.minIntervalSeconds +
				prng() *
					(simEventConfig.maxIntervalSeconds -
						simEventConfig.minIntervalSeconds);
		}

		applySimEventModifiers();
```

- [ ] **Step 4: Apply event modifiers to sim calculations**

Modify the existing production/execution lines to use event modifiers.

Replace `effLocPerKey()`:
```typescript
	function effLocPerKey(): number {
		return sim.locPerKey * sim.locPerKeyMultiplier * eventLocPerKeyMultiplier;
	}
```

In `calcAutoLoc()`, multiply the result by `eventAutoLocMultiplier` and `eventLocProductionMultiplier`:
```typescript
	function calcAutoLoc(): number {
		const managerTeamBonus = 1 + sim.managerCount * 0.5 * sim.managerMultiplier;
		return (
			(sim.freelancerLoc * sim.freelancerLocMultiplier +
				sim.internLoc * sim.internLocMultiplier +
				sim.devLoc * sim.devLocMultiplier * sim.devSpeedMultiplier +
				sim.teamLoc * sim.teamLocMultiplier * managerTeamBonus +
				sim.llmLoc * sim.llmLocMultiplier +
				sim.agentLoc * sim.agentLocMultiplier) *
			sim.locProductionMultiplier *
			eventAutoLocMultiplier *
			eventLocProductionMultiplier
		);
	}
```

Replace `totalFlops()`:
```typescript
	function totalFlops(): number {
		if (eventFlopsOverride !== null) return eventFlopsOverride;
		const hw = Math.min(sim.cpuFlops, sim.ramFlops) + sim.storageFlops;
		return (sim.flops + hw) * eventFlopsMultiplier;
	}
```

Replace `cashPerLoc()`:
```typescript
	function cashPerLoc(): number {
		return (
			tiers[sim.currentTier].cashPerLoc *
			sim.cashMultiplier *
			eventCashMultiplier *
			(sim.codeQuality / 100)
		);
	}
```

- [ ] **Step 5: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Run balance check**

Run: `cd specs && node balance-check.js`
Expected: All profiles pass (or minor adjustments needed). Events should be roughly net-neutral.

- [ ] **Step 7: Commit**

```bash
git add src/utils/balance-sim.ts
git commit -m "✨ Add event simulation to balance sim with seeded PRNG"
```

---

### Task 9: Balance Check Script Update

**Files:**
- Modify: `specs/balance-check.js`

- [ ] **Step 1: Check if balance-check.js needs event support**

The `specs/balance-check.js` script has its own simulation engine (separate from `balance-sim.ts`). Read it to determine if it also needs event integration, or if it only calls the TS sim.

If it has its own sim loop, port the same event logic. If it calls `balance-sim.ts`, no changes needed — the TS sim already has events.

- [ ] **Step 2: Run balance check and fix any failures**

Run: `cd specs && node balance-check.js --verbose`

If any profile fails:
- Check if events are causing too much variance
- Adjust event weights or durations in `specs/data/events.json` if needed
- Re-run until all pass

- [ ] **Step 3: Commit if changes needed**

```bash
git add specs/balance-check.js specs/data/events.json
git commit -m "🔧 Tune event balance after sim integration"
```

---

### Task 10: Game Reset Integration

**Files:**
- Modify: `src/modules/game/store/game-store.ts` (reset action, ~line 538)

- [ ] **Step 1: Reset event store on game reset**

In the `reset` action of `game-store.ts`, add:

```typescript
reset: () => {
	set(initialState);
	localStorage.removeItem("agi-rush-editor");
	useEventStore.getState().reset();
},
```

Ensure `useEventStore` is already imported (from Task 5).

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/modules/game/store/game-store.ts
git commit -m "🐛 Reset event store on game reset"
```

---

### Task 11: Final Integration Test & Biome Check

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 2: Run Biome lint + format**

Run: `npm run check`
If failures: `npm run check:fix` then verify.

- [ ] **Step 3: Run balance check**

Run: `cd specs && node balance-check.js`
Expected: All 3 profiles pass.

- [ ] **Step 4: Manual playtest**

Run: `npm run dev` and play through:
- [ ] Events fire every 30-90s
- [ ] Toast appears with correct styling (red/blue/neutral)
- [ ] Timer counts down on duration events
- [ ] Mash events (production_down) respond to typing, timer decreases faster
- [ ] Choice events (security_audit, acquihire_offer) show buttons, choices apply
- [ ] Instant events (github_star) show brief toast then dismiss
- [ ] No events fire while game is paused (`running = false`)
- [ ] Game reset clears active events
- [ ] Events respect tier restrictions (no startup events during garage tier)

- [ ] **Step 5: Final commit if any fixes**

```bash
git add -u
git commit -m "🐛 Fix integration issues from playtest"
```
