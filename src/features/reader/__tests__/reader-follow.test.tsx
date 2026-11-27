/**
 * The green microphone of the reader follows the recitation (owner's decision, 25 November 2026;
 * docs/specs/reader.md, 3b), with the SIMULATED speech engine: the word just recited lights up,
 * a word left out is flagged with the bar saying which, the scroll follows, stop and the
 * background end the listening, and a page followed whole counts as read.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, AppState, FlatList } from 'react-native';

import { quranRepository, quranStructure } from '@/data/quran';
import { SpeechEngineError, type SpeechActivity, type SpeechEngine } from '@/domain/listening';
import { splitVerseWords, type VerseRef } from '@/domain/quran';
import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import {
  createSimulatedSpeechEngine,
  type SimulatedScript,
} from '@/features/listening/simulated/simulated-speech-engine';
import { AppStoreProvider, type AppStore } from '@/store';
import { createTestAppStore } from '@/store/test-support/test-store';
import { palette } from '@/ui/tokens';
import {
  changeReducedMotion,
  resetDeviceConditions,
  setDeviceConditions,
  styleOf,
} from '@/ui/test-support/environment';

import { forgetReadingProgress } from '../reading-memory';
import { ReaderScreen } from '../reader-screen';
import { useReader } from '../use-reader';
import { useRecitationFollow } from '../use-recitation-follow';
import { useScriptTexts } from '../use-script-texts';

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));
// The system status bar batches its updates on timers that the fake ones of these tests hold.
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-haptics', () => ({
  ...jest.requireActual('expo-haptics'),
  impactAsync: jest.fn(() => Promise.resolve()),
}));

const clock = () => new Date('2026-11-24T10:00:00');
let now = 0;
let script: SimulatedScript = { permission: 'granted', steps: [] };
let engines: SpeechEngine[] = [];

/** When set, the next engines are made by it instead of the simulation. */
let makeEngine: (() => SpeechEngine) | null = null;

function createEngine(): SpeechEngine {
  const engine = makeEngine?.() ?? createSimulatedSpeechEngine(script);
  engines.push(engine);
  return engine;
}

function Reader({ page, from }: { page: number; from: VerseRef | null }) {
  const { model, actions } = useReader(page, { monotonicClock: () => now, clock });
  const texts = useScriptTexts(model.script);
  const uthmani = useScriptTexts('uthmani');
  const follow = useRecitationFollow({
    createEngine,
    uthmaniTextOf: uthmani.status === 'ready' ? uthmani.textOf : null,
    onPagesFollowed: actions.countPagesReadAloud,
    autoStartFrom: from,
  });
  return (
    <ReaderScreen
      model={model}
      actions={actions}
      fontStatus="ready"
      texts={texts}
      openContents={jest.fn()}
      close={jest.fn()}
      follow={follow}
    />
  );
}

async function openReader(store: AppStore, page: number, from: VerseRef | null = null) {
  const view = await render(
    <AppStoreProvider store={store}>
      <Reader page={page} from={from} />
    </AppStoreProvider>,
  );
  await waitFor(() => expect(screen.getByTestId(`page-section-${page}`)).toBeOnTheScreen());
  return view;
}

async function play(milliseconds: number) {
  await act(async () => {
    jest.advanceTimersByTime(milliseconds);
    await Promise.resolve();
  });
}

async function uthmaniWords(from: VerseRef, to: VerseRef): Promise<string[]> {
  const words: string[] = [];
  for (let surah = from.surah; surah <= to.surah; surah += 1) {
    for (const verse of await quranRepository.getSurahVerses(surah)) {
      const after = surah > from.surah || verse.verse >= from.verse;
      const before = surah < to.surah || verse.verse <= to.verse;
      if (after && before) words.push(...splitVerseWords(verse.text));
    }
  }
  return words;
}

