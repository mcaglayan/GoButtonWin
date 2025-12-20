function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function dbToGain(db: number) {
  // gain = 10^(db/20)
  return Math.pow(10, db / 20);
}

type PlayOptions = {
  filePath: string;
  gainDb?: number;
  pan?: number;
};

type ToneOptions = {
  hz: number;
  seconds?: number;
  gainDb?: number;
  pan?: number;
};

type PlayingHandle = {
  stop: () => void;
  pause: () => void;
  resume: () => void;
  isPaused: () => boolean;
  getProgress01: () => number;
};

class AudioEngine {
  private ctx: AudioContext | null = null;
  private active = new Set<PlayingHandle>();
  private decodedByPath = new Map<string, Promise<AudioBuffer>>();
  private masterGain: GainNode | null = null;

  private ensureContext() {
    if (this.ctx) return this.ctx;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1;
    this.masterGain.connect(this.ctx.destination);
    return this.ctx;
  }

  getEstimatedOutputLatencyMs(): number | null {
    if (!this.ctx) return null;
    const anyCtx = this.ctx as unknown as { baseLatency?: number; outputLatency?: number };
    const base = typeof anyCtx.baseLatency === 'number' ? anyCtx.baseLatency : 0;
    const out = typeof anyCtx.outputLatency === 'number' ? anyCtx.outputLatency : 0;
    const total = base + out;
    return Number.isFinite(total) && total > 0 ? total * 1000 : null;
  }

  setMasterVolume01(v: number) {
    const ctx = this.ensureContext();
    const gain = clamp(v, 0, 1);
    if (!this.masterGain) {
      this.masterGain = ctx.createGain();
      this.masterGain.connect(ctx.destination);
    }
    // Small smoothing to avoid zipper noise.
    const now = ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(gain, now, 0.01);
  }

