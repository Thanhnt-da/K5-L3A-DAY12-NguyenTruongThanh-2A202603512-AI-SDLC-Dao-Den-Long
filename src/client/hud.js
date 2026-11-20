// Full HUD (Ticket-02 Part 3.7): flames top-left, mm:ss top-centre (red + blink
// at <= 30 s), lanterns k/n + score top-right, 10-cell firefly bar bottom-centre,
// dash/pulse cooldown icons bottom-right, "E — Nạp ánh sáng (x/10)" prompt near a
// lantern, arrow to the nearest unlit lantern when it is off screen.
import { TUNING } from '../sim/config.js';
import { capacityOf } from '../sim/world.js';

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
    this.cueEl = $('hud-cues');
    this.shadeArrow = $('hud-shade');
    this.bar.innerHTML = '<i></i>'.repeat(TUNING.capacity_max);
    this.cells = [...this.bar.children];
  }

  /** Visual stand-ins for sounds (Ticket-04 Part 4). */
  cues(w, scene, shadeId, ping = '') {
    const lines = [];
    if (ping) lines.push(ping);
    // strong wind: warning 2 s (120 ticks) before each gust
    if (w.windEnabled && !w.wind.active && 1800 - (w.simTick % 1800) <= 120) lines.push('🍃 ⚠ Gió mạnh sắp tới!');
    if (w.wind.active) lines.push('🍃 Gió mạnh');
    if (w.timeLeft <= 10) lines.push(`⏳ Còn ${Math.ceil(w.timeLeft)} giây`);
    const weak = w.lanterns.filter((l) => l.lit && l.fuel < 30 * 60).map((l) => l.id);
    if (weak.length) lines.push(`🏮 ⚠ Đèn sắp cạn dầu: ${weak.join(', ')}`);
    this.cueEl.textContent = lines.join('\n');
    // arrow at the screen edge towards a Bóng Mực that just appeared
    const s = shadeId && w.shades.find((x) => x.id === shadeId);
    this.shadeArrow.hidden = !s;
    if (s) {
      const sp = scene.project(s.pos) ?? { x: 0.5, y: 1.2 };
      const dx = sp.x - 0.5;
      const dy = sp.y - 0.5;
      const k = 0.45 / Math.max(Math.abs(dx), Math.abs(dy), 0.01);
      const ex = 0.5 + dx * Math.min(1, k);
      const ey = 0.5 + dy * Math.min(1, k);
      this.shadeArrow.style.left = `${ex * 100}%`;
      this.shadeArrow.style.top = `${ey * 100}%`;
      this.shadeArrow.style.transform = `translate(-50%, -50%) rotate(${Math.atan2(dy, dx) + Math.PI / 2}rad)`;
    }
  }

  show(on) {
    this.root.hidden = !on;
  }

  update(w, scene, t, totalScore, colorBlind = false) {
    const p = w.player;
    this.flames.textContent = '🔥'.repeat(p.flames) + '·'.repeat(Math.max(0, TUNING.flames - p.flames));
    const s = Math.ceil(w.timeLeft);
    this.timer.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    const danger = w.timeLeft <= 30;
    this.timer.classList.toggle('danger', danger);
    this.timer.classList.toggle('cb', colorBlind);
    if (danger && colorBlind) this.timer.textContent = `⚠ ${this.timer.textContent}`;
    this.timer.style.visibility = danger && Math.floor(t * 2) % 2 ? 'hidden' : 'visible';
    const lit = w.lanterns.filter((l) => l.lit).length;
    this.right.textContent = `🏮 ${lit}/${w.lanterns.length}   ★ ${totalScore + w.score}`;
    const cap = capacityOf(p);
    this.cells.forEach((c, i) => {
      c.classList.toggle('on', i < p.carried);
      c.hidden = i >= cap;
    });
    this.bar.title = `${p.carried} / ${cap}`;
    this.bar.dataset.label = `${p.carried} / ${cap}`;
    const cd = (el, ticksLeft, total) => {
      el.style.setProperty('--cd', ticksLeft > 0 ? String(ticksLeft / total) : '0');
      el.classList.toggle('ready', ticksLeft === 0);
    };
    cd(this.dash, p.charmTicks > 0 ? 0 : p.dashCdTicks, TUNING.dash_cooldown_s * 60);
    cd(this.pulse, p.carried < TUNING.pulse_cost ? 1 : p.pulseCdTicks, TUNING.pulse_cooldown_s * 60);
    this.pulse.classList.toggle('ready', p.pulseCdTicks === 0 && p.carried >= TUNING.pulse_cost);

    const unlit = w.lanterns.filter((l) => !l.lit);
    const near = w.lanterns.find((l) => distXZ(p.pos, l.pos) <= TUNING.interact_radius);
    this.prompt.hidden = !near;
    if (near && !near.lit) this.prompt.textContent = `E — Nạp ánh sáng (${near.deposited}/${near.everLit ? TUNING.relight_cost : TUNING.lantern_cost})`;
    else if (near) this.prompt.textContent = `E — Châm dầu (${Math.floor(near.fuel / 60)}/${TUNING.fuel_max})`;

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
