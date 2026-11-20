// Three.js scene for one Night, built from the same terrain shapes the sim uses.
// Colours follow the Ticket-02 standard palette.
import * as THREE from 'three';

export const PAL = {
  sky: 0x0e1430,
  fog: 0x1b2350,
  grass: 0x2f5d50,
  sand: 0xc9b48a,
  wood: 0x6b4a2f,
  sea: 0x12384a,
  lit: 0xffb347,
  litCore: 0xffe9b0,
  unlit: 0x5b5f6e,
  moteCore: 0xfff6c2,
  moteHalo: 0xffe58a,
  shade: 0x120a1a,
  shadeRim: 0x7a3cff,
  shadeRimCB: 0x00b3ff, // Ticket-03 colour-blind palette
  shadeStunned: 0x3a3450,
  coat: 0xe8e2d0,
  scarf: 0xc8102e,
  gold: 0xf2c14e,
  drifter: 0x8fa3b8,
};

// Lambert is much cheaper than Standard with many point lights (one per lantern)
const std = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

function terrainMesh(sh) {
  const g = new THREE.Group();
  if (sh.kind === 'disc') {
    const h = sh.tower ? 8 : Math.max(sh.y + 2, 2);
    const top = sh.tower ? sh.y : sh.y;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(sh.r, sh.tower ? sh.r : sh.r * 0.92, h, 48), std(sh.tower ? PAL.wood : PAL.grass));
    m.position.set(sh.cx, top - h / 2, sh.cz);
    g.add(m);
    if (!sh.tower && sh.y === 0) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(sh.r, 0.25, 6, 64), std(PAL.sand));
      rim.rotation.x = Math.PI / 2;
      rim.position.set(sh.cx, 0, sh.cz);
      g.add(rim);
    }
  } else if (sh.kind === 'rect') {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sh.x1 - sh.x0, 0.3, sh.z1 - sh.z0), std(PAL.wood));
    m.position.set((sh.x0 + sh.x1) / 2, sh.y - 0.15, (sh.z0 + sh.z1) / 2);
    g.add(m);
  } else if (sh.kind === 'halfRing') {
    // half annulus for z > 0, extruded down to the ground
    // Shape lives in XY. rotation.x = -90° maps shape (x, y) to world (x, -y) on XZ
    // and the extrusion (+Z) to world +Y. So the half with shape y < 0 lands on world z > 0.
    const shape = new THREE.Shape();
    shape.absarc(0, 0, sh.rOut, Math.PI, 2 * Math.PI, false);
    shape.absarc(0, 0, sh.rIn, 2 * Math.PI, Math.PI, true);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: sh.y, bevelEnabled: false, curveSegments: 32 });
    const m = new THREE.Mesh(geo, std(PAL.grass));
    m.rotation.x = -Math.PI / 2;
    g.add(m);
  } else if (sh.kind === 'ramp') {
    const len = sh.rFoot - sh.rTop;
    const rise = sh.y1 - sh.y0;
    const slope = Math.hypot(len, rise);
    const m = new THREE.Mesh(new THREE.BoxGeometry(slope, 0.3, sh.width), std(PAL.sand));
    const mid = (sh.rFoot + sh.rTop) / 2;
    const a = (sh.a * Math.PI) / 180;
    m.position.set(mid * Math.cos(a), (sh.y0 + sh.y1) / 2 - 0.15, mid * Math.sin(a));
    m.rotation.order = 'YZX';
    m.rotation.y = -a;
    m.rotation.z = -Math.atan2(rise, len); // local +X points outwards, so tilt it down: higher towards the centre
    g.add(m);
  }
  return g;
}

function makeMay() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.8, 4, 12), std(PAL.coat));
  body.position.y = 0.75;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.08, 6, 16), std(PAL.scarf));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.25;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.5, 20), std(PAL.sand));
  hat.position.y = 1.6;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), new THREE.MeshBasicMaterial({ color: PAL.lit }));
  lamp.position.set(0.5, 1, 0.3);
  const light = new THREE.PointLight(PAL.lit, 4, 8);
  light.position.copy(lamp.position);
  g.add(body, scarf, hat, lamp, light);
  return g;
}

