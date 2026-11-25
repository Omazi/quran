/**
 * The baked garden as a three.js scene (decision D40): the meshes of the model, the materials and
 * the light of the pictures, an orthographic camera. `showStage` picks the triangles and
 * instances a stage draws and sets the colours that change with it; `setOrbit` places the camera.
 *
 * The materials are those the pictures were rendered with (the picture tool's matte material,
 * its wilt and its light), so that the 3D garden at rest looks like the picture.
 */

import * as THREE from 'three';

import type { GardenStage } from '../garden-picture';
import {
  cameraDirection,
  edgeFadeWidth,
  frustumOf,
  type FrameAnchor,
  type Orbit,
} from './camera-rig';
import { GARDEN_3D } from './config';
import { buildGrowthView, injectGrowth, type GrowthView, type GrowUniforms } from './growth-three';
import {
  visibleInstances,
  visibleRanges,
  type GardenModel,
  type ModelAttribute,
  type ModelMaterial,
  type ModelMesh,
  type ModelTexture,
} from './garden-model';

export interface GardenThree {
  readonly scene: THREE.Scene;
  readonly camera: THREE.OrthographicCamera;
  /** Shows a stage. Returns false when nothing changed (no need to draw again). */
  showStage(stage: GardenStage): boolean;
  /**
   * Shows the element of `hizb` growing at `growth` (0 to 1), or nothing (null). It is drawn only
   * while the stage shows every element before it: `hizb` is the stage's count plus one. Returns
   * false when nothing changed.
   */
  showGrowth(growing: { readonly hizb: number; readonly growth: number } | null): boolean;
  setOrbit(orbit: Orbit, aspect: number, anchor?: FrameAnchor): void;
  /**
   * The overlay that dissolves the edges of the view (drawn after `scene`, over it): drawn only
   * when something fades.
   */
  readonly fade: GardenFade;
  dispose(): void;
}

export interface GardenFade {
  readonly scene: THREE.Scene;
  readonly camera: THREE.Camera;
  /** What fades, as a share of the view's smaller side (0: nothing). */
  setWidth(width: number, aspect: number): void;
  readonly isVisible: () => boolean;
}

/**
 * A full-view quad that multiplies what is drawn by an alpha that falls to 0 at the four edges.
 * The canvas is transparent and premultiplied, so colour and alpha are both scaled: the garden
 * dissolves into whatever is under the view (the page's gradient, light or dark), with no
 * colour to match.
 */
