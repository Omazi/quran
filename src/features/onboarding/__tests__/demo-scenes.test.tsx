import { act, render, screen } from '@testing-library/react-native';
import { useEffect, type ReactElement } from 'react';

import { quranRepository } from '@/data/quran';
import { renderWithStore } from '@/features/settings/test-support/render-with-store';
import { storyMotion } from '@/ui';
import { resetDeviceConditions, setDeviceConditions } from '@/ui/test-support/environment';

import { demoVoiceLevel, useDemoVoice } from '../scenes/use-demo-voice';
import { RecognitionScene } from '../scenes/recognition-scene';
import { VOICE_DEMO_REST, VOICE_DEMO_STEPS, VoiceScene } from '../scenes/voice-scene';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(async () => {
  jest.useRealTimers();
  await resetDeviceConditions();
});

const HIDDEN = { includeHiddenElements: true };

describe('the made-up voice of the demonstrations', () => {
  it('is always the same, and stays between 0 and 1', () => {
    const levels = Array.from({ length: 200 }, (_, step) => demoVoiceLevel(step));
    expect(levels).toEqual(Array.from({ length: 200 }, (_, step) => demoVoiceLevel(step)));
    for (const level of levels) {
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
    }
    // It has syllables and silences: the rosette needs both.
    expect(Math.max(...levels)).toBeGreaterThan(0.6);
    expect(Math.min(...levels)).toBeLessThan(0.2);
  });

  it('sends its levels to the listeners only while it is active, and stops when they leave', async () => {
    jest.useFakeTimers();
    const heard: number[] = [];
    function Probe({ isActive }: { isActive: boolean }) {
      const subscribe = useDemoVoice(isActive);
      useEffectOnce(() => subscribe((level) => heard.push(level)));
      return null;
    }
    const { rerender } = await renderProbe(<Probe isActive={false} />);
    await act(async () => jest.advanceTimersByTime(storyMotion.demoLevelMs * 5));
    expect(heard).toEqual([]);

    await rerender(<Probe isActive />);
    await act(async () => jest.advanceTimersByTime(storyMotion.demoLevelMs * 5));
    expect(heard).toHaveLength(5);

    await rerender(<Probe isActive={false} />);
    await act(async () => jest.advanceTimersByTime(storyMotion.demoLevelMs * 5));
    expect(heard).toHaveLength(5);
  });
});

describe('the demonstration of the following of the recitation', () => {
  it('goes through the words, leaves one out, marks it to read again, then reads it', () => {
    expect(VOICE_DEMO_STEPS[0]).toEqual({ next: 0, current: null, reread: null });
    // A word is marked at some step, and it is read at a later one.
    const marked = VOICE_DEMO_STEPS.findIndex(({ reread }) => reread !== null);
    const reread = VOICE_DEMO_STEPS[marked]?.reread;
    expect(marked).toBeGreaterThan(0);
    const cleared = VOICE_DEMO_STEPS.findIndex(
      ({ reread: word }, step) => step > marked && word === null,
    );
    expect(cleared).toBeGreaterThan(marked);
    // The word marked was left out: the word heard after it is further on.
    expect(VOICE_DEMO_STEPS[marked]?.current).toBeGreaterThan(reread ?? Infinity);
    // The picture at rest is a moment where a word is marked.
    expect(VOICE_DEMO_REST.reread).toBe(reread);
  });

  it('shows the words of Al-Kahf 18:10 as the data layer gives them, in the Quran font', async () => {
    setDeviceConditions({ reducedMotion: true });
    await renderWithStore(<VoiceScene isShown />);
    const first = await screen.findByTestId('follow-word-0', HIDDEN);
    const page = await quranRepository.getPage(294);
    const words = page.lines
      .flatMap((line) => (line.kind === 'text' ? line.words : []))
      .filter((word) => word.verseKey === '18:10');
    expect(first.props.children).toBe(words[0]?.text);
    expect(screen.getByTestId('follow-word-11', HIDDEN).props.children).toBe(words[11]?.text);
  });

  it('with reduced motion, stands still on the moment a word is marked, with its bar', async () => {
    setDeviceConditions({ reducedMotion: true });
    await renderWithStore(<VoiceScene isShown />);
    await screen.findByTestId('follow-word-0', HIDDEN);
    // The word to read again is named in the bar, as the real bar names it.
    expect(screen.getByText('Relis ce mot :', HIDDEN)).toBeOnTheScreen();
    expect(screen.getByTestId('follow-reread-word', HIDDEN)).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: /^Lecture à voix haute/ })).toBeOnTheScreen();
    // Nothing moves: the bar's meter has no voice to follow.
    jest.useFakeTimers();
    await act(async () => jest.advanceTimersByTime(storyMotion.voiceRestMs * 3));
    expect(screen.getByText('Relis ce mot :', HIDDEN)).toBeOnTheScreen();
  });

  it('moves on step by step while shown, and starts again after a rest', async () => {
    jest.useFakeTimers();
    await renderWithStore(<VoiceScene isShown />);
    await act(async () => {});
    // Before the first word is recited the bar only follows.
    expect(screen.getByText('Suis ta récitation sur la page', HIDDEN)).toBeOnTheScreen();
    const marked = VOICE_DEMO_STEPS.findIndex(({ reread }) => reread !== null);
    await act(async () => jest.advanceTimersByTime(storyMotion.voiceStepMs * marked));
    expect(screen.getByText('Relis ce mot :', HIDDEN)).toBeOnTheScreen();
    await act(async () =>
      jest.advanceTimersByTime(
        storyMotion.voiceStepMs * (VOICE_DEMO_STEPS.length - marked) + storyMotion.voiceRestMs,
      ),
    );
    expect(screen.getByText('Suis ta récitation sur la page', HIDDEN)).toBeOnTheScreen();
  });
});

describe('the demonstration of the listening', () => {
  it('shows the real rosette while it listens, and the card of the passage found after', async () => {
    jest.useFakeTimers();
    await renderWithStore(<RecognitionScene isShown />);
    await act(async () => {});
    expect(screen.getByTestId('onboarding-listening-panel')).toBeOnTheScreen();
    expect(screen.getByTestId('rosette-outer', HIDDEN)).toBeOnTheScreen();
    expect(screen.queryByTestId('rosette-petals', HIDDEN)).toBeOnTheScreen();
    // The card of the result is there to be found, "Passage reconnu".
    expect(screen.getByText('Passage reconnu', HIDDEN)).toBeOnTheScreen();
  });

  it('with reduced motion, shows the still rosette of a result and no moving petal', async () => {
    setDeviceConditions({ reducedMotion: true });
    await renderWithStore(<RecognitionScene isShown />);
    await act(async () => {});
    expect(screen.queryByTestId('rosette-outer', HIDDEN)).toBeNull();
    expect(screen.queryByTestId('rosette-petals', HIDDEN)).toBeNull();
    expect(screen.getByRole('image', { name: /^Passage reconnu à l’écoute/ })).toBeOnTheScreen();
  });
});

function useEffectOnce(effect: () => void | (() => void)) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
}

async function renderProbe(tree: ReactElement) {
  const view = await render(tree);
  return { rerender: (next: ReactElement) => view.rerender(next) };
}
