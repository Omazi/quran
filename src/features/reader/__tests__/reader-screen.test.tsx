/**
 * The reader on screen (docs/specs/reader.md, sections 2, 3 and 5): pages turned in the direction
 * of the book, the 30-second rule driven by a fake clock through the real store, the message
 * after a page, the bars, the lines that do not fit, and the states.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo, AppState } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { quranStructure } from '@/data/quran';
import { recordPageRead, EMPTY_JOURNAL, type ReadingJournal } from '@/domain/khatm';
import { PAGE_COUNT } from '@/domain/quran';
import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import { deviceLocalDate } from '@/features/home';
import { AppStoreProvider, type AppStore } from '@/store';
import { createTestAppStore } from '@/store/test-support/test-store';
import { fontFamily } from '@/ui';
import { readerPalette } from '@/ui/tokens';
import {
  changeReducedMotion,
  renderOnIOS,
  resetDeviceConditions,
  setDeviceConditions,
  styleOf,
} from '@/ui/test-support/environment';

import { READER_CONFIG } from '../config';
import { pagerIndexOfPage } from '../page-order';
import { PAGE_SIDE_ROOM } from '../page-layout';
import { ReaderNotFound, ReaderScreen } from '../reader-screen';
import { useReader } from '../use-reader';
import type { QuranFontStatus } from '../use-quran-font';

const WIDTH = 390;
const HEIGHT = 700;
const SECOND = 1000;

let now = 0;
const monotonicClock = () => now;
const clock = () => new Date('2026-11-24T10:00:00');
const TODAY = deviceLocalDate(clock());

function Reader({ page, fontStatus = 'ready' }: { page: number; fontStatus?: QuranFontStatus }) {
  const { model, actions } = useReader(page, { monotonicClock, clock });
  return (
    <ReaderScreen
      model={model}
      actions={actions}
      fontStatus={fontStatus}
      initialPage={page}
      openContents={openContents}
      close={close}
    />
  );
}

const openContents = jest.fn();
const close = jest.fn();

async function openReader(store: AppStore, page: number, fontStatus?: QuranFontStatus) {
  const view = await render(
    <AppStoreProvider store={store}>
      <Reader page={page} fontStatus={fontStatus} />
    </AppStoreProvider>,
  );
  // The page area gets its size from the layout, which Jest only gives when asked.
  await fireEvent(screen.getByTestId('reader-pages'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: HEIGHT } },
  });
  return view;
}

/** A swipe that settles on a page. */
async function swipeTo(page: number) {
  await fireEvent(screen.getByTestId('book-pager'), 'momentumScrollEnd', {
    nativeEvent: { contentOffset: { x: pagerIndexOfPage(page) * WIDTH, y: 0 } },
  });
}

async function wait(seconds: number) {
  now += seconds * SECOND;
}

function readPages(pages: readonly number[]): ReadingJournal {
  return pages.reduce(
    (journal, page) => recordPageRead(journal, { page, date: TODAY }),
    EMPTY_JOURNAL,
  );
}

function pagesOf(store: AppStore): number[] {
  return store.getState().journal.map((entry) => entry.page);
}

beforeEach(async () => {
  now = 0;
  // React Native's Jest mock makes the state a function; on a device it is a string.
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  setDeviceConditions();
  await showLanguage('fr');
});

afterEach(resetDeviceConditions);

describe('turning the pages', () => {
  it('opens on the page asked, and remembers it as the page to resume', async () => {
    const store = createTestAppStore();
    await openReader(store, 293);
    await waitFor(() => expect(screen.getByTestId('mushaf-page-293')).toBeOnTheScreen());
    expect(store.getState().settings.lastOpenedPage).toBe(293);
  });

  it('starts the pager on that page, in the order of the book', async () => {
    await openReader(createTestAppStore(), 293);
    const pager = screen.getByTestId('book-pager');
    expect(pager.props.initialScrollIndex).toBe(PAGE_COUNT - 293);
    expect(pager.props.horizontal).toBe(true);
    expect(pager.props.pagingEnabled).toBe(true);
    // Fixed left to right in every language: the next page comes from the left.
    expect(styleOf(pager).direction).toBe('ltr');
  });

  it('keeps the order of the book in Arabic too', async () => {
    setDeviceConditions({ rightToLeft: true });
    await showLanguage('ar');
    await openReader(createTestAppStore(), 12);
    const pager = screen.getByTestId('book-pager');
    expect(pager.props.initialScrollIndex).toBe(PAGE_COUNT - 12);
    expect(styleOf(pager).direction).toBe('ltr');
  });

  it('mounts only the page on screen and its neighbours', async () => {
    await openReader(createTestAppStore(), 293);
    const pager = screen.getByTestId('book-pager');
    expect(pager.props.windowSize).toBe(3);
    expect(pager.props.initialNumToRender).toBe(1);
  });

  it('offers VoiceOver an action for the next and the previous page', async () => {
    const store = createTestAppStore();
    await openReader(store, 293);
    await waitFor(() => expect(screen.getByTestId('mushaf-page-293')).toBeOnTheScreen());
    const firstLine = screen.container.queryAll(
      (element) => element.props.accessibilityLanguage === 'ar' && element.props.accessible,
    )[0]!;
    expect(firstLine.props.accessibilityActions).toEqual([
      { name: 'nextPage', label: 'Page suivante' },
      { name: 'previousPage', label: 'Page précédente' },
    ]);
    await act(async () => {
      firstLine.props.onAccessibilityAction({ nativeEvent: { actionName: 'nextPage' } });
    });
    expect(store.getState().settings.lastOpenedPage).toBe(294);
  });
});

