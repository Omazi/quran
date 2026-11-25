import type { FrameScheduler } from '../orbit-controller';

/** A frame clock driven by the test: `advance(ms)` runs the frames of that time. */
export function fakeFrames() {
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
