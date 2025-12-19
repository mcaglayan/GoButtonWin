import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ShowsScreen from './ShowsScreen';
import { ShowsProvider } from '../data/ShowsContext';

describe('ShowsScreen (operator visibility)', () => {
  it('renders the shows list with seeded shows', async () => {
    render(
      <MemoryRouter initialEntries={['/shows']}>
        <ShowsProvider>
          <ShowsScreen />
        </ShowsProvider>
      </MemoryRouter>
    );

    // Title and at least one known seeded show should be visible.
    expect(await screen.findByText('SHOWS')).toBeInTheDocument();
    expect(await screen.findByText('Tone Test')).toBeInTheDocument();
  });
});
