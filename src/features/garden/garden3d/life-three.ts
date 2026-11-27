/**
 * What lives in the home garden, in three.js (maquette-wow, `garden.js`, validated on 27 November
 * 2026): fireflies at night, leaves drifting from the crowns, butterflies and a small flock of
 * birds once earned (`life-rules.ts`), the soft shadow under the island, the golden ring at the
 * foot of the plant that grows, and the ripple of light when it grows. Every shape is drawn by its
 * shader (no picture file, no canvas: a phone's GL context has none).
 *
 * Nothing here is touched by React: `update` moves everything once per frame of the render loop.
 */

import * as THREE from 'three';

import { skyLights } from '@/ui/sky-tokens';

import { dayLifeOpacity, fireflyOpacity, LIFE, type GardenLife } from '../living/life-rules';

const BASIC_VERTEX = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/** A seeded random sequence (Park–Miller), so that the garden is the same at each visit. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

function color(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

interface Leaf {
  readonly mesh: THREE.Mesh;
  readonly uniforms: { uOpacity: { value: number } };
  life: number;
  readonly duration: number;
  x: number;
  y: number;
  z: number;
  spin: number;
}

interface Butterfly {
  readonly group: THREE.Group;
  readonly left: THREE.Mesh;
  readonly right: THREE.Mesh;
  readonly uniforms: { uOpacity: { value: number } };
  readonly seed: number;
  readonly radius: number;
}

interface Bird {
  readonly mesh: THREE.Mesh;
  readonly uniforms: { uOpacity: { value: number }; uFlap: { value: number } };
  readonly dx: number;
  readonly dz: number;
  readonly phase: number;
}

interface RippleUniforms {
  readonly uR: { value: number };
  readonly uA: { value: number };
}

interface Ripple {
  readonly object: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  readonly uniforms: RippleUniforms;
  readonly start: number;
  readonly duration: number;
  readonly kind: 'ring' | 'glow';
  readonly size: number;
}

export interface LifeView {
  /** Drawn with the garden. */
  readonly group: THREE.Group;
  setLife(life: GardenLife): void;
  setNight(night: number): void;
  /** The ring at the foot of the growing plant, or none. */
  setGrowthRing(at: THREE.Vector3 | null): void;
  /** A ripple of light at `at` (the plant that grew), from `time` seconds. */
  ripple(at: THREE.Vector3, time: number): void;
  /** The drawing buffer's pixels per point: the fireflies keep their size in points. */
  setPixelRatio(ratio: number): void;
  /** Moves everything to `time` seconds (`dt` since the last frame), the birds facing `camera`. */
  update(time: number, dt: number, camera: THREE.Camera): void;
  /** Whether a ripple is still playing: the loop keeps drawing until it ends. */
  readonly isRippling: () => boolean;
  dispose(): void;
}

