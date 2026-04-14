import { useGameStore } from "@modules/game";
import { useEffect, useRef } from "react";

/** True while auto-type is actively producing tokens — used to suppress typing SFX. */
export let autoTypeActive = false;

export function useAutoType(advanceTokens: (count: number) => void) {
	const autoTypeEnabled = useGameStore((s) => s.autoTypeEnabled);
	const locPerKey = useGameStore((s) => s.locPerKey);
	const singularity = useGameStore((s) => s.singularity);
	const running = useGameStore((s) => s.running);
	const autoAccumRef = useRef(0);

	useEffect(() => {
		if (singularity || !running) return;
		if (!autoTypeEnabled) return;

		autoTypeActive = true;
		let rafId: number;
		let lastTime = performance.now();

		function autoLoop() {
			const now = performance.now();
			const dt = (now - lastTime) / 1000;
			lastTime = now;

			// Auto-type: ~5 keystrokes/sec
			autoAccumRef.current += 5 * dt;

			const toAdd = Math.min(Math.floor(autoAccumRef.current), 10);
			if (toAdd > 0) {
				autoAccumRef.current -= toAdd;
				// LoC accounting: addLoc per keystroke
				const addLoc = useGameStore.getState().addLoc;
				addLoc(locPerKey * toAdd);
				// Visual: advance tokens for eye candy
				advanceTokens(toAdd);
				if (autoAccumRef.current > 10) {
					autoAccumRef.current = 10;
				}
			}

			rafId = requestAnimationFrame(autoLoop);
		}

		rafId = requestAnimationFrame(autoLoop);
		return () => {
			cancelAnimationFrame(rafId);
			autoTypeActive = false;
		};
	}, [autoTypeEnabled, locPerKey, advanceTokens, singularity, running]);
}
