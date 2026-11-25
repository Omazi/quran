import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { quranStructure } from '@/data/quran';
import { getDisplayedLanguage } from '@/i18n';
import {
  AppText,
  ArabicDisplayText,
  Card,
  Icon,
  ProgressRing,
  emphasisWeight,
  fontFamily,
  layout,
  readerShapes,
  spacing,
  stateOpacity,
  useColors,
  useColorValues,
  type IconSymbol,
} from '@/ui';

import type { HizbEntry, SurahEntry } from './contents-model';
import { surahDisplayName } from './surah-name';
import type { ContentsModel } from './use-contents-model';

const WATER_SYMBOL: IconSymbol = { ios: 'drop.fill', android: 'water_drop' };
const { shadowOpacity, shadowRadius } = readerShapes;

/**
 * The card at the top of the Quran tab, after the home mockup's watering card: the water ring and
 * today's pages toward the daily goal, then the cream card that resumes the reading.
 */
export function TodayCard({
  today,
  resume,
  onResume,
}: {
  today: ContentsModel['today'];
  resume: ContentsModel['resume'];
  onResume: () => void;
}) {
  const { t } = useTranslation('reader');
  const remaining = Math.max(0, today.goalPages - today.pagesRead);
  return (
    <Card contentGap="md" testID="contents-today-card">
      <View style={styles.todayRow} testID="contents-today" accessible>
        <ProgressRing
          progress={Math.min(1, today.pagesRead / today.goalPages)}
          size="large"
          tone="water"
          accessibilityLabel={t('contents.today.label')}
          accessibilityValue={t('contents.today.value', {
            count: today.pagesRead,
            goal: today.goalPages,
          })}
          testID="contents-today-ring"
        >
          <Icon symbol={WATER_SYMBOL} textStyle="title3" color="waterFill" />
        </ProgressRing>
        <View style={styles.todayWords}>
          <AppText variant="subheadEmphasized" color="water">
            {t('contents.today.label')}
          </AppText>
          <AppText variant="headline" color="ink">
            {t('contents.today.value', { count: today.pagesRead, goal: today.goalPages })}
          </AppText>
          <AppText variant="footnote" color="inkSecondary">
            {today.goalReached
              ? t('contents.today.reached')
              : t('contents.today.remaining', { count: remaining })}
          </AppText>
        </View>
      </View>
      <ResumeCard resume={resume} onPress={onResume} />
    </Card>
  );
}

/**
 * "Al-Kahf · Reprendre page 293", as the home mockup draws it: a cream card with a thin golden
 * edge, the surah and where it resumes, and the Arabic name in gold at its end. The whole card is
 * the button (buttons.md › Best practices: a press state, 44 points). In Arabic the surah is
 * already named in Arabic, so the gold name is not repeated.
 */
function ResumeCard({ resume, onPress }: { resume: ContentsModel['resume']; onPress: () => void }) {
  const { t } = useTranslation('reader');
  const name = surahDisplayName(resume.surah);
  const isArabic = getDisplayedLanguage() === 'ar';
  return (
    <Card
      tone="inset"
      accessibilityLabel={t('contents.resume.spoken', { surah: name, page: resume.page })}
      onPress={onPress}
      testID="contents-resume"
    >
      <View style={styles.resume}>
        <View style={styles.resumeWords}>
          <AppText variant="callout" numberOfLines={1}>
            {name}
          </AppText>
          <AppText variant="footnote" color="muted">
            {t('contents.resume.detail', { page: resume.page })}
          </AppText>
        </View>
        {isArabic ? null : (
          <ArabicDisplayText text={quranStructure.surah(resume.surah).nameArabic} />
        )}
      </View>
    </Card>
  );
}

/**
 * A surah's Arabic name in gold, in the title font of Arabic names, as the mockup's resume card
 * writes "الكهف". It is a name, set larger than the words around it; it grows with the text size
 * of the title it sits beside.
 */
function ArabicName({ name }: { name: string }) {
  const colors = useColors();
  const variant = readerShapes.arabicName.row;
  return (
    <Text
      accessibilityLanguage="ar"
      dynamicTypeRamp="title2"
      style={[styles.arabicName, variant, { color: colors.ornament }]}
    >
      {name}
    </Text>
  );
}

