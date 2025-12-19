import { describe, expect, it } from 'vitest';
import { pickWarmPreloadPaths } from './warmPreload';

function show(partial: Partial<Parameters<typeof pickWarmPreloadPaths>[0][number]>) {
  return {
    id: partial.id ?? 's',
    title: partial.title ?? 'Show',
    subtitle: partial.subtitle ?? '',
    cues: partial.cues ?? [],
    pads: partial.pads ?? [],
  };
}

describe('pickWarmPreloadPaths', () => {
  it('dedupes (case-insensitive) and trims', () => {
    const paths = pickWarmPreloadPaths(
      [
        show({
          cues: [
            { id: 'c1', number: 1, title: 'A', mediaPath: ' C:\\a\\x.mp3 ' },
            { id: 'c2', number: 2, title: 'B', mediaPath: 'c:\\A\\x.MP3' },
          ],
        }),
      ],
      10
    );

    expect(paths).toEqual(['C:\\a\\x.mp3']);
  });

  it('prioritizes mp3 over non-mp3', () => {
    const paths = pickWarmPreloadPaths(
      [
        show({
          cues: [
            { id: 'c1', number: 1, title: 'A', mediaPath: 'C:\\a\\x.wav' },
            { id: 'c2', number: 2, title: 'B', mediaPath: 'C:\\a\\y.mp3' },
            { id: 'c3', number: 3, title: 'C', mediaPath: 'C:\\a\\z.ogg' },
          ],
        }),
      ],
      2
    );

    expect(paths[0].toLowerCase().endsWith('.mp3')).toBe(true);
    expect(paths).toEqual(['C:\\a\\y.mp3', 'C:\\a\\x.wav']);
  });

  it('returns empty when maxPreload is 0', () => {
    const paths = pickWarmPreloadPaths([show({ cues: [{ id: 'c1', number: 1, title: 'A', mediaPath: 'x.mp3' }] })], 0);
    expect(paths).toEqual([]);
  });
});
