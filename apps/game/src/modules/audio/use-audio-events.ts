import { useGameStore } from "@modules/game";
import { useEffect, useRef } from "react";
import { init as initAudio, music, sfx } from "./audio-manager";
import { useAudioStore } from "./audio-store";

export function useAudioEvents() {
	const tierIndex = useGameStore((s) => s.currentTierIndex);
	const prevTierRef = useRef(tierIndex);
	const initRef = useRef(false);

	// Init audio on first keydown or click
	useEffect(() => {
		const handler = () => {
			if (initRef.current) return;
			initRef.current = true;
			initAudio(useGameStore.getState().currentTierIndex);
			window.removeEventListener("keydown", handler);
			window.removeEventListener("click", handler);
		};
		window.addEventListener("keydown", handler);
		window.addEventListener("click", handler);
		return () => {
			window.removeEventListener("keydown", handler);
			window.removeEventListener("click", handler);
		};
	}, []);

	// Tier transitions
	useEffect(() => {
		if (tierIndex !== prevTierRef.current) {
			music.setTier(tierIndex);
			if (tierIndex > prevTierRef.current) {
				sfx.tierUnlock();
			}
			prevTierRef.current = tierIndex;
		}
	}, [tierIndex]);

	// Volume sync + music style changes
	useEffect(() => {
		let prevStyle = useAudioStore.getState().musicStyle;
		return useAudioStore.subscribe((state) => {
			music.syncVolume();
			if (state.musicStyle !== prevStyle) {
				prevStyle = state.musicStyle;
				music.switchStyle(state.musicStyle);
			}
		});
	}, []);
}