  async playTone(opts: ToneOptions): Promise<PlayingHandle | null> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // ignore
      }
    }

    const hz = Number(opts.hz);
    if (!Number.isFinite(hz) || hz <= 0) return null;

    const seconds = clamp(Number(opts.seconds ?? 1.0), 0.05, 60);
    const duration = seconds;

    const gainNode = ctx.createGain();
    gainNode.gain.value = dbToGain(opts.gainDb ?? 0);

    const panner = ctx.createStereoPanner();
    panner.pan.value = clamp(opts.pan ?? 0, -1, 1);

    gainNode.connect(panner);
    panner.connect(this.masterGain ?? ctx.destination);

    let osc: OscillatorNode | null = null;
    let startTime = 0;
    let offset = 0;
    let paused = false;
    let finished = false;
    let stopping = false;
    let oscToken = 0;

    const cleanup = () => {
      // Idempotent cleanup.
      stopping = true;

      try {
        osc?.stop();
      } catch {
        // ignore
      }
      try {
        osc?.disconnect();
      } catch {
        // ignore
      }
      osc = null;

      try {
        gainNode.disconnect();
        panner.disconnect();
      } catch {
        // ignore
      }

      this.active.delete(handle);
    };

    const connectAndStart = () => {
      if (finished) return;
      const myToken = ++oscToken;

      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = hz;
      o.connect(gainNode);
      startTime = ctx.currentTime;
      stopping = false;

      o.addEventListener(
        'ended',
        () => {
          // Ignore late 'ended' from a previous oscillator (pause/resume edge case).
          if (myToken !== oscToken) return;
          if (stopping) return;
          finished = true;
          paused = false;
          offset = 0;
          cleanup();
        },
        { once: true }
      );

      osc = o;

      // Play the remaining duration.
      const remaining = Math.max(0, duration - offset);
      // In WebAudio, calling stop() schedules an ended event.
      o.start();
      o.stop(ctx.currentTime + remaining);
    };

    const handle: PlayingHandle = {
      stop: () => {
        finished = true;
        paused = false;
        offset = 0;
        // Invalidate any pending 'ended' events.
        oscToken++;
        cleanup();
      },
      pause: () => {
        if (finished || paused) return;
        if (!osc) return;
        paused = true;
        stopping = true;
        offset += Math.max(0, ctx.currentTime - startTime);

        // Invalidate any pending 'ended' events for this oscillator.
        oscToken++;

        try {
          osc.stop();
        } catch {
          // ignore
        }
        try {
          osc.disconnect();
        } catch {
          // ignore
        }
        osc = null;
      },
      resume: () => {
        if (finished || !paused) return;
        paused = false;
        stopping = false;
        if (duration && offset >= duration) {
          handle.stop();
          return;
        }
        connectAndStart();
      },
      isPaused: () => paused,
      getProgress01: () => {
        if (!duration) return 0;
        const played = paused ? offset : offset + Math.max(0, ctx.currentTime - startTime);
        return clamp(played / duration, 0, 1);
      },
    };

    this.active.add(handle);
    connectAndStart();
    return handle;
  }

  private async decodeFile(filePath: string): Promise<AudioBuffer> {
    const readFile = window.app?.audio?.readFile;
    if (!readFile) throw new Error('Audio readFile API not available');

    const bytes = await readFile(filePath);
    // Ensure we pass a standalone ArrayBuffer (not a SharedArrayBuffer union) into decodeAudioData.
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const arrayBuffer = copy.buffer;

    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // ignore
      }
    }

    // Some browsers require callback-style decodeAudioData, but Electron supports promise.
    return await ctx.decodeAudioData(arrayBuffer);
  }

  async getFileDurationSeconds(filePath: string): Promise<number | null> {
    const p = filePath.trim();
    if (!p) return null;
    try {
      const bufferPromise = this.decodedByPath.get(p) ?? this.decodeFile(p);
      this.decodedByPath.set(p, bufferPromise);
      const buffer = await bufferPromise;
      const dur = Number(buffer.duration || 0);
      return Number.isFinite(dur) && dur > 0 ? dur : null;
    } catch {
      return null;
    }
  }

  preloadFile(filePath: string | null | undefined) {
    const p = (filePath ?? '').trim();
    if (!p) return;
    if (this.decodedByPath.has(p)) return;

    const bufferPromise = this.decodeFile(p).catch((err) => {
      // If preload fails, drop it from cache so a later attempt can retry.
      this.decodedByPath.delete(p);
      console.warn('[audio] preload failed', p, err);
      throw err;
    });

    this.decodedByPath.set(p, bufferPromise);
  }

  preloadFiles(filePaths: Array<string | null | undefined>) {
    for (const p of filePaths) this.preloadFile(p);
  }

  clearDecodedCache() {
    this.decodedByPath.clear();
  }

  async playFile(opts: PlayOptions): Promise<PlayingHandle | null> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // ignore
      }
    }

    try {
      const bufferPromise = this.decodedByPath.get(opts.filePath) ?? this.decodeFile(opts.filePath);
      this.decodedByPath.set(opts.filePath, bufferPromise);
      const buffer = await bufferPromise;

      const duration = buffer.duration || 0;

      const gainNode = ctx.createGain();
      gainNode.gain.value = dbToGain(opts.gainDb ?? 0);

      const panner = ctx.createStereoPanner();
      panner.pan.value = clamp(opts.pan ?? 0, -1, 1);

      gainNode.connect(panner);
      panner.connect(this.masterGain ?? ctx.destination);

      let source: AudioBufferSourceNode | null = null;
      let startTime = 0;
      let offset = 0;
      let paused = false;
      let finished = false;
      let stopping = false;
      let sourceToken = 0;

      const cleanup = () => {
        // Idempotent cleanup.
        stopping = true;

        try {
          source?.stop();
        } catch {
          // ignore
        }
        try {
          source?.disconnect();
        } catch {
          // ignore
        }
        source = null;

        try {
          gainNode.disconnect();
          panner.disconnect();
        } catch {
          // ignore
        }

        this.active.delete(handle);
      };

      const connectAndStart = () => {
        if (finished) return;
        const myToken = ++sourceToken;
        const s = ctx.createBufferSource();
        s.buffer = buffer;
        s.connect(gainNode);
        startTime = ctx.currentTime;
        stopping = false;

        s.addEventListener(
          'ended',
          () => {
            // If we stopped it for pause/stop, ignore this ended.
            if (myToken !== sourceToken) return;
            if (stopping) return;
            finished = true;
            paused = false;
            offset = 0;
            cleanup();
          },
          { once: true }
        );

        source = s;
        s.start(0, offset);
      };

      const handle: PlayingHandle = {
        stop: () => {
          finished = true;
          paused = false;
          offset = 0;
          // Invalidate any pending 'ended' events.
          sourceToken++;
          cleanup();
        },
        pause: () => {
          if (finished || paused) return;
          if (!source) return;
          paused = true;
          stopping = true;
          offset += Math.max(0, ctx.currentTime - startTime);

          // Invalidate any pending 'ended' events for this source.
          sourceToken++;

          try {
            source.stop();
          } catch {
            // ignore
          }
          try {
            source.disconnect();
          } catch {
            // ignore
          }
          source = null;
        },
        resume: () => {
          if (finished || !paused) return;
          paused = false;
          stopping = false;
          if (duration && offset >= duration) {
            // Already at end.
            handle.stop();
            return;
          }
          connectAndStart();
        },
        isPaused: () => paused,
        getProgress01: () => {
          if (!duration) return 0;
          const played = paused ? offset : offset + Math.max(0, ctx.currentTime - startTime);
          return clamp(played / duration, 0, 1);
        },
      };

      this.active.add(handle);
      connectAndStart();
      return handle;
    } catch (err) {
      // If decode fails (unsupported format, unreadable file, etc.), don't crash the app.
      console.error('[audio] failed to play', opts.filePath, err);
      return null;
    }
  }

  stopAll() {
    for (const h of Array.from(this.active)) h.stop();
  }

  pauseAll() {
    for (const h of Array.from(this.active)) h.pause();
  }

  resumeAll() {
    for (const h of Array.from(this.active)) h.resume();
  }

  isAnythingPaused() {
    for (const h of this.active) {
      if (h.isPaused()) return true;
    }
    return false;
  }
}

export const audioEngine = new AudioEngine();
