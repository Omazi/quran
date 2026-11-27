import { render, screen } from '@testing-library/react-native';

import type { LocalDate } from '@/domain/shared/local-date';
import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import { initI18n, type AppLanguage } from '@/i18n';
import { resetDeviceConditions, setDeviceConditions } from '@/ui/test-support/environment';
import { shareCardShape } from '@/ui';

import { ShareCard } from '../share-card';
import { buildShareCardContent } from '../share-card-content';

afterEach(resetDeviceConditions);

const HIDDEN = { includeHiddenElements: true } as const;
const UNIT = 1 / 3;

async function show(language: AppLanguage, name: string | null = null, withDua = true) {
  await showLanguage(language);
  const i18n = initI18n(language);
  const content = buildShareCardContent(
    { khatm: 4, styleId: 'mountain-garden', completedOn: '2026-05-09' as LocalDate, days: 40 },
    {
      t: i18n.getFixedT(language, 'gardens'),
      appName: i18n.getFixedT(language, 'common')('appName'),
      language,
      name,
      withDua,
    },
  );
  await render(<ShareCard content={content} unit={UNIT} />);
  return content;
}

describe('the card of a shared badge', () => {
  it.each([
    ['fr', 'Khatma n°4 terminée', '9 mai 2026', 'Jannatuk'],
    ['en', 'Khatma no. 4 complete', 'May 9, 2026', 'Jannatuk'],
    ['ar', 'تمّت الختمة رقم 4', undefined, 'جنتك'],
  ] as const)('says its words in %s', async (language, title, date, appName) => {
    await show(language);
    expect(screen.getByText(title, HIDDEN)).toBeOnTheScreen();
    if (date !== undefined) expect(screen.getByText(date, HIDDEN)).toBeOnTheScreen();
    expect(screen.getByText(appName, HIDDEN)).toBeOnTheScreen();
    expect(screen.getByText('60', HIDDEN)).toBeOnTheScreen();
    expect(screen.getByText('604', HIDDEN)).toBeOnTheScreen();
    expect(screen.getByText('40', HIDDEN)).toBeOnTheScreen();
    expect(screen.getByTestId('share-card-dua', HIDDEN)).toHaveTextContent('تقبّل الله منك');
  });

  it('is 1080 × 1350 design units, whatever the screen: one unit is one pixel of the picture', async () => {
    await show('fr');
    const card = screen.getByTestId('share-card', HIDDEN);
    expect(card).toHaveStyle({
      width: shareCardShape.width * UNIT,
      height: shareCardShape.height * UNIT,
    });
    expect(shareCardShape.width / shareCardShape.height).toBeCloseTo(4 / 5);
  });

  it('carries no name by default', async () => {
    await show('fr');
    expect(screen.queryByTestId('share-card-name', HIDDEN)).not.toBeOnTheScreen();
  });

  it('shows the name given, as written', async () => {
    await show('fr', 'Omar');
    expect(screen.getByTestId('share-card-name', HIDDEN)).toHaveTextContent('Omar');
  });

  it('leaves the invocation out when asked to', async () => {
    await show('fr', null, false);
    expect(screen.queryByTestId('share-card-dua', HIDDEN)).not.toBeOnTheScreen();
  });

  it('is light on warm paper even at night, and never follows the text size', async () => {
    setDeviceConditions({ os: 'android', scheme: 'dark', fontScale: 2 });
    await show('fr');
    expect(screen.getByTestId('share-card', HIDDEN)).toHaveStyle({ backgroundColor: '#FBF7EC' });
    expect(screen.getByText('Khatma n°4 terminée', HIDDEN)).toHaveProp('allowFontScaling', false);
    expect(screen.getByText('Khatma n°4 terminée', HIDDEN)).toHaveStyle({ color: '#1D2A23' });
  });

  it('is described as one picture, with the number of the khatma', async () => {
    await show('fr');
    expect(screen.getByLabelText('Image du badge de la khatma 4', HIDDEN)).toBeOnTheScreen();
  });
});
