import {normalizeAudioVoiceGain} from './audio-voice.js';

export type AssetManagerAudioSource = Readonly<{asset: unknown; url?: never}> |
  Readonly<{url: string; asset?: never}>;

export interface AssetManagerAudioFadeOptions {
  readonly fadeIn?: number;
  readonly fadeOut?: number;
}

export interface AssetManagerAudioStopOptions {
  readonly fadeOut?: number;
  readonly signal?: AbortSignal;
}

export interface AssetManagerAudioPlaybackOptions extends AssetManagerAudioFadeOptions {
  readonly gain?: number;
  readonly muted?: boolean;
  readonly playbackRate?: number;
}

export interface AssetManagerAudioPlayOptions extends AssetManagerAudioFadeOptions {
  readonly restart?: boolean;
  readonly loop?: boolean;
  readonly signal?: AbortSignal;
}

export interface AssetManagerAudioPlayback {
  readonly ended: Promise<void>;
  readonly currentTime: number;
  readonly paused: boolean;
  readonly loop: boolean;
  readonly gain: number;
  readonly muted: boolean;
  readonly playbackRate: number;
  play(options?: AssetManagerAudioPlayOptions): Promise<void>;
  pause(): void;
  stop(options?: AssetManagerAudioStopOptions): void | Promise<void>;
  seek(seconds: number, signal?: AbortSignal): Promise<void>;
  setGain(value: number): void;
  setMuted(value: boolean): void;
  setPlaybackRate(value: number): void;
  dispose(): void;
}

function rate(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0.25 || value > 4) {
    throw new TypeError('Audio playback rate must be from 0.25 to 4.');
  }
  return value;
}

export function validateAudioPlaybackOptions(options: AssetManagerAudioPlaybackOptions): void {
  if (!options || typeof options !== 'object' || Array.isArray(options) ||
      Object.keys(options).some((key) => !['gain', 'muted', 'playbackRate', 'fadeIn', 'fadeOut'].includes(key))) {
    throw new TypeError('Invalid audio playback options.');
  }
  normalizeAudioVoiceGain(options.gain);
  if (options.muted !== undefined && typeof options.muted !== 'boolean') {
    throw new TypeError('Audio muted must be a boolean.');
  }
  rate(options.playbackRate ?? 1);
  fadeSeconds(options.fadeIn, 'fadeIn');
  fadeSeconds(options.fadeOut, 'fadeOut');
}

function fadeSeconds(value: unknown, label: string): number {
  const seconds = value === undefined ? 0 : value;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
    throw new TypeError(`Audio ${label} must be a finite non-negative number of seconds.`);
  }
  return seconds;
}

function aborted(): Error {
  const error = new Error('Audio playback was cancelled.');
  error.name = 'AbortError';
  return error;
}

