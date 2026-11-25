import type { ExpoWebGLRenderingContext } from 'expo-gl';
import type * as THREE from 'three';

import { gardenStage } from '../../garden-picture';
import { previewGardenState } from '../../garden-preview';

import { plantKey } from '../../growth-motion';
import { readGardenModel, type GardenModel } from '../garden-model';
import { GardenSurface } from '../garden-surface';
import { parseGlb } from '../glb';
import { fakeFrames } from '../test-support/fake-frames';
import { shippedGardenBytes } from '../test-support/shipped-model';

// No GL here: the renderer is a stand-in that counts the frames drawn; the scene is the real one.
const drawn: THREE.Scene[] = [];
jest.mock('../garden-renderer', () => ({
  createGardenRenderer: () => ({ shadowMap: { needsUpdate: false }, dispose: () => undefined }),
  drawFrame: (_renderer: unknown, _gl: unknown, scene: THREE.Scene) => drawn.push(scene),
}));

const MODEL = readGardenModel(parseGlb(shippedGardenBytes()));
const GL = {} as never;

function surface() {
  const frames = fakeFrames();
  const view = new GardenSurface({
    onReady: () => undefined,
    onFail: (error) => {
      throw error;
    },
    frames: frames.scheduler,
  });
  view.setSize({ width: 390, height: 272 });
  return { view, frames };
}

const growing = (scene: THREE.Scene | undefined) => scene?.getObjectByName('growing-element');

describe('the 3D garden plays the growth in its render loop', () => {
  beforeEach(() => {
    drawn.length = 0;
  });

  it('draws a frame per step of the growth, then nothing once it is over', () => {
    const { view, frames } = surface();
    view.attach(GL, MODEL);
    view.setStage({ count: 4, water: 2, foliage: 0 });
    view.setGrowth({ hizb: 5, growth: 0.2 });
    const before = drawn.length;

    view.playGrowth([{ plant: plantKey(1, 5), hizb: 5, from: 0.2, to: 0.6 }]);
    frames.advance(3000);
    const during = drawn.length - before;
    expect(during).toBeGreaterThan(30);
    frames.advance(1000);
    expect(drawn.length - before).toBe(during);
    expect(frames.isIdle()).toBe(true);
    view.dispose();
  });

  it('a plant whose hizb was just finished ends its growth before the stage takes it back', () => {
    const { view, frames } = surface();
    view.attach(GL, MODEL);
    // The hizb of element 5 is finished: the stage already counts it.
    view.setStage({ count: 5, water: 2, foliage: 0 });
    view.playGrowth([
      { plant: plantKey(1, 5), hizb: 5, from: 0.8, to: 1 },
      { plant: plantKey(1, 6), hizb: 6, from: 0, to: 0.1 },
    ]);
    // The tree of element 5 is the growing element, not part of the stage, while it ends.
    expect(growing(drawn[drawn.length - 1])).toBeDefined();
    frames.advance(5000);
    // Over: the stage draws the tree, and the next element grows (its sprout).
    const last = drawn[drawn.length - 1];
    expect(growing(last)).toBeDefined();
    view.dispose();
  });

  it('a growth set at once while the same one plays does not stop it', () => {
    const { view, frames } = surface();
    view.attach(GL, MODEL);
    view.setStage({ count: 4, water: 2, foliage: 0 });
    view.playGrowth([{ plant: plantKey(1, 5), hizb: 5, from: 0.2, to: 0.6 }]);
    frames.advance(300);
    view.setGrowth({ hizb: 5, growth: 0.6 });
    expect(frames.isIdle()).toBe(false);
    view.setGrowth({ hizb: 5, growth: 0.3 });
    expect(frames.isIdle()).toBe(true);
    view.dispose();
  });
});

/** A GL context that records every call: none may come once the surface is disposed. */
function recordingGl() {
  const calls: string[] = [];
  const gl = new Proxy(
    {},
    {
      get: (_target, key) => {
        calls.push(String(key));
        return () => undefined;
      },
    },
  ) as ExpoWebGLRenderingContext;
  return { gl, calls };
}

const EMPTY_MODEL = {} as GardenModel;

describe('GardenSurface once its view is gone', () => {
  it('ignores a GL context that arrives after the screen closed: nothing built, nothing told', () => {
    const onReady = jest.fn();
    const onFail = jest.fn();
    const surface = new GardenSurface({ onReady, onFail });
    surface.dispose();
    const { gl, calls } = recordingGl();
    surface.attach(gl, EMPTY_MODEL);
    expect(calls).toEqual([]);
    expect(onReady).not.toHaveBeenCalled();
    expect(onFail).not.toHaveBeenCalled();
  });

  it('draws nothing when its size, stage or orbit change after it was disposed', () => {
    const onFail = jest.fn();
    const surface = new GardenSurface({ onReady: jest.fn(), onFail });
    surface.dispose();
    surface.setSize({ width: 390, height: 272 });
    surface.setStage(gardenStage(previewGardenState({ hizbCompleted: 12 })));
    surface.controller.turnBy(1);
    surface.draw();
    expect(onFail).not.toHaveBeenCalled();
  });
});
