# Iteration Plan

This plan is intentionally MVP-first. Each iteration should produce a runnable app with visible progress.

## Iteration 1 — Shell + Shows + Show Run (no real audio required yet)
**Goal**: UI skeleton and navigation matching the screenshots.

Deliverables:
- Shows screen with a list of shows (seeded/dummy data is OK initially).
- Create/rename/delete/duplicate show (can be in-memory first, then persisted in Iteration 2).
- Show Run screen layout: master column, current/next cue area, cue list, bottom transport, soundboard area.

Notes:
- Shows screen includes an **Edit** mode with Rename/Duplicate/Delete and a **+ New** action.
- Show Run screen includes an **Edit** mode for cues (Add/Rename/Delete/Reorder).

Acceptance:
- Can open a show and see cues rendered.
- Can select cues and see “next” highlight change.

Implementation notes:
- UI scaffold for this iteration lives under `src/renderer` with seeded data in `src/renderer/data/seed.ts`.

## Iteration 2 — Persistence + Basic Playback
**Goal**: Make it useful for simple gigs.

Deliverables:
- Local persistence for shows/cues/pads.
- Load show on launch.
- Basic audio playback for cues and pads (one at a time for cues; pads may overlap depending on design choice).
- GO / Pause-Resume / Stop work end-to-end.
- Master volume and DIM affect playback.

Acceptance:
- Restarting the app preserves shows and cue order.
- GO plays the selected cue and updates playing state.
- **Overlap policy (confirmed)**:
	- Soundboard pads (hits) may overlap each other.
	- Cues may overlap other cues.

Implementation note:
- Persistence is stored as a single JSON file `shows.json` under Electron `app.getPath('userData')`.
- The JSON includes `schemaVersion: 1` to allow future migrations.
- You can manually trigger persistence via the app menu: **File → Save** and **File → Reload from Disk**.

## Iteration 3 — Cue Edit (metadata + file + gain/pan + preview)
**Goal**: Edit cues like in screenshots.

Deliverables:
- Edit Cue screen with title/subtitle/notes.
- Select/change media file.
- Per-cue volume (dB) and pan.
- Preview button.

Acceptance:
- Editing a cue updates run screen display.
- Saving persists after restart.

## Iteration 4 — Cue Timing & Behaviors
**Goal**: Theatre automation features.

Deliverables:
- Pre-wait, fade in/out, loop, auto-follow.
- Stop others / Duck others.
- Prevent GO duration.
- After-start behavior presets.

Acceptance:
- Behaviors are deterministic and visible in state.

## Iteration 5+ — Advanced operator features
- Keyboard shortcut editor + defaults.
- Edit lock.
- Export/import.
- External triggers (MIDI/OSC) and scheduling.

## Decisions to confirm (before Iteration 2)
- Whether pads can overlap and whether cues can overlap.
- Audio engine choice on Windows (simple first vs low-latency first).
- Whether MVP includes keyboard shortcuts (minimal) or later.

## Confirmed decisions
- Pads (hits) can overlap.
- Cues can overlap.
