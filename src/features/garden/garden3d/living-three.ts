/**
 * The living garden in the shaders (maquette-wow, `garden.js`, validated by the owner on 27
 * November 2026): water that flows outward from the fountain along the channels and takes the
 * colour of the sky, glints and glows softly at night; trees, flowers and bushes that sway in the
 * wind. A few lines added to the garden's own materials (`onBeforeCompile`), the model unchanged.
 *
 * Everything is driven by uniforms shared by every material: one value changes, nothing is
 * rebuilt. `uLife` at 0 is the still garden of the pictures (a friend's garden, the tests); at 1,
 * the home garden.
 */

import * as THREE from 'three';

import type { PieceRole } from './garden-model';

export interface LivingUniforms {
  /** Seconds of life: the wind and the water move with it. */
  readonly uTime: { value: number };
  /** 0: the still garden of the pictures; 1: alive. */
  readonly uLife: { value: number };
  /** How much it is night: the water glows a little. */
  readonly uNight: { value: number };
  /** The water's colour under the sky (`SkyState.water`). */
  readonly uSkyTint: { value: THREE.Color };
  /** The phone's tilt (tilt.ts): the glints on the water move with it, as a reflection does. */
  readonly uTilt: { value: THREE.Vector2 };
}

export function newLivingUniforms(): LivingUniforms {
  return {
    uTime: { value: 0 },
    uLife: { value: 0 },
    uNight: { value: 0 },
    uSkyTint: { value: new THREE.Color(0xbfdff0) },
    uTilt: { value: new THREE.Vector2(0, 0) },
  };
}

/** The water of the channels, the fountain and the springs (bake-scene.js COLORS: not the dry bed). */
const WATER_MATERIAL = /^ground-(6cc3d0|7fb3b6)$|^water$/i;

export function isWaterMaterial(name: string): boolean {
  return WATER_MATERIAL.test(name);
}

/** How much each part sways: what grows sways, what is built stands. */
export function swayOfRole(role: PieceRole): number {
  return role === 'built' ? 0 : 1;
}

/**
 * The sway, in world space (the mockup's `PROJECT`): the higher a vertex, the further it moves,
 * each plant on its own phase, in gusts. Replaces three.js's `project_vertex`.
 */
const SWAY_VERTEX = `
  vec4 livingWorld = vec4( transformed, 1.0 );
  #ifdef USE_BATCHING
    livingWorld = batchingMatrix * livingWorld;
  #endif
  #ifdef USE_INSTANCING
    livingWorld = instanceMatrix * livingWorld;
  #endif
  livingWorld = modelMatrix * livingWorld;
  if (uSway > 0.0 && uLife > 0.0) {
    float height = max(livingWorld.y - 0.15, 0.0);
    float phase = livingWorld.x * 0.31 + livingWorld.z * 0.23;
    float gust = 0.75 + 0.25 * sin(uTime * 0.37 + livingWorld.x * 0.05);
    float reach = 0.016 * pow(height, 1.25) * uSway * gust * uLife;
    livingWorld.x += sin(uTime * 1.25 + phase) * reach;
    livingWorld.z += cos(uTime * 1.05 + phase * 1.3) * reach * 0.8;
  }
  vLivingPosition = livingWorld.xyz;
  vec4 mvPosition = viewMatrix * livingWorld;
  gl_Position = projectionMatrix * mvPosition;`;

/**
 * The water (the mockup's `WATER`): bands that flow outward along each channel, a slow caustic and
 * a few glints, over the water's colour mixed with the sky's.
 */
const WATER_FRAGMENT = `#include <color_fragment>
if (uLife > 0.0) {
  vec2 p = vLivingPosition.xz;
  bool alongX = abs(p.x) > abs(p.y);
  float along = alongX ? abs(p.x) : abs(p.y);
  float across = alongX ? p.y : p.x;
  float wobble = sin(across * 7.0 + along * 1.3 + uTime * 0.8) * 0.12;
  float f = fract(along * 0.55 - uTime * 0.38 + wobble);
  float band = smoothstep(0.0, 0.12, f) * smoothstep(0.42, 0.12, f);
  float caustic = sin(p.x * 3.3 + uTime * 1.3) * sin(p.y * 2.9 - uTime * 1.1);
  vec2 seen = p + uTilt * 0.6;
  float glint = pow(max(sin(seen.x * 5.0 + uTime * 1.6) * sin(seen.y * 6.0 - uTime * 1.3), 0.0), 10.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, uSkyTint, 0.22 * uLife);
  diffuseColor.rgb += vec3(0.86, 0.97, 1.0) * (band * 0.13 + max(caustic, 0.0) * 0.06 + glint * 0.12) * uLife;
}`;

const WATER_GLOW = `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(0.10, 0.42, 0.52) * uNight * 0.55 * uLife;`;

export interface LivingOptions {
  /** 0 for what does not sway. */
  readonly sway: number;
  readonly isWater: boolean;
}

/** Adds the life to a material's shaders. Call from `onBeforeCompile`, after any other change. */
export function injectLiving(
  shader: THREE.WebGLProgramParametersWithUniforms,
  uniforms: LivingUniforms,
  options: LivingOptions,
): void {
  shader.uniforms.uTime = uniforms.uTime;
  shader.uniforms.uLife = uniforms.uLife;
  shader.uniforms.uSway = { value: options.sway };
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      '#include <common>\nuniform float uTime;\nuniform float uLife;\nuniform float uSway;\nvarying vec3 vLivingPosition;',
    )
    .replace('#include <project_vertex>', SWAY_VERTEX);
  if (!options.isWater) return;
  shader.uniforms.uNight = uniforms.uNight;
  shader.uniforms.uSkyTint = uniforms.uSkyTint;
  shader.uniforms.uTilt = uniforms.uTilt;
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      '#include <common>\nuniform float uTime;\nuniform float uLife;\nuniform float uNight;\nuniform vec3 uSkyTint;\nuniform vec2 uTilt;\nvarying vec3 vLivingPosition;',
    )
    .replace('#include <color_fragment>', WATER_FRAGMENT)
    .replace('#include <emissivemap_fragment>', WATER_GLOW);
}
