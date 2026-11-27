/**
 * The lights of the sky, drawn in the garden's own render loop behind the garden (maquette-wow,
 * `js/sky.js` and `.sky-*`, validated on 27 November 2026): the sun and its halo, the moon's
 * crescent, the stars that twinkle, now and then a shooting star, three slow clouds and the soft
 * glow of the low sun. The sky's gradient itself is a view under the transparent GL view: it
 * changes once a minute, these move every frame.
 *
 * Everything is placed in points on the screen (the mockup's 393 × 852 phone), as shares of the
 * view, by the vertex shaders: nothing depends on the garden's camera.
 */

import * as THREE from 'three';

import { skyLights } from '@/ui/sky-tokens';

import type { SkyState } from '../sky/sky-state';

/** Places a quad of `uSize` points with its centre at `uCenter` (shares of the view, y down). */
const QUAD_VERTEX = `uniform vec2 uView; uniform vec2 uCenter; uniform vec2 uSize; varying vec2 vPoint;
void main() { vPoint = position.xy * uSize * 0.5;
  vec2 ndc = vec2(uCenter.x * 2.0 - 1.0, 1.0 - uCenter.y * 2.0) + position.xy * uSize / uView;
  gl_Position = vec4(ndc, 0.0, 1.0); }`;

const STAR_COUNT = 190;
/** Stars occupy the top 78 % of the screen (the mockup's `seed`). */
const STAR_FIELD = 0.78;
/** A shooting star now and then: chance per second while the stars are bright, and its life. */
const SHOOTING = {
  perSecond: 0.08,
  fromStars: 0.6,
  seconds: 0.9,
  travel: [140, 60],
  tail: [70, 30],
};
/** The mockup's clouds (`.c1` to `.c3`): top, left, scale, seconds per crossing, head start, opacity. */
const CLOUDS = [
  { top: 120, left: -60, scale: 1, seconds: 90, delay: 0, opacity: 1 },
  { top: 60, left: 160, scale: 0.7, seconds: 120, delay: 40, opacity: 1 },
  { top: 560, left: 40, scale: 1.3, seconds: 150, delay: 90, opacity: 0.6 },
] as const;
const CLOUD_SIZE = { width: 260, height: 70, from: -40, to: 420 } as const;
/** The quad of a cloud is this much taller than the cloud: room for its rounder top. */
const CLOUD_ROOM = 1.9;

export interface SkyView {
  readonly scene: THREE.Scene;
  readonly camera: THREE.Camera;
  setSky(sky: SkyState): void;
  /** The view in points, and the drawing buffer's pixels per point. */
  setView(width: number, height: number, pixelRatio: number): void;
  /** Moves the twinkle, the clouds and a shooting star to `time` seconds. */
  update(time: number, dt: number, random: () => number): void;
  dispose(): void;
}

