// Bakes the level-1 garden into one GLB for the app (docs/DECISIONS.md D40).
//
// It is the picture builder of /home/claude/gen/garden3d/tool/garden.js, which rendered every
// garden picture of the app (D35), run once per stage (60 element counts x 3 water levels x 4
// foliage stages) without drawing anything: each piece of every stage is recorded with the stages
// where it is drawn. Then the pieces are merged, one mesh per material, in an order that keeps the
// pieces of one stage together, and written with their stages. The app shows a stage by drawing
// ranges of these meshes: no model to place, no file to decode on the phone.
//
// Runs in a browser page (bake.html, driven by bake.py): the source models are FBX and GLB files,
// read by three.js's loaders, which need a DOM.
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { BinaryBuilder, writeGlb } from './lib/glb.mjs';
import {
  comboOf,
  encodeVisibility,
  FOLIAGE_STAGES,
  MAX_COUNT,
  WATER_LEVELS,
} from './lib/visibility.mjs';

// ---------------------------------------------------------------------------------------------
// Settings of the picture builder, unchanged (garden.js, render_app.py)
// ---------------------------------------------------------------------------------------------

const COLORS = {
  earth: 0xc9a67e,
  earthDry: 0xbfa98c,
  slabSide: 0xb08a66,
  border: 0xddd3c2,
  paving: 0xe9e0d0,
  curb: 0xd3c8b5,
  soil: 0x9a7650,
  lawn: 0xa9c47f,
  lawnDry: 0xcbb37c,
  water: 0x6cc3d0,
  waterLow: 0x7fb3b6,
  dryBed: 0xbfae98,
};
const LIVING = /^(tree\.|flowers|roses|grass|bush|lily)/;
const isLeaf = (material) => /lea(f|ves)|flower|petal/i.test(material.name);
const isWater = (material) => /water/i.test(material.name);
/** render_app.py FOLIAGE: how the plants look, from full leaf to bare branches. */
const FOLIAGE = [{}, { wilt: 0.5 }, { wilt: 0.8, leafless: 0.5 }, { wilt: 1.0, leafless: 1.0 }];
/** render_app.py WATER: 0 dry, 1 low, 2 flowing. */
const WATER = [false, 'low', true];
/** Size of the baked textures: enough for a garden on a phone screen, zoomed in. */
const TEXTURE_SIZE = { cutout: 256, plain: 128 };
/**
 * Pieces outside the stages, that the app places itself: the seed mound and its sprout, drawn at
 * the foot of a tree from the first page of its hizb (owner, 25 November 2026: "2 or 3 pages
 * read, he must see a small sprout"). Kenney's nature kit, CC0, like the rest of the garden. Each
 * is baked standing on y = 0, centred, at its own size in metres; the app scales it.
 */
const PROPS = [
  {
    name: 'sprout',
    // Kenney's own colours are a teal green and a pink earth: the garden's soil and a leaf green
    // close to the trees' instead, so that the sprout belongs to the tree it becomes.
    colors: { dirt: COLORS.soil, dirtDark: 0x86653f, grass: 0x74ad3c },
    files: [
      'packs/kenney-shorepine/3d/nature/crops_dirtSingle.glb',
      'packs/kenney-shorepine/3d/nature/crops_leafsStageA.glb',
    ],
  },
];
/** A prop's material that is earth: it does not wilt with the plants. */
const isEarth = (material) => /dirt|soil/i.test(material.name);

// ---------------------------------------------------------------------------------------------
// Loading (lib.js of the picture builder, same matte material for every pack)
// ---------------------------------------------------------------------------------------------

let source = '/gen/';
const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
const modelCache = new Map();
const textureCache = new Map();

function url(path) {
  return source + path.replace(/^\/tool\//, 'tool/');
}

function loadTexture(path) {
  if (!textureCache.has(path)) {
    textureCache.set(
      path,
      textureLoader.loadAsync(url(path)).then((t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        return t;
      }),
    );
  }
  return textureCache.get(path);
}

function matte(src, override) {
  const m = new THREE.MeshLambertMaterial({ name: src.name });
  if (src.color) m.color.copy(src.color);
  if (src.map) m.map = src.map;
  m.vertexColors = !!src.vertexColors;
  m.side = src.side ?? THREE.FrontSide;
  m.transparent = false;
  if (src.alphaTest > 0) m.alphaTest = src.alphaTest;
  if (src.transparent && src.opacity < 0.98) {
    m.transparent = true;
    m.opacity = src.opacity;
    m.depthWrite = false;
  } else if (src.transparent && src.map) {
    m.alphaTest = 0.5;
  }
  if (
    src.emissive &&
    src.emissiveIntensity > 0 &&
    src.emissive.r + src.emissive.g + src.emissive.b > 0
  ) {
    m.emissive.copy(src.emissive);
    m.emissiveIntensity = Math.min(src.emissiveIntensity, 1);
  }
  if (override) {
    if (override.color) m.color.set(override.color);
    // One plain colour instead of a kit's colour map: a lantern of grey stone, a dark hedge.
    if (override.flat) m.map = null;
    if (override.alphaTest !== undefined) m.alphaTest = override.alphaTest;
    if (override.doubleSided) m.side = THREE.DoubleSide;
    if (override.opacity !== undefined) {
      m.transparent = true;
      m.opacity = override.opacity;
      m.depthWrite = false;
    }
    // A light of the night garden (D46): the material glows, in proportion to its own colours
    // when `emissiveMap` (the panes of a lantern glow, its metal stays dark).
    if (override.emissive) {
      m.emissive.set(override.emissive);
      m.emissiveIntensity = override.emissiveIntensity ?? 1;
      if (override.emissiveMap) m.userData.emissiveMap = true;
    }
  }
  return m;
}

function loadModel(path, cfg = {}) {
  const key = path + '|' + (cfg.upAxis || 'y') + '|' + (cfg.key || '');
  if (modelCache.has(key)) return modelCache.get(key);
  const promise = (async () => {
    let root;
    const isFbx = /\.fbx$/i.test(path);
    if (isFbx) {
      const manager = new THREE.LoadingManager();
      manager.setURLModifier((u) =>
        /\.(png|jpe?g|tga|tif|bmp|psd)$/i.test(u)
          ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
          : u,
      );
      root = await new FBXLoader(manager).loadAsync(url(path));
    } else {
      root = (await gltfLoader.loadAsync(url(path))).scene;
    }
    const overrides = cfg.materials || {};
    const jobs = [];
    const seen = new Map();
    root.traverse((o) => {
      if (o.isLight || o.isCamera) o.visible = false;
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      const out = list.map((src) => {
        if (seen.has(src)) return seen.get(src);
        const ov = overrides[src.name];
        const base = isFbx
          ? { name: src.name, color: new THREE.Color(1, 1, 1), side: src.side }
          : src;
        if (isFbx && !ov && src.color) base.color = src.color.clone();
        const m = matte(base, ov);
        if (ov && ov.map)
          jobs.push(
            loadTexture(ov.map).then((t) => {
              m.map = t;
            }),
          );
        seen.set(src, m);
        return m;
      });
      o.material = Array.isArray(o.material) ? out : out[0];
    });
    await Promise.all(jobs);
    if (cfg.upAxis === 'z') {
      const holder = new THREE.Group();
      root.rotation.x = -Math.PI / 2;
      holder.add(root);
      root = holder;
    }
    root.updateMatrixWorld(true);
    return root;
  })();
  modelCache.set(key, promise);
  return promise;
}

// ---------------------------------------------------------------------------------------------
// Templates: a model standing on y = 0, its size, and its meshes (garden.js buildTemplate)
// ---------------------------------------------------------------------------------------------

async function buildTemplate(entry, pack) {
  const cfgOf = (e) => {
    const name = e.cfg ?? entry.cfg ?? '';
    const base = (pack.configs && pack.configs[name]) || {};
    return { ...base, key: name, ...(e.up ? { upAxis: e.up } : {}) };
  };
  const group = new THREE.Group();
  for (const part of entry.parts || [entry]) {
    const obj = (await loadModel(part.file, cfgOf(part))).clone(true);
    const holder = new THREE.Group();
    holder.add(obj);
    if (part.pos) holder.position.fromArray(part.pos);
    if (part.yaw) holder.rotation.y = THREE.MathUtils.degToRad(part.yaw);
    if (part.scale) holder.scale.setScalar(part.scale);
    group.add(holder);
  }
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const inner = new THREE.Group();
  inner.add(group);
  group.position.y -= box.min.y;
  if ((entry.anchor || 'center') === 'center') {
    group.position.x -= center.x;
    group.position.z -= center.z;
  }
  inner.updateMatrixWorld(true);
  // Every drawable mesh of the template, with its place in the template.
  const meshes = [];
  inner.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    let shown = true;
    for (let p = o; p; p = p.parent) if (!p.visible) shown = false;
    if (shown) meshes.push({ mesh: o, matrix: o.matrixWorld.clone() });
  });
  return { size, entry, meshes };
}

