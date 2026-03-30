#!/usr/bin/env python3
"""Generate music stems inspired by HOME - "We're Finally Landing".

Key: D major, BPM: 90, 8-bar loop (~21.3s)
Chord progression: Dadd2 | Dadd2 | Em | Em | G | G | Gm | Gm
Each chord = 2 bars.

5 stems mapping to game tiers:
  T0: pad (brass pad, detuned saws, vibrato, heavy reverb)
  T1: arp (descending 32nd-note arpeggios, lowpassed saw)
  T2: bass (overdriven square, punchy pluck envelope)
  T3: drums (kick/snare/hats, sidechain-style pump)
  T4+: lead (square wave, highpassed, delay-drenched)

Output: apps/game/public/audio/stems/landing/{pad,arp,bass,drums,lead}.ogg
"""

import os
import subprocess
import tempfile

import numpy as np
from scipy.io import wavfile
from scipy.signal import lfilter

SAMPLE_RATE = 44100
BPM = 90
BEAT = 60 / BPM  # ~0.667s
BAR = BEAT * 4    # ~2.667s
DURATION = BAR * 8  # ~21.33s (one full cycle)
N_SAMPLES = int(DURATION * SAMPLE_RATE)

OUT_DIR = os.path.join(
    os.path.dirname(__file__), "..", "apps", "game", "public", "audio", "stems", "landing"
)

# ── Note frequencies ──

NOTE_FREQS = {}
for octave in range(1, 7):
    for name, semitone in [
        ("C", 0), ("Db", 1), ("D", 2), ("Eb", 3), ("E", 4), ("F", 5),
        ("Gb", 6), ("G", 7), ("Ab", 8), ("A", 9), ("Bb", 10), ("B", 11),
    ]:
        midi = (octave + 1) * 12 + semitone
        NOTE_FREQS[f"{name}{octave}"] = 440.0 * (2 ** ((midi - 69) / 12))


def nf(name):
    return NOTE_FREQS[name]


def t_array():
    return np.linspace(0, DURATION, N_SAMPLES, endpoint=False)


def sine(freq, t, amp=1.0):
    return amp * np.sin(2 * np.pi * freq * t)


def saw_bl(freq, t, amp=1.0, harmonics=12):
    """Band-limited sawtooth."""
    out = np.zeros_like(t)
    for k in range(1, harmonics + 1):
        out += ((-1) ** (k + 1)) * np.sin(2 * np.pi * k * freq * t) / k
    return amp * out * (2 / np.pi)


def square_bl(freq, t, amp=1.0, harmonics=8):
    """Band-limited square wave."""
    out = np.zeros_like(t)
    for k in range(1, harmonics + 1, 2):  # odd harmonics only
        out += np.sin(2 * np.pi * k * freq * t) / k
    return amp * out * (4 / np.pi)


def lowpass_1pole(signal, cutoff, sr=SAMPLE_RATE):
    rc = 1.0 / (2 * np.pi * cutoff)
    dt = 1.0 / sr
    alpha = dt / (rc + dt)
    b = [alpha]
    a = [1, -(1 - alpha)]
    return lfilter(b, a, signal)


def highpass_1pole(signal, cutoff, sr=SAMPLE_RATE):
    return signal - lowpass_1pole(signal, cutoff, sr)


def simple_reverb(signal, decay=0.4, delays_ms=(23, 37, 53, 71, 97), sr=SAMPLE_RATE):
    """Simple multi-tap delay reverb."""
    out = signal.copy()
    for d_ms in delays_ms:
        n = int(d_ms / 1000 * sr)
        delayed = np.zeros_like(signal)
        delayed[n:] = signal[:-n] if n < len(signal) else 0
        out += delayed * decay
        decay *= 0.7
    return out


def delay_effect(signal, beat_frac=0.75, feedback=0.35, wet=0.3, sr=SAMPLE_RATE):
    """Tempo-synced delay (dotted eighth by default)."""
    delay_samples = int(BEAT * beat_frac * sr)
    out = signal.copy()
    delayed = np.zeros_like(signal)
    for i in range(delay_samples, len(signal)):
        delayed[i] = signal[i - delay_samples] + delayed[i - delay_samples] * feedback
    return out * (1 - wet) + delayed * wet


def soft_clip(signal, drive=2.0):
    """Soft-clipping waveshaper."""
    return np.tanh(signal * drive) / np.tanh(drive)


