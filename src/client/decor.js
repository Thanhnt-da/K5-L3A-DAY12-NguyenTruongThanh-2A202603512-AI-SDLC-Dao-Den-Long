// Creative visuals ("Sáng tạo của tôi"), browser only. Nothing here touches the
// simulation: no collision, no rule, no number changes, so headless output is
// identical. Decoration is switched off in the benchmark scene.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { topAt } from '../sim/maps.js';
import { createRng } from '../sim/rng.js';

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

/** Bóng Mực silhouette: Mây's shape (body + conical hat), smaller, ink-black. Origin = shade centre. */
export function shadeGeometry() {
  const body = new THREE.CapsuleGeometry(0.26, 0.5, 3, 10);
  const hat = new THREE.ConeGeometry(0.42, 0.32, 12);
  hat.translate(0, 0.62, 0);
  const wisp = new THREE.ConeGeometry(0.22, 0.45, 8); // a fading tail instead of feet: it floats
  wisp.rotateX(Math.PI);
  wisp.translate(0, -0.62, 0);
  return mergeGeometries([body.toNonIndexed(), hat.toNonIndexed(), wisp.toNonIndexed()]);
}

/** Two glowing eyes on the +Z side (rim colour #7A3CFF, or #00B3FF in colour-blind mode). */
export function shadeEyesGeometry() {
  const l = new THREE.SphereGeometry(0.06, 6, 4);
  const r = l.clone();
  l.translate(-0.1, 0.32, 0.23);
  r.translate(0.1, 0.32, 0.23);
  return mergeGeometries([l, r]);
}

/**
 * Original hanging paper lantern (Hội An style) on a curved wooden post.
 * The post stands on the lantern position (the contract's "chân cột đèn");
 * the lamp hangs from an arm. Returns parts the scene animates.
 */
export function makePaperLantern(PAL) {
  const g = new THREE.Group();
  const wood = lambert(PAL.wood);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 4.2, 8), wood);
  post.position.y = 2.1;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.3, 8), lambert(0x6b6a72));
  base.position.y = 0.15;
  const arm = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 6, 12, Math.PI / 2), wood);
  arm.position.set(0.6, 4.2, 0);
  arm.rotation.z = Math.PI / 2;
  const hangX = 1.2;
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 4), wood);
  string.position.set(hangX, 4.6 - 0.18, 0);

  // lamp body: lathe profile of a round paper lantern, with gold caps and a red tassel
  const pts = [
    [0.12, -0.5], [0.32, -0.42], [0.46, -0.2], [0.5, 0], [0.46, 0.2], [0.32, 0.42], [0.12, 0.5],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const lamp = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), lambert(PAL.unlit, { emissive: 0x000000 }));
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.1, 10), lambert(PAL.gold));
  capTop.position.y = 0.53;
  const capBot = capTop.clone();
  capBot.position.y = -0.53;
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 6), lambert(PAL.scarf));
  tassel.position.y = -0.8;
  tassel.rotation.x = Math.PI;
  const light = new THREE.PointLight(PAL.lit, 0, 16);
  // torn paper strips: shown only on unlit lanterns (shape cue for colour-blind players)
  const torn = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.45, 5, 1, true), lambert(PAL.unlit, { side: THREE.DoubleSide }));
  torn.position.y = -0.55;
  torn.rotation.x = Math.PI;

  const head = new THREE.Group(); // swings from the arm; tilts when unlit
  head.position.set(hangX, 3.75, 0);
  head.add(lamp, capTop, capBot, tassel, light, torn);
  g.add(post, base, arm, string, head);
  return { group: g, lamp, light, head, torn };
}

function instanced(scene, geo, mat, matrices, colors) {
  if (!matrices.length) return;
  const m = new THREE.InstancedMesh(geo, mat, matrices.length);
  matrices.forEach((mx, i) => m.setMatrixAt(i, mx));
  if (colors) colors.forEach((c, i) => m.setColorAt(i, c));
  scene.add(m);
}

/**
 * Grass tufts, flowers and low bushes in the play area (walking through them looks natural),
 * and trees + rocks only on small islets out in the cloud sea, where nobody walks.
 * Fixed seed per Night: the same look every time, independent of the game seed.
 */
