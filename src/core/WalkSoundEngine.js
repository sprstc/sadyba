/**
 * src/core/WalkSoundEngine.js
 * Proceduralny syntezator dźwięków trybu spaceru (Web Audio API — zero zewnętrznych plików audio):
 * - Kroki dopasowane do materiału podłoża (wood, tile, concrete, grass),
 * - Dźwięk lądowania po skoku,
 * - Mechanizm klamki i lekkie skrzypnięcie / domknięcie drzwi i bram.
 */

const STORAGE_KEY_MUTED = 'dt_walk_audio_muted';

export class WalkSoundEngine {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;
    this.muted = false;
    try {
      this.muted = window.localStorage?.getItem(STORAGE_KEY_MUTED) === '1';
    } catch {
      this.muted = false;
    }
  }

  /**
   * Odblokowuje lub tworzy kontekst Web Audio przy pierwszym geście użytkownika.
   */
  unlock() {
    if (this.muted) return false;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return false;
        this.ctx = new AudioCtx();
        this._buildNoiseBuffer();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx.state === 'running';
    } catch {
      return false;
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    try {
      window.localStorage?.setItem(STORAGE_KEY_MUTED, this.muted ? '1' : '0');
    } catch {
      // ignore storage restrictions
    }
    return this.muted;
  }

  toggleMuted() {
    const next = this.setMuted(!this.muted);
    if (!next) {
      this.unlock();
    }
    return next;
  }

  _buildNoiseBuffer() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate; // 1 sekunda szumu
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      // Lekko ocieplony szum (mieszanka białego i różowego) dla naturalniejszej akustyki kroków
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 1.0526913;
      const pink = (b0 + b1 + b2 + white * 0.1848) * 0.22;
      data[i] = white * 0.45 + pink * 0.55;
    }
    this.noiseBuffer = buffer;
  }

  _ensureReady() {
    if (this.muted) return false;
    if (!this.ctx) {
      this.unlock();
    }
    if (!this.ctx || this.ctx.state !== 'running') return false;
    if (!this.noiseBuffer) this._buildNoiseBuffer();
    return true;
  }

  _triggerNoiseBurst({ freq = 900, q = 1.4, duration = 0.045, attack = 0.004, gain = 0.05, delay = 0 }) {
    if (!this.ctx || !this.noiseBuffer) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const offset = Math.random() * 0.75;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, t0);
    filter.Q.setValueAtTime(q, t0);

    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.linearRampToValueAtTime(gain, t0 + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    src.connect(filter);
    filter.connect(amp);
    amp.connect(this.ctx.destination);

    src.start(t0, offset, duration + 0.02);
    src.stop(t0 + duration + 0.03);
  }

  _triggerTone({ type = 'sine', fStart = 140, fEnd = 60, duration = 0.06, gain = 0.08, delay = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(fStart, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, fEnd), t0 + duration);

    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.linearRampToValueAtTime(gain, t0 + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(amp);
    amp.connect(this.ctx.destination);

    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  /**
   * Odtwarza pojedynczy krok dopasowany do rodzaju nawierzchni.
   * @param {'wood'|'tile'|'concrete'|'grass'} surface
   * @param {number} intensity
   */
  playFootstep(surface = 'wood', intensity = 1.0) {
    if (!this._ensureReady()) return;
    const jitter = 0.93 + Math.random() * 0.14;
    const lvl = Math.max(0.2, Math.min(1.4, intensity));

    switch (surface) {
      case 'tile': {
        this._triggerNoiseBurst({
          freq: 1950 * jitter,
          q: 2.1,
          duration: 0.028,
          attack: 0.002,
          gain: 0.065 * lvl,
        });
        this._triggerTone({
          type: 'sine',
          fStart: 240 * jitter,
          fEnd: 95,
          duration: 0.032,
          gain: 0.045 * lvl,
        });
        break;
      }
      case 'concrete': {
        this._triggerNoiseBurst({
          freq: 820 * jitter,
          q: 1.1,
          duration: 0.046,
          attack: 0.003,
          gain: 0.07 * lvl,
        });
        this._triggerTone({
          type: 'triangle',
          fStart: 122 * jitter,
          fEnd: 52,
          duration: 0.045,
          gain: 0.06 * lvl,
        });
        break;
      }
      case 'grass': {
        this._triggerNoiseBurst({
          freq: 2350 * jitter,
          q: 0.85,
          duration: 0.078,
          attack: 0.012,
          gain: 0.055 * lvl,
        });
        break;
      }
      case 'wood':
      default: {
        this._triggerTone({
          type: 'triangle',
          fStart: 145 * jitter,
          fEnd: 62,
          duration: 0.065,
          gain: 0.09 * lvl,
        });
        this._triggerNoiseBurst({
          freq: 920 * jitter,
          q: 1.5,
          duration: 0.036,
          attack: 0.003,
          gain: 0.045 * lvl,
        });
        break;
      }
    }
  }

  /**
   * Odtwarza dwuetapowe lądowanie po skoku lub zeskoku.
   */
  playLand(surface = 'wood', impactSpeed = 3.0) {
    if (!this._ensureReady()) return;
    const lvl = Math.max(0.4, Math.min(1.4, impactSpeed / 5.5));
    this.playFootstep(surface, lvl * 1.1);
    setTimeout(() => {
      if (!this.muted) {
        this.playFootstep(surface, lvl * 0.78);
      }
    }, 42);
  }

  /**
   * Subtelny dźwięk otwierania lub zamykania drzwi/bramy.
   * @param {boolean} isOpen
   * @param {'wood'|'glass'|'metal'} materialType
   */
  playDoor(isOpen, materialType = 'wood') {
    if (!this._ensureReady()) return;
    const jitter = 0.94 + Math.random() * 0.12;

    // Krótkie kliknięcie zapadki klamki
    this._triggerTone({
      type: 'triangle',
      fStart: (isOpen ? 1220 : 960) * jitter,
      fEnd: 440,
      duration: 0.022,
      gain: 0.055,
    });

    if (materialType === 'metal') {
      this._triggerTone({
        type: 'sine',
        fStart: 520 * jitter,
        fEnd: isOpen ? 390 : 320,
        duration: 0.14,
        gain: 0.035,
        delay: 0.015,
      });
      this._triggerNoiseBurst({
        freq: 1450 * jitter,
        q: 1.8,
        duration: 0.12,
        attack: 0.015,
        gain: 0.035,
        delay: 0.02,
      });
    } else {
      this._triggerTone({
        type: 'triangle',
        fStart: (isOpen ? 182 : 165) * jitter,
        fEnd: isOpen ? 148 : 90,
        duration: 0.18,
        gain: 0.04,
        delay: 0.018,
      });
      this._triggerNoiseBurst({
        freq: materialType === 'glass' ? 1150 : 650,
        q: 1.2,
        duration: 0.15,
        attack: 0.02,
        gain: 0.032,
        delay: 0.02,
      });
    }

    // Delikatne domknięcie w ościeżnicy przy zamykaniu
    if (!isOpen) {
      this._triggerTone({
        type: 'sine',
        fStart: 135 * jitter,
        fEnd: 58,
        duration: 0.06,
        gain: 0.065,
        delay: 0.16,
      });
    }
  }
}
