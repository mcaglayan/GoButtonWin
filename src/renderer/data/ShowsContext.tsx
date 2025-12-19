import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { seededShows, type Show } from './seed';
import { loadDataFromDisk, loadShowsFromDisk, saveShowsToDisk } from './storage';
import { audioEngine } from '../audio/audioEngine';
import { pickWarmPreloadPaths } from './warmPreload';

type ShowsState = {
  isLoaded: boolean;
  shows: Show[];
  setShows: (updater: Show[] | ((prev: Show[]) => Show[])) => void;
};

const ShowsContext = createContext<ShowsState | null>(null);

export function ShowsProvider(props: { children: ReactNode }) {
  const [shows, setShows] = useState<Show[]>(seededShows);
  const [isLoaded, setIsLoaded] = useState(false);
  const didHydrateRef = useRef(false);
  const didWarmDecodeRef = useRef(false);

  function warmDecodeOnce(nextShows: Show[]) {
    if (didWarmDecodeRef.current) return;
    didWarmDecodeRef.current = true;

    const ordered = pickWarmPreloadPaths(nextShows, 3);
    if (ordered.length === 0) return;
    setTimeout(() => audioEngine.preloadFiles(ordered), 0);
  }

  const showsRef = useRef<Show[]>(seededShows);
  useEffect(() => {
    showsRef.current = shows;
  }, [shows]);

  const demoSeedVersionRef = useRef<number | undefined>(undefined);
  const CURRENT_DEMO_SEED_VERSION = 2;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const diskData = await loadDataFromDisk();
        if (cancelled) return;

        const diskShows = diskData?.shows ?? null;
        demoSeedVersionRef.current = diskData?.demoSeedVersion;

        if (diskShows && diskShows.length > 0) {
          // One-time demo merge so you get new sample shows without nuking user edits.
          // After the first merge, we stop re-adding demo shows (so deletions stick).
          if (demoSeedVersionRef.current !== CURRENT_DEMO_SEED_VERSION) {
            const byId = new Set(diskShows.map((s) => s.id));
            const missingSeedShows = seededShows.filter((s) => !byId.has(s.id));
            const merged = missingSeedShows.length > 0 ? [...diskShows, ...missingSeedShows] : diskShows;
            setShows(merged);

            warmDecodeOnce(merged);

            demoSeedVersionRef.current = CURRENT_DEMO_SEED_VERSION;
            await saveShowsToDisk(merged, { demoSeedVersion: CURRENT_DEMO_SEED_VERSION });
          } else {
            setShows(diskShows);

            warmDecodeOnce(diskShows);
          }
        } else {
          // First run: persist seeded data.
          demoSeedVersionRef.current = CURRENT_DEMO_SEED_VERSION;
          await saveShowsToDisk(seededShows, { demoSeedVersion: CURRENT_DEMO_SEED_VERSION });

          warmDecodeOnce(seededShows);
        }
      } catch {
        // Ignore persistence errors for now; UI can still run on seeded data.
        warmDecodeOnce(seededShows);
      } finally {
        if (!cancelled) {
          didHydrateRef.current = true;
          setIsLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onMenuAction = window.app?.onMenuAction;
    if (!onMenuAction) return;

    onMenuAction((action) => {
      if (action === 'save') {
        void saveShowsToDisk(showsRef.current, { demoSeedVersion: demoSeedVersionRef.current });
        return;
      }

      if (action === 'reload') {
        void (async () => {
          const diskShows = await loadShowsFromDisk();
          if (diskShows && diskShows.length > 0) setShows(diskShows);
        })();
        return;
      }

      if (action === 'reset') {
        setShows(seededShows);
        demoSeedVersionRef.current = CURRENT_DEMO_SEED_VERSION;
        void saveShowsToDisk(seededShows, { demoSeedVersion: CURRENT_DEMO_SEED_VERSION });
      }
    });
  }, []);

  useEffect(() => {
    if (!didHydrateRef.current) return;
    void saveShowsToDisk(shows, { demoSeedVersion: demoSeedVersionRef.current });
  }, [shows]);

  const value = useMemo<ShowsState>(() => ({ isLoaded, shows, setShows }), [isLoaded, shows]);

  return <ShowsContext.Provider value={value}>{props.children}</ShowsContext.Provider>;
}

export function useShows() {
  const ctx = useContext(ShowsContext);
  if (!ctx) throw new Error('useShows must be used within ShowsProvider');
  return ctx;
}
