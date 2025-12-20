import { afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ShowsProvider, useShows } from '../data/ShowsContext';
import SoundBankScreen from './SoundBankScreen';

afterEach(() => cleanup());

function Harness(props: { showId: string }) {
  const { shows, setSoundBank } = useShows();
  const show = shows.find((s) => s.id === props.showId) ?? null;

  return (
    <div>
      <div data-testid="padCount">{show?.pads.length ?? 0}</div>
      <SoundBankScreen />
      <button
        onClick={() =>
          setSoundBank([
            { id: 'b1', title: 'Thunder', mediaPath: 'C:\\sounds\\thunder.mp3' },
            { id: 'b2', title: 'Applause', mediaPath: 'C:\\sounds\\applause.mp3' },
          ])
        }
      >
        Seed Bank
      </button>
    </div>
  );
}

function PadCountOnly() {
  const { showId } = useParams();
  const { shows } = useShows();
  const show = showId ? shows.find((s) => s.id === showId) ?? null : null;
  return <div data-testid="padCount">{show?.pads.length ?? 0}</div>;
}

describe('SoundBankScreen', () => {
  it('renders empty state in global mode', async () => {
    render(
      <MemoryRouter initialEntries={['/soundbank']}>
        <ShowsProvider>
          <Routes>
            <Route path="/soundbank" element={<SoundBankScreen />} />
          </Routes>
        </ShowsProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('SOUND BANK')).toBeInTheDocument();
    expect(await screen.findByText(/No sounds yet/i)).toBeInTheDocument();
  });

  it('can add a bank item to a show as a hit pad', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/shows/demo-sfx/soundbank']}>
        <ShowsProvider>
          <Routes>
            <Route path="/shows/:showId/soundbank" element={<Harness showId="demo-sfx" />} />
            <Route path="/shows/:showId" element={<PadCountOnly />} />
          </Routes>
        </ShowsProvider>
      </MemoryRouter>
    );

    const initial = Number((await screen.findByTestId('padCount')).textContent ?? '0');

    await user.click(await screen.findByRole('button', { name: 'Seed Bank' }));

    expect(await screen.findByText('Thunder')).toBeInTheDocument();

    const addButtons = await screen.findAllByRole('button', { name: '+ Add to Hits' });
    await user.click(addButtons[0]!);

    const next = Number((await screen.findByTestId('padCount')).textContent ?? '0');
    expect(next).toBe(initial + 1);
  });
});
