#!/usr/bin/env python3
"""Generate music stems: nostalgic synthwave inspired by HOME's layering approach.

Original composition in C major, 85 BPM, 8-bar loop (~22.6s).
Chord progression: Cadd9 | Cadd9 | Am7 | Am7 | Fmaj7 | Fmaj7 | Fm | Fm
The IV→iv (F→Fm) borrowed chord creates bittersweet nostalgia.

5 stems mapping to game tiers:
  T0: pad (detuned saws, lush, wide)
  T1: pad + arp (ascending arpeggios, bright)
  T2: pad + arp + bass (warm sub bass, half-time feel)
  T3: pad + arp + bass + drums (kick/snare/hats, groove)
  T4+: all + lead (airy square melody, delay-drenched)

Output: apps/game/public/audio/stems/landing/*.ogg
"""

import os
import subprocess
import tempfile

import numpy as np
from scipy.io import wavfile
from scipy.signal import lfilter

SAMPLE_RATE = 44100
BPM = 85
BEAT = 60 / BPM
BAR = BEAT * 4
DURATION = BAR * 8
N_SAMPLES = int(DURATION * SAMPLE_RATE)

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
    out = np.zeros_like(t)
    for k in range(1, harmonics + 1):
        out += ((-1) ** (k + 1)) * np.sin(2 * np.pi * k * freq * t) / k
    return amp * out * (2 / np.pi)


def square_bl(freq, t, amp=1.0, harmonics=8):
    out = np.zeros_like(t)
    for k in range(1, harmonics + 1, 2):
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


def simple_reverb(signal, decay=0.4, delays_ms=(23, 37, 53, 71, 97)):
    out = signal.copy()
    for d_ms in delays_ms:
        n = int(d_ms / 1000 * SAMPLE_RATE)
        delayed = np.zeros_like(signal)
        if n < len(signal):
            delayed[n:] = signal[:-n]
        out += delayed * decay
        decay *= 0.7
    return out


def delay_effect(signal, beat_frac=0.75, feedback=0.35, wet=0.3):
    delay_samples = int(BEAT * beat_frac * SAMPLE_RATE)
    out = signal.copy()
    delayed = np.zeros_like(signal)
    for i in range(delay_samples, len(signal)):
        delayed[i] = signal[i - delay_samples] + delayed[i - delay_samples] * feedback
    return out * (1 - wet) + delayed * wet


def soft_clip(signal, drive=2.0):
    return np.tanh(signal * drive) / np.tanh(drive)


def env_ad(n, attack_s=0.01, decay_s=0.3):
    env = np.ones(n)
    a_n = int(attack_s * SAMPLE_RATE)
    if a_n > 0 and a_n < n:
        env[:a_n] = np.linspace(0, 1, a_n)
    d_start = a_n
    if d_start < n:
        t_d = np.arange(n - d_start) / SAMPLE_RATE
        env[d_start:] = np.exp(-t_d / decay_s)
    return env


# ── Chord progression: Cadd9 | Am7 | Fmaj7 | Fm ──
# Each chord = 2 bars

CHORD_SEQ = [
    # Cadd9: C D E G (open, airy)
    (["C3", "D3", "E3", "G3", "C4"], "C2", 0),
    # Am7: A C E G (melancholic)
    (["A2", "C3", "E3", "G3", "A3"], "A1", 2),
    # Fmaj7: F A C E (warm, bright)
    (["F3", "A3", "C4", "E4"], "F2", 4),
    # Fm: F Ab C (the gut-punch — borrowed iv from C minor)
    (["F3", "Ab3", "C4", "F4"], "F2", 6),
]

# Arp: ascending patterns through chord tones (2 octaves)
ARP_NOTES = {
    0: ["C3", "D3", "E3", "G3", "C4", "D4", "E4", "G4"],       # Cadd9
    2: ["A2", "C3", "E3", "G3", "A3", "C4", "E4", "G4"],       # Am7
    4: ["F3", "A3", "C4", "E4", "F4", "A4", "C5", "E5"],       # Fmaj7
    6: ["F3", "Ab3", "C4", "F4", "Ab4", "C5", "F5", "Ab5"],    # Fm
}

