import { useEffect, useRef, useState } from "react";

const IGNORED_KEYS = new Set([
	"Shift",
	"Control",
	"Alt",
	"Meta",
	"Tab",
	"Escape",
	"CapsLock",
]);
const HELD_CAP = 12;
const IDLE_TIMEOUT = 3000;

export function useKeypressRate(): number {
	const pressTimestamps = useRef<number[]>([]);
	const heldRef = useRef(false);
	const lastKeyTime = useRef(0);
	const [rate, setRate] = useState(0);

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (IGNORED_KEYS.has(e.key)) return;
			lastKeyTime.current = performance.now();
			if (e.repeat) {
				heldRef.current = true;
			} else {
				heldRef.current = false;
				pressTimestamps.current.push(performance.now());
			}
		}
		function onKeyUp() {
			heldRef.current = false;
		}

		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);

		const id = setInterval(() => {
			const now = performance.now();
			if (now - lastKeyTime.current > IDLE_TIMEOUT) {
				pressTimestamps.current.length = 0;
				setRate(0);
			} else if (heldRef.current) {
				setRate(HELD_CAP);
			} else {
				const cutoff = now - IDLE_TIMEOUT;
				const ts = pressTimestamps.current;
				while (ts.length > 0 && ts[0] < cutoff) ts.shift();
				setRate(ts.length / 3);
			}
		}, 500);

		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			clearInterval(id);
		};
	}, []);

	return rate;
}