const state = { layout: null, templates: new Map() };

async function setup(layout, pack) {
  state.layout = layout;
  state.templates.clear();
  for (const role of new Set(layout.items.map((i) => i.role))) {
    const entries = pack.roles[role];
    if (!entries || entries.length === 0) continue;
    const list = [];
    for (const [index, entry] of entries.entries()) {
      const template = await buildTemplate(
        { anchor: role.startsWith('tree.') ? 'origin' : 'center', ...entry },
        pack,
      );
      list.push({ ...template, id: `${role}#${index}` });
    }
    state.templates.set(role, list);
  }
}

function fitScale(t, size, entry) {
  const W = Math.max(t.size.x, t.size.z);
  const H = t.size.y;
  let s = 1;
  if (size.h !== undefined) {
    s = size.h / H;
    if (size.wmax !== undefined && s * W > size.wmax) s = size.wmax / W;
  } else if (size.w !== undefined) {
    s = size.w / W;
    if (size.hmax !== undefined && s * H > size.hmax) s = size.hmax / H;
  }
  return s * (entry.scale ?? 1);
}

// ---------------------------------------------------------------------------------------------
// One stage: the pieces drawn (garden.js neutral() and build(), recording instead of drawing)
// ---------------------------------------------------------------------------------------------

/** Rounded, so that one piece seen in two stages has the same key in both. */
function matrixKey(matrix) {
  return matrix.elements.map((v) => Math.round(v * 1e5) / 1e5).join(',');
}

/**
 * Records the pieces of one stage. `emit(key, spec)` is called once per drawn mesh part: `key`
 * is the same for the same part in every stage, `spec` describes how to make it (called once).
 */
