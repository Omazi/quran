import { useTranslation } from 'react-i18next';

import {
  AppText,
  ButtonRow,
  ContentRow,
  DetailRow,
  GroupedList,
  ListRow,
  ListSection,
  Screen,
  SegmentedChoice,
  StepperRow,
} from '@/ui';
import { getDisplayedLanguage } from '@/i18n';

import type { SurahEntry } from './contents-model';
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
 * of importance (layout.md › Visual hierarchy): the title, the page to resume, a page by its
 * number, then the surahs or the juz, which a segmented control switches
 * (segmented-controls.md › Mobile: closely related subviews). Each row that opens a page says what
 * it opens and ends with the disclosure indicator (lists-and-tables.md › Mobile).
 *
 * "Aller à la page" is the system stepper beside its value, then a row that opens the page: the
 * kit has no number field, and the system search field is not in this lot (known gaps).
 */
export function ContentsScreen({ model, actions }: ContentsScreenProps) {
  const { t } = useTranslation('reader');
  const viewOptions = [
    { value: 'surahs', label: t('contents.view.surahs') },
    { value: 'juz', label: t('contents.view.juz') },
  ] as const;
  return (
    <Screen background="groupedBackground" testID="contents">
      <GroupedList testID="contents-list">
        <ListSection>
          <ContentRow>
            <AppText variant="largeTitle">{t('contents.title')}</AppText>
          </ContentRow>
        </ListSection>
        <ListSection title={t('contents.resume.title')}>
          <DetailRow
            label={surahDisplayName(model.resume.surah)}
            detail={t('contents.resume.detail', { page: model.resume.page })}
            onPress={() => actions.openPage(model.resume.page)}
            testID="contents-resume"
          />
        </ListSection>
        <ListSection title={t('contents.goTo.title')} footer={t('contents.goTo.footer')}>
          <StepperRow
            label={t('contents.goTo.stepper')}
            value={model.goToPage}
            valueLabel={t('contents.goTo.value', { page: model.goToPage })}
            min={FIRST_PAGE}
            max={LAST_PAGE}
            onChange={actions.setGoToPage}
            testID="contents-go-to-page"
          />
          <ButtonRow
            variant="plain"
            label={t('contents.goTo.open', { page: model.goToPage })}
            onPress={() => actions.openPage(model.goToPage)}
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
          <ListSection>
            {model.surahs.map((entry) => (
              <SurahRow key={entry.surah} entry={entry} onOpen={actions.openPage} />
            ))}
          </ListSection>
        ) : (
          model.juz.map((juz) => (
            <ListSection key={juz.juz} title={t('contents.juz.title', { juz: juz.juz })}>
              {juz.hizbs.map((hizb) => (
                <ListRow
                  key={hizb.hizb}
                  label={t('contents.juz.hizb', { hizb: hizb.hizb })}
                  value={t('contents.juz.page', { page: hizb.page })}
                  onPress={() => actions.openPage(hizb.page)}
                  testID={`contents-hizb-${hizb.hizb}`}
                />
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
 * Outside Arabic, its Arabic name is the value of the row; in Arabic, the name is the label and a
 * transliteration would only add noise.
 */
function SurahRow({ entry, onOpen }: { entry: SurahEntry; onOpen: (page: number) => void }) {
  const { t } = useTranslation('reader');
  const isArabic = getDisplayedLanguage() === 'ar';
  return (
    <DetailRow
      label={t('contents.surah.label', {
        number: entry.surah,
        name: isArabic ? entry.nameArabic : entry.nameTransliterated,
      })}
      detail={t('contents.surah.detail', {
        count: entry.verseCount,
        place: t(`contents.surah.${entry.revelationPlace}`),
        page: entry.page,
      })}
      value={isArabic ? undefined : entry.nameArabic}
      onPress={() => onOpen(entry.page)}
      testID={`contents-surah-${entry.surah}`}
    />
  );
}