export interface ReaderChoiceOption<Value extends string> {
  readonly value: Value;
  readonly label: string;
}

/**
 * A choice between two lists, drawn as the mockup's "Uthmani | Simple" control
 * (docs/design/mushaf.png): a warm track and a white thumb under the chosen label. Each segment
 * is a radio button for screen readers, 44 points tall (segmented-controls.md › Best practices:
 * closely related choices, equal widths, nouns; deviation 83).
 */
export function ReaderSegmented<Value extends string>({
  label,
  options,
  value,
  onChange,
  fitsContent = false,
  testID,
}: {
  label: string;
  options: readonly ReaderChoiceOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  /**
   * True in a bar, where the control takes the width of its labels instead of the whole row (the
   * reader's bottom bar, as the mockup draws it). The segments then follow their labels.
   */
  fitsContent?: boolean;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      testID={testID}
      style={[styles.track, { backgroundColor: colors.track }]}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: isSelected, checked: isSelected }}
            onPress={() => onChange(option.value)}
            testID={testID === undefined ? undefined : `${testID}-${option.value}`}
            style={({ pressed }) => [
              styles.segment,
              fitsContent && styles.segmentFittingContent,
              isSelected && [
                styles.thumb,
                { backgroundColor: colors.surface, shadowColor: colors.shadow },
              ],
              pressed && styles.pressed,
            ]}
          >
            <AppText
              variant="subhead"
              color={isSelected ? 'ink' : 'inkSecondary'}
              align="center"
              numberOfLines={1}
            >
              {isSelected ? <Text style={styles.emphasis}>{option.label}</Text> : option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The number of a surah or a hizb, in a small cream medallion, like the page's cartouche. */
function NumberBadge({ number }: { number: number }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: colors.surfaceInset, borderColor: colors.surfaceInsetBorder },
      ]}
    >
      <AppText variant="footnote" color="ornament" align="center">
        {number}
      </AppText>
    </View>
  );
}

