import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

const SHOWS_FILE_NAME = 'shows.json';

export type PersistedCue = {
  id: string;
  number: number;
  title: string;
  durationLabel?: string;
  subtitle?: string;
  notes?: string;
  mediaPath?: string;
  toneHz?: number;
  gainDb?: number;
  pan?: number;
};

export type PersistedPad = {
  id: string;
  label: string;
  mediaPath?: string;
};

export type PersistedShow = {
  id: string;
  title: string;
  subtitle: string;
  cues: PersistedCue[];
  pads: PersistedPad[];
};

export type PersistedData = {
  schemaVersion: 1;
  updatedAt: number;
  demoSeedVersion?: number;
  shows: PersistedShow[];
};

function getShowsFilePath() {
  return path.join(app.getPath('userData'), SHOWS_FILE_NAME);
}

export async function loadPersistedShows(): Promise<PersistedData | null> {
  const filePath = getShowsFilePath();
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as PersistedData;
    if (!parsed || parsed.schemaVersion !== 1 || !Array.isArray(parsed.shows)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function savePersistedShows(data: PersistedData): Promise<void> {
  const filePath = getShowsFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
