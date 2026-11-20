// All sound is synthesised with the Web Audio API: no external audio files, so
// nothing to license. Music is a soft night drone; effects are short tones.
export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.6;
    this.music = null;
  }

  /** Browsers only allow audio after a user gesture: call from a click/key handler. */
  unlock() {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  tone(freq, dur = 0.15, type = 'sine', gain = 0.3, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  startMusic() {
    if (!this.ctx || this.music) return;
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    g.connect(this.master);
    this.music = [196, 293.66, 392].map((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.detune.value = i * 4;
      o.connect(g);
      o.start();
      return o;
    });
    this.musicGain = g;
  }

  stopMusic() {
    if (!this.music) return;
    for (const o of this.music) o.stop();
    this.musicGain.disconnect();
    this.music = null;
  }

  /** Play the effect for one sim event. */
  event(e) {
    switch (e.name) {
      case 'mote_picked': return this.tone(880, 0.08, 'sine', 0.15);
      case 'deposit': return this.tone(523, 0.12, 'triangle', 0.2);
      case 'lantern_lit': this.tone(523, 0.3, 'triangle', 0.25); return this.tone(784, 0.5, 'sine', 0.2);
      case 'pulse': return this.tone(330, 0.4, 'sine', 0.3, 400);
      case 'player_hit': return this.tone(160, 0.35, 'sawtooth', 0.25, -80);
      case 'dash': return this.tone(600, 0.12, 'square', 0.08, 300);
      case 'shade_spawned': return this.tone(110, 0.6, 'sawtooth', 0.12, -40);
      case 'drifter_steal': return this.tone(700, 0.25, 'triangle', 0.15, -400);
      case 'charm_picked': return this.tone(990, 0.3, 'sine', 0.2, 300);
      case 'game_over':
        if (e.data.result === 'won') [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'triangle', 0.2), i * 140));
        else [392, 330, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.4, 'sine', 0.2), i * 200));
        return;
      default:
    }
  }

  jump() {
    this.tone(440, 0.1, 'sine', 0.12, 200);
  }

  countdown() {
    this.tone(1000, 0.06, 'square', 0.08);
  }
}
