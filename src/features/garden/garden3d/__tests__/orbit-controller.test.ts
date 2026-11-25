import { DEFAULT_ORBIT, isOrbitDefault } from '../camera-rig';
import { GARDEN_3D } from '../config';
import { OrbitController, type FrameScheduler } from '../orbit-controller';

/** A frame clock driven by the test: `advance(ms)` runs the frames of that time. */
function fakeFrames() {
  let now = 0;
  let next = 1;
  const waiting = new Map<number, (time: number) => void>();
  const scheduler: FrameScheduler = {
    now: () => now,
    request: (callback) => {
      const id = next;
      next += 1;
      waiting.set(id, callback);
      return id;
    },
    cancel: (id) => {
      waiting.delete(id);
    },
  };
  return {
    scheduler,
    advance(ms: number, step = 16) {
      for (let t = 0; t < ms; t += step) {
        now += step;
        const due = [...waiting.values()];
        waiting.clear();
        for (const callback of due) callback(now);
      }
    },
    isIdle: () => waiting.size === 0,
  };
}

const SIZE = { width: 390, height: 272 };

function controller(options: { isMotionReduced?: boolean } = {}) {
  const frames = fakeFrames();
  const changes = { count: 0 };
  const uses = { count: 0 };
  const orbit = new OrbitController({
    size: () => SIZE,
    onChange: () => {
      changes.count += 1;
    },
    onUse: () => {
      uses.count += 1;
    },
    isMotionReduced: () => options.isMotionReduced ?? false,
    frames: frames.scheduler,
  });
  return { orbit, frames, changes, uses };
}

describe('OrbitController: drag', () => {
  it('turns the garden with the finger and tells that it was used', () => {
    const { orbit, changes, uses } = controller();
    orbit.dragStart();
    orbit.dragMove(80, 0);
    expect(orbit.orbit.azimuth).toBeLessThan(0);
    expect(changes.count).toBe(1);
    expect(uses.count).toBe(1);
  });

  it('goes on turning after a fling, slower and slower, then stops', () => {
    const { orbit, frames } = controller();
    orbit.dragStart();
    orbit.dragMove(40, 0);
    orbit.dragEnd(800, false);
    const atRelease = orbit.orbit.azimuth;
    frames.advance(100);
    const after100 = orbit.orbit.azimuth;
    frames.advance(100);
    const after200 = orbit.orbit.azimuth;
    expect(after100).toBeLessThan(atRelease);
    // Slowing down: the second 100 ms turn less than the first.
    expect(Math.abs(after200 - after100)).toBeLessThan(Math.abs(after100 - atRelease));
    frames.advance(10000);
    expect(frames.isIdle()).toBe(true);
  });

  it('stops a spinning garden at a touch', () => {
    const { orbit, frames } = controller();
    orbit.dragStart();
    orbit.dragEnd(2000, false);
    frames.advance(50);
    orbit.touch();
    const caught = orbit.orbit.azimuth;
    frames.advance(500);
    expect(orbit.orbit.azimuth).toBe(caught);
    expect(frames.isIdle()).toBe(true);
  });

  it('does not spin after a fling with Reduce Motion', () => {
    const { orbit, frames } = controller({ isMotionReduced: true });
    orbit.dragStart();
    orbit.dragMove(40, 0);
    orbit.dragEnd(2000, false);
    const atRelease = orbit.orbit.azimuth;
    frames.advance(500);
    expect(orbit.orbit.azimuth).toBe(atRelease);
  });

  it('glides back inside the tilt limits after a drag past them', () => {
    const { orbit, frames } = controller();
    orbit.dragStart();
    orbit.dragMove(0, 3000);
    expect(orbit.orbit.elevation).toBeGreaterThan(GARDEN_3D.elevation.max);
    orbit.dragEnd(0, false);
    frames.advance(1000);
    expect(orbit.orbit.elevation).toBeCloseTo(GARDEN_3D.elevation.max, 5);
  });

  it('jumps back inside the limits at once with Reduce Motion', () => {
    const { orbit } = controller({ isMotionReduced: true });
    orbit.dragStart();
    orbit.dragMove(0, 3000);
    orbit.dragEnd(0, false);
    expect(orbit.orbit.elevation).toBeCloseTo(GARDEN_3D.elevation.max, 5);
  });
});

describe('OrbitController: pinch', () => {
  it('zooms with the fingers and settles inside the zoom limits', () => {
    const { orbit, frames, uses } = controller();
    orbit.pinchStart({ x: 195, y: 136 });
    orbit.pinchMove(5, { x: 195, y: 136 });
    expect(orbit.orbit.zoom).toBeGreaterThan(GARDEN_3D.zoom.max);
    orbit.pinchEnd();
    frames.advance(1000);
    expect(orbit.orbit.zoom).toBeCloseTo(GARDEN_3D.zoom.max, 5);
    expect(uses.count).toBe(1);
  });
});

describe('OrbitController: double tap', () => {
  it('zooms in on the default view', () => {
    const { orbit, frames } = controller();
    orbit.doubleTap({ x: 195, y: 136 });
    frames.advance(1000);
    expect(orbit.orbit.zoom).toBeCloseTo(GARDEN_3D.zoom.doubleTap, 5);
  });

  it('brings any other view back to the default', () => {
    const { orbit, frames } = controller();
    orbit.dragStart();
    orbit.dragMove(100, 30);
    orbit.dragEnd(0, false);
    frames.advance(1000);
    orbit.doubleTap({ x: 10, y: 10 });
    frames.advance(1000);
    expect(isOrbitDefault(orbit.orbit)).toBe(true);
  });
});

describe('OrbitController: VoiceOver actions', () => {
  it('turns by a quarter, and two quick actions add up', () => {
    const { orbit, frames } = controller();
    orbit.turnBy(GARDEN_3D.accessibilityTurn);
    orbit.turnBy(GARDEN_3D.accessibilityTurn);
    frames.advance(2000);
    expect(orbit.orbit.azimuth).toBeCloseTo(Math.PI, 3);
  });

  it('goes back to the default view', () => {
    const { orbit } = controller({ isMotionReduced: true });
    orbit.turnBy(1);
    orbit.reset();
    expect(orbit.orbit).toEqual(DEFAULT_ORBIT);
  });

  it('stops every frame when disposed', () => {
    const { orbit, frames } = controller();
    orbit.turnBy(1);
    orbit.dispose();
    expect(frames.isIdle()).toBe(true);
  });
});
