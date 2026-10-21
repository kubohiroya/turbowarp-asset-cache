import {describe, expect, it, vi} from 'vitest';
import {createBrowserAudioPlayback} from '../src/audio-playback.js';

class AudioStub extends EventTarget {
  currentTime = 0;
  duration = 6;
  readyState = 1;
  paused = true;
  volume = 1;
  muted = false;
  loop = false;
  playbackRate = 1;
  play = vi.fn(async () => { this.paused = false; });
  pause = vi.fn(() => { this.paused = true; });
  removeAttribute = vi.fn();
  load = vi.fn();
}

function setup() {
  const audio = new AudioStub();
  const release = vi.fn();
  const playback = createBrowserAudioPlayback(audio as unknown as HTMLAudioElement,
    {gain: 0.3, muted: true, playbackRate: 1.5}, release,
    (cause) => new Error('Playback failed', {cause}));
  return {audio, playback, release};
}

describe('reusable browser audio controller', () => {
  it('prepares paused and supports pause, resume, stop, loop and reuse after natural end', async () => {
    const {audio, playback, release} = setup();
    expect(audio.play).not.toHaveBeenCalled();
    expect([playback.gain, playback.muted, playback.playbackRate]).toEqual([0.3, true, 1.5]);
    await playback.play({restart: true, loop: true});
    audio.currentTime = 2;
    const first = playback.ended;
    playback.pause();
    await first;
    expect(playback.currentTime).toBe(2);
    await playback.play();
    expect(playback.loop).toBe(true);
    playback.stop();
    await playback.ended;
    expect([playback.currentTime, playback.loop, playback.paused]).toEqual([0, false, true]);
    expect(release).not.toHaveBeenCalled();
    await playback.play();
    audio.dispatchEvent(new Event('ended'));
    await playback.ended;
    await playback.play({restart: true});
    playback.dispose();
    playback.dispose();
    expect(release).toHaveBeenCalledOnce();
    expect(audio.removeAttribute).toHaveBeenCalledWith('src');
    expect(audio.load).toHaveBeenCalledOnce();
    await expect(playback.play()).rejects.toThrow(/disposed/u);
  });

  it('waits for metadata, bounds seeks, validates values and cleans up pending seeks', async () => {
    const {audio, playback} = setup();
    audio.readyState = 0;
    const seek = playback.seek(4);
    expect(audio.currentTime).toBe(0);
    audio.readyState = 1;
    audio.dispatchEvent(new Event('loadedmetadata'));
    await seek;
    expect(playback.currentTime).toBe(4);
    await expect(playback.seek(20)).rejects.toThrow(/duration/u);
    playback.setGain(0);
    playback.setMuted(false);
    playback.setPlaybackRate(4);
    expect([audio.volume, audio.muted, audio.playbackRate]).toEqual([0, false, 4]);
    expect(() => playback.setGain(Number.NaN)).toThrow();
    expect(() => playback.setPlaybackRate(0)).toThrow();
    expect(() => playback.setMuted('false' as never)).toThrow();
    await expect(playback.seek(-1)).rejects.toThrow();
    audio.readyState = 0;
    const pending = playback.seek(1);
    playback.dispose();
    await expect(pending).rejects.toMatchObject({name: 'AbortError'});
  });

  it('cancels a pending native play immediately and ignores its late completion', async () => {
    const {audio, playback} = setup();
    let resolve!: () => void;
    audio.play.mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; }));
    const abort = new AbortController();
    const starting = playback.play({signal: abort.signal});
    abort.abort();
    await expect(starting).rejects.toMatchObject({name: 'AbortError'});
    await expect(playback.ended).rejects.toMatchObject({name: 'AbortError'});
    await playback.play();
    resolve();
    await Promise.resolve();
    expect(audio.paused).toBe(false);
    playback.dispose();
  });

  it('reports a native media error during pending play as failure rather than cancellation', async () => {
    const {audio, playback} = setup();
    audio.play.mockImplementationOnce(() => new Promise<void>(() => {}));
    const starting = playback.play();
    audio.dispatchEvent(new Event('error'));
    await expect(starting).rejects.toThrow('Playback failed');
    await expect(playback.ended).rejects.toThrow('Playback failed');
    playback.dispose();
  });

  it('keeps browser autoplay rejection as the cause and releases only on dispose', async () => {
    const {audio, playback, release} = setup();
    const denied = new DOMException('User activation is required', 'NotAllowedError');
    audio.play.mockRejectedValueOnce(denied);
    await expect(playback.play({fadeIn: 1, fadeOut: 1})).rejects.toMatchObject({cause: denied});
    await expect(playback.ended).rejects.toMatchObject({cause: denied});
    expect(release).not.toHaveBeenCalled();
    await playback.play();
    const waiting = playback.ended;
    audio.dispatchEvent(new Event('error'));
    await expect(waiting).rejects.toThrow('Playback failed');
    playback.dispose();
    expect(release).toHaveBeenCalledOnce();
  });
  it('fades in with wall time and fades out toward natural completion using the current rate', async () => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout', 'performance']});
    const {audio, playback} = setup();
    try {
      await playback.play({fadeIn: 2, fadeOut: 1});
      expect(audio.volume).toBe(0);
      await vi.advanceTimersByTimeAsync(1000);
      expect(audio.volume).toBeCloseTo(0.15, 2);
      playback.setGain(0.6);
      expect(playback.gain).toBe(0.6);
      expect(audio.volume).toBeCloseTo(0.3, 2);
      await vi.advanceTimersByTimeAsync(1020);
      expect(audio.volume).toBeCloseTo(0.6, 4);
      playback.setPlaybackRate(1);
      audio.currentTime = 5.5;
      audio.dispatchEvent(new Event('durationchange'));
      expect(audio.volume).toBeCloseTo(0.3, 4);
      playback.setPlaybackRate(2);
      expect(audio.volume).toBeCloseTo(0.15, 4);
      await playback.seek(1);
      expect(audio.volume).toBe(0.6);
      audio.dispatchEvent(new Event('ended'));
      await playback.ended;
      expect(vi.getTimerCount()).toBe(0);
    } finally { playback.dispose(); vi.useRealTimers(); }
  });

  it('keeps loops at full gain and waits for an explicit fade-out stop before resetting', async () => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout', 'performance']});
    const {audio, playback} = setup();
    try {
      audio.currentTime = 5.9;
      await playback.play({loop: true, fadeOut: 1});
      expect(audio.volume).toBe(0.3);
      expect(vi.getTimerCount()).toBe(0);
      let stopped = false;
      const stop = Promise.resolve(playback.stop()).then(() => { stopped = true; });
      await vi.advanceTimersByTimeAsync(500);
      expect(audio.volume).toBeCloseTo(0.15, 2);
      expect(audio.paused).toBe(false);
      expect(stopped).toBe(false);
      await vi.advanceTimersByTimeAsync(520);
      await stop;
      expect([audio.paused, audio.currentTime, audio.loop, playback.gain]).toEqual([true, 0, false, 0.3]);
      expect(vi.getTimerCount()).toBe(0);
      await playback.play({fadeIn: 0, fadeOut: 0});
      expect(audio.volume).toBe(0.3);
    } finally { playback.dispose(); vi.useRealTimers(); }
  });

  it('cancels fade timers and stop waits on pause, replacement, abort and dispose', async () => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout', 'performance']});
    const {audio, playback} = setup();
    try {
      await playback.play({fadeIn: 1});
      await vi.advanceTimersByTimeAsync(200);
      playback.pause();
      expect(vi.getTimerCount()).toBe(0);
      await playback.play({loop: true});
      const first = Promise.resolve(playback.stop({fadeOut: 1}));
      const firstRejected = expect(first).rejects.toMatchObject({name: 'AbortError'});
      await playback.play({fadeIn: 0, fadeOut: 0});
      await firstRejected;
      await vi.advanceTimersByTimeAsync(1100);
      expect(audio.volume).toBe(0.3);
      const abort = new AbortController();
      const second = Promise.resolve(playback.stop({fadeOut: 1, signal: abort.signal}));
      abort.abort();
      await expect(second).rejects.toMatchObject({name: 'AbortError'});
      expect(audio.paused).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
      await playback.play();
      const third = Promise.resolve(playback.stop({fadeOut: 1}));
      playback.dispose();
      await expect(third).rejects.toMatchObject({name: 'AbortError'});
      expect(vi.getTimerCount()).toBe(0);
    } finally { playback.dispose(); vi.useRealTimers(); }
  });

  it('completes a stop if the media ends first and rejects it on a native failure', async () => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout', 'performance']});
    const {audio, playback} = setup();
    try {
      await playback.play();
      const stopping = playback.stop({fadeOut: 3});
      audio.dispatchEvent(new Event('ended'));
      await stopping;
      expect(audio.currentTime).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
      await playback.play();
      const failed = playback.stop({fadeOut: 3});
      audio.dispatchEvent(new Event('error'));
      await expect(failed).rejects.toThrow('Playback failed');
      expect(vi.getTimerCount()).toBe(0);
    } finally { playback.dispose(); vi.useRealTimers(); }
  });

  it('rejects invalid fade seconds before disturbing the current playback', async () => {
    const {audio, playback} = setup();
    try {
      await playback.play();
      for (const value of [-1, Infinity, Number.NaN, '1', null]) {
        expect(() => createBrowserAudioPlayback(audio as unknown as HTMLAudioElement,
          {fadeIn: value as never}, () => {}, (cause) => new Error(String(cause)))).toThrow();
        await expect(playback.play({fadeIn: value as never})).rejects.toThrow();
        await expect(playback.play({fadeOut: value as never})).rejects.toThrow();
        expect(() => playback.stop({fadeOut: value as never})).toThrow();
      }
      expect(audio.paused).toBe(false);
    } finally { playback.dispose(); }
  });

});


