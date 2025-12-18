# GoButtonWindows — Requirements Overview & Scope

## Goal
Build a desktop Electron application for theatre gigs to run sound effects and music cues reliably during rehearsals and performances.

The reference workflow/UI is inspired by the provided Go Button screenshots, with a similar layout:
- **Shows list** screen (dark teal background, show cards)
- **Show run** screen (master controls + current/next cue + cue list + soundboard pads + transport)
- **Cue edit** screen (waveform preview + metadata + media file + gain/pan + timing/fade behaviors + triggers)

## Non-goals (for MVP)
- Live multitrack mixing console features
- Advanced routing/matrix mixing beyond a single master output
- Cloud sync, collaboration, or multi-user permissions
- Complex automation (MIDI/OSC/time-of-day schedules) unless explicitly moved into scope

## Target platforms
- **Primary**: Windows
- **Future**: macOS (optional later)

## Primary user
- **Sound operator / stage tech** running a show from a laptop, under time pressure.

## Core concepts
- **Show**: A collection of cues and soundboard pads for one production.
- **Cue**: A playable item (initially audio file) with metadata and playback behaviors.
- **Soundboard pad (Hit)**: An ad-hoc one-shot/toggle sound that can be triggered anytime.

## Design constraints
- Match the screenshot vibe: dark UI, high contrast, big GO button, clear status indicators.
- Prioritize legibility and speed over decorative UI.

## Success criteria
- Operator can open a show and confidently run cues with minimal clicks.
- GO/Stop/Pause and selection are unambiguous and robust.
- Shows/cues persist locally and load quickly.

## Open questions (parked)
- Audio engine requirements for low-latency playback (MVP may start simple).
- Whether MVP includes external control (MIDI/OSC) or keyboard-only.
