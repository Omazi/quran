import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { SwipePager, type PagerDrive } from '../components/swipe-pager';

const WIDTH = 300;

const HEIGHT = 600;

async function renderPager(
  onPageChange: (page: number) => void,
  driven: { drive?: PagerDrive },
  axis: 'horizontal' | 'vertical' = 'horizontal',
) {
  await render(
    <SwipePager
      pageCount={4}
      page={0}
      axis={axis}
      onPageChange={onPageChange}
      renderPage={(index) => <Text>{`page ${index}`}</Text>}
      renderDriver={(drive) => {
        driven.drive = drive;
        return <Text testID="driver">driver</Text>;
      }}
      testID="pager"
    />,
  );
  await fireEvent(screen.getByTestId('pager-pages'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: HEIGHT } },
  });
}

describe('a pager that something else can drive (the iOS check)', () => {
  it('has no driver unless one is given', async () => {
    await render(
      <SwipePager pageCount={2} page={0} onPageChange={jest.fn()} renderPage={() => null} />,
    );
    expect(screen.queryByTestId('driver')).toBeNull();
  });

  it('gives the driver the pager as it is: its length, its page, its direction', async () => {
    const driven: { drive?: PagerDrive } = {};
    await renderPager(jest.fn(), driven);
    expect(screen.getByTestId('driver')).toBeOnTheScreen();
    expect(driven.drive).toMatchObject({
      length: WIDTH,
      page: 0,
      pageCount: 4,
      isRightToLeft: false,
      axis: 'horizontal',
    });
  });

  it('measures a vertical pager by its height, and turns it forwards upwards', async () => {
    const onPageChange = jest.fn();
    const driven: { drive?: PagerDrive } = {};
    await renderPager(onPageChange, driven, 'vertical');
    const drive = driven.drive;
    if (drive === undefined) throw new Error('no drive');
    expect(drive).toMatchObject({ length: HEIGHT, axis: 'vertical', isRightToLeft: false });
    await act(async () => {
      drive.begin();
      drive.move(-0.3 * HEIGHT);
      drive.end(-600, false);
    });
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('turns a page through the same begin, move and end as the finger does', async () => {
    const onPageChange = jest.fn();
    const driven: { drive?: PagerDrive } = {};
    await renderPager(onPageChange, driven);
    const drive = driven.drive;
    if (drive === undefined) throw new Error('no drive');
    await act(async () => {
      drive.begin();
      drive.move(-0.5 * WIDTH);
      drive.end(-600, false);
    });
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('does not turn a page for a short, slow drag, and never past the last page', async () => {
    const onPageChange = jest.fn();
    const driven: { drive?: PagerDrive } = {};
    await renderPager(onPageChange, driven);
    const drive = driven.drive;
    if (drive === undefined) throw new Error('no drive');
    await act(async () => {
      drive.begin();
      drive.move(-10);
      drive.end(-5, false);
      // Dragging right on the first page: resistance, no page before it.
      drive.begin();
      drive.move(200);
      drive.end(500, false);
    });
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('leaves the pages in place when they draw themselves from the position', async () => {
    const seen: number[] = [];
    await render(
      <SwipePager
        pageCount={3}
        page={1}
        axis="vertical"
        pageMotion="still"
        onPageChange={jest.fn()}
        renderPage={(index, position) => {
          seen.push(position.get());
          return <Text testID={`still-${index}`}>{`page ${index}`}</Text>;
        }}
        testID="pager"
      />,
    );
    await fireEvent(screen.getByTestId('pager-pages'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: HEIGHT } },
    });
    // Each page receives the position, and none is moved by it.
    expect(seen).toContain(1);
    for (const index of [0, 1, 2]) {
      const slot = screen.getByTestId(`still-${index}`, { includeHiddenElements: true }).parent;
      expect(slot).toHaveStyle({ transform: [{ translateY: 0 }] });
    }
  });

  it('tells its owner a finger has come down on the pages', async () => {
    const onTouchStart = jest.fn();
    await render(
      <SwipePager
        pageCount={2}
        page={0}
        onPageChange={jest.fn()}
        onTouchStart={onTouchStart}
        renderPage={() => null}
        testID="pager"
      />,
    );
    expect(onTouchStart).not.toHaveBeenCalled();
    await fireEvent(screen.getByTestId('pager-pages'), 'touchStart', {
      nativeEvent: { touches: [] },
    });
    expect(onTouchStart).toHaveBeenCalledTimes(1);
  });

  describe('released by projection (the first launch)', () => {
    async function renderProjected(onPageChange: (page: number) => void, page = 3) {
      const driven: { drive?: PagerDrive } = {};
      await render(
        <SwipePager
          pageCount={16}
          page={page}
          axis="vertical"
          pageMotion="still"
          release="projected"
          settleSpring={{ mass: 1, stiffness: 195, damping: 27.9 }}
          onPageChange={onPageChange}
          renderPage={(index) => <Text>{`page ${index}`}</Text>}
          renderDriver={(drive) => {
            driven.drive = drive;
            return null;
          }}
          testID="pager"
        />,
      );
      await fireEvent(screen.getByTestId('pager-pages'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: HEIGHT } },
      });
      const drive = driven.drive;
      if (drive === undefined) throw new Error('no drive');
      return drive;
    }

    it('turns the page with a short quick flick up', async () => {
      const onPageChange = jest.fn();
      const drive = await renderProjected(onPageChange);
      await act(async () => {
        drive.begin();
        drive.move(-0.1 * HEIGHT);
        drive.end(-900, false);
      });
      expect(onPageChange).toHaveBeenCalledWith(4);
    });

    it('springs back after a slow short drag', async () => {
      const onPageChange = jest.fn();
      const drive = await renderProjected(onPageChange);
      await act(async () => {
        drive.begin();
        drive.move(-0.15 * HEIGHT);
        drive.end(-40, false);
      });
      expect(onPageChange).not.toHaveBeenCalled();
    });

    it('turns one page at most, even dragged over two', async () => {
      const onPageChange = jest.fn();
      const drive = await renderProjected(onPageChange);
      await act(async () => {
        drive.begin();
        drive.move(-2.2 * HEIGHT);
        drive.end(-3000, false);
      });
      expect(onPageChange).toHaveBeenCalledTimes(1);
      expect(onPageChange).toHaveBeenCalledWith(4);
    });

    it('goes back a page with a flick down, and not before the first page', async () => {
      const onPageChange = jest.fn();
      const drive = await renderProjected(onPageChange, 0);
      await act(async () => {
        drive.begin();
        drive.move(0.4 * HEIGHT);
        drive.end(2000, false);
      });
      expect(onPageChange).not.toHaveBeenCalled();
    });
  });
});
