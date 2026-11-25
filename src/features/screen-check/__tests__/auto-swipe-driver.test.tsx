import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';

import { SwipePager } from '@/ui';

import { pagerDriver } from '../auto-run';

jest.mock('expo-file-system', () => {
  class File {
    exists = false;
    create() {}
    delete() {}
    writeSync() {}
  }
  return { File, Paths: { document: 'file:///documents' } };
});

function Harness({ onPage }: { onPage: (page: number) => void }) {
  const [page, setPage] = useState(0);
  return (
    <SwipePager
      pageCount={3}
      page={page}
      onPageChange={(next) => {
        onPage(next);
        setPage(next);
      }}
      renderPage={(index) => <Text>{`page ${index}`}</Text>}
      renderDriver={pagerDriver}
      testID="pager"
    />
  );
}

describe('the automatic swipe, driving a real pager', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('turns every page of the pager, one after the other, by itself', async () => {
    const seen: number[] = [];
    await render(<Harness onPage={(page) => seen.push(page)} />);
    await fireEvent(screen.getByTestId('pager-pages'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 600 } },
    });
    for (let tick = 0; tick < 40; tick += 1) {
      await act(async () => {
        jest.advanceTimersByTime(500);
      });
    }
    expect(seen).toEqual([1, 2]);
  });
});