describe('the 30-second rule, through the store', () => {
  it('a page flicked through is not recorded', async () => {
    const store = createTestAppStore();
    await openReader(store, 10);
    await wait(5);
    await swipeTo(11);
    expect(pagesOf(store)).toEqual([]);
    // Nothing to say: nothing is drawn, so the pill reserves no room.
    expect(screen.queryByTestId('reader-feedback', { includeHiddenElements: true })).toBeNull();
  });

  it('a page read for 30 seconds is recorded on the local day when the page turns', async () => {
    const store = createTestAppStore();
    await openReader(store, 10);
    await wait(READER_CONFIG.minimumSecondsOnPage);
    await swipeTo(11);
    expect(store.getState().journal).toEqual([{ khatm: 1, page: 10, date: TODAY }]);
    expect(screen.getByText('+1 page, ton jardin est arrosé')).toBeOnTheScreen();
  });

  it('tells VoiceOver too', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await openReader(createTestAppStore(), 10);
    await wait(READER_CONFIG.minimumSecondsOnPage);
    await swipeTo(9);
    expect(announce).toHaveBeenCalledWith('+1 page, ton jardin est arrosé');
  });

  it('time in the background does not count', async () => {
    const store = createTestAppStore();
    await openReader(store, 10);
    const onChange = jest
      .mocked(AppState.addEventListener)
      .mock.calls.filter(([event]) => event === 'change')
      .map(([, handler]) => handler)
      .at(-1)!;
    await wait(10);
    await act(async () => onChange('background'));
    await wait(600);
    await act(async () => onChange('active'));
    await wait(10);
    await swipeTo(11);
    expect(pagesOf(store)).toEqual([]);
  });

  it('a page already read in the khatma changes nothing, and says nothing', async () => {
    const store = createTestAppStore({ journal: readPages([10]) });
    const journal = store.getState().journal;
    await openReader(store, 10);
    await wait(60);
    await swipeTo(11);
    expect(store.getState().journal).toBe(journal);
    expect(screen.queryByText('+1 page, ton jardin est arrosé')).toBeNull();
  });

  it('leaving the reader records the page on screen', async () => {
    const store = createTestAppStore();
    const view = await openReader(store, 604);
    await wait(READER_CONFIG.minimumSecondsOnPage);
    await view.unmount();
    expect(pagesOf(store)).toEqual([604]);
  });

  it('names the new element of the garden when the page completes a hizb', async () => {
    const lastPage = quranStructure.hizbPageRange(1).lastPage;
    const firstPages = Array.from({ length: lastPage - 1 }, (_, index) => index + 1);
    const store = createTestAppStore({ journal: readPages(firstPages) });
    await openReader(store, lastPage);
    await wait(READER_CONFIG.minimumSecondsOnPage);
    await swipeTo(lastPage + 1);
    expect(screen.getByTestId('reader-feedback')).toHaveTextContent(
      /^Hizb terminé\. Nouveau dans ton jardin : \S/,
    );
  });
});