export function buildLifeView(): LifeView {
  const group = new THREE.Group();
  group.name = 'garden-life';
  const disposables: { dispose(): void }[] = [];
  const random = seeded(7);
  let night = 0;
  let life: GardenLife = { fireflies: 0, leaves: 0, butterflies: 0, birds: 0 };

  // --- The soft shadow under the island: it sits in the sky instead of floating in a void ------
  const shadowUniforms = { uOpacity: { value: 0.5 } };
  const shadowMaterial = new THREE.ShaderMaterial({
    uniforms: shadowUniforms,
    vertexShader: BASIC_VERTEX,
    fragmentShader: `varying vec2 vUv; uniform float uOpacity;
void main() { float r = length(vUv - 0.5) * 2.0;
  float a = mix(0.55, 0.22, smoothstep(0.0, 0.5, r)) * (1.0 - smoothstep(0.5, 1.0, r));
  gl_FragColor = vec4(0.0, 0.0, 0.0, a * uOpacity); }`,
    transparent: true,
    depthWrite: false,
  });
  const shadowGeometry = new THREE.PlaneGeometry(34, 34);
  disposables.push(shadowMaterial, shadowGeometry);
  const islandShadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  islandShadow.rotation.x = -Math.PI / 2;
  islandShadow.position.y = -3.2;
  islandShadow.renderOrder = -1;
  islandShadow.frustumCulled = false;
  group.add(islandShadow);

  // --- Fireflies: points that wander and pulse, at night only -------------------------------------
  const positions = new Float32Array(LIFE.fireflies * 3);
  const seeds = new Float32Array(LIFE.fireflies);
  for (let k = 0; k < LIFE.fireflies; k += 1) {
    positions[k * 3] = (random() - 0.5) * 16;
    positions[k * 3 + 1] = 0.5 + random() * 2.2;
    positions[k * 3 + 2] = (random() - 0.5) * 16;
    seeds[k] = random() * 10;
  }
  const fireflyGeometry = new THREE.BufferGeometry();
  fireflyGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  fireflyGeometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
  const fireflyUniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uPixelRatio: { value: 2 },
    uColor: { value: color(skyLights.firefly) },
  };
  const fireflyMaterial = new THREE.ShaderMaterial({
    uniforms: fireflyUniforms,
    vertexShader: `attribute float seed; uniform float uTime; uniform float uPixelRatio; varying float vPulse;
void main() { vec3 p = position;
  p.x += sin(uTime * 0.4 + seed) * 0.9; p.z += cos(uTime * 0.33 + seed * 1.7) * 0.9;
  p.y += sin(uTime * 0.7 + seed * 2.0) * 0.35;
  vPulse = 0.5 + 0.5 * sin(uTime * 2.3 + seed * 5.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (5.0 + 4.0 * vPulse) * uPixelRatio; }`,
    fragmentShader: `uniform float uOpacity; uniform vec3 uColor; varying float vPulse;
void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a = a * a;
  gl_FragColor = vec4(uColor, a * vPulse * uOpacity); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  disposables.push(fireflyGeometry, fireflyMaterial);
  const fireflies = new THREE.Points(fireflyGeometry, fireflyMaterial);
  fireflies.frustumCulled = false;
  group.add(fireflies);

  // --- Leaves drifting from the crowns ----------------------------------------------------------
  const leafGeometry = new THREE.PlaneGeometry(0.36, 0.36);
  disposables.push(leafGeometry);
  const leafShade = { value: new THREE.Color(1, 1, 1) };
  const leaves: Leaf[] = Array.from({ length: LIFE.leaves }, (_, k) => {
    const uniforms = {
      uOpacity: { value: 0 },
      uColor: { value: color(skyLights.leaves[k % skyLights.leaves.length] ?? '#8FB85A') },
      uShade: leafShade,
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: BASIC_VERTEX,
      // The outline of the mockup's leaf: two curves meeting at both tips.
      fragmentShader: `varying vec2 vUv; uniform float uOpacity; uniform vec3 uColor; uniform vec3 uShade;
void main() { float halfWidth = 0.42 * sin(3.14159 * vUv.y);
  if (abs(vUv.x - 0.5) > halfWidth) discard;
  gl_FragColor = vec4(uColor * uShade, uOpacity); }`,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    disposables.push(material);
    const mesh = new THREE.Mesh(leafGeometry, material);
    mesh.frustumCulled = false;
    group.add(mesh);
    const leaf: Leaf = {
      mesh,
      uniforms,
      life: random(),
      duration: 7 + random() * 5,
      x: 0,
      y: 0,
      z: 0,
      spin: 0,
    };
    respawn(leaf);
    return leaf;
  });
  function respawn(leaf: Leaf): void {
    leaf.x = (random() - 0.5) * 14;
    leaf.z = (random() - 0.5) * 14;
    leaf.y = 3 + random() * 2.5;
    leaf.spin = random() * 6;
  }

  // --- Butterflies (earned at hizb 47) ----------------------------------------------------------
  const wingGeometry = new THREE.PlaneGeometry(0.42, 0.42);
  wingGeometry.translate(0.21, 0, 0);
  wingGeometry.rotateX(-Math.PI / 2);
  disposables.push(wingGeometry);
  const butterflies: Butterfly[] = skyLights.butterflies.map((hex, k) => {
    const uniforms = { uOpacity: { value: 0 }, uColor: { value: color(hex) } };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: BASIC_VERTEX,
      // Two wings in one: a fore wing and a hind wing (the mockup's two ellipses), a dark spot.
      fragmentShader: `varying vec2 vUv; uniform float uOpacity; uniform vec3 uColor;
float ellipse(vec2 p, vec2 c, vec2 r, float a) { vec2 d = p - c; float s = sin(a), co = cos(a);
  d = vec2(co * d.x + s * d.y, -s * d.x + co * d.y); return length(d / r); }
void main() { vec2 p = vec2(vUv.x, 1.0 - vUv.y);
  float fore = ellipse(p, vec2(0.55, 0.36), vec2(0.39, 0.28), -0.5);
  float hind = ellipse(p, vec2(0.41, 0.72), vec2(0.23, 0.19), 0.5);
  if (min(fore, hind) > 1.0) discard;
  float spot = 1.0 - step(1.0, ellipse(p, vec2(0.66, 0.31), vec2(0.11, 0.08), -0.5));
  gl_FragColor = vec4(uColor * (1.0 - 0.18 * spot), uOpacity); }`,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    disposables.push(material);
    const left = new THREE.Mesh(wingGeometry, material);
    const right = new THREE.Mesh(wingGeometry, material);
    right.scale.x = -1;
    const butterfly = new THREE.Group();
    butterfly.add(left, right);
    group.add(butterfly);
    return { group: butterfly, left, right, uniforms, seed: k * 1.7 + 0.3, radius: 3.2 + k * 1.3 };
  });

  // --- Birds (earned at hizb 27, 37, 57): silhouettes high above, facing the camera ------------
  const birdGeometry = new THREE.PlaneGeometry(1.5, 0.75);
  disposables.push(birdGeometry);
  const FLOCK: readonly (readonly [number, number])[] = [
    [0, 0],
    [-1.1, -0.5],
    [1.0, -0.6],
    [-2.0, -1.1],
    [2.1, -1.0],
  ];
  const birds: Bird[] = FLOCK.map(([dx, dz], k) => {
    const uniforms = {
      uOpacity: { value: 0 },
      uFlap: { value: 0.3 },
      uColor: { value: color(skyLights.bird) },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: BASIC_VERTEX,
      // Two thin wings from the body, their tips raised by `uFlap` (down when negative).
      fragmentShader: `varying vec2 vUv; uniform float uOpacity; uniform float uFlap; uniform vec3 uColor;
void main() { vec2 p = vec2(vUv.x * 2.0 - 1.0, vUv.y * 2.0 - 1.0);
  float ax = abs(p.x);
  float line = -0.1 + uFlap * pow(ax, 1.3) - 0.25 * ax * (1.0 - ax);
  float thick = 0.13 * (1.0 - ax) + 0.025;
  float wing = 1.0 - smoothstep(thick * 0.6, thick, abs(p.y - line));
  float body = 1.0 - smoothstep(0.08, 0.12, length(vec2(p.x * 1.4, p.y + 0.06)));
  float a = max(wing * step(ax, 0.96), body);
  if (a < 0.02) discard;
  gl_FragColor = vec4(uColor, a * uOpacity); }`,
      transparent: true,
      depthWrite: false,
    });
    disposables.push(material);
    const mesh = new THREE.Mesh(birdGeometry, material);
    mesh.frustumCulled = false;
    group.add(mesh);
    return { mesh, uniforms, dx, dz, phase: k * 0.37 };
  });

  // --- The golden ring at the foot of the growing plant: "this is what grows", without a word --
  const ringUniforms = { uTime: { value: 0 }, uColor: { value: color(skyLights.growRing) } };
  const ringMaterial = new THREE.ShaderMaterial({
    uniforms: ringUniforms,
    vertexShader: BASIC_VERTEX,
    fragmentShader: `varying vec2 vUv; uniform float uTime; uniform vec3 uColor;
void main() { float r = length(vUv - 0.5) * 2.0; float pulse = 0.5 + 0.5 * sin(uTime * 1.6);
  float ring = smoothstep(0.62 + pulse * 0.12, 0.78 + pulse * 0.12, r) * (1.0 - smoothstep(0.82 + pulse * 0.12, 1.0, r));
  float core = (1.0 - smoothstep(0.0, 0.7, r)) * 0.35;
  gl_FragColor = vec4(uColor, ring * 0.55 + core); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const ringGeometry = new THREE.PlaneGeometry(2.6, 2.6);
  disposables.push(ringMaterial, ringGeometry);
  const growthRing = new THREE.Mesh(ringGeometry, ringMaterial);
  growthRing.rotation.x = -Math.PI / 2;
  growthRing.renderOrder = 2;
  growthRing.visible = false;
  growthRing.frustumCulled = false;
  group.add(growthRing);

  // --- Ripples and light where the plant grows -------------------------------------------------
  const ripples: Ripple[] = [];
  const rippleGeometry = new THREE.PlaneGeometry(1, 1);
  disposables.push(rippleGeometry);

  function addRipple(
    object: THREE.Mesh,
    material: THREE.ShaderMaterial,
    uniforms: RippleUniforms,
    ripple: Omit<Ripple, 'object' | 'material' | 'uniforms'>,
  ) {
    object.frustumCulled = false;
    group.add(object);
    ripples.push({ object, material, uniforms, ...ripple });
  }

  function fade(target: number, current: number, dt: number): number {
    return current + (target - current) * Math.min(1, dt * 2);
  }

  let pixelRatio = 2;
  return {
    group,
    setLife(next) {
      life = next;
      fireflyGeometry.setDrawRange(0, next.fireflies);
    },
    setNight(value) {
      night = Math.min(1, Math.max(0, value));
      shadowUniforms.uOpacity.value = 0.5 - night * 0.25;
      leafShade.value.setRGB(1 - night * 0.55, 1 - night * 0.5, 1 - night * 0.3);
      fireflyUniforms.uOpacity.value = fireflyOpacity(night);
    },
    setGrowthRing(at) {
      growthRing.visible = at !== null;
      if (at !== null) growthRing.position.set(at.x, 0.11, at.z);
    },
    ripple(at, time) {
      for (let k = 0; k < 3; k += 1) {
        const uniforms = { uR: { value: 0 }, uA: { value: 0 } };
        const material = new THREE.ShaderMaterial({
          uniforms: { ...uniforms, uColor: { value: color(skyLights.ripple) } },
          vertexShader: BASIC_VERTEX,
          fragmentShader: `varying vec2 vUv; uniform float uR; uniform float uA; uniform vec3 uColor;
void main() { float r = length(vUv - 0.5) * 2.0; float w = 0.05 + uR * 0.05;
  float k = 1.0 - smoothstep(0.0, w, abs(r - uR)); gl_FragColor = vec4(uColor, k * uA); }`,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const ring = new THREE.Mesh(rippleGeometry, material);
        ring.scale.setScalar(4.8);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(at.x, 0.13, at.z);
        ring.renderOrder = 3;
        addRipple(ring, material, uniforms, {
          start: time + k * 0.17,
          duration: 1.3 + k * 0.2,
          kind: 'ring',
          size: 4.8,
        });
      }
      const glowUniforms = { uR: { value: 0 }, uA: { value: 0 } };
      const material = new THREE.ShaderMaterial({
        uniforms: { uA: glowUniforms.uA, uColor: { value: color(skyLights.growGlow) } },
        vertexShader: BASIC_VERTEX,
        fragmentShader: `varying vec2 vUv; uniform float uA; uniform vec3 uColor;
void main() { float r = length(vUv - 0.5) * 2.0;
  float a = r < 0.25 ? mix(1.0, 0.45, r / 0.25) : 0.45 * (1.0 - smoothstep(0.25, 1.0, r));
  gl_FragColor = vec4(uColor, a * uA); }`,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      });
      const glow = new THREE.Mesh(rippleGeometry, material);
      glow.position.set(at.x, 1.4, at.z);
      glow.scale.setScalar(0.1);
      addRipple(glow, material, glowUniforms, {
        start: time,
        duration: 1.1,
        kind: 'glow',
        size: 6,
      });
    },
    setPixelRatio(ratio) {
      pixelRatio = ratio;
      fireflyUniforms.uPixelRatio.value = pixelRatio;
    },
    update(time, dt, camera) {
      fireflyUniforms.uTime.value = time;
      ringUniforms.uTime.value = time;
      fireflies.visible = life.fireflies > 0 && fireflyUniforms.uOpacity.value > 0;
      const day = dayLifeOpacity(night);

      leaves.forEach((leaf, k) => {
        const shown = k < life.leaves;
        leaf.mesh.visible = shown;
        if (!shown) return;
        leaf.life += dt / leaf.duration;
        if (leaf.life >= 1) {
          leaf.life = 0;
          respawn(leaf);
        }
        const p = leaf.life;
        leaf.mesh.position.set(
          leaf.x + Math.sin(time * 0.9 + leaf.spin) * 0.6 + p * 2.2,
          leaf.y - p * (leaf.y - 0.1),
          leaf.z + Math.cos(time * 0.7 + leaf.spin) * 0.5,
        );
        leaf.mesh.rotation.set(time * 1.7 + leaf.spin, time * 1.1 + leaf.spin, time * 0.6);
        leaf.uniforms.uOpacity.value = Math.min(1, p * 6, (1 - p) * 5);
      });

      butterflies.forEach((butterfly, k) => {
        const target = k < life.butterflies ? day : 0;
        butterfly.uniforms.uOpacity.value = fade(target, butterfly.uniforms.uOpacity.value, dt);
        butterfly.group.visible = butterfly.uniforms.uOpacity.value > 0.02;
        if (!butterfly.group.visible) return;
        const s = time * 0.32 + butterfly.seed;
        butterfly.group.position.set(
          Math.sin(s * 1.1) * butterfly.radius,
          1.25 + Math.sin(s * 2.3) * 0.45 + k * 0.12,
          Math.cos(s * 0.83) * butterfly.radius * 0.85,
        );
        butterfly.group.rotation.y = -s * 1.1 + Math.PI / 2;
        const flap = Math.sin((time + k) * 17) * 1.05;
        butterfly.left.rotation.y = flap;
        butterfly.right.rotation.y = -flap;
      });

      // One slow circle high above the garden; the wings beat, then glide.
      const angle = time * 0.07;
      const radius = 7.5;
      const cx = Math.cos(angle) * radius;
      const cz = Math.sin(angle) * radius - 1;
      const dirX = -Math.sin(angle);
      const dirZ = Math.cos(angle);
      birds.forEach((bird, k) => {
        const target = k < life.birds ? 0.62 * day : 0;
        bird.uniforms.uOpacity.value = fade(target, bird.uniforms.uOpacity.value, dt);
        bird.mesh.visible = bird.uniforms.uOpacity.value > 0.02;
        if (!bird.mesh.visible) return;
        bird.mesh.position.set(
          cx + dirX * bird.dz * 1.6 + dirZ * bird.dx * 1.5,
          10.5 + Math.sin(time * 0.6 + bird.phase * 3) * 0.25 + bird.dz * 0.1,
          cz + dirZ * bird.dz * 1.6 - dirX * bird.dx * 1.5,
        );
        bird.mesh.quaternion.copy(camera.quaternion);
        const isGliding = Math.sin(time * 0.8 + bird.phase) > 0.35;
        const beat = Math.sin(time * 7 + bird.phase * 9);
        bird.uniforms.uFlap.value = isGliding ? 0.3 : beat > 0 ? 0.55 : -0.25;
      });

      for (let k = ripples.length - 1; k >= 0; k -= 1) {
        const ripple = ripples[k] as Ripple;
        const p = (time - ripple.start) / ripple.duration;
        if (p < 0) continue;
        if (p >= 1) {
          group.remove(ripple.object);
          ripple.material.dispose();
          ripples.splice(k, 1);
          continue;
        }
        const eased = 1 - (1 - p) ** 3;
        if (ripple.kind === 'ring') {
          ripple.uniforms.uR.value = 0.1 + eased * 0.85;
          ripple.uniforms.uA.value = (1 - p) * 0.9;
        } else {
          ripple.object.scale.setScalar(0.5 + eased * ripple.size);
          ripple.object.quaternion.copy(camera.quaternion);
          ripple.uniforms.uA.value = Math.sin(Math.min(1, p * 1.6) * Math.PI) * 0.95;
        }
      }
    },
    isRippling: () => ripples.length > 0,
    dispose() {
      for (const ripple of ripples) ripple.material.dispose();
      ripples.length = 0;
      for (const item of disposables) item.dispose();
    },
  };
}
