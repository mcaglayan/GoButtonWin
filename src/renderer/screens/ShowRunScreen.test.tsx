import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ShowRunScreen from './ShowRunScreen';
import { ShowsProvider } from '../data/ShowsContext';

import { audioEngine } from '../audio/audioEngine';

vi.mock('../audio/audioEngine', () => {
  const handle = {
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    isPaused: vi.fn(() => false),
    getProgress01: vi.fn(() => 0),
  };

  return {
    audioEngine: {
      preloadFiles: vi.fn(),
      setMasterVolume01: vi.fn(),
      getEstimatedOutputLatencyMs: vi.fn(() => null),
      playTone: vi.fn(async () => handle),
      playFile: vi.fn(async () => handle),
      stopAll: vi.fn(),
      pauseAll: vi.fn(),
      resumeAll: vi.fn(),
      isAnythingPaused: vi.fn(() => false),
    },
  };
});

describe('ShowRunScreen (operator feedback + GO)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pressing GO plays selected cue and advances selection', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/shows/tone-test']}>
        <ShowsProvider>
          <Routes>
            <Route path="/shows/:showId" element={<ShowRunScreen />} />
          </Routes>
        </ShowsProvider>
      </MemoryRouter>
    );

    // Selected cue starts at 1 (from effect). Operator should see “Go 1”.
    expect(await screen.findByRole('button', { name: 'Go 1' })).toBeInTheDocument();

    // Operator presses GO.
    await user.click(screen.getByRole('button', { name: 'Go 1' }));

    expect(audioEngine.playTone).toHaveBeenCalledWith(
      expect.objectContaining({ hz: 220, seconds: 1.0, gainDb: 0, pan: 0 })
    );

    // UI feedback: next cue becomes selected.
    expect(await screen.findByRole('button', { name: 'Go 2' })).toBeInTheDocument();

    // Operator mistake guard: the selected cue title should be visually indicated.
    // (We assert the cue row has the selected class after advancing.)
    const cueList = document.querySelector('.gb-cueList');
    expect(cueList).not.toBeNull();
    const cue2Title = within(cueList as HTMLElement).getByText('A4 — 440 Hz');
    const cueRow = cue2Title.closest('.gb-cueRow');
    expect(cueRow?.className).toContain('gb-cueRow--selected');
  });

  it('DIM sets master volume to 25%', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/shows/tone-test']}>
        <ShowsProvider>
          <Routes>
            <Route path="/shows/:showId" element={<ShowRunScreen />} />
          </Routes>
        </ShowsProvider>
      </MemoryRouter>
    );

    // Toggle DIM on.
    const dimButtons = await screen.findAllByRole('button', { name: 'DIM' });
    await user.click(dimButtons[0]!);
    expect(audioEngine.setMasterVolume01).toHaveBeenCalledWith(0.25);
  });
});