function collectStage({ count, water: waterLevel, foliage: foliageStage }, emit) {
  const { layout, templates } = state;
  const opts = { hizb: count, ...FOLIAGE[foliageStage], water: WATER[waterLevel] };
  if (count === 0 && foliageStage === 3) opts.earthDry = 1; // the dead earth (render_app.py)
  const water = opts.water !== false;
  const unlocked = new Set(layout.catalogue.filter((e) => e.hizb <= count).map((e) => e.id));
  const has = (id) => unlocked.has(id);
  const P = layout.plot;
  const H = P.half;

  // Neutral ground: plain geometry of the picture builder (garden.js neutral()).
  // The key holds everything that makes the piece what it is (its size and place in `shape`,
  // its colour): a channel's water is another piece, at another height and in another colour,
  // when the water level changes.
  const neutral = (key, make, material, flags, shape = []) =>
    emit(
      `n|${key}|${JSON.stringify(material)}|${shape.map((v) => Math.round(v * 1e4)).join(',')}`,
      () => ({ kind: 'neutral', make, material, ...flags }),
    );
  const box = (key, w, h, d, color, x, y, z) =>
    neutral(
      key,
      () => new THREE.BoxGeometry(w, h, d).translate(x, y, z),
      { color },
      { cast: true, receive: true },
      [w, h, d, x, y, z],
    );
  const flat = (key, w, d, color, x, y, z, textured = false, tint = null) =>
    neutral(
      key,
      () => new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(x, y, z),
      { color, textured, repeat: textured ? Math.max(1, w / 9) : 1, tint },
      { cast: false, receive: true },
      [w, d, x, y, z],
    );
  const disc = (key, r, color, x, y, z) =>
    neutral(
      key,
      () => new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2).translate(x, y, z),
      { color },
      { cast: false, receive: true },
      [r, x, y, z],
    );

  // The plot: its sides, and its top of mottled earth, which turns dry on the dead earth.
  neutral(
    'slab-sides',
    () => {
      const g = new THREE.BoxGeometry(2 * H, P.slab, 2 * H).translate(0, -P.slab / 2, 0);
      return withoutGroup(g, 2);
    },
    { color: COLORS.slabSide },
    { cast: false, receive: true },
  );
  neutral(
    'slab-top',
    () => onlyGroup(new THREE.BoxGeometry(2 * H, P.slab, 2 * H).translate(0, -P.slab / 2, 0), 2),
    { color: COLORS.earth, colorAlt: COLORS.earthDry, textured: true, repeat: 2, tint: 'dead' },
    { cast: false, receive: true },
  );
  const bw = P.border.w,
    bh = P.border.h;
  [
    [2 * H, bw, 0, H - bw / 2],
    [2 * H, bw, 0, -H + bw / 2],
    [bw, 2 * H - 2 * bw, H - bw / 2, 0],
    [bw, 2 * H - 2 * bw, -H + bw / 2, 0],
  ].forEach(([w, d, x, z], k) => box('border' + k, w, bh, d, COLORS.border, x, bh / 2, z));
  for (const [id, [sx, sz]] of Object.entries(P.beds)) {
    if (!has(id)) continue;
    const a = P.bed.from,
      b = P.bed.to,
      len = b - a,
      mid = (a + b) / 2;
    box('soil-' + id, len, 0.06, len, COLORS.soil, sx * mid, 0.03, sz * mid);
    // The lawn colour follows the foliage (lerp to the dry lawn): a colour the app sets.
    flat('lawn-' + id, len - 0.3, len - 0.3, COLORS.lawn, sx * mid, 0.062, sz * mid, true, 'wilt');
  }
  if (has('paving')) {
    const a = P.walk.from,
      b = P.walk.to,
      R = H - bw;
    for (const s of [-1, 1]) {
      box('walk-x' + s, b - a, 0.08, 2 * R, COLORS.paving, (s * (a + b)) / 2, 0.04, 0);
      box('walk-z' + s, 2 * R, 0.08, b - a, COLORS.paving, 0, 0.04, (s * (a + b)) / 2);
    }
    box('plaza', 2 * P.walk.plaza, 0.08, 2 * P.walk.plaza, COLORS.paving, 0, 0.041, 0);
  }
  if (has('channels')) {
    const cw = P.channel.water,
      cc = P.channel.curb,
      reach = P.channel.reach;
    const bwat = P.basin.water,
      bc = P.basin.curb,
      top = 0.17;
    const armFrom = bwat + bc,
      armLen = reach - armFrom,
      armMid = (reach + armFrom) / 2;
    for (const s of [-1, 1]) {
      for (const side of [-1, 1]) {
        box(
          `curb-a${s}${side}`,
          cc,
          top,
          armLen,
          COLORS.curb,
          side * (cw + cc / 2),
          top / 2,
          s * armMid,
        );
        box(
          `curb-b${s}${side}`,
          armLen,
          top,
          cc,
          COLORS.curb,
          s * armMid,
          top / 2,
          side * (cw + cc / 2),
        );
      }
      box(`curb-c${s}`, 2 * (cw + cc), top, cc, COLORS.curb, 0, top / 2, s * (reach + cc / 2));
      box(`curb-d${s}`, cc, top, 2 * (cw + cc), COLORS.curb, s * (reach + cc / 2), top / 2, 0);
      const rim = bwat + bc / 2,
        seg = bwat + bc - cw - cc;
      for (const side of [-1, 1]) {
        box(
          `rim-a${s}${side}`,
          seg,
          top,
          bc,
          COLORS.curb,
          side * (cw + cc + seg / 2),
          top / 2,
          s * rim,
        );
        box(
          `rim-b${s}${side}`,
          bc,
          top,
          seg,
          COLORS.curb,
          s * rim,
          top / 2,
          side * (cw + cc + seg / 2),
        );
      }
    }
    const low = water && opts.water === 'low';
    const color = !water ? COLORS.dryBed : low ? COLORS.waterLow : COLORS.water;
    const y = !water ? 0.085 : low ? 0.092 : 0.125;
    flat('channel-x', 2 * cw, 2 * reach, color, 0, y, 0);
    flat('channel-z', 2 * reach, 2 * cw, color, 0, y, 0);
    flat('basin', 2 * bwat, 2 * bwat, color, 0, y, 0);
  }
  if (has('springs')) {
    for (const [x, z] of P.springs.at) {
      const r = P.springs.water,
        c = P.springs.curb;
      neutral(
        `spring-rim${x},${z}`,
        () => new THREE.CylinderGeometry(r + c, r + c, 0.17, 40).translate(x, 0.085, z),
        { color: COLORS.curb },
        { cast: true, receive: true },
        [r, c, x, z],
      );
      disc(
        `spring${x},${z}`,
        r,
        !water ? COLORS.dryBed : opts.water === 'low' ? COLORS.waterLow : COLORS.water,
        x,
        opts.water === 'low' ? 0.12 : 0.176,
        z,
      );
    }
  }
  const waterLevelY = 0.125;

  // Models (garden.js build()).
  const pick = (role, variant) => {
    const list = templates.get(role);
    return list ? list[variant % list.length] : null;
  };
  const place = (
    key,
    t,
    role,
    x,
    y,
    z,
    yawRad,
    scale,
    { leafless = false, dry = false, living = false } = {},
  ) => {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y + (t.entry.dy ?? 0), z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawRad),
      scale,
    );
    const mk = matrixKey(matrix);
    t.meshes.forEach(({ mesh, matrix: local }, meshIndex) => {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material, slot) => {
        // garden.js place(): bare trees and faded flowers lose their leaf material; a dry garden
        // hides a model's own water (only on meshes with a single material, as there).
        if (leafless && isLeaf(material)) return;
        if (dry && !Array.isArray(mesh.material) && isWater(material)) return;
        emit(`t|${key}|${role}|${mk}|${meshIndex}|${slot}|${living ? 1 : 0}`, () => ({
          kind: 'model',
          // What instances of one model part share: the part, its material, its life.
          part: `${t.id}|${meshIndex}|${slot}|${living ? 1 : 0}`,
          mesh,
          slot,
          material,
          placement: matrix.clone(),
          local: local.clone(),
          matrix: matrix.clone().multiply(local),
          living,
          cast: true,
          receive: true,
        }));
      });
    });
  };

  const wallT = pick('wall', 0);
  const wallItem = layout.items.find((i) => i.role === 'wall');
  const wallScale = wallT ? fitScale(wallT, wallItem.size, wallT.entry) : 1;
  const gateT = pick('gate', 0);
  const gateAxis = gateT
    ? gateT.entry.lengthAxis || (gateT.size.x >= gateT.size.z ? 'x' : 'z')
    : 'x';
  const gateScale = gateT
    ? gateT.entry.fit
      ? fitScale(gateT, gateT.entry.fit, gateT.entry)
      : wallScale * (gateT.entry.scale ?? 1)
    : 1;
  const gateWidth = gateT ? gateT.size[gateAxis] * gateScale : null;

  const groundY = (x, z) => {
    const ax = Math.abs(x),
      az = Math.abs(z);
    if (
      has('paving') &&
      ((ax < P.walk.plaza && az < P.walk.plaza) || ax < P.walk.to || az < P.walk.to)
    )
      return 0.08;
    if (ax >= P.bed.from && ax <= P.bed.to && az >= P.bed.from && az <= P.bed.to) {
      const bed = Object.entries(P.beds).find(
        ([, [sx, sz]]) => sx === Math.sign(x) && sz === Math.sign(z),
      );
      if (bed && has(bed[0])) return 0.062;
    }
    return 0;
  };
  // Pebbles on the bare earth, the same in every picture.
  const pebble = pick('rock', 0);
  if (pebble) {
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const reach = P.half - 1.2;
    for (let k = 0; k < 26; k += 1) {
      const x = (rnd() * 2 - 1) * reach,
        z = (rnd() * 2 - 1) * reach,
        yaw = rnd() * 360,
        s = 0.05 + rnd() * 0.09;
      if (
        groundY(x, z) > 0 ||
        (has('channels') &&
          ((Math.abs(x) < P.channel.reach + 0.6 && Math.abs(z) < 1.2) ||
            (Math.abs(z) < P.channel.reach + 0.6 && Math.abs(x) < 1.2)))
      )
        continue;
      const scale = s * fitScale(pebble, { h: 1 }, pebble.entry);
      const t = pick('rock', k);
      place(
        'pebble' + k,
        t,
        'rock',
        x,
        0,
        z,
        THREE.MathUtils.degToRad(yaw + (t.entry.yaw ?? 0)),
        new THREE.Vector3(scale, scale, scale),
      );
    }
  }
  let carpetTop = 0;
  const trees = layout.items.filter((i) => /^tree\./.test(i.role));
  const bare = new Set(
    trees.filter(
      (_, k) => (k * 7) % trees.length < Math.round((opts.leafless ?? 0) * trees.length),
    ),
  );
  layout.items.forEach((item, itemIndex) => {
    if (!has(item.element)) return;
    const t = pick(item.role, item.variant || 0);
    if (!t) return;
    // The wilt is a value the app sets per foliage stage: a living piece is the same in every stage.
    const living = LIVING.test(item.role);
    const key = 'item' + itemIndex;
    if (item.line) {
      const isWall = item.role === 'wall';
      const lineScale = isWall ? wallScale : fitScale(t, item.size, t.entry);
      const axis = t.entry.lengthAxis || (t.size.x >= t.size.z ? 'x' : 'z');
      const len = t.size[axis] * lineScale;
      const from = new THREE.Vector2(...item.line.from),
        to = new THREE.Vector2(...item.line.to);
      const dir = to.clone().sub(from);
      const total = dir.length();
      dir.normalize();
      let runs = [[0, total]];
      if (item.gap) {
        const gapW = isWall ? (gateWidth ?? item.gap.default) : item.gap.default;
        const gapC = new THREE.Vector2(...item.gap.at).sub(from).dot(dir);
        runs = [
          [0, gapC - gapW / 2],
          [gapC + gapW / 2, total],
        ];
      }
      const lineY = groundY(0, 0);
      const baseYaw = Math.atan2(-dir.y, dir.x) + (axis === 'z' ? Math.PI / 2 : 0);
      runs.forEach(([a, b], run) => {
        const L = b - a;
        const n = Math.max(1, Math.round(L / len));
        const stretch = L / (n * len);
        for (let k = 0; k < n; k += 1) {
          const c = a + (k + 0.5) * (L / n);
          const scale = new THREE.Vector3(lineScale, lineScale, lineScale);
          if (axis === 'x') scale.x *= stretch;
          else scale.z *= stretch;
          place(
            `${key}-${run}-${k}`,
            t,
            item.role,
            from.x + dir.x * c,
            lineY,
            from.y + dir.y * c,
            baseYaw + THREE.MathUtils.degToRad(t.entry.yaw ?? 0),
            scale,
          );
        }
      });
      return;
    }
    let s;
    let yaw = item.yaw || 0;
    if (item.role === 'gate') {
      s = gateScale;
      if (gateAxis === 'z') yaw += 90;
    } else {
      s = fitScale(t, t.entry.fit || item.size, t.entry);
    }
    let y = groundY(item.x, item.z);
    if (item.dy === 'on-carpet') y += carpetTop;
    else if (item.dy === 'on-water') y = opts.water === false ? 0.085 : waterLevelY;
    else if (typeof item.dy === 'number') y += item.dy;
    if (item.role === 'lily' && opts.water === false) return;
    const leafless =
      bare.has(item) || ((opts.leafless ?? 0) >= 1 && /^(flowers|roses)/.test(item.role));
    place(
      key,
      t,
      item.role,
      item.x,
      y,
      item.z,
      THREE.MathUtils.degToRad(yaw + (t.entry.yaw ?? 0)),
      new THREE.Vector3(s, s, s),
      {
        leafless,
        dry: opts.water === false,
        living,
      },
    );
    if (item.role === 'carpet') carpetTop = t.size.y * s;
    if (item.role === 'waterfall') {
      const W = layout.plot.waterfall;
      const h = t.size.y * s,
        w = Math.min(t.size.x * s * 0.42, 0.8);
      const front = item.z + (t.size.z * s) / 2 + 0.02;
      if (opts.water !== false) {
        neutral(
          `${key}-sheet`,
          () => new THREE.PlaneGeometry(w, h * 0.92).translate(item.x, h * 0.46, front),
          { color: COLORS.water },
          { cast: false, receive: false },
          [w, h, item.x, front],
        );
      }
      neutral(
        `${key}-pool-rim`,
        () =>
          new THREE.CylinderGeometry(W.pool + 0.16, W.pool + 0.16, 0.17, 40).translate(
            item.x,
            y + 0.085,
            front + W.pool * 0.75,
          ),
        { color: COLORS.curb },
        { cast: true, receive: true },
        [W.pool, item.x, y, front],
      );
      disc(
        `${key}-pool`,
        W.pool,
        opts.water === false ? COLORS.dryBed : COLORS.water,
        item.x,
        y + 0.176,
        front + W.pool * 0.75,
      );
    }
  });
}

