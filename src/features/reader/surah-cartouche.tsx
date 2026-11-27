import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { quranStructure } from '@/data/quran';
import { fontFamily, layout, readerShapes, useColors } from '@/ui';

import { arabicIndicDigits } from './arabic-digits';
import { READER_CONFIG } from './config';

const { surahFrameHeight, surahFrameInset } = readerShapes;

export interface SurahCartoucheProps {
  surah: number;
  /** The size of the Quran text around it, in points, before Dynamic Type. */
  textSize: number;
  /** The line height of that text: the frame is at least `heightInLines` of them tall. */
  lineHeight: number;
}

/**
 * The header of a surah where it begins in the scroll, as the validated mockup of 27 November 2026
 * draws it (docs/design/maquette-wow, shots 14 to 16, `.rd-head .frame`): "سورة <name>" in gold, in
 * the title font of Arabic names, in the middle of a frame of two thin gold capsules, the inner one
 * fainter. The name is read from `QuranStructure`. VoiceOver hears it as a heading with the
 * number of its verses and where it was revealed, as the printed mushaf writes them (spec 7). Its
 * name follows the person's text size with the text around it (typography.md › Supporting Dynamic
 * Type): the frame grows with it.
 */
export function SurahCartouche({ surah, textSize, lineHeight }: SurahCartoucheProps) {
  const { t } = useTranslation('reader');
  const colors = useColors();
  const info = quranStructure.surah(surah);
  const { heightInLines, nameScale } = READER_CONFIG.surahHeader;
  const title = t('page.surahTitle', { name: info.nameArabic });
  const verses = t('page.cartouche.verses', { count: arabicIndicDigits(info.verseCount) });
  const place = t(`page.cartouche.${info.revelationPlace}`);
  const height = Math.max(surahFrameHeight, lineHeight * heightInLines);
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={t('page.cartouche.spoken', { title, place, verses })}
      accessibilityLanguage="ar"
      testID={`surah-header-${surah}`}
      style={[styles.frame, { minHeight: height, borderRadius: height / 2 }]}
    >
      <View
        testID={`surah-header-${surah}-rule`}
        pointerEvents="none"
        style={[styles.outer, { borderColor: colors.ornamentLine, borderRadius: height / 2 }]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.inner,
          {
            borderColor: colors.ornamentLine,
            borderRadius: height / 2 - surahFrameInset,
          },
        ]}
      />
      <Text
        dynamicTypeRamp="title1"
        numberOfLines={1}
        style={[
          styles.name,
          { fontSize: textSize * nameScale, lineHeight, color: colors.ornament },
        ]}
      >
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', direction: 'rtl' },
  outer: { ...StyleSheet.absoluteFill, borderWidth: layout.outlineWidth },
  inner: {
    position: 'absolute',
    top: surahFrameInset,
    bottom: surahFrameInset,
    start: surahFrameInset,
    end: surahFrameInset,
    borderWidth: StyleSheet.hairlineWidth,
    opacity: READER_CONFIG.surahHeader.innerRuleOpacity,
  },
  name: { fontFamily: fontFamily.quranTitle, includeFontPadding: false, textAlign: 'center' },
});
