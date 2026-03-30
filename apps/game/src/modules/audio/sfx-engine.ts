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

// ── Typing sound: mechanical keyboard click + thock ──

let typingIndex = 0;
let lastTypingTime = 0;

// Pre-generate a reusable noise buffer (1 second at sample rate)
let noiseBuffer: AudioBuffer | null = null;

function getNoiseBuffer(ac: AudioContext): AudioBuffer {
	if (noiseBuffer && noiseBuffer.sampleRate === ac.sampleRate) return noiseBuffer;
	const len = ac.sampleRate; // 1 second
	noiseBuffer = ac.createBuffer(1, len, ac.sampleRate);
	const data = noiseBuffer.getChannelData(0);
	for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
	return noiseBuffer;
}

export function playTyping(volume: number, muted: boolean) {
	const now = performance.now();
	if (now - lastTypingTime < 35) return; // debounce ~28/s max
	lastTypingTime = now;

	const gain = sliderToGain(volume, muted);
	if (gain === 0) return;

	const ac = getCtx();
	const t = ac.currentTime;
	typingIndex++;

	// Vary each keystroke slightly
	const pitch = 3000 + Math.random() * 2000; // 3-5kHz click center
	const thockPitch = 120 + Math.random() * 60; // 120-180Hz thock body
	const vol = gain * (0.10 + Math.random() * 0.04); // slight volume variation
	const duration = 0.02 + Math.random() * 0.01; // 20-30ms

	// Layer 1: high-frequency click (noise → highpass → bandpass → gain)
	const noiseSrc = ac.createBufferSource();
	noiseSrc.buffer = getNoiseBuffer(ac);
	// Random offset into noise buffer for variation
	noiseSrc.loopStart = Math.random() * 0.9;
	noiseSrc.loopEnd = noiseSrc.loopStart + 0.05;

	const hp = ac.createBiquadFilter();
	hp.type = "highpass";
	hp.frequency.value = 2000;

	const bp = ac.createBiquadFilter();
	bp.type = "bandpass";
	bp.frequency.value = pitch;
	bp.Q.value = 1.5;

	const clickGain = ac.createGain();
	clickGain.gain.setValueAtTime(vol, t);
	clickGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

	noiseSrc.connect(hp).connect(bp).connect(clickGain).connect(ac.destination);
	noiseSrc.start(t, noiseSrc.loopStart);
	noiseSrc.stop(t + duration + 0.01);

	// Layer 2: low "thock" body (damped sine)
	const thock = ac.createOscillator();
	thock.type = "sine";
	thock.frequency.setValueAtTime(thockPitch, t);
	thock.frequency.exponentialRampToValueAtTime(60, t + 0.04);

	const thockGain = ac.createGain();
	thockGain.gain.setValueAtTime(vol * 0.6, t);
	thockGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

	thock.connect(thockGain).connect(ac.destination);
	thock.start(t);
	thock.stop(t + 0.05);
}

// ── Execute sound: server processing burst ──

let lastExecTime = 0;