export function buildDecor(scene, map, PAL) {
  const rng = createRng(1000 + map.night);
  const o = new THREE.Object3D();
  const keepClear = [...map.lanterns, ...map.pads.map((p) => p.pos), ...map.charms, map.start];
  const free = (x, z) => keepClear.every((p) => Math.hypot(p[0] - x, p[2] - z) > 3) && Math.hypot(x, z) > (map.night === 3 ? 2.5 : 0);
  const at = (x, y, z, s, rotY = 0) => {
    o.position.set(x, y, z);
    o.rotation.set(0, rotY, 0);
    o.scale.setScalar(s);
    o.updateMatrix();
    return o.matrix.clone();
  };

  // --- soft plants on the islands
  const grass = [];
  const flowers = [];
  const flowerColors = [];
  const bushes = [];
  const petals = [0xf2c14e, 0xe8e2d0, 0xc8102e, 0xb98cff].map((c) => new THREE.Color(c));
  for (const area of map.wanderAreas) {
    const n = Math.round(area.r * area.r * 0.12);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * (area.r + 2);
      const x = area.cx + r * Math.cos(a);
      const z = area.cz + r * Math.sin(a);
      const y = topAt(map, x, z);
      if (y === null || !free(x, z)) continue;
      const k = rng();
      if (k < 0.6) grass.push(at(x, y, z, 0.7 + rng() * 0.6, rng() * 6));
      else if (k < 0.85) {
        flowers.push(at(x, y, z, 0.8 + rng() * 0.4));
        flowerColors.push(petals[Math.floor(rng() * petals.length)]);
      } else bushes.push(at(x, y, z, 0.6 + rng() * 0.5, rng() * 6));
    }
  }
  const blade = new THREE.ConeGeometry(0.08, 0.5, 3);
  blade.translate(0, 0.25, 0);
  const tuft = mergeGeometries([0, 1, 2].map((i) => blade.clone().rotateZ((i - 1) * 0.35).translate((i - 1) * 0.08, 0, 0)));
  instanced(scene, tuft, lambert(0x3f7a5f), grass);
  const flower = new THREE.SphereGeometry(0.1, 6, 4);
  flower.translate(0, 0.35, 0);
  instanced(scene, flower, new THREE.MeshBasicMaterial({ color: 0xffffff }), flowers, flowerColors);
  const bush = new THREE.IcosahedronGeometry(0.45, 0);
  bush.translate(0, 0.3, 0);
  instanced(scene, bush, lambert(0x27503f, { flatShading: true }), bushes);

  // --- islets with trees and rocks in the cloud sea (unreachable, so no collision needed)
  const islets = [];
  const trunks = [];
  const crowns = [];
  const rocks = [];
  const cx = map.wanderAreas.reduce((s, a) => s + a.cx, 0) / map.wanderAreas.length;
  const R = Math.max(...map.wanderAreas.map((a) => Math.abs(a.cx - cx) + a.r)) + 12;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rng() * 0.4;
    const r = R + rng() * 14;
    const x = cx + r * Math.cos(a);
    const z = r * Math.sin(a);
    const y = -3 - rng() * 3;
    const s = 2.5 + rng() * 2;
    islets.push(at(x, y, z, s));
    const trees = 1 + Math.floor(rng() * 3);
    for (let t = 0; t < trees; t++) {
      const tx = x + (rng() - 0.5) * s;
      const tz = z + (rng() - 0.5) * s;
      const ts = 0.8 + rng() * 0.6;
      trunks.push(at(tx, y + 0.4, tz, ts));
      crowns.push(at(tx, y + 0.4, tz, ts, rng() * 6));
    }
    rocks.push(at(x + (rng() - 0.5) * s, y + 0.4, z + (rng() - 0.5) * s, 0.5 + rng() * 0.6, rng() * 6));
  }
  const islet = new THREE.CylinderGeometry(1, 0.4, 1.2, 9);
  islet.translate(0, -0.2, 0);
  instanced(scene, islet, lambert(0x2f5d50), islets);
  const trunk = new THREE.CylinderGeometry(0.12, 0.18, 1.6, 6);
  trunk.translate(0, 0.8, 0);
  instanced(scene, trunk, lambert(PAL.wood), trunks);
  const crown = mergeGeometries([new THREE.ConeGeometry(0.9, 1.4, 7).translate(0, 2.1, 0), new THREE.ConeGeometry(0.7, 1.2, 7).translate(0, 2.8, 0)]);
  instanced(scene, crown, lambert(0x24483a, { flatShading: true }), crowns);
  const rock = new THREE.DodecahedronGeometry(0.6, 0);
  rock.translate(0, 0.3, 0);
  instanced(scene, rock, lambert(0x6b6a72, { flatShading: true }), rocks);
}

/** Ping beam: a soft pillar of light over a lantern for a few seconds. */
export function makePingBeam(PAL) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 30, 16, 1, true), new THREE.MeshBasicMaterial({ color: PAL.lit, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  m.position.y = 15;
  m.visible = false;
  return m;
}
