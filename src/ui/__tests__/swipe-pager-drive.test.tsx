import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { SwipePager, type PagerDrive } from '../components/swipe-pager';

const WIDTH = 300;

async function renderPager(onPageChange: (page: number) => void, driven: { drive?: PagerDrive }) {
  await render(
    <SwipePager
      pageCount={4}
      page={0}
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
    nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 600 } },
  });
}

describe('a pager that something else can drive (the iOS check)', () => {
  it('has no driver unless one is given', async () => {
    await render(
      <SwipePager pageCount={2} page={0} onPageChange={jest.fn()} renderPage={() => null} />,
    );
    expect(screen.queryByTestId('driver')).toBeNull();
  });

  it('gives the driver the pager as it is: its width, its page, its direction', async () => {
    const driven: { drive?: PagerDrive } = {};
    await renderPager(jest.fn(), driven);
    expect(screen.getByTestId('driver')).toBeOnTheScreen();
    expect(driven.drive).toMatchObject({
      width: WIDTH,
      page: 0,
      pageCount: 4,
      isRightToLeft: false,
    });
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
});
