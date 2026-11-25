import { act, renderHook } from '@testing-library/react-native';

import { hasLaunchPlayed, resetLaunchSession } from '../launch-session';
import { fadeOutDuration, settledAt, shortestLaunch } from '../launch-timeline';
import { useLaunch } from '../use-launch';

async function setup(initial: { isReady: boolean; reducedMotion?: boolean }) {
  const hideSplash = jest.fn();
  const readReducedMotion = jest.fn(() => Promise.resolve(initial.reducedMotion ?? false));
  const hook = await renderHook(
    ({ isReady }: { isReady: boolean }) => useLaunch({ isReady, hideSplash, readReducedMotion }),
    { initialProps: { isReady: initial.isReady } },
  );
  return { ...hook, hideSplash, readReducedMotion };
}

/** Lets the device answer about Reduce Motion, then the first frame of the overlay lay out. */
async function layOut(result: { current: ReturnType<typeof useLaunch> }) {
  await act(async () => {
    result.current.onLayout();
  });
}

/** Lets the whole launch run: the mark settles, then the overlay fades out. */
async function playThrough(motion: 'full' | 'reduced') {
  await act(async () => {
    jest.advanceTimersByTime(settledAt(motion));
  });
  await act(async () => {
    jest.advanceTimersByTime(fadeOutDuration(motion));
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  resetLaunchSession();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('useLaunch', () => {
  it('shows no overlay when it is skipped (the iOS check), and still hides the native screen', async () => {
    const hideSplash = jest.fn();
    const { result } = await renderHook(() =>
      useLaunch({
        isReady: true,
        hideSplash,
        readReducedMotion: () => Promise.resolve(false),
        isSkipped: true,
      }),
    );
    expect(result.current.isShown).toBe(false);
    expect(hideSplash).toHaveBeenCalledTimes(1);
  });

  it('shows the overlay at once and keeps the native launch screen until it is laid out', async () => {
    const { result, hideSplash } = await setup({ isReady: false });
    expect(result.current.isShown).toBe(true);
    expect(hideSplash).not.toHaveBeenCalled();
    await layOut(result);
    expect(hideSplash).toHaveBeenCalledTimes(1);
  });

  it('hides the native launch screen once, however often the overlay lays out', async () => {
    const { result, hideSplash } = await setup({ isReady: false });
    await layOut(result);
    await layOut(result);
    expect(hideSplash).toHaveBeenCalledTimes(1);
  });

  it('does not start before the device has said whether motion is reduced', async () => {
    let answer: (value: boolean) => void = () => undefined;
    const hideSplash = jest.fn();
    const { result } = await renderHook(() =>
      useLaunch({
        isReady: true,
        hideSplash,
        readReducedMotion: () => new Promise<boolean>((resolve) => (answer = resolve)),
      }),
    );
    await layOut(result);
    expect(result.current.motion).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.current.isShown).toBe(true);
    await act(async () => {
      answer(false);
    });
    expect(result.current.motion).toBe('full');
  });

  it('plays the full animation, then leaves after its shortest time when the app is ready', async () => {
    const { result } = await setup({ isReady: true });
    await layOut(result);
    expect(result.current.motion).toBe('full');
    expect(result.current.phase).toBe('playing');

    await act(async () => {
      jest.advanceTimersByTime(settledAt('full') - 1);
    });
    expect(result.current.phase).toBe('playing');
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.phase).toBe('leaving');

    await act(async () => {
      jest.advanceTimersByTime(fadeOutDuration('full') - 1);
    });
    expect(result.current.isShown).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.isShown).toBe(false);
    expect(shortestLaunch('full')).toBe(settledAt('full') + fadeOutDuration('full'));
  });

  it('keeps the finished mark until the app is ready, and leaves as soon as it is', async () => {
    const { result, rerender } = await setup({ isReady: false });
    await layOut(result);
    await act(async () => {
      jest.advanceTimersByTime(settledAt('full') + 3000);
    });
    expect(result.current.phase).toBe('playing');
    await rerender({ isReady: true });
    expect(result.current.phase).toBe('leaving');
    await act(async () => {
      jest.advanceTimersByTime(fadeOutDuration('full'));
    });
    expect(result.current.isShown).toBe(false);
  });

  it('does not leave before the mark is complete, even when the app is ready sooner', async () => {
    const { result, rerender } = await setup({ isReady: false });
    await layOut(result);
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await rerender({ isReady: true });
    expect(result.current.phase).toBe('playing');
    await act(async () => {
      jest.advanceTimersByTime(settledAt('full') - 300);
    });
    expect(result.current.phase).toBe('leaving');
  });

  it('only cross-fades with Reduce Motion, and quickly', async () => {
    const { result } = await setup({ isReady: true, reducedMotion: true });
    await layOut(result);
    expect(result.current.motion).toBe('reduced');
    await playThrough('reduced');
    expect(result.current.isShown).toBe(false);
    expect(shortestLaunch('reduced')).toBeLessThan(shortestLaunch('full') / 2);
  });

  it('plays once per cold start: a second mount shows nothing', async () => {
    const first = await setup({ isReady: true });
    await layOut(first.result);
    await playThrough('full');
    expect(first.result.current.isShown).toBe(false);
    expect(hasLaunchPlayed()).toBe(true);
    await first.unmount();

    const second = await setup({ isReady: false });
    expect(second.result.current.isShown).toBe(false);
    expect(second.readReducedMotion).not.toHaveBeenCalled();
  });

  it('still hides the native launch screen when it never gets to lay the overlay out', async () => {
    const { hideSplash, rerender } = await setup({ isReady: false });
    expect(hideSplash).not.toHaveBeenCalled();
    await rerender({ isReady: true });
    expect(hideSplash).toHaveBeenCalledTimes(1);
  });

  it('hides the native launch screen when the animation has already played', async () => {
    const first = await setup({ isReady: true });
    await layOut(first.result);
    await playThrough('full');
    await first.unmount();
    const second = await setup({ isReady: false });
    expect(second.hideSplash).not.toHaveBeenCalled();
    await second.rerender({ isReady: true });
    expect(second.hideSplash).toHaveBeenCalledTimes(1);
  });

  it('treats a device that cannot answer as motion allowed', async () => {
    const hideSplash = jest.fn();
    const { result } = await renderHook(() =>
      useLaunch({
        isReady: true,
        hideSplash,
        readReducedMotion: () => Promise.reject(new Error('x')),
      }),
    );
    await layOut(result);
    expect(result.current.motion).toBe('full');
  });
});
