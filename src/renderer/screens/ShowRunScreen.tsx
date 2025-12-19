import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { useShows } from '../data/ShowsContext';
import { audioEngine } from '../audio/audioEngine';
import './ShowRunScreen.css';

function newId(prefix: string) {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  const uuid = g.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function renumberCues<T extends { number: number }>(cues: T[]): T[] {
  return cues.map((c, idx) => ({ ...c, number: idx + 1 }));
}

function computeSubtitle(cueCount: number, padCount: number) {
  // Keep it simple for now; we don't have duration totals yet.
  return `${cueCount} cues, — total / ${padCount} hits`;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function formatHz(hz: number) {
  if (!Number.isFinite(hz)) return '';
  // Show integers cleanly, otherwise keep up to 2 decimals.
  const isInt = Math.abs(hz - Math.round(hz)) < 1e-6;
  return isInt ? String(Math.round(hz)) : hz.toFixed(2).replace(/\.00$/, '');
}

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return false;
}

export default function ShowRunScreen() {
  const { showId } = useParams();
  const navigate = useNavigate();
  const { shows, setShows } = useShows();
  const show = useMemo(() => shows.find((s) => s.id === showId) ?? shows[0], [showId, shows]);
  const [selectedCueId, setSelectedCueId] = useState<string | undefined>(undefined);
  const [isCueEditMode, setIsCueEditMode] = useState(false);
  const [isPadEditMode, setIsPadEditMode] = useState(false);
  const [masterVol01, setMasterVol01] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const faderRef = useRef<HTMLDivElement | null>(null);
  const [faderHeightPx, setFaderHeightPx] = useState(0);
  const faderDragRef = useRef<{ pointerId: number; dragging: boolean } | null>(null);
  const [cueProgress, setCueProgress] = useState<Record<string, number>>({});
  const playingCueHandlesRef = useRef(new Map<string, Set<{ stop: () => void; getProgress01: () => number }>>());
  const rafRef = useRef<number | null>(null);
  const [estimatedLatencyMs, setEstimatedLatencyMs] = useState<number | null>(null);
  const lastPlayedCueIdRef = useRef<string | null>(null);
  const [panel, setPanel] = useState<
    | { kind: 'addCue'; title: string }
    | { kind: 'renameCue'; cueId: string; title: string }
    | { kind: 'deleteCue'; cueId: string }
    | { kind: 'addPad'; label: string; mediaPath: string }
    | { kind: 'renamePad'; padId: string; label: string; mediaPath: string }
    | { kind: 'deletePad'; padId: string }
    | null
  >(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSelectedCueId(show?.cues[0]?.id);
  }, [show?.id]);

  useEffect(() => {
    const cues = show?.cues ?? [];

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      // If a panel is open, Escape should close it (and block other hotkeys).
      if (panel) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closePanel();
        }
        return;
      }

      // Cue navigation
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (cues.length === 0) return;
        e.preventDefault();
        const idx = selectedCueId ? cues.findIndex((c) => c.id === selectedCueId) : 0;
        const cur = idx >= 0 ? idx : 0;
        const next = e.key === 'ArrowUp' ? Math.max(0, cur - 1) : Math.min(cues.length - 1, cur + 1);
        setSelectedCueId(cues[next]?.id);
        return;
      }

      // Transport
      if (e.code === 'Space') {
        e.preventDefault();
        void go();
        return;
      }

      const k = e.key.toLowerCase();
      if (k === 's') {
        e.preventDefault();
        stopSelectedCue();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        stopAll();
        return;
      }
      if (k === 'p') {
        e.preventDefault();
        togglePause();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [panel, selectedCueId, show?.id]);

  useEffect(() => {
    const onRemoteCommand = window.app?.onRemoteCommand;
    if (!onRemoteCommand) return;

    const cues = show?.cues ?? [];

    onRemoteCommand((cmd) => {
      if (cmd === 'go') {
        void go();
        return;
      }
      if (cmd === 'stopAll') {
        stopAll();
        return;
      }
      if (cmd === 'stopCue') {
        stopSelectedCue();
        return;
      }
      if (cmd === 'pauseToggle') {
        togglePause();
        return;
      }
      if (cmd === 'selectUp' || cmd === 'selectDown') {
        if (cues.length === 0) return;
        const idx = selectedCueId ? cues.findIndex((c) => c.id === selectedCueId) : 0;
        const cur = idx >= 0 ? idx : 0;
        const next = cmd === 'selectUp' ? Math.max(0, cur - 1) : Math.min(cues.length - 1, cur + 1);
        setSelectedCueId(cues[next]?.id);
      }
    });
  }, [selectedCueId, show?.id]);

  useEffect(() => {
    if (!show) return;

    const paths: string[] = [];

    // Preload the selected cue and the next couple cues to reduce first-press MP3 decode delays.
    const cues = show.cues ?? [];
    const selectedIdx = selectedCueId ? cues.findIndex((c) => c.id === selectedCueId) : 0;
    const startIdx = selectedIdx >= 0 ? selectedIdx : 0;
    for (let i = startIdx; i < Math.min(cues.length, startIdx + 3); i++) {
      const p = cues[i]?.mediaPath;
      if (p) paths.push(p);
    }

    // Preload all configured hit/pad sounds (usually a small count).
    for (const pad of show.pads ?? []) {
      if (pad.mediaPath) paths.push(pad.mediaPath);
    }

    audioEngine.preloadFiles(paths);
  }, [show?.id, selectedCueId]);

  useEffect(() => {
    audioEngine.setMasterVolume01(masterVol01);
  }, [masterVol01]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);

  useEffect(() => {
    const el = faderRef.current;
    if (!el) return;

    const update = () => setFaderHeightPx(el.getBoundingClientRect().height);
    update();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => update());
      ro.observe(el);
    }

    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      ro?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!panel) return;
    if (panel.kind === 'addCue' || panel.kind === 'renameCue' || panel.kind === 'addPad' || panel.kind === 'renamePad') {
      requestAnimationFrame(() => titleInputRef.current?.focus());
    }
  }, [panel]);

  const selectedCue = show?.cues.find((c) => c.id === selectedCueId) ?? show?.cues[0];

  const stopTargetCueId = useMemo(() => {
    const selectedId = selectedCueId;
    if (selectedId && (playingCueHandlesRef.current.get(selectedId)?.size ?? 0) > 0) return selectedId;

    const last = lastPlayedCueIdRef.current;
    if (last && (playingCueHandlesRef.current.get(last)?.size ?? 0) > 0) return last;

    const it = playingCueHandlesRef.current.keys().next();
    return it.done ? null : it.value;
  }, [selectedCueId, cueProgress]);

  const cuePanel =
    panel && (panel.kind === 'addCue' || panel.kind === 'renameCue' || panel.kind === 'deleteCue') ? panel : null;
  const padPanel =
    panel && (panel.kind === 'addPad' || panel.kind === 'renamePad' || panel.kind === 'deletePad') ? panel : null;

  function updateShowCues(updater: (prevCues: typeof show.cues) => typeof show.cues) {
    if (!show) return;
    setShows((prev) =>
      prev.map((s) => {
        if (s.id !== show.id) return s;
        const nextCues = updater(s.cues);
        return {
          ...s,
          cues: nextCues,
          subtitle: computeSubtitle(nextCues.length, s.pads.length),
        };
      })
    );
  }

  function updateShowPads(updater: (prevPads: typeof show.pads) => typeof show.pads) {
    if (!show) return;
    setShows((prev) =>
      prev.map((s) => {
        if (s.id !== show.id) return s;
        const nextPads = updater(s.pads);
        return {
          ...s,
          pads: nextPads,
          subtitle: computeSubtitle(s.cues.length, nextPads.length),
        };
      })
    );
  }

  function openAddCue() {
    setPanel({ kind: 'addCue', title: 'New Cue' });
  }

  function openRenameCue(cueId: string) {
    const cue = show?.cues.find((c) => c.id === cueId);
    if (!cue) return;
    setPanel({ kind: 'renameCue', cueId, title: cue.title });
  }

  function openDeleteCue(cueId: string) {
    setPanel({ kind: 'deleteCue', cueId });
  }

  function openAddPad() {
    if (!isPadEditMode) return;
    setPanel({ kind: 'addPad', label: 'New Hit', mediaPath: '' });
  }

  function openRenamePad(padId: string) {
    const pad = show?.pads.find((p) => p.id === padId);
    if (!pad) return;
    setPanel({ kind: 'renamePad', padId, label: pad.label, mediaPath: pad.mediaPath ?? '' });
  }

  function openDeletePad(padId: string) {
    setPanel({ kind: 'deletePad', padId });
  }

  function closePanel() {
    setPanel(null);
  }

  function commitPanel() {
    if (!show || !panel) return;

    if (panel.kind === 'addCue') {
      const title = panel.title.trim();
      if (!title) return;
      const cueId = newId('cue');

      updateShowCues((prev) => {
        const next = [...prev, { id: cueId, number: prev.length + 1, title }];
        return renumberCues(next);
      });
      setSelectedCueId(cueId);
      setPanel(null);
      return;
    }

    if (panel.kind === 'renameCue') {
      const title = panel.title.trim();
      if (!title) return;
      updateShowCues((prev) => prev.map((c) => (c.id === panel.cueId ? { ...c, title } : c)));
      setPanel(null);
      return;
    }

    if (panel.kind === 'deleteCue') {
      updateShowCues((prev) => {
        const next = prev.filter((c) => c.id !== panel.cueId);
        return renumberCues(next);
      });

      if (selectedCueId === panel.cueId) {
        const remaining = show.cues.filter((c) => c.id !== panel.cueId);
        setSelectedCueId(remaining[0]?.id);
      }

      setPanel(null);
      return;
    }

    if (panel.kind === 'addPad') {
      const label = panel.label.trim();
      if (!label) return;
      const padId = newId('pad');
      const mediaPath = panel.mediaPath.trim();
      updateShowPads((prev) => [...prev, { id: padId, label, mediaPath: mediaPath ? mediaPath : undefined }]);
      setPanel(null);
      return;
    }

    if (panel.kind === 'renamePad') {
      const label = panel.label.trim();
      if (!label) return;
      const mediaPath = panel.mediaPath.trim();
      updateShowPads((prev) =>
        prev.map((p) =>
          p.id === panel.padId ? { ...p, label, mediaPath: mediaPath ? mediaPath : undefined } : p
        )
      );
      setPanel(null);
      return;
    }

    if (panel.kind === 'deletePad') {
      updateShowPads((prev) => prev.filter((p) => p.id !== panel.padId));
      setPanel(null);
    }
  }

  function moveCue(cueId: string, direction: -1 | 1) {
    updateShowCues((prev) => {
      const idx = prev.findIndex((c) => c.id === cueId);
      if (idx < 0) return prev;
      const nextIdx = idx + direction;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[idx];
      next[idx] = next[nextIdx];
      next[nextIdx] = tmp;
      return renumberCues(next);
    });
  }

  function openCueEdit(cueId: string) {
    if (!show) return;
    navigate(`/shows/${show.id}/cues/${cueId}`);
  }

  async function go() {
    if (!selectedCue?.id) return;

    const playedCueId = selectedCue.id;

    const toneHz = selectedCue.toneHz;
    const filePath = selectedCue.mediaPath;

    const handle =
      typeof toneHz === 'number' && Number.isFinite(toneHz) && toneHz > 0
        ? await audioEngine.playTone({ hz: toneHz, seconds: 1.0, gainDb: selectedCue.gainDb ?? 0, pan: selectedCue.pan ?? 0 })
        : filePath
          ? await audioEngine.playFile({ filePath, gainDb: selectedCue.gainDb ?? 0, pan: selectedCue.pan ?? 0 })
          : null;
    if (!handle || !selectedCue?.id) return;

    setEstimatedLatencyMs(audioEngine.getEstimatedOutputLatencyMs());

    const existing = playingCueHandlesRef.current.get(playedCueId);
    if (existing) existing.add(handle);
    else playingCueHandlesRef.current.set(playedCueId, new Set([handle]));

    lastPlayedCueIdRef.current = playedCueId;

    if (!rafRef.current) {
      const tick = () => {
        const next: Record<string, number> = {};
        for (const [cueId, set] of playingCueHandlesRef.current.entries()) {
          let maxP = 0;
          for (const h of Array.from(set)) {
            const p = h.getProgress01();
            if (p >= 1) {
              set.delete(h);
              continue;
            }
            maxP = Math.max(maxP, p);
          }
          if (set.size === 0) {
            playingCueHandlesRef.current.delete(cueId);
            continue;
          }
          next[cueId] = maxP;
        }
        setCueProgress(next);
        rafRef.current = playingCueHandlesRef.current.size > 0 ? requestAnimationFrame(tick) : null;
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    const cues = show?.cues ?? [];
    const idx = cues.findIndex((c) => c.id === playedCueId);
    if (idx >= 0 && idx + 1 < cues.length) {
      setSelectedCueId(cues[idx + 1].id);
    }
  }

  function stopAll() {
    audioEngine.stopAll();

    playingCueHandlesRef.current.clear();
    setCueProgress({});
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    lastPlayedCueIdRef.current = null;

    setIsPaused(false);
  }

  function stopSelectedCue() {
    const selectedId = selectedCueId;
    const selectedSetSize = selectedId ? (playingCueHandlesRef.current.get(selectedId)?.size ?? 0) : 0;
    const lastId = lastPlayedCueIdRef.current;
    const lastSetSize = lastId ? (playingCueHandlesRef.current.get(lastId)?.size ?? 0) : 0;

    const cueId = selectedSetSize > 0 ? selectedId : lastSetSize > 0 ? lastId : playingCueHandlesRef.current.keys().next().value;
    if (!cueId) return;

    const set = playingCueHandlesRef.current.get(cueId);
    if (!set || set.size === 0) return;

    for (const h of Array.from(set)) h.stop();
    playingCueHandlesRef.current.delete(cueId);
    setCueProgress((prev) => {
      const next = { ...prev };
      delete next[cueId];
      return next;
    });
  }

  function togglePause() {
    setIsPaused((prev) => {
      const next = !prev;
      if (next) audioEngine.pauseAll();
      else audioEngine.resumeAll();
      return next;
    });
  }

  async function playPad(padId: string) {
    if (!show) return;
    const pad = show.pads.find((p) => p.id === padId);
    const filePath = pad?.mediaPath;
    if (!filePath) return;
    await audioEngine.playFile({ filePath });
    setEstimatedLatencyMs(audioEngine.getEstimatedOutputLatencyMs());
  }

  function movePad(padId: string, direction: -1 | 1) {
    updateShowPads((prev) => {
      const idx = prev.findIndex((p) => p.id === padId);
      if (idx < 0) return prev;
      const nextIdx = idx + direction;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[idx];
      next[idx] = next[nextIdx];
      next[nextIdx] = tmp;
      return next;
    });
  }

  function updateMasterFromClientY(clientY: number) {
    const el = faderRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const trackInsetPx = 12;
    const y = clamp(clientY - r.top, trackInsetPx, r.height - trackInsetPx);
    const t = 1 - (y - trackInsetPx) / (r.height - trackInsetPx * 2);
    audioEngine.setMasterVolume01(t);
    setMasterVol01(t);
  }

  return (
    <div className="gb-app">
      <TopBar
        title={show?.title ?? 'Show'}
        right={
          <div className="gb-runTopRight">
            <button className="gb-iconBtn" aria-label="Add cue" title="Add cue" onClick={openAddCue}>
              ＋
            </button>
            <button className="gb-link" onClick={() => setIsCueEditMode((v) => !v)}>
              {isCueEditMode ? 'Done' : 'Edit'}
            </button>
          </div>
        }
      />

      <div className="gb-runLayout">
        <aside className="gb-master">
          <div className="gb-dimBtn">DIM</div>
          <div
            ref={faderRef}
            className="gb-fader"
            role="slider"
            aria-label="Master volume"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(masterVol01 * 100)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') setMasterVol01((v) => Math.min(1, v + 0.02));
              if (e.key === 'ArrowDown') setMasterVol01((v) => Math.max(0, v - 0.02));
            }}
            onPointerDown={(e) => {
              const el = faderRef.current;
              if (!el) return;
              faderDragRef.current = { pointerId: e.pointerId, dragging: true };
              try {
                el.setPointerCapture(e.pointerId);
              } catch {
                // ignore
              }
              updateMasterFromClientY(e.clientY);
            }}
            onPointerMove={(e) => {
              const drag = faderDragRef.current;
              if (!drag?.dragging) return;
              if (drag.pointerId !== e.pointerId) return;
              updateMasterFromClientY(e.clientY);
            }}
            onPointerUp={(e) => {
              const el = faderRef.current;
              const drag = faderDragRef.current;
              if (!drag?.dragging) return;
              if (drag.pointerId !== e.pointerId) return;
              drag.dragging = false;
              try {
                el?.releasePointerCapture(e.pointerId);
              } catch {
                // ignore
              }
            }}
            onPointerCancel={(e) => {
              const el = faderRef.current;
              const drag = faderDragRef.current;
              if (!drag?.dragging) return;
              if (drag.pointerId !== e.pointerId) return;
              drag.dragging = false;
              try {
                el?.releasePointerCapture(e.pointerId);
              } catch {
                // ignore
              }
            }}
          >
            <div className="gb-fader__track" />
            {(() => {
              const trackInsetPx = 12;
              const thumbHeightPx = 16;
              const h = faderHeightPx || 0;
              const trackLen = Math.max(1, h - trackInsetPx * 2);
              const y = trackInsetPx + (1 - masterVol01) * trackLen;
              const top = y - thumbHeightPx / 2;
              return <div className="gb-fader__thumb" style={{ top: `${top}px` }} />;
            })()}
          </div>
          <div className="gb-masterSpacer" />
          <div className="gb-masterVolumeLabel">
            <div className="gb-pill">Volume</div>
          </div>
        </aside>

        <main className="gb-stage">
          <section className="gb-currentCue">
            <div className="gb-currentCue__number">{selectedCue?.number}</div>
            <div
              className="gb-currentCue__title gb-currentCue__title--clickable"
              role="button"
              tabIndex={0}
              onClick={() => {
                if (selectedCue?.id) openCueEdit(selectedCue.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (selectedCue?.id) openCueEdit(selectedCue.id);
                }
              }}
              aria-label="Edit current cue"
              title="Edit cue"
            >
              {selectedCue?.title}
            </div>
            <div className="gb-currentCue__fades">
              <div className="gb-muted">Fade In</div>
              <div className="gb-muted">Loop</div>
              <div className="gb-muted">Fade Out</div>
            </div>
          </section>

          <section className="gb-bottom">
            <div className="gb-soundboardHeader">
              <div className="gb-soundboardTitle">Hits</div>
              <div className="gb-soundboardActions">
                <button className="gb-iconBtn" aria-label="Add hit" title="Add hit" onClick={openAddPad} disabled={!isPadEditMode}>
                  ＋
                </button>
                <button className="gb-link" onClick={() => setIsPadEditMode((v) => !v)}>
                  {isPadEditMode ? 'Done' : 'Edit'}
                </button>
              </div>
            </div>

            {padPanel && (
              <div className="gb-padPanel" role="region" aria-label="Edit hit">
                {padPanel.kind === 'deletePad' ? (
                  <>
                    <div className="gb-cuePanel__title">Delete hit?</div>
                    <div className="gb-cuePanel__subtitle">This removes the hit from the board.</div>
                  </>
                ) : (
                  <>
                    <div className="gb-cuePanel__title">{padPanel.kind === 'addPad' ? 'New hit' : 'Rename hit'}</div>
                    <input
                      ref={titleInputRef}
                      className="gb-input"
                      value={padPanel.label}
                      onChange={(e) =>
                        setPanel((p) =>
                          p && (p.kind === 'addPad' || p.kind === 'renamePad') ? { ...p, label: e.target.value } : p
                        )
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
                        value={padPanel.mediaPath}
                        onChange={(e) =>
                          setPanel((p) =>
                            p && (p.kind === 'addPad' || p.kind === 'renamePad')
                              ? { ...p, mediaPath: e.target.value }
                              : p
                          )
                        }
                        placeholder="Optional"
                      />
                      <button
                        className="gb-miniBtn"
                        type="button"
                        onClick={async () => {
                          const openAudioFile = window.app?.dialog?.openAudioFile;
                          if (!openAudioFile) return;
                          const picked = await openAudioFile();
                          if (!picked) return;
                          setPanel((p) =>
                            p && (p.kind === 'addPad' || p.kind === 'renamePad') ? { ...p, mediaPath: picked } : p
                          );
                        }}
                      >
                        Browse…
                      </button>
                    </div>
                  </>
                )}

                <div className="gb-cuePanel__actions">
                  <button className="gb-miniBtn" onClick={closePanel}>
                    Cancel
                  </button>
                  <button className={`gb-miniBtn ${padPanel.kind === 'deletePad' ? 'gb-miniBtn--danger' : ''}`} onClick={commitPanel}>
                    {padPanel.kind === 'deletePad' ? 'Delete' : 'Save'}
                  </button>
                </div>
              </div>
            )}

            <div className="gb-pads">
              {show?.pads.map((p, idx) => (
                <div
                  key={p.id}
                  className="gb-pad gb-pad--red"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (isPadEditMode) openRenamePad(p.id);
                      else void playPad(p.id);
                    }
                  }}
                  onClick={() => {
                    if (isPadEditMode) openRenamePad(p.id);
                    else void playPad(p.id);
                  }}
                >
                  <div className="gb-padTop">
                    <div className="gb-pad__num">{idx + 1}</div>
                    {isPadEditMode && (
                      <div className="gb-padActions" onClick={(e) => e.stopPropagation()}>
                        <button className="gb-padIconBtn" title="Rename" aria-label="Rename pad" onClick={() => openRenamePad(p.id)}>
                          ✎
                        </button>
                        <button className="gb-padIconBtn" title="Move up" aria-label="Move pad up" onClick={() => movePad(p.id, -1)}>
                          ↑
                        </button>
                        <button className="gb-padIconBtn" title="Move down" aria-label="Move pad down" onClick={() => movePad(p.id, 1)}>
                          ↓
                        </button>
                        <button
                          className="gb-padIconBtn gb-padIconBtn--danger"
                          title="Delete"
                          aria-label="Delete pad"
                          onClick={() => openDeletePad(p.id)}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="gb-pad__label">{p.label}</div>
                  <div className="gb-pad__meta">00:00,0 · -00:0…</div>
                </div>
              ))}
              <button className="gb-pad gb-pad--add" aria-label="Add pad" onClick={openAddPad} disabled={!isPadEditMode}>
                +
              </button>
            </div>

            <div className="gb-transport">
              <div>
                <div className="gb-clock">13:46:59</div>
                {estimatedLatencyMs != null && (
                  <div className="gb-clockSub">~{Math.round(estimatedLatencyMs)} ms output latency</div>
                )}
              </div>
              <div className="gb-transportBtns">
                <button className="gb-btn gb-btn--ghost" onClick={stopSelectedCue} disabled={!stopTargetCueId}>
                  Stop Cue
                </button>
                <button className="gb-btn gb-btn--ghost" onClick={stopAll}>
                  Stop All
                </button>
                <button className="gb-btn gb-btn--ghost" onClick={togglePause}>
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
                <button className="gb-btn gb-btn--go" onClick={go}>
                  Go {selectedCue?.number}
                </button>
              </div>
            </div>
          </section>
        </main>

        <aside className="gb-cues">
          {cuePanel && (
            <div className="gb-cuePanel" role="region" aria-label="Edit item">
              {cuePanel.kind === 'deleteCue' ? (
                <>
                  <div className="gb-cuePanel__title">
                    Delete cue?
                  </div>
                  <div className="gb-cuePanel__subtitle">
                    This removes the cue from the list.
                  </div>
                </>
              ) : (
                <>
                  <div className="gb-cuePanel__title">
                    {cuePanel.kind === 'addCue'
                      ? 'New cue'
                      : 'Rename cue'}
                  </div>
                  <input
                    ref={titleInputRef}
                    className="gb-input"
                    value={cuePanel.kind === 'addCue' || cuePanel.kind === 'renameCue' ? cuePanel.title : ''}
                    onChange={(e) =>
                      setPanel((p) =>
                        p && (p.kind === 'addCue' || p.kind === 'renameCue')
                          ? { ...p, title: e.target.value }
                          : p
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitPanel();
                      if (e.key === 'Escape') closePanel();
                    }}
                  />
                </>
              )}

              <div className="gb-cuePanel__actions">
                <button className="gb-miniBtn" onClick={closePanel}>
                  Cancel
                </button>
                <button
                  className={`gb-miniBtn ${cuePanel.kind === 'deleteCue' ? 'gb-miniBtn--danger' : ''}`}
                  onClick={commitPanel}
                >
                  {cuePanel.kind === 'deleteCue' ? 'Delete' : 'Save'}
                </button>
              </div>
            </div>
          )}

          <div className="gb-cueList">
            {show?.cues.map((c) => {
              const isSelected = c.id === selectedCueId;
              const p = cueProgress[c.id] ?? 0;
              const isPlaying = p > 0 && p < 1;
              return (
                <div
                  key={c.id}
                  className={`gb-cueRow ${isSelected ? 'gb-cueRow--selected' : ''} ${isPlaying ? 'gb-cueRow--playing' : ''}`}
                  onClick={() => setSelectedCueId(c.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedCueId(c.id);
                    }
                  }}
                >
                  <div className={`gb-cueBadge ${c.number === 1 ? 'gb-cueBadge--amber' : 'gb-cueBadge--red'}`}>{c.number}</div>
                  <div className="gb-cueText">
                    <div className="gb-cueTitle">{c.title}</div>
                    <div className="gb-cueMeta">
                      <span>00:00,0</span>
                      <span className="gb-cueDot" />
                      <span>{c.durationLabel ?? ''}</span>
                      {typeof c.toneHz === 'number' && Number.isFinite(c.toneHz) && c.toneHz > 0 && (
                        <>
                          <span className="gb-cueDot" />
                          <span>{`TONE ${formatHz(c.toneHz)} Hz`}</span>
                        </>
                      )}
                    </div>
                    <div className="gb-cueProgress">
                      <div className="gb-cueProgress__thumb" style={{ left: `${p * 100}%` }} />
                    </div>
                  </div>

                  {!isCueEditMode && <div className="gb-cueGrip">≡</div>}

                  {isCueEditMode && (
                    <div className="gb-cueActions" onClick={(e) => e.stopPropagation()}>
                      <button className="gb-miniBtn" onClick={() => openCueEdit(c.id)}>
                        Edit
                      </button>
                      <button className="gb-miniBtn" onClick={() => openRenameCue(c.id)}>
                        Rename
                      </button>
                      <button className="gb-miniBtn" onClick={() => moveCue(c.id, -1)}>
                        ↑
                      </button>
                      <button className="gb-miniBtn" onClick={() => moveCue(c.id, 1)}>
                        ↓
                      </button>
                      <button className="gb-miniBtn gb-miniBtn--danger" onClick={() => openDeleteCue(c.id)}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="gb-backLink">
            <Link to="/shows" className="gb-link">← Back</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