# Original lead melody — pentatonic-ish, lives in C major, drops to minor for Fm
LEAD_MELODY = [
    # Cadd9 section: gentle, floating
    ("E4", 0, 2), ("G4", 2, 1.5), ("C5", 3.5, 1),
    # Am7: descending, wistful
    ("B4", 5, 1.5), ("A4", 6.5, 1), ("G4", 7.5, 2),
    # Fmaj7: rising hope
    ("A4", 10, 1.5), ("C5", 11.5, 1), ("E5", 12.5, 2),
    # Fm: the turn — Ab is the minor color
    ("C5", 15, 1), ("Ab4", 16, 2), ("F4", 18, 1.5), ("G4", 19.5, 1.5),
    # Resolve hint
    ("E4", 21, 1.5), ("C4", 22.5, 1),
]


def generate_pad():
    """Lush detuned saw pad. No vibrato — just width from detuning."""
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
            # Two detuned oscillators (+8 cents) — width, no wobble
            detune = 2 ** (8 / 1200)
            osc1 = saw_bl(freq * 0.999, t_local, 0.10, harmonics=10)
            osc2 = saw_bl(freq * detune, t_local, 0.10, harmonics=10)
            chord_sig += osc1 + osc2

        # Gentle attack/release
        env = np.ones(n)
        att = int(0.4 * SAMPLE_RATE)
        rel = int(0.6 * SAMPLE_RATE)
        if att < n:
            env[:att] = np.linspace(0, 1, att)
        if rel < n:
            env[-rel:] = np.linspace(1, 0.2, rel)

        chord_sig *= env
        out[start:end] += chord_sig

    # Gentle high-end taming only
    out = lowpass_1pole(out, 7000)
    # Spacious reverb
    out = simple_reverb(out, decay=0.35, delays_ms=(29, 47, 73, 109, 151))
    # Subtle delay
    out = delay_effect(out, beat_frac=0.5, feedback=0.15, wet=0.12)

    return out * 0.65


def generate_arp():
    """Ascending arpeggios, lowpassed saw, bright and sparkling."""
    out = np.zeros(N_SAMPLES)
    note_dur = BEAT / 6  # sextuplets — slightly different rhythm feel than 32nds

    for bar_start, notes in ARP_NOTES.items():
        section_start = bar_start * BAR
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
                note_sig = saw_bl(freq, t_local, 0.10, harmonics=6)
                note_sig *= env_ad(actual_n, attack_s=0.003, decay_s=note_dur * 0.7)
                out[start_idx:end_idx] += note_sig
                t_pos += note_dur

    out = lowpass_1pole(out, 3000)
    out = simple_reverb(out, decay=0.3, delays_ms=(19, 37, 59))
    out = delay_effect(out, beat_frac=0.75, feedback=0.3, wet=0.25)

    return out * 0.4


def generate_bass():
    """Warm sub bass with gentle pluck. Half-time feel (beats 1 and 3)."""
    out = np.zeros(N_SAMPLES)

    for _, root, bar_start in CHORD_SEQ:
        freq = nf(root)
        section_start = int(bar_start * BAR * SAMPLE_RATE)

        # Half-time: beats 1 and 3 only (per bar)
        for bar_offset in range(2):
            bar_abs_start = section_start + int(bar_offset * BAR * SAMPLE_RATE)
            for beat in [0, 2]:
                beat_start = bar_abs_start + int(beat * BEAT * SAMPLE_RATE)
                n = int(BEAT * 1.6 * SAMPLE_RATE)
                end = min(beat_start + n, N_SAMPLES)
                actual_n = end - beat_start
                if actual_n <= 0:
                    continue

                t_local = np.linspace(0, actual_n / SAMPLE_RATE, actual_n, endpoint=False)
                # Sub sine + octave sine for warmth
                bass_sig = sine(freq, t_local, 0.35)
                bass_sig += sine(freq * 2, t_local, 0.12)
                bass_sig *= env_ad(actual_n, attack_s=0.01, decay_s=0.6)
                bass_sig = soft_clip(bass_sig, drive=1.5)
                out[beat_start:end] += bass_sig

    out = lowpass_1pole(out, 500)
    return out * 0.6


