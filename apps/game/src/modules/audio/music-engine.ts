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
const LOOP_CROSSFADE = 1.5; // seconds of crossfade at loop boundary

interface StemPlayer {
	player: ToneNs.Player;
	playerB: ToneNs.Player; // second copy for crossfade looping
	gain: ToneNs.Gain;
	crossfadeTimer?: ReturnType<typeof setInterval>;
}

const stems: Map<string, StemPlayer> = new Map();
let started = false;
let currentTier = 0;
let currentStyle: MusicStyleEnum = MusicStyleEnum.ferreira;

async function loadPack(style: MusicStyleEnum) {
	const pack = PACKS[style];
	const basePath = `${window.location.origin}/audio/${pack.dir}`;

	await Promise.all(
		pack.stems.map(
			(name) =>
				new Promise<void>((resolve) => {
					let loadCount = 0;
					const url = `${basePath}/${name}.ogg`;

					// Two identical players for crossfade looping
					const playerA = new Tone.Player({
						url,
						loop: false, // manual loop via crossfade
						autostart: false,
						onerror: () => resolve(),
						onload: onLoaded,
					});
					const playerB = new Tone.Player({
						url,
						loop: false,
						autostart: false,
						onerror: () => resolve(),
						onload: onLoaded,
					});

					function onLoaded() {
						loadCount++;
						if (loadCount < 2) return;

						const gain = new Tone.Gain(0);
						const gainA = new Tone.Gain(1);
						const gainB = new Tone.Gain(0);
						playerA.connect(gainA);
						playerB.connect(gainB);
						gainA.connect(gain);
						gainB.connect(gain);
						gain.toDestination();

						stems.set(name, {
							player: playerA,
							playerB,
							gain,
							_gainA: gainA,
							_gainB: gainB,
						} as StemPlayer & { _gainA: ToneNs.Gain; _gainB: ToneNs.Gain });
						resolve();
					}
				}),
		),
	);
}

/** Start crossfade looping for a stem: schedule alternating playback
 *  with overlap, using setTimeout based on known buffer duration. */
function startCrossfadeLoop(name: string) {
	const stem = stems.get(name) as
		| (StemPlayer & { _gainA: ToneNs.Gain; _gainB: ToneNs.Gain })
		| undefined;
	if (!stem) return;
	if (stem.crossfadeTimer) return;

	const dur = stem.player.buffer.duration;
	if (dur <= 0) return;

	const cf = LOOP_CROSSFADE;
	const cycleDur = (dur - cf) * 1000; // ms between starting each copy
	let useA = true;

	function startNext() {
		if (!stem || !stems.has(name)) return; // stem was cleared

		const current = useA ? stem.player : stem.playerB;
		const currentGain = useA ? stem._gainA : stem._gainB;
		const prevGain = useA ? stem._gainB : stem._gainA;

		// Start the next copy, fade it in, fade the previous out
		current.start();
		currentGain.gain.cancelScheduledValues(Tone.now());
		currentGain.gain.setValueAtTime(0, Tone.now());
		currentGain.gain.rampTo(1, cf);

		prevGain.gain.cancelScheduledValues(Tone.now());
		prevGain.gain.rampTo(0, cf);

		useA = !useA;
	}

	// Start the first copy immediately
	stem.player.start();
	stem._gainA.gain.value = 1;
	stem._gainB.gain.value = 0;

	// Schedule the crossfade cycle
	// First crossfade happens at (dur - cf), then every (dur - cf)
	const firstDelay = cycleDur;

	const scheduleLoop = () => {
		useA = false; // first scheduled start is B
		startNext();
	};

	// Use a repeating timeout chain instead of setInterval for drift resistance
	let timerId: ReturnType<typeof setTimeout>;
	function loop() {
		scheduleLoop();
		timerId = setTimeout(loop, cycleDur);
	}
	timerId = setTimeout(loop, firstDelay);

	stem.crossfadeTimer = timerId as unknown as ReturnType<typeof setInterval>;
}

function clearStems() {
	for (const [, stem] of stems) {
		try {
			if (stem.crossfadeTimer) clearInterval(stem.crossfadeTimer);
			stem.player.stop();
			stem.player.dispose();
			stem.playerB.stop();
			stem.playerB.dispose();
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

	// Start crossfade loops for all stems (silent), then fade in active ones
	for (const [name] of stems) {
		startCrossfadeLoop(name);
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