def env_ad(n, attack_s=0.01, decay_s=0.3, sr=SAMPLE_RATE):
    """Attack-decay envelope."""
    env = np.ones(n)
    a_n = int(attack_s * sr)
    if a_n > 0 and a_n < n:
        env[:a_n] = np.linspace(0, 1, a_n)
    d_start = a_n
    if d_start < n:
        t_d = np.arange(n - d_start) / sr
        env[d_start:] = np.exp(-t_d / decay_s)
    return env


# ── Chord definitions ──
# Dadd2 = D E F# A, Em = E G B, G = G B D, Gm = G Bb D (E on top for Gm6)

CHORDS = [
    # Each entry: (chord_notes_mid_register, root_bass, bar_start)
    (["D3", "E3", "A3", "D4"], "D2", 0),   # Dadd2 bars 1-2
    (["D3", "E3", "A3", "D4"], "D2", 2),   # Dadd2 bars 3-4 (repeated)
    (["E3", "G3", "B3", "E4"], "E2", 2),   # Em bars 3-4
    (["E3", "G3", "B3", "E4"], "E2", 4),   # Em bars 5-6 (actually 3-4)
    (["G3", "B3", "D4", "G4"], "G2", 4),   # G bars 5-6
    (["G3", "B3", "D4", "G4"], "G2", 6),   # G bars 7-8 (actually 5-6)
    (["G3", "Bb3", "D4", "E4"], "G2", 6),  # Gm6 bars 7-8
]

# Corrected: each chord lasts 2 bars
CHORD_SEQ = [
    (["D3", "E3", "A3", "D4"], "D2", 0),    # Dadd2, bars 0-1
    (["E3", "G3", "B3", "E4"], "E2", 2),    # Em, bars 2-3
    (["G3", "B3", "D4", "G4"], "G2", 4),    # G, bars 4-5
    (["G3", "Bb3", "D4", "E4"], "G2", 6),   # Gm6, bars 6-7
]

# Arp patterns: descending notes for each chord (2 octaves)
ARP_NOTES = {
    0: ["D5", "A4", "E4", "D4", "A3", "E3", "D3", "A2"],     # Dadd2
    2: ["E5", "B4", "G4", "E4", "B3", "G3", "E3", "B2"],     # Em
    4: ["G5", "D5", "B4", "G4", "D4", "B3", "G3", "D3"],     # G
    6: ["E5", "D5", "Bb4", "G4", "E4", "D4", "Bb3", "G3"],   # Gm6
}

# Lead melody (simplified, one note per beat roughly)
LEAD_MELODY = [
    # bar 0-1 (Dadd2): float on the chord
    ("D5", 0, 1.5), ("E5", 1.5, 1), ("A4", 2.5, 1.5),
    # bar 2-3 (Em): step down
    ("G4", 4, 1.5), ("B4", 5.5, 1), ("E5", 6.5, 2),
    # bar 4-5 (G): soar
    ("D5", 8, 2), ("B4", 10, 1), ("G4", 11, 1),
    # bar 6-7 (Gm6): the emotional turn
    ("Bb4", 12, 2), ("D5", 14, 1), ("E5", 15, 1.5), ("D5", 16.5, 2),
    # resolve back
    ("A4", 18.5, 1.5), ("D5", 20, 1),
]


def generate_pad():
    """Detuned saw pad with vibrato and heavy reverb. Dreamy brass synth."""
    out = np.zeros(N_SAMPLES)

    for notes, _, bar_start in CHORD_SEQ:
        start = int(bar_start * BAR * SAMPLE_RATE)
        dur = int(2 * BAR * SAMPLE_RATE)
        end = min(start + dur, N_SAMPLES)
        n = end - start
        t_local = np.linspace(0, n / SAMPLE_RATE, n, endpoint=False)

        chord_sig = np.zeros(n)
        for note_name in notes:
            freq = nf(note_name)
            # Two detuned oscillators (+10 cents apart)
            detune_factor = 2 ** (10 / 1200)  # 10 cents
            # Slow vibrato LFO at ~2.5 Hz
            vibrato = 1 + 0.004 * np.sin(2 * np.pi * 2.5 * t_local)
            osc1 = saw_bl(freq * vibrato, t_local, 0.08)
            osc2 = saw_bl(freq * detune_factor * vibrato, t_local, 0.08)
            chord_sig += osc1 + osc2

        # Slow attack/release for pad character
        env = np.ones(n)
        att = int(0.3 * SAMPLE_RATE)
        rel = int(0.5 * SAMPLE_RATE)
        if att < n:
            env[:att] = np.linspace(0, 1, att)
        if rel < n:
            env[-rel:] = np.linspace(1, 0.3, rel)

        chord_sig *= env
        out[start:end] += chord_sig

    # Heavy lowpass for warmth
    out = lowpass_1pole(out, 3000)
    # Heavy reverb
    out = simple_reverb(out, decay=0.5, delays_ms=(31, 53, 79, 113, 157))
    # Delay
    out = delay_effect(out, beat_frac=0.5, feedback=0.25, wet=0.2)

    return out * 0.6


