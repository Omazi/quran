/**
 * Exactness of the page (docs/specs/reader.md, "Exigence absolue" and section 8): for page 1,
 * page 2, a page where a surah starts and page 604, the text drawn is word for word the text of
 * the data repository, in its order and on its lines, in the King Fahd font only. A page whose
 * data cannot be trusted shows an error and no text.
 */

import { render, screen, waitFor, within } from '@testing-library/react-native';

import { quranRepository, quranStructure } from '@/data/quran';
import type { MushafPage } from '@/domain/quran';
import { showLanguage, SCREEN_CONDITIONS } from '@/features/garden/test-support/screen-conditions';
import { fontFamily } from '@/ui';
import {
  resetDeviceConditions,
  setDeviceConditions,
  styleOf,
  type RenderedElement,
} from '@/ui/test-support/environment';
import { appColors } from '@/ui/tokens';

import { MushafPageView } from '../mushaf-page-view';
import { verseNumberText } from '../page-content';
import { computeOpeningPageMetrics, computePageMetrics } from '../page-layout';

const AREA = { width: 390, height: 700 };
const METRICS = computePageMetrics(AREA);
const NO_TURN = { actions: [], onAction: () => {} };

function isInsideHeader(element: RenderedElement): boolean {
  for (let node: RenderedElement | null = element; node !== null; node = node.parent) {
    if (node.props.accessibilityRole === 'header') return true;
  }
  return false;
}

/**
 * Every Text of the page's lines drawn in the Quran font, in tree order (the order the lines are
 * laid out). The surah title of a cartouche is in the same font but is not text of the page.
 */
function quranTexts(): RenderedElement[] {
  return screen.container.queryAll(
    (element) =>
      element.type === 'Text' &&
      styleOf(element).fontFamily === fontFamily.quran &&
      !isInsideHeader(element),
  );
}

function textOf(element: RenderedElement): string {
  return String(element.props.children);
}

/** What the page must show, built from the repository alone: words, then verse numbers. */
async function expectedLines(page: MushafPage, withBasmala = true): Promise<string[][]> {
  const basmala = (await quranRepository.getVerse('1:1')).text;
  return page.lines.flatMap((line) => {
    if (line.kind === 'surah-header') return [];
    if (line.kind === 'basmala') return withBasmala ? [[basmala]] : [];
    const items: string[] = [];
    line.words.forEach((word, index) => {
      items.push(word.text);
      const end = line.verseEnds.find((verseEnd) => verseEnd.afterWordIndex === index);
      if (end !== undefined) items.push(verseNumberText(end.verse));
    });
    return [items];
  });
}

async function renderPage(page: number) {
  await render(<MushafPageView page={page} metrics={METRICS} area={AREA} turnActions={NO_TURN} />);
  await waitFor(() => expect(screen.getByTestId(`mushaf-page-${page}`)).toBeOnTheScreen());
}

afterEach(resetDeviceConditions);

