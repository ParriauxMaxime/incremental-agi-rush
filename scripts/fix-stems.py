#!/usr/bin/env python3
"""
Fix audio stem loop points by detecting and compensating for fade-outs.

For each OGG stem:
1. Decode to raw PCM
2. Compute RMS envelope to detect fade-out
3. Apply inverse gain to compensate (lift the fade-out back to full volume)
4. Apply a tiny crossfade at the loop boundary
5. Re-encode to OGG

Usage: python3 scripts/fix-stems.py
"""

import os
import sys
import numpy as np
import soundfile as sf
from scipy.signal import medfilt

STEM_DIR = os.path.join(os.path.dirname(__file__), "..", "apps", "game", "public", "audio", "stems", "ferreira")
BACKUP_DIR = os.path.join(STEM_DIR, "backup")

# How many seconds at the end to analyze for fade-out
ANALYSIS_WINDOW_SEC = 3.0
# RMS window for envelope detection (seconds)
RMS_WINDOW_SEC = 0.05
# Crossfade at loop boundary (seconds)
CROSSFADE_SEC = 0.03
# Only fix stems where end RMS is below this ratio of mid RMS
FADE_THRESHOLD = 0.7


def compute_rms_envelope(data, window_samples):
    """Compute RMS envelope of audio data."""
    # Mono: average channels if stereo
    if data.ndim > 1:
        mono = np.mean(data, axis=1)
    else:
        mono = data

    # Pad for window
    padded = np.pad(mono, (window_samples // 2, window_samples // 2), mode='reflect')

    # Rolling RMS
    rms = np.zeros(len(mono))
    cumsum = np.cumsum(padded ** 2)
    rms = np.sqrt((cumsum[window_samples:] - cumsum[:-window_samples]) / window_samples)

    return rms[:len(mono)]


def detect_fade_out(rms_envelope, sr, analysis_window_sec):
    """
    Detect if there's a fade-out in the last N seconds.
    Returns (fade_start_sample, fade_ratio) or None if no significant fade.
    """
    analysis_samples = int(analysis_window_sec * sr)
    if len(rms_envelope) < analysis_samples * 2:
        return None

    # Compare end region to mid region
    mid_start = len(rms_envelope) // 3
    mid_end = 2 * len(rms_envelope) // 3
    mid_rms = np.median(rms_envelope[mid_start:mid_end])

    if mid_rms < 1e-6:
        return None

    # Find where the fade starts (where RMS drops below threshold of mid)
    end_region = rms_envelope[-analysis_samples:]
    end_rms = np.median(end_region[-int(0.1 * sr):])  # last 100ms

    ratio = end_rms / mid_rms
    if ratio > FADE_THRESHOLD:
        return None  # No significant fade

    # Find the fade start point
    threshold = mid_rms * 0.9
    fade_start = len(rms_envelope) - analysis_samples
    for i in range(len(rms_envelope) - analysis_samples, len(rms_envelope)):
        if rms_envelope[i] < threshold:
            fade_start = i
            break

    return (fade_start, ratio)


def compensate_fade(data, sr, rms_envelope, fade_start):
    """
    Apply inverse gain to compensate for fade-out.
    Boosts the faded region back to the median level.
    """
    mid_start = len(rms_envelope) // 3
    mid_end = 2 * len(rms_envelope) // 3
    target_rms = np.median(rms_envelope[mid_start:mid_end])

    if target_rms < 1e-6:
        return data

    result = data.copy()

    # Smooth the RMS envelope to avoid amplifying noise
    smooth_window = int(0.1 * sr)
    if smooth_window % 2 == 0:
        smooth_window += 1
    smoothed = medfilt(rms_envelope, smooth_window)

    # Apply gain from fade_start to end
    for i in range(fade_start, len(smoothed)):
        if smoothed[i] < 1e-6:
            gain = 1.0
        else:
            gain = min(target_rms / smoothed[i], 4.0)  # cap at 4x to avoid noise amplification

        # Smooth the gain transition
        if i < fade_start + int(0.1 * sr):
            # Ramp in the gain over 100ms
            t = (i - fade_start) / (0.1 * sr)
            gain = 1.0 + (gain - 1.0) * t

        if data.ndim > 1:
            result[i, :] *= gain
        else:
            result[i] *= gain

    return result


def apply_loop_crossfade(data, sr, crossfade_sec):
    """
    Apply a Hann crossfade at the loop boundary (end blends into start).
    """
    fade_samples = min(int(crossfade_sec * sr), len(data) // 8)
    if fade_samples < 2:
        return data

    result = data.copy()

    for i in range(fade_samples):
        t = i / fade_samples
        w = 0.5 * (1 - np.cos(np.pi * t))

        if result.ndim > 1:
            for ch in range(result.shape[1]):
                start_val = result[i, ch]
                end_val = result[-fade_samples + i, ch]
                result[i, ch] = start_val * w + end_val * (1 - w)
                result[-fade_samples + i, ch] = end_val * w + start_val * (1 - w)
        else:
            start_val = result[i]
            end_val = result[-fade_samples + i]
            result[i] = start_val * w + end_val * (1 - w)
            result[-fade_samples + i] = end_val * w + start_val * (1 - w)

    return result


def process_stem(filepath):
    """Process a single stem file."""
    name = os.path.basename(filepath)
    print(f"\n{'='*60}")
    print(f"Processing: {name}")

    # Read
    data, sr = sf.read(filepath)
    duration = len(data) / sr
    print(f"  Duration: {duration:.2f}s, Sample rate: {sr}Hz, Channels: {data.ndim}")

    # Compute RMS envelope
    window_samples = max(1, int(RMS_WINDOW_SEC * sr))
    rms = compute_rms_envelope(data, window_samples)

    # Report RMS at key points
    mid_rms = np.median(rms[len(rms)//3 : 2*len(rms)//3])
    end_rms = np.median(rms[-int(0.1*sr):])
    start_rms = np.median(rms[:int(0.1*sr)])

    print(f"  RMS: start={start_rms:.4f}  mid={mid_rms:.4f}  end={end_rms:.4f}")
    if mid_rms > 1e-6:
        print(f"  End/Mid ratio: {end_rms/mid_rms:.1%}")

    # Detect fade
    fade_info = detect_fade_out(rms, sr, ANALYSIS_WINDOW_SEC)

    if fade_info is None:
        print(f"  ✓ No significant fade-out detected")
        # Still apply loop crossfade
        result = apply_loop_crossfade(data, sr, CROSSFADE_SEC)
    else:
        fade_start, ratio = fade_info
        fade_time = fade_start / sr
        print(f"  ⚠ Fade-out detected at {fade_time:.2f}s (end/mid: {ratio:.1%})")
        print(f"  Compensating...")

        # Compensate
        result = compensate_fade(data, sr, rms, fade_start)

        # Verify
        rms2 = compute_rms_envelope(result, window_samples)
        new_end_rms = np.median(rms2[-int(0.1*sr):])
        print(f"  After fix: end RMS {end_rms:.4f} → {new_end_rms:.4f}")

        # Apply loop crossfade
        result = apply_loop_crossfade(result, sr, CROSSFADE_SEC)

    # Backup original
    os.makedirs(BACKUP_DIR, exist_ok=True)
    backup_path = os.path.join(BACKUP_DIR, name)
    if not os.path.exists(backup_path):
        import shutil
        shutil.copy2(filepath, backup_path)
        print(f"  Backed up to: backup/{name}")

    # Write back as OGG
    sf.write(filepath, result, sr, format='OGG', subtype='VORBIS')
    print(f"  ✓ Written: {name}")

    return fade_info is not None


def main():
    if not os.path.isdir(STEM_DIR):
        print(f"Stem directory not found: {STEM_DIR}")
        sys.exit(1)

    ogg_files = sorted([f for f in os.listdir(STEM_DIR) if f.endswith('.ogg')])
    print(f"Found {len(ogg_files)} OGG stems in {STEM_DIR}")

    fixed = 0
    for name in ogg_files:
        filepath = os.path.join(STEM_DIR, name)
        if process_stem(filepath):
            fixed += 1

    print(f"\n{'='*60}")
    print(f"Done. Fixed {fixed}/{len(ogg_files)} stems.")
    print(f"Originals backed up to: {BACKUP_DIR}")


if __name__ == "__main__":
    main()