// ---------------------------------------------------------------------------------------------
// The gardens of levels 2 to 7 (D46): the same stages, a ground the layout describes
// ---------------------------------------------------------------------------------------------

/**
 * Roles of living plants in a level garden: their colours fade with the foliage (the picture
 * tool's wilt), and the trees among them (`tree.`) lose their leaves in a drought.
 */
const LIVING_LEVEL = /^(tree\.|flowers|roses|grass|bush|lily|plant|reeds|petals|hedge)/;

const hex = (value) => (typeof value === 'string' ? parseInt(value.replace('#', ''), 16) : value);

/** A flat polygon of the ground, `points` [[x, z], ...], from `y` to `y + h`. */
function polygonGeometry(points, y, h) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(h, 0.002),
    bevelEnabled: false,
    curveSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y, 0);
  return geometry;
}

/** A ring of the ground, between radii `r1` and `r2`, from `y` to `y + h`. */
function ringGeometry(r1, r2, y, h, segments = 72) {
  const shape = new THREE.Shape().absarc(0, 0, r2, 0, Math.PI * 2, false);
  shape.holes.push(new THREE.Path().absarc(0, 0, r1, 0, Math.PI * 2, true));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: h,
    bevelEnabled: false,
    curveSegments: segments,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y, 0);
  return geometry;
}

/** The geometry of one shape of a level's ground (layout `neutral`), lowered by `dy`. */
function shapeGeometry(s, dy) {
  const [x, y, z] = s.at ?? [0, 0, 0];
  switch (s.kind) {
    case 'poly':
      return polygonGeometry(s.points, (s.y ?? 0) + dy, s.h ?? 0.02);
    case 'box':
      return new THREE.BoxGeometry(...s.size)
        .rotateY(THREE.MathUtils.degToRad(s.yaw ?? 0))
        .translate(x, y + s.size[1] / 2 + dy, z);
    case 'cyl':
      return new THREE.CylinderGeometry(s.r, s.r2 ?? s.r, s.h, s.segments ?? 40).translate(
        x,
        y + s.h / 2 + dy,
        z,
      );
    case 'ring':
      return ringGeometry(s.r1, s.r2, y + dy, s.h).translate(x, 0, z);
    case 'disc':
    case 'glow':
      return new THREE.CircleGeometry(s.r, s.segments ?? 40)
        .rotateX(-Math.PI / 2)
        .translate(x, y + dy, z);
    case 'mound':
      return new THREE.SphereGeometry(1, 36, 12, 0, Math.PI * 2, 0, Math.PI / 2)
        .scale(...s.r)
        .rotateY(THREE.MathUtils.degToRad(s.yaw ?? 0))
        .translate(x, y + dy, z);
    case 'sheet':
      return new THREE.PlaneGeometry(s.size[0], s.size[1])
        .rotateY(THREE.MathUtils.degToRad(s.yaw ?? 0))
        .translate(x, y, z);
    default:
      throw new Error(`Unknown ground shape "${s.kind}"`);
  }
}

/**
 * Records the pieces of one stage of a level garden (layout version 2): the plot, the shapes of
 * its ground and water (`neutral`), then the models (`items`), each with its element. Water
 * shapes change with the water level (flowing, low and paler, dry bed); lawns dry with the
 * foliage; the earth dies with the garden; trees lose their leaves, flowers fade.
 */
