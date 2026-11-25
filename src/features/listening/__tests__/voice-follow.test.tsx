import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { quranRepository, quranStructure } from '@/data/quran';
import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import { listeningPalette } from '@/ui/listening-tokens';
import { appColors } from '@/ui/tokens';
import {
  directionDependentStyles,
  resetDeviceConditions,
  setDeviceConditions,
  styleOf,
  touchTargetHeight,
} from '@/ui/test-support/environment';

import { parseFollowParams } from '../follow/follow-params';
import { VoiceFollowScreen } from '../follow/voice-follow-screen';
import { createScenarioEngine } from '../simulated/scenarios';
import { loadQuranPage } from '../verse-index-source';

// A mock factory runs before imports: `require` is the only way to load the stand-in here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('../test-support/reanimated-stand-in'));
jest.mock('@/features/reader', () => ({ useQuranFont: () => 'ready' }));

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const onClose = jest.fn();

afterEach(async () => {
  jest.useRealTimers();
  onClose.mockClear();
  await resetDeviceConditions();
});

async function wait(milliseconds: number) {
  await act(async () => {
    for (let elapsed = 0; elapsed < milliseconds; elapsed += 100) {
      jest.advanceTimersByTime(100);
      await Promise.resolve();
      await Promise.resolve();
    }
  });
}

/** The index, in the page's reading order, of the word at `position` in verse `key`. */
async function indexOf(key: string, position: number): Promise<number> {
  const page = await quranRepository.getPage(294);
  const words = page.lines.flatMap((line) => (line.kind === 'text' ? line.words : []));
  return words.findIndex((word) => word.verseKey === key && word.position === position);
}

async function showFollow(conditions: Parameters<typeof setDeviceConditions>[0] = {}) {
  setDeviceConditions(conditions);
  await showLanguage(conditions.rightToLeft === true ? 'ar' : 'fr');
  jest.useFakeTimers();
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <VoiceFollowScreen
        engine={createScenarioEngine('follow')}
        page={294}
        from={{ surah: 18, verse: 10 }}
        structure={quranStructure}
        loadPage={loadQuranPage}
        onClose={onClose}
      />
    </SafeAreaProvider>,
  );
  // The page is read, the microphone opened, then « إذ » and « الفتية » are heard.
  await wait(6000);
}