/** One reusable native element; the caller owns source resolution and resource release. */
export function createBrowserAudioPlayback(
  audio: HTMLAudioElement,
  options: AssetManagerAudioPlaybackOptions,
  release: () => void,
  playbackError: (cause: unknown) => Error
): AssetManagerAudioPlayback {
  validateAudioPlaybackOptions(options);
  let gain = normalizeAudioVoiceGain(options.gain);
  audio.volume = gain;
  audio.muted = options.muted ?? false;
  audio.playbackRate = options.playbackRate ?? 1;
  audio.loop = false;
  const defaultFadeIn = fadeSeconds(options.fadeIn, 'fadeIn');
  const defaultFadeOut = fadeSeconds(options.fadeOut, 'fadeOut');
  let activeFadeIn = defaultFadeIn;
  let activeFadeOut = defaultFadeOut;
  let envelope = 1;
  let fadeStarted = 0;
  let playing = false;
  let fadeTimer: ReturnType<typeof setTimeout> | undefined;
  let stopping: {
    started: number;
    seconds: number;
    from: number;
    resolve: () => void;
    reject: (error: unknown) => void;
    detach: () => void;
  } | undefined;
  let disposed = false;
  let generation = 0;
  let ended = Promise.resolve();
  let settle: ((error?: unknown) => void) | undefined;
  let rejectStart: ((error: unknown) => void) | undefined;
  let detachAbort: (() => void) | undefined;
  const pendingMetadata = new Set<(error?: unknown) => void>();

  const requireActive = () => {
    if (disposed) throw new Error('Audio playback is disposed.');
  };
  const clearFadeTimer = () => {
    if (fadeTimer !== undefined) clearTimeout(fadeTimer);
    fadeTimer = undefined;
  };
  const finish = (error?: unknown) => {
    playing = false;
    clearFadeTimer();
    const previousStop = stopping;
    stopping = undefined;
    previousStop?.detach();
    previousStop?.reject(error ?? aborted());
    generation++;
    rejectStart?.(error ?? aborted());
    rejectStart = undefined;
    detachAbort?.();
    detachAbort = undefined;
    settle?.(error);
    settle = undefined;
  };
  const writeVolume = () => { audio.volume = gain * envelope; };
  const stopNow = () => {
    const completed = stopping;
    stopping = undefined;
    completed?.detach();
    audio.pause();
    audio.loop = false;
    audio.currentTime = 0;
    finish();
    envelope = 1;
    writeVolume();
    completed?.resolve();
  };
  const refreshFade = () => {
    clearFadeTimer();
    if (disposed || (!playing && !stopping)) return;
    const now = performance.now();
    let delay = 16;
    if (stopping) {
      const progress = Math.min(1, (now - stopping.started) / (stopping.seconds * 1000));
      envelope = stopping.from * (1 - progress);
      writeVolume();
      if (progress >= 1) { stopNow(); return; }
    } else {
      const fadeIn = activeFadeIn === 0 ? 1 : Math.min(1, (now - fadeStarted) / (activeFadeIn * 1000));
      const remaining = Number.isFinite(audio.duration)
        ? Math.max(0, audio.duration - audio.currentTime) / audio.playbackRate
        : Infinity;
      const fadeOut = !audio.loop && activeFadeOut > 0 ? Math.min(1, remaining / activeFadeOut) : 1;
      envelope = Math.max(0, Math.min(fadeIn, fadeOut));
      writeVolume();
      if (fadeIn >= 1) {
        if (audio.loop || activeFadeOut === 0) return;
        if (!Number.isFinite(remaining)) delay = 250;
        else if (remaining > activeFadeOut) delay = Math.min(250, Math.max(16, (remaining - activeFadeOut) * 1000));
      }
    }
    fadeTimer = setTimeout(refreshFade, delay);
  };
  const onEnded = () => {
    if (stopping) { stopNow(); return; }
    finish();
    if (activeFadeOut > 0 && !audio.loop) { envelope = 0; writeVolume(); }
  };
  const onError = () => {
    audio.pause();
    const error = playbackError(audio.error ?? new Error('The browser audio element reported a playback error.'));
    finish(error);
    for (const complete of pendingMetadata) complete(error);
  };
  audio.addEventListener('ended', onEnded);
  audio.addEventListener('error', onError);
  for (const event of ['durationchange', 'ratechange', 'seeked']) audio.addEventListener(event, refreshFade);

  const controller: AssetManagerAudioPlayback = {
    get ended() { return ended; },
    get currentTime() { return audio.currentTime; },
    get paused() { return audio.paused; },
    get loop() { return audio.loop; },
    get gain() { return gain; },
    get muted() { return audio.muted; },
    get playbackRate() { return audio.playbackRate; },
    async play(playOptions = {}) {
      requireActive();
      if (!playOptions || typeof playOptions !== 'object' || Array.isArray(playOptions) ||
          Object.keys(playOptions).some((key) => !['restart', 'loop', 'signal', 'fadeIn', 'fadeOut'].includes(key)) ||
          (playOptions.restart !== undefined && typeof playOptions.restart !== 'boolean') ||
          (playOptions.loop !== undefined && typeof playOptions.loop !== 'boolean')) {
        throw new TypeError('Invalid audio play options.');
      }
      const fadeIn = fadeSeconds(playOptions.fadeIn === undefined ? defaultFadeIn : playOptions.fadeIn, 'fadeIn');
      const fadeOut = fadeSeconds(playOptions.fadeOut === undefined ? defaultFadeOut : playOptions.fadeOut, 'fadeOut');
      const signal = playOptions.signal;
      if (signal?.aborted) throw aborted();
      finish();
      const run = generation;
      if (playOptions.restart) audio.currentTime = 0;
      audio.loop = playOptions.loop ?? audio.loop;
      activeFadeIn = fadeIn;
      activeFadeOut = fadeOut;
      envelope = fadeIn > 0 ? 0 : 1;
      writeVolume();
      ended = new Promise<void>((resolve, reject) => {
        settle = (error) => error === undefined ? resolve() : reject(error);
      });
      void ended.catch(() => {});
      const onAbort = () => {
        audio.pause();
        finish(aborted());
      };
      signal?.addEventListener('abort', onAbort, {once: true});
      detachAbort = () => signal?.removeEventListener('abort', onAbort);
      try {
        await Promise.race([Promise.resolve(audio.play()), new Promise<never>((_resolve, reject) => { rejectStart = reject; })]);
        if (run !== generation) throw aborted();
        rejectStart = undefined;
        playing = true;
        fadeStarted = performance.now();
        refreshFade();
      } catch (cause) {
        if (run !== generation) throw cause;
        audio.pause();
        const error = playbackError(cause);
        finish(error);
        throw error;
      }
    },
    pause() {
      requireActive();
      audio.pause();
      finish();
    },
    stop(stopOptions = {}) {
      requireActive();
      if (!stopOptions || typeof stopOptions !== 'object' || Array.isArray(stopOptions) ||
          Object.keys(stopOptions).some((key) => !['fadeOut', 'signal'].includes(key))) {
        throw new TypeError('Invalid audio stop options.');
      }
      const seconds = fadeSeconds(stopOptions.fadeOut === undefined ? activeFadeOut : stopOptions.fadeOut, 'fadeOut');
      const signal = stopOptions.signal;
      if (signal?.aborted) throw aborted();
      if (seconds === 0 || audio.paused || !playing) { stopNow(); return; }
      const previous = stopping;
      stopping = undefined;
      previous?.detach();
      previous?.reject(aborted());
      return new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          const current = stopping;
          stopping = undefined;
          current?.detach();
          stopNow();
          reject(aborted());
        };
        stopping = {started: performance.now(), seconds, from: envelope, resolve, reject,
          detach: () => signal?.removeEventListener('abort', onAbort)};
        signal?.addEventListener('abort', onAbort, {once: true});
        if (signal?.aborted) onAbort();
        else refreshFade();
      });
    },
    async seek(seconds, signal) {
      requireActive();
      if (!Number.isFinite(seconds) || seconds < 0) throw new TypeError('Audio seek time must be non-negative.');
      if (signal?.aborted) throw aborted();
      if (audio.readyState < 1) {
        await new Promise<void>((resolve, reject) => {
          const complete = (error?: unknown) => {
            clearTimeout(timer);
            audio.removeEventListener('loadedmetadata', ready);
            signal?.removeEventListener('abort', cancel);
            pendingMetadata.delete(complete);
            if (error === undefined) resolve();
            else reject(error);
          };
          const ready = () => complete();
          const cancel = () => complete(aborted());
          const timer = setTimeout(() => complete(new Error('Audio metadata did not become ready.')), 10_000);
          pendingMetadata.add(complete);
          audio.addEventListener('loadedmetadata', ready, {once: true});
          signal?.addEventListener('abort', cancel, {once: true});
          if (signal?.aborted) cancel();
          else if (audio.readyState >= 1) ready();
        });
      }
      requireActive();
      if (signal?.aborted) throw aborted();
      if (Number.isFinite(audio.duration) && seconds > audio.duration) throw new RangeError('Audio seek exceeds its duration.');
      audio.currentTime = seconds;
      refreshFade();
    },
    setGain(value) {
      const normalized = normalizeAudioVoiceGain(value);
      requireActive();
      gain = normalized;
      writeVolume();
    },
    setMuted(value) {
      if (typeof value !== 'boolean') throw new TypeError('Audio muted must be a boolean.');
      requireActive();
      audio.muted = value;
    },
    setPlaybackRate(value) {
      const normalized = rate(value);
      requireActive();
      audio.playbackRate = normalized;
      refreshFade();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // Unloading the source below also stops partially initialized elements.
      }
      finish();
      for (const complete of pendingMetadata) complete(aborted());
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      for (const event of ['durationchange', 'ratechange', 'seeked']) audio.removeEventListener(event, refreshFade);
      try {
        audio.removeAttribute?.('src');
        audio.load?.();
      } finally {
        release();
      }
    }
  };
  return Object.freeze(controller);
}
