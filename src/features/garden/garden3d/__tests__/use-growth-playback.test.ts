import { renderHook, waitFor } from '@testing-library/react-native';

import type { GardenState } from '@/domain/garden';
import { createMemoryStorage } from '@/data/storage/memory-storage';

import { previewGardenState } from '../../garden-preview';
import { plantKey, readGrowthMemory, shownGrowth } from '../../growth-motion';
import { GROWTH_MEMORY_KEY, useGrowthPlayback, type GrowthSink } from '../use-growth-playback';

function gardenGrowing(hizbCompleted: number, growth: number): GardenState {
  const base = previewGardenState({ hizbCompleted });
  if (base.nextElement === null) throw new Error('nothing grows');
  return { ...base, nextElement: { ...base.nextElement, growth } };
}

function sink() {
  const calls: { kind: 'set' | 'play'; value: unknown }[] = [];
  const target: GrowthSink = {
    setGrowth: (value) => calls.push({ kind: 'set', value }),
    playGrowth: (value) => calls.push({ kind: 'play', value }),
  };
  return { target, calls, plays: () => calls.filter((call) => call.kind === 'play') };
}

const options = { remembers: true, isActive: true, isReady: true, isMotionReduced: false };

describe('useGrowthPlayback', () => {
  it('plays the growth since the plant was last shown, once, and remembers it', async () => {
    const storage = createMemoryStorage();
    const cycle = gardenGrowing(24, 0.3).variant.cycle;
    await storage.setItem(GROWTH_MEMORY_KEY, JSON.stringify({ plants: { [`${cycle}:25`]: 0.1 } }));
    const { target, plays } = sink();

    const { rerender } = await renderHook(
      ({ state }: { state: GardenState }) =>
        useGrowthPlayback(target, state, { ...options, storage }),
      { initialProps: { state: gardenGrowing(24, 0.3) } },
    );

    await waitFor(() => expect(plays()).toHaveLength(1));
    expect(plays()[0]?.value).toEqual([
      { plant: plantKey(cycle, 25), hizb: 25, from: 0.1, to: 0.3 },
    ]);
    await waitFor(async () =>
      expect(
        shownGrowth(
          readGrowthMemory(await storage.getItem(GROWTH_MEMORY_KEY)),
          plantKey(cycle, 25),
        ),
      ).toBe(0.3),
    );
    // Shown again with no new page: nothing plays again.
    await rerender({ state: gardenGrowing(24, 0.3) });
    expect(plays()).toHaveLength(1);
  });

  it('waits for the screen to be in front and the 3D garden drawn', async () => {
    const storage = createMemoryStorage();
    const { target, plays, calls } = sink();
    const { rerender } = await renderHook(
      ({ isActive }: { isActive: boolean }) =>
        useGrowthPlayback(target, gardenGrowing(24, 0.4), { ...options, isActive, storage }),
      { initialProps: { isActive: false } },
    );
    await waitFor(() => expect(calls.length).toBeGreaterThan(1));
    expect(plays()).toHaveLength(0);
    // Until then, the plant as it was last shown: here never, so from the ground.
    expect(calls[calls.length - 1]).toEqual({ kind: 'set', value: { hizb: 25, growth: 0 } });

    await rerender({ isActive: true });
    await waitFor(() => expect(plays()).toHaveLength(1));
  });

  it('with Reduce Motion, shows the plant at its growth at once', async () => {
    const storage = createMemoryStorage();
    const { target, plays, calls } = sink();
    await renderHook(() =>
      useGrowthPlayback(target, gardenGrowing(24, 0.4), {
        ...options,
        isMotionReduced: true,
        storage,
      }),
    );
    await waitFor(() =>
      expect(calls[calls.length - 1]).toEqual({ kind: 'set', value: { hizb: 25, growth: 0.4 } }),
    );
    expect(plays()).toHaveLength(0);
  });

  it("a friend's garden: the plant at its growth, nothing played, nothing kept", async () => {
    const storage = createMemoryStorage();
    const { target, plays, calls } = sink();
    await renderHook(() =>
      useGrowthPlayback(target, gardenGrowing(24, 0.4), {
        ...options,
        remembers: false,
        storage: null,
      }),
    );
    expect(calls[calls.length - 1]).toEqual({ kind: 'set', value: { hizb: 25, growth: 0.4 } });
    expect(plays()).toHaveLength(0);
    expect(await storage.getItem(GROWTH_MEMORY_KEY)).toBeNull();
  });

  it('no page counted yet: nothing grows on screen', async () => {
    const { target, calls } = sink();
    await renderHook(() =>
      useGrowthPlayback(target, gardenGrowing(24, 0), {
        ...options,
        storage: createMemoryStorage(),
      }),
    );
    expect(calls[calls.length - 1]).toEqual({ kind: 'set', value: null });
  });
});
