import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { quranStructure } from '@/data/quran';
import {
  MINIMUM_FONT_SIZE,
  fontFamily,
  layout,
  radius,
  readerShapes,
  spacing,
  useColors,
} from '@/ui';

import { arabicIndicDigits } from './arabic-digits';
import { READER_CONFIG } from './config';

const { medallion, medallionRing, medallionDot, cartoucheRule, cartoucheGap } = readerShapes;

export interface SurahCartoucheProps {
  surah: number;
  /** The size of the Quran text around it, in points, before Dynamic Type. */
  textSize: number;
  /** The line height of that text: the cartouche is at least `heightInLines` of them tall. */
  lineHeight: number;
}

/**
 * The header of a surah where it begins in the scroll, as the validated mockup draws it
 * (docs/design/mushaf.png): a golden cartouche, lighter at the top and deeper at the bottom like
 * the mockup's gilt, a round medallion at each end, and inside, "سورة <name>" in the middle, the
 * number of its verses on the right and whether it is Meccan or Medinan on the left, as the
 * printed mushaf writes them. Everything is read from `QuranStructure`. It reads right to left
 * whatever the interface (right-to-left.md › Align a paragraph based on its language), so the
 * first item of the row is on the right. Its words follow the person's text size with the text
 * around them (typography.md › Supporting Dynamic Type): the cartouche grows with them.
 */
export function SurahCartouche({ surah, textSize, lineHeight }: SurahCartoucheProps) {
  const { t } = useTranslation('reader');
  const colors = useColors();
  const info = quranStructure.surah(surah);
  const { heightInLines, nameScale, labelScale } = READER_CONFIG.surahHeader;
  const labelSize = Math.max(MINIMUM_FONT_SIZE, textSize * labelScale);
  const title = t('page.surahTitle', { name: info.nameArabic });
  const verses = t('page.cartouche.verses', { count: arabicIndicDigits(info.verseCount) });
  const place = t(`page.cartouche.${info.revelationPlace}`);
  const label = (text: string) => (
    <Text
      dynamicTypeRamp="footnote"
      numberOfLines={1}
      style={[styles.label, { fontSize: labelSize, color: colors.inkSecondary }]}
    >
      {text}
    </Text>
  );
  const medallionView = (
    <View
      testID={`surah-header-${surah}-medallion`}
      style={[styles.medallion, { borderColor: colors.gold, backgroundColor: colors.paper }]}
    >
      <View style={[styles.medallionDot, { backgroundColor: colors.gold }]} />
    </View>
  );
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={t('page.cartouche.spoken', { title, place, verses })}
      accessibilityLanguage="ar"
      testID={`surah-header-${surah}`}
      style={[styles.cartouche, { minHeight: lineHeight * heightInLines }]}
    >
      {medallionView}
      <View
        testID={`surah-header-${surah}-rule`}
        style={[
          styles.rule,
          {
            borderTopColor: colors.goldLight,
            borderBottomColor: colors.goldDeep,
            borderStartColor: colors.gold,
            borderEndColor: colors.gold,
          },
        ]}
      >
        <View
          style={[styles.inner, { borderColor: colors.frameInner, backgroundColor: colors.paper }]}
        >
          <View style={styles.sideStart}>{label(verses)}</View>
          <Text
            dynamicTypeRamp="title1"
            numberOfLines={1}
            style={[
              styles.name,
              { fontSize: textSize * nameScale, lineHeight: lineHeight, color: colors.ink },
            ]}
          >
            {title}
          </Text>
          <View style={styles.sideEnd}>{label(place)}</View>
        </View>
      </View>
      {medallionView}
    </View>
  );
}

const styles = StyleSheet.create({
  // The header reads right to left in every interface, like the text it opens.
  cartouche: { flexDirection: 'row', alignItems: 'center', direction: 'rtl' },
  medallion: {
    width: medallion,
    height: medallion,
    borderRadius: medallion / 2,
    borderWidth: medallionRing,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medallionDot: { width: medallionDot, height: medallionDot, borderRadius: medallionDot / 2 },
  rule: {
    flex: 1,
    alignSelf: 'stretch',
    padding: cartoucheGap,
    borderWidth: cartoucheRule,
    borderRadius: radius.sm,
  },
  inner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    borderWidth: layout.outlineWidth,
    borderRadius: radius.sm - cartoucheGap,
  },
  // The two sides share what the name leaves, so the name stays in the middle.
  sideStart: { flex: 1, alignItems: 'flex-start' },
  sideEnd: { flex: 1, alignItems: 'flex-end' },
  name: { fontFamily: fontFamily.quranTitle, includeFontPadding: false, textAlign: 'center' },
  label: { fontFamily: fontFamily.quranTitle, includeFontPadding: false },
});
