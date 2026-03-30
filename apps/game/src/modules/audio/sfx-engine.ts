let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
	if (!ctx) ctx = new AudioContext();
	return ctx;
}

/** Normalize 0-100 slider to 0-1 gain, applying a basic equal-power curve. */
function sliderToGain(volume: number, muted: boolean): number {
	if (muted) return 0;
	const normalized = Math.max(0, Math.min(100, volume)) / 100;
	return normalized * normalized; // simple perceptual curve
}

// ── Typing sound: short filtered noise burst, 20-40ms ──

const TYPING_VARIANTS = [800, 1000, 1200, 1400]; // bandpass center freqs
let typingIndex = 0;
let lastTypingTime = 0;

export function playTyping(volume: number, muted: boolean) {
	const now = performance.now();
	if (now - lastTypingTime < 40) return; // debounce at 25/s max
	lastTypingTime = now;

	const gain = sliderToGain(volume, muted);
	if (gain === 0) return;

	const ac = getCtx();
	const t = ac.currentTime;

	// White noise buffer (short)
	const bufferSize = Math.floor(ac.sampleRate * 0.03); // 30ms
	const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

	const src = ac.createBufferSource();
	src.buffer = buffer;

	const bp = ac.createBiquadFilter();
	bp.type = "bandpass";
	bp.frequency.value = TYPING_VARIANTS[typingIndex % TYPING_VARIANTS.length];
	bp.Q.value = 2;
	typingIndex++;

	const g = ac.createGain();
	g.gain.setValueAtTime(gain * 0.15, t);
	g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

	src.connect(bp).connect(g).connect(ac.destination);
	src.start(t);
	src.stop(t + 0.03);
}

// ── Execute sound: subtle digital tick ──

let lastExecTime = 0;

export function playExecute(volume: number, muted: boolean) {
	const now = performance.now();
	if (now - lastExecTime < 250) return; // max 4/s
	lastExecTime = now;

	const gain = sliderToGain(volume, muted);
	if (gain === 0) return;

	const ac = getCtx();
	const t = ac.currentTime;

	const osc = ac.createOscillator();
	osc.type = "sine";
	osc.frequency.value = 1200 + Math.random() * 400;

	const g = ac.createGain();
	g.gain.setValueAtTime(gain * 0.08, t);
	g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

	osc.connect(g).connect(ac.destination);
	osc.start(t);
	osc.stop(t + 0.04);
}

// ── Purchase sound: two-tone chip confirm ──

export function playPurchase(volume: number, muted: boolean) {
	const gain = sliderToGain(volume, muted);
	if (gain === 0) return;

	const ac = getCtx();
	const t = ac.currentTime;

	// Two quick ascending tones
	for (const [freq, offset] of [
		[880, 0],
		[1320, 0.08],
	] as const) {
		const osc = ac.createOscillator();
		osc.type = "square";
		osc.frequency.value = freq;

		const g = ac.createGain();
		g.gain.setValueAtTime(0, t + offset);
		g.gain.linearRampToValueAtTime(gain * 0.12, t + offset + 0.01);
		g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.12);

		osc.connect(g).connect(ac.destination);
		osc.start(t + offset);
		osc.stop(t + offset + 0.12);
	}
}

// ── Tier unlock: rising arpeggio ──

export function playTierUnlock(volume: number, muted: boolean) {
	const gain = sliderToGain(volume, muted);
	if (gain === 0) return;

	const ac = getCtx();
	const t = ac.currentTime;

	const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
	notes.forEach((freq, i) => {
		const offset = i * 0.1;

		const osc = ac.createOscillator();
		osc.type = "triangle";
		osc.frequency.value = freq;

		const g = ac.createGain();
		g.gain.setValueAtTime(0, t + offset);
		g.gain.linearRampToValueAtTime(gain * 0.18, t + offset + 0.02);
		g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.4);

		osc.connect(g).connect(ac.destination);
		osc.start(t + offset);
		osc.stop(t + offset + 0.4);
	});
}

// ── Milestone: notification chime ──

export function playMilestone(volume: number, muted: boolean) {
	const gain = sliderToGain(volume, muted);
	if (gain === 0) return;

	const ac = getCtx();
	const t = ac.currentTime;

	for (const [freq, offset] of [
		[1046.5, 0],
		[1318.5, 0.12],
	] as const) {
		const osc = ac.createOscillator();
		osc.type = "sine";
		osc.frequency.value = freq;

		const g = ac.createGain();
		g.gain.setValueAtTime(gain * 0.15, t + offset);
		g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.3);

		osc.connect(g).connect(ac.destination);
		osc.start(t + offset);
		osc.stop(t + offset + 0.3);
	}
}

// ── Event toast: alert ping ──

export function playEvent(volume: number, muted: boolean) {
	const gain = sliderToGain(volume, muted);
	if (gain === 0) return;

	const ac = getCtx();
	const t = ac.currentTime;

	const osc = ac.createOscillator();
	osc.type = "sine";
	osc.frequency.value = 660;

	const g = ac.createGain();
	g.gain.setValueAtTime(gain * 0.12, t);
	g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

	osc.connect(g).connect(ac.destination);
	osc.start(t);
	osc.stop(t + 0.2);
}

// ── Resume AudioContext after user gesture ──

export function resumeCtx() {
	if (ctx?.state === "suspended") ctx.resume();
}