/** A row of a list card: 44 points at least, a press state, a hairline above all but the first. */
function ListRow({
  isFirst,
  accessibilityLabel,
  onPress,
  testID,
  children,
}: {
  isFirst: boolean;
  accessibilityLabel: string;
  onPress: () => void;
  testID: string;
  children: ReactNode;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        !isFirst && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
        pressed && styles.pressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

/**
 * One surah: its number, its name, whether it is Meccan or Medinan, its verses and its page, and
 * its Arabic name in gold at the end. In Arabic the row is named by its Arabic name alone.
 */
export function SurahRow({
  entry,
  isFirst,
  onOpen,
}: {
  entry: SurahEntry;
  isFirst: boolean;
  onOpen: (page: number) => void;
}) {
  const { t } = useTranslation('reader');
  const isArabic = getDisplayedLanguage() === 'ar';
  const name = isArabic ? entry.nameArabic : entry.nameTransliterated;
  const detail = t('contents.surah.detail', {
    count: entry.verseCount,
    place: t(`contents.surah.${entry.revelationPlace}`),
    page: entry.page,
  });
  return (
    <ListRow
      isFirst={isFirst}
      accessibilityLabel={t('contents.surah.spoken', {
        number: entry.surah,
        name,
        arabic: entry.nameArabic,
        detail,
      })}
      onPress={() => onOpen(entry.page)}
      testID={`contents-surah-${entry.surah}`}
    >
      <NumberBadge number={entry.surah} />
      <View style={styles.rowWords}>
        <AppText variant="headline" color="ink" numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="footnote" color="inkSecondary">
          {detail}
        </AppText>
      </View>
      {isArabic ? null : <ArabicName name={entry.nameArabic} />}
    </ListRow>
  );
}

/** One hizb: its number, then the surah and verse it starts with, and its page. */
export function HizbRow({
  entry,
  isFirst,
  onOpen,
}: {
  entry: HizbEntry;
  isFirst: boolean;
  onOpen: (page: number) => void;
}) {
  const { t } = useTranslation('reader');
  const label = t('contents.juz.hizb', { hizb: entry.hizb });
  const detail = t('contents.juz.start', {
    surah: surahDisplayName(entry.start.surah),
    verse: entry.start.verse,
    page: entry.page,
  });
  return (
    <ListRow
      isFirst={isFirst}
      accessibilityLabel={`${label}, ${detail}`}
      onPress={() => onOpen(entry.page)}
      testID={`contents-hizb-${entry.hizb}`}
    >
      <NumberBadge number={entry.hizb} />
      <View style={styles.rowWords}>
        <AppText variant="headline" color="ink">
          {label}
        </AppText>
        <AppText variant="footnote" color="inkSecondary">
          {detail}
        </AppText>
      </View>
    </ListRow>
  );
}

const styles = StyleSheet.create({
  todayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  todayWords: { flex: 1 },
  emphasis: { fontWeight: emphasisWeight },
  // As the home screen's resume card (src/features/home/daily-card.tsx).
  resume: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing.md,
  },
  resumeWords: { flexShrink: 1, paddingVertical: spacing.xs },
  arabicName: { fontFamily: fontFamily.quranTitle, writingDirection: 'rtl' },
  pressed: { opacity: stateOpacity.pressed },
  track: {
    flexDirection: 'row',
    padding: spacing.xs,
    borderRadius: layout.touchTarget,
  },
  segment: {
    flex: 1,
    minHeight: layout.touchTarget - 2 * spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: layout.touchTarget,
  },
  segmentFittingContent: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  thumb: {
    shadowOpacity,
    shadowRadius: shadowRadius / 2,
    shadowOffset: { width: 0, height: 1 },
  },
  badge: {
    width: readerShapes.numberBadge,
    height: readerShapes.numberBadge,
    borderRadius: readerShapes.numberBadge / 2,
    borderWidth: layout.outlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    minHeight: layout.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.controlGap,
    paddingVertical: spacing.sm + spacing.xs,
  },
  rowWords: { flex: 1, gap: spacing.xs / 2 },
  sky: { position: 'absolute', top: 0, start: 0, end: 0, height: readerShapes.skyHeight },
});

/**
 * The sky at the top of the tab, as the home mockup paints it behind its title (accueil.png): a
 * warm tone fading into the ground; at night the dusk of the owner's dark direction. Drawn behind
 * the content, it scrolls with it and carries no information.
 */
export function SkyBand() {
  const colors = useColorValues();
  return (
    <View pointerEvents="none" style={styles.sky} testID="contents-sky">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="contents-sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.skyTop} stopOpacity={1} />
            <Stop offset="1" stopColor={colors.canvas} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#contents-sky)" />
      </Svg>
    </View>
  );
}

const BOOKMARK_SYMBOL: IconSymbol = { ios: 'bookmark.fill', android: 'bookmark' };

/**
 * The pages bookmarked in the reader, in a white card under the search field, titled like the
 * home mockup's sections, each row opening its page (owner's decision, 25 November 2026). Shown
 * only once there is a bookmark: an empty card would only say there is nothing.
 */
export function BookmarksCard({
  bookmarks,
  onOpen,
}: {
  bookmarks: ContentsModel['bookmarks'];
  onOpen: (page: number) => void;
}) {
  const { t } = useTranslation('reader');
  if (bookmarks.length === 0) return null;
  return (
    <Card contentGap="md" testID="contents-bookmarks">
      <AppText variant="title2" color="ink">
        {t('contents.bookmarks.title')}
      </AppText>
      <View>
        {bookmarks.map((place, index) => {
          const label = t('contents.search.page', { page: place.page });
          const detail = t('contents.search.pageDetail', {
            surah: surahDisplayName(place.surah),
            juz: place.juz,
          });
          return (
            <ListRow
              key={place.page}
              isFirst={index === 0}
              accessibilityLabel={`${label}, ${detail}`}
              onPress={() => onOpen(place.page)}
              testID={`contents-bookmark-${place.page}`}
            >
              <Icon symbol={BOOKMARK_SYMBOL} textStyle="headline" color="ornament" />
              <View style={styles.rowWords}>
                <AppText variant="headline" color="ink">
                  {label}
                </AppText>
                <AppText variant="footnote" color="inkSecondary">
                  {detail}
                </AppText>
              </View>
            </ListRow>
          );
        })}
      </View>
    </Card>
  );
}