function vec3Of(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

export function buildSkyView(): SkyView {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const disposables: { dispose(): void }[] = [];
  const view = { value: new THREE.Vector2(393, 852) };
  const quad = new THREE.PlaneGeometry(2, 2);
  disposables.push(quad);

  function body(fragmentShader: string, uniforms: Record<string, THREE.IUniform>, order: number) {
    const shared = {
      uView: view,
      uCenter: { value: new THREE.Vector2() },
      uSize: { value: new THREE.Vector2() },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: { ...shared, ...uniforms },
      vertexShader: QUAD_VERTEX,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    disposables.push(material);
    const mesh = new THREE.Mesh(quad, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = order;
    scene.add(mesh);
    return { mesh, center: shared.uCenter.value, size: shared.uSize.value };
  }

  // The sun: a white core and a warm halo (`.sky-sun`: 360 points, a circle of 254 points).
  const sunUniforms = {
    uOpacity: { value: 0 },
    uCore: { value: vec3Of(skyLights.sunCore) },
    uTint: { value: vec3Of(skyLights.sunWarm) },
  };
  const sun = body(
    `varying vec2 vPoint; uniform float uOpacity; uniform vec3 uCore; uniform vec3 uTint;
void main() { float r = length(vPoint) / 254.6; vec4 c;
  if (r < 0.055) c = vec4(uCore, 1.0);
  else if (r < 0.085) c = mix(vec4(uCore, 1.0), vec4(uTint, 0.7), (r - 0.055) / 0.03);
  else if (r < 0.26) c = mix(vec4(uTint, 0.7), vec4(uTint, 0.26), (r - 0.085) / 0.175);
  else c = mix(vec4(uTint, 0.26), vec4(uTint, 0.0), clamp((r - 0.26) / 0.36, 0.0, 1.0));
  gl_FragColor = vec4(c.rgb, c.a * uOpacity); }`,
    sunUniforms,
    1,
  );
  sun.size.set(360, 360);

  // The moon: its face, a pale halo, and the shadow that makes it a crescent (`.sky-moon`).
  const moonUniforms = {
    uOpacity: { value: 0 },
    uFace: { value: vec3Of(skyLights.moonFace) },
    uHalo: { value: vec3Of(skyLights.moonHalo) },
    uTop: { value: new THREE.Color() },
  };
  const moon = body(
    `varying vec2 vPoint; uniform float uOpacity; uniform vec3 uFace; uniform vec3 uHalo; uniform vec3 uTop;
void main() { float r = length(vPoint) / 141.4; vec4 c;
  if (r < 0.13) c = vec4(uFace, 1.0);
  else if (r < 0.15) c = mix(vec4(uFace, 1.0), vec4(uHalo, 0.35), (r - 0.13) / 0.02);
  else if (r < 0.32) c = mix(vec4(uHalo, 0.35), vec4(uHalo, 0.10), (r - 0.15) / 0.17);
  else c = mix(vec4(uHalo, 0.10), vec4(uHalo, 0.0), clamp((r - 0.32) / 0.28, 0.0, 1.0));
  float shade = (1.0 - smoothstep(14.0, 15.0, length(vPoint - vec2(6.0, 4.0)))) * 0.92;
  c = mix(c, vec4(uTop, 1.0), shade * step(0.01, c.a));
  gl_FragColor = vec4(c.rgb, c.a * uOpacity); }`,
    moonUniforms,
    2,
  );
  moon.size.set(200, 200);

  // The stars: points that twinkle, fading towards the horizon.
  const starPositions = new Float32Array(STAR_COUNT * 3);
  const starData = new Float32Array(STAR_COUNT * 3);
  let state = 7;
  const random = () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
  for (let k = 0; k < STAR_COUNT; k += 1) {
    starPositions[k * 3] = random();
    starPositions[k * 3 + 1] = random() * STAR_FIELD;
    starData[k * 3] = 0.4 + random() ** 3 * 1.5;
    starData[k * 3 + 1] = random() * 6.28;
    starData[k * 3 + 2] = 0.6 + random() * 2.2;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('star', new THREE.BufferAttribute(starData, 3));
  const starUniforms = {
    uTime: { value: 0 },
    uStars: { value: 0 },
    uPixelRatio: { value: 2 },
    uColor: { value: vec3Of(skyLights.star) },
  };
  const starMaterial = new THREE.ShaderMaterial({
    uniforms: starUniforms,
    vertexShader: `attribute vec3 star; uniform float uTime; uniform float uStars; uniform float uPixelRatio; varying float vAlpha;
void main() { vAlpha = uStars * (0.55 + 0.45 * sin(uTime * star.z + star.y)) * (1.0 - position.y / 0.95);
  gl_Position = vec4(position.x * 2.0 - 1.0, 1.0 - position.y * 2.0, 0.0, 1.0);
  gl_PointSize = (star.x * 2.0 + 1.0) * uPixelRatio; }`,
    fragmentShader: `uniform vec3 uColor; varying float vAlpha;
void main() { float d = length(gl_PointCoord - 0.5) * 2.0; float a = 1.0 - smoothstep(0.55, 1.0, d);
  gl_FragColor = vec4(uColor, max(vAlpha, 0.0) * a); }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  disposables.push(starGeometry, starMaterial);
  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.frustumCulled = false;
  stars.renderOrder = 3;
  scene.add(stars);

  // A shooting star: a short bright line with a fading tail, between two points of the screen.
  const shootUniforms = {
    uView: view,
    uFrom: { value: new THREE.Vector2() },
    uTo: { value: new THREE.Vector2() },
    uAlpha: { value: 0 },
    uColor: { value: vec3Of(skyLights.star) },
  };
  const shootMaterial = new THREE.ShaderMaterial({
    uniforms: shootUniforms,
    vertexShader: `uniform vec2 uView; uniform vec2 uFrom; uniform vec2 uTo; varying vec2 vUv;
void main() { vUv = uv; vec2 along = uTo - uFrom; vec2 n = normalize(vec2(-along.y, along.x)) * 1.6;
  vec2 p = uFrom + along * uv.x + n * (uv.y * 2.0 - 1.0);
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0); }`,
    fragmentShader: `uniform float uAlpha; uniform vec3 uColor; varying vec2 vUv;
void main() { float edge = 1.0 - abs(vUv.y * 2.0 - 1.0); gl_FragColor = vec4(uColor, uAlpha * vUv.x * edge); }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const shootGeometry = new THREE.PlaneGeometry(1, 1);
  disposables.push(shootMaterial, shootGeometry);
  const shooting = new THREE.Mesh(shootGeometry, shootMaterial);
  shooting.frustumCulled = false;
  shooting.renderOrder = 4;
  shooting.visible = false;
  scene.add(shooting);
  let shot: { x: number; y: number; start: number } | null = null;

  // Three slow clouds (`.cloud`): a soft ellipse with a rounder top.
  const cloudOpacity = { value: 0 };
  const clouds = CLOUDS.map((cloud) => {
    const uniforms = {
      uOpacity: cloudOpacity,
      uShare: { value: cloud.opacity },
      uColor: { value: vec3Of(skyLights.cloud) },
    };
    const made = body(
      `varying vec2 vPoint; uniform vec2 uSize; uniform float uOpacity; uniform float uShare; uniform vec3 uColor;
void main() { vec2 p = vPoint / (uSize * vec2(0.5, 0.5 / ${CLOUD_ROOM.toFixed(1)}));
  float base = 0.75 * (1.0 - smoothstep(0.0, 1.0, length(p)));
  vec2 q = (p - vec2(0.15, 0.6)) / vec2(0.55, 1.2);
  float top = 0.7 * (1.0 - smoothstep(0.0, 1.0, length(q)));
  gl_FragColor = vec4(uColor, max(base, top) * uOpacity * uShare); }`,
      uniforms,
      0,
    );
    made.size.set(CLOUD_SIZE.width * cloud.scale, CLOUD_SIZE.height * cloud.scale * CLOUD_ROOM);
    return { ...made, cloud };
  });

  // The glow of the low sun (`.sky-glow`): a wide soft light, under everything else.
  const glowUniforms = { uColor: { value: new THREE.Color() }, uAlpha: { value: 0.33 } };
  const glow = body(
    `varying vec2 vPoint; uniform vec2 uSize; uniform vec3 uColor; uniform float uAlpha;
void main() { float r = length(vPoint / (uSize * 0.5)); gl_FragColor = vec4(uColor, uAlpha * (1.0 - smoothstep(0.0, 0.7, r))); }`,
    glowUniforms,
    -1,
  );

  let width = 393;
  let height = 852;
  let current: SkyState | null = null;

  function place(sky: SkyState) {
    sun.center.set(sky.sun.x, sky.sun.y);
    moon.center.set(sky.moon.x, sky.moon.y);
    glow.center.set(sky.sun.x, Math.min(0.95, sky.sun.y + 0.2));
    glow.size.set(width * 2.4, height);
  }

  return {
    scene,
    camera,
    setSky(sky) {
      current = sky;
      sunUniforms.uOpacity.value = sky.sun.on * (1 - sky.night * 0.8);
      sunUniforms.uTint.value.set(sky.sunTint);
      moonUniforms.uOpacity.value = sky.moon.on * sky.night;
      moonUniforms.uTop.value.set(sky.top);
      starUniforms.uStars.value = sky.stars;
      stars.visible = sky.stars >= 0.02;
      cloudOpacity.value = sky.cloud;
      glowUniforms.uColor.value.set(sky.low).lerp(new THREE.Color(1, 1, 1), 0.15);
      sun.mesh.visible = sunUniforms.uOpacity.value > 0.003;
      moon.mesh.visible = moonUniforms.uOpacity.value > 0.003;
      place(sky);
    },
    setView(w, h, pixelRatio) {
      width = w;
      height = h;
      view.value.set(w, h);
      starUniforms.uPixelRatio.value = pixelRatio;
      if (current !== null) place(current);
    },
    update(time, dt, chance) {
      starUniforms.uTime.value = time;
      for (const { center, cloud } of clouds) {
        const travel = CLOUD_SIZE.to - CLOUD_SIZE.from + width - 393;
        const progress = ((((time + cloud.delay) / cloud.seconds) % 1) + 1) % 1;
        const x =
          cloud.left + CLOUD_SIZE.from + progress * travel + (CLOUD_SIZE.width * cloud.scale) / 2;
        center.set(x / width, (cloud.top + (CLOUD_SIZE.height * cloud.scale) / 2) / height);
      }
      for (const { mesh } of clouds) mesh.visible = cloudOpacity.value > 0.01;

      const brightness = current?.stars ?? 0;
      if (shot === null && brightness > SHOOTING.fromStars && chance() < SHOOTING.perSecond * dt) {
        shot = { x: width * (0.2 + chance() * 0.6), y: 60 + chance() * 160, start: time };
      }
      if (shot !== null) {
        const p = (time - shot.start) / SHOOTING.seconds;
        if (p > 1) {
          shot = null;
          shooting.visible = false;
        } else {
          const x = shot.x + p * (SHOOTING.travel[0] ?? 0);
          const y = shot.y + p * (SHOOTING.travel[1] ?? 0);
          shootUniforms.uFrom.value.set(x - (SHOOTING.tail[0] ?? 0), y - (SHOOTING.tail[1] ?? 0));
          shootUniforms.uTo.value.set(x, y);
          shootUniforms.uAlpha.value = 0.9 * Math.sin(p * Math.PI) * brightness;
          shooting.visible = true;
        }
      }
    },
    dispose() {
      for (const item of disposables) item.dispose();
    },
  };
}
