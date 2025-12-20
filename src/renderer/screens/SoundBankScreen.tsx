import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { useShows } from '../data/ShowsContext';
import type { SoundBankItem } from '../data/seed';
import './SoundBankScreen.css';

function newId(prefix: string) {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  const uuid = g.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function computeSubtitle(cueCount: number, padCount: number) {
  return `${cueCount} cues, — total / ${padCount} hits`;
}

function filenameStem(filePath: string) {
  const trimmed = filePath.trim();
  if (!trimmed) return '';
  const parts = trimmed.split(/[/\\]/);
  const last = parts[parts.length - 1] ?? '';
  return last.replace(/\.[^.]+$/, '');
}

type Panel =
  | { kind: 'add'; title: string; mediaPath: string }
  | { kind: 'rename'; itemId: string; title: string; mediaPath: string }
  | { kind: 'delete'; itemId: string }
  | null;

export default function SoundBankScreen() {
  const { showId } = useParams();
  const navigate = useNavigate();
  const { shows, setShows, soundBank, setSoundBank } = useShows();

  const show = useMemo(() => (showId ? shows.find((s) => s.id === showId) ?? null : null), [showId, shows]);

  const [isEditMode, setIsEditMode] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!panel) return;
    if (panel.kind === 'add' || panel.kind === 'rename') {
      requestAnimationFrame(() => titleInputRef.current?.focus());
    }
  }, [panel]);

  function openAddPanel() {
    setPanel({ kind: 'add', title: '', mediaPath: '' });
  }

  function openRenamePanel(itemId: string) {
    const item = soundBank.find((s) => s.id === itemId);
    if (!item) return;
    setPanel({ kind: 'rename', itemId, title: item.title, mediaPath: item.mediaPath });
  }

  function openDeletePanel(itemId: string) {
    setPanel({ kind: 'delete', itemId });
  }

  function closePanel() {
    setPanel(null);
  }

  async function browseIntoPanel() {
    const openAudioFile = window.app?.dialog?.openAudioFile;
    if (!openAudioFile) return;
    const picked = await openAudioFile();
    if (!picked) return;

    setPanel((p) => {
      if (!p || (p.kind !== 'add' && p.kind !== 'rename')) return p;
      const nextTitle = p.title.trim() ? p.title : filenameStem(picked);
      return { ...p, mediaPath: picked, title: nextTitle };
    });
  }

  function commitPanel() {
    if (!panel) return;

    if (panel.kind === 'add') {
      const title = panel.title.trim();
      const mediaPath = panel.mediaPath.trim();
      if (!title || !mediaPath) return;

      const next: SoundBankItem = { id: newId('bank'), title, mediaPath };
      setSoundBank((prev) => [...prev, next]);
      setPanel(null);
      return;
    }

    if (panel.kind === 'rename') {
      const title = panel.title.trim();
      const mediaPath = panel.mediaPath.trim();
      if (!title || !mediaPath) return;

      setSoundBank((prev) => prev.map((s) => (s.id === panel.itemId ? { ...s, title, mediaPath } : s)));
      setPanel(null);
      return;
    }

    if (panel.kind === 'delete') {
      setSoundBank((prev) => prev.filter((s) => s.id !== panel.itemId));
      setPanel(null);
    }
  }

  function addItemToShowPads(item: SoundBankItem) {
    if (!show) return;

    setShows((prev) =>
      prev.map((s) => {
        if (s.id !== show.id) return s;
        const nextPads = [...(s.pads ?? []), { id: newId('pad'), label: item.title, mediaPath: item.mediaPath }];
        return { ...s, pads: nextPads, subtitle: computeSubtitle(s.cues.length, nextPads.length) };
      })
    );

    navigate(`/shows/${show.id}`);
  }

  const backHref = show ? `/shows/${show.id}` : '/shows';

  return (
    <div className="gb-app">
      <TopBar
        title="Sound Bank"
        right={
          <div className="gb-bankTopRight">
            <button className="gb-link" onClick={() => setIsEditMode((v) => !v)}>
              {isEditMode ? 'Done' : 'Edit'}
            </button>
            <button className="gb-link" onClick={openAddPanel}>
              + Add
            </button>
            <Link to={backHref} className="gb-link">
              ← Back
            </Link>
          </div>
        }
      />

      <div className="gb-page gb-page--center">
        <div className="gb-page__content">
          {show && <div className="gb-bankSubtitle">Add sounds to: {show.title}</div>}

          {panel && (
            <div className="gb-editPanel" role="region" aria-label="Edit sound bank item">
              {panel.kind === 'delete' ? (
                <>
                  <div className="gb-editPanel__title">Delete sound?</div>
                  <div className="gb-editPanel__subtitle">This removes the sound from the bank.</div>
                </>
              ) : (
                <>
                  <div className="gb-editPanel__title">{panel.kind === 'add' ? 'New sound' : 'Rename sound'}</div>
                  <input
                    ref={titleInputRef}
                    className="gb-input"
                    value={panel.title}
                    placeholder="Title"
                    onChange={(e) =>
                      setPanel((p) => (p && (p.kind === 'add' || p.kind === 'rename') ? { ...p, title: e.target.value } : p))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitPanel();
                      if (e.key === 'Escape') closePanel();
                    }}
                  />

                  <div style={{ height: 10 }} />

                  <div className="gb-field__label">Media Path</div>
                  <div className="gb-inputRow">
                    <input
                      className="gb-input"
                      value={panel.mediaPath}
                      placeholder="Select an MP3…"
                      onChange={(e) =>
                        setPanel((p) =>
                          p && (p.kind === 'add' || p.kind === 'rename') ? { ...p, mediaPath: e.target.value } : p
                        )
                      }
                    />
                    <button className="gb-miniBtn" type="button" onClick={browseIntoPanel}>
                      Browse…
                    </button>
                  </div>
                </>
              )}

              <div className="gb-editPanel__actions">
                <button className="gb-miniBtn" onClick={closePanel}>
                  Cancel
                </button>
                <button
                  className={`gb-miniBtn ${panel.kind === 'delete' ? 'gb-miniBtn--danger' : ''}`}
                  onClick={commitPanel}
                >
                  {panel.kind === 'delete' ? 'Delete' : 'Save'}
                </button>
              </div>
            </div>
          )}

          <div className="gb-sectionTitle">SOUND BANK</div>

          <div className="gb-bankList">
            {soundBank.length === 0 && <div className="gb-muted">No sounds yet. Click “+ Add”.</div>}

            {soundBank.map((item) => (
              <div key={item.id} className={`gb-bankCard ${isEditMode ? 'gb-bankCard--edit' : ''}`}>
                <div className="gb-bankCard__title">{item.title}</div>
                <div className="gb-bankCard__path">{item.mediaPath}</div>

                {!isEditMode && show && (
                  <button className="gb-miniBtn" onClick={() => addItemToShowPads(item)}>
                    + Add to Hits
                  </button>
                )}

                {isEditMode && (
                  <div className="gb-bankActions">
                    <button className="gb-miniBtn" onClick={() => openRenamePanel(item.id)}>
                      Rename
                    </button>
                    <button className="gb-miniBtn gb-miniBtn--danger" onClick={() => openDeletePanel(item.id)}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
