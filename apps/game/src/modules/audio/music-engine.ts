import type * as ToneNs from "tone";

/**
 * Stem-based music engine. Each tier fades in additional stems.
 * Supports multiple music packs (stem sets) that can be hot-swapped.
 *
 * Tone.js is loaded dynamically on first use to keep it out of the main bundle.
 */

let Tone: typeof ToneNs;

export const MusicStyleEnum = {
	ferreira: "ferreira",
	chiptune: "chiptune",
	landing: "landing",
} as const;

export type MusicStyleEnum =
	(typeof MusicStyleEnum)[keyof typeof MusicStyleEnum];

/** Pack definition: stem file names + tier→stem mapping */
interface StemPack {
	dir: string;
	stems: readonly string[];
	tiers: Record<number, string[]>;
}

const PACKS: Record<MusicStyleEnum, StemPack> = {
	ferreira: {
		dir: "stems/ferreira",
		stems: [
			"pads-t0",
			"lfo-bass-t0",
			"drums-t1",
			"lfo-melody-t1",
			"pads-t1",
			"drums-t2",
			"lfo-melody-t2",
			"pads-t2",
			"bells-t3",
			"lfo-bass-t4",
			"arp-t4",
			"drums-t5",
			"bells-t5",
			"lfo-bass-t5",
			"lfo-melody-t5",
			"pads-t5",
		],
		tiers: {
			0: ["pads-t0", "lfo-bass-t0"],
			1: ["pads-t1", "lfo-bass-t0", "drums-t1", "lfo-melody-t1"],
			2: ["pads-t2", "lfo-bass-t0", "drums-t2", "lfo-melody-t2"],
			3: ["pads-t2", "lfo-bass-t0", "drums-t2", "lfo-melody-t2", "bells-t3"],
			4: [
				"pads-t2",
				"lfo-bass-t4",
				"drums-t2",
				"lfo-melody-t2",
				"bells-t3",
				"arp-t4",
			],
			5: [
				"pads-t5",
				"lfo-bass-t5",
				"drums-t5",
				"lfo-melody-t5",
				"bells-t5",
				"arp-t4",
			],
		},
	},
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
		stems: ["bass", "drums", "lead", "pad", "arp"],
		tiers: {
			0: ["bass"],
			1: ["bass", "drums"],
			2: ["bass", "drums", "lead"],
			3: ["bass", "drums", "lead", "pad"],
			4: ["bass", "drums", "lead", "pad", "arp"],
			5: ["bass", "drums", "lead", "pad", "arp"],
		},
	},
};

const FADE_DURATION = 2; // seconds

interface StemPlayer {
	player: ToneNs.Player;
	gain: ToneNs.Gain;
}

const stems: Map<string, StemPlayer> = new Map();
let started = false;
let currentTier = 0;
let currentStyle: MusicStyleEnum = MusicStyleEnum.ferreira;

/**
 * Apply a Hann crossfade at the buffer boundaries so the loop seam
 * is smooth. Does NOT change loopStart/loopEnd — all stems must loop
 * the full buffer to stay in sync.
 */
function makeBufferSeamless(player: ToneNs.Player, fadeMs = 500) {
	const raw = player.buffer.get();
	if (!raw || raw.length === 0) return;

	const sampleRate = raw.sampleRate;
	const fadeSamples = Math.min(
		Math.floor((fadeMs / 1000) * sampleRate),
		Math.floor(raw.length / 8),
	);

	if (fadeSamples < 2) return;

	for (let ch = 0; ch < raw.numberOfChannels; ch++) {
		const data = raw.getChannelData(ch);
		const len = data.length;

		for (let i = 0; i < fadeSamples; i++) {
			const t = i / fadeSamples;
			const w = 0.5 * (1 - Math.cos(Math.PI * t)); // 0→1 Hann curve

			// Blend start with end: at the boundary, mix them together
			const startVal = data[i];
			const endVal = data[len - fadeSamples + i];

			data[i] = startVal * w + endVal * (1 - w);
			data[len - fadeSamples + i] = endVal * w + startVal * (1 - w);
		}
	}
}

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
							// Trim silence + blend loop boundaries
							makeBufferSeamless(player);

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
	Tone = await import("tone");
	await Tone.start();
	currentStyle = style ?? MusicStyleEnum.ferreira;
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

/** Singularity: vinyl halt — pitch drops slowly while fading out. */
export function singularityBreakdown() {
	const durationMs = 4000;
	const startTime = performance.now();

	// Animate playback rate from 1 → 0.05 over 4s (manual ramp)
	const tick = () => {
		const elapsed = performance.now() - startTime;
		const progress = Math.min(elapsed / durationMs, 1);
		// Exponential curve for natural vinyl deceleration
		const rate = 1 * (0.05 / 1) ** progress; // 1 → 0.05 exponentially
		for (const [, stem] of stems) {
			stem.player.playbackRate = rate;
		}
		if (progress < 1) {
			requestAnimationFrame(tick);
		}
	};
	requestAnimationFrame(tick);

	// Fade volume behind the pitch drop
	for (const [, stem] of stems) {
		stem.gain.gain.rampTo(0.15, (durationMs / 1000) * 0.7);
	}
	setTimeout(() => {
		for (const [, stem] of stems) {
			stem.gain.gain.rampTo(0, 1);
		}
	}, durationMs * 0.7);
	setTimeout(() => stopMusic(), durationMs + 500);
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
