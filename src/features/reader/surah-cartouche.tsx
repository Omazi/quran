import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { quranStructure } from '@/data/quran';
import { MINIMUM_FONT_SIZE, fontFamily, layout, radius, readerShapes, useColors } from '@/ui';

import { arabicIndicDigits } from './arabic-digits';
import { READER_CONFIG } from './config';
import type { PageTurnActions } from './mushaf-page-view';
import type { PageMetrics } from './page-layout';

const { medallion, medallionRing, medallionDot, cartoucheRule, cartoucheGap } = readerShapes;

export interface SurahCartoucheProps {
  surah: number;
  metrics: PageMetrics;
  turnActions: PageTurnActions;
}

/**
 * The header of a surah, as the validated mockup draws it (docs/design/mushaf.png): a golden
 * cartouche, lighter at the top and deeper at the bottom like the mockup's gilt, a round medallion
 * at each end, and inside, "سورة <name>" in the middle, the number of its verses on the right and
 * whether it is Meccan or Medinan on the left, as the printed mushaf writes them. Everything is
 * read from `QuranStructure`. The page reads right to left whatever the interface (spec 2), so
 * the first item of the row is on the right.
 */
export function SurahCartouche({ surah, metrics, turnActions }: SurahCartoucheProps) {
  const { t } = useTranslation('reader');
  const colors = useColors();
  const info = quranStructure.surah(surah);
  const height = metrics.lineHeight * READER_CONFIG.surahHeaderHeightRatio;
  const innerHeight = height - 2 * (cartoucheRule + cartoucheGap + layout.outlineWidth);
  const nameSize = metrics.fontSize * READER_CONFIG.surahNameScale;
  const labelSize = Math.max(
    MINIMUM_FONT_SIZE,
    metrics.fontSize * READER_CONFIG.cartoucheLabelScale,
  );
  const title = t('page.surahTitle', { name: info.nameArabic });
  const verses = t('page.cartouche.verses', { count: arabicIndicDigits(info.verseCount) });
  const place = t(`page.cartouche.${info.revelationPlace}`);
  const label = (text: string) => (
    <Text
      allowFontScaling={false}
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
    <View style={[styles.row, { height: metrics.lineHeight }]}>
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={t('page.cartouche.spoken', { title, place, verses })}
        accessibilityLanguage="ar"
        accessibilityActions={turnActions.actions}
        onAccessibilityAction={turnActions.onAction}
        testID={`surah-header-${surah}`}
        style={[styles.cartouche, { height }]}
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
          <View style={[styles.inner, { borderColor: colors.frameInner }]}>
            <View style={styles.sideStart}>{label(verses)}</View>
            {/* The name, a little larger than the text of the page, in a line box as tall as the
                inner rule, so that it is centred whatever the font's ascent and descent. */}
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={{
                fontFamily: fontFamily.quranTitle,
                fontSize: nameSize,
                lineHeight: innerHeight,
                textAlignVertical: 'center',
                includeFontPadding: false,
                color: colors.ink,
              }}
            >
              {title}
            </Text>
            <View style={styles.sideEnd}>{label(place)}</View>
          </View>
        </View>
        {medallionView}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  cartouche: { flex: 1, flexDirection: 'row', alignItems: 'center' },
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
    paddingHorizontal: cartoucheGap * 2,
    borderWidth: layout.outlineWidth,
    borderRadius: radius.sm - cartoucheGap,
  },
  // The two sides share what the name leaves, so the name stays in the middle.
  sideStart: { flex: 1, alignItems: 'flex-start' },
  sideEnd: { flex: 1, alignItems: 'flex-end' },
  label: { fontFamily: fontFamily.quranTitle, includeFontPadding: false },
});