function collectLevelStage({ count, water: waterLevel, foliage: foliageStage }, emit) {
  const { layout, templates } = state;
  const C = Object.fromEntries(
    Object.entries({ ...COLORS, ...(layout.colors ?? {}) }).map(([k, v]) => [k, hex(v)]),
  );
  const opts = { ...FOLIAGE[foliageStage], water: WATER[waterLevel] };
  const wet = opts.water !== false;
  const low = opts.water === 'low';
  const unlocked = new Set(layout.catalogue.filter((e) => e.hizb <= count).map((e) => e.id));
  const has = (id) => id === null || id === undefined || unlocked.has(id);
  const P = layout.plot;

  const neutral = (key, make, material, flags, shape = []) =>
    emit(
      `n|${key}|${JSON.stringify(material)}|${shape.map((v) => Math.round(v * 1e4)).join(',')}`,
      () => ({ kind: 'neutral', make, material, ...flags }),
    );

  // The plot: its sides, its top of mottled earth (dead once the garden has died), its border.
  const sides = { color: hex(P.side) };
  const top = {
    color: hex(P.top),
    colorAlt: hex(P.topDry ?? C.earthDry),
    textured: true,
    repeat: P.shape === 'round' ? 2 : 2,
    tint: 'dead',
  };
  if (P.shape === 'round') {
    const make = () =>
      new THREE.CylinderGeometry(P.half, P.half, P.slab, 96).translate(0, -P.slab / 2, 0);
    neutral('slab-sides', () => onlyGroup(make(), 0), sides, {
      cast: false,
      receive: true,
    });
    neutral('slab-top', () => onlyGroup(make(), 1), top, { cast: false, receive: true });
    if (P.border) {
      neutral(
        'border',
        () => ringGeometry(P.half - P.border.w, P.half, 0, P.border.h, 96),
        { color: hex(P.border.color) },
        { cast: true, receive: true },
      );
    }
  } else {
    const H = P.half;
    const make = () => new THREE.BoxGeometry(2 * H, P.slab, 2 * H).translate(0, -P.slab / 2, 0);
    neutral('slab-sides', () => withoutGroup(make(), 2), sides, { cast: false, receive: true });
    neutral('slab-top', () => onlyGroup(make(), 2), top, { cast: false, receive: true });
    if (P.border) {
      const bw = P.border.w,
        bh = P.border.h;
      [
        [2 * H, bw, 0, H - bw / 2],
        [2 * H, bw, 0, -H + bw / 2],
        [bw, 2 * H - 2 * bw, H - bw / 2, 0],
        [bw, 2 * H - 2 * bw, -H + bw / 2, 0],
      ].forEach(([w, d, x, z], k) =>
        neutral(
          'border' + k,
          () => new THREE.BoxGeometry(w, bh, d).translate(x, bh / 2, z),
          { color: hex(P.border.color) },
          { cast: true, receive: true },
          [w, bh, d, x, z],
        ),
      );
    }
  }

  // The ground and the water.
  (layout.neutral ?? []).forEach((s, index) => {
    if (!has(s.element)) return;
    let color = hex(s.color);
    let dy = 0;
    if (s.water) {
      const drop = s.drop ?? 0.03;
      if (s.kind === 'sheet' && !wet) return; // a waterfall without water is only its rocks
      if (!wet) {
        color = hex(s.dryColor ?? C.dryBed);
        dy = -drop;
      } else if (low) {
        color = hex(s.lowColor ?? C.waterLow);
        dy = s.kind === 'sheet' ? 0 : -drop / 2;
      }
    }
    if (s.onlyWet && !wet) return;
    const isFlat = ['poly', 'disc', 'glow', 'sheet'].includes(s.kind);
    const material = {
      color,
      ...(s.lawn
        ? { textured: true, repeat: 1 / 9, tint: 'wilt', colorAlt: hex(s.dryColor ?? C.lawnDry) }
        : s.textured
          ? { textured: true, repeat: 1 / 9 }
          : {}),
      ...(s.opacity !== undefined ? { opacity: s.opacity } : {}),
      ...(s.emissive
        ? { emissive: hex(s.emissive), emissiveIntensity: s.emissiveIntensity ?? 1 }
        : {}),
      ...(s.kind === 'sheet' ? { doubleSided: true } : {}),
    };
    neutral(
      `s${index}`,
      () => shapeGeometry(s, dy),
      material,
      {
        cast: s.cast ?? (!isFlat && !s.water),
        receive: s.receive ?? s.kind !== 'glow',
      },
      [dy],
    );
  });

  // Models.
  const pick = (role, variant) => {
    const list = templates.get(role);
    return list ? list[variant % list.length] : null;
  };
  const place = (key, t, role, x, y, z, yawRad, scale, { leafless, dry, living }) => {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y + (t.entry.dy ?? 0), z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawRad),
      scale,
    );
    const mk = matrixKey(matrix);
    t.meshes.forEach(({ mesh, matrix: local }, meshIndex) => {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material, slot) => {
        if (leafless && isLeaf(material)) return;
        if (dry && !Array.isArray(mesh.material) && isWater(material)) return;
        emit(`t|${key}|${role}|${mk}|${meshIndex}|${slot}|${living ? 1 : 0}`, () => ({
          kind: 'model',
          part: `${t.id}|${meshIndex}|${slot}|${living ? 1 : 0}`,
          mesh,
          slot,
          material,
          placement: matrix.clone(),
          local: local.clone(),
          matrix: matrix.clone().multiply(local),
          living,
          cast: true,
          receive: true,
        }));
      });
    });
  };
  const trees = layout.items.filter((i) => /^tree\./.test(i.role));
  const bare = new Set(
    trees.filter(
      (_, k) => (k * 7) % trees.length < Math.round((opts.leafless ?? 0) * trees.length),
    ),
  );
  const waterDy = !wet ? -0.03 : low ? -0.015 : 0;
  layout.items.forEach((item, itemIndex) => {
    if (!has(item.element)) return;
    const t = pick(item.role, item.variant || 0);
    if (!t) return;
    if (item.role.startsWith('lily') && !wet) return;
    if (item.onlyWet && !wet) return;
    const living = LIVING_LEVEL.test(item.role);
    const key = 'item' + itemIndex;
    const stretch = item.stretch ?? [1, 1, 1];
    if (item.line) {
      const lineScale = fitScale(t, item.size, t.entry);
      const axis = t.entry.lengthAxis || (t.size.x >= t.size.z ? 'x' : 'z');
      const len = t.size[axis] * lineScale;
      const from = new THREE.Vector2(...item.line.from),
        to = new THREE.Vector2(...item.line.to);
      const dir = to.clone().sub(from);
      const total = dir.length();
      dir.normalize();
      let runs = [[0, total]];
      if (item.gap) {
        const gapC = new THREE.Vector2(...item.gap.at).sub(from).dot(dir);
        runs = [
          [0, gapC - item.gap.width / 2],
          [gapC + item.gap.width / 2, total],
        ];
      }
      const baseYaw = Math.atan2(-dir.y, dir.x) + (axis === 'z' ? Math.PI / 2 : 0);
      runs.forEach(([a, b], run) => {
        const L = b - a;
        if (L < len * 0.4) return;
        const n = Math.max(1, Math.round(L / len));
        const along = L / (n * len);
        for (let k = 0; k < n; k += 1) {
          const c = a + (k + 0.5) * (L / n);
          const scale = new THREE.Vector3(lineScale, lineScale * stretch[1], lineScale);
          if (axis === 'x') scale.x *= along;
          else scale.z *= along;
          place(
            `${key}-${run}-${k}`,
            t,
            item.role,
            from.x + dir.x * c,
            item.y ?? 0,
            from.y + dir.y * c,
            baseYaw + THREE.MathUtils.degToRad(t.entry.yaw ?? 0),
            scale,
            { leafless: false, dry: !wet, living },
          );
        }
      });
      return;
    }
    const s = fitScale(t, t.entry.fit || item.size, t.entry);
    const y = (item.y ?? 0) + (item.onWater ? waterDy : 0);
    const leafless =
      bare.has(item) || ((opts.leafless ?? 0) >= 1 && /^(flowers|roses)/.test(item.role));
    place(
      key,
      t,
      item.role,
      item.x,
      y,
      item.z,
      THREE.MathUtils.degToRad((item.yaw ?? 0) + (t.entry.yaw ?? 0)),
      new THREE.Vector3(s * stretch[0], s * stretch[1], s * stretch[2]),
      { leafless, dry: !wet, living },
    );
  });
}

/** A box geometry without the faces of one group (the top of the plot, which has its own colour). */
function withoutGroup(geometry, groupIndex) {
  const keep = geometry.groups.filter((_, i) => i !== groupIndex);
  return subsetOfGroups(geometry, keep);
}
function onlyGroup(geometry, groupIndex) {
  return subsetOfGroups(geometry, [geometry.groups[groupIndex]]);
}
function subsetOfGroups(geometry, groups) {
  const index = [];
  for (const g of groups)
    for (let i = g.start; i < g.start + g.count; i += 1) index.push(geometry.index.getX(i));
  const out = geometry.clone();
  out.setIndex(index);
  out.clearGroups();
  return out;
}

// ---------------------------------------------------------------------------------------------
// Every stage, then the pieces with their stages
// ---------------------------------------------------------------------------------------------

function collectAllStages() {
  const pieces = new Map();
  const stride = WATER_LEVELS * FOLIAGE_STAGES;
  // Level 1 keeps the picture builder's own ground; the gardens of levels 2 to 7 describe theirs.
  const collect = state.layout.version === 2 ? collectLevelStage : collectStage;
  for (let count = 0; count <= MAX_COUNT; count += 1) {
    for (let water = 0; water < WATER_LEVELS; water += 1) {
      for (let foliage = 0; foliage < FOLIAGE_STAGES; foliage += 1) {
        const combo = comboOf(water, foliage);
        collect({ count, water, foliage }, (key, spec) => {
          let piece = pieces.get(key);
          if (!piece) {
            piece = { key, spec: spec(), stages: new Uint8Array((MAX_COUNT + 1) * stride) };
            pieces.set(key, piece);
          }
          piece.stages[count * stride + combo] = 1;
        });
      }
    }
  }
  return [...pieces.values()].map((piece) => ({
    ...piece,
    items: encodeVisibility((count, combo) => piece.stages[count * stride + combo] === 1),
  }));
}

