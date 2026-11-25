/**
 * The Quran tab (docs/specs/reader.md, section 1): the page to resume, a page by its number, the
 * 114 surahs and the 30 juz with their hizb, in French and in Arabic, light and dark.
 */

import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { EMPTY_JOURNAL, recordPageRead } from '@/domain/khatm';
import { parseLocalDate } from '@/domain/shared/local-date';
import { deviceLocalDate } from '@/features/home';
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
import { appColors, fallbackSystemColors, textStyles } from '@/ui/tokens';

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
    // The label is the short action; the surah and the page are its second line.
    const resume = screen.getByRole('button', { name: 'Reprendre, Al-Fatiha · Page 1' });
    expect(within(resume).getByText('Reprendre')).toBeOnTheScreen();
    expect(within(resume).getByText('Al-Fatiha · Page 1')).toBeOnTheScreen();
    await fireEvent.press(resume);
    expect(openPage).toHaveBeenCalledWith(1);
  });

  it('puts "Reprendre" first, then the search field right under it, then the list', async () => {
    setDeviceConditions();
    await showLanguage('fr');
    await renderContents();
    const order = ['contents-resume', 'contents-search', 'contents-view', 'contents-surah-1'];
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
      screen.getByRole('button', { name: 'Reprendre, Al-Baqarah · Page 4' }),
    ).toBeOnTheScreen();

    await renderContents(createTestAppStore({ journal, settings: { lastOpenedPage: 293 } }));
    // Named, like its juz and hizb, by its first verse: page 293 opens on the end of Al-Isra.
    expect(screen.getByRole('button', { name: 'Reprendre, Al-Isra · Page 293' })).toBeOnTheScreen();
  });

  it('shows, under "Reprendre", today\'s pages toward the daily goal, in water', async () => {
    setDeviceConditions({ os: 'android' });
    await showLanguage('fr');
    const today = deviceLocalDate(new Date());
    const journal = [1, 2, 3].reduce(
      (current, page) => recordPageRead(current, { page, date: today }),
      EMPTY_JOURNAL,
    );
    await renderContents(createTestAppStore({ journal, settings: { dailyGoalPages: 5 } }));
    const gauge = screen.getByTestId('contents-today');
    expect(gauge).toHaveTextContent(/^Aujourd’hui3 pages sur 5$/);
    expect(gauge.props.accessibilityValue).toEqual({ text: '3 pages sur 5' });
    // Right under the button, in the same group (layout.md › Visual hierarchy).
    const order = ['contents-resume', 'contents-today', 'contents-search'];
    const all = screen.container.queryAll(
      (element) => typeof element.props.testID === 'string' && order.includes(element.props.testID),
    );
    const firstSeen = order.map((id) => all.findIndex((element) => element.props.testID === id));
    expect([...firstSeen].sort((a, b) => a - b)).toEqual(firstSeen);
  });

  it('says the goal is reached, and counts one page in the singular', async () => {
    setDeviceConditions({ os: 'android' });
    await showLanguage('fr');
    const today = deviceLocalDate(new Date());
    const one = recordPageRead(EMPTY_JOURNAL, { page: 1, date: today });
    await renderContents(createTestAppStore({ journal: one, settings: { dailyGoalPages: 5 } }));
    expect(screen.getByTestId('contents-today')).toHaveTextContent(/1 page sur 5$/);
    const six = [1, 2, 3, 4, 5, 6].reduce(
      (current, page) => recordPageRead(current, { page, date: today }),
      EMPTY_JOURNAL,
    );
    await renderContents(createTestAppStore({ journal: six, settings: { dailyGoalPages: 5 } }));
    expect(screen.getByTestId('contents-today')).toHaveTextContent(
      /6 pages sur 5, objectif atteint$/,
    );
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
    const search = screen.getByLabelText('Rechercher une sourate ou une page');
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
    // Not a dead end: the next step, with an example (writing.md › Provide clear next steps).
    expect(
      screen.getByText('Essaie un autre nom, comme Al-Kahf, ou un numéro de page de 1 à 604.'),
    ).toBeOnTheScreen();
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

  it('has no separate "Aller à la page" section any more', async () => {
    setDeviceConditions();
    await showLanguage('fr');
    await renderContents();
    expect(screen.queryByText('Aller à la page')).toBeNull();
    expect(screen.queryByTestId('contents-go-to-page')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ouvrir' })).toBeNull();
  });

  it('shows a "Page n" row first when a number from 1 to 604 is typed, and opens that page', async () => {
    setDeviceConditions();
    await showLanguage('fr');
    await renderContents();
    const search = screen.getByLabelText('Rechercher une sourate ou une page');
    await fireEvent.changeText(search, '293');
    const row = screen.getByTestId('contents-page-result');
    // Above the surahs the number also matches (here none: 293 is no surah).
    expect(row).toHaveTextContent(/Page 293/);
    expect(row).toHaveTextContent(/Al-Isra · Juz 15/);
    await fireEvent.press(row);
    expect(openPage).toHaveBeenCalledWith(293);
  });

  it('lists the page before the surah of the same number', async () => {
    setDeviceConditions();
    await showLanguage('fr');
    await renderContents();
    await fireEvent.changeText(screen.getByLabelText('Rechercher une sourate ou une page'), '18');
    const order = screen.container
      .queryAll(
        (element) =>
          element.props.testID === 'contents-page-result' ||
          element.props.testID === 'contents-surah-18',
      )
      .map((element) => element.props.testID);
    expect(order[0]).toBe('contents-page-result');
    expect(order).toContain('contents-surah-18');
  });

  it('reads a page typed in Arabic-Indic digits', async () => {
    setDeviceConditions();
    await showLanguage('fr');
    await renderContents();
    await fireEvent.changeText(screen.getByLabelText('Rechercher une sourate ou une page'), '٢٩٣');
    await fireEvent.press(screen.getByTestId('contents-page-result'));
    expect(openPage).toHaveBeenCalledWith(293);
  });

  it('shows no page row outside 1 to 604', async () => {
    setDeviceConditions();
    await showLanguage('fr');
    await renderContents();
    const search = screen.getByLabelText('Rechercher une sourate ou une page');
    for (const text of ['0', '605', 'kahf']) {
      await fireEvent.changeText(search, text);
      expect(screen.queryByTestId('contents-page-result')).toBeNull();
    }
    await fireEvent.changeText(search, '604');
    await fireEvent.press(screen.getByTestId('contents-page-result'));
    expect(openPage).toHaveBeenCalledWith(604);
  });

  it('shows the search results whichever list is chosen', async () => {
    setDeviceConditions();
    await showLanguage('fr');
    await renderContents();
    await fireEvent.press(screen.getByRole('radio', { name: 'Juz' }));
    await fireEvent.changeText(screen.getByLabelText('Rechercher une sourate ou une page'), 'kahf');
    expect(screen.getByTestId('contents-surah-18')).toBeOnTheScreen();
  });

  it('makes the juz number a heading as prominent as a row, not the smallest text', async () => {
    setDeviceConditions({ os: 'android' });
    await showLanguage('fr');
    await renderContents();
    await fireEvent.press(screen.getByRole('radio', { name: 'Juz' }));
    const title = screen.getByText('Juz 3');
    expect(styleOf(title)).toMatchObject({
      fontSize: textStyles.headline.fontSize,
      color: fallbackSystemColors.label.light,
    });
  });

  it('gives each juz its opening words in the Quran font', async () => {
    setDeviceConditions({ os: 'android' });
    await showLanguage('fr');
    await renderContents();
    await fireEvent.press(screen.getByRole('radio', { name: 'Juz' }));
    // Juz 2 opens with verse 2:142, "sayaqūlu s-sufahāʾu…".
    const words = await screen.findByText(/سَيَقُولُ/);
    expect(styleOf(words)).toMatchObject({ fontFamily: fontFamily.quran });
    expect(await screen.findByText(/^بِسۡمِ/)).toBeOnTheScreen();
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