export function playExecute(volume: number, muted: boolean) {
	const now = performance.now();
	if (now - lastExecTime < 250) return; // max 4/s
	lastExecTime = now;

	const gain = sliderToGain(volume, muted);
	if (gain === 0) return;

	const ac = getCtx();
	const t = ac.currentTime;
	const vol = gain * 0.09;

	// Layer 1: electrical hum (60Hz + harmonic at 120Hz)
	const hum = ac.createOscillator();
	hum.type = "sine";
	hum.frequency.value = 60;

	const hum2 = ac.createOscillator();
	hum2.type = "sine";
	hum2.frequency.value = 120;

	const humGain = ac.createGain();
	humGain.gain.setValueAtTime(vol * 0.7, t);
	humGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

	const hum2Gain = ac.createGain();
	hum2Gain.gain.setValueAtTime(vol * 0.3, t);
	hum2Gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

	hum.connect(humGain).connect(ac.destination);
	hum2.connect(hum2Gain).connect(ac.destination);
	hum.start(t);
	hum.stop(t + 0.07);
	hum2.start(t);
	hum2.stop(t + 0.06);

	// Layer 2: high-frequency processing whir (filtered noise)
	const noiseSrc = ac.createBufferSource();
	noiseSrc.buffer = getNoiseBuffer(ac);
	noiseSrc.loopStart = Math.random() * 0.8;

	const whirBp = ac.createBiquadFilter();
	whirBp.type = "bandpass";
	whirBp.frequency.value = 2500 + Math.random() * 1500; // 2.5-4kHz
	whirBp.Q.value = 3;

	const whirGain = ac.createGain();
	whirGain.gain.setValueAtTime(0.001, t);
	whirGain.gain.linearRampToValueAtTime(vol * 0.5, t + 0.008);
	whirGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

	noiseSrc.connect(whirBp).connect(whirGain).connect(ac.destination);
	noiseSrc.start(t, noiseSrc.loopStart);
	noiseSrc.stop(t + 0.06);
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

// ── Endgame SFX ──

/** CRT power-down: high pitch sweeping to silence. */
export function playCrtDown(volume: number, muted: boolean) {
	const gain = sliderToGain(volume, muted);
	if (gain === 0) return;

	const ac = getCtx();
	const t = ac.currentTime;
	const dur = 0.7;

	const osc = ac.createOscillator();
	osc.type = "sine";
	osc.frequency.setValueAtTime(4000, t);
	osc.frequency.exponentialRampToValueAtTime(80, t + dur);

	const g = ac.createGain();
	g.gain.setValueAtTime(gain * 0.15, t);
	g.gain.exponentialRampToValueAtTime(0.001, t + dur);

	osc.connect(g).connect(ac.destination);
	osc.start(t);
	osc.stop(t + dur);
}

/** Digital boot hum: low drone fading in. */
export function playBootHum(volume: number, muted: boolean) {
	const gain = sliderToGain(volume, muted);
	if (gain === 0) return;

	const ac = getCtx();
	const t = ac.currentTime;
	const dur = 0.5;

	const osc = ac.createOscillator();
	osc.type = "sawtooth";
	osc.frequency.value = 60;

	const lp = ac.createBiquadFilter();
	lp.type = "lowpass";
	lp.frequency.value = 200;

	const g = ac.createGain();
	g.gain.setValueAtTime(0, t);
	g.gain.linearRampToValueAtTime(gain * 0.08, t + dur * 0.7);
	g.gain.exponentialRampToValueAtTime(0.001, t + dur);

	osc.connect(lp).connect(g).connect(ac.destination);
	osc.start(t);
	osc.stop(t + dur);
}

/** Terminal keystroke: metallic click, different from game typing. */
export function playTerminalKey(volume: number, muted: boolean) {
	const now = performance.now();
	if (now - lastTypingTime < 20) return;
	lastTypingTime = now;

	const gain = sliderToGain(volume, muted);
	if (gain === 0) return;

	const ac = getCtx();
	const t = ac.currentTime;

	// Short metallic ping
	const osc = ac.createOscillator();
	osc.type = "square";
	osc.frequency.value = 2000 + Math.random() * 800;

	const g = ac.createGain();
	g.gain.setValueAtTime(gain * 0.06, t);
	g.gain.exponentialRampToValueAtTime(0.001, t + 0.02);

	osc.connect(g).connect(ac.destination);
	osc.start(t);
	osc.stop(t + 0.02);
}

/** Glitchy error alarm: distorted buzz. */
export function playErrorAlarm(volume: number, muted: boolean) {
	const gain = sliderToGain(volume, muted);
	if (gain === 0) return;

	const ac = getCtx();
	const t = ac.currentTime;

	// Two detuned square waves for harsh buzz
	for (const freq of [150, 157]) {
		const osc = ac.createOscillator();
		osc.type = "square";
		osc.frequency.value = freq;

		const g = ac.createGain();
		g.gain.setValueAtTime(gain * 0.1, t);
		g.gain.setValueAtTime(gain * 0.1, t + 0.3);
		g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

		osc.connect(g).connect(ac.destination);
		osc.start(t);
		osc.stop(t + 0.5);
	}
}

/** Low dramatic drone swell — tension builder. */
export function playDroneSwell(volume: number, muted: boolean) {
	const gain = sliderToGain(volume, muted);
	if (gain === 0) return;

	const ac = getCtx();
	const t = ac.currentTime;
	const dur = 3;

	const osc = ac.createOscillator();
	osc.type = "sawtooth";
	osc.frequency.value = 55;

	const osc2 = ac.createOscillator();
	osc2.type = "sawtooth";
	osc2.frequency.value = 55.5; // slight detune for width

	const lp = ac.createBiquadFilter();
	lp.type = "lowpass";
	lp.frequency.setValueAtTime(100, t);
	lp.frequency.linearRampToValueAtTime(800, t + dur);

	const g = ac.createGain();
	g.gain.setValueAtTime(0, t);
	g.gain.linearRampToValueAtTime(gain * 0.12, t + dur * 0.8);
	g.gain.exponentialRampToValueAtTime(0.001, t + dur);

	osc.connect(lp);
	osc2.connect(lp);
	lp.connect(g).connect(ac.destination);
	osc.start(t);
	osc2.start(t);
	osc.stop(t + dur);
	osc2.stop(t + dur);
}

// ── Resume AudioContext after user gesture ──

export function resumeCtx() {
	if (ctx?.state === "suspended") ctx.resume();
}