// ---------------------------------------------------------------------------------------------
// Materials and geometry
// ---------------------------------------------------------------------------------------------

/** An id for a texture: what it shows, so that two files with the same image share it. */
function textureId(texture) {
  if (texture === 'mottled') return 'mottled';
  const image = texture.image;
  return image.currentSrc || image.src || pixelHash(pixelsOf(image, 32, false));
}

function pixelHash(bytes) {
  let h = 2166136261;
  for (let i = 0; i < bytes.length; i += 1) h = Math.imul(h ^ bytes[i], 16777619) >>> 0;
  return 'pixels:' + h.toString(16);
}

/** One material of the app. Pieces whose materials have the same properties share it. */
function materialOf(spec) {
  if (spec.kind === 'neutral') {
    const m = spec.material;
    const material = {
      name:
        m.tint === 'wilt'
          ? 'lawn'
          : m.tint === 'dead'
            ? 'earth'
            : 'ground-' + m.color.toString(16).padStart(6, '0'),
      color: m.color,
      colorAlt: m.tint === 'wilt' ? (m.colorAlt ?? COLORS.lawnDry) : (m.colorAlt ?? null),
      tint: m.tint ?? null,
      texture: m.textured ? 'mottled' : null,
      uvScale: m.repeat ?? 1,
      alphaTest: 0,
      doubleSided: !!m.doubleSided,
      transparent: m.opacity !== undefined && m.opacity < 1,
      opacity: m.opacity ?? 1,
      emissive: m.emissive ?? 0,
      emissiveIntensity: m.emissiveIntensity ?? 0,
      vertexColors: false,
      wilts: false,
      cast: spec.cast,
      receive: spec.receive,
    };
    return { ...material, key: materialKey(material) };
  }
  const m = spec.material;
  const material = {
    name: m.name || 'material',
    color: m.color.getHex(),
    colorAlt: null,
    tint: null,
    texture: m.map ? m.map : null,
    uvScale: 1,
    alphaTest: m.alphaTest || 0,
    doubleSided: m.side === THREE.DoubleSide,
    transparent: !!m.transparent,
    opacity: m.opacity ?? 1,
    emissive: m.emissive ? m.emissive.getHex() : 0,
    emissiveIntensity: m.emissiveIntensity ?? 0,
    vertexColors: !!m.vertexColors,
    wilts: spec.living,
    cast: spec.cast,
    receive: spec.receive,
    ...(m.userData?.emissiveMap ? { emissiveMap: true } : {}),
  };
  return { ...material, key: materialKey(material) };
}

function materialKey(m) {
  return JSON.stringify([
    m.name,
    m.color,
    m.colorAlt,
    m.tint,
    m.texture ? textureId(m.texture) : null,
    m.alphaTest,
    m.doubleSided,
    m.transparent,
    m.opacity,
    m.emissive,
    m.vertexColors,
    m.wilts,
    m.cast,
    m.receive,
    ...(m.emissiveMap ? ['emissiveMap'] : []),
  ]);
}

/**
 * The triangles of one piece in the space `matrix` takes them to, with shared vertices welded
 * (the FBX loader gives three vertices per triangle). Positions, normals, uvs, colours, indices.
 */
function geometryOf(spec, material, matrix) {
  let geometry, start, count;
  if (spec.kind === 'neutral') {
    geometry = spec.make();
    if (!geometry.index) geometry = indexed(geometry);
    start = 0;
    count = geometry.index.count;
  } else {
    geometry = spec.mesh.geometry;
    if (!geometry.index) geometry = indexed(geometry);
    start = 0;
    count = geometry.index.count;
    if (Array.isArray(spec.mesh.material)) {
      const groups = geometry.groups.filter((g) => (g.materialIndex ?? 0) === spec.slot);
      const index = [];
      for (const g of groups)
        for (let i = g.start; i < g.start + g.count; i += 1) index.push(geometry.index.getX(i));
      geometry = geometry.clone();
      geometry.setIndex(index);
      count = index.length;
    }
  }
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
  const flip = matrix.determinant() < 0;
  const pos = geometry.attributes.position,
    nor = geometry.attributes.normal;
  const uv = geometry.attributes.uv,
    col = geometry.attributes.color;
  const texture = material.texture && material.texture !== 'mottled' ? material.texture : null;
  if (texture) texture.updateMatrix();
  const welded = new Map();
  const remap = new Map();
  const out = { positions: [], normals: [], uvs: [], colors: [], indices: [] };
  const v = new THREE.Vector3(),
    n = new THREE.Vector3(),
    t = new THREE.Vector2();
  const vertex = (i) => {
    if (remap.has(i)) return remap.get(i);
    v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
    if (nor) n.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
    else n.set(0, 1, 0);
    const attrs = [v.x, v.y, v.z, n.x, n.y, n.z];
    if (material.texture) {
      if (uv) t.fromBufferAttribute(uv, i);
      else t.set(0, 0);
      if (texture) t.applyMatrix3(texture.matrix);
      attrs.push(t.x * material.uvScale, t.y * material.uvScale);
    }
    if (material.vertexColors) {
      if (col)
        attrs.push(col.getX(i), col.getY(i), col.getZ(i), col.itemSize > 3 ? col.getW(i) : 1);
      else attrs.push(1, 1, 1, 1);
    }
    // Two vertices the same once quantised are one: positions to 1/10 mm, normals to 1/100.
    const key = attrs.map((a, k) => Math.round(a * (k < 3 ? 1e4 : k < 6 ? 100 : 1e4))).join(',');
    let index = welded.get(key);
    if (index === undefined) {
      index = out.positions.length / 3;
      welded.set(key, index);
      out.positions.push(attrs[0], attrs[1], attrs[2]);
      out.normals.push(attrs[3], attrs[4], attrs[5]);
      let k = 6;
      if (material.texture) {
        out.uvs.push(attrs[k], attrs[k + 1]);
        k += 2;
      }
      if (material.vertexColors)
        out.colors.push(attrs[k], attrs[k + 1], attrs[k + 2], attrs[k + 3]);
    }
    remap.set(i, index);
    return index;
  };
  for (let i = start; i < start + count; i += 3) {
    const a = vertex(geometry.index.getX(i)),
      b = vertex(geometry.index.getX(i + 1)),
      c = vertex(geometry.index.getX(i + 2));
    if (a === b || b === c || a === c) continue; // degenerate after welding
    if (flip) out.indices.push(a, c, b);
    else out.indices.push(a, b, c);
  }
  return out;
}

function indexed(geometry) {
  const g = geometry.clone();
  g.setIndex([...Array(g.attributes.position.count).keys()]);
  return g;
}

// ---------------------------------------------------------------------------------------------
// Textures: raw pixels, so that the phone never decodes an image
// ---------------------------------------------------------------------------------------------

