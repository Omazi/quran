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
import {
  directionDependentStyles,
  renderOnIOS,
  resetDeviceConditions,
  setDeviceConditions,
} from '@/ui/test-support/environment';

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
  it('opens page 1 for a new person, from the resume row', async () => {
    setDeviceConditions();
    await showLanguage('fr');
    await renderContents();
    expect(screen.getByRole('header', { name: 'Coran' })).toBeOnTheScreen();
    expect(screen.getByText('Reprendre')).toBeOnTheScreen();
    const resume = screen.getByTestId('contents-resume');
    expect(within(resume).getByText('Al-Fatiha')).toBeOnTheScreen();
    expect(within(resume).getByText('Page 1')).toBeOnTheScreen();
    await fireEvent.press(resume);
    expect(openPage).toHaveBeenCalledWith(1);
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
    expect(within(screen.getByTestId('contents-resume')).getByText('Page 4')).toBeOnTheScreen();

    await renderContents(createTestAppStore({ journal, settings: { lastOpenedPage: 293 } }));
    const resume = screen.getByTestId('contents-resume');
    // Named, like its juz and hizb, by its first verse: page 293 opens on the end of Al-Isra.
    expect(within(resume).getByText('Al-Isra')).toBeOnTheScreen();
    expect(within(resume).getByText('Page 293')).toBeOnTheScreen();
  });

  it('lists the 114 surahs with their number, names, place, verses and page', async () => {
    setDeviceConditions();
    await showLanguage('fr');
    await renderContents();
    expect(screen.getAllByTestId(/^contents-surah-/)).toHaveLength(114);
    const kahf = screen.getByRole('button', {
      name: '18. Al-Kahf, الكهف, Mecquoise · 110 versets · page 293',
    });
    await fireEvent.press(kahf);
    expect(openPage).toHaveBeenCalledWith(293);
  });

  it('switches to the 30 juz and their hizb', async () => {
    setDeviceConditions();
    await showLanguage('fr');
    await renderContents();
    await fireEvent.press(screen.getByRole('radio', { name: 'Juz' }));
    expect(screen.queryAllByTestId(/^contents-surah-/)).toHaveLength(0);
    expect(screen.getByText('Juz 30')).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^contents-hizb-/)).toHaveLength(60);
    await fireEvent.press(screen.getByTestId('contents-hizb-1'));
    expect(openPage).toHaveBeenCalledWith(1);
  });

  it('opens a page chosen by its number, between 1 and 604', async () => {
    setDeviceConditions();
    await showLanguage('fr');
    await renderContents();
    const stepper = screen.getByRole('adjustable', { name: 'Page' });
    expect(stepper).toHaveAccessibilityValue({ text: 'Page 1' });
    await fireEvent.press(screen.getByTestId('contents-go-to-page-increment'));
    await fireEvent.press(screen.getByRole('button', { name: 'Ouvrir la page 2' }));
    expect(openPage).toHaveBeenCalledWith(2);
  });

  it.each(SCREEN_CONDITIONS)(
    'reads well in $language, $scheme, and mirrors in Arabic',
    async (conditions) => {
      setDeviceConditions(conditions);
      await showLanguage(conditions.language);
      await renderContents();
      if (conditions.language === 'ar') {
        expect(screen.getByRole('header', { name: 'القرآن' })).toBeOnTheScreen();
        // In Arabic the name is the label; there is no transliteration.
        expect(screen.getByTestId('contents-surah-18')).toHaveTextContent(/^18\. الكهف/);
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
