import type * as THREE from 'three';

import { plantKey } from '../../growth-motion';
import { skyStateAt } from '../../sky/sky-state';
import { DEFAULT_ORBIT } from '../camera-rig';
import { GARDEN_3D } from '../config';
import { readGardenModel } from '../garden-model';
import { GardenSurface, type GardenSurfaceOptions } from '../garden-surface';
import { parseGlb } from '../glb';
import { fakeFrames } from '../test-support/fake-frames';
import { shippedGardenBytes } from '../test-support/shipped-model';

// No GL here: the renderer is a stand-in that counts the frames drawn; the scene is the real one.
const drawn: THREE.Scene[] = [];
jest.mock('../garden-renderer', () => ({
  createGardenRenderer: () => ({ shadowMap: { needsUpdate: false }, dispose: () => undefined }),
  drawFrame: (_renderer: unknown, _gl: unknown, scene: THREE.Scene) => {
    drawn.push(scene);
    return true;
  },
}));

const MODEL = readGardenModel(parseGlb(shippedGardenBytes()));
const GL = { drawingBufferWidth: 786, drawingBufferHeight: 1704 } as never;
const SEGMENTS = [{ plant: plantKey(1, 5), hizb: 5, from: 0.2, to: 0.5 }] as const;

function homeSurface(options: Partial<GardenSurfaceOptions> = {}) {
  const frames = fakeFrames();
  const onGrow = jest.fn();
  const onGlideChange = jest.fn();
  const view = new GardenSurface({
    onReady: () => undefined,
    onFail: (error) => {
      throw error;
    },
    anchor: 'stage',
    living: true,
    glides: true,
    onGrow,
    onGlideChange,
    frames: frames.scheduler,
    ...options,
  });
  view.setSize({ width: 393, height: 852 });
  view.setSky(skyStateAt(13));
  view.attach(GL, MODEL);
  view.setStage({ count: 4, water: 2, foliage: 0 });
  view.setGrowth({ hizb: 5, growth: 0.2 });
  return { view, frames, onGrow, onGlideChange };
}

describe('the living garden has one render loop, paused when it is not seen', () => {
  beforeEach(() => {
    drawn.length = 0;
  });

  it('draws every frame while the home screen is in front', () => {
    const { view, frames } = homeSurface();
    expect(view.isLooping).toBe(true);
    const before = drawn.length;
    frames.advance(1000);
    // About 60 frames in a second, one drawing each.
    expect(drawn.length - before).toBeGreaterThanOrEqual(55);
    expect(drawn.length - before).toBeLessThanOrEqual(65);
  });

  it('stops when the screen is not in front (the reader, the background), and starts again', () => {
    const { view, frames } = homeSurface();
    view.setActive(false);
    expect(view.isLooping).toBe(false);
    frames.advance(500);
    expect(frames.isIdle()).toBe(true);
    const before = drawn.length;
    frames.advance(1000);
    expect(drawn.length).toBe(before);
    view.setActive(true);
    expect(view.isLooping).toBe(true);
  });

  it('does not run with Reduce Motion: the garden stays still', () => {
    const { view, frames } = homeSurface();
    view.setMotionReduced(true);
    expect(view.isLooping).toBe(false);
    frames.advance(500);
    expect(frames.isIdle()).toBe(true);
  });

  it('never runs for a garden that is not alive (a friend’s), which draws only on change', () => {
    const { view, frames } = homeSurface({ living: false, glides: false });
    expect(view.isLooping).toBe(false);
    frames.advance(500);
    expect(frames.isIdle()).toBe(true);
  });

  it('stops for good once its view is gone', () => {
    const { view, frames } = homeSurface();
    view.dispose();
    frames.advance(200);
    expect(frames.isIdle()).toBe(true);
  });
});

describe('the return glide, when the garden grew (owner, 27 November 2026)', () => {
  it('goes to the plant, grows it once with the feedback, and comes back', () => {
    const { view, frames, onGrow, onGlideChange } = homeSurface();
    view.playGrowth(SEGMENTS);
    expect(view.isGliding).toBe(true);
    expect(onGlideChange).toHaveBeenLastCalledWith(true);
    expect(onGrow).not.toHaveBeenCalled();

    frames.advance(GARDEN_3D.glide.toMs + 50);
    expect(view.controller.orbit.zoom).toBeCloseTo(GARDEN_3D.glide.zoom, 3);
    expect(onGrow).toHaveBeenCalledTimes(1);

    const { growMaxMs, holdMs, backMs } = GARDEN_3D.glide;
    frames.advance(growMaxMs + holdMs + backMs + 200);
    expect(view.isGliding).toBe(false);
    expect(onGlideChange).toHaveBeenLastCalledWith(false);
    expect(view.controller.orbit).toEqual(DEFAULT_ORBIT);
    expect(onGrow).toHaveBeenCalledTimes(1);
  });

  it('takes about two seconds and a half from start to end', () => {
    const { view, frames } = homeSurface();
    view.playGrowth(SEGMENTS);
    let elapsed = 0;
    while (view.isGliding && elapsed < 6000) {
      frames.advance(16);
      elapsed += 16;
    }
    expect(elapsed).toBeGreaterThan(1800);
    expect(elapsed).toBeLessThan(3000);
  });

  it('stops at a touch: the plant takes its size at once and the camera comes back', () => {
    const { view, frames, onGrow, onGlideChange } = homeSurface();
    view.playGrowth(SEGMENTS);
    frames.advance(300);
    view.controller.fingerDown();
    expect(view.isGliding).toBe(false);
    expect(onGlideChange).toHaveBeenLastCalledWith(false);
    // Touched before it reached the plant: no growth on screen, so no feedback.
    expect(onGrow).not.toHaveBeenCalled();
    frames.advance(1500);
    expect(view.controller.orbit.zoom).toBeCloseTo(1, 3);
  });

  it('can be stopped from what floats over the garden too', () => {
    const { view } = homeSurface();
    view.playGrowth(SEGMENTS);
    view.interruptGlide();
    expect(view.isGliding).toBe(false);
  });

  it('ends at once, without moving, when the screen goes', () => {
    const { view } = homeSurface();
    view.playGrowth(SEGMENTS);
    view.setActive(false);
    expect(view.isGliding).toBe(false);
    expect(view.controller.orbit).toEqual(DEFAULT_ORBIT);
  });

  it('does not glide with Reduce Motion, nor on a garden that does not ask for it', () => {
    const reduced = homeSurface();
    reduced.view.setMotionReduced(true);
    reduced.view.playGrowth(SEGMENTS);
    expect(reduced.view.isGliding).toBe(false);

    const still = homeSurface({ glides: false });
    still.view.playGrowth(SEGMENTS);
    expect(still.view.isGliding).toBe(false);
    expect(still.onGrow).not.toHaveBeenCalled();
  });
});
