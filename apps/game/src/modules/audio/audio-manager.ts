import { useAudioStore } from "./audio-store";
import type { MusicStyleEnum } from "./music-engine";
import {
	getPackStems,
	getStemNames,
	initMusic,
	isStarted,
	setMusicVolume,
	setStemGain,
	setTier,
	singularityBreakdown,
	startMusic,
	stopMusic,
	switchStyle,
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

	const { musicVolume, muted, musicStyle } = useAudioStore.getState();
	await initMusic(musicStyle);
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
	switchStyle: (style: MusicStyleEnum) => switchStyle(style),
	getStemNames: () => getStemNames(),
	getPackStems: () => getPackStems(),
	setStemGain: (name: string, on: boolean) => setStemGain(name, on),
} as const;
