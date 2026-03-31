import type {
	ActiveEvent,
	EventDefinition,
	EventEffect,
	EventModifiers,
	ExpressionContext,
} from "@flopsed/domain";
import {
	events as allEvents,
	DEFAULT_EVENT_MODIFIERS,
	eventConfig,
	TIER_INDEX,
} from "@flopsed/domain";
import { resolveExpression } from "@flopsed/engine";
import { sfx } from "@modules/audio";
import { match } from "ts-pattern";
import { create } from "zustand";

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

function randomInterval(): number {
	const { minIntervalSeconds, maxIntervalSeconds } = eventConfig;
	const seconds =
		minIntervalSeconds +
		Math.random() * (maxIntervalSeconds - minIntervalSeconds);
	return performance.now() + seconds * 1000;
}

function pickWeightedEvent(tierIndex: number): EventDefinition | null {
	const eligible = allEvents.filter(
		(e) =>
			TIER_INDEX[e.minTier] <= tierIndex &&
			(e.maxTier == null || TIER_INDEX[e.maxTier] >= tierIndex),
	);
	if (eligible.length === 0) return null;

	const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
	let roll = Math.random() * totalWeight;
	for (const e of eligible) {
		roll -= e.weight;
		if (roll <= 0) return e;
	}
	return eligible[eligible.length - 1];
}

function applyModifier(
	modifiers: EventModifiers,
	disabledUpgrades: string[],
	effect: EventEffect,
): void {
	match(effect)
		.with({ type: "flops", op: "multiply" }, (e) => {
			modifiers.flopsMultiplier *= e.value;
		})
		.with({ type: "flops", op: "set" }, (e) => {
			modifiers.flopsOverride = e.value;
		})
		.with({ type: "locPerKey", op: "multiply" }, (e) => {
			modifiers.locPerKeyMultiplier *= e.value;
		})
		.with({ type: "autoLoc", op: "multiply" }, (e) => {
			modifiers.autoLocMultiplier *= e.value;
		})
		.with({ type: "locProduction", op: "multiply" }, (e) => {
			modifiers.locProductionMultiplier *= e.value;
		})
		.with({ type: "cashMultiplier", op: "multiply" }, (e) => {
			modifiers.cashMultiplier *= e.value;
		})
		.with({ type: "cash", op: "multiply" }, (e) => {
			// cash multiply acts as cashMultiplier
			modifiers.cashMultiplier *= e.value;
		})
		.with({ type: "tokenProduction", op: "multiply" }, (e) => {
			modifiers.tokenProductionMultiplier *= e.value;
		})
		.with({ type: "disableUpgrade" }, (e) => {
			disabledUpgrades.push(e.upgradeId);
		})
		.otherwise(() => {});
}

// ---------------------------------------------------------------------------
// Exported effect resolvers
// ---------------------------------------------------------------------------

export function resolveInstantEffects(
	def: EventDefinition,
	ctx: ExpressionContext,
): { cashDelta: number; locDelta: number } {
	let cashDelta = 0;
	let locDelta = 0;

	for (const effect of def.effects) {
		match(effect)
			.with({ type: "instantCash", op: "add" }, (e) => {
				cashDelta += resolveExpression(e.value, ctx);
			})
			.with({ type: "instantLoc", op: "add" }, (e) => {
				locDelta += e.value;
			})
			.with({ type: "conditionalCash" }, (e) => {
				const threshold = resolveExpression(e.threshold, ctx);
				if (ctx.currentLocPerSec >= threshold) {
					cashDelta += resolveExpression(e.reward, ctx);
				}
			})
			.otherwise(() => {});
	}

	return { cashDelta, locDelta };
}

export function resolveChoiceEffects(
	effect: EventEffect,
	ctx: ExpressionContext,
): { cashDelta: number; locDelta: number } {
	let cashDelta = 0;
	const locDelta = 0;

	match(effect)
		.with({ type: "instantCash", op: "add" }, (e) => {
			cashDelta += resolveExpression(e.value, ctx);
		})
		.with({ type: "cash", op: "multiply" }, (e) => {
			// delta = currentCash * (value - 1)
			cashDelta += ctx.currentCash * (e.value - 1);
		})
		.otherwise(() => {});

	return { cashDelta, locDelta };
}

// ---------------------------------------------------------------------------
// Store types
// ---------------------------------------------------------------------------

interface MilestoneToast {
	id: string;
	name: string;
	description: string;
	cashBonus: number;
}

interface EventState {
	activeEvents: ActiveEvent[];
	nextSpawnAt: number;
	eventLog: string[];
	toastEvent: { definitionId: string; remainingDuration: number } | null;
	toastDismissCountdown: number;
	milestoneToast: MilestoneToast | null;
	milestoneDismissCountdown: number;
}

