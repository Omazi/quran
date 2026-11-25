import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createMemoryStorage } from '@/data/storage/memory-storage';

import { GARDEN_HINT_KEY, useGardenHint } from '../use-garden-hint';

describe('useGardenHint', () => {
  it('shows the hint to someone who has never turned a garden', async () => {
    const storage = createMemoryStorage();
    const { result } = await renderHook(() => useGardenHint(storage));
    await waitFor(() => expect(result.current.isShown).toBe(true));
  });

  it('retires it for good at the first use', async () => {
    const storage = createMemoryStorage();
    const { result } = await renderHook(() => useGardenHint(storage));
    await waitFor(() => expect(result.current.isShown).toBe(true));
    await act(async () => result.current.retire());
    expect(result.current.isShown).toBe(false);
    expect(await storage.getItem(GARDEN_HINT_KEY)).toBe('1');
  });

  it('never shows it again once retired, not even for a moment', async () => {
    const storage = createMemoryStorage();
    await storage.setItem(GARDEN_HINT_KEY, '1');
    const { result } = await renderHook(() => useGardenHint(storage));
    expect(result.current.isShown).toBe(false);
    await act(async () => undefined);
    expect(result.current.isShown).toBe(false);
  });
});
