import { act, renderHook } from '@testing-library/react-native';

import type { GardenArtFiles } from '@/data/garden-art';
import { LEVEL_1_ART } from '@/features/garden';

import { useGardenArt } from '../use-garden-art';

function filesOf(level: number): GardenArtFiles {
  return {
    level,
    index: {
      level,
      style: 'oasis',
      size: { width: 1170, height: 816 },
      base: ['h00-f0'],
      water: [],
      sprites: {},
    },
    uri: (path) => `file:///${level}/${path}`,
    modelBytes: async () => new ArrayBuffer(4),
  };
}

describe('useGardenArt', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('draws the first garden with the art in the app, without downloading anything', async () => {
    const load = jest.fn();
    const { result } = await renderHook(() => useGardenArt('fountain-courtyard', load));
    expect(result.current).toEqual({ art: LEVEL_1_ART, tint: null, status: 'ready' });
    expect(load).not.toHaveBeenCalled();
  });

  it('draws a friend who hides their level (null) with the first garden', async () => {
    const { result } = await renderHook(() => useGardenArt(null, jest.fn()));
    expect(result.current.art).toBe(LEVEL_1_ART);
  });

  it('shows the placeholder cast while the pack of the level downloads, then its own garden', async () => {
    let resolve: (files: GardenArtFiles) => void = () => undefined;
    const load = jest.fn(() => new Promise<GardenArtFiles>((r) => (resolve = r)));
    const { result } = await renderHook(() => useGardenArt('oasis', load));
    expect(load).toHaveBeenCalledWith(2);
    expect(result.current.status).toBe('loading');
    expect(result.current.art).toBe(LEVEL_1_ART);
    expect(result.current.tint).not.toBeNull();
    await act(async () => resolve(filesOf(2)));
    expect(result.current.status).toBe('ready');
    expect(result.current.art.key).toBe('level-2');
    expect(result.current.tint).toBeNull();
  });

  it('keeps the placeholder when the pack cannot be had (offline, a file that failed its check)', async () => {
    const load = jest.fn(() => Promise.reject(new Error('offline')));
    const { result } = await renderHook(() => useGardenArt('night-garden', load));
    await act(async () => undefined);
    expect(load).toHaveBeenCalledWith(7);
    expect(result.current.status).toBe('unavailable');
    expect(result.current.art).toBe(LEVEL_1_ART);
    expect(result.current.tint).not.toBeNull();
  });
});
