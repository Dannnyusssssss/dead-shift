import { AUDIO, SOUND_IDS, SOUNDS, type SoundId, type ToneSpec } from '../data/audio';

/** Synthesized sound effects. Every call is a no-op until `unlock` runs inside a user gesture. */
export interface Sfx {
  readonly muted: boolean;
  /** Creates / resumes the AudioContext. Call from a click, tap or key press. */
  unlock(): void;
  play(id: SoundId): void;
  setMuted(muted: boolean): void;
}

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as Window & { webkitAudioContext?: AudioContextCtor };
  return window.AudioContext ?? w.webkitAudioContext;
}

export function createSfx(initiallyMuted: boolean): Sfx {
  let ctx: AudioContext | undefined;
  let master: GainNode | undefined;
  let noise: AudioBuffer | undefined;
  let muted = initiallyMuted;
  let voices = 0;
  const lastPlayed = {} as Record<SoundId, number>;
  for (const id of SOUND_IDS) lastPlayed[id] = Number.NEGATIVE_INFINITY;

  const createNoise = (c: AudioContext): AudioBuffer => {
    const length = Math.floor(c.sampleRate * AUDIO.noiseSeconds);
    const buffer = c.createBuffer(1, length, c.sampleRate);
    const data = buffer.getChannelData(0);
    // Cosmetic only, never part of the simulation, so Math.random is fine here.
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  };

  const voice = (c: AudioContext, out: GainNode, spec: Readonly<ToneSpec>, start: number): void => {
    if (voices >= AUDIO.maxVoices) return;
    const t0 = start + (spec.delay ?? 0);
    const t1 = t0 + spec.duration;
    const env = c.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(spec.gain, t0 + AUDIO.attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t1);
    env.connect(out);

    let source: AudioScheduledSourceNode;
    if (spec.wave === 'noise') {
      const src = c.createBufferSource();
      src.buffer = noise ?? null;
      if (spec.filter) {
        const filter = c.createBiquadFilter();
        filter.type = spec.filter;
        filter.frequency.setValueAtTime(spec.freqFrom, t0);
        filter.frequency.exponentialRampToValueAtTime(spec.freqTo, t1);
        src.connect(filter);
        filter.connect(env);
      } else {
        src.connect(env);
      }
      source = src;
    } else {
      const osc = c.createOscillator();
      osc.type = spec.wave;
      osc.frequency.setValueAtTime(spec.freqFrom, t0);
      osc.frequency.exponentialRampToValueAtTime(spec.freqTo, t1);
      osc.connect(env);
      source = osc;
    }
    voices++;
    source.onended = () => {
      voices--;
      env.disconnect();
    };
    source.start(t0);
    source.stop(t1 + 0.02);
  };

  return {
    get muted() {
      return muted;
    },
    unlock() {
      // Outside a real activation (e.g. a touch pointerdown) Chrome would only warn and stay silent.
      const activation = (navigator as Navigator & { userActivation?: { isActive: boolean } })
        .userActivation;
      if (activation && !activation.isActive) return;
      if (ctx?.state === 'running') return;
      try {
        if (!ctx) {
          const Ctor = audioContextCtor();
          if (!Ctor) return;
          ctx = new Ctor();
          master = ctx.createGain();
          master.gain.value = muted ? 0 : AUDIO.masterGain;
          master.connect(ctx.destination);
          noise = createNoise(ctx);
        }
        if (ctx.state === 'suspended') void ctx.resume();
      } catch {
        ctx = undefined;
      }
    },
    play(id) {
      if (muted || !ctx || !master || ctx.state !== 'running') return;
      const def = SOUNDS[id];
      const now = ctx.currentTime;
      if (now - lastPlayed[id] < def.minInterval) return;
      lastPlayed[id] = now;
      for (const layer of def.layers) voice(ctx, master, layer, now);
    },
    setMuted(value) {
      muted = value;
      if (ctx && master) master.gain.setValueAtTime(muted ? 0 : AUDIO.masterGain, ctx.currentTime);
    },
  };
}
