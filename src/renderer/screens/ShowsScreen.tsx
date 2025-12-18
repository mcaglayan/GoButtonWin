import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { useShows } from '../data/ShowsContext';
import './ShowsScreen.css';

function newId(prefix: string) {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  const uuid = g.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ShowsScreen() {
  const navigate = useNavigate();
  const { isLoaded, shows } = useShows();
  const { setShows } = useShows();
  const [isEditMode, setIsEditMode] = useState(false);

  const [panel, setPanel] = useState<
    | { kind: 'create'; title: string }
    | { kind: 'rename'; showId: string; title: string }
    | { kind: 'delete'; showId: string }
    | null
  >(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const canCreate = useMemo(() => true, []);

  useEffect(() => {
    if (panel && (panel.kind === 'create' || panel.kind === 'rename')) {
      // Let the panel render before focusing.
      requestAnimationFrame(() => titleInputRef.current?.focus());
    }
  }, [panel]);

  function openCreatePanel() {
    setPanel({ kind: 'create', title: 'New Show' });
  }

  function openRenamePanel(showId: string) {
    const current = shows.find((s) => s.id === showId);
    if (!current) return;

    setPanel({ kind: 'rename', showId, title: current.title });
  }

  function onDuplicateShow(showId: string) {
    const current = shows.find((s) => s.id === showId);
    if (!current) return;

    const copyId = newId('show');
    const copied = {
      ...current,
      id: copyId,
      title: `${current.title} (Copy)`,
      cues: current.cues.map((c) => ({ ...c, id: newId('cue') })),
      pads: current.pads.map((p) => ({ ...p, id: newId('pad') })),
    };

    setShows((prev) => [...prev, copied]);
  }

  function openDeletePanel(showId: string) {
    const current = shows.find((s) => s.id === showId);
    if (!current) return;

    setPanel({ kind: 'delete', showId });
  }

  function closePanel() {
    setPanel(null);
  }

  function commitPanel() {
    if (!panel) return;

    if (panel.kind === 'create') {
      const title = panel.title.trim();
      if (!title) return;

      const showId = newId('show');
      setShows((prev) => [
        ...prev,
        {
          id: showId,
          title,
          subtitle: '0 cues, 0:00 total / 0 hits',
          cues: [],
          pads: [],
        },
      ]);
      setPanel(null);
      return;
    }

    if (panel.kind === 'rename') {
      const title = panel.title.trim();
      if (!title) return;

      setShows((prev) => prev.map((s) => (s.id === panel.showId ? { ...s, title } : s)));
      setPanel(null);
      return;
    }

    if (panel.kind === 'delete') {
      setShows((prev) => prev.filter((s) => s.id !== panel.showId));
      setPanel(null);
    }
  }

  return (
    <div className="gb-app">
      <TopBar
        title="Go Button"
        right={
          <div className="gb-showsTopRight">
            <button className="gb-link" onClick={() => setIsEditMode((v) => !v)}>
              {isEditMode ? 'Done' : 'Edit'}
            </button>
            <button className="gb-link" onClick={openCreatePanel} disabled={!canCreate}>
              + New
            </button>
          </div>
        }
      />

      <div className="gb-page gb-page--center">
        <div className="gb-page__content">
          <div className="gb-sectionTitle">SHOWS</div>

          {panel && (
            <div className="gb-editPanel" role="region" aria-label="Edit show">
              {panel.kind === 'delete' ? (
                <>
                  <div className="gb-editPanel__title">Delete show?</div>
                  <div className="gb-editPanel__subtitle">
                    This removes the show from your list (you can’t undo).
                  </div>
                </>
              ) : (
                <>
                  <div className="gb-editPanel__title">{panel.kind === 'create' ? 'New show' : 'Rename show'}</div>
                  <input
                    ref={titleInputRef}
                    className="gb-input"
                    value={panel.title}
                    onChange={(e) =>
                      setPanel((p) =>
                        p && (p.kind === 'create' || p.kind === 'rename') ? { ...p, title: e.target.value } : p
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitPanel();
                      if (e.key === 'Escape') closePanel();
                    }}
                  />
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

          <div className="gb-showList">
            {!isLoaded && <div className="gb-muted">Loading…</div>}
            {shows.map((s) => (
              <div
                key={s.id}
                className={`gb-showCard ${isEditMode ? 'gb-showCard--edit' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (isEditMode) return;
                  navigate(`/shows/${s.id}`);
                }}
                onKeyDown={(e) => {
                  if (isEditMode) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/shows/${s.id}`);
                  }
                }}
              >
                <div className="gb-showCard__title">{s.title}</div>
                <div className="gb-showCard__subtitle">{s.subtitle}</div>

                {!isEditMode && <div className="gb-showCard__chev">›</div>}

                {isEditMode && (
                  <div className="gb-showActions" onClick={(e) => e.stopPropagation()}>
                    <button className="gb-miniBtn" onClick={() => openRenamePanel(s.id)}>
                      Rename
                    </button>
                    <button className="gb-miniBtn" onClick={() => onDuplicateShow(s.id)}>
                      Duplicate
                    </button>
                    <button className="gb-miniBtn gb-miniBtn--danger" onClick={() => openDeletePanel(s.id)}>
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
