import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ShowsProvider, useShows } from '../data/ShowsContext';
import CueEditScreen from './CueEditScreen';

vi.mock('../audio/audioEngine', () => {
  return {
    audioEngine: {
      getFileDurationSeconds: vi.fn(async () => 65.4),
    },
  };
});

function Result() {
  const { showId, cueId } = useParams();
  const { shows } = useShows();
  const show = showId ? shows.find((s) => s.id === showId) ?? null : null;
  const cue = show ? show.cues.find((c) => c.id === 't1') ?? null : null;
  return <div data-testid="duration">{cue?.durationLabel ?? ''}</div>;
}

describe('CueEditScreen duration', () => {
  it('updates durationLabel when media changes', async () => {
    const user = userEvent.setup();

    // Stub the dialog picker.
    (window as any).app = {
      ...(window as any).app,
      dialog: {
        openAudioFile: async () => 'C:\\sounds\\longer.mp3',
      },
    };

    render(
      <MemoryRouter initialEntries={['/shows/tone-test/cues/t1']}>
        <ShowsProvider>
          <Routes>
            <Route path="/shows/:showId/cues/:cueId" element={<CueEditScreen />} />
            <Route path="/shows/:showId" element={<Result />} />
          </Routes>
        </ShowsProvider>
      </MemoryRouter>
    );

    await user.click(await screen.findByRole('button', { name: 'Browse…' }));
    await user.click(await screen.findByRole('button', { name: 'Save' }));

    // 65.4s -> -01:05,4
    expect(await screen.findByTestId('duration')).toHaveTextContent('-01:05,4');
  });
});
