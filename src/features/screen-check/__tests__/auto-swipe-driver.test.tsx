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

// Under Jest a reaction runs as soon as its value changes; on the device it runs after the frame's
// animations, so after a timing's completion callback. Deferred here, as on the device.
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return {
    __esModule: true,
    ...actual,
    default: actual.default,
    useAnimatedReaction: (
      prepare: () => unknown,
      react: (value: unknown, previous: unknown) => void,
      deps?: unknown[],
    ) =>
      actual.useAnimatedReaction(
        prepare,
        (value: unknown, previous: unknown) => {
          void Promise.resolve().then(() => react(value, previous));
        },
        deps,
      ),
  };
});

function Harness({
  onPage,
  pageCount = 3,
}: {
  onPage: (page: number) => void;
  pageCount?: number;
}) {
  const [page, setPage] = useState(0);
  return (
    <SwipePager
      pageCount={pageCount}
      axis={pageCount > 3 ? 'vertical' : 'horizontal'}
      pageMotion={pageCount > 3 ? 'still' : 'slide'}
      release={pageCount > 3 ? 'projected' : 'threshold'}
      settleSpring={pageCount > 3 ? { mass: 1, stiffness: 195, damping: 27.9 } : undefined}
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

  it('turns all 16 pages of the first launch even when the simulator draws a frame every 0.3 s', async () => {
    const frame = jest
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((callback) => Number(setTimeout(() => callback(performance.now()), 300)));
    try {
      const seen: number[] = [];
      await render(<Harness pageCount={16} onPage={(page) => seen.push(page)} />);
      await fireEvent(screen.getByTestId('pager-pages'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
      });
      for (let tick = 0; tick < 200; tick += 1) {
        await act(async () => {
          jest.advanceTimersByTime(250);
        });
      }
      expect(seen).toEqual(Array.from({ length: 15 }, (_, index) => index + 1));
    } finally {
      frame.mockRestore();
    }
  });
});
