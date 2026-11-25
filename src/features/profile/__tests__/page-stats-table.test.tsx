import { act, renderHook, waitFor } from '@testing-library/react-native';

import { buildPageStatsTable } from '@/domain/stats';
import { buildUniformMushaf } from '@/domain/stats/__fixtures__/small-mushaf';

import { loadPageStatsTable, usePageStatsTable } from '../page-stats-table';

const mushaf = buildUniformMushaf();

function fakeRepository() {
  return { getPage: jest.fn(async (page: number) => mushaf[page - 1]!) };
}

describe('loadPageStatsTable', () => {
  it('builds the table from every page the reader shows, each page read once', async () => {
    const repository = fakeRepository();
    const table = await loadPageStatsTable(repository, mushaf.length);
    expect(table).toEqual(buildPageStatsTable(mushaf));
    expect(repository.getPage).toHaveBeenCalledTimes(mushaf.length);
    expect(new Set(repository.getPage.mock.calls.map(([page]) => page)).size).toBe(mushaf.length);
  });
});

describe('usePageStatsTable', () => {
  it('is loading on the first render and starts the work after it', async () => {
    let resolve: (value: ReturnType<typeof buildPageStatsTable>) => void = () => {};
    const load = jest.fn(
      () => new Promise<ReturnType<typeof buildPageStatsTable>>((done) => (resolve = done)),
    );
    const { result } = await renderHook(() => usePageStatsTable(load));
    expect(result.current).toEqual({ status: 'loading' });
    const table = buildPageStatsTable(mushaf);
    await act(async () => resolve(table));
    expect(result.current).toEqual({ status: 'ready', table });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('says it failed when the pages cannot be read', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const load = () => Promise.reject(new Error('no file'));
    const { result } = await renderHook(() => usePageStatsTable(load));
    await waitFor(() => expect(result.current).toEqual({ status: 'failed' }));
  });
});
