import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { FlatList, PlatformColor, Text, VirtualizedList } from 'react-native';

import { Pager } from '../native/default/pager';
import { dotCapacity, PageIndicator, visiblePageRange } from '../native/page-indicator';
import {
  APPEARANCES_AND_DIRECTIONS,
  changeReducedMotion,
  directionDependentStyles,
  resetDeviceConditions,
  setDeviceConditions,
  styleOf,
  touchTargetHeight,
  type RenderedElement,
} from '../test-support/environment';
import { appColors, fallbackSystemColors, spacing, touchTargets } from '../tokens';

/** Width of the window in the test conditions, and of a pager that fills it. */
const WIDTH = 390;
const HEIGHT = 600;

afterEach(resetDeviceConditions);

/** Tells a view the size the platform gave it. */
function layOut(element: RenderedElement, width: number, height = HEIGHT) {
  return fireEvent(element, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width, height } } });
}

function parentOf(element: RenderedElement): RenderedElement {
  if (element.parent === null) throw new Error('No parent element.');
  return element.parent;
}

describe('PageIndicator', () => {
  function renderIndicator(index: number, onChange = jest.fn(), count = 16) {
    return render(
      <PageIndicator
        count={count}
        index={index}
        onChange={onChange}
        accessibilityLabel="Page"
        accessibilityValue={`Page ${index + 1} sur ${count}`}
        testID="pages"
      />,
    );
  }

  /** The dots, in reading order: the views that are round. */
  function dots() {
    return screen
      .getByTestId('pages')
      .queryAll((element) => typeof styleOf(element).borderRadius === 'number');
  }

  it.each(APPEARANCES_AND_DIRECTIONS)(
    'shows one dot per page, the current one solid, in neutral colours ($scheme, right to left: $rightToLeft)',
    async (conditions) => {
      setDeviceConditions(conditions);
      await renderIndicator(2);
      expect(dots()).toHaveLength(16);
      const colors = dots().map((dot) => styleOf(dot).backgroundColor);
      expect(colors[2]).toEqual(PlatformColor('label'));
      expect(colors.filter((color) => color !== colors[2])).toHaveLength(15);
      expect(new Set(colors.map((color) => JSON.stringify(color))).size).toBe(2);
      expect(directionDependentStyles(screen.container)).toEqual([]);
    },
  );

  it('keeps its dots equidistant and of one size when they all fit', async () => {
    setDeviceConditions();
    await renderIndicator(2);
    expect(new Set(dots().map((dot) => styleOf(dot).width))).toEqual(new Set([spacing.sm]));
  });

  it('lays itself out as a row, which the platform mirrors in a right-to-left interface', async () => {
    setDeviceConditions({ rightToLeft: true });
    await renderIndicator(1);
    expect(styleOf(screen.getByTestId('pages')).flexDirection).toBe('row');
    expect(styleOf(screen.getByTestId('pages-previous')).flexDirection).toBe('row');
    expect(directionDependentStyles(screen.container)).toEqual([]);
  });

  it('is centred in the width it is given, and never coloured with the accent', async () => {
    setDeviceConditions({ os: 'android', scheme: 'dark' });
    await renderIndicator(0);
    expect(styleOf(parentOf(screen.getByTestId('pages')))).toMatchObject({
      alignSelf: 'stretch',
      alignItems: 'center',
    });
    const colors = dots().map((dot) => styleOf(dot).backgroundColor);
    expect(colors[0]).toBe(fallbackSystemColors.label.dark);
    expect(colors[1]).toBe(fallbackSystemColors.tertiaryLabel.dark);
    expect(colors).not.toContain(appColors.accent.dark);
  });

  it('is one adjustable element that says where the person is', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await renderIndicator(2, onChange);
    const indicator = screen.getByRole('adjustable', { name: 'Page' });
    expect(indicator).toHaveAccessibilityValue({ text: 'Page 3 sur 16' });
    await fireEvent(indicator, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    expect(onChange).toHaveBeenLastCalledWith(3);
    await fireEvent(indicator, 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('gives the page number and the number of pages when no sentence is supplied', async () => {
    setDeviceConditions();
    await render(
      <PageIndicator count={16} index={2} onChange={jest.fn()} accessibilityLabel="Page" />,
    );
    expect(screen.getByRole('adjustable', { name: 'Page' })).toHaveAccessibilityValue({
      min: 1,
      max: 16,
      now: 3,
    });
  });

  it('splits its two press zones at the current dot, not in the middle of the control', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await renderIndicator(2, onChange);
    const [previous, current, next] = screen.getByTestId('pages').children;
    expect(previous).toBe(screen.getByTestId('pages-previous'));
    expect(next).toBe(screen.getByTestId('pages-next'));
    // Two dots before the current one, thirteen after it: the zones are not halves.
    const roundViews = (zone: RenderedElement) =>
      zone.queryAll((element) => typeof styleOf(element).borderRadius === 'number');
    expect(roundViews(screen.getByTestId('pages-previous'))).toHaveLength(2);
    expect(roundViews(screen.getByTestId('pages-next'))).toHaveLength(13);
    expect(current).toBe(dots()[2]);
    await userEvent.press(screen.getByTestId('pages-next'));
    expect(onChange).toHaveBeenLastCalledWith(3);
    await userEvent.press(screen.getByTestId('pages-previous'));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('does not go before the first page or past the last one', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await renderIndicator(0, onChange, 3);
    await userEvent.press(screen.getByTestId('pages-previous'));
    await fireEvent(screen.getByTestId('pages'), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    await screen.unmount();
    await renderIndicator(2, onChange, 3);
    await userEvent.press(screen.getByTestId('pages-next'));
    await fireEvent(screen.getByTestId('pages'), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('makes each zone that holds a dot a touch target of 44 points', async () => {
    setDeviceConditions();
    await renderIndicator(1, jest.fn(), 3);
    expect(touchTargetHeight(screen.getByTestId('pages'))).toBeGreaterThanOrEqual(touchTargets.ios);
    for (const zone of ['pages-previous', 'pages-next']) {
      const { paddingStart, paddingEnd } = styleOf(screen.getByTestId(zone));
      // The paddings of the zone, plus the one dot it holds here.
      expect(Number(paddingStart) + Number(paddingEnd) + spacing.sm).toBe(touchTargets.ios);
      expect(styleOf(screen.getByTestId(zone)).alignSelf).toBe('stretch');
    }
  });

  describe('with more pages than fit', () => {
    it('shows the dots around the current page, which is never cut off', async () => {
      setDeviceConditions();
      await renderIndicator(20, jest.fn(), 40);
      await layOut(parentOf(screen.getByTestId('pages')), 200, 44);
      expect(dots()).toHaveLength(dotCapacity(200));
      const colors = dots().map((dot) => styleOf(dot).backgroundColor);
      const current = colors.findIndex(
        (color) => JSON.stringify(color) === JSON.stringify(PlatformColor('label')),
      );
      expect(current).toBe(Math.floor(dotCapacity(200) / 2));
      expect(styleOf(dots()[current]!).width).toBe(spacing.sm);
    });

    it('shrinks the dot at each end where more pages follow', async () => {
      setDeviceConditions();
      await renderIndicator(20, jest.fn(), 40);
      await layOut(parentOf(screen.getByTestId('pages')), 200, 44);
      const widths = dots().map((dot) => styleOf(dot).width);
      expect(widths.at(0)).toBe(spacing.xs);
      expect(widths.at(-1)).toBe(spacing.xs);
      expect(widths.slice(1, -1).every((width) => width === spacing.sm)).toBe(true);
    });

    it('keeps the first dot full size on the first page, where nothing comes before', async () => {
      setDeviceConditions();
      await renderIndicator(0, jest.fn(), 40);
      await layOut(parentOf(screen.getByTestId('pages')), 200, 44);
      const widths = dots().map((dot) => styleOf(dot).width);
      expect(widths.at(0)).toBe(spacing.sm);
      expect(widths.at(-1)).toBe(spacing.xs);
    });

    it('uses the width of the window until it knows its own', async () => {
      setDeviceConditions();
      await renderIndicator(20, jest.fn(), 40);
      expect(dots()).toHaveLength(dotCapacity(WIDTH));
    });

    it('still says the real position to screen readers', async () => {
      setDeviceConditions();
      await renderIndicator(20, jest.fn(), 40);
      await layOut(parentOf(screen.getByTestId('pages')), 200, 44);
      expect(screen.getByRole('adjustable', { name: 'Page' })).toHaveAccessibilityValue({
        text: 'Page 21 sur 40',
      });
    });
  });

  describe('window of visible dots', () => {
    it('fits as many dots as the width allows, with the space kept at both ends', () => {
      // Each end keeps 28 points; a dot and its gap take 16.
      expect(dotCapacity(200)).toBe(9);
      expect(dotCapacity(WIDTH)).toBe(21);
      expect(dotCapacity(0)).toBe(1);
    });

    it.each([
      { count: 16, index: 2, capacity: 21, first: 0, last: 15 },
      { count: 40, index: 0, capacity: 9, first: 0, last: 8 },
      { count: 40, index: 20, capacity: 9, first: 16, last: 24 },
      { count: 40, index: 39, capacity: 9, first: 31, last: 39 },
      { count: 40, index: 7, capacity: 1, first: 7, last: 7 },
    ])(
      'shows $first to $last for page $index of $count with room for $capacity',
      ({ count, index, capacity, first, last }) => {
        expect(visiblePageRange(count, index, capacity)).toEqual({ first, last });
      },
    );

    it('always contains the current page', () => {
      for (let index = 0; index < 40; index += 1) {
        const { first, last } = visiblePageRange(40, index, 9);
        expect(index).toBeGreaterThanOrEqual(first);
        expect(index).toBeLessThanOrEqual(last);
      }
    });
  });

  it.each([
    { count: 0, index: 0 },
    { count: 3, index: 3 },
    { count: 3, index: -1 },
    { count: 2.5, index: 0 },
  ])('refuses the position $index of $count', async ({ count, index }) => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      render(
        <PageIndicator count={count} index={index} onChange={jest.fn()} accessibilityLabel="P" />,
      ),
    ).rejects.toThrow(RangeError);
  });
});

describe('default Pager', () => {
  function pager(page: number, onPageChange = jest.fn(), pageCount = 3) {
    return (
      <Pager
        pageCount={pageCount}
        page={page}
        onPageChange={onPageChange}
        renderPage={(index) => <Text>{`Contenu de la page ${index + 1}`}</Text>}
        accessibilityLabel="Page"
        accessibilityValue={`Page ${page + 1} sur ${pageCount}`}
        testID="pager"
      />
    );
  }

  /** The view that holds the pages: the first child of the pager. */
  function pagesFrame(): RenderedElement {
    const frame = screen.getByTestId('pager').children[0];
    if (frame === undefined || typeof frame === 'string') throw new Error('No pages frame.');
    return frame;
  }

  function list(): RenderedElement {
    const lists = screen.getByTestId('pager').queryAll(({ type }) => type === 'RCTScrollView');
    if (lists[0] === undefined) throw new Error('The list is not laid out yet.');
    return lists[0];
  }

  /** Renders the pager and gives it the size of the window, as the platform would. */
  async function renderLaidOut(page: number, onPageChange = jest.fn(), pageCount = 3) {
    await render(pager(page, onPageChange, pageCount));
    await layOut(pagesFrame(), WIDTH);
    await layOut(list(), WIDTH);
    await fireEvent(list(), 'contentSizeChange', WIDTH * pageCount, HEIGHT);
  }

  /** Scrolls the list so that the given page fills it. Pages follow each other in list order. */
  function scrollToPage(page: number, pageCount = 3) {
    return fireEvent.scroll(list(), {
      nativeEvent: {
        contentOffset: { x: WIDTH * page, y: 0 },
        contentSize: { width: WIDTH * pageCount, height: HEIGHT },
        layoutMeasurement: { width: WIDTH, height: HEIGHT },
      },
    });
  }

  it.each(APPEARANCES_AND_DIRECTIONS)(
    'is a paging scroll view with the page indicator under it ($scheme, right to left: $rightToLeft)',
    async (conditions) => {
      setDeviceConditions({ os: 'android', ...conditions });
      await renderLaidOut(0);
      expect(list()).toHaveProp('horizontal', true);
      expect(list()).toHaveProp('pagingEnabled', true);
      expect(list()).toHaveProp('showsHorizontalScrollIndicator', false);
      expect(screen.getByText('Contenu de la page 1')).toBeOnTheScreen();
      const [, indicatorFrame] = screen.getByTestId('pager').children;
      expect(indicatorFrame).toBe(parentOf(screen.getByTestId('pager-indicator')));
      expect(directionDependentStyles(screen.container)).toEqual([]);
    },
  );

  it('fills its place and gives every page its own width', async () => {
    setDeviceConditions();
    await renderLaidOut(0);
    expect(styleOf(screen.getByTestId('pager')).flex).toBe(1);
    expect(styleOf(parentOf(screen.getByText('Contenu de la page 1'))).width).toBe(WIDTH);
  });

  it('gives the frame of every page the whole height of the list, with no height of its own', async () => {
    setDeviceConditions();
    await renderLaidOut(0);
    const frame = parentOf(parentOf(screen.getByText('Contenu de la page 1')));
    expect(styleOf(frame).flex).toBe(1);
    expect(styleOf(frame).height).toBeUndefined();
  });

  it('starts on the page it is given, without sliding to it', async () => {
    setDeviceConditions();
    // The list places itself on its initial page as soon as it knows the size of its content.
    const placeList = jest.spyOn(VirtualizedList.prototype, 'scrollToIndex');
    await renderLaidOut(2);
    expect(placeList).toHaveBeenCalledWith({ index: 2, animated: false });
    expect(screen.getByRole('adjustable', { name: 'Page' })).toHaveAccessibilityValue({
      text: 'Page 3 sur 3',
    });
  });

  it('reports the page the person swiped to, once', async () => {
    setDeviceConditions();
    const onPageChange = jest.fn();
    await renderLaidOut(0, onPageChange);
    await scrollToPage(1);
    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('does not report the pages it passes while it goes to the page it starts on', async () => {
    setDeviceConditions();
    const onPageChange = jest.fn();
    await renderLaidOut(2, onPageChange);
    await scrollToPage(0);
    await scrollToPage(1);
    expect(onPageChange).not.toHaveBeenCalled();
    await scrollToPage(2);
    // Arrived: from now on a swipe is the person's.
    await scrollToPage(1);
    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('does not report the pages it slides over on its way to a page asked from outside', async () => {
    setDeviceConditions();
    const onPageChange = jest.fn();
    await renderLaidOut(0, onPageChange);
    await screen.rerender(pager(2, onPageChange));
    await scrollToPage(1);
    expect(onPageChange).not.toHaveBeenCalled();
    await scrollToPage(2);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('lets a person who starts to drag take over from a slide in progress', async () => {
    setDeviceConditions();
    const onPageChange = jest.fn();
    await renderLaidOut(0, onPageChange);
    await screen.rerender(pager(2, onPageChange));
    await fireEvent(list(), 'scrollBeginDrag');
    await scrollToPage(1);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('does not scroll again when its owner confirms the page the person swiped to', async () => {
    setDeviceConditions();
    const scrollToIndex = jest.spyOn(FlatList.prototype, 'scrollToIndex');
    const onPageChange = jest.fn();
    await renderLaidOut(0, onPageChange);
    await scrollToPage(1);
    await screen.rerender(pager(1, onPageChange));
    expect(scrollToIndex).not.toHaveBeenCalled();
  });

  it('slides to a page asked through the indicator', async () => {
    setDeviceConditions();
    const scrollToIndex = jest.spyOn(FlatList.prototype, 'scrollToIndex');
    const onPageChange = jest.fn();
    await renderLaidOut(0, onPageChange);
    await userEvent.press(screen.getByTestId('pager-indicator-next'));
    expect(onPageChange).toHaveBeenCalledWith(1);
    await screen.rerender(pager(1, onPageChange));
    expect(scrollToIndex).toHaveBeenCalledWith({ index: 1, animated: true });
  });

  it('jumps instead of sliding when the person asked to reduce motion', async () => {
    setDeviceConditions({ reducedMotion: true });
    const scrollToIndex = jest.spyOn(FlatList.prototype, 'scrollToIndex');
    await renderLaidOut(0);
    await screen.rerender(pager(2));
    expect(scrollToIndex).toHaveBeenCalledWith({ index: 2, animated: false });
  });

  it('follows the motion setting when it changes while the pager is open', async () => {
    setDeviceConditions();
    const scrollToIndex = jest.spyOn(FlatList.prototype, 'scrollToIndex');
    await renderLaidOut(0);
    await changeReducedMotion(true);
    await screen.rerender(pager(1));
    expect(scrollToIndex).toHaveBeenLastCalledWith({ index: 1, animated: false });
  });

  it('draws its pages again when their content changes', async () => {
    setDeviceConditions();
    await renderLaidOut(0);
    await screen.rerender(
      <Pager
        pageCount={3}
        page={0}
        onPageChange={jest.fn()}
        renderPage={(index) => <Text>{`Nouveau contenu ${index + 1}`}</Text>}
        accessibilityLabel="Page"
        testID="pager"
      />,
    );
    expect(screen.getByText('Nouveau contenu 1')).toBeOnTheScreen();
  });

  it('refuses a page that does not exist', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(render(pager(3))).rejects.toThrow(RangeError);
  });
});
