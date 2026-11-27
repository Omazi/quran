/**
 * The second pass of D47: the words that speak to the person in the home, listening, reader,
 * settings and garden texts agree with the gender they said, and stay as they were when they said
 * nothing.
 */
import { screen } from '@testing-library/react-native';

import { RecoveringBanner } from '@/features/home/notice-banner';
import { RecognizeCard } from '@/features/reader/recognize-card';
import { renderWithStore } from '@/features/settings/test-support/render-with-store';
import type { Gender } from '@/domain/shared/gender';
import type { AppLanguage } from '@/i18n';
import { resetDeviceConditions } from '@/ui/test-support/environment';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(resetDeviceConditions);

async function renderIn(node: React.ReactElement, language: AppLanguage, gender: Gender | null) {
  return renderWithStore(node, { language, settings: { gender } });
}

describe('the notice of a garden that recovers', () => {
  it.each([
    ['male', 'واصل غدًا'],
    [null, 'واصل غدًا'],
    ['female', 'واصلي غدًا'],
  ] as const)('in Arabic, for a person who is %s: "%s"', async (gender, expected) => {
    await renderIn(<RecoveringBanner />, 'ar', gender);

    expect(screen.getByText(new RegExp(expected))).toBeOnTheScreen();
  });

  it.each([['female'], [null]] as const)(
    'is the plain text in French, for a person who is %s',
    async (gender) => {
      await renderIn(<RecoveringBanner />, 'fr', gender);

      expect(screen.getByTestId('home-notice-recovering').props.accessibilityLabel).toBe(
        'L’eau est revenue. Ton jardin reprend des forces. Continue demain.',
      );
    },
  );
});

describe('the card that recognises a passage', () => {
  it.each([
    ['male', 'تعرّف', 'أسمِع التطبيق'],
    [null, 'تعرّف', 'أسمِع التطبيق'],
    ['female', 'تعرّفي', 'أسمِعي التطبيق'],
  ] as const)('in Arabic, for a person who is %s', async (gender, action, sentence) => {
    await renderIn(<RecognizeCard onRecognize={jest.fn()} />, 'ar', gender);

    expect(screen.getByTestId('contents-recognize-card-button')).toHaveTextContent(action);
    expect(screen.getByText(new RegExp(sentence))).toBeOnTheScreen();
  });
});
