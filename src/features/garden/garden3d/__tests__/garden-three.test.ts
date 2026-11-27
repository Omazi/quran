import * as THREE from 'three';

import type { GardenStage } from '../../garden-picture';
import { DEFAULT_ORBIT } from '../camera-rig';
import { GARDEN_3D } from '../config';
import { readGardenModel } from '../garden-model';
import { buildGardenThree } from '../garden-three';
import { parseGlb } from '../glb';
import { shippedGardenBytes } from '../test-support/shipped-model';
import { skyStateAt } from '../../sky/sky-state';

// Building the scene needs no GL context: only drawing does.
const MODEL = readGardenModel(parseGlb(shippedGardenBytes()));

const stage = (count: number, water: 0 | 1 | 2, foliage: 0 | 1 | 2 | 3): GardenStage => ({
  count,
  water,
  foliage,
});

/** The garden's own meshes: not those of its life (fireflies, leaves, birds: life-three.ts). */
function meshes(scene: THREE.Scene): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  const life = scene.getObjectByName('garden-life');
  scene.traverse((object) => {
    let inLife = false;
    object.traverseAncestors((ancestor) => {
      if (ancestor === life) inLife = true;
    });
    if (object instanceof THREE.Mesh && object !== life && !inLife) found.push(object);
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

describe('the element growing with the hizb in progress', () => {
  const growingGroup = (three: ReturnType<typeof buildGardenThree>) =>
    three.scene.getObjectByName('growing-element');
  const visibleMeshes = (object: THREE.Object3D | undefined): THREE.Mesh[] => {
    const found: THREE.Mesh[] = [];
    object?.traverse((child) => {
      if (child instanceof THREE.Mesh && child.visible) found.push(child);
    });
    return found;
  };

  it('one page: the seed mound and its sprout only', () => {
    const three = buildGardenThree(MODEL);
    three.showStage(stage(4, 2, 0));
    expect(three.showGrowth({ hizb: 5, growth: 0.1 })).toBe(true);
    const shown = visibleMeshes(growingGroup(three));
    expect(shown.length).toBe((MODEL.props.sprout ?? []).length);
    three.dispose();
  });

  it('then the tree itself, its trunk first, and at the end exactly the tree of the next stage', () => {
    const three = buildGardenThree(MODEL);
    three.showStage(stage(4, 2, 0));
    three.showGrowth({ hizb: 5, growth: 0.3 });
    const young = visibleMeshes(growingGroup(three)).map((mesh) => mesh.material);
    expect(young.length).toBeGreaterThan(0);
    three.showGrowth({ hizb: 5, growth: 1 });
    const grown = visibleMeshes(growingGroup(three));
    // Two pieces, trunk and leaves, each at the very place the stage draws them.
    expect(grown.length).toBe(2);
    for (const mesh of grown) expect(mesh.matrix.determinant()).toBeGreaterThan(0);
    three.dispose();
  });

  it('nothing when the stage does not show every element before it', () => {
    const three = buildGardenThree(MODEL);
    three.showStage(stage(3, 2, 0));
    three.showGrowth({ hizb: 5, growth: 0.5 });
    expect(growingGroup(three)).toBeUndefined();
    three.showStage(stage(4, 2, 0));
    three.showGrowth({ hizb: 5, growth: 0.5 });
    expect(growingGroup(three)).toBeDefined();
    three.showGrowth(null);
    expect(growingGroup(three)).toBeUndefined();
    three.dispose();
  });

  it('nothing changes when the same growth is shown again', () => {
    const three = buildGardenThree(MODEL);
    three.showStage(stage(4, 2, 0));
    expect(three.showGrowth({ hizb: 5, growth: 0.4 })).toBe(true);
    expect(three.showGrowth({ hizb: 5, growth: 0.4 })).toBe(false);
    three.dispose();
  });
});

describe('the living garden (maquette-wow, validated 27 November 2026)', () => {
  it('is still by default: the garden of the pictures, no life, no sky drawn behind it', () => {
    const garden = buildGardenThree(MODEL);
    expect(garden.scene.getObjectByName('garden-life')?.visible).toBe(false);
    expect(garden.backdrop.isVisible()).toBe(false);
  });

  it('comes alive on the home screen: its life shows and the sky is drawn behind it', () => {
    const garden = buildGardenThree(MODEL);
    garden.setLiving(true);
    expect(garden.scene.getObjectByName('garden-life')?.visible).toBe(true);
    expect(garden.backdrop.isVisible()).toBe(true);
  });

  it('takes the light of the hour, and asks for new shadows only when the sun moved', () => {
    const garden = buildGardenThree(MODEL);
    const night = skyStateAt(22.5);
    expect(garden.setSky(night)).toBe(true);
    const hemisphere = garden.scene.children.find((c) => c instanceof THREE.HemisphereLight);
    expect((hemisphere as THREE.HemisphereLight).intensity).toBeCloseTo(night.hemiIntensity);
    expect(garden.setSky(night)).toBe(false);
    expect(garden.setSky(skyStateAt(9))).toBe(true);
  });

  it('moves the sun a little with the tilt, and says how far from where the shadows were drawn', () => {
    const garden = buildGardenThree(MODEL);
    garden.setSky(skyStateAt(13));
    expect(garden.setTilt({ x: 0, y: 0 })).toBe(0);
    const moved = garden.setTilt({ x: 0.5, y: 0 });
    expect(moved).toBeCloseTo(4.5, 3);
    garden.markShadowsDrawn();
    expect(garden.setTilt({ x: 0.5, y: 0 })).toBe(0);
  });

  it('knows where the growing element stands, for the return glide', () => {
    const garden = buildGardenThree(MODEL);
    expect(garden.growthFocus()).toBeNull();
    garden.showStage({ count: 4, water: 2, foliage: 0 });
    garden.showGrowth({ hizb: 5, growth: 0.3 });
    const focus = garden.growthFocus();
    expect(focus).not.toBeNull();
    expect(focus?.[1]).toBe(0);
    // Inside the 18 m plot.
    expect(Math.abs(focus?.[0] ?? 99)).toBeLessThan(9);
    expect(Math.abs(focus?.[2] ?? 99)).toBeLessThan(9);
  });

  it('moves with time without throwing, its life and its sky', () => {
    const garden = buildGardenThree(MODEL);
    garden.setLiving(true);
    garden.setSky(skyStateAt(22.5));
    garden.setLife({ fireflies: 34, leaves: 9, butterflies: 4, birds: 5 });
    garden.setView(393, 852, 3);
    for (let k = 1; k <= 120; k += 1) garden.tick(k / 60, 1 / 60);
    expect(garden.isRippling()).toBe(false);
    garden.showStage({ count: 4, water: 2, foliage: 0 });
    garden.showGrowth({ hizb: 5, growth: 0.3 });
    garden.rippleAtGrowth(2);
    garden.tick(2.1, 0.1);
    expect(garden.isRippling()).toBe(true);
    garden.tick(5, 0.05);
    expect(garden.isRippling()).toBe(false);
    garden.dispose();
  });
});
