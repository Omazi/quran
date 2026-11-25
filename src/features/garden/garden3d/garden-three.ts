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
import { cameraDirection, frustumOf, type Orbit } from './camera-rig';
import { GARDEN_3D } from './config';
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
  setOrbit(orbit: Orbit, aspect: number): void;
  dispose(): void;
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
  const materialOf = (source: ModelMaterial): THREE.MeshLambertMaterial => {
    const cached = materialCache.get(source);
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
    if (source.wilts) {
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uWilt = wilt;
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float uWilt;')
          .replace('#include <color_fragment>', WILT_CHUNK);
      };
      material.customProgramCacheKey = () => 'garden-wilt';
    }
    if (source.tint !== null) tinted.push({ material, source });
    materialCache.set(source, material);
    disposables.push(material);
    return material;
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
    const geometry = geometryOf(source);
    disposables.push(geometry);
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

  let shownKey = '';
  return {
    scene,
    camera,
    showStage(stage) {
      const key = `${stage.count}-${stage.water}-${stage.foliage}`;
      if (key === shownKey) return false;
      shownKey = key;
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
    setOrbit(orbit, aspect) {
      const frame = frustumOf(orbit, aspect);
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
      for (const item of disposables) item.dispose();
    },
  };
}