function makeLantern() {
  const g = new THREE.Group();
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 3, 12), std(PAL.wood));
  pillar.position.y = 1.5;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 16), std(PAL.unlit, { emissive: 0x000000 }));
  lamp.position.y = 3.4;
  const light = new THREE.PointLight(PAL.lit, 0, 16);
  light.position.y = 3.4;
  const zone = new THREE.Mesh(new THREE.RingGeometry(5.8, 6, 48), new THREE.MeshBasicMaterial({ color: PAL.lit, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  // fuel bar above the lamp (Ticket-03): back plate + fill scaled by fuel / 100
  const barBack = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.18), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }));
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.14), new THREE.MeshBasicMaterial({ color: PAL.lit }));
  barBack.position.y = bar.position.y = 4.4;
  bar.position.z = 0.01;
  // torn paper strips, shown on unlit lanterns so lit/unlit differ without colour
  const torn = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.5, 5, 1, true), std(PAL.unlit, { side: THREE.DoubleSide }));
  torn.position.y = 3.0;
  torn.rotation.x = Math.PI;
  zone.rotation.x = -Math.PI / 2;
  zone.position.y = 0.05;
  const head = new THREE.Group();
  head.add(lamp, light, torn);
  g.add(pillar, head, zone, barBack, bar);
  g.userData = { lamp, light, zone, bar, barBack, head, torn };
  return g;
}

function makeDrifter() {
  const m = new THREE.Mesh(new THREE.TorusKnotGeometry(0.5, 0.08, 48, 6), std(PAL.drifter, { emissive: PAL.drifter, emissiveIntensity: 0.3 }));
  return m;
}

function makeCharm() {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), std(PAL.scarf, { emissive: PAL.gold, emissiveIntensity: 0.4 }));
  return m;
}

