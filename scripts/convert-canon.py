"""Convert the credited CC BY 4.0 piano edition to two explicitly named MIDI hands.

MusicXML is a build-time source only; the website plays the generated SMF file.
"""
from pathlib import Path
from fractions import Fraction
import json
import zipfile
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parent.parent
with zipfile.ZipFile(root / 'assets/source/canon-piano.mxl') as archive:
    container = ET.fromstring(archive.read('META-INF/container.xml'))
    source_file = next(el.attrib['full-path'] for el in container.iter() if el.tag.endswith('rootfile'))
    score = ET.fromstring(archive.read(source_file))

division = 1
measure_start = Fraction(0)
hands = {'right': [], 'left': []}
ties = {}
tempo = 56
measures = 0
steps = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
for part in score.findall('part'):
    measure_start = Fraction(0)
    for measure in part.findall('measure'):
        measures += 1
        cursor = Fraction(0)
        max_cursor = Fraction(0)
        chord_start = Fraction(0)
        for el in measure:
            if el.tag == 'attributes':
                division = int(el.findtext('divisions', division))
            elif el.tag == 'direction':
                sound = el.find('sound')
                if sound is not None and 'tempo' in sound.attrib:
                    tempo = float(sound.attrib['tempo'])
            elif el.tag in ('backup', 'forward'):
                duration = Fraction(int(el.findtext('duration', '0')), division)
                cursor += duration if el.tag == 'forward' else -duration
            elif el.tag == 'note':
                duration = Fraction(int(el.findtext('duration', '0')), division)
                is_chord = el.find('chord') is not None
                onset = chord_start if is_chord else cursor
                if not is_chord:
                    chord_start = cursor
                    cursor += duration
                max_cursor = max(max_cursor, cursor, onset + duration)
                pitch = el.find('pitch')
                if pitch is None:
                    continue
                midi = (int(pitch.findtext('octave')) + 1) * 12 + steps[pitch.findtext('step')] + int(pitch.findtext('alter', '0'))
                hand = 'left' if el.findtext('staff', '1') == '2' else 'right'
                time = measure_start + onset
                types = {tie.attrib['type'] for tie in el.findall('tie')}
                key = (hand, midi, el.findtext('voice', '1'))
                if 'stop' in types and key in ties:
                    note = ties[key]
                    note['duration'] += float(duration)
                else:
                    note = {'midi': midi, 'beats': float(time), 'duration': float(duration)}
                    hands[hand].append(note)
                if 'start' in types:
                    ties[key] = note
                else:
                    ties.pop(key, None)
        measure_start += max_cursor

data = {'tempo': tempo, 'measures': measures, 'beats': float(measure_start), 'hands': hands}
destination = root / 'assets/source/canon-notes.json'
destination.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(json.dumps({k: v for k, v in data.items() if k != 'hands'}))
print({hand: len(notes) for hand, notes in hands.items()})
