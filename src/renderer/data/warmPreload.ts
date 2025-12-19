import type { Show } from './seed';

export function pickWarmPreloadPaths(shows: Show[], maxPreload: number): string[] {
  const max = Math.max(0, Math.floor(maxPreload));
  if (max === 0) return [];

  const seen = new Set<string>();
  const candidates: string[] = [];

  const add = (raw: string | null | undefined) => {
    const p = (raw ?? '').trim();
    if (!p) return;
    const key = p.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(p);
  };

  // Cues first (GO path), then pads.
  for (const show of shows) {
    for (const cue of show.cues ?? []) add(cue.mediaPath);
    for (const pad of show.pads ?? []) add(pad.mediaPath);
    if (candidates.length >= 50) break;
  }

  const isMp3 = (p: string) => p.toLowerCase().endsWith('.mp3');

  return candidates
    .slice(0, 50)
    .sort((a, b) => {
      const am = isMp3(a) ? 1 : 0;
      const bm = isMp3(b) ? 1 : 0;
      return bm - am;
    })
    .slice(0, max);
}
