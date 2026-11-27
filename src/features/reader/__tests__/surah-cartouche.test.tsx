/**
 * The surah header of the reader's scroll: its title sits in the middle of its gold frame by its
 * letters, not by the box of its font (docs/design/POLISH-CHECKLIST.md, defect of 27 November 2026).
 */

import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import { centredLine, inkMetrics, readerShapes } from '@/ui';
import { quranTextStyles } from '@/ui/tokens';

import { READER_CONFIG } from '../config';
import { SurahCartouche } from '../surah-cartouche';

const verse = quranTextStyles.verse;

async function titleStyle(textSize: number, lineHeight: number) {
  await render(<SurahCartouche surah={18} textSize={textSize} lineHeight={lineHeight} />);
  const header = screen.getByTestId('surah-header-18');
  return {
    frame: StyleSheet.flatten(header.props.style),
    title: StyleSheet.flatten(screen.getByText('سورة الكهف').props.style),
  };
}

beforeAll(async () => {
  await showLanguage('fr');
});

describe('the surah header', () => {
  it.each(READER_CONFIG.textSizeScales)(
    'centres the letters of its title in the frame at text size x%f',
    async (scale) => {
      const textSize = verse.fontSize * scale;
      const lineHeight = verse.lineHeight * scale;
      const { frame, title } = await titleStyle(textSize, lineHeight);
      const fontSize = textSize * READER_CONFIG.surahHeader.nameScale;
      const line = centredLine(inkMetrics.quranTitle, fontSize, lineHeight);

      expect(title.fontSize).toBeCloseTo(fontSize, 5);
      // The line holds the whole font: iOS only centres such a line (ink-centre.ts).
      const fontBox = (inkMetrics.quranTitle.ascent + inkMetrics.quranTitle.descent) * fontSize;
      expect(title.lineHeight).toBeGreaterThanOrEqual(fontBox);
      expect(title.lineHeight).toBe(line.lineHeight);
      // The measured lift of Amiri, and nothing else that could move the title in the frame.
      expect(title.transform).toEqual([{ translateY: line.translateY }]);
      expect(title.paddingTop ?? 0).toBe(0);
      expect(title.paddingBottom ?? 0).toBe(0);
      expect(title.includeFontPadding).toBe(false);
      // The frame centres the line and holds it.
      expect(frame.justifyContent).toBe('center');
      expect(frame.alignItems).toBe('center');
      expect(frame.minHeight).toBeGreaterThanOrEqual(line.lineHeight);
    },
  );

  it.each(READER_CONFIG.textSizeScales)(
    'keeps the ink of all 114 titles off its inner rule at text size x%f',
    async (scale) => {
      const { frame, title } = await titleStyle(verse.fontSize * scale, verse.lineHeight * scale);
      const metrics = inkMetrics.quranTitle;
      const fontSize = verse.fontSize * scale * READER_CONFIG.surahHeader.nameScale;
      const lineHeight = title.lineHeight as number;
      // The frame pads the line by the inner rule's inset and the air asked: both in points that
      // do not need to follow Dynamic Type, since the line itself does.
      expect(frame.paddingVertical).toBe(
        readerShapes.surahFrameInset + readerShapes.surahFrameInkGap,
      );
      // And the line holds the hamza of «الأنعام» above and the final mim of «القلم» below
      // («ابراهيم» crossed the rule on the web render of 27 November 2026).
      const baseline = lineHeight / 2 + ((metrics.bandTop - metrics.bandBottom) / 2) * fontSize;
      expect(baseline - metrics.inkTop * fontSize).toBeGreaterThanOrEqual(0);
      expect(lineHeight - baseline - metrics.inkBottom * fontSize).toBeGreaterThanOrEqual(0);
    },
  );
});
