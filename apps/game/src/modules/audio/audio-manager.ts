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
	playBootHum,
	playCrtDown,
	playDroneSwell,
	playErrorAlarm,
	playEvent,
	playExecute,
	playMilestone,
	playPurchase,
	playTerminalKey,
	playTierUnlock,
	playTyping,
	resumeCtx,
} from "./sfx-engine";

let initialized = false;

function sfxVol(): [number, boolean] {
	const s = useAudioStore.getState();
	return [s.sfxVolume, s.muted];
}

/** Endgame SFX ignore mute — the singularity sequence should always have sound. */
function forceSfxVol(): [number, boolean] {
	const s = useAudioStore.getState();
	return [Math.max(s.sfxVolume, 50), false];
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
	crtDown: () => playCrtDown(...forceSfxVol()),
	bootHum: () => playBootHum(...forceSfxVol()),
	terminalKey: () => playTerminalKey(...forceSfxVol()),
	errorAlarm: () => playErrorAlarm(...forceSfxVol()),
	droneSwell: () => playDroneSwell(...forceSfxVol()),
} as const;

// ── Music wrappers ──

export const music = {
	setTier: (tierIndex: number) => {
		if (!isStarted()) return;
		setTier(tierIndex);
	},
	singularity: () => {
		if (!isStarted()) return;
		// Force unmute for the endgame sequence
		setMusicVolume(useAudioStore.getState().musicVolume, false);
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