def generate_drums():
    """Laid-back groove. Kick on 1/3, snare on 2/4, hats on 8ths."""
    out = np.zeros(N_SAMPLES)
    rng = np.random.default_rng(42)

    for bar in range(8):
        bar_start = int(bar * BAR * SAMPLE_RATE)

        for beat in range(4):
            beat_start = bar_start + int(beat * BEAT * SAMPLE_RATE)

            # Kick on 1 and 3
            if beat in (0, 2):
                n = int(0.18 * SAMPLE_RATE)
                t_local = np.linspace(0, 0.18, n, endpoint=False)
                freq_sweep = 140 * np.exp(-t_local * 16) + 42
                phase = np.cumsum(freq_sweep / SAMPLE_RATE) * 2 * np.pi
                kick = np.sin(phase) * 0.55 * np.exp(-t_local * 10)
                click_n = min(int(0.004 * SAMPLE_RATE), n)
                kick[:click_n] += rng.normal(0, 0.1, click_n) * np.exp(-np.linspace(0, 5, click_n))
                end = min(beat_start + n, N_SAMPLES)
                out[beat_start:end] += kick[:end - beat_start]

            # Snare on 2 and 4
            if beat in (1, 3):
                n = int(0.14 * SAMPLE_RATE)
                t_local = np.linspace(0, 0.14, n, endpoint=False)
                body = sine(190, t_local, 0.2) * np.exp(-t_local * 22)
                noise = rng.normal(0, 0.18, n) * np.exp(-t_local * 16)
                snare = soft_clip(body + noise, drive=1.3)
                end = min(beat_start + n, N_SAMPLES)
                out[beat_start:end] += snare[:end - beat_start]

            # Hats on 8th notes
            for eighth in range(2):
                hh_start = beat_start + int(eighth * BEAT * 0.5 * SAMPLE_RATE)
                n = int(0.035 * SAMPLE_RATE)
                t_local = np.linspace(0, 0.035, n, endpoint=False)
                vel = 0.07 if eighth == 0 else 0.035
                hh = rng.normal(0, vel, n) * np.exp(-t_local * 45)
                hh = highpass_1pole(hh, 7000)
                end = min(hh_start + n, N_SAMPLES)
                out[hh_start:end] += hh[:end - hh_start]

    return out * 0.65


def generate_lead():
    """Airy square lead, highpassed, drenched in delay/reverb."""
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
        lead_sig = square_bl(freq, t_local, 0.18, harmonics=5)
        lead_sig += sine(freq * 2, t_local, 0.04)  # gentle overtone
        lead_sig *= env_ad(actual_n, attack_s=0.04, decay_s=beat_dur * BEAT * 0.6)
        out[start:end] += lead_sig

    out = highpass_1pole(out, 900)
    out = delay_effect(out, beat_frac=0.75, feedback=0.4, wet=0.4)
    out = simple_reverb(out, decay=0.45, delays_ms=(31, 59, 97, 139, 191))

    return out * 0.38


def normalize(audio, peak=0.8):
    mx = np.max(np.abs(audio))
    if mx > 0:
        audio = audio * (peak / mx)
    return audio


def save_ogg(name, audio):
    audio = normalize(audio)
    audio_16 = (audio * 32767).astype(np.int16)

    out_dir = os.path.join(
        os.path.dirname(__file__), "..", "apps", "game", "public", "audio", "stems", "landing"
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
    print(f"Generating original synthwave stems")
    print(f"C major, {BPM} BPM, 8 bars ({DURATION:.1f}s loop)")
    print(f"Progression: Cadd9 → Am7 → Fmaj7 → Fm\n")

    stems = {
        "pad": generate_pad,
        "arp": generate_arp,
        "bass": generate_bass,
        "drums": generate_drums,
        "lead": generate_lead,
    }

    for name, gen_fn in stems.items():
        audio = gen_fn()
        save_ogg(name, audio)

    print(f"\nDone!")
    print(f"\nTier mapping:")
    print(f"  T0: pad (lush detuned saws)")
    print(f"  T1: + arp (ascending sextuplet arpeggios)")
    print(f"  T2: + bass (warm sub, half-time)")
    print(f"  T3: + drums (laid-back groove)")
    print(f"  T4+: + lead (airy square, delay-drenched)")


if __name__ == "__main__":
    main()