function buildFade(disposables: { dispose(): void }[]): GardenFade {
  const uWidth = { value: 0 };
  const uAspect = { value: 1 };
  const material = new THREE.ShaderMaterial({
    uniforms: { uWidth, uAspect },
    vertexShader: `varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `varying vec2 vUv;
uniform float uWidth;
uniform float uAspect;
void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  float edge = min(min(p.x, uAspect - p.x), min(p.y, 1.0 - p.y));
  float a = smoothstep(0.0, uWidth * min(uAspect, 1.0), edge);
  gl_FragColor = vec4(a, a, a, a);
}`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.ZeroFactor,
    blendDst: THREE.SrcColorFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.SrcAlphaFactor,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  disposables.push(material, geometry);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.visible = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  return {
    scene,
    camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    setWidth(width, aspect) {
      uWidth.value = width;
      uAspect.value = aspect;
      mesh.visible = width > 0;
    },
    isVisible: () => mesh.visible,
  };
}

/** The picture tool's wilt (garden.js `wilted`): green turns to straw, the rest to dust. */
const WILT_CHUNK = `#include <color_fragment>
{
  vec3 c = diffuseColor.rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  float green = clamp((c.g - c.r) * 8.0, 0.0, 1.0);
  vec3 dry = vec3(0.86, 0.66, 0.30) * (l * 1.25 + 0.10);
  c = mix(c, dry, green * uWilt * 0.92);
  c = mix(c, vec3(l) * vec3(1.0, 0.93, 0.80), 0.40 * uWilt * (1.0 - green));
  diffuseColor.rgb = c;
}`;

/**
 * A copy of the values in a fresh array: three.js then uploads them from the start of their own
 * buffer. The model's arrays are views into the file, which some GL bindings may not honour.
 */
function own<
  T extends Int8Array | Uint8Array | Int16Array | Uint16Array | Uint32Array | Float32Array,
>(array: T): T {
  return array.slice() as T;
}

function attributeOf(
  attribute: ModelAttribute,
): THREE.BufferAttribute | THREE.InterleavedBufferAttribute {
  const array = own(attribute.array);
  if (attribute.stride === attribute.itemSize) {
    return new THREE.BufferAttribute(array, attribute.itemSize, attribute.normalized);
  }
  // Quantised positions and normals are padded to 4 values per vertex (glTF alignment).
  return new THREE.InterleavedBufferAttribute(
    new THREE.InterleavedBuffer(array, attribute.stride),
    attribute.itemSize,
    0,
    attribute.normalized,
  );
}

function geometryOf(mesh: ModelMesh): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', attributeOf(mesh.position));
  geometry.setAttribute('normal', attributeOf(mesh.normal));
  if (mesh.uv !== null) geometry.setAttribute('uv', attributeOf(mesh.uv));
  if (mesh.color !== null) geometry.setAttribute('color', attributeOf(mesh.color));
  geometry.setIndex(new THREE.BufferAttribute(own(mesh.index), 1));
  return geometry;
}

function textureOf(texture: ModelTexture): THREE.DataTexture {
  const map = new THREE.DataTexture(
    own(texture.pixels),
    texture.width,
    texture.height,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.flipY = false;
  map.needsUpdate = true;
  return map;
}

function lerpedColor(from: number, to: number, amount: number): THREE.Color {
  return new THREE.Color(from).lerp(new THREE.Color(to), amount);
}

/** Builds the scene of a garden model. Throws if three.js cannot make it. */
export function buildGardenThree(model: GardenModel): GardenThree {
  const scene = new THREE.Scene();
  const textures = model.textures.map(textureOf);
  const wilt = { value: 0 };
  const disposables: { dispose(): void }[] = [...textures];

  const materialCache = new Map<ModelMaterial, THREE.MeshLambertMaterial>();
  const tinted: { material: THREE.MeshLambertMaterial; source: ModelMaterial }[] = [];
  /**
   * The material of a model mesh, made once. With `grows`, a material of its own whose vertices
   * move with the growth (growth-three.ts): the caller disposes of it.
   */
  const materialOf = (source: ModelMaterial, grows?: GrowUniforms): THREE.MeshLambertMaterial => {
    const cached = grows === undefined ? materialCache.get(source) : undefined;
    if (cached !== undefined) return cached;
    const material = new THREE.MeshLambertMaterial({
      name: source.name,
      color: source.color,
      side: source.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      vertexColors: source.vertexColors,
      transparent: source.transparent,
      opacity: source.opacity,
      depthWrite: !source.transparent,
    });
    if (source.texture !== null) material.map = textures[source.texture] ?? null;
    if (source.alphaTest > 0) material.alphaTest = source.alphaTest;
    if (source.emissive !== 0 && source.emissiveIntensity > 0) {
      material.emissive.setHex(source.emissive);
      material.emissiveIntensity = source.emissiveIntensity;
    }
    if (source.wilts || grows !== undefined) {
      material.onBeforeCompile = (shader) => {
        if (source.wilts) {
          shader.uniforms.uWilt = wilt;
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform float uWilt;')
            .replace('#include <color_fragment>', WILT_CHUNK);
        }
        if (grows !== undefined) injectGrowth(shader, grows);
      };
      const key = `garden${source.wilts ? '-wilt' : ''}${grows === undefined ? '' : '-grow'}`;
      material.customProgramCacheKey = () => key;
    }
    if (grows !== undefined) return material;
    if (source.tint !== null) tinted.push({ material, source });
    materialCache.set(source, material);
    disposables.push(material);
    return material;
  };
  const geometryCache = new Map<ModelMesh, THREE.BufferGeometry>();
  const geometryFor = (source: ModelMesh): THREE.BufferGeometry => {
    let geometry = geometryCache.get(source);
    if (geometry === undefined) {
      geometry = geometryOf(source);
      geometryCache.set(source, geometry);
      disposables.push(geometry);
    }
    return geometry;
  };

  interface Shown {
    readonly update: (stage: GardenStage) => void;
  }
  const parts: Shown[] = [];
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  for (const source of model.meshes) {
    const geometry = geometryFor(source);
    const material = materialOf(source.material);
    const instances = source.instances;
    if (instances === null) {
      // Merged: one draw per range of pieces the stage shows (geometry groups).
      const mesh = new THREE.Mesh(geometry, [material]);
      mesh.name = source.name;
      mesh.scale.setScalar(source.positionScale);
      mesh.castShadow = source.castShadow;
      mesh.receiveShadow = source.receiveShadow;
      mesh.frustumCulled = false;
      scene.add(mesh);
      parts.push({
        update: (stage) => {
          geometry.clearGroups();
          const ranges = visibleRanges(source.items, stage);
          for (const range of ranges) geometry.addGroup(range.start, range.count, 0);
          mesh.visible = ranges.length > 0;
        },
      });
    } else {
      // Instanced: the instances a stage shows are written first, and only they are drawn.
      const matrices = Array.from({ length: instances.count }, (_, k) => {
        position.fromArray(instances.translation, k * 3);
        rotation.fromArray(instances.rotation, k * 4);
        scale.fromArray(instances.scale, k * 3);
        return new THREE.Matrix4().compose(position, rotation, scale);
      });
      const mesh = new THREE.InstancedMesh(geometry, material, instances.count);
      mesh.name = source.name;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = source.castShadow;
      mesh.receiveShadow = source.receiveShadow;
      mesh.frustumCulled = false;
      scene.add(mesh);
      parts.push({
        update: (stage) => {
          const shown = visibleInstances(instances.items, stage);
          shown.forEach((instance, slot) => mesh.setMatrixAt(slot, matrices[instance] ?? matrix));
          mesh.count = shown.length;
          mesh.instanceMatrix.needsUpdate = true;
          mesh.visible = shown.length > 0;
        },
      });
    }
  }

  // The light of the pictures.
  const { sky, sun: sunLight, shadow } = GARDEN_3D.light;
  scene.add(new THREE.HemisphereLight(sky.color, sky.ground, sky.intensity));
  const sun = new THREE.DirectionalLight(sunLight.color, sunLight.intensity);
  sun.position.set(...sunLight.position);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadow.mapSize, shadow.mapSize);
  Object.assign(sun.shadow.camera, shadow.bounds);
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = shadow.bias;
  sun.shadow.normalBias = shadow.normalBias;
  sun.shadow.radius = shadow.radius;
  sun.shadow.intensity = shadow.intensity;
  scene.add(sun);
  scene.add(sun.target);

  const { near, far, distance } = GARDEN_3D.camera;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, near, far);
  const target = new THREE.Vector3(...GARDEN_3D.picture.target);

  const fade = buildFade(disposables);
  let shownKey = '';
  let shownStage: GardenStage | null = null;
  // The growing element: built for one stage and one hizb, moved with the growth.
  let growth: { key: string; view: GrowthView | null } | null = null;
  let growthValue = -1;
  const growthResources = { model, scene, geometryOf: geometryFor, materialOf };
  return {
    scene,
    fade,
    camera,
    showStage(stage) {
      const key = `${stage.count}-${stage.water}-${stage.foliage}`;
      if (key === shownKey) return false;
      shownKey = key;
      shownStage = stage;
      for (const part of parts) part.update(stage);
      const amount = GARDEN_3D.wiltByFoliage[stage.foliage];
      wilt.value = amount;
      // The lawn dries with the foliage; the earth is dry only once the garden has died.
      const isDeadEarth = stage.count === 0 && stage.foliage === 3;
      for (const { material, source } of tinted) {
        if (source.colorAlt === null) continue;
        const towards = source.tint === 'wilt' ? amount : isDeadEarth ? 1 : 0;
        material.color.copy(lerpedColor(source.color, source.colorAlt, towards));
      }
      return true;
    },
    showGrowth(growing) {
      const stage = shownStage;
      const fits = growing !== null && stage !== null && growing.hizb === stage.count + 1;
      const key = fits ? `${shownKey}|${growing.hizb}` : '';
      if (growth?.key !== key) {
        growth?.view?.dispose();
        growth =
          fits && stage !== null ? { key, view: buildGrowthView(growthResources, stage) } : null;
        growthValue = -1;
      }
      const value = fits ? growing.growth : -1;
      if (value === growthValue) return false;
      growthValue = value;
      growth?.view?.update(value);
      return true;
    },
    setOrbit(orbit, aspect, anchor = 'bottom') {
      fade.setWidth(edgeFadeWidth(orbit.zoom), aspect);
      const frame = frustumOf(orbit, aspect, anchor);
      camera.left = frame.left;
      camera.right = frame.right;
      camera.top = frame.top;
      camera.bottom = frame.bottom;
      const [x, y, z] = cameraDirection(orbit);
      camera.position.set(
        target.x + x * distance,
        target.y + y * distance,
        target.z + z * distance,
      );
      camera.up.set(0, 1, 0);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
    },
    dispose() {
      growth?.view?.dispose();
      growth = null;
      for (const item of disposables) item.dispose();
    },
  };
}