describe('the bar of the validated mockup (docs/design/mushaf.png)', () => {
  it('names the surah, then the juz, the hizb and the page, between two round buttons', async () => {
    await openReader(createTestAppStore(), 293);
    const header = screen.getByTestId('reader-header');
    const title = within(header).getByRole('header');
    expect(within(title).getByText('Al-Kahf')).toBeOnTheScreen();
    expect(within(title).getByText('Juz 15, Hizb 30 · Page 293')).toBeOnTheScreen();
    expect(within(header).getByRole('button', { name: 'Retour' })).toBeOnTheScreen();
    expect(within(header).getByRole('button', { name: 'Sommaire' })).toBeOnTheScreen();
  });

  it('goes back with the leading button, and to the contents with the trailing one', async () => {
    close.mockClear();
    openContents.mockClear();
    await openReader(createTestAppStore(), 293);
    await fireEvent.press(screen.getByRole('button', { name: 'Retour' }));
    expect(close).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Sommaire' }));
    expect(openContents).toHaveBeenCalledTimes(1);
  });

  it('draws its round buttons white on the warm ground, 44 points to touch', async () => {
    setDeviceConditions({ os: 'android' });
    await openReader(createTestAppStore(), 293);
    expect(styleOf(screen.getByTestId('reader'))).toMatchObject({
      backgroundColor: readerPalette.canvas.light,
    });
    const back = screen.getByTestId('reader-back');
    expect(styleOf(back)).toMatchObject({ backgroundColor: readerPalette.card.light });
    const drawn = Number(styleOf(back).width);
    const slop = back.props.hitSlop as { top: number; bottom: number };
    expect(drawn + slop.top + slop.bottom).toBeGreaterThanOrEqual(44);
  });

  it('hides its content with a tap on the page and keeps its room, so the page never moves', async () => {
    await openReader(createTestAppStore(), 20);
    await waitFor(() => expect(screen.getByTestId('mushaf-page-20')).toBeOnTheScreen());
    await act(() => fireGestureHandler(getByGestureTestId('reader-page-20-tap')));
    const header = screen.getByTestId('reader-header', { includeHiddenElements: true });
    expect(within(header).queryByRole('button', { name: 'Retour' })).toBeNull();
    expect(styleOf(header)).toMatchObject({ opacity: 0 });
    expect(styleOf(header).minHeight).toBeGreaterThan(0);
  });
});

