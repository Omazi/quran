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
  NumberFieldRow,
  Screen,
  SearchFieldRow,
  SegmentedChoice,
} from '@/ui';

import type { HizbEntry, SurahEntry } from './contents-model';
import { FIRST_PAGE, LAST_PAGE } from './page-order';
import { surahDisplayName } from './reader-screen';
import type { ContentsActions, ContentsModel, ContentsView } from './use-contents-model';

export interface ContentsScreenProps {
  model: ContentsModel;
  actions: ContentsActions;
}

/**
 * The Quran tab: where do I resume, and how do I reach a surah? (spec 1)
 *
 * One list of the system, so the whole tab scrolls as one (lists-and-tables.md › Style). In order
 * of importance (layout.md › Visual hierarchy):
 *
 * - the title;
 * - "Reprendre", the most likely action of the screen and its only prominent button, in the
 *   accent, naming the surah and the page it opens (buttons.md › Style; buttons.md › Content);
 * - a page by its number: a number field with the number pad, then the button that opens it.
 *   A wheel picker of 604 values is what pickers.md › Best practices advises against ("a very
 *   large set of items": a list or a field), and text-fields.md › Best practices asks for the
 *   number keyboard and for validation, given in the footer;
 * - the surahs or the juz, which a segmented control switches (segmented-controls.md › Mobile).
 *   Above the surahs, an inline search field filters them as the person types
 *   (search-fields.md › Search as an inline field; search-fields.md › Best practices).
 *
 * Each row that opens a page says what it opens and ends with the disclosure indicator
 * (lists-and-tables.md › Mobile). The Arabic name of each surah is the character of its row: in
 * the Quran font, in ink.
 */
export function ContentsScreen({ model, actions }: ContentsScreenProps) {
  const { t } = useTranslation('reader');
  const viewOptions = [
    { value: 'surahs', label: t('contents.view.surahs') },
    { value: 'juz', label: t('contents.view.juz') },
  ] as const;
  const { goToPage } = model;
  const isGoToInvalid = model.goToText !== '' && goToPage === null;
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
            label={t('contents.resume.action', {
              surah: surahDisplayName(model.resume.surah),
              page: model.resume.page,
            })}
            onPress={() => actions.openPage(model.resume.page)}
            testID="contents-resume"
          />
        </ListSection>
        <ListSection
          title={t('contents.goTo.title')}
          footer={
            isGoToInvalid
              ? t('contents.goTo.invalid', { first: FIRST_PAGE, last: LAST_PAGE })
              : t('contents.goTo.footer', { last: LAST_PAGE })
          }
        >
          <NumberFieldRow
            label={t('contents.goTo.field')}
            placeholder={t('contents.goTo.placeholder', { first: FIRST_PAGE, last: LAST_PAGE })}
            value={model.goToText}
            onChange={actions.setGoToText}
            testID="contents-go-to-page"
          />
          <ButtonRow
            variant="plain"
            label={
              goToPage === null
                ? t('contents.goTo.openNone')
                : t('contents.goTo.open', { page: goToPage })
            }
            disabled={goToPage === null}
            onPress={() => {
              if (goToPage !== null) actions.openPage(goToPage);
            }}
            testID="contents-open-page"
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
        {model.view === 'surahs' ? (
          <>
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
              {model.surahs.length === 0 ? (
                <ListRow
                  label={t('contents.search.empty', { query: model.query.trim() })}
                  testID="contents-search-empty"
                />
              ) : (
                model.surahs.map((entry) => (
                  <SurahRow key={entry.surah} entry={entry} onOpen={actions.openPage} />
                ))
              )}
            </ListSection>
          </>
        ) : (
          model.juz.map((juz) => (
            <ListSection key={juz.juz} title={t('contents.juz.title', { juz: juz.juz })}>
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
