import type { ExpressionContext } from "@modules/event";
import {
	allEvents,
	resolveInstantEffects,
	useEventStore,
} from "@modules/event";
import { useEffect, useRef } from "react";
import { useGameStore } from "../store/game-store";

export function useGameLoop() {
	const tick = useGameStore((s) => s.tick);
	const lastTickRef = useRef(performance.now());
	const lastEventLogLenRef = useRef(0);

	useEffect(() => {
		let rafId: number;
		// Reuse a single context object to avoid allocation every frame
		const ctx: ExpressionContext = {
			currentCash: 0,
			currentLoc: 0,
			currentLocPerSec: 0,
		};

		// Throttle game tick to ~20fps (50ms). The game is an incremental/idle
		// game — 60fps simulation is wasteful. Animations (RollingNumber, bar fills)
		// use CSS transitions so they stay smooth regardless of tick rate.
		const MIN_TICK_MS = 50;

		function loop() {
			const now = performance.now();
			const elapsed = now - lastTickRef.current;

			if (elapsed < MIN_TICK_MS) {
				rafId = requestAnimationFrame(loop);
				return;
			}

			const dt = elapsed / 1000;
			lastTickRef.current = now;

			// Tick events
			const gameState = useGameStore.getState();
			const eventStore = useEventStore.getState();
			ctx.currentCash = gameState.cash;
			ctx.currentLoc = gameState.loc;
			ctx.currentLocPerSec = gameState.autoLocPerSec;
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
					const { cashDelta, locDelta } = resolveInstantEffects(def, ctx);
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

		// Recalc derived stats on mount (ensures rehydration is complete)
		useGameStore.getState().recalc();
		// Reset event log tracking on mount
		lastEventLogLenRef.current = useEventStore.getState().eventLog.length;

		rafId = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(rafId);
	}, [tick]);
}