/** The mottled texture of the earth and the lawn (garden.js mottled()), drawn the same way. */
function mottledCanvas() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(0, 0, size, size);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 900; i += 1) {
    const x = rnd() * size,
      y = rnd() * size,
      r = 5 + rnd() * 26;
    const light = rnd() > 0.5;
    for (const dx of [-size, 0, size])
      for (const dy of [-size, 0, size]) {
        const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        g.addColorStop(0, light ? 'rgba(255,255,255,0.16)' : 'rgba(110,110,110,0.13)');
        g.addColorStop(1, 'rgba(128,128,128,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
  }
  return canvas;
}

/**
 * The pixels of a texture, `size` x `size`, RGBA, first row at v = 0 (a data texture of three.js
 * with flipY false reads them so). An image loaded with flipY true has its top row at v = 1.
 */
function pixelsOf(image, size, flipY) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  if (flipY) {
    ctx.translate(0, size);
    ctx.scale(1, -1);
  }
  ctx.drawImage(image, 0, 0, size, size);
  return new Uint8Array(ctx.getImageData(0, 0, size, size).data.buffer);
}

// ---------------------------------------------------------------------------------------------
// The GLB
// ---------------------------------------------------------------------------------------------

const GL = {
  BYTE: 5120,
  UNSIGNED_BYTE: 5121,
  SHORT: 5122,
  UNSIGNED_SHORT: 5123,
  UNSIGNED_INT: 5125,
  FLOAT: 5126,
  ARRAY_BUFFER: 34962,
  ELEMENT_ARRAY_BUFFER: 34963,
};
/** A model part placed at least this many times is drawn by instancing; others are merged. */
const INSTANCING_MIN = 2;

