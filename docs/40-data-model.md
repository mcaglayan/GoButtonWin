# Data Model (Draft)

This is a draft model to guide implementation. We can simplify further for MVP.

## Show
- `id: string`
- `title: string`
- `createdAt: number`
- `updatedAt: number`
- `cues: Cue[]`
- `pads: Pad[]`

## Cue
- `id: string`
- `number: number` (display/order; can be derived from index)
- `title: string`
- `subtitle?: string`
- `notes?: string`
- `mediaPath?: string`
- `gainDb: number` (default 0)
- `pan: number` (range -1..1; default 0)

### Timing/behavior (later iterations)
- `preWaitMs: number`
- `fadeInMs: number`
- `fadeOutMs: number`
- `loopMode: 'off' | 'on' | 'fixed'`
- `loopCount?: number`
- `autoFollow: boolean`
- `preventGoMs: number`
- `stopOthersMode: 'off' | 'cuesOnly' | 'cuesAndHits'`
- `duckOthersMode: 'off' | 'cuesOnly' | 'cuesAndHits'`
- `duckPercent?: number`
- `afterStartBehavior: string` (enum)
- `goActions: GoAction[]` (optional)
- `triggers: Trigger[]` (optional)

## Pad (Soundboard / Hit)
- `id: string`
- `label: string`
- `mediaPath?: string`
- `gainDb: number`
- `mode: 'oneShot' | 'toggle'`
- `hotkey?: string` (later)

## Trigger (later)
- `type: 'keyboard' | 'midi' | 'osc' | 'schedule'`
- `value: string`
- `action: string`

## Notes
- For MVP, we can store to a single local JSON file.
- Media paths should be absolute or relative-to-show package; we decide during import/export work.
