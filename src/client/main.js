// Browser client: screens (menu → Night intro → play → result → next Night →
// Bình Minh), pause menu, settings, sound, HUD. The sim runs at a fixed 60 Hz
// (accumulator); rendering only reads world state. Keyboard and mouse become
// the same input shape the headless runner uses.
import * as THREE from 'three';
import { createWorld, step } from '../sim/world.js';
import { DT } from '../sim/config.js';
import { MAPS } from '../sim/maps.js';
import { NightScene } from './scene.js';
import { Hud } from './hud.js';
import { Sound } from './audio.js';
import { loadSettings, saveSettings } from './settings.js';

const $ = (id) => document.getElementById(id);

// ---------- intro text (original lines for this game) ----------
const INTRO = {
  1: 'Ông Đăng: "Sương đen nuốt mất ánh sáng Bến rồi, cháu ạ. Gom đom đóm, thắp lại năm ngọn đèn lớn trước khi trời sáng."',
  2: 'Ông Đăng: "Đảo Cau có hai hòn, nối bằng cầu tre. Bục nhảy sẽ đưa cháu qua sông mây. Coi chừng Gió Lạc, nó thích ánh sáng lắm."',
  3: 'Ông Đăng: "Đảo Chuông cao ba tầng. Gió mạnh từng cơn. Thắp bảy ngọn đèn và tiếng chuông sẽ gọi bình minh về."',
};

// ---------- input ----------
const keys = new Set();
const taps = new Set(); // pressed since the last sim step: a quick tap between frames still counts
addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (!keys.has(e.code)) {
    taps.add(e.code);
    onKeyPress(e.code);
  }
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

const settings = loadSettings();
let camYawDeg = 0;
let dragging = false;
addEventListener('pointerdown', (e) => {
  if (e.target === renderer.domElement) dragging = true;
  sound.unlock();
});
addEventListener('pointerup', () => (dragging = false));
addEventListener('pointermove', (e) => {
  if (dragging) camYawDeg -= e.movementX * settings.sensitivity;
});

const held = (...codes) => codes.some((c) => keys.has(c));
const BUTTON_KEYS = { jump: ['Space'], interact: ['KeyE'], pulse: ['KeyF'], dash: ['ShiftLeft', 'ShiftRight'], pause: ['Escape', 'KeyP'] };
let prevButtons = {};
let injectPause = false;

function readInput() {
  if (held('ArrowLeft', 'KeyQ')) camYawDeg += 120 * DT;
  if (held('ArrowRight', 'KeyR')) camYawDeg -= 120 * DT;
  // Contract: at yaw 0, move z=+1 is +Z and x=+1 is +X. The camera looks along
  // +Z, so +X is screen-left; "right" keys therefore send x = -1.
  const x = (held('KeyA') ? 1 : 0) - (held('KeyD') ? 1 : 0);
  const z = (held('KeyW', 'ArrowUp') ? 1 : 0) - (held('KeyS', 'ArrowDown') ? 1 : 0);
  const cur = {};
  const pressed = {};
  for (const [b, codes] of Object.entries(BUTTON_KEYS)) {
    cur[b] = held(...codes);
    pressed[b] = (cur[b] && !prevButtons[b]) || codes.some((c) => taps.has(c) && !keys.has(c));
  }
  if (injectPause) pressed.pause = true;
  injectPause = false;
  taps.clear();
  prevButtons = cur;
  return { move: [x, z], camYawDeg, pressed };
}

// ---------- app state ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(1); // performance: Ticket-02 needs >= 30 FPS at 1280x720 on modest laptops
document.body.prepend(renderer.domElement);
const hud = new Hud();
const sound = new Sound();
sound.setVolume(settings.volume);

let screen = 'menu'; // menu | intro | play | result | dawn
let night = 1;
let totalScore = 0; // sum of the Nights won so far
let world = null;
let scene = null;
let acc = 0;
let lastCountdown = null;

function showScreen(id) {
  for (const el of document.querySelectorAll('.screen')) el.hidden = el.id !== id;
}

function startNight(n) {
  night = n;
  scene?.dispose();
  world = createWorld({ seed: (Date.now() >>> 0) ^ (n * 7919), night: n });
  scene = new NightScene(renderer, world.map);
  scene.resize(innerWidth, innerHeight);
  camYawDeg = 0;
  acc = 0;
  lastCountdown = null;
  screen = 'intro';
  $('intro-title').textContent = `Đêm ${n} – ${MAPS[n].name}`;
  $('intro-text').textContent = INTRO[n];
  showScreen('intro');
  hud.show(false);
}