describe('the voice-following screen (voix.png)', () => {
  it.each(['light', 'dark'] as const)(
    '%s: marks the word left out in red on rose, and the word just recited on gold',
    async (scheme) => {
      await showFollow({ scheme });
      const skipped = screen.getByTestId(`follow-word-${await indexOf('18:10', 2)}`);
      const recited = screen.getByTestId(`follow-word-${await indexOf('18:10', 3)}`);
      const upcoming = screen.getByTestId(`follow-word-${await indexOf('18:10', 4)}`);
      const before = screen.getByTestId(`follow-word-${await indexOf('18:9', 3)}`);
      expect(styleOf(skipped)).toMatchObject({
        color: listeningPalette.followRereadInk[scheme],
        backgroundColor: listeningPalette.followRereadBack[scheme],
      });
      expect(styleOf(recited).backgroundColor).toBe(listeningPalette.followCurrentBack[scheme]);
      expect(JSON.stringify(styleOf(upcoming).color)).toContain(
        listeningPalette.followUpcomingInk[scheme],
      );
      expect(JSON.stringify(styleOf(before).color)).not.toContain(
        listeningPalette.followUpcomingInk[scheme],
      );
    },
  );

  it('writes every word exactly as the data layer gives it', async () => {
    await showFollow();
    const page = await quranRepository.getPage(294);
    const words = page.lines.flatMap((line) => (line.kind === 'text' ? line.words : []));
    words.forEach((word, index) => {
      expect(screen.getByTestId(`follow-word-${index}`)).toHaveTextContent(word.text);
    });
  });

  it('the bar says it listens and which word to read again, as one sentence', async () => {
    await showFollow();
    expect(screen.getByText('J’écoute')).toBeOnTheScreen();
    expect(screen.getByText('Relis ce mot :')).toBeOnTheScreen();
    expect(screen.getByTestId('follow-reread-word')).toHaveTextContent('أَوَى');
    expect(screen.getByLabelText('J’écoute. Relis ce mot : أَوَى')).toBeOnTheScreen();
  });

  it('names the surah, the juz and the page above the page', async () => {
    await showFollow();
    expect(screen.getByRole('header', { name: 'Al-Kahf' })).toBeOnTheScreen();
    expect(screen.getByText('Juz 15, page 294')).toBeOnTheScreen();
  });

  it('stop and back close the screen; both are 44-point targets', async () => {
    await showFollow();
    expect(touchTargetHeight(screen.getByTestId('follow-stop'))).toBeGreaterThanOrEqual(44);
    expect(touchTargetHeight(screen.getByTestId('follow-back'))).toBeGreaterThanOrEqual(44);
    await fireEvent.press(screen.getByRole('button', { name: 'Arrêter l’écoute' }));
    await wait(100);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asking for more contrast raises the words still to come to full ink', async () => {
    // Android tells the app; on iOS the dynamic colour carries its high-contrast value.
    await showFollow({ os: 'android', highContrast: true });
    const upcoming = screen.getByTestId(`follow-word-${await indexOf('18:10', 4)}`);
    expect(styleOf(upcoming).color).toBe(appColors.ink.light);
  });

  it('on an iPhone, the words still to come are a dynamic colour with full ink at high contrast', async () => {
    await showFollow({ os: 'ios' });
    const upcoming = screen.getByTestId(`follow-word-${await indexOf('18:10', 4)}`);
    expect(styleOf(upcoming).color).toEqual(
      expect.objectContaining({
        dynamic: expect.objectContaining({
          highContrastLight: appColors.ink.light,
          highContrastDark: appColors.ink.dark,
        }),
      }),
    );
  });

  it('in Arabic, nothing is placed by a physical side', async () => {
    await showFollow({ rightToLeft: true });
    expect(screen.getByRole('header', { name: 'الكهف' })).toBeOnTheScreen();
    expect(directionDependentStyles(screen.getByTestId('voice-follow'))).toEqual([]);
  });
});

describe('the address of the voice-following trial', () => {
  it('follows 18:10 on its page when it names nothing', () => {
    expect(parseFollowParams(undefined, undefined)).toEqual({
      page: 294,
      from: { surah: 18, verse: 10 },
    });
  });

  it('reads a page and a verse, and refuses a page outside the mushaf', () => {
    expect(parseFollowParams('1', '1:1')).toEqual({ page: 1, from: { surah: 1, verse: 1 } });
    expect(parseFollowParams('12', 'nope')).toEqual({ page: 12, from: undefined });
    expect(parseFollowParams('605', undefined)).toBeNull();
    expect(parseFollowParams('x', undefined)).toBeNull();
  });
});

describe('the files of the voice-following view', () => {
  // The project compiles without Node's type definitions: the functions needed are typed here.
  const { readdirSync, readFileSync } = jest.requireActual<{
    readdirSync: (path: string) => string[];
    readFileSync: (path: string, encoding: 'utf8') => string;
  }>('node:fs');
  const { resolve } = jest.requireActual<{ resolve: (...segments: string[]) => string }>(
    'node:path',
  );
  const folder = resolve(expect.getState().testPath ?? '', '../../follow');
  const files = readdirSync(folder).filter((name) => name.endsWith('.tsx'));

  it.each(files)('%s writes no colour of its own', (name) => {
    const source = readFileSync(resolve(folder, name), 'utf8');
    expect(source).not.toMatch(/['"]#[0-9A-Fa-f]{3,8}['"]/);
    expect(source).not.toMatch(/rgba?\(/);
  });
});
