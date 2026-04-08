import { useGameStore } from "@modules/game";
import { useEffect, useRef } from "react";

export function useAutoType(advanceTokens: (count: number) => void) {
	const autoTypeEnabled = useGameStore((s) => s.autoTypeEnabled);
	const locPerKey = useGameStore((s) => s.locPerKey);
	const singularity = useGameStore((s) => s.singularity);
	const running = useGameStore((s) => s.running);
	const autoAccumRef = useRef(0);

	useEffect(() => {
		if (singularity || !running) return;
		const hasAutoType = autoTypeEnabled;
		if (!hasAutoType) return;

		let rafId: number;
		let lastTime = performance.now();

		function autoLoop() {
			const now = performance.now();
			const dt = (now - lastTime) / 1000;
			lastTime = now;

			// Auto-type: ~5 keystrokes/sec (passive coding, not as fast as active typing)
			// NOTE: Only auto-type keystrokes go through advanceTokens.
			// Dev/freelancer/intern LoC is handled by the tick via autoLocPerSec.
			const autoTypeRate = 5;

			autoAccumRef.current += autoTypeRate * dt;

			// Cap keystrokes per frame to prevent CPU spikes at high rates.
			// advanceTokens already caps visual work internally, but limiting
			// here avoids the overhead of iterating thousands of tokens in the loop.
			const toAdd = Math.min(Math.floor(autoAccumRef.current), 10);
			if (toAdd > 0) {
				autoAccumRef.current -= toAdd;
				advanceTokens(toAdd * locPerKey);
				// Drain any excess accumulation to prevent snowballing
				// when rate exceeds what we can process per frame
				if (autoAccumRef.current > 10) {
					autoAccumRef.current = 10;
				}
			}

			rafId = requestAnimationFrame(autoLoop);
		}

		rafId = requestAnimationFrame(autoLoop);
		return () => cancelAnimationFrame(rafId);
	}, [autoTypeEnabled, locPerKey, advanceTokens, singularity, running]);
}
