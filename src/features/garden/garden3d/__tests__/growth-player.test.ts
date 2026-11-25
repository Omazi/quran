import { plantKey, type GrowthSegment } from '../../growth-motion';
import {
  frameAt,
  GrowthPlayer,
  MAX_PLAY_MS,
  segmentDurations,
  type ShownGrowthFrame,
} from '../growth-player';
import { fakeFrames } from '../test-support/fake-frames';

const segment = (hizb: number, from: number, to: number): GrowthSegment => ({
  plant: plantKey(1, hizb),
  hizb,
  from,
  to,
});

describe('the growth played in the render loop', () => {
  it('goes from the growth shown to the new one, frame after frame, then stops', () => {
    const frames = fakeFrames();
    const seen: ShownGrowthFrame[] = [];
    let done = 0;
    const player = new GrowthPlayer({
      frames: frames.scheduler,
      onFrame: (frame) => seen.push(frame),
      onDone: () => (done += 1),
    });

    player.play([segment(25, 0.2, 0.5)]);
    expect(seen[0]).toEqual({ hizb: 25, growth: 0.2 });
    frames.advance(700);
    expect(player.isPlaying).toBe(true);
    const middle = seen[seen.length - 1]?.growth ?? 0;
    expect(middle).toBeGreaterThan(0.3);
    expect(middle).toBeLessThan(0.5);
    frames.advance(2000);

    expect(seen[seen.length - 1]).toEqual({ hizb: 25, growth: 0.5 });
    expect(done).toBe(1);
    expect(frames.isIdle()).toBe(true);
    // Never backwards on the way.
    for (let k = 1; k < seen.length; k += 1) {
      expect(seen[k]!.growth).toBeGreaterThanOrEqual(seen[k - 1]!.growth);
    }
  });

  it('ends a plant whose hizb was finished, then grows the next from its sprout', () => {
    const durations = segmentDurations([segment(25, 0.8, 1), segment(26, 0, 0.1)]);
    expect(frameAt([segment(25, 0.8, 1), segment(26, 0, 0.1)], durations, 0).frame).toEqual({
      hizb: 25,
      growth: 0.8,
    });
    const afterFirst = frameAt(
      [segment(25, 0.8, 1), segment(26, 0, 0.1)],
      durations,
      (durations[0] ?? 0) + 1,
    );
    expect(afterFirst.frame?.hizb).toBe(26);
    expect(frameAt([segment(25, 0.8, 1)], durations, 99999)).toEqual({
      frame: { hizb: 25, growth: 1 },
      isOver: true,
    });
  });

  it('never makes the person wait long: two growths together stay short', () => {
    const durations = segmentDurations([segment(25, 0, 1), segment(26, 0, 0.9)]);
    expect(durations.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(MAX_PLAY_MS);
  });

  it('a new growth replaces the one playing', () => {
    const frames = fakeFrames();
    const seen: ShownGrowthFrame[] = [];
    const player = new GrowthPlayer({ frames: frames.scheduler, onFrame: (f) => seen.push(f) });
    player.play([segment(25, 0.2, 0.5)]);
    frames.advance(200);
    player.play([segment(25, 0.3, 0.6)]);
    expect(player.destination?.to).toBe(0.6);
    frames.advance(4000);
    expect(seen[seen.length - 1]).toEqual({ hizb: 25, growth: 0.6 });
    player.stop();
    expect(player.isPlaying).toBe(false);
  });
});
