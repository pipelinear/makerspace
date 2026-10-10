"""Render the original fallback battle loop; requires Python 3 and ffmpeg."""
import math
from pathlib import Path
import random
import struct
import subprocess
import tempfile
import wave

rate = 22050
step = 60 / 144 / 4
samples = [0.0] * round(rate * step * 128)
random.seed(25)


def note(midi, start, duration, volume, triangle=False):
    frequency = 440 * 2 ** ((midi - 69) / 12)
    for i in range(round(duration * rate)):
        t = i / rate
        phase = t * frequency % 1
        value = 1 - 4 * abs(phase - .5) if triangle else (1 if phase < .25 else -1) * .7
        envelope = min(1, t / .004, (duration - t) / .015)
        index = round(start * rate) + i
        if index < len(samples):
            samples[index] += value * envelope * volume


# Eight bars of original A-minor pulse melody, arpeggios, triangle bass and noise hats.
melody = [
    [76, 0, 76, 79, 81, 0, 79, 76, 74, 76, 0, 72, 74, 0, 76, 79],
    [81, 0, 84, 83, 81, 79, 76, 0, 79, 0, 76, 74, 72, 74, 76, 0],
    [77, 0, 77, 81, 84, 0, 81, 77, 76, 77, 0, 74, 76, 0, 77, 81],
    [79, 0, 83, 81, 79, 77, 76, 0, 74, 0, 76, 79, 83, 81, 79, 76],
]
for bar in range(8):
    root, chord = [(45, [69, 72, 76]), (45, [69, 72, 76]),
                   (41, [65, 69, 72]), (43, [67, 71, 74])][bar % 4]
    for beat in range(16):
        at = (bar * 16 + beat) * step
        pitch = melody[bar % 4][beat]
        if pitch:
            note(pitch + (12 if bar >= 4 else 0), at, step * .85, .14)
        note(chord[beat % 3], at, step * .6, .055)
        if beat % 2 == 0:
            note(root + (12 if beat % 4 == 2 else 0), at, step * 1.7, .22, True)
        for i in range(round(rate * .025)):
            samples[round(at * rate) + i] += random.uniform(-1, 1) * .045 * (1 - i / (rate * .025))

target = Path(__file__).resolve().parents[2] / 'dist/assets/battle/battle-theme.mp3'
with tempfile.TemporaryDirectory() as directory:
    source = Path(directory) / 'battle-theme.wav'
    with wave.open(str(source), 'wb') as audio:
        audio.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
        audio.writeframes(b''.join(struct.pack('<h', round(max(-1, min(1, value)) * 32767)) for value in samples))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(source),
                    '-codec:a', 'libmp3lame', '-b:a', '64k', str(target)], check=True)
