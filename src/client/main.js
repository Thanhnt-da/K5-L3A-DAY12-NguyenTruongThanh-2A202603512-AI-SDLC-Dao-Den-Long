// Browser client: renders the pure simulation with Three.js.
// The sim runs at a fixed 60 Hz (accumulator); rendering only reads world state.
// Keyboard/mouse are turned into the same input shape the headless runner uses.
import * as THREE from 'three';
import { createWorld, step } from '../sim/world.js';
import { WORLD, DT } from '../sim/config.js';

// ---------- input ----------
const keys = new Set();
const pressedOnce = new Set();
addEventListener('keydown', (e) => {
  if (!keys.has(e.code)) pressedOnce.add(e.code);
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
let camYawDeg = 0;
let dragging = false;
addEventListener('pointerdown', () => (dragging = true));
addEventListener('pointerup', () => (dragging = false));
addEventListener('pointermove', (e) => {
  if (dragging) camYawDeg -= e.movementX * 0.3;
});

const held = (...codes) => codes.some((c) => keys.has(c));
let prevButtons = { jump: false, interact: false, pulse: false, dash: false };

function readInput() {
  if (held('KeyQ')) camYawDeg += 120 * DT;
  if (held('KeyE')) camYawDeg -= 120 * DT;
  // Contract: at yaw 0, move z=+1 is +Z and x=+1 is +X. The camera looks along
  // +Z, so +X is screen-left; "right" keys therefore send x = -1.
  const x = (held('KeyA', 'ArrowLeft') ? 1 : 0) - (held('KeyD', 'ArrowRight') ? 1 : 0);
  const z = (held('KeyW', 'ArrowUp') ? 1 : 0) - (held('KeyS', 'ArrowDown') ? 1 : 0);
  const cur = { jump: held('Space'), interact: held('KeyF'), pulse: held('KeyR'), dash: held('ShiftLeft') };
  const pressed = {};
  for (const b in cur) pressed[b] = cur[b] && !prevButtons[b];
  prevButtons = cur;
  return { move: [x, z], camYawDeg, pressed };
}

// ---------- scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0716);
scene.fog = new THREE.Fog(0x1a0f2e, 25, 70);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
scene.add(new THREE.HemisphereLight(0x6a5acd, 0x1a0f2e, 0.6));
const moon = new THREE.DirectionalLight(0xbfb8ff, 0.5);
moon.position.set(-20, 40, -10);
scene.add(moon);

const island = new THREE.Mesh(
  new THREE.CylinderGeometry(WORLD.islandRadius, WORLD.islandRadius * 0.8, 4, 48),
  new THREE.MeshStandardMaterial({ color: 0x3b5a3a, roughness: 1 }),
);
island.position.y = -2;
scene.add(island);

// Mây: body + conical hat + small lantern
const mayGroup = new THREE.Group();
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.8, 4, 12), new THREE.MeshStandardMaterial({ color: 0x4a6fa5 }));
body.position.y = 0.75;
const hat = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.5, 20), new THREE.MeshStandardMaterial({ color: 0xd9b26f }));
hat.position.y = 1.6;
const handLamp = new THREE.PointLight(0xffa040, 4, 8);
handLamp.position.set(0.5, 1, 0.3);
mayGroup.add(body, hat, handLamp);
scene.add(mayGroup);

const lanternMeshes = new Map();
const moteMeshes = new Map();
const shadeMeshes = new Map();
const moteGeo = new THREE.SphereGeometry(0.15, 8, 8);
const moteMat = new THREE.MeshBasicMaterial({ color: 0xfff1a0 });

function syncMap(map, list, make) {
  const seen = new Set();
  for (const e of list) {
    seen.add(e.id);
    if (!map.has(e.id)) {
      const m = make(e);
      map.set(e.id, m);
      scene.add(m);
    }
  }
  for (const [id, m] of map) if (!seen.has(id)) (scene.remove(m), map.delete(id));
}

function makeLantern() {
  const g = new THREE.Group();
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 3, 12), new THREE.MeshStandardMaterial({ color: 0x5c4033 }));
  pillar.position.y = 1.5;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 16), new THREE.MeshStandardMaterial({ color: 0x332244, emissive: 0x000000 }));
  lamp.position.y = 3.4;
  const light = new THREE.PointLight(0xff9a3c, 0, 14);
  light.position.y = 3.4;
  g.add(pillar, lamp, light);
  g.userData = { lamp, light };
  return g;
}

function makeShade() {
  return new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), new THREE.MeshStandardMaterial({ color: 0x1b0b2e, emissive: 0x2a0a40 }));
}

function render(w, alphaTime) {
  const p = w.player;
  mayGroup.position.set(p.pos[0], p.pos[1], p.pos[2]);
  syncMap(lanternMeshes, w.lanterns, makeLantern);
  for (const l of w.lanterns) {
    const g = lanternMeshes.get(l.id);
    g.position.set(...l.pos);
    g.userData.lamp.material.emissive.setHex(l.lit ? 0xff9a3c : 0x000000);
    g.userData.light.intensity = l.lit ? 8 : 0;
  }
  syncMap(moteMeshes, w.motes, () => new THREE.Mesh(moteGeo, moteMat));
  for (const m of w.motes) moteMeshes.get(m.id).position.set(m.pos[0], 0.8 + 0.2 * Math.sin(alphaTime * 3 + m.pos[0]), m.pos[2]);
  syncMap(shadeMeshes, w.shades, makeShade);
  for (const s of w.shades) shadeMeshes.get(s.id).position.set(...s.pos);

  // third-person camera behind Mây, looking along the camera yaw
  const th = (camYawDeg * Math.PI) / 180;
  camera.position.set(p.pos[0] - Math.sin(th) * 9, p.pos[1] + 5, p.pos[2] - Math.cos(th) * 9);
  camera.lookAt(p.pos[0], p.pos[1] + 1.2, p.pos[2]);
  renderer.render(scene, camera);
}

const hud = document.getElementById('hud');
function updateHud(w) {
  const lit = w.lanterns.filter((l) => l.lit).length;
  const end = w.state === 'won' ? '\nYOU WIN · Enter to replay' : w.state === 'lost' ? '\nGAME OVER · Enter to replay' : '';
  hud.textContent = `Time ${w.timeLeft.toFixed(0)}s   Score ${w.score}\nFlames ${w.player.flames}   Carried ${w.player.carried}\nLanterns ${lit}/${w.lanterns.length}${end}`;
}

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- loop ----------
let world = createWorld({ seed: Date.now() >>> 0, night: 1 });
let acc = 0;
let last = performance.now();
function frame(now) {
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  if (pressedOnce.has('Enter') && world.state !== 'playing') world = createWorld({ seed: Date.now() >>> 0, night: 1 });
  pressedOnce.clear();
  while (acc >= DT) {
    step(world, readInput());
    acc -= DT;
  }
  render(world, now / 1000);
  updateHud(world);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
