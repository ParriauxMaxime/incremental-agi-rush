import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MusicStyleEnum } from "./music-engine";

interface AudioState {
	muted: boolean;
	musicVolume: number;
	sfxVolume: number;
	musicStyle: MusicStyleEnum;
}

interface AudioActions {
	toggleMute: () => void;
	setMusicVolume: (v: number) => void;
	setSfxVolume: (v: number) => void;
	setMusicStyle: (s: MusicStyleEnum) => void;
}

export const useAudioStore = create<AudioState & AudioActions>()(
	persist(
		(set) => ({
			muted: false,
			musicVolume: 50,
			sfxVolume: 70,
			musicStyle: "landing" as MusicStyleEnum,

			toggleMute: () => set((s) => ({ muted: !s.muted })),
			setMusicVolume: (v: number) => set({ musicVolume: v }),
			setSfxVolume: (v: number) => set({ sfxVolume: v }),
			setMusicStyle: (s: MusicStyleEnum) => set({ musicStyle: s }),
		}),
		{ name: "flopsed-audio" },
	),
);
