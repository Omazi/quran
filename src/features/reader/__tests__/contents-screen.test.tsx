/**
 * The Quran tab (docs/specs/reader.md, section 1): the page to resume, a page by its number, the
 * 114 surahs and the 30 juz with their hizb, in French and in Arabic, light and dark.
 */

import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { EMPTY_JOURNAL, recordPageRead } from '@/domain/khatm';
import { parseLocalDate } from '@/domain/shared/local-date';
import { SCREEN_CONDITIONS, showLanguage } from '@/features/garden/test-support/screen-conditions';
import { AppStoreProvider, type AppStore } from '@/store';
import { createTestAppStore } from '@/store/test-support/test-store';
import { fontFamily } from '@/ui';
import {
  directionDependentStyles,
  renderOnIOS,
  resetDeviceConditions,
  setDeviceConditions,
  styleOf,
} from '@/ui/test-support/environment';
import { appColors } from '@/ui/tokens';

import { ContentsScreen } from '../contents-screen';
import { useContentsModel } from '../use-contents-model';

const openPage = jest.fn();

function Contents() {
  const { model, actions } = useContentsModel(openPage);
  return <ContentsScreen model={model} actions={actions} />;
}

async function renderContents(store: AppStore = createTestAppStore()) {
  await render(
    <AppStoreProvider store={store}>
      <Contents />
    </AppStoreProvider>,
  );
}

beforeEach(() => {
  openPage.mockClear();
});

afterEach(resetDeviceConditions);

