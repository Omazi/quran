import * as THREE from 'three';

import type { GardenStage } from '../../garden-picture';
import { DEFAULT_ORBIT } from '../camera-rig';
import { GARDEN_3D } from '../config';
import { readGardenModel } from '../garden-model';
import { buildGardenThree } from '../garden-three';
import { parseGlb } from '../glb';
import { shippedGardenBytes } from '../test-support/shipped-model';

// Building the scene needs no GL context: only drawing does.
const MODEL = readGardenModel(parseGlb(shippedGardenBytes()));

const stage = (count: number, water: 0 | 1 | 2, foliage: 0 | 1 | 2 | 3): GardenStage => ({
  count,
  water,
  foliage,
});

function meshes(scene: THREE.Scene): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) found.push(object);
  });
  return found;
}

/** Triangles a stage draws: what the renderer would count, without a renderer. */
function drawnTriangles(scene: THREE.Scene): number {
  let triangles = 0;
  for (const mesh of meshes(scene)) {
    if (!mesh.visible) continue;
    if (mesh instanceof THREE.InstancedMesh) {
      triangles += ((mesh.geometry.index?.count ?? 0) / 3) * mesh.count;
    } else {
      for (const group of mesh.geometry.groups) triangles += group.count / 3;
    }
  }
  return triangles;
}

describe('buildGardenThree: the edges dissolve into the page', () => {
  it('draws no fade at rest, and one once zoomed, whatever the theme (the view is transparent)', () => {
    const garden = buildGardenThree(MODEL);
    garden.setOrbit(DEFAULT_ORBIT, 1.4);
    expect(garden.fade.isVisible()).toBe(false);
    garden.setOrbit({ ...DEFAULT_ORBIT, zoom: 2 }, 1.4);
    expect(garden.fade.isVisible()).toBe(true);
    garden.dispose();
  });
});

describe('buildGardenThree', () => {
  it('makes one mesh per mesh of the model, with the light of the pictures', () => {
    const garden = buildGardenThree(MODEL);
    expect(meshes(garden.scene)).toHaveLength(MODEL.meshes.length);
    const sun = garden.scene.children.find((c) => c instanceof THREE.DirectionalLight);
    expect(sun?.castShadow).toBe(true);
    expect((sun as THREE.DirectionalLight).intensity).toBe(GARDEN_3D.light.sun.intensity);
    garden.dispose();
  });

  it('draws more of the garden as it grows', () => {
    const garden = buildGardenThree(MODEL);
    garden.showStage(stage(0, 0, 0));
    const bare = drawnTriangles(garden.scene);
    garden.showStage(stage(30, 2, 0));
    const half = drawnTriangles(garden.scene);
    garden.showStage(stage(60, 2, 0));
    const full = drawnTriangles(garden.scene);
    expect(bare).toBeLessThan(half);
    expect(half).toBeLessThan(full);
    garden.dispose();
  });

  it('says when a stage changes nothing, so that no frame is drawn for it', () => {
    const garden = buildGardenThree(MODEL);
    expect(garden.showStage(stage(12, 2, 0))).toBe(true);
    expect(garden.showStage(stage(12, 2, 0))).toBe(false);
    garden.dispose();
  });

  it('dries the lawn with the foliage, and the earth only when the garden has died', () => {
    const garden = buildGardenThree(MODEL);
    const material = (name: string) =>
      meshes(garden.scene).find((m) => m.name === name)?.material as THREE.MeshLambertMaterial[];
    garden.showStage(stage(8, 2, 0));
    const lawnGreen = material('lawn')[0]?.color.getHex();
    garden.showStage(stage(8, 0, 3));
    expect(material('lawn')[0]?.color.getHex()).not.toBe(lawnGreen);
    const earthAlive = material('earth')[0]?.color.getHex();
    garden.showStage(stage(0, 0, 3));
    expect(material('earth')[0]?.color.getHex()).not.toBe(earthAlive);
    garden.dispose();
  });

  it('places the camera of the pictures for the default orbit', () => {
    const garden = buildGardenThree(MODEL);
    garden.setOrbit(DEFAULT_ORBIT, 1170 / 816);
    const { camera } = garden;
    const [tx, ty, tz] = GARDEN_3D.picture.target;
    const direction = camera.position
      .clone()
      .sub(new THREE.Vector3(tx, ty, tz))
      .normalize();
    expect((Math.asin(direction.y) * 180) / Math.PI).toBeCloseTo(38, 4);
    expect((Math.atan2(direction.x, direction.z) * 180) / Math.PI).toBeCloseTo(45, 4);
    expect(camera.top - camera.bottom).toBeCloseTo(GARDEN_3D.frame.height, 4);
    garden.dispose();
  });
});