interface EventActions {
	tick(dt: number, currentTierIndex: number, running: boolean): boolean;
	spawnEvent(eventId: string, ctx: ExpressionContext): void;
	handleChoice(
		eventId: string,
		optionIndex: number,
		ctx: ExpressionContext,
	): void;
	handleMashKey(eventId: string): void;
	getEventModifiers(): EventModifiers;
	getActiveInteractiveEvent(): ActiveEvent | null;
	showMilestoneToast(
		id: string,
		name: string,
		description: string,
		cashBonus: number,
	): void;
	reset(): void;
}

const LOG_CAP = 20;
const TOAST_AUTO_DISMISS = 4;
const CHOICE_TIMEOUT = 60;

const initialState: EventState = {
	activeEvents: [],
	nextSpawnAt: randomInterval(),
	eventLog: [],
	toastEvent: null,
	toastDismissCountdown: 0,
	milestoneToast: null,
	milestoneDismissCountdown: 0,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useEventStore = create<EventState & EventActions>()(
	(set, get) => ({
		...initialState,

		tick(dt: number, currentTierIndex: number, running: boolean): boolean {
			const state = get();
			let changed = false;

			// Tick down active event durations; remove expired (always, even when paused)
			let updatedEvents = state.activeEvents;
			if (updatedEvents.length > 0) {
				const next: ActiveEvent[] = [];
				for (const ev of updatedEvents) {
					if (ev.resolved || ev.remainingDuration <= 0) {
						changed = true;
						continue;
					}
					const newRemaining = ev.remainingDuration - dt;
					if (newRemaining <= 0) {
						changed = true;
					} else {
						next.push({ ...ev, remainingDuration: newRemaining });
						changed = true;
					}
				}
				updatedEvents = next;
			}

			// Tick down toast dismiss countdown (only set changed when toast expires)
			let { toastEvent, toastDismissCountdown } = state;
			if (toastEvent !== null) {
				toastDismissCountdown -= dt;
				if (toastDismissCountdown <= 0) {
					toastEvent = null;
					toastDismissCountdown = 0;
					changed = true;
				}
			}

			// Tick down milestone toast (only set changed when it expires)
			let { milestoneToast, milestoneDismissCountdown } = state;
			if (milestoneToast !== null) {
				milestoneDismissCountdown -= dt;
				if (milestoneDismissCountdown <= 0) {
					milestoneToast = null;
					milestoneDismissCountdown = 0;
					changed = true;
				}
			}

			// Spawn check: only when running and no non-synthetic active event
			let { nextSpawnAt } = state;
			let { eventLog } = state;
			const hasActiveNonSynthetic = updatedEvents.some((ev) => !ev.synthetic);

			if (
				running &&
				!hasActiveNonSynthetic &&
				performance.now() >= nextSpawnAt
			) {
				const def = pickWeightedEvent(currentTierIndex);
				if (def !== null) {
					const now = performance.now();

					const isInstant =
						def.duration === 0 && !def.effects.some((e) => e.type === "choice");

					if (isInstant) {
						// Instant event: log + toast only, doesn't occupy active slot
						const toastEntry = {
							definitionId: def.id,
							remainingDuration: 0,
						};
						toastEvent = toastEntry;
						toastDismissCountdown = TOAST_AUTO_DISMISS;
					} else {
						// Duration or choice event
						const isChoice = def.effects.some((e) => e.type === "choice");
						const duration = isChoice ? CHOICE_TIMEOUT : def.duration;

						const newActive: ActiveEvent = {
							definitionId: def.id,
							startedAt: now,
							remainingDuration: duration,
							resolved: false,
							synthetic: false,
						};
						updatedEvents.push(newActive);

						// Show toast for choice events too
						toastEvent = { definitionId: def.id, remainingDuration: duration };
						toastDismissCountdown = TOAST_AUTO_DISMISS;
					}

					// Log event
					const newLog = [def.id, ...eventLog].slice(0, LOG_CAP);
					eventLog = newLog;
					changed = true;
					sfx.event();
				}

				nextSpawnAt = randomInterval();
			}

			if (changed) {
				set({
					activeEvents: updatedEvents,
					nextSpawnAt,
					eventLog,
					toastEvent,
					toastDismissCountdown,
					milestoneToast,
					milestoneDismissCountdown,
				});
			}

			return changed;
		},

		spawnEvent(eventId: string, _ctx: ExpressionContext): void {
			const def = allEvents.find((e) => e.id === eventId);
			if (!def) return;

			const now = performance.now();
			const isInstant =
				def.duration === 0 && !def.effects.some((e) => e.type === "choice");
			const isChoice = def.effects.some((e) => e.type === "choice");

			set((s) => {
				const newLog = [def.id, ...s.eventLog].slice(0, LOG_CAP);

				if (isInstant) {
					return {
						eventLog: newLog,
						toastEvent: { definitionId: def.id, remainingDuration: 0 },
						toastDismissCountdown: TOAST_AUTO_DISMISS,
					};
				}

				const duration = isChoice ? CHOICE_TIMEOUT : def.duration;
				const newActive: ActiveEvent = {
					definitionId: def.id,
					startedAt: now,
					remainingDuration: duration,
					resolved: false,
					synthetic: false,
				};

				// Remove existing non-synthetic if present (god mode override)
				const filtered = s.activeEvents.filter((ev) => ev.synthetic);

				return {
					activeEvents: [...filtered, newActive],
					eventLog: newLog,
					toastEvent: { definitionId: def.id, remainingDuration: duration },
					toastDismissCountdown: TOAST_AUTO_DISMISS,
				};
			});
		},

		handleChoice(
			eventId: string,
			optionIndex: number,
			_ctx: ExpressionContext,
		): void {
			const def = allEvents.find((e) => e.id === eventId);
			if (!def) return;

			const choiceEffect = def.effects.find((e) => e.type === "choice");
			if (!choiceEffect || choiceEffect.type !== "choice") return;

			const option = choiceEffect.options[optionIndex];
			if (!option) return;

			set((s) => {
				const updatedEvents = s.activeEvents.map((ev) => {
					if (ev.definitionId === eventId && !ev.synthetic && !ev.resolved) {
						return {
							...ev,
							resolved: true,
							remainingDuration: 0,
							chosenOptionIndex: optionIndex,
						};
					}
					return ev;
				});

				const effectWithDuration = option.effect as EventEffect & {
					duration?: number;
				};

				// Spawn synthetic event if the chosen option has a duration
				if (
					effectWithDuration.duration !== undefined &&
					effectWithDuration.duration > 0
				) {
					const synthetic: ActiveEvent = {
						definitionId: `${eventId}__synthetic_${optionIndex}`,
						startedAt: performance.now(),
						remainingDuration: effectWithDuration.duration,
						resolved: false,
						synthetic: true,
						parentEventId: eventId,
						parentOptionIndex: optionIndex,
					};
					return { activeEvents: [...updatedEvents, synthetic] };
				}

				return { activeEvents: updatedEvents };
			});
		},

		handleMashKey(eventId: string): void {
			const def = allEvents.find((e) => e.id === eventId);
			if (!def?.interaction) return;

			const { reductionPerKey } = def.interaction;

			set((s) => {
				const updatedEvents = s.activeEvents.map((ev) => {
					if (ev.definitionId === eventId && !ev.synthetic && !ev.resolved) {
						const newRemaining = ev.remainingDuration - reductionPerKey;
						if (newRemaining <= 0) {
							return { ...ev, remainingDuration: 0, resolved: true };
						}
						return { ...ev, remainingDuration: newRemaining };
					}
					return ev;
				});

				// Filter out resolved ones
				const filtered = updatedEvents.filter(
					(ev) => !(ev.resolved && ev.remainingDuration <= 0),
				);

				return { activeEvents: filtered };
			});
		},

		getEventModifiers(): EventModifiers {
			const { activeEvents } = get();
			if (activeEvents.length === 0) return DEFAULT_EVENT_MODIFIERS;
			const hasActive = activeEvents.some((ev) => !ev.resolved || ev.synthetic);
			if (!hasActive) return DEFAULT_EVENT_MODIFIERS;

			const modifiers: EventModifiers = { ...DEFAULT_EVENT_MODIFIERS };
			const disabledUpgrades: string[] = [];

			for (const ev of activeEvents) {
				if (ev.resolved && !ev.synthetic) continue;

				if (ev.synthetic) {
					// Use parent's chosen option effect
					if (
						ev.parentEventId === undefined ||
						ev.parentOptionIndex === undefined
					)
						continue;

					const parentDef = allEvents.find((e) => e.id === ev.parentEventId);
					if (!parentDef) continue;

					const choiceEffect = parentDef.effects.find(
						(e) => e.type === "choice",
					);
					if (!choiceEffect || choiceEffect.type !== "choice") continue;

					const option = choiceEffect.options[ev.parentOptionIndex];
					if (!option) continue;

					applyModifier(modifiers, disabledUpgrades, option.effect);
				} else {
					// Normal active event
					const def = allEvents.find((e) => e.id === ev.definitionId);
					if (!def) continue;

					for (const effect of def.effects) {
						applyModifier(modifiers, disabledUpgrades, effect);
					}
				}
			}

			return { ...modifiers, disabledUpgrades };
		},

		getActiveInteractiveEvent(): ActiveEvent | null {
			const { activeEvents } = get();
			for (const ev of activeEvents) {
				if (ev.synthetic || ev.resolved) continue;

				const def = allEvents.find((e) => e.id === ev.definitionId);
				if (!def) continue;

				const hasInteraction =
					def.interaction !== undefined ||
					def.effects.some((e) => e.type === "choice");

				if (hasInteraction) return ev;
			}
			return null;
		},

		showMilestoneToast(
			id: string,
			name: string,
			description: string,
			cashBonus: number,
		): void {
			set({
				milestoneToast: { id, name, description, cashBonus },
				milestoneDismissCountdown: 5,
			});
		},

		reset(): void {
			set({
				...initialState,
				nextSpawnAt: randomInterval(),
			});
		},
	}),
);