def generate_arp():
    """Descending 32nd-note arpeggios, lowpassed sawtooth."""
    out = np.zeros(N_SAMPLES)
    note_dur = BEAT / 8  # 32nd note

    for bar_start, notes in ARP_NOTES.items():
        section_start = bar_start * BAR
        # Play for 2 bars
        total_beats = 8
        t_pos = section_start

        while t_pos < section_start + 2 * BAR and t_pos < DURATION:
            for note_name in notes:
                if t_pos >= section_start + 2 * BAR or t_pos >= DURATION:
                    break
                freq = nf(note_name)
                start_idx = int(t_pos * SAMPLE_RATE)
                n = int(note_dur * SAMPLE_RATE)
                end_idx = min(start_idx + n, N_SAMPLES)
                actual_n = end_idx - start_idx
                if actual_n <= 0:
                    t_pos += note_dur
                    continue

                t_local = np.linspace(0, actual_n / SAMPLE_RATE, actual_n, endpoint=False)
                note_sig = saw_bl(freq, t_local, 0.12, harmonics=6)
                note_sig *= env_ad(actual_n, attack_s=0.002, decay_s=note_dur * 0.8)
                out[start_idx:end_idx] += note_sig
                t_pos += note_dur

    # Lowpass at ~2500 Hz
    out = lowpass_1pole(out, 2500)
    # Light reverb
    out = simple_reverb(out, decay=0.3, delays_ms=(23, 41, 67))
    # Delay (dotted eighth feel)
    out = delay_effect(out, beat_frac=0.75, feedback=0.3, wet=0.25)

    return out * 0.45


def generate_bass():
    """Overdriven square bass with punchy pluck envelope."""
    out = np.zeros(N_SAMPLES)

    for _, root, bar_start in CHORD_SEQ:
        freq = nf(root)
        section_start = int(bar_start * BAR * SAMPLE_RATE)

        # Play root on every beat (4 beats per bar, 2 bars)
        for beat in range(8):
            beat_start = section_start + int(beat * BEAT * SAMPLE_RATE)
            n = int(BEAT * 0.8 * SAMPLE_RATE)
            end = min(beat_start + n, N_SAMPLES)
            actual_n = end - beat_start
            if actual_n <= 0:
                continue

            t_local = np.linspace(0, actual_n / SAMPLE_RATE, actual_n, endpoint=False)

            # Square wave bass with octave layering
            bass_sig = square_bl(freq, t_local, 0.3, harmonics=4)
            bass_sig += square_bl(freq * 2, t_local, 0.1, harmonics=3)

            # Punchy pluck envelope (fast attack, medium decay)
            bass_sig *= env_ad(actual_n, attack_s=0.005, decay_s=0.25)

            # Overdrive
            bass_sig = soft_clip(bass_sig, drive=3.0)

            out[beat_start:end] += bass_sig

    # Lowpass to tame harsh harmonics
    out = lowpass_1pole(out, 1200)

    return out * 0.55


def generate_drums():
    """Kick/snare/hat pattern with sidechain-style amplitude pumping baked in."""
    out = np.zeros(N_SAMPLES)
    rng = np.random.default_rng(42)

    for bar in range(8):
        bar_start = int(bar * BAR * SAMPLE_RATE)

        for beat in range(4):
            beat_start = bar_start + int(beat * BEAT * SAMPLE_RATE)

            # Kick on every beat (4-on-the-floor)
            n = int(0.18 * SAMPLE_RATE)
            t_local = np.linspace(0, 0.18, n, endpoint=False)
            # Pitch-dropping sine (150Hz -> 45Hz) + click
            freq_sweep = 150 * np.exp(-t_local * 18) + 45
            phase = np.cumsum(freq_sweep / SAMPLE_RATE) * 2 * np.pi
            kick = np.sin(phase) * 0.6 * np.exp(-t_local * 12)
            # Add click transient
            click_n = min(int(0.005 * SAMPLE_RATE), n)
            kick[:click_n] += rng.normal(0, 0.15, click_n) * np.exp(-np.linspace(0, 5, click_n))
            end = min(beat_start + n, N_SAMPLES)
            out[beat_start:end] += kick[:end - beat_start]

            # Snare on beats 2 and 4
            if beat in (1, 3):
                n = int(0.15 * SAMPLE_RATE)
                t_local = np.linspace(0, 0.15, n, endpoint=False)
                snare_body = sine(180, t_local, 0.25) * np.exp(-t_local * 20)
                snare_noise = rng.normal(0, 0.2, n) * np.exp(-t_local * 18)
                snare = soft_clip(snare_body + snare_noise, drive=1.5)
                end = min(beat_start + n, N_SAMPLES)
                out[beat_start:end] += snare[:end - beat_start]

            # Hi-hats on 16th notes
            for sixteenth in range(4):
                hh_start = beat_start + int(sixteenth * BEAT * 0.25 * SAMPLE_RATE)
                n = int(0.04 * SAMPLE_RATE)
                t_local = np.linspace(0, 0.04, n, endpoint=False)
                vel = 0.08 if sixteenth == 0 else 0.04
                hh = rng.normal(0, vel, n) * np.exp(-t_local * 50)
                # Highpass the hat
                hh = highpass_1pole(hh, 6000)
                end = min(hh_start + n, N_SAMPLES)
                out[hh_start:end] += hh[:end - hh_start]

    return out * 0.7


