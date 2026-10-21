/** Media volume handles attenuation and fades; this shared graph adds amplification. */
let shared: {context: AudioContext; users: number} | undefined;
const maximumFloat = 3.4028234663852886e38;

export function createAudioAmplifier(audio: HTMLAudioElement) {
  if (typeof globalThis.AudioContext !== 'function') {
    throw new Error('Audio amplification requires Web Audio support.');
  }
  if (!shared || shared.context.state === 'closed') shared = {context: new AudioContext(), users: 0};
  const owner = shared;
  owner.users++;
  let source: MediaElementAudioSourceNode | undefined;
  let gain: GainNode | undefined;
  let released = false;
  const dispose = () => {
    if (released) return;
    released = true;
    source?.disconnect();
    gain?.disconnect();
    owner.users--;
    if (owner.users === 0) {
      if (shared === owner) shared = undefined;
      void owner.context.close().catch(() => {});
    }
  };
  try {
    source = owner.context.createMediaElementSource(audio);
    gain = owner.context.createGain();
    source.connect(gain);
    gain.connect(owner.context.destination);
  } catch (error) {
    dispose();
    throw error;
  }
  const node = gain;
  return {
    setGain(value: number) { node.gain.value = Math.min(maximumFloat, Math.max(1, value)); },
    resume() { return owner.context.state === 'running' ? Promise.resolve() : owner.context.resume(); },
    dispose
  };
}
