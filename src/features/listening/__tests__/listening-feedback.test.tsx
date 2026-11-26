/**
 * What the listening screen says while the engine works, and when it breaks (owner, after the
 * first test on an iPhone: "you never know if it's really listening"). The engine is driven by
 * the test; the passage search is the real one.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { quranStructure } from '@/data/quran';
import {
  SpeechEngineError,
  type SpeechActivity,
  type SpeechEndReason,
  type SpeechEngine,
  type SpeechFailure,
} from '@/domain/listening';
import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import { resetDeviceConditions } from '@/ui/test-support/environment';

import { ListeningScreen } from '../listening-screen';
import { loadQuranVerseIndex, loadQuranVerseText } from '../verse-index-source';

// A mock factory runs before imports: `require` is the only way to load the stand-in here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('../test-support/reanimated-stand-in'));

afterEach(resetDeviceConditions);

function handEngine({
  startError,
  holdStart = false,
}: { startError?: Error; holdStart?: boolean } = {}) {
  const activity = new Set<(activity: SpeechActivity) => void>();
  const ends = new Set<(reason: SpeechEndReason, failure?: SpeechFailure) => void>();
  let release: () => void = () => undefined;
  const engine: SpeechEngine = {
    getMicrophonePermission: async () => 'granted',
    requestMicrophonePermission: async () => 'granted',
    start: () => {
      if (startError !== undefined) return Promise.reject(startError);
      if (!holdStart) return Promise.resolve();
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    },
    stop: async () => undefined,
    onLevel: () => () => undefined,
    onWords: () => () => undefined,
    onEnd: (listener) => {
      ends.add(listener);
      return () => ends.delete(listener);
    },
    onActivity: (listener) => {
      activity.add(listener);
      return () => activity.delete(listener);
    },
  };
  return {
    engine,
    release: () => release(),
    act: (change: Partial<SpeechActivity>) => {
      for (const listener of activity) {
        listener({ voice: false, transcribing: false, partial: [], ...change });
      }
    },
    end: (reason: SpeechEndReason, failure?: SpeechFailure) => {
      for (const listener of ends) listener(reason, failure);
    },
  };
}

const onClose = jest.fn();

async function show(engine: SpeechEngine) {
  await showLanguage('fr');
  await render(
    <ListeningScreen
      engine={engine}
      autoStart
      loadVerseIndex={loadQuranVerseIndex}
      structure={quranStructure}
      loadVerseText={loadQuranVerseText}
      onClose={onClose}
      onOpenPage={jest.fn()}
      onOpenSettings={jest.fn()}
    />,
  );
}

const title = () => screen.getByTestId('listening-title').props.children as string;

describe('while it listens', () => {
  it('says it prepares until the microphone is open, then that it listens', async () => {
    const hand = handEngine({ holdStart: true });
    await show(hand.engine);
    expect(title()).toBe('Un instant…');
    await act(async () => hand.release());
    await waitFor(() => expect(title()).toBe('J’écoute…'));
  });

  it('says it hears the voice, shows the words heard, then says it searches', async () => {
    const hand = handEngine();
    await show(hand.engine);
    await waitFor(() => expect(title()).toBe('J’écoute…'));
    await act(async () => hand.act({ voice: true }));
    expect(title()).toBe('Je t’entends');
    expect(screen.queryByTestId('listening-heard')).toBeNull();
    // Two words, too few to name a passage: the words not final yet are searched too (D45), and
    // « قل هو الله » alone would already name Al-Ikhlas.
    await act(async () => hand.act({ transcribing: true, partial: ['قل', 'هو'] }));
    expect(title()).toBe('Je cherche le passage…');
    expect(screen.getByTestId('listening-heard')).toHaveTextContent('قل هو');
    expect(screen.getByTestId('listening-heard').props.accessibilityLanguage).toBe('ar');
  });
});

describe('when it breaks, it names the fix', () => {
  it('a missing voice model: say so, and only offer to close', async () => {
    const hand = handEngine({ startError: new SpeechEngineError('model-missing', 'absent') });
    await show(hand.engine);
    await waitFor(() => expect(screen.getByTestId('listening-failed')).toBeOnTheScreen());
    expect(screen.getByRole('header', { name: 'Modèle vocal absent' })).toBeOnTheScreen();
    expect(screen.getByText(/Réinstalle l’app/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Écouter à nouveau' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Fermer' })).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('a microphone that gives no sound: say so, and offer to listen again', async () => {
    const hand = handEngine();
    await show(hand.engine);
    await waitFor(() => expect(title()).toBe('J’écoute…'));
    await act(async () => hand.end('failed', 'no-audio'));
    await waitFor(() =>
      expect(screen.getByRole('header', { name: 'Le micro ne donne aucun son' })).toBeOnTheScreen(),
    );
    expect(screen.getByRole('button', { name: 'Écouter à nouveau' })).toBeOnTheScreen();
  });
});
