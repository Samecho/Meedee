# Sources and attribution

## River Flows in You

- Composition: **Yiruma**. Composition and transcription rights remain with their respective owners and are not covered by the application's MIT licence.
- Community MIDI shared publicly by **bestpianocla6** on 2024-02-02: https://www.patreon.com/bestpianocla6/posts/midi-river-flows-97703177 . The post provides the file used in the creator's piano video; it is not an official MIDI release by Yiruma.
- Public attachment: https://www.patreon.com/file?h=97703177&m=273392661 . Retrieved 2026-11-02; the unmodified 5,625-byte source is retained at assets/source/river-bestpianocla6.mid. SHA-256: 2f654f6bb54328bc923f722e0aafdceb7b8374406bde549f5c953a247d4aa117.
- Published-score references: Yiruma, *Yiruma Piano Album* (2003, arrangement credited to Seo In; https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=440333), and the 2005 STOMP MUSIC / Musicnotes piano edition MN0073222 (https://www.musicnotes.com/sheetmusic/yiruma/river-flows-in-you/MN0073222). The scores were consulted for comparison and are not bundled.
- The playable MIDI at assets/midi/river-flows-in-you.mid is a score-reviewed revision of the community file, built by scripts/build-river.mjs. Twelve pitches were changed, three omitted note attacks added, and two written ties consolidated; the source's other note events and tempo are preserved. Pitch order was compared bar by bar with the Musicnotes edition. At the bar 31 passage where the editions disagree, this revision retains A5 as printed in the earlier Korean book. It has 841 notes, 45 measures and approximately 167 seconds at 65 BPM, with 544 right-hand and 297 left-hand notes. Written unisons, including a note shared by both staves in bar 38, remain in their respective tracks.
- This is a community transcription revised against published scores. It is not an official MIDI and has not been certified note-for-note against Yiruma's 2001 recording. The scores can represent arrangements and differ in details.

## Current Canon in D

- Composition: Johann Pachelbel (1653–1706).
- Piano arrangement: **Lee Galloway**, © 2000. Arrangement rights remain with their owner and are not covered by the application's MIT licence.
- Arranger's own background: https://leegalloway.com/biography
- Full community MIDI shared by **SlappingRico** (2013): https://www.youtube.com/watch?v=fqNHvKJyzlQ . Its public source link is https://www.mediafire.com/download/99d78ncwvcirj6g/Canon_Fantasy_-_Lee_Galloway.mid . Original bytes are retained at assets/source/canon-galloway-community.mid, retrieved 2026-11-01.
- Two-hand reference shared by **Midi2Piano** (2008): https://www.youtube.com/watch?v=lb-O9XnRkys . Its public link is https://www.mediafire.com/file/sbq491a7xkwymd9/canon_in_d_-_lee_galloway.mid . Original bytes are retained at assets/source/canon-galloway-hand-reference.mid. This reference is shorter and is used only for hand labels.
- Score reference: Lee Galloway arrangement, notation by **Karl Nabielec**, https://cantorion.org/music/4389/Canon-in-D-Arr.-Lee-Galloway . The repository does not treat a community upload as an official publication or a public-domain grant for the arrangement.
- Meedee splits the full transcription into Right Hand and Left Hand tracks. 865 hand labels align to the separate hand reference. Remaining labels use simultaneous voices, register and reviewed inner melody tones; see assets/source/canon-galloway-hands.json and scripts/build-canon.mjs. This is a community transcription, not an official MIDI published by Lee Galloway.
- Every full-source pitch, onset tick, duration tick, velocity, tempo event and pedal event is preserved. Result: 1,031 notes (511 right, 520 left), 46 notated measures, approximately 181 seconds including its tempo changes.

## Earlier source material

The prototype's unused canon-piano.mxl and canon-notes.json in assets/source/ are from **Noctave, d’après Michael Fischer v. Mollard / Mutopia Project**, CC BY 4.0. Source: https://noctavepiano.com/en/sheet-music/pachelbel-canon/ ; licence: https://creativecommons.org/licenses/by/4.0/ . They are not the current playable MIDI.

## Piano samples

**Salamander Grand Piano**, Yamaha C5, by **Alexander Holm**, CC BY 3.0: https://creativecommons.org/licenses/by/3.0/ . Source MP3 files: https://github.com/Tonejs/audio/tree/master/salamander . The original README is retained at assets/piano/README.txt. Meedee bundles 16 unmodified MP3 samples and adjusts their playback rate to the desired pitch.

## MIDI reader

- **@tonejs/midi 2.0.28**, Yotam Mann and contributors: https://github.com/Tonejs/Midi ; MIT licence retained at vendor/Midi.LICENSE.
- **midi-file**, Carter Thaxton and contributors: https://github.com/carter-thaxton/midi-file ; MIT licence at vendor/midi-file.LICENSE.
- **array-flatten**, Blake Embrey: https://github.com/blakeembrey/array-flatten ; MIT licence at vendor/array-flatten.LICENSE.

User-imported MIDI files remain in the current browser. No analytics, external fonts, accounts or paid services are used by the application.
