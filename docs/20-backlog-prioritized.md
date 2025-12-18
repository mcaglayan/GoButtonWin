# Product Backlog (Prioritized)

This backlog is prioritized to deliver a usable theatre cue runner early.

## P0 — MVP (Iteration 1–2)
1. **Shows list**: view shows, create, rename, delete, duplicate.
2. **Open show** into **Show Run** screen.
3. **Cue list + selection**: select cue; clear next/playing state.
4. **Transport**: GO / Pause-Resume / Stop.
5. **Master output**: master volume + DIM toggle.
6. **Persistence**: local save/load for shows and cues.
7. **Basic soundboard pads**: list pads; trigger pad; add pad.

## P1 — Editing foundations (Iteration 2–3)
1. **Edit Cue (metadata)**: title/subtitle/notes.
2. **Edit Cue (media)**: choose/change media file; missing-file warnings.
3. **Edit Cue (gain/pan)**: per-cue volume (dB) + pan.
4. **Preview** from edit screen.

## P2 — Cue behaviors (Iteration 3–4)
1. Pre-wait time
2. Fade in / fade out times
3. Loop modes + loop count
4. Auto-follow
5. Prevent GO duration
6. Stop others / Duck others (with duck percent)
7. After-start behavior presets (enum)

## P3 — Robustness & operator UX (later)
1. Keyboard shortcuts: GO, Stop, Pause, next/prev cue, pad hotkeys
2. Edit lock (passcode) to prevent accidental changes
3. Export/import show package
4. Playback reliability improvements (engine swap if needed)

## P4 — External control (later)
1. MIDI triggers
2. OSC triggers
3. Time-of-day scheduling

## Notes
- We will treat waveform rendering as optional until core cue running is stable.
- We will avoid adding complex routing until the basic runtime UX is solid.