describe('the page shows exactly the text of the repository', () => {
  it.each([1, 2, 293, 604])('page %i: every word, in order, on its line', async (page) => {
    setDeviceConditions();
    await showLanguage('fr');
    const mushafPage = await quranRepository.getPage(page);
    await renderPage(page);
    const expected = (await expectedLines(mushafPage)).flat();
    expect(quranTexts().map(textOf)).toEqual(expected);
    // VoiceOver reads each text line as the same words, separated by single spaces, in Arabic.
    const spokenLines = screen.container
      .queryAll((element) => element.props.accessibilityLanguage === 'ar')
      .map((element) => element.props.accessibilityLabel as string | undefined)
      .filter((label): label is string => label !== undefined);
    const textLines = await expectedLines(mushafPage, false);
    expect(spokenLines).toEqual(textLines.map((line) => line.join(' ')));
  });

  it('draws every Quran text in the King Fahd font, at the page size, whatever the text setting', async () => {
    setDeviceConditions({ fontScale: 3.571 });
    await showLanguage('fr');
    await renderPage(293);
    for (const text of quranTexts()) {
      expect(text.props.allowFontScaling).toBe(false);
      expect(styleOf(text).fontSize).toBeCloseTo(METRICS.fontSize, 5);
    }
  });

  it('names the surah in its header, on the line the mushaf puts it', async () => {
    setDeviceConditions();
    await showLanguage('en');
    const mushafPage = await quranRepository.getPage(293);
    await renderPage(293);
    const header = screen.getByRole('header');
    expect(header).toHaveTextContent(`سورة ${quranStructure.surah(18).nameArabic}`);
    expect(mushafPage.lines.findIndex((line) => line.kind === 'surah-header')).toBeGreaterThan(0);
  });

  it('draws the surah name in the Quran font, in ink, between two rules of the ornament colour', async () => {
    // Outside iOS, colours are plain values that can be compared.
    setDeviceConditions({ os: 'android' });
    await showLanguage('fr');
    await renderPage(293);
    const header = screen.getByTestId('surah-header-18');
    const title = within(header).getByText(`سورة ${quranStructure.surah(18).nameArabic}`);
    expect(styleOf(title)).toMatchObject({
      fontFamily: fontFamily.quran,
      color: appColors.ink.light,
    });
    const rules = [header, ...header.queryAll((element) => element.type === 'View')].filter(
      (element) => styleOf(element).borderWidth !== undefined,
    );
    expect(rules).toHaveLength(2);
    for (const rule of rules) expect(styleOf(rule).borderColor).toBe(appColors.ornament.light);
  });

  it('frames the page with one thin rule of the ornament colour, the same on every page', async () => {
    setDeviceConditions({ os: 'android' });
    await showLanguage('fr');
    await renderPage(293);
    const frame = styleOf(screen.getByTestId('mushaf-page-293-frame'));
    expect(frame.borderColor).toBe(appColors.ornament.light);
    await renderPage(1);
    expect(styleOf(screen.getByTestId('mushaf-page-1-frame'))).toEqual(frame);
  });

  it.each([1, 2])('sets page %i larger, as the print does', async (page) => {
    setDeviceConditions();
    await showLanguage('fr');
    const mushafPage = await quranRepository.getPage(page);
    await renderPage(page);
    const opening = computeOpeningPageMetrics(AREA, mushafPage.lines.length);
    expect(opening.fontSize).toBeGreaterThan(METRICS.fontSize);
    for (const text of quranTexts()) {
      expect(styleOf(text).fontSize).toBeCloseTo(opening.fontSize, 5);
    }
  });

  it.each(SCREEN_CONDITIONS)(
    'writes in ink on the paper, verse marks in the ornament colour ($scheme, $language)',
    async (conditions) => {
      setDeviceConditions(conditions);
      await showLanguage(conditions.language);
      await renderPage(604);
      const appearance = conditions.scheme ?? 'light';
      const colours = quranTexts().map((text) => styleOf(text).color);
      expect(new Set(colours)).toEqual(
        new Set([appColors.ink[appearance], appColors.ornament[appearance]]),
      );
    },
  );
});

describe('a page whose data cannot be trusted', () => {
  it('shows an error and no word of the page', async () => {
    setDeviceConditions();
    await showLanguage('fr');
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(quranRepository, 'getPage').mockRejectedValue(new RangeError('Corrupted page file'));
    await render(<MushafPageView page={12} metrics={METRICS} area={AREA} turnActions={NO_TURN} />);
    await waitFor(() => expect(screen.getByTestId('mushaf-page-12-error')).toBeOnTheScreen());
    expect(screen.getByText('Page illisible')).toBeOnTheScreen();
    expect(quranTexts()).toEqual([]);
  });

  it('shows the loading state, with a name, while the page loads', async () => {
    setDeviceConditions();
    await showLanguage('fr');
    jest.spyOn(quranRepository, 'getPage').mockReturnValue(new Promise(() => {}));
    await render(<MushafPageView page={12} metrics={METRICS} area={AREA} turnActions={NO_TURN} />);
    expect(screen.getByLabelText('Chargement de la page 12')).toBeOnTheScreen();
    expect(quranTexts()).toEqual([]);
  });
});