function mockWebAudio() {
  class NodeStub {
    gain = {value: 1};
    connect = vi.fn();
    disconnect = vi.fn();
  }
  const contexts: ContextStub[] = [];
  class ContextStub {
    state = 'suspended';
    destination = {};
    sources: NodeStub[] = [];
    gains: NodeStub[] = [];
    resume = vi.fn(async () => { this.state = 'running'; });
    close = vi.fn(async () => { this.state = 'closed'; });
    createMediaElementSource = vi.fn(() => { const node = new NodeStub(); this.sources.push(node); return node; });
    createGain = vi.fn(() => { const node = new NodeStub(); this.gains.push(node); return node; });
    constructor() { contexts.push(this); }
  }
  vi.stubGlobal('AudioContext', ContextStub);
  return contexts;
}

describe('amplified playback', () => {
  it('uses start-time gain above one, preserves fades and shares then releases the output graph', async () => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout', 'performance']});
    const contexts = mockWebAudio();
    const first = setup();
    const second = setup();
    try {
      await first.playback.play({gain: 2, fadeIn: 1});
      expect(first.playback.gain).toBe(2);
      expect(contexts).toHaveLength(1);
      const context = contexts[0]!;
      expect(context.resume).toHaveBeenCalledOnce();
      expect(context.gains[0]!.gain.value).toBe(2);
      expect(first.audio.volume).toBe(0);
      await vi.advanceTimersByTimeAsync(520);
      expect(first.audio.volume).toBeCloseTo(0.5, 1);
      await first.playback.setGain(3);
      expect(context.gains[0]!.gain.value).toBe(3);
      expect(first.playback.gain).toBe(3);
      await second.playback.play({gain: 2.5});
      expect(contexts).toHaveLength(1);
      expect(context.gains[1]!.gain.value).toBe(2.5);
      await first.playback.setGain(0.5);
      expect(context.gains[0]!.gain.value).toBe(1);
      expect(second.playback.gain).toBe(2.5);
      first.playback.dispose();
      expect(context.close).not.toHaveBeenCalled();
      second.playback.dispose();
      expect(context.close).toHaveBeenCalledOnce();
      expect(context.sources.every((node) => node.disconnect.mock.calls.length === 1)).toBe(true);
      expect(context.gains.every((node) => node.disconnect.mock.calls.length === 1)).toBe(true);
    } finally {
      first.playback.dispose(); second.playback.dispose(); vi.unstubAllGlobals(); vi.useRealTimers();
    }
  });

  it('accepts any finite non-negative gain, validates before interrupting and cancels suspended output startup', async () => {
    const contexts = mockWebAudio();
    const {audio, playback} = setup();
    try {
      for (const value of [-1, NaN, Infinity, null, '2']) {
        await expect(playback.play({gain: value as never})).rejects.toThrow();
        expect(() => playback.setGain(value as never)).toThrow();
      }
      await playback.play({gain: Number.MAX_VALUE});
      expect(playback.gain).toBe(Number.MAX_VALUE);
      expect(contexts[0]!.gains[0]!.gain.value).toBe(3.4028234663852886e38);
      await playback.setGain(0);
      expect(audio.volume).toBe(0);
      playback.pause();
      const context = contexts[0]!;
      context.state = 'suspended';
      context.resume.mockImplementationOnce(() => new Promise<void>(() => {}));
      const abort = new AbortController();
      const starting = playback.play({gain: 2, signal: abort.signal});
      abort.abort();
      await expect(starting).rejects.toMatchObject({name: 'AbortError'});
      expect(audio.paused).toBe(true);
    } finally { playback.dispose(); vi.unstubAllGlobals(); }
  });

  it('reports missing Web Audio instead of silently clamping amplification', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const {audio, playback} = setup();
    try {
      await playback.play();
      expect(() => playback.setGain(2)).toThrow('Playback failed');
      expect(playback.gain).toBe(0.3);
      await expect(playback.play({gain: 2})).rejects.toMatchObject({cause: expect.objectContaining({message: expect.stringMatching(/Web Audio/u)})});
      expect(audio.paused).toBe(true);
    } finally { playback.dispose(); vi.unstubAllGlobals(); }
  });
});