beforeEach(async () => {
  now = 0;
  engines = [];
  makeEngine = null;
  forgetReadingProgress();
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  jest.mocked(AppState.addEventListener).mockClear();
  setDeviceConditions();
  await showLanguage('fr');
});

afterEach(async () => {
  jest.useRealTimers();
  await resetDeviceConditions();
});

describe('the microphone follows the recitation (voix.png)', () => {
  it('starts from the verse at the reading line, and the floating bar replaces the bottom bar', async () => {
    script = { permission: 'granted', steps: [] };
    await openReader(createTestAppStore(), 294);
    await fireEvent.press(screen.getByRole('button', { name: 'Réciter, suivi par l’appli' }));
    await waitFor(() => expect(screen.getByTestId('follow-bar')).toBeOnTheScreen());
    expect(screen.getByText('J’écoute')).toBeOnTheScreen();
    // The floating bar takes the place of the bottom bar; both float over the text, which stays.
    expect(screen.queryByTestId('reader-bottom-bar', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Réciter, suivi par l’appli' })).toBeNull();
    expect(engines).toHaveLength(1);
  });

  it('lights the word just recited, and flags a word left out with the bar saying which', async () => {
    jest.useFakeTimers();
    script = {
      permission: 'granted',
      steps: [
        { at: 100, words: ['إذ'] },
        { at: 200, words: ['الفتية'] },
      ],
    };
    await openReader(createTestAppStore(), 294, { surah: 18, verse: 10 });
    await waitFor(() => expect(screen.getByTestId('follow-bar')).toBeOnTheScreen());
    await play(150);
    expect(styleOf(screen.getByTestId('verse-18:10-word-0'))).toMatchObject({
      backgroundColor: palette.followCurrentBack.light,
    });
    await play(100);
    const skipped = screen.getByTestId('verse-18:10-word-1');
    expect(styleOf(skipped)).toMatchObject({
      color: palette.followRereadInk.light,
      backgroundColor: palette.followRereadBack.light,
    });
    expect(styleOf(screen.getByTestId('verse-18:10-word-2'))).toMatchObject({
      backgroundColor: palette.followCurrentBack.light,
    });
    const verse = (await quranRepository.getVerse('18:10')).text;
    expect(screen.getByTestId('follow-reread-word')).toHaveTextContent(splitVerseWords(verse)[1]!);
    expect(screen.getByText('Relis ce mot :')).toBeOnTheScreen();
  });

  it('in the simple script, lights the simple words and names the word to read again in it', async () => {
    jest.useFakeTimers();
    script = {
      permission: 'granted',
      steps: [
        { at: 100, words: ['إذ'] },
        { at: 200, words: ['الفتية'] },
      ],
    };
    await openReader(createTestAppStore({ settings: { readerScript: 'imlaei' } }), 294, {
      surah: 18,
      verse: 10,
    });
    await waitFor(() => expect(screen.getByTestId('follow-bar')).toBeOnTheScreen());
    await play(250);
    const simple = splitVerseWords((await quranRepository.getVerse('18:10', 'imlaei')).text);
    expect(screen.getByTestId('verse-18:10-word-1')).toHaveTextContent(simple[1]!);
    expect(screen.getByTestId('follow-reread-word')).toHaveTextContent(simple[1]!);
  });

  it('keeps the text exactly the data’s while it lights its words', async () => {
    jest.useFakeTimers();
    script = { permission: 'granted', steps: [{ at: 100, words: ['إذ'] }] };
    await openReader(createTestAppStore(), 294, { surah: 18, verse: 10 });
    await waitFor(() => expect(screen.getByTestId('follow-bar')).toBeOnTheScreen());
    await play(150);
    const verse = (await quranRepository.getVerse('18:10')).text;
    const words = splitVerseWords(verse);
    words.forEach((word, index) =>
      expect(screen.getByTestId(`verse-18:10-word-${index}`)).toHaveTextContent(word),
    );
  });

  it('scrolls, gliding, to keep the current line at the reading line', async () => {
    jest.useFakeTimers();
    const scrollTo = jest.spyOn(FlatList.prototype, 'scrollToOffset');
    script = { permission: 'granted', steps: [{ at: 100, words: ['إذ'] }] };
    await openReader(createTestAppStore(), 294, { surah: 18, verse: 10 });
    await waitFor(() => expect(screen.getByTestId('follow-bar')).toBeOnTheScreen());
    // The layout a phone would give: the page, its segment, its paragraph, and the scroll's size.
    await fireEvent(screen.getByTestId('page-cell-294'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 2000 } },
    });
    await fireEvent(screen.getByTestId('page-294-segment-0'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 2000 } },
    });
    await fireEvent(screen.getByTestId('verses-18-5-box'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 1960 } },
    });
    await fireEvent(screen.getByTestId('reader-scroll'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 600 } },
    });
    // As soon as the page and its paragraph are measured, the first word goes to the reading line.
    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ animated: true, offset: expect.any(Number) }),
    );
    scrollTo.mockRestore();
  });

  it('jumps instead of gliding with Reduce Motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const scrollTo = jest.spyOn(FlatList.prototype, 'scrollToOffset');
    script = { permission: 'granted', steps: [] };
    await openReader(createTestAppStore(), 294, { surah: 18, verse: 10 });
    await changeReducedMotion(true);
    await waitFor(() => expect(screen.getByTestId('follow-bar')).toBeOnTheScreen());
    for (const [testID, height] of [
      ['page-cell-294', 2000],
      ['page-294-segment-0', 2000],
      ['verses-18-5-box', 1960],
      ['reader-scroll', 600],
    ] as const) {
      await fireEvent(screen.getByTestId(testID), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 390, height } },
      });
    }
    await waitFor(() =>
      expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ animated: false })),
    );
    scrollTo.mockRestore();
  });

  it('stops on the stop button, and closes the microphone', async () => {
    script = { permission: 'granted', steps: [] };
    await openReader(createTestAppStore(), 294, { surah: 18, verse: 10 });
    await waitFor(() => expect(screen.getByTestId('follow-bar')).toBeOnTheScreen());
    const stop = jest.spyOn(engines[0]!, 'stop');
    await fireEvent.press(screen.getByRole('button', { name: 'Arrêter l’écoute' }));
    expect(stop).toHaveBeenCalled();
    expect(screen.queryByTestId('follow-bar')).toBeNull();
    expect(screen.getByRole('button', { name: 'Réciter, suivi par l’appli' })).toBeOnTheScreen();
  });

  it('stops when the app leaves the foreground (a call, the phone locked)', async () => {
    script = { permission: 'granted', steps: [] };
    await openReader(createTestAppStore(), 294, { surah: 18, verse: 10 });
    await waitFor(() => expect(screen.getByTestId('follow-bar')).toBeOnTheScreen());
    const handlers = jest
      .mocked(AppState.addEventListener)
      .mock.calls.filter(([event]) => event === 'change')
      .map(([, handler]) => handler as (state: string) => void);
    await act(async () => {
      for (const handler of handlers) handler('background');
    });
    expect(screen.queryByTestId('follow-bar')).toBeNull();
  });

  it('keeps following while the system asks for the microphone (the app is only inactive)', async () => {
    script = { permission: 'granted', steps: [] };
    await openReader(createTestAppStore(), 294, { surah: 18, verse: 10 });
    await waitFor(() => expect(screen.getByTestId('follow-bar')).toBeOnTheScreen());
    const handlers = jest
      .mocked(AppState.addEventListener)
      .mock.calls.filter(([event]) => event === 'change')
      .map(([, handler]) => handler as (state: string) => void);
    await act(async () => {
      for (const handler of handlers) handler('inactive');
    });
    expect(screen.getByTestId('follow-bar')).toBeOnTheScreen();
  });

  it('says it hears the voice, and shows the words heard, faintly', async () => {
    let tell: (activity: SpeechActivity) => void = () => undefined;
    makeEngine = () => {
      const engine = createSimulatedSpeechEngine({ permission: 'granted', steps: [] });
      return {
        ...engine,
        onActivity: (listener) => {
          tell = listener;
          return () => undefined;
        },
      };
    };
    await openReader(createTestAppStore(), 294, { surah: 18, verse: 10 });
    await waitFor(() => expect(screen.getByTestId('follow-bar')).toBeOnTheScreen());
    expect(screen.getByTestId('follow-title')).toHaveTextContent('J’écoute');
    await act(async () => tell({ voice: true, transcribing: false, partial: ['إذ', 'أوى'] }));
    expect(screen.getByTestId('follow-title')).toHaveTextContent('Je t’entends');
    expect(screen.getByTestId('follow-heard')).toHaveTextContent('إذ أوى');
  });

  it('names the fix when the voice model is missing', async () => {
    makeEngine = () => ({
      ...createSimulatedSpeechEngine({ permission: 'granted', steps: [] }),
      start: () => Promise.reject(new SpeechEngineError('model-missing', 'absent')),
    });
    await openReader(createTestAppStore(), 294, { surah: 18, verse: 10 });
    await waitFor(() => expect(screen.getByTestId('reader-follow-message')).toBeOnTheScreen());
    expect(screen.getByTestId('reader-follow-message')).toHaveTextContent(/Modèle vocal absent/);
  });

  it('stops after a silence', async () => {
    jest.useFakeTimers();
    script = { permission: 'granted', steps: [] };
    await openReader(createTestAppStore(), 294, { surah: 18, verse: 10 });
    await waitFor(() => expect(screen.getByTestId('follow-bar')).toBeOnTheScreen());
    await play(21_000);
    expect(screen.queryByTestId('follow-bar')).toBeNull();
  });

  it('says so when the microphone is refused, and follows nothing', async () => {
    script = { permission: 'undetermined', answer: 'denied', steps: [] };
    await openReader(createTestAppStore(), 294, { surah: 18, verse: 10 });
    await waitFor(() => expect(screen.getByTestId('reader-follow-message')).toBeOnTheScreen());
    expect(screen.getByTestId('reader-follow-message')).toHaveTextContent(/Réglages/);
    expect(screen.queryByTestId('follow-bar')).toBeNull();
  });
});

