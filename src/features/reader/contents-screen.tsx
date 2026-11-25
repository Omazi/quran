import { useTranslation } from 'react-i18next';

import { getDisplayedLanguage } from '@/i18n';
import {
  AppText,
  ButtonRow,
  ContentRow,
  DetailRow,
  GroupedList,
  ListRow,
  ListSection,
  Screen,
  SearchFieldRow,
  SegmentedChoice,
} from '@/ui';

import type { HizbEntry, SurahEntry } from './contents-model';
import { surahDisplayName } from './reader-screen';
import type { ContentsActions, ContentsModel, ContentsView } from './use-contents-model';

export interface ContentsScreenProps {
  model: ContentsModel;
  actions: ContentsActions;
}

/**
 * The Quran tab: where do I resume, and how do I reach a surah or a page? (spec 1)
 *
 * One list of the system, so the whole tab scrolls as one (lists-and-tables.md › Style). In order
 * of importance (layout.md › Visual hierarchy):
 *
 * - the title;
 * - "Reprendre", the most likely action of the screen and its only prominent button, in the
 *   accent: a short verb, with the surah and the page it opens on a second line (buttons.md ›
 *   Style; writing.md › Be action oriented);
 * - the inline search field, directly under it, above the list it searches (search-fields.md ›
 *   Search as an inline field). It filters the surahs as the person types and takes a page
 *   number too: a number from 1 to 604 puts a "Page n" row at the top of the results. It is not
 *   pinned while scrolling, which the guideline only suggests: pinning is the system's
 *   `searchable` in a navigation bar, which the app does not have (deviation 36 of the register);
 * - the surahs or the juz, which a segmented control switches (segmented-controls.md › Mobile).
 *   While something is typed, the results replace both.
 *
 * Each row that opens a page says what it opens and ends with the disclosure indicator
 * (lists-and-tables.md › Mobile). The Arabic name of each surah is the character of its row: in
 * the Quran font, in ink; each juz header carries its opening words the same way.
 */
export function ContentsScreen({ model, actions }: ContentsScreenProps) {
  const { t } = useTranslation('reader');
  const viewOptions = [
    { value: 'surahs', label: t('contents.view.surahs') },
    { value: 'juz', label: t('contents.view.juz') },
  ] as const;
  const { goTo } = model;
  const isSearching = model.query.trim() !== '';
  return (
    <Screen background="groupedBackground" testID="contents">
      <GroupedList testID="contents-list">
        <ListSection>
          <ContentRow>
            <AppText variant="largeTitle">{t('contents.title')}</AppText>
          </ContentRow>
        </ListSection>
        <ListSection>
          <ButtonRow
            variant="primary"
            label={t('contents.resume.action')}
            detail={t('contents.resume.detail', {
              surah: surahDisplayName(model.resume.surah),
              page: model.resume.page,
            })}
            onPress={() => actions.openPage(model.resume.page)}
            testID="contents-resume"
          />
        </ListSection>
        <ListSection>
          <SearchFieldRow
            label={t('contents.search.label')}
            placeholder={t('contents.search.placeholder')}
            value={model.query}
            onChange={actions.setQuery}
            clearLabel={t('contents.search.clear')}
            testID="contents-search"
          />
        </ListSection>
        <ListSection>
          <SegmentedChoice<ContentsView>
            label={t('contents.view.label')}
            options={viewOptions}
            value={model.view}
            onChange={actions.setView}
            testID="contents-view"
          />
        </ListSection>
        {isSearching ? (
          <ListSection>
            {goTo === null ? null : (
              <DetailRow
                label={t('contents.search.page', { page: goTo.page })}
                detail={t('contents.search.pageDetail', {
                  surah: surahDisplayName(goTo.surah),
                  juz: goTo.juz,
                })}
                onPress={() => actions.openPage(goTo.page)}
                testID="contents-page-result"
              />
            )}
            {model.surahs.length === 0 ? (
              goTo === null ? (
                <ListRow
                  label={t('contents.search.empty', { query: model.query.trim() })}
                  testID="contents-search-empty"
                />
              ) : null
            ) : (
              model.surahs.map((entry) => (
                <SurahRow key={entry.surah} entry={entry} onOpen={actions.openPage} />
              ))
            )}
          </ListSection>
        ) : model.view === 'surahs' ? (
          <ListSection>
            {model.surahs.map((entry) => (
              <SurahRow key={entry.surah} entry={entry} onOpen={actions.openPage} />
            ))}
          </ListSection>
        ) : (
          model.juz.map((juz) => (
            <ListSection
              key={juz.juz}
              title={t('contents.juz.title', { juz: juz.juz })}
              titleQuran={model.juzOpenings[juz.juz]}
            >
              {juz.hizbs.map((hizb) => (
                <HizbRow key={hizb.hizb} entry={hizb} onOpen={actions.openPage} />
              ))}
            </ListSection>
          ))
        )}
      </GroupedList>
    </Screen>
  );
}

/**
 * One surah: its number and name, then whether it is Meccan or Medinan, its verses and its page.
 * Its Arabic name, in the Quran font and in ink, is the value of the row. Outside Arabic, the
 * label carries the transliteration; in Arabic, the label carries the number alone, since the
 * name is already the value.
 */
function SurahRow({ entry, onOpen }: { entry: SurahEntry; onOpen: (page: number) => void }) {
  const { t } = useTranslation('reader');
  const isArabic = getDisplayedLanguage() === 'ar';
  return (
    <DetailRow
      label={
        isArabic
          ? t('contents.surah.numberOnly', { number: entry.surah })
          : t('contents.surah.label', { number: entry.surah, name: entry.nameTransliterated })
      }
      detail={t('contents.surah.detail', {
        count: entry.verseCount,
        place: t(`contents.surah.${entry.revelationPlace}`),
        page: entry.page,
      })}
      value={entry.nameArabic}
      valueStyle="quran"
      onPress={() => onOpen(entry.page)}
      testID={`contents-surah-${entry.surah}`}
    />
  );
}

/** One hizb: its number, then the surah and verse it starts with, and its page. */
function HizbRow({ entry, onOpen }: { entry: HizbEntry; onOpen: (page: number) => void }) {
  const { t } = useTranslation('reader');
  return (
    <DetailRow
      label={t('contents.juz.hizb', { hizb: entry.hizb })}
      detail={t('contents.juz.start', {
        surah: surahDisplayName(entry.start.surah),
        verse: entry.start.verse,
        page: entry.page,
      })}
      onPress={() => onOpen(entry.page)}
      testID={`contents-hizb-${entry.hizb}`}
    />
  );
}