function linear(hex) {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

const popcount = (m) => m.toString(2).replace(/0/g, '').length;
/** Pieces shown in the most water and foliage states first, then by the count they appear at. */
const byStages = (a, b) => {
  const ia = a.items[0],
    ib = b.items[0];
  return (
    popcount(ib.comboMask) - popcount(ia.comboMask) ||
    ib.comboMask - ia.comboMask ||
    ia.from - ib.from ||
    ib.until - ia.until
  );
};

async function bake(layout, pack, sourcePrefix) {
  source = sourcePrefix;
  const started = performance.now();
  await setup(layout, pack);
  const pieces = collectAllStages().filter((p) => p.items.length > 0);

  // Model parts placed several times are instanced; everything else is merged by material.
  const byPart = new Map();
  for (const piece of pieces) {
    if (piece.spec.kind !== 'model') continue;
    if (!byPart.has(piece.spec.part)) byPart.set(piece.spec.part, []);
    byPart.get(piece.spec.part).push(piece);
  }
  const instanced = [...byPart.values()].filter((list) => list.length >= INSTANCING_MIN);
  const instancedPieces = new Set(instanced.flat());
  const merged = new Map();
  for (const piece of pieces) {
    if (instancedPieces.has(piece)) continue;
    const material = materialOf(piece.spec);
    if (!merged.has(material.key)) merged.set(material.key, { material, pieces: [] });
    merged.get(material.key).pieces.push(piece);
  }

  // The meshes: geometry once, then instances (or one identity instance for a merged mesh).
  const meshes = [];
  for (const group of merged.values()) {
    group.pieces.sort(byStages);
    // A model placed once is merged where it stands (its world matrix); the plain shapes are made
    // in place already.
    const parts = group.pieces.map((piece) => ({
      piece,
      geometry: geometryOf(
        piece.spec,
        group.material,
        piece.spec.kind === 'model' ? piece.spec.matrix : new THREE.Matrix4(),
      ),
    }));
    meshes.push({ kind: 'merged', material: group.material, parts });
  }
  // The props: merged per material, each with its name, outside the stages.
  for (const prop of PROPS) {
    const template = await buildTemplate(
      { anchor: 'center', parts: prop.files.map((file) => ({ file })) },
      pack,
    );
    const byMaterial = new Map();
    template.meshes.forEach(({ mesh, matrix }) => {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material, slot) => {
        const spec = {
          kind: 'model',
          mesh,
          slot,
          material,
          local: matrix,
          living: !isEarth(material),
          cast: true,
          receive: true,
        };
        let m = materialOf(spec);
        const color = prop.colors?.[m.name];
        if (color !== undefined) m = { ...m, color, key: materialKey({ ...m, color }) };
        if (!byMaterial.has(m.key)) byMaterial.set(m.key, { material: m, parts: [] });
        byMaterial.get(m.key).parts.push({ piece: null, geometry: geometryOf(spec, m, matrix) });
      });
    });
    for (const group of byMaterial.values())
      meshes.push({ kind: 'prop', prop: prop.name, material: group.material, parts: group.parts });
  }
  for (const list of instanced) {
    list.sort(byStages);
    const first = list[0].spec;
    const material = materialOf(first);
    meshes.push({
      kind: 'instanced',
      material,
      parts: [{ piece: null, geometry: geometryOf(first, material, first.local) }],
      instances: list.map((piece) => ({ placement: piece.spec.placement, items: piece.items })),
    });
  }

  // Textures used by the meshes, each once.
  const textures = [];
  const textureIndex = new Map();
  const textureFor = (texture) => {
    const id = textureId(texture);
    if (!textureIndex.has(id)) {
      let image, flipY, name, size;
      if (texture === 'mottled') {
        image = mottledCanvas();
        flipY = false;
        name = 'mottled';
        size = TEXTURE_SIZE.plain;
      } else {
        image = texture.image;
        flipY = texture.flipY;
        const src = image.currentSrc || image.src || '';
        name = src
          ? decodeURIComponent(src.split('/').pop())
          : (meshes.find((m) => m.material.texture === texture)?.material.name ?? 'texture');
        const cutout = meshes.some(
          (m) =>
            m.material.texture && textureId(m.material.texture) === id && m.material.alphaTest > 0,
        );
        // A palette texture (Kenney's colormap) is small already: kept at its size.
        size = Math.min(image.width, cutout ? TEXTURE_SIZE.cutout : TEXTURE_SIZE.plain);
      }
      textures.push({ name, size, pixels: pixelsOf(image, size, flipY) });
      textureIndex.set(id, textures.length - 1);
    }
    return textureIndex.get(id);
  };

  const builder = new BinaryBuilder();
  const json = {
    asset: { version: '2.0', generator: 'Jannatuk tools/garden-3d/bake-scene.js' },
    extensionsUsed: ['KHR_mesh_quantization', 'EXT_mesh_gpu_instancing'],
    extensionsRequired: ['KHR_mesh_quantization'],
    scene: 0,
    scenes: [{ name: `garden-level-${layout.level ?? 1}`, nodes: [] }],
    nodes: [],
    meshes: [],
    materials: [],
    accessors: [],
    bufferViews: null,
    buffers: null,
    extras: {
      garden: {
        version: 2,
        textures: [],
        stages: { counts: MAX_COUNT + 1, water: WATER_LEVELS, foliage: FOLIAGE_STAGES },
        // A garden with a light of its own (the night garden): the app uses it instead of the day's.
        ...(layout.light ? { light: layout.light } : {}),
      },
    },
  };
  const accessor = (bufferView, componentType, count, type, extra = {}) => {
    json.accessors.push({ bufferView, componentType, count, type, ...extra });
    return json.accessors.length - 1;
  };

  const report = { triangles: { stored: 0, fullGarden: 0 }, instanced: 0, merged: 0, props: 0 };
  for (const mesh of meshes) {
    const m = mesh.material;
    const parts = mesh.parts;
    let extent = 0;
    for (const { geometry } of parts)
      for (const value of geometry.positions) extent = Math.max(extent, Math.abs(value));
    const scale = extent > 0 ? extent : 1;
    const vertexCount = parts.reduce((n, p) => n + p.geometry.positions.length / 3, 0);
    const indexCount = parts.reduce((n, p) => n + p.geometry.indices.length, 0);
    if (indexCount === 0) continue;
    report.triangles.stored += indexCount / 3;
    const big = vertexCount > 65535;
    const positions = new Int16Array(vertexCount * 4);
    const normals = new Int8Array(vertexCount * 4);
    const uvs = m.texture ? new Float32Array(vertexCount * 2) : null;
    const colors = m.vertexColors ? new Uint8Array(vertexCount * 4) : null;
    const indices = big ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
    const min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity];
    const items = [];
    let vBase = 0,
      iBase = 0;
    for (const { piece, geometry } of parts) {
      const n = geometry.positions.length / 3;
      for (let k = 0; k < n; k += 1) {
        for (let a = 0; a < 3; a += 1) {
          const q = Math.round((geometry.positions[k * 3 + a] / scale) * 32767);
          positions[(vBase + k) * 4 + a] = q;
          min[a] = Math.min(min[a], q);
          max[a] = Math.max(max[a], q);
          normals[(vBase + k) * 4 + a] = Math.round(geometry.normals[k * 3 + a] * 127);
        }
        if (uvs) {
          uvs[(vBase + k) * 2] = geometry.uvs[k * 2];
          uvs[(vBase + k) * 2 + 1] = geometry.uvs[k * 2 + 1];
        }
        if (colors)
          for (let a = 0; a < 4; a += 1)
            colors[(vBase + k) * 4 + a] = Math.round(geometry.colors[k * 4 + a] * 255);
      }
      for (let k = 0; k < geometry.indices.length; k += 1)
        indices[iBase + k] = geometry.indices[k] + vBase;
      // A merged mesh: [first index, index count, from, until, combos] per piece.
      if (piece)
        for (const item of piece.items)
          items.push(iBase, geometry.indices.length, item.from, item.until, item.comboMask);
      vBase += n;
      iBase += geometry.indices.length;
    }
    const attributes = {
      POSITION: accessor(
        builder.add(positions, { byteStride: 8, target: GL.ARRAY_BUFFER }),
        GL.SHORT,
        vertexCount,
        'VEC3',
        {
          normalized: true,
          min: min.map((q) => q / 32767),
          max: max.map((q) => q / 32767),
        },
      ),
      NORMAL: accessor(
        builder.add(normals, { byteStride: 4, target: GL.ARRAY_BUFFER }),
        GL.BYTE,
        vertexCount,
        'VEC3',
        { normalized: true },
      ),
    };
    if (uvs)
      attributes.TEXCOORD_0 = accessor(
        builder.add(uvs, { target: GL.ARRAY_BUFFER }),
        GL.FLOAT,
        vertexCount,
        'VEC2',
      );
    if (colors)
      attributes.COLOR_0 = accessor(
        builder.add(colors, { target: GL.ARRAY_BUFFER }),
        GL.UNSIGNED_BYTE,
        vertexCount,
        'VEC4',
        { normalized: true },
      );
    const indexAccessor = accessor(
      builder.add(indices, { target: GL.ELEMENT_ARRAY_BUFFER }),
      big ? GL.UNSIGNED_INT : GL.UNSIGNED_SHORT,
      indexCount,
      'SCALAR',
    );

    json.materials.push({
      name: m.name,
      pbrMetallicRoughness: {
        baseColorFactor: [...linear(m.color), m.opacity],
        metallicFactor: 0,
        roughnessFactor: 1,
      },
      doubleSided: m.doubleSided,
      ...(m.alphaTest > 0
        ? { alphaMode: 'MASK', alphaCutoff: m.alphaTest }
        : m.transparent
          ? { alphaMode: 'BLEND' }
          : {}),
      extras: {
        color: m.color,
        colorAlt: m.colorAlt,
        tint: m.tint,
        texture: m.texture ? textureFor(m.texture) : null,
        alphaTest: m.alphaTest,
        doubleSided: m.doubleSided,
        transparent: m.transparent,
        opacity: m.opacity,
        emissive: m.emissive,
        emissiveIntensity: m.emissiveIntensity,
        vertexColors: m.vertexColors,
        wilts: m.wilts,
        ...(m.emissiveMap ? { emissiveMap: true } : {}),
      },
    });
    json.meshes.push({
      name: m.name,
      primitives: [
        { attributes, indices: indexAccessor, material: json.materials.length - 1, mode: 4 },
      ],
    });
    const node = {
      name: m.name,
      mesh: json.meshes.length - 1,
      extras: {
        kind: mesh.kind,
        positionScale: scale,
        castShadow: m.cast,
        receiveShadow: m.receive,
      },
    };
    if (mesh.kind === 'prop') {
      // Placed by the app (the sprout): no stage, its name instead.
      report.props += 1;
      node.name = `${mesh.prop}-${m.name}`;
      node.scale = [scale, scale, scale];
      node.extras.prop = mesh.prop;
      node.extras.items = [];
    } else if (mesh.kind === 'merged') {
      report.merged += 1;
      report.triangles.fullGarden += fullGardenTriangles(items);
      node.scale = [scale, scale, scale];
      node.extras.items = items;
    } else {
      report.instanced += 1;
      // EXT_mesh_gpu_instancing: one translation, rotation and scale per instance. The scale of
      // the quantised positions is in each instance's scale.
      const n = mesh.instances.length;
      const tr = new Float32Array(n * 3),
        ro = new Float32Array(n * 4),
        sc = new Float32Array(n * 3);
      const p = new THREE.Vector3(),
        q = new THREE.Quaternion(),
        s = new THREE.Vector3();
      const instanceItems = [];
      mesh.instances.forEach((instance, k) => {
        instance.placement.decompose(p, q, s);
        tr.set([p.x, p.y, p.z], k * 3);
        ro.set([q.x, q.y, q.z, q.w], k * 4);
        sc.set([s.x * scale, s.y * scale, s.z * scale], k * 3);
        for (const item of instance.items)
          instanceItems.push(k, item.from, item.until, item.comboMask);
      });
      // The geometry was baked with the part's place in its model: the instance only places it.
      report.triangles.fullGarden +=
        (indexCount / 3) *
        mesh.instances.filter((i) =>
          i.items.some((it) => it.until > MAX_COUNT && it.comboMask & (1 << comboOf(2, 0))),
        ).length;
      node.extensions = {
        EXT_mesh_gpu_instancing: {
          attributes: {
            TRANSLATION: accessor(builder.add(tr), GL.FLOAT, n, 'VEC3'),
            ROTATION: accessor(builder.add(ro), GL.FLOAT, n, 'VEC4'),
            SCALE: accessor(builder.add(sc), GL.FLOAT, n, 'VEC3'),
          },
        },
      };
      node.extras.instanceItems = instanceItems;
    }
    json.nodes.push(node);
    json.scenes[0].nodes.push(json.nodes.length - 1);
  }
  for (const t of textures) {
    const bufferView = builder.add(t.pixels);
    json.extras.garden.textures.push({
      name: t.name,
      width: t.size,
      height: t.size,
      format: 'rgba8',
      bufferView,
    });
  }
  json.bufferViews = builder.bufferViews;
  const bin = builder.bytes();
  json.buffers = [{ byteLength: bin.length }];
  const glb = writeGlb(json, bin);

  let binary = '';
  for (let i = 0; i < glb.length; i += 0x8000)
    binary += String.fromCharCode(...glb.subarray(i, i + 0x8000));
  return {
    glb: btoa(binary),
    report: {
      bytes: glb.length,
      textureBytes: textures.reduce((n, t) => n + t.pixels.length, 0),
      nodes: json.nodes.length,
      ...report,
      pieces: pieces.length,
      textures: textures.map((t) => `${t.name} ${t.size}`),
      seconds: Math.round((performance.now() - started) / 100) / 10,
    },
  };
}

/** Triangles a merged mesh draws for the full garden with flowing water and full leaf. */
function fullGardenTriangles(items) {
  let n = 0;
  const combo = comboOf(2, 0);
  for (let i = 0; i < items.length; i += 5) {
    if (items[i + 2] <= MAX_COUNT && items[i + 3] > MAX_COUNT && (items[i + 4] >> combo) & 1)
      n += items[i + 1] / 3;
  }
  return n;
}

window.bake = bake;
window.ready = true;