export class NightScene {
  constructor(renderer, map) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PAL.sky);
    this.scene.fog = new THREE.Fog(PAL.fog, 30, 95);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
    this.ambient = new THREE.HemisphereLight(0x8899cc, PAL.sea, 0.15);
    const moon = new THREE.DirectionalLight(0xbfc8ff, 0.35);
    moon.position.set(-20, 40, -10);
    this.scene.add(this.ambient, moon);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), std(PAL.sea));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -12;
    this.scene.add(sea);
    for (const sh of map.shapes) this.scene.add(terrainMesh(sh));
    for (const pad of map.pads) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(pad.r, pad.r, 0.2, 24), std(PAL.gold, { emissive: PAL.gold, emissiveIntensity: 0.5 }));
      m.position.set(pad.pos[0], pad.pos[1] + 0.1, pad.pos[2]);
      this.scene.add(m);
    }
    this.may = makeMay();
    this.scene.add(this.may);
    this.maps = { lanterns: new Map(), drifters: new Map(), charms: new Map() };
    // Fireflies and Bóng Mực are drawn as InstancedMesh: one draw call each, however many
    // there are (Ticket-04 benchmark: 100 fireflies + 200 shades). Capacity grows as needed.
    this.inst = {
      moteCore: this.makeInstanced(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({ color: PAL.moteCore }), 64),
      moteHalo: this.makeInstanced(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: PAL.moteHalo, transparent: true, opacity: 0.35, depthWrite: false }), 64),
      shade: this.makeInstanced(new THREE.SphereGeometry(0.8, 14, 10), std(0xffffff, { emissive: PAL.shadeRim, emissiveIntensity: 0.3 }), 32),
    };
    this.tmp = new THREE.Object3D();
    this.tmpColor = new THREE.Color();
  }

  makeInstanced(geo, mat, cap) {
    const m = new THREE.InstancedMesh(geo, mat, cap);
    m.count = 0;
    m.frustumCulled = false;
    this.scene.add(m);
    return m;
  }

  /** Make sure an InstancedMesh can hold n instances (rebuilds it bigger when needed). */
  ensure(key, n) {
    const m = this.inst[key];
    if (n <= m.instanceMatrix.count) return m;
    this.scene.remove(m);
    const bigger = this.makeInstanced(m.geometry, m.material, Math.max(n, m.instanceMatrix.count * 2));
    this.inst[key] = bigger;
    return bigger;
  }

  sync(map, list, make) {
    const seen = new Set();
    for (const e of list) {
      seen.add(e.id);
      if (!map.has(e.id)) {
        const m = make(e);
        map.set(e.id, m);
        this.scene.add(m);
      }
    }
    for (const [id, m] of map) {
      if (!seen.has(id)) {
        this.scene.remove(m);
        map.delete(id);
      }
    }
  }

  render(w, camYawDeg, t, colorBlind = false) {
    const p = w.player;
    this.may.position.set(...p.pos);
    this.may.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
    this.may.visible = p.fallWait === 0 && !(p.invulnTicks > 0 && Math.floor(t * 10) % 2 === 0);

    this.sync(this.maps.lanterns, w.lanterns, makeLantern);
    for (const l of w.lanterns) {
      const g = this.maps.lanterns.get(l.id);
      g.position.set(...l.pos);
      const u = g.userData;
      const cost = l.everLit ? 5 : 10;
      const frac = l.deposited / cost;
      const fuel = l.lit ? l.fuel / 60 : 0; // sim keeps fuel in 1/60 units
      const low = l.lit && fuel < 30;
      const blinkOff = low && Math.floor(t * 2) % 2 === 1; // 1 Hz slow blink
      u.lamp.material.color.setHex(l.lit ? PAL.litCore : PAL.unlit);
      u.lamp.material.emissive.setHex(PAL.lit);
      u.lamp.material.emissiveIntensity = l.lit ? (blinkOff ? 0.2 : 1) : frac * 0.6;
      u.light.intensity = l.lit ? (blinkOff ? 2 : 4 + 6 * (fuel / 100)) : frac * 3;
      u.zone.material.opacity = l.lit && !low ? 0.35 : 0; // fuel < 30: no safe zone
      u.bar.visible = u.barBack.visible = l.lit && !blinkOff;
      u.bar.scale.x = Math.max(0.001, fuel / 100);
      u.bar.position.x = -0.8 * (1 - fuel / 100);
      u.bar.material.color.setHex(low ? (colorBlind ? 0xffffff : 0xff5a5f) : PAL.lit);
      u.bar.quaternion.copy(this.camera.quaternion);
      u.barBack.quaternion.copy(this.camera.quaternion);
      u.head.rotation.z = l.lit ? 0 : 0.2; // unlit lanterns tilt (shape cue, not only colour)
      u.torn.visible = !l.lit;
    }
    const o = this.tmp;
    const core = this.ensure('moteCore', w.motes.length);
    const halo = this.ensure('moteHalo', w.motes.length);
    w.motes.forEach((m, i) => {
      o.position.set(m.pos[0], m.pos[1] + 0.8 + 0.2 * Math.sin(t * 3 + m.pos[0]), m.pos[2]);
      o.scale.setScalar(1);
      o.updateMatrix();
      core.setMatrixAt(i, o.matrix);
      halo.setMatrixAt(i, o.matrix);
    });
    core.count = halo.count = w.motes.length;
    core.instanceMatrix.needsUpdate = halo.instanceMatrix.needsUpdate = true;

    const sh = this.ensure('shade', w.shades.length);
    sh.material.emissive.setHex(colorBlind ? PAL.shadeRimCB : PAL.shadeRim);
    w.shades.forEach((s, i) => {
      o.position.set(...s.pos);
      o.scale.setScalar(s.state === 'spawning' ? 0.5 : 1);
      o.updateMatrix();
      sh.setMatrixAt(i, o.matrix);
      // stunned = grey-violet; draining = lighter so it stands out; otherwise ink black
      sh.setColorAt(i, this.tmpColor.setHex(s.state === 'stunned' ? PAL.shadeStunned : s.state === 'drain' ? 0x3a1a5a : PAL.shade));
    });
    sh.count = w.shades.length;
    sh.instanceMatrix.needsUpdate = true;
    if (sh.instanceColor) sh.instanceColor.needsUpdate = true;
    this.sync(this.maps.drifters, w.drifters, makeDrifter);
    for (const d of w.drifters) {
      const m = this.maps.drifters.get(d.id);
      m.position.set(...d.pos);
      m.rotation.y = t * 4;
    }
    this.sync(this.maps.charms, w.charms, makeCharm);
    for (const c of w.charms) {
      const m = this.maps.charms.get(c.id);
      m.position.set(c.pos[0], c.pos[1] + 1 + 0.15 * Math.sin(t * 2), c.pos[2]);
      m.rotation.y = t;
      m.visible = c.available;
    }

    const lit = w.lanterns.filter((l) => l.lit).length;
    this.ambient.intensity = 0.15 + 0.55 * (lit / w.lanterns.length); // Ticket-02 Part 3.8

    if (this.cameraOverride) {
      // benchmark: fixed orbit around (0,0,0)
      this.camera.position.set(...this.cameraOverride(t));
      this.camera.lookAt(0, 0, 0);
    } else {
      const th = (camYawDeg * Math.PI) / 180;
      this.camera.position.set(p.pos[0] - Math.sin(th) * 9, p.pos[1] + 5, p.pos[2] - Math.cos(th) * 9);
      this.camera.lookAt(p.pos[0], p.pos[1] + 1.2, p.pos[2]);
      if (this.shakeUntil > t) {
        // hit shake (off with "Giảm chuyển động")
        this.camera.position.x += Math.sin(t * 90) * 0.15;
        this.camera.position.y += Math.cos(t * 77) * 0.15;
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  /** Screen position of a world point, or null when behind the camera. */
  project(pos) {
    const v = new THREE.Vector3(pos[0], pos[1] + 3, pos[2]).project(this.camera);
    if (v.z > 1) return null;
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
  }

  /** Compile every shader now, so nothing stalls the first time it comes into view. */
  warm(w) {
    this.render(w, 0, 0); // creates all lanterns/charms/instances
    this.renderer.compile(this.scene, this.camera);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.scene.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material) [].concat(o.material).forEach((m) => m.dispose());
    });
  }
}
