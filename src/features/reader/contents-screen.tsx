import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { PAGE_COUNT } from '@/domain/quran';
import { useGenderedTranslation } from '@/features/gender';
import {
  AppText,
  Card,
  Icon,
  QuranText,
  ReaderSearchField,
  Screen,
  layout,
  spacing,
  stateOpacity,
  type IconSymbol,
} from '@/ui';

import { READER_CONFIG } from './config';
import {
  BookmarksCard,
  HizbRow,
  ReaderSegmented,
  SkyBand,
  SurahRow,
  TodayCard,
  type ReaderChoiceOption,
} from './contents-parts';
import { RecognizeCard } from './recognize-card';
import { surahDisplayName } from './surah-name';
import type { ContentsActions, ContentsModel, ContentsView } from './use-contents-model';

const NO_RESULT_SYMBOL: IconSymbol = { ios: 'magnifyingglass', android: 'search' };
const PAGE_SYMBOL: IconSymbol = { ios: 'book.pages', android: 'auto_stories' };

export interface ContentsScreenProps {
  model: ContentsModel;
  actions: ContentsActions;
  /**
   * Opens the passage recognition ("Shazam", `/listening`): the reader's microphone follows the
   * recitation now (spec reader 3b), so the recognition is reached from here, by the card at the
   * top of the tab. Without it, there is no card.
   */
  onRecognize?: () => void;
}

/**
 * The Quran tab: where do I resume, and how do I reach a surah or a page? (spec 1)
 *
 * In the visual language of the validated mockups (docs/design/accueil.png and mushaf.png;
 * deviations 80 and 83 of the register), on the warm ground, in order of importance
 * (layout.md › Visual hierarchy):
 *
 * - the title, in the serif of the mockups' titles;
 * - the green card "Quel est ce passage ?" that opens the recognition (maquettes 2026-11-26, 3A,
 *   chosen by the owner; the small symbol that stood next to the title is gone);
 * - the white card of the day: the water ring with today's pages toward the goal, then the cream
 *   card "Al-Kahf · Reprendre page 293" with the Arabic name in gold, the most likely action;
 * - the inline search field, above the list it searches (search-fields.md › Search as an inline
 *   field). A number from 1 to 604 puts a "Page n" row at the top of the results;
 * - the surahs or the juz, switched by the mockup's two-part control (segmented-controls.md ›
 *   Mobile), in white cards. While something is typed, the results replace both.
 */
export function ContentsScreen({ model, actions, onRecognize }: ContentsScreenProps) {
  const { t } = useTranslation('reader');
  const viewOptions: readonly ReaderChoiceOption<ContentsView>[] = [
    { value: 'surahs', label: t('contents.view.surahs') },
    { value: 'juz', label: t('contents.view.juz') },
  ];
  const isSearching = model.query.trim() !== '';
  return (
    <Screen background="canvas" scroll testID="contents">
      <SkyBand />
      <View style={styles.content} testID="contents-list">
        <AppText variant="largeTitle" color="ink">
          {t('contents.title')}
        </AppText>
        {onRecognize === undefined ? null : <RecognizeCard onRecognize={onRecognize} />}
        <TodayCard
          today={model.today}
          resume={model.resume}
          onResume={() => actions.openPage(model.resume.page)}
        />
        <ReaderSearchField
          label={t('contents.search.label')}
          placeholder={t('contents.search.placeholder')}
          value={model.query}
          onChange={actions.setQuery}
          clearLabel={t('contents.search.clear')}
          testID="contents-search"
        />
        {isSearching ? (
          <SearchResults model={model} actions={actions} />
        ) : (
          <>
            <BookmarksCard bookmarks={model.bookmarks} onOpen={actions.openPage} />
            <ReaderSegmented
              label={t('contents.view.label')}
              options={viewOptions}
              value={model.view}
              onChange={actions.setView}
              testID="contents-view"
            />
            {model.view === 'surahs' ? (
              <Card contentGap="md" testID="contents-surahs-card">
                <View>
                  {model.surahs.map((entry, index) => (
                    <SurahRow
                      key={entry.surah}
                      entry={entry}
                      isFirst={index === 0}
                      onOpen={actions.openPage}
                    />
                  ))}
                </View>
              </Card>
            ) : (
              model.juz.map((juz) => (
                <View key={juz.juz} style={styles.juz}>
                  <View style={styles.juzHeader} accessible accessibilityRole="header">
                    <AppText variant="title2" color="ink">
                      {t('contents.juz.title', { juz: juz.juz })}
                    </AppText>
                    {model.juzOpenings[juz.juz] === undefined ? null : (
                      <QuranText
                        runs={[{ text: model.juzOpenings[juz.juz] ?? '' }]}
                        variant="openingWords"
                        align="start"
                      />
                    )}
                  </View>
                  <Card contentGap="md">
                    <View>
                      {juz.hizbs.map((hizb, index) => (
                        <HizbRow
                          key={hizb.hizb}
                          entry={hizb}
                          isFirst={index === 0}
                          onOpen={actions.openPage}
                        />
                      ))}
                    </View>
                  </Card>
                </View>
              ))
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

/** The results of a search: the page it names first, then the surahs it matches, or a next step. */
function SearchResults({ model, actions }: ContentsScreenProps) {
  const { t } = useGenderedTranslation('reader');
  const { goTo } = model;
  if (goTo === null && model.surahs.length === 0) {
    // Never a dead end: what to type instead, with an example (writing.md › Provide clear next
    // steps on any blank screens; ux-writing › Empty states).
    return (
      <View style={styles.empty} testID="contents-search-empty">
        <Icon symbol={NO_RESULT_SYMBOL} textStyle="title2" color="inkSecondary" />
        <AppText variant="headline" color="ink" align="center">
          {t('contents.search.empty', { query: model.query.trim() })}
        </AppText>
        <AppText variant="subhead" color="inkSecondary" align="center">
          {t('contents.search.emptyHint', {
            example: surahDisplayName(READER_CONFIG.searchExampleSurah),
            last: PAGE_COUNT,
          })}
        </AppText>
      </View>
    );
  }
  return (
    <Card contentGap="md" testID="contents-results">
      <View>
        {goTo === null ? null : (
          <Pressable
            accessibilityRole="button"
            onPress={() => actions.openPage(goTo.page)}
            testID="contents-page-result"
            style={({ pressed }) => [styles.pageResult, pressed && styles.pressed]}
          >
            <Icon symbol={PAGE_SYMBOL} textStyle="headline" color="ink" />
            <View style={styles.pageResultWords}>
              <AppText variant="headline" color="ink">
                {t('contents.search.page', { page: goTo.page })}
              </AppText>
              <AppText variant="footnote" color="inkSecondary">
                {t('contents.search.pageDetail', {
                  surah: surahDisplayName(goTo.surah),
                  juz: goTo.juz,
                })}
              </AppText>
            </View>
          </Pressable>
        )}
        {model.surahs.map((entry, index) => (
          <SurahRow
            key={entry.surah}
            entry={entry}
            isFirst={goTo === null && index === 0}
            onOpen={actions.openPage}
          />
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  juz: { gap: spacing.sm },
  juzHeader: { gap: spacing.xs, paddingTop: spacing.sm },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  pageResult: {
    minHeight: layout.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  pageResultWords: { flex: 1 },
  pressed: { opacity: stateOpacity.pressed },
});
