# Sources and attribution

## Canon in D

- Composition: Johann Pachelbel (1653–1706), public domain.
- Piano arrangement: **Noctave, d’après Michael Fischer v. Mollard / Mutopia Project**, based on the Mutopia edition and Max Seiffert's 1929 edition.
- Edition and download: https://noctavepiano.com/en/sheet-music/pachelbel-canon/
- Underlying Mutopia edition: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2047
- Licence: **Creative Commons Attribution 4.0 International** — https://creativecommons.org/licenses/by/4.0/
- Source: `assets/source/canon-piano.mxl`, retrieved 2026-11-01.
- Changes for Meedee: converted the edition's MusicXML to Standard MIDI; separated the two staves into explicitly named Right Hand and Left Hand tracks; assigned piano instrument and fixed per-hand velocities. Notes, rhythms, ties, and all 57 bars of this piano arrangement are preserved. Original string voices were already adapted by the edition's arranger. This is a full piano arrangement, rather than a claim of a unique original piano version.
- Generated playable MIDI: `assets/midi/canon-piano.mid`.
- Generated intermediate notes and conversion scripts are included for reproducibility. The CC BY 4.0 attribution applies to the arrangement and its derived MIDI and note data.

## Piano samples

- **Salamander Grand Piano**, Yamaha C5, by **Alexander Holm**.
- Licence: **Creative Commons Attribution 3.0 Unported** — https://creativecommons.org/licenses/by/3.0/
- Source MP3 samples distributed by Tone.js: https://github.com/Tonejs/audio/tree/master/salamander
- Original README and licence retained at `assets/piano/README.txt`.
- Meedee bundles a subset of 16 MP3 samples, uses the nearest sample for each note, and adjusts playback rate to the desired pitch. Sample files themselves are unmodified.

## MIDI reader

- **@tonejs/midi 2.0.28**, by Yotam Mann and contributors.
- Repository: https://github.com/Tonejs/Midi
- Browser build: https://cdn.jsdelivr.net/npm/@tonejs/midi@2.0.28/build/Midi.js
- Licence: **MIT**, retained at `vendor/Midi.LICENSE`.
- Uses midi-file, by Carter Thaxton and contributors: https://github.com/carter-thaxton/midi-file (MIT, retained at `vendor/midi-file.LICENSE`).
- Uses array-flatten, by Blake Embrey: https://github.com/blakeembrey/array-flatten (MIT, retained at `vendor/array-flatten.LICENSE`).

No external fonts, photographs, analytics, accounts, or paid services are used. User-imported MIDI files remain in the local browser; they are not bundled into this repository or sent to a server.
