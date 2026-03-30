import { useAudioStore } from "./audio-store";
import {
	initMusic,
	isStarted,
	setMusicVolume,
	setTier,
	singularityBreakdown,
	startMusic,
	stopMusic,
} from "./music-engine";
import {
	playEvent,
	playExecute,
	playMilestone,
	playPurchase,
	playTierUnlock,
	playTyping,
	resumeCtx,
} from "./sfx-engine";

let initialized = false;

function sfxVol(): [number, boolean] {
	const s = useAudioStore.getState();
	return [s.sfxVolume, s.muted];
}

/** Call on first user gesture (keydown / click). Safe to call multiple times. */
export async function init(tierIndex: number) {
	resumeCtx();
	if (initialized) return;
	initialized = true;

	await initMusic();

	// Apply current volume
	const { musicVolume, muted } = useAudioStore.getState();
	setMusicVolume(musicVolume, muted);

	startMusic(tierIndex);
}

// ── SFX wrappers (read store inline, fire-and-forget) ──

export const sfx = {
	typing: () => playTyping(...sfxVol()),
	execute: () => playExecute(...sfxVol()),
	purchase: () => playPurchase(...sfxVol()),
	tierUnlock: () => playTierUnlock(...sfxVol()),
	milestone: () => playMilestone(...sfxVol()),
	event: () => playEvent(...sfxVol()),
} as const;

// ── Music wrappers ──

export const music = {
	setTier: (tierIndex: number) => {
		if (!isStarted()) return;
		setTier(tierIndex);
	},
	singularity: () => {
		if (!isStarted()) return;
		singularityBreakdown();
	},
	stop: () => stopMusic(),
	syncVolume: () => {
		const { musicVolume, muted } = useAudioStore.getState();
		setMusicVolume(musicVolume, muted);
	},
} as const;
