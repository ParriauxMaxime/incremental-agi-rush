import * as Tone from "tone";

/**
 * Stem-based music engine. Each tier fades in additional stems.
 * Supports multiple music packs (stem sets) that can be hot-swapped.
 */

export const MusicStyleEnum = {
	chiptune: "chiptune",
	landing: "landing",
} as const;

export type MusicStyleEnum = (typeof MusicStyleEnum)[keyof typeof MusicStyleEnum];

/** Pack definition: stem file names + tier→stem mapping */
interface StemPack {
	dir: string;
	stems: readonly string[];
	tiers: Record<number, string[]>;
}

const PACKS: Record<MusicStyleEnum, StemPack> = {
	chiptune: {
		dir: "stems",
		stems: ["bass", "keys", "drums", "pad", "lead", "glitch"],
		tiers: {
			0: ["bass", "keys"],
			1: ["bass", "keys", "drums"],
			2: ["bass", "keys", "drums", "pad"],
			3: ["bass", "keys", "drums", "pad", "lead"],
			4: ["bass", "keys", "drums", "pad", "lead", "glitch"],
			5: ["bass", "keys", "drums", "pad", "lead", "glitch"],
		},
	},
	landing: {
		dir: "stems/landing",
		stems: ["bass", "drums", "pad", "lead", "arp"],
		tiers: {
			0: ["bass"],
			1: ["bass", "drums"],
			2: ["bass", "drums", "pad"],
			3: ["bass", "drums", "pad", "lead"],
			4: ["bass", "drums", "pad", "lead", "arp"],
			5: ["bass", "drums", "pad", "lead", "arp"],
		},
	},
};

const FADE_DURATION = 2; // seconds

interface StemPlayer {
	player: Tone.Player;
	gain: Tone.Gain;
}

const stems: Map<string, StemPlayer> = new Map();
let started = false;
let currentTier = 0;
let currentStyle: MusicStyleEnum = MusicStyleEnum.chiptune;

async function loadPack(style: MusicStyleEnum) {
	const pack = PACKS[style];
	const basePath = `${window.location.origin}/audio/${pack.dir}`;

	await Promise.all(
		pack.stems.map(
			(name) =>
				new Promise<void>((resolve) => {
					const player = new Tone.Player({
						url: `${basePath}/${name}.ogg`,
						loop: true,
						autostart: false,
						onerror: () => resolve(),
						onload: () => {
							const gain = new Tone.Gain(0);
							player.connect(gain);
							gain.toDestination();
							stems.set(name, { player, gain });
							resolve();
						},
					});
				}),
		),
	);
}

function clearStems() {
	for (const [, stem] of stems) {
		try {
			stem.player.stop();
			stem.player.dispose();
			stem.gain.dispose();
		} catch {
			// ignore disposal errors
		}
	}
	stems.clear();
}

export async function initMusic(style?: MusicStyleEnum) {
	await Tone.start();
	currentStyle = style ?? MusicStyleEnum.chiptune;
	await loadPack(currentStyle);
}

/** Hot-swap to a different music style. Crossfades over 1s. */
export async function switchStyle(style: MusicStyleEnum) {
	if (style === currentStyle && stems.size > 0) return;

	const wasStarted = started;
	const tier = currentTier;

	// Fade out current stems
	for (const [, stem] of stems) {
		stem.gain.gain.rampTo(0, 1);
	}
	await new Promise((r) => setTimeout(r, 1100));

	// Clear and load new pack
	clearStems();
	currentStyle = style;
	await loadPack(style);

	// Restart if was playing
	if (wasStarted) {
		started = false;
		startMusic(tier);
	}
}

export function startMusic(tierIndex: number) {
	if (started) return;
	started = true;
	currentTier = tierIndex;

	// Start all players (silent), then fade in active ones
	for (const [, stem] of stems) {
		stem.player.start();
	}

	applyTier(tierIndex, 0.5); // quick initial fade
}

export function setTier(tierIndex: number) {
	if (tierIndex === currentTier) return;
	currentTier = tierIndex;
	applyTier(tierIndex, FADE_DURATION);
}

function applyTier(tierIndex: number, fadeSec: number) {
	const pack = PACKS[currentStyle];
	const active = new Set(pack.tiers[tierIndex] ?? pack.tiers[5]);

	for (const [name, stem] of stems) {
		const target = active.has(name) ? 1 : 0;
		stem.gain.gain.rampTo(target, fadeSec);
	}
}

export function setMusicVolume(volume: number, muted: boolean) {
	const val = muted || volume === 0 ? -Infinity : -40 + (volume / 100) * 40;
	Tone.getDestination().volume.rampTo(val, 0.1);
}

/** Singularity: distort audio then fade to silence over 3 seconds. */
export function singularityBreakdown() {
	for (const [, stem] of stems) {
		stem.gain.gain.rampTo(0, 3);
	}
	setTimeout(() => stopMusic(), 3500);
}

export function stopMusic() {
	for (const [, stem] of stems) {
		stem.player.stop();
	}
	started = false;
}

export function isStarted() {
	return started;
}

/** Get loaded stem names for the current pack. */
export function getStemNames(): string[] {
	return [...stems.keys()];
}

/** Set individual stem gain (0 or 1). For god mode testing. */
export function setStemGain(name: string, on: boolean) {
	const stem = stems.get(name);
	if (stem) {
		stem.gain.gain.rampTo(on ? 1 : 0, 0.3);
	}
}

/** Get current pack's stem list (even if not loaded yet). */
export function getPackStems(style?: MusicStyleEnum): readonly string[] {
	return PACKS[style ?? currentStyle].stems;
}
