// Full HUD (Ticket-02 Part 3.7): flames top-left, mm:ss top-centre (red + blink
// at <= 30 s), lanterns k/n + score top-right, 10-cell firefly bar bottom-centre,
// dash/pulse cooldown icons bottom-right, "E — Nạp ánh sáng (x/10)" prompt near a
// lantern, arrow to the nearest unlit lantern when it is off screen.
import { TUNING } from '../sim/config.js';

const $ = (id) => document.getElementById(id);
const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export class Hud {
  constructor() {
    this.root = $('hud');
    this.flames = $('hud-flames');
    this.timer = $('hud-timer');
    this.right = $('hud-right');
    this.bar = $('hud-bar');
    this.dash = $('hud-dash');
    this.pulse = $('hud-pulse');
    this.prompt = $('hud-prompt');
    this.arrow = $('hud-arrow');
    this.bar.innerHTML = '<i></i>'.repeat(TUNING.carry_capacity);
    this.cells = [...this.bar.children];
  }

  show(on) {
    this.root.hidden = !on;
  }

  update(w, scene, t, totalScore) {
    const p = w.player;
    this.flames.textContent = '🔥'.repeat(p.flames) + '·'.repeat(Math.max(0, TUNING.flames - p.flames));
    const s = Math.ceil(w.timeLeft);
    this.timer.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    const danger = w.timeLeft <= 30;
    this.timer.classList.toggle('danger', danger);
    this.timer.style.visibility = danger && Math.floor(t * 2) % 2 ? 'hidden' : 'visible';
    const lit = w.lanterns.filter((l) => l.lit).length;
    this.right.textContent = `🏮 ${lit}/${w.lanterns.length}   ★ ${totalScore + w.score}`;
    this.cells.forEach((c, i) => c.classList.toggle('on', i < p.carried));
    const cd = (el, ticksLeft, total) => {
      el.style.setProperty('--cd', ticksLeft > 0 ? String(ticksLeft / total) : '0');
      el.classList.toggle('ready', ticksLeft === 0);
    };
    cd(this.dash, p.charmTicks > 0 ? 0 : p.dashCdTicks, TUNING.dash_cooldown_s * 60);
    cd(this.pulse, p.carried < TUNING.pulse_cost ? 1 : p.pulseCdTicks, TUNING.pulse_cooldown_s * 60);
    this.pulse.classList.toggle('ready', p.pulseCdTicks === 0 && p.carried >= TUNING.pulse_cost);

    const unlit = w.lanterns.filter((l) => !l.lit);
    const near = unlit.find((l) => distXZ(p.pos, l.pos) <= TUNING.interact_radius);
    this.prompt.hidden = !near;
    if (near) this.prompt.textContent = `E — Nạp ánh sáng (${near.deposited}/${TUNING.lantern_cost})`;

    // arrow to the nearest unlit lantern when it is off screen
    let target = null;
    let best = Infinity;
    for (const l of unlit) {
      const d = distXZ(p.pos, l.pos);
      if (d < best) [best, target] = [d, l];
    }
    const sp = target && scene.project(target.pos);
    const off = target && (!sp || sp.x < 0.03 || sp.x > 0.97 || sp.y < 0.03 || sp.y > 0.97);
    this.arrow.hidden = !off;
    if (off) {
      const th = Math.atan2(target.pos[0] - p.pos[0], target.pos[2] - p.pos[2]) - Math.atan2(scene.camera.position.x - p.pos[0], scene.camera.position.z - p.pos[2]) + Math.PI;
      this.arrow.style.transform = `translate(-50%, -50%) rotate(${-th}rad)`;
    }
  }
}
