import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { buildCompletedKhatmas, day } from '@/domain/khatm/__fixtures__/journal-builders';
import { AppStoreProvider } from '@/store';
import { createTestAppStore } from '@/store/test-support/test-store';

import { mayCelebrateOver, useKhatmaCelebration } from '../use-khatma-celebration';

let mockSegments: string[] = ['(tabs)'];
jest.mock('expo-router', () => ({ useSegments: () => mockSegments }));

// One khatma completed on 7 January 2026 (100 pages a day from the 1st).
const JOURNAL = buildCompletedKhatmas(1, day('2026-01-01'), 10);
const onCompletionDay = () => new Date('2026-01-07T18:00:00');

async function run({
  celebratedKhatm = 0,
  onboardingCompleted = true,
  isEnabled = true,
  clock = onCompletionDay,
} = {}) {
  const store = createTestAppStore({
    journal: JOURNAL,
    settings: { celebratedKhatm, onboardingCompleted },
  });
  const open = jest.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppStoreProvider store={store}>{children}</AppStoreProvider>
  );
  const hook = await renderHook(() => useKhatmaCelebration({ open, isEnabled, clock }), {
    wrapper,
  });
  return { open, store, hook };
}

beforeEach(() => {
  mockSegments = ['(tabs)'];
});

describe('useKhatmaCelebration', () => {
  it('opens the celebration of the khatma just completed, once', async () => {
    const { open, hook } = await run();
    await hook.rerender({});
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(1);
    await hook.unmount();
  });

  it('does not open it again once it was celebrated, here or on another phone', async () => {
    const { open } = await run({ celebratedKhatm: 1 });
    expect(open).not.toHaveBeenCalled();
  });

  it('waits for the end of the introduction, and never opens over it', async () => {
    expect((await run({ onboardingCompleted: false })).open).not.toHaveBeenCalled();
    mockSegments = ['onboarding'];
    expect((await run()).open).not.toHaveBeenCalled();
  });

  it('does not open in the iOS check, which opens its screens itself', async () => {
    expect((await run({ isEnabled: false })).open).not.toHaveBeenCalled();
  });

  it('does not celebrate an old khatma that came back long after', async () => {
    const months = () => new Date('2026-04-01T12:00:00');
    expect((await run({ clock: months })).open).not.toHaveBeenCalled();
  });
});

describe('mayCelebrateOver', () => {
  it('opens over the tabs and the reader, not over the first screen, the introduction or itself', () => {
    expect(mayCelebrateOver(['(tabs)'])).toBe(true);
    expect(mayCelebrateOver(['reader', '[page]'])).toBe(true);
    expect(mayCelebrateOver([])).toBe(false);
    expect(mayCelebrateOver(['onboarding'])).toBe(false);
    expect(mayCelebrateOver(['khatma-complete'])).toBe(false);
  });
});
