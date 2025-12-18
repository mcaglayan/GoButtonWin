# Functional Requirements

This document lists functional requirements derived from the screenshots and theatre cue-running workflow.

## FR-1 Shows
- FR-1.1 The app must display a **Shows** screen listing available shows.
- FR-1.2 The operator must be able to **create** a show.
- FR-1.3 The operator must be able to **rename** a show.
- FR-1.4 The operator must be able to **duplicate** a show.
- FR-1.5 The operator must be able to **delete** a show.

## FR-2 Show Run Screen (runtime)
- FR-2.1 The operator must be able to open a show and see the **Show Run** screen.
- FR-2.2 The screen must show the **currently selected/next cue** (number + title prominently).
- FR-2.3 The operator must be able to **select** any cue in the cue list.
- FR-2.4 The operator must be able to press **GO** to start the selected cue.
- FR-2.5 The GO label must reflect the next cue (e.g., “Go 1”).
- FR-2.6 The operator must be able to **Pause/Resume** playback.
- FR-2.7 The operator must be able to **Stop** playback.
- FR-2.8 The cue list must show basic **status** (idle/next/playing).
- FR-2.9 The cue list must display **time/progress** (at least for the active cue; ideally all cues).
- FR-2.10 Cues must be allowed to **overlap** (starting a cue must not implicitly stop other cues).

## FR-3 Master control
- FR-3.1 The screen must provide a **master volume** control.
- FR-3.2 The screen must provide a **DIM** toggle to temporarily reduce output level.
- FR-3.3 DIM must be reversible without losing cue state.

## FR-4 Soundboard / Hits
- FR-4.1 The screen must show **soundboard pads**.
- FR-4.2 The operator must be able to **trigger** a pad independent of the cue stack.
- FR-4.3 The operator must be able to **add** a pad.
- FR-4.4 Pads must show basic state (idle/playing) if applicable.
- FR-4.5 Soundboard pads must be allowed to **overlap** (multiple pads can play at once).

## FR-5 Cue editing
- FR-5.1 The operator must be able to enter **Edit mode** from the run screen.
- FR-5.2 The operator must be able to open **Edit Cue**.
- FR-5.3 The cue edit view must allow editing:
  - Title
  - Subtitle
  - Notes
  - Media file reference
  - Volume (dB)
  - Pan (%)
- FR-5.4 The cue edit view must provide **Preview** playback.
- FR-5.5 The cue edit view must show a **waveform** visualization (initially optional for MVP).

## FR-6 Cue timing & behavior (from screenshots)
- FR-6.1 The operator must be able to set **Pre-wait time**.
- FR-6.2 The operator must be able to set **Fade In time**.
- FR-6.3 The operator must be able to set **Fade Out time**.
- FR-6.4 The operator must be able to configure **Loop** (Off / On / Fixed) and loop count where relevant.
- FR-6.5 The operator must be able to enable/disable **Auto-follow**.
- FR-6.6 The operator must be able to set **Prevent GO Duration**.
- FR-6.7 The operator must be able to configure **Stop Others** mode (Off / Cues Only / Cues & Hits).
- FR-6.8 The operator must be able to configure **Duck Others** mode (Off / Cues Only / Cues & Hits) and duck amount (if enabled).
- FR-6.9 The operator must be able to configure **After this cue starts** behavior (enum).

## FR-7 Triggers (deferred by default)
- FR-7.1 The operator may configure cue triggers via keyboard.
- FR-7.2 MIDI/OSC triggers may be added in a later iteration.
- FR-7.3 Time-of-day scheduling may be added in a later iteration.

## FR-8 Persistence
- FR-8.1 Shows, cues, and pads must be stored locally.
- FR-8.2 Changes must be saved reliably and reloaded on app restart.
- FR-8.3 The app must detect and surface missing media files.