describe('a page followed whole by the voice counts as read', () => {
  it('records page 604 once its every word was recited, without waiting, and the pill says so', async () => {
    jest.useFakeTimers();
    const first = quranStructure.firstVerseOfPage(604);
    const words = await uthmaniWords(first, { surah: 114, verse: 6 });
    script = { permission: 'granted', steps: [{ at: 100, words }] };
    const store = createTestAppStore();
    await openReader(store, 604, first);
    await waitFor(() => expect(screen.getByTestId('follow-bar')).toBeOnTheScreen());
    await play(150);
    await play(10);
    expect(store.getState().journal.map((entry) => entry.page)).toEqual([604]);
    // Page 604 is outside the hizb in progress: its drop waters the garden.
    expect(screen.getByTestId('reader-feedback-content')).toHaveProp(
      'accessibilityLabel',
      'Une goutte pour ton jardin, 0 page sur 11 du hizb 1',
    );
  });

  it('does not count a page the recitation started in the middle of', async () => {
    jest.useFakeTimers();
    const words = await uthmaniWords({ surah: 113, verse: 1 }, { surah: 114, verse: 6 });
    script = { permission: 'granted', steps: [{ at: 100, words }] };
    const store = createTestAppStore();
    await openReader(store, 604, { surah: 113, verse: 1 });
    await waitFor(() => expect(screen.getByTestId('follow-bar')).toBeOnTheScreen());
    await play(200);
    expect(store.getState().journal).toEqual([]);
  });
});
