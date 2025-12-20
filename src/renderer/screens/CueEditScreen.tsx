import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { useShows } from '../data/ShowsContext';
import { audioEngine } from '../audio/audioEngine';
import type { Cue } from '../data/seed';
import './CueEditScreen.css';

type Draft = {
  title: string;
  subtitle: string;
  notes: string;
  mediaPath: string;
  toneHz: string;
  gainDb: string;
  pan: string;
  durationLabel: string;
};

function toDraft(cue: Cue): Draft {
  return {
    title: cue.title ?? '',
    subtitle: cue.subtitle ?? '',
    notes: cue.notes ?? '',
    mediaPath: cue.mediaPath ?? '',
    toneHz: cue.toneHz != null ? String(cue.toneHz) : '',
    gainDb: (cue.gainDb ?? 0).toString(),
    pan: (cue.pan ?? 0).toString(),
    durationLabel: cue.durationLabel ?? '',
  };
}

function formatDurationLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const totalTenths = Math.max(0, Math.round(seconds * 10));
  const mins = Math.floor(totalTenths / 600);
  const secs = Math.floor((totalTenths - mins * 600) / 10);
  const tenths = totalTenths % 10;
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return `-${mm}:${ss},${tenths}`;
}

function parseNumberOrFallback(raw: string, fallback: number) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function parseToneHz(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.replace(',', '.');
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

export default function CueEditScreen() {
  const { showId, cueId } = useParams();
  const navigate = useNavigate();
  const { shows, setShows } = useShows();

  const show = useMemo(() => shows.find((s) => s.id === showId) ?? null, [showId, shows]);
  const cue = useMemo(() => show?.cues.find((c) => c.id === cueId) ?? null, [show, cueId]);

  const [draft, setDraft] = useState<Draft | null>(null);

  const lastDurationPathRef = useRef('');
  const durationTokenRef = useRef(0);

  useEffect(() => {
    if (cue) setDraft(toDraft(cue));
  }, [cue?.id]);

  useEffect(() => {
    if (!draft) return;

    const path = draft.mediaPath.trim();
    if (!path) {
      if (draft.durationLabel) setDraft({ ...draft, durationLabel: '' });
      lastDurationPathRef.current = '';
      return;
    }

    // Only recompute when the path actually changes (avoid decoding on every render).
    if (path === lastDurationPathRef.current) return;
    lastDurationPathRef.current = path;

    const token = ++durationTokenRef.current;
    const id = window.setTimeout(() => {
      void (async () => {
        const seconds = await audioEngine.getFileDurationSeconds(path, { fresh: true });
        if (durationTokenRef.current !== token) return;
        if (seconds == null) return;

        const next = formatDurationLabel(seconds);
        setDraft((prev) => {
          if (!prev) return prev;
          if (prev.mediaPath.trim() !== path) return prev;
          return { ...prev, durationLabel: next };
        });
      })();
    }, 350);

    return () => window.clearTimeout(id);
  }, [draft?.mediaPath]);

  const canSave = !!draft?.title.trim();

  const cueNav = useMemo(() => {
    if (!show || !cue) return { prevId: undefined as string | undefined, nextId: undefined as string | undefined };
    const idx = show.cues.findIndex((c) => c.id === cue.id);
    return {
      prevId: idx > 0 ? show.cues[idx - 1]?.id : undefined,
      nextId: idx >= 0 && idx + 1 < show.cues.length ? show.cues[idx + 1]?.id : undefined,
    };
  }, [show?.id, cue?.id, show?.cues]);

  async function browseMedia() {
    const openAudioFile = window.app?.dialog?.openAudioFile;
    if (!openAudioFile || !draft) return;
    const picked = await openAudioFile();
    if (!picked) return;
    setDraft({ ...draft, mediaPath: picked });
  }

  async function exportToneWav() {
    if (!cue || !draft) return;
    const hz = parseToneHz(draft.toneHz);
    if (!hz) return;
    const exporter = window.app?.audio?.exportToneWav;
    if (!exporter) return;
    await exporter({ hz, seconds: 1.0, suggestedName: `${cue.number} - ${cue.title} - ${hz}Hz` });
  }

  async function save(navigateToCueId?: string) {
    if (!show || !cue || !draft) return;

    const nextTitle = draft.title.trim();
    if (!nextTitle) return;

    const nextMediaPath = draft.mediaPath.trim();
    let nextDurationLabel = draft.durationLabel.trim();
    if (nextMediaPath) {
      // Ensure duration reflects the chosen media even if the background effect hasn't completed yet.
      const seconds = await audioEngine.getFileDurationSeconds(nextMediaPath, { fresh: true });
      if (seconds != null) nextDurationLabel = formatDurationLabel(seconds);
    } else {
      nextDurationLabel = '';
    }

    const nextCue: Cue = {
      ...cue,
      title: nextTitle,
      subtitle: draft.subtitle.trim() || undefined,
      notes: draft.notes.trim() || undefined,
      mediaPath: nextMediaPath || undefined,
      durationLabel: nextDurationLabel || undefined,
      toneHz: parseToneHz(draft.toneHz),
      gainDb: parseNumberOrFallback(draft.gainDb, cue.gainDb ?? 0),
      pan: parseNumberOrFallback(draft.pan, cue.pan ?? 0),
    };

    setShows((prev) =>
      prev.map((s) => {
        if (s.id !== show.id) return s;
        return { ...s, cues: s.cues.map((c) => (c.id === cue.id ? nextCue : c)) };
      })
    );

    navigate(navigateToCueId ? `/shows/${show.id}/cues/${navigateToCueId}` : `/shows/${show.id}`);
  }

  if (!show) {
    return (
      <div className="gb-app">
        <TopBar title="Cue" right={<Link to="/shows" className="gb-link">← Back</Link>} />
        <div className="gb-page">
          <div className="gb-editCard">
            <div className="gb-editCard__title">Show not found</div>
          </div>
        </div>
      </div>
    );
  }

  if (!cue || !draft) {
    return (
      <div className="gb-app">
        <TopBar title={show.title} right={<Link to={`/shows/${show.id}`} className="gb-link">← Back</Link>} />
        <div className="gb-page">
          <div className="gb-editCard">
            <div className="gb-editCard__title">Cue not found</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gb-app">
      <TopBar
        title={`Cue ${cue.number}`}
        right={
          <div className="gb-editTopRight">
            <button
              className="gb-miniBtn"
              type="button"
              onClick={() => save(cueNav.prevId)}
              disabled={!canSave || !cueNav.prevId}
              aria-label="Previous cue"
              title="Previous cue"
            >
              ←
            </button>
            <button
              className="gb-miniBtn"
              type="button"
              onClick={() => save(cueNav.nextId)}
              disabled={!canSave || !cueNav.nextId}
              aria-label="Next cue"
              title="Next cue"
            >
              →
            </button>
            <Link to={`/shows/${show.id}`} className="gb-link">
              ← Back
            </Link>
            <button className="gb-miniBtn" onClick={() => save()} disabled={!canSave}>
              Save
            </button>
          </div>
        }
      />

      <div className="gb-page gb-page--center">
        <div className="gb-editCard">
          <div className="gb-editCard__title">Edit Cue</div>
          <div className="gb-editCard__subtitle">{show.title}</div>

          <div className="gb-form">
            <label className="gb-field">
              <div className="gb-field__label">Title</div>
              <input className="gb-input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </label>

            <label className="gb-field">
              <div className="gb-field__label">Subtitle</div>
              <input
                className="gb-input"
                value={draft.subtitle}
                onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                placeholder="Optional"
              />
            </label>

            <label className="gb-field">
              <div className="gb-field__label">Media Path</div>
              <div className="gb-inputRow">
                <input
                  className="gb-input"
                  value={draft.mediaPath}
                  onChange={(e) => setDraft({ ...draft, mediaPath: e.target.value })}
                  placeholder="Optional"
                />
                <button className="gb-miniBtn" type="button" onClick={browseMedia}>
                  Browse…
                </button>
              </div>
            </label>

            <label className="gb-field">
              <div className="gb-field__label">Tone Hz (optional)</div>
              <input
                className="gb-input"
                inputMode="decimal"
                value={draft.toneHz}
                onChange={(e) => setDraft({ ...draft, toneHz: e.target.value })}
                placeholder="e.g. 440"
              />
            </label>

            {parseToneHz(draft.toneHz) && (
              <div className="gb-field">
                <button className="gb-miniBtn" type="button" onClick={exportToneWav}>
                  Export WAV…
                </button>
              </div>
            )}

            <div className="gb-formRow">
              <label className="gb-field">
                <div className="gb-field__label">Gain (dB)</div>
                <input
                  className="gb-input"
                  inputMode="decimal"
                  value={draft.gainDb}
                  onChange={(e) => setDraft({ ...draft, gainDb: e.target.value })}
                />
              </label>

              <label className="gb-field">
                <div className="gb-field__label">Pan (-1..1)</div>
                <input
                  className="gb-input"
                  inputMode="decimal"
                  value={draft.pan}
                  onChange={(e) => setDraft({ ...draft, pan: e.target.value })}
                />
              </label>
            </div>

            <label className="gb-field">
              <div className="gb-field__label">Notes</div>
              <textarea
                className="gb-textarea"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Optional"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
