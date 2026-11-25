import { useTranslation } from 'react-i18next';

import {
  AppText,
  ButtonRow,
  ContentRow,
  GroupedList,
  LabelRow,
  ListSection,
  Screen,
  type IconSymbol,
} from '@/ui';

import type { PassageWords } from '../passage-words';

const SURAH_SYMBOL: IconSymbol = { ios: 'book.closed', android: 'menu_book' };
const PAGE_SYMBOL: IconSymbol = { ios: 'doc.text', android: 'description' };

export interface FoundViewProps {
  readonly passage: PassageWords;
  readonly onOpenPage: (page: number) => void;
  readonly onListenAgain: () => void;
  readonly onClose: () => void;
}

/**
 * "Passage found": the surah, the verses, the page, and the reader opened at that page with one
 * press. A grouped list of the system (lists-and-tables.md › Best practices: text in a list),
 * one prominent button for the most likely action (buttons.md › Style).
 */
export function FoundView({ passage, onOpenPage, onListenAgain, onClose }: FoundViewProps) {
  const { t } = useTranslation('listening');
  return (
    <Screen background="groupedBackground" testID="listening-found">
      <GroupedList>
        <ListSection>
          <ContentRow>
            <AppText variant="largeTitle">{t('found.title')}</AppText>
          </ContentRow>
        </ListSection>
        <ListSection>
          <LabelRow label={passage.surah} detail={passage.verses} symbol={SURAH_SYMBOL} />
          <LabelRow label={t('page', { page: passage.page })} symbol={PAGE_SYMBOL} />
        </ListSection>
        <ListSection>
          <ButtonRow
            label={t('found.open', { page: passage.page })}
            variant="primary"
            onPress={() => onOpenPage(passage.page)}
            testID="listening-open-page"
          />
        </ListSection>
        <ListSection>
          <ButtonRow label={t('actions.listenAgain')} variant="plain" onPress={onListenAgain} />
          <ButtonRow label={t('actions.close')} variant="plain" onPress={onClose} />
        </ListSection>
      </GroupedList>
    </Screen>
  );
}
