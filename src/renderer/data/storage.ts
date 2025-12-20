import type { Show, SoundBankItem } from './seed';

type PersistedData = {
  schemaVersion: 1;
  updatedAt: number;
  demoSeedVersion?: number;
  shows: Show[];
  soundBank?: SoundBankItem[];
};

function assertStorage() {
  if (!window.app?.storage) {
    throw new Error('Storage API not available.');
  }
  return window.app.storage;
}

export async function loadShowsFromDisk(): Promise<Show[] | null> {
  const storage = assertStorage();
  const data = (await storage.loadShows()) as PersistedData | null;
  return data?.shows ?? null;
}

export async function loadDataFromDisk(): Promise<PersistedData | null> {
  const storage = assertStorage();
  const data = (await storage.loadShows()) as PersistedData | null;
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.shows)) return null;
  return data;
}

export async function saveShowsToDisk(
  shows: Show[],
  opts?: { demoSeedVersion?: number; soundBank?: SoundBankItem[] }
): Promise<void> {
  const storage = assertStorage();
  const data: PersistedData = {
    schemaVersion: 1,
    updatedAt: Date.now(),
    demoSeedVersion: opts?.demoSeedVersion,
    shows,
    soundBank: opts?.soundBank,
  };
  await storage.saveShows(data);
}
