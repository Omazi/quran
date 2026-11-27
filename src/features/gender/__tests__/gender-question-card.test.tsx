/**
 * The one-time question on the profile tab (owner decision of 26 November 2026, "on demandera le
 * genre"): light, optional, never in the way, and asked once.
 */
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithStore } from '@/features/settings/test-support/render-with-store';
import type { AppLanguage } from '@/i18n';
import type { AppSettings } from '@/store';
import {
  directionDependentStyles,
  resetDeviceConditions,
  setDeviceConditions,
  touchTargetHeight,
} from '@/ui/test-support/environment';

import { GenderQuestionCard } from '../gender-question-card';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(resetDeviceConditions);

async function renderCard(language: AppLanguage = 'fr', settings: Partial<AppSettings> = {}) {
  return renderWithStore(<GenderQuestionCard />, { language, settings });
}

describe('the gender question card', () => {
  it('asks in French, with a short text that says it is optional and shown to friends', async () => {
    await renderCard('fr');

    expect(screen.getByTestId('gender-question')).toBeOnTheScreen();
    expect(screen.getByText('Pour s’adresser à toi correctement')).toBeOnTheScreen();
    expect(screen.getByText(/facultatif/)).toBeOnTheScreen();
    expect(screen.getByText(/Tes proches le voient/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Un homme' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Une femme' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Préférer ne pas dire' })).toBeOnTheScreen();
  });

  it.each([
    ['en', 'A man', 'A woman', 'Prefer not to say'],
    ['ar', 'رجل', 'امرأة', 'أفضّل ألّا أقول'],
  ] as const)('is translated in %s', async (language, man, woman, none) => {
    await renderCard(language);

    expect(screen.getByRole('button', { name: man })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: woman })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: none })).toBeOnTheScreen();
  });

  it('"Une femme" records female and the question is gone', async () => {
    const store = await renderCard();

    await fireEvent.press(screen.getByRole('button', { name: 'Une femme' }));

    expect(store.getState().settings).toMatchObject({ gender: 'female', genderAsked: true });
    expect(screen.queryByTestId('gender-question')).not.toBeOnTheScreen();
  });

  it('"Un homme" records male', async () => {
    const store = await renderCard();

    await fireEvent.press(screen.getByRole('button', { name: 'Un homme' }));

    expect(store.getState().settings).toMatchObject({ gender: 'male', genderAsked: true });
  });

  it('"Préférer ne pas dire" records nothing said, and the question is not asked again', async () => {
    const store = await renderCard();

    await fireEvent.press(screen.getByRole('button', { name: 'Préférer ne pas dire' }));

    expect(store.getState().settings).toMatchObject({ gender: null, genderAsked: true });
    expect(screen.queryByTestId('gender-question')).not.toBeOnTheScreen();
  });

  it('is not shown to someone who already answered, on this phone or another', async () => {
    await renderCard('fr', { gender: 'male', genderAsked: true });
    expect(screen.queryByTestId('gender-question')).not.toBeOnTheScreen();
  });

  it('is a group of buttons for VoiceOver, named by its question, with 44-point targets', async () => {
    await renderCard();

    const card = screen.getByTestId('gender-question');
    expect(card).toHaveProp('accessibilityLabel', 'Pour s’adresser à toi correctement');
    for (const name of ['Un homme', 'Une femme', 'Préférer ne pas dire']) {
      expect(touchTargetHeight(screen.getByRole('button', { name }))).toBeGreaterThanOrEqual(44);
    }
  });

  it('is laid out from the start edge, in both directions', async () => {
    setDeviceConditions({ scheme: 'light', rightToLeft: true });
    await renderCard('ar');

    expect(directionDependentStyles(screen.getByTestId('gender-question'))).toEqual([]);
  });
});