describe('the Quran tab', () => {
  it('opens page 1 for a new person, from the one prominent button, named by surah and page', async () => {
    setDeviceConditions();
    await showLanguage('fr');
    await renderContents();
    expect(screen.getByRole('header', { name: 'Coran' })).toBeOnTheScreen();
    const resume = screen.getByRole('button', { name: 'Reprendre · Al-Fatiha · Page 1' });
    await fireEvent.press(resume);
    expect(openPage).toHaveBeenCalledWith(1);
  });

  it('puts "Reprendre" first, then "Aller à la page", then the list', async () => {
    setDeviceConditions();
    await showLanguage('fr');
    await renderContents();
    const order = ['contents-resume', 'contents-go-to-page', 'contents-view', 'contents-search'];
    const all = screen.container.queryAll(
      (element) => typeof element.props.testID === 'string' && order.includes(element.props.testID),
    );
    const firstSeen = order.map((id) => all.findIndex((element) => element.props.testID === id));
    expect(firstSeen.every((index) => index >= 0)).toBe(true);
    expect([...firstSeen].sort((a, b) => a - b)).toEqual(firstSeen);
  });

  it('resumes at the first unread page, then at the last page opened in the reader', async () => {
    setDeviceConditions();
    await showLanguage('fr');
    const day = parseLocalDate('2026-11-24');
    const journal = [1, 2, 3].reduce(
      (current, page) => recordPageRead(current, { page, date: day }),
      EMPTY_JOURNAL,
    );
    await renderContents(createTestAppStore({ journal }));
    expect(
      screen.getByRole('button', { name: 'Reprendre · Al-Baqarah · Page 4' }),
    ).toBeOnTheScreen();

    await renderContents(createTestAppStore({ journal, settings: { lastOpenedPage: 293 } }));
    // Named, like its juz and hizb, by its first verse: page 293 opens on the end of Al-Isra.
    expect(
      screen.getByRole('button', { name: 'Reprendre · Al-Isra · Page 293' }),
    ).toBeOnTheScreen();
  });

  it('lists the 114 surahs with their number, names, place, verses and page', async () => {
    setDeviceConditions();
    await showLanguage('fr');
    await renderContents();
    expect(screen.getAllByTestId(/^contents-surah-/)).toHaveLength(114);
    const kahf = screen.getByRole('button', {
      name: '18. Al-Kahf, الكهف, Mecquoise · 110 versets · Page 293',
    });
    await fireEvent.press(kahf);
    expect(openPage).toHaveBeenCalledWith(293);
  });

  it('draws each Arabic name in the Quran font, in ink', async () => {
    setDeviceConditions({ os: 'android' });
    await showLanguage('fr');
    await renderContents();
    const name = within(screen.getByTestId('contents-surah-18')).getByText('الكهف');
    expect(styleOf(name)).toMatchObject({
      fontFamily: fontFamily.quran,
      color: appColors.ink.light,
    });
  });

  it('filters the surahs as the person types, and says when none matches', async () => {
    setDeviceConditions();
    await showLanguage('fr');
    await renderContents();
    const search = screen.getByLabelText('Rechercher une sourate');
    await fireEvent.changeText(search, 'kahf');
    expect(screen.getAllByTestId(/^contents-surah-/).map((row) => row.props.testID)).toEqual([
      'contents-surah-18',
    ]);
    await fireEvent.changeText(search, '2');
    expect(screen.getAllByTestId(/^contents-surah-/).map((row) => row.props.testID)).toEqual([
      'contents-surah-2',
    ]);
    await fireEvent.changeText(search, 'zzz');
    expect(screen.queryAllByTestId(/^contents-surah-/)).toHaveLength(0);
    expect(screen.getByText('Aucune sourate pour « zzz »')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Effacer la recherche' }));
    expect(screen.getAllByTestId(/^contents-surah-/)).toHaveLength(114);
  });

  it('switches to the 30 juz and their hizb', async () => {
    setDeviceConditions();
    await showLanguage('fr');
    await renderContents();
    await fireEvent.press(screen.getByRole('radio', { name: 'Juz' }));
    expect(screen.queryAllByTestId(/^contents-surah-/)).toHaveLength(0);
    expect(screen.getByText('Juz 30')).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^contents-hizb-/)).toHaveLength(60);
    // Under each hizb, the surah and verse it starts with, and its page.
    expect(
      screen.getByRole('button', { name: 'Hizb 2, Al-Baqarah, verset 75 · Page 11' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: "Hizb 60, Al-A'la, verset 1 · Page 591" }),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('contents-hizb-1'));
    expect(openPage).toHaveBeenCalledWith(1);
  });

  it('opens a page typed by its number, between 1 and 604', async () => {
    setDeviceConditions();
    await showLanguage('fr');
    await renderContents();
    const field = screen.getByLabelText('Page');
    expect(screen.getByRole('button', { name: 'Ouvrir' })).toBeDisabled();
    await fireEvent.changeText(field, '293');
    await fireEvent.press(screen.getByRole('button', { name: 'Ouvrir · Page 293' }));
    expect(openPage).toHaveBeenCalledWith(293);
  });

  it('refuses a page outside 1 to 604, and says the range', async () => {
    setDeviceConditions();
    await showLanguage('fr');
    await renderContents();
    const field = screen.getByLabelText('Page');
    for (const text of ['0', '605']) {
      await fireEvent.changeText(field, text);
      const open = screen.getByRole('button', { name: 'Ouvrir' });
      expect(open).toBeDisabled();
      await fireEvent.press(open);
      expect(screen.getByText('Écris un numéro de page de 1 à 604.')).toBeOnTheScreen();
    }
    await fireEvent.changeText(field, '604');
    await fireEvent.press(screen.getByRole('button', { name: 'Ouvrir · Page 604' }));
    expect(openPage).toHaveBeenCalledTimes(1);
    expect(openPage).toHaveBeenCalledWith(604);
  });

  it.each(SCREEN_CONDITIONS)(
    'reads well in $language, $scheme, and mirrors in Arabic',
    async (conditions) => {
      setDeviceConditions(conditions);
      await showLanguage(conditions.language);
      await renderContents();
      if (conditions.language === 'ar') {
        expect(screen.getByRole('header', { name: 'القرآن' })).toBeOnTheScreen();
        // In Arabic the label carries the number, the name is the row's value; no
        // transliteration.
        expect(screen.getByTestId('contents-surah-18')).toHaveTextContent(/^السورة 18.*الكهف/);
        expect(screen.queryByText('Al-Kahf')).toBeNull();
      }
      expect(directionDependentStyles(screen.getByTestId('contents'))).toEqual([]);
    },
  );

  it('gives every SwiftUI view a host on an iPhone', async () => {
    setDeviceConditions();
    await showLanguage('fr');
    await renderOnIOS(
      <AppStoreProvider store={createTestAppStore()}>
        <Contents />
      </AppStoreProvider>,
    );
  });
});