describe('the watered pill, the moment of the reader (spec 3)', () => {
  it('shows under the title, with the water drop, white with words of water, never over the page', async () => {
    setDeviceConditions({ os: 'android' });
    await openReader(createTestAppStore(), 10);
    await wait(READER_CONFIG.minimumSecondsOnPage);
    await swipeTo(11);
    const row = screen.getByTestId('reader-pill-row');
    const pill = within(row).getByTestId('reader-feedback');
    expect(pill).toHaveTextContent('+1 page, ton jardin est arrosé');
    // The mockup keeps the title above the pill.
    expect(within(screen.getByTestId('reader-header')).getByText('Al-Baqarah')).toBeOnTheScreen();
    // The drop decorates words that say the same: VoiceOver hears the words only.
    expect(
      within(pill).getByTestId('reader-feedback-drop', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(styleOf(pill)).toMatchObject({ backgroundColor: readerPalette.card.light });
    // Nothing is laid over the page, so the first line is never covered, whatever the screen.
    expect(within(screen.getByTestId('reader-pages')).queryByTestId('reader-feedback')).toBeNull();
  });

  it('keeps its row when there is nothing to say, so the page does not move when it comes', async () => {
    await openReader(createTestAppStore(), 10);
    expect(screen.queryByTestId('reader-feedback')).toBeNull();
    expect(styleOf(screen.getByTestId('reader-pill-row')).minHeight).toBeGreaterThan(0);
  });

  it('shows at the same place while the bars are hidden', async () => {
    await openReader(createTestAppStore(), 20);
    await waitFor(() => expect(screen.getByTestId('mushaf-page-20')).toBeOnTheScreen());
    await act(() => fireGestureHandler(getByGestureTestId('reader-page-20-tap')));
    await wait(READER_CONFIG.minimumSecondsOnPage);
    await swipeTo(21);
    expect(
      within(screen.getByTestId('reader-pill-row')).getByTestId('reader-feedback'),
    ).toHaveTextContent('+1 page, ton jardin est arrosé');
  });

  it('is brief: it leaves after a few seconds', async () => {
    jest.useFakeTimers();
    try {
      await openReader(createTestAppStore(), 10);
      await wait(READER_CONFIG.minimumSecondsOnPage);
      await swipeTo(11);
      expect(screen.getByTestId('reader-feedback')).toBeOnTheScreen();
      await act(async () => {
        jest.advanceTimersByTime(READER_CONFIG.feedbackSeconds * SECOND - 1);
      });
      expect(screen.getByTestId('reader-feedback')).toBeOnTheScreen();
      await act(async () => {
        jest.advanceTimersByTime(1);
      });
      expect(screen.queryByTestId('reader-feedback')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('appears without movement with Reduce Motion', async () => {
    await openReader(createTestAppStore(), 10);
    await changeReducedMotion(true);
    await wait(READER_CONFIG.minimumSecondsOnPage);
    await swipeTo(11);
    const style = styleOf(screen.getByTestId('reader-feedback-motion'));
    expect(style.transform).toBeUndefined();
    expect(style.opacity ?? 1).toBe(1);
  });
});

describe('the zoom of the page (deviation 34)', () => {
  it('stops turning pages while the page is enlarged, and turns them again at its size', async () => {
    // With Reduce Motion the double tap jumps to its size: no animation to wait for.
    setDeviceConditions({ reducedMotion: true });
    await showLanguage('fr');
    await openReader(createTestAppStore(), 20);
    await waitFor(() => expect(screen.getByTestId('mushaf-page-20')).toBeOnTheScreen());
    const pager = () => screen.getByTestId('book-pager');
    expect(pager().props.scrollEnabled).toBe(true);
    await act(async () => {
      fireGestureHandler(getByGestureTestId('reader-page-20-double-tap'), [
        { x: WIDTH / 2, y: HEIGHT / 2 },
      ]);
    });
    await waitFor(() => expect(pager().props.scrollEnabled).toBe(false));
    await act(async () => {
      fireGestureHandler(getByGestureTestId('reader-page-20-double-tap'), [
        { x: WIDTH / 2, y: HEIGHT / 2 },
      ]);
    });
    await waitFor(() => expect(pager().props.scrollEnabled).toBe(true));
  });
});

describe('the enlarged page across turns and edges', () => {
  async function zoomIn(page: number) {
    await act(async () => {
      fireGestureHandler(getByGestureTestId(`reader-page-${page}-double-tap`), [
        { x: WIDTH / 2, y: HEIGHT / 2 },
      ]);
    });
    await waitFor(() => expect(screen.getByTestId('book-pager').props.scrollEnabled).toBe(false));
  }

  /** A drag of one finger, `dx` points to the right, from the middle of the page. */
  async function drag(page: number, dx: number) {
    await act(async () => {
      fireGestureHandler(getByGestureTestId(`reader-page-${page}-pan`), [
        { state: State.BEGAN, x: WIDTH / 2, y: HEIGHT / 2, translationX: 0, translationY: 0 },
        { state: State.ACTIVE, x: WIDTH / 2, y: HEIGHT / 2, translationX: 0, translationY: 0 },
        { translationX: dx / 2, translationY: 0 },
        { translationX: dx, translationY: 0 },
        { state: State.END, translationX: dx, translationY: 0 },
      ]);
    });
  }

  beforeEach(async () => {
    setDeviceConditions({ reducedMotion: true });
    await showLanguage('fr');
  });

  it('keeps the zoom when the page turns', async () => {
    await openReader(createTestAppStore(), 20);
    await waitFor(() => expect(screen.getByTestId('mushaf-page-20')).toBeOnTheScreen());
    await zoomIn(20);
    await swipeTo(21);
    // Still enlarged on the next page: the pager stays still.
    expect(screen.getByTestId('book-pager').props.scrollEnabled).toBe(false);
  });

  it('turns the page when a drag goes far enough beyond the edge', async () => {
    const store = createTestAppStore();
    await openReader(store, 20);
    await waitFor(() => expect(screen.getByTestId('mushaf-page-20')).toBeOnTheScreen());
    await zoomIn(20);
    // Far enough to reach the left edge, then past it by more than the distance of a turn.
    await drag(20, WIDTH + READER_CONFIG.zoom.edgeTurnDistance + 10);
    // Dragging right past the left edge brings the next page, 21, in from the left.
    await waitFor(() => expect(store.getState().settings.lastOpenedPage).toBe(21));
  });

  it('does not turn the page for a short push beyond the edge', async () => {
    const store = createTestAppStore();
    await openReader(store, 20);
    await waitFor(() => expect(screen.getByTestId('mushaf-page-20')).toBeOnTheScreen());
    await zoomIn(20);
    await drag(20, WIDTH / 2 + READER_CONFIG.zoom.edgeTurnDistance / 2);
    expect(store.getState().settings.lastOpenedPage).toBe(20);
  });
});

describe('the bars', () => {
  it('a tap on the page hides them, another shows them again', async () => {
    const seeBars = jest.fn<void, [boolean]>();
    const barsVisible = () => seeBars.mock.calls.at(-1)?.[0];
    function Probe() {
      const { model, actions } = useReader(20, { monotonicClock, clock });
      seeBars(model.barsVisible);
      return (
        <ReaderScreen
          model={model}
          actions={actions}
          fontStatus="ready"
          initialPage={20}
          openContents={openContents}
          close={close}
        />
      );
    }
    await render(
      <AppStoreProvider store={createTestAppStore()}>
        <Probe />
      </AppStoreProvider>,
    );
    await fireEvent(screen.getByTestId('reader-pages'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: HEIGHT } },
    });
    await waitFor(() => expect(screen.getByTestId('mushaf-page-20')).toBeOnTheScreen());
    expect(barsVisible()).toBe(true);
    await act(() => fireGestureHandler(getByGestureTestId('reader-page-20-tap')));
    expect(barsVisible()).toBe(false);
    await act(() => fireGestureHandler(getByGestureTestId('reader-page-20-tap')));
    expect(barsVisible()).toBe(true);
  });
});

describe('a line wider than the column', () => {
  it('is drawn smaller until it fits, and the others keep the page size', async () => {
    await openReader(createTestAppStore(), 507);
    await waitFor(() => expect(screen.getByTestId('mushaf-page-507')).toBeOnTheScreen());
    const lines = screen.container.queryAll(
      (element) =>
        element.props.accessibilityLanguage === 'ar' &&
        element.props.accessibilityRole !== 'header' &&
        typeof element.props.accessibilityLabel === 'string',
    );
    const wordsOf = (line: (typeof lines)[number]) =>
      line.queryAll(
        (element) => element.type === 'Text' && styleOf(element).fontFamily === fontFamily.quran,
      );
    const sizeOf = (line: (typeof lines)[number]) => styleOf(wordsOf(line)[0]!).fontSize!;
    const fullSize = sizeOf(lines[0]!);
    // The layout gives each word of the first line 40 points: wider than the column in total.
    const words = wordsOf(lines[0]!);
    for (const word of words) {
      await fireEvent(word, 'layout', { nativeEvent: { layout: { width: 40, height: 30 } } });
    }
    expect(sizeOf(lines[0]!)).toBeLessThan(fullSize);
    expect(sizeOf(lines[1]!)).toBe(fullSize);
  });
});

describe('a short line', () => {
  it('is centred with the font space; a line that fills the column is spread', async () => {
    await openReader(createTestAppStore(), 507);
    await waitFor(() => expect(screen.getByTestId('mushaf-page-507')).toBeOnTheScreen());
    const lines = screen.container.queryAll(
      (element) =>
        element.props.accessibilityLanguage === 'ar' &&
        element.props.accessibilityRole !== 'header' &&
        typeof element.props.accessibilityLabel === 'string',
    );
    const wordsOf = (line: (typeof lines)[number]) =>
      line.queryAll(
        (element) => element.type === 'Text' && styleOf(element).fontFamily === fontFamily.quran,
      );
    const layOut = async (line: (typeof lines)[number], width: number) => {
      for (const word of wordsOf(line)) {
        await fireEvent(word, 'layout', { nativeEvent: { layout: { width, height: 30 } } });
      }
    };
    // The first line gets 1 point a word: far under 60 % of the column.
    await layOut(lines[0]!, 1);
    expect(styleOf(lines[0]!).justifyContent).toBe('center');
    // The second gets words that, with the font space, fill about 90 % of it.
    const count = wordsOf(lines[1]!).length;
    const column = WIDTH - 2 * PAGE_SIDE_ROOM;
    await layOut(lines[1]!, (column * 0.9) / count - 4);
    expect(styleOf(lines[1]!).justifyContent).toBe('space-between');
  });
});

describe('the states', () => {
  it('shows no page before the Quran font is ready', async () => {
    await openReader(createTestAppStore(), 12, 'loading');
    expect(screen.queryByTestId('book-pager')).toBeNull();
  });

  it('says the text is unavailable when the font cannot be loaded, and leads to the contents', async () => {
    await render(
      <AppStoreProvider store={createTestAppStore()}>
        <Reader page={12} fontStatus="failed" />
      </AppStoreProvider>,
    );
    expect(screen.getByText('Texte indisponible')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Ouvrir le sommaire' }));
    expect(openContents).toHaveBeenCalled();
  });

  it('says a page that does not exist was not found', async () => {
    await render(<ReaderNotFound openContents={openContents} />);
    expect(screen.getByRole('header', { name: 'Page introuvable' })).toBeOnTheScreen();
    expect(
      screen.getByText('Le mushaf compte 604 pages. Choisis une page entre 1 et 604.'),
    ).toBeOnTheScreen();
  });

  it('gives every SwiftUI view a host on an iPhone', async () => {
    await renderOnIOS(<ReaderNotFound openContents={openContents} />);
  });
});