def generate_lead():
    """Square wave lead, highpassed, drenched in delay and reverb."""
    out = np.zeros(N_SAMPLES)

    for note_name, beat_start, beat_dur in LEAD_MELODY:
        freq = nf(note_name)
        start = int(beat_start * BEAT * SAMPLE_RATE)
        n = int(beat_dur * BEAT * SAMPLE_RATE)
        end = min(start + n, N_SAMPLES)
        actual_n = end - start
        if actual_n <= 0:
            continue

        t_local = np.linspace(0, actual_n / SAMPLE_RATE, actual_n, endpoint=False)

        # Square wave with slight vibrato
        vibrato = 1 + 0.003 * np.sin(2 * np.pi * 4 * t_local)
        lead_sig = square_bl(freq * vibrato, t_local, 0.2, harmonics=5)

        # Envelope
        lead_sig *= env_ad(actual_n, attack_s=0.03, decay_s=beat_dur * BEAT * 0.7)

        out[start:end] += lead_sig

    # Highpass at ~970 Hz (makes it airy)
    out = highpass_1pole(out, 970)
    # Heavy delay
    out = delay_effect(out, beat_frac=0.75, feedback=0.4, wet=0.45)
    # Heavy reverb
    out = simple_reverb(out, decay=0.5, delays_ms=(37, 67, 101, 149, 199))

    return out * 0.4


def normalize(audio, peak=0.8):
    mx = np.max(np.abs(audio))
    if mx > 0:
        audio = audio * (peak / mx)
    return audio


def save_ogg(name, audio, subdir="landing"):
    audio = normalize(audio)
    audio_16 = (audio * 32767).astype(np.int16)

    out_dir = os.path.join(
        os.path.dirname(__file__), "..", "apps", "game", "public", "audio", "stems", subdir
    )
    os.makedirs(out_dir, exist_ok=True)
    ogg_path = os.path.join(out_dir, f"{name}.ogg")

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = tmp.name
        wavfile.write(wav_path, SAMPLE_RATE, audio_16)

    subprocess.run(
        ["ffmpeg", "-y", "-i", wav_path, "-c:a", "libvorbis", "-q:a", "5", ogg_path],
        capture_output=True,
    )
    os.unlink(wav_path)
    size_kb = os.path.getsize(ogg_path) / 1024
    print(f"  {name}.ogg — {size_kb:.0f} KB")


def main():
    print('Generating "We\'re Finally Landing" inspired stems')
    print(f"D major, {BPM} BPM, 8 bars ({DURATION:.1f}s loop)\n")

    stems = {
        "pad": generate_pad,
        "arp": generate_arp,
        "bass": generate_bass,
        "drums": generate_drums,
        "lead": generate_lead,
    }

    for name, gen_fn in stems.items():
        audio = gen_fn()
        save_ogg(name, audio, subdir="landing")

    # Also generate a "keys" alias that maps to pad, and "glitch" that maps to lead
    # so the 6-stem engine can load them (bass, keys, drums, pad, lead, glitch)
    # Actually, let's just generate the 5 stems and update the engine to support this set

    print(f"\nDone! Stems saved to landing/")
    print("\nStem → Tier mapping:")
    print("  T0: pad (dreamy brass synth)")
    print("  T1: pad + arp (sparkling arpeggios)")
    print("  T2: pad + arp + bass (punchy foundation)")
    print("  T3: pad + arp + bass + drums (the drop)")
    print("  T4+: pad + arp + bass + drums + lead (full arrangement)")


if __name__ == "__main__":
    main()
