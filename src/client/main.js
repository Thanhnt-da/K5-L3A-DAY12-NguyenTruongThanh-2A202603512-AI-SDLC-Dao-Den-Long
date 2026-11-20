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
import { runBench } from './benchmode.js';
import { ACTIONS, DEFAULT_KEYS, keyName, conflictOf } from './keys.js';
import { getBoard, submitScore } from './board.js';

const $ = (id) => document.getElementById(id);

// ---------- intro text (original lines for this game) ----------
const INTRO = {
  1: 'Ông Đăng: "Sương đen nuốt mất ánh sáng Bến rồi, cháu ạ. Thắp đèn rồi giữ cho chúng cháy tới bình minh: đèn cạn dầu là tắt, Bóng Mực lại hút dầu đèn yếu."',
  2: 'Ông Đăng: "Đảo Cau có hai hòn, nối bằng cầu tre. Bục nhảy sẽ đưa cháu qua sông mây. Coi chừng Gió Lạc, nó thích ánh sáng lắm."',
  3: 'Ông Đăng: "Đảo Chuông cao ba tầng. Gió mạnh từng cơn. Thắp bảy ngọn đèn và tiếng chuông sẽ gọi bình minh về."',
};

// ---------- input ----------
const keys = new Set();
const taps = new Set(); // pressed since the last sim step: a quick tap between frames still counts
let capturing = null; // action waiting for a new key in Settings
addEventListener('keydown', (e) => {
  if (capturing) {
    e.preventDefault();
    captureKey(e.code);
    return;
  }
  if (e.target instanceof HTMLInputElement && e.target.type === 'text') return; // typing a name
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
let prevButtons = {};
let injectPause = false;

function readInput() {
  if (held('ArrowLeft', 'KeyQ')) camYawDeg += 120 * DT;
  if (held('ArrowRight', 'KeyR')) camYawDeg -= 120 * DT;
  // Contract: at yaw 0, move z=+1 is +Z and x=+1 is +X. The camera looks along
  // +Z, so +X is screen-left; "right" keys therefore send x = -1.
  const K = settings.keys; // remappable (Settings)
  const x = (held(...K.left) ? 1 : 0) - (held(...K.right) ? 1 : 0);
  const z = (held(...K.up) ? 1 : 0) - (held(...K.down) ? 1 : 0);
  const cur = {};
  const pressed = {};
  for (const b of ['jump', 'interact', 'pulse', 'dash', 'pause']) {
    const codes = K[b];
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
let nightsWon = 0;
let gameSeed = 0;
let afterSave = null; // screen to show after the name prompt
const cues = { shade: null, shadeUntil: 0 }; // visual cues for sounds (Ticket-04 Part 4)
let flashUntil = 0;

function showScreen(id) {
  for (const el of document.querySelectorAll('.screen')) el.hidden = el.id !== id;
}

function startNight(n) {
  night = n;
  scene?.dispose();
  const seed = ((Date.now() >>> 0) ^ (n * 7919)) >>> 0;
  if (n === firstNight || !gameSeed) gameSeed = seed;
  world = createWorld({ seed, night: n });
  scene = new NightScene(renderer, world.map);
  scene.resize(innerWidth, innerHeight);
  scene.warm(world);
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
  if (won) {
    totalScore += world.score;
    nightsWon++;
  }
  if (won && night === 3) {
    screen = 'dawn';
    $('dawn-score').textContent = String(totalScore);
    askName('dawn');
  } else {
    screen = 'result';
    $('result-title').textContent = won ? `Đêm ${night} – thắp sáng!` : `Đêm ${night} – thất bại`;
    const need = Math.ceil(0.6 * world.lanterns.length);
    $('result-text').textContent = won ? `Giữ đảo sáng tới bình minh! Điểm đêm này: ${world.score} · Tổng: ${totalScore}` : `Cần ít nhất ${need}/${world.lanterns.length} đèn sáng lúc bình minh. Thử lại nhé.`;
    $('result-next').textContent = won ? 'Đêm kế tiếp' : 'Chơi lại Đêm';
    if (won) showScreen('result');
    else askName('result'); // Ticket-04: offer the leaderboard after any loss
  }
  hud.show(false);
  sound.stopMusic();
}

function askName(next) {
  afterSave = next;
  screen = 'savescore';
  $('save-summary').textContent = `Tổng điểm: ${totalScore} · Đêm thắng: ${nightsWon}/3`;
  $('save-error').textContent = '';
  showScreen('savescore');
  $('save-name').focus();
}

async function saveName() {
  try {
    await submitScore({ name: $('save-name').value, score: totalScore, nights_won: nightsWon, seed: gameSeed });
    await showBoard(afterSave);
  } catch (e) {
    $('save-error').textContent = `⚠ ${e.message}`;
  }
}

let boardBack = 'menu';
async function showBoard(back = 'menu') {
  boardBack = back;
  const entries = await getBoard();
  $('board-rows').innerHTML = entries.length
    ? entries.map((e, i) => `<tr><td>${i + 1}</td><td>${e.name.replace(/[<&]/g, '')}</td><td>${e.score}</td><td>${e.nights_won}/3</td><td>${e.achieved_at.slice(0, 16).replace('T', ' ')}</td></tr>`).join('')
    : '<tr><td colspan="5">Chưa có ai. Hãy là người đầu tiên!</td></tr>';
  screen = 'board';
  showScreen('board');
}

function toMenu() {
  screen = 'menu';
  totalScore = 0;
  nightsWon = 0;
  gameSeed = 0;
  sound.stopMusic();
  hud.show(false);
  showScreen('menu');
}

function onKeyPress(code) {
  if (code !== 'Enter') return;
  if (screen === 'menu') $('menu-start').click();
  else if (screen === 'intro') play();
  else if (screen === 'savescore') saveName();
  else if (screen === 'result') $('result-next').click();
  else if (screen === 'dawn') toMenu();
  else if (screen === 'board') $('board-back').click();
}

// buttons
// ?night=2 or ?night=3 starts from that Night (for testing and the demo video)
const firstNight = [1, 2, 3].includes(Number(new URLSearchParams(location.search).get('night'))) ? Number(new URLSearchParams(location.search).get('night')) : 1;
$('menu-start').onclick = () => {
  sound.unlock();
  totalScore = 0;
  nightsWon = 0;
  gameSeed = 0;
  startNight(firstNight);
};
$('menu-board').onclick = () => showBoard('menu');
$('save-ok').onclick = saveName;
$('save-name').onkeydown = (e) => {
  if (e.key === 'Enter') saveName(); // the global key handler ignores text fields
};
$('save-skip').onclick = () => {
  screen = afterSave;
  showScreen(afterSave);
};
$('board-back').onclick = () => {
  screen = boardBack;
  showScreen(boardBack);
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
  $('set-cb').checked = settings.colorBlind;
  $('set-rm').checked = settings.reducedMotion;
  $('set-ui').checked = settings.uiScale === 1.25;
  renderKeys();
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
$('set-cb').onchange = (e) => {
  settings.colorBlind = e.target.checked;
  saveSettings(settings);
};
$('set-rm').onchange = (e) => {
  settings.reducedMotion = e.target.checked;
  saveSettings(settings);
};
$('set-ui').onchange = (e) => {
  settings.uiScale = e.target.checked ? 1.25 : 1;
  applyUiScale();
  saveSettings(settings);
};
function applyUiScale() {
  document.documentElement.style.setProperty('--ui', String(settings.uiScale));
}
applyUiScale();

// key remapping: click an action, press a key; a key already used elsewhere is refused with a warning
function renderKeys() {
  $('keys').innerHTML = ACTIONS.map(([a, label]) => `<button data-act="${a}" class="key-row">${label}: <b>${capturing === a ? '…' : settings.keys[a].map(keyName).join(' / ')}</b></button>`).join('');
  for (const b of $('keys').querySelectorAll('button')) b.onclick = () => {
    capturing = b.dataset.act;
    $('keys-warn').textContent = 'Nhấn phím mới (Esc để hủy)';
    renderKeys();
  };
}
function captureKey(code) {
  const action = capturing;
  capturing = null;
  if (code === 'Escape' && action !== 'pause') {
    $('keys-warn').textContent = '';
  } else {
    const other = conflictOf(settings.keys, action, code);
    if (other) {
      $('keys-warn').textContent = `⚠ Phím ${keyName(code)} đã dùng cho "${ACTIONS.find(([a]) => a === other)[1]}". Chọn phím khác.`;
    } else {
      settings.keys[action] = [code];
      saveSettings(settings);
      $('keys-warn').textContent = '';
    }
  }
  renderKeys();
}
$('keys-reset').onclick = () => {
  settings.keys = structuredClone(DEFAULT_KEYS);
  saveSettings(settings);
  $('keys-warn').textContent = 'Đã khôi phục mặc định';
  renderKeys();
};
$('set-back').onclick = () => {
  capturing = null;
  showScreen(settingsBack === 'pause' ? 'pause' : 'menu');
};

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
      for (const e of step(world, input)) {
        sound.event(e);
        if (e.name === 'shade_spawned') {
          cues.shade = e.data.id;
          cues.shadeUntil = now + 2500;
        }
        if (e.name === 'player_hit' && !settings.reducedMotion) {
          flashUntil = now + 250;
          scene.shakeUntil = now / 1000 + 0.35;
        }
      }
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
    scene.render(world, camYawDeg, now / 1000, settings.colorBlind);
    if (screen === 'play') {
      hud.update(world, scene, now / 1000, totalScore, settings.colorBlind);
      hud.cues(world, scene, cues.shadeUntil > now ? cues.shade : null);
    }
    $('flash').hidden = !(flashUntil > now);
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
const urlParams = new URLSearchParams(location.search);
if (urlParams.has('bench')) {
  // Ticket-04 benchmark scene: no menus, HUD or input
  showScreen(null);
  hud.show(false);
  runBench(renderer, urlParams);
} else {
  showScreen('menu');
  hud.show(false);
  requestAnimationFrame(frame);
}