function play() {
  sound.unlock();
  sound.startMusic();
  screen = 'play';
  showScreen(null);
  hud.show(true);
}

function endNight() {
  const won = world.state === 'won';
  if (won) totalScore += world.score;
  if (won && night === 3) {
    screen = 'dawn';
    $('dawn-score').textContent = String(totalScore);
    showScreen('dawn');
  } else {
    screen = 'result';
    $('result-title').textContent = won ? `Đêm ${night} – thắp sáng!` : `Đêm ${night} – thất bại`;
    $('result-text').textContent = won ? `Điểm đêm này: ${world.score} · Tổng: ${totalScore}` : 'Sương đen vẫn còn đó. Thử lại nhé.';
    $('result-next').textContent = won ? 'Đêm kế tiếp' : 'Chơi lại Đêm';
    showScreen('result');
  }
  hud.show(false);
  sound.stopMusic();
}

function toMenu() {
  screen = 'menu';
  totalScore = 0;
  sound.stopMusic();
  hud.show(false);
  showScreen('menu');
}

function onKeyPress(code) {
  if (code !== 'Enter') return;
  if (screen === 'menu') startNight(firstNight);
  else if (screen === 'intro') play();
  else if (screen === 'result') $('result-next').click();
  else if (screen === 'dawn') toMenu();
}

// buttons
// ?night=2 or ?night=3 starts from that Night (for testing and the demo video)
const firstNight = [1, 2, 3].includes(Number(new URLSearchParams(location.search).get('night'))) ? Number(new URLSearchParams(location.search).get('night')) : 1;
$('menu-start').onclick = () => {
  sound.unlock();
  totalScore = 0;
  startNight(firstNight);
};
$('menu-settings').onclick = () => openSettings('menu');
$('intro-go').onclick = play;
$('result-next').onclick = () => (world.state === 'won' ? startNight(night + 1) : startNight(night));
$('result-menu').onclick = toMenu;
$('dawn-menu').onclick = toMenu;
$('pause-continue').onclick = () => (injectPause = true);
$('pause-replay').onclick = () => startNight(night);
$('pause-settings').onclick = () => openSettings('pause');
$('pause-menu').onclick = toMenu;

let settingsBack = 'menu';
function openSettings(from) {
  settingsBack = from;
  $('set-volume').value = String(settings.volume);
  $('set-sens').value = String(settings.sensitivity);
  showScreen('settings');
}
$('set-volume').oninput = (e) => {
  settings.volume = Number(e.target.value);
  sound.setVolume(settings.volume);
  saveSettings(settings);
};
$('set-sens').oninput = (e) => {
  settings.sensitivity = Number(e.target.value);
  saveSettings(settings);
};
$('set-back').onclick = () => showScreen(settingsBack === 'pause' ? 'pause' : 'menu');

// ---------- FPS meter (for the >= 30 FPS @ 1280x720 check) ----------
const fps = { frames: 0, start: performance.now(), avg: 0 };
window.__fps = fps;
window.__game = { get world() { return world; }, get scene() { return scene; } }; // debug handle for browser checks
const fpsEl = $('fps');
fpsEl.hidden = !new URLSearchParams(location.search).has('fps');

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (screen === 'play') {
    acc += dt;
    while (acc >= DT && world.state === 'playing') {
      const input = readInput();
      const wasGrounded = world.player.grounded;
      for (const e of step(world, input)) sound.event(e);
      if (input.pressed.jump && wasGrounded && !world.player.grounded) sound.jump();
      acc -= DT;
    }
    if (world.state !== 'playing') endNight();
    else {
      const pauseOpen = world.paused && $('settings').hidden;
      $('pause').hidden = !pauseOpen;
      const sec = Math.ceil(world.timeLeft);
      if (!world.paused && sec <= 10 && sec !== lastCountdown) {
        lastCountdown = sec;
        sound.countdown();
      }
    }
  }
  if (scene && world) {
    scene.render(world, camYawDeg, now / 1000);
    if (screen === 'play') hud.update(world, scene, now / 1000, totalScore);
  } else {
    renderer.setClearColor(0x0e1430);
    renderer.clear();
  }
  fps.frames++;
  if (now - fps.start >= 1000) {
    fps.avg = (fps.frames * 1000) / (now - fps.start);
    fps.frames = 0;
    fps.start = now;
    fpsEl.textContent = `${fps.avg.toFixed(0)} FPS · ${innerWidth}×${innerHeight}`;
  }
  requestAnimationFrame(frame);
}

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  scene?.resize(innerWidth, innerHeight);
}
addEventListener('resize', resize);
resize();
showScreen('menu');
hud.show(false);
requestAnimationFrame(frame);
