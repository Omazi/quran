import { useTranslation } from 'react-i18next';

import {
  AppText,
  ButtonRow,
  ContentRow,
  GroupedList,
  ListRow,
  ListSection,
  Screen,
  spacing,
} from '@/ui';
import { StyleSheet, View } from 'react-native';

import type { PassageWords } from '../passage-words';

export interface PassagesViewProps {
  /** Every tied place, in the order of the mushaf. */
  readonly passages: readonly PassageWords[];
  /** How many places the search counted: more than are listed when the list was cut. */
  readonly totalCount: number;
  readonly isComplete: boolean;
  readonly onOpenPage: (page: number) => void;
  readonly onListenAgain: () => void;
  readonly onClose: () => void;
}

/**
 * "Several passages": the search never chooses at random (specs/recognition.md), so the screen
 * lists the places and lets the person choose. Each row opens the reader at its page
 * (lists-and-tables.md › Mobile: a row that leads somewhere shows it).
 */
export function PassagesView({
  passages,
  totalCount,
  isComplete,
  onOpenPage,
  onListenAgain,
  onClose,
}: PassagesViewProps) {
  const { t } = useTranslation('listening');
  return (
    <Screen background="groupedBackground" testID="listening-several">
      <GroupedList>
        <ListSection>
          <ContentRow>
            <View style={styles.header}>
              <AppText variant="largeTitle">{t('several.title')}</AppText>
              <AppText color="secondaryLabel">
                {t('several.description', { count: totalCount })}
              </AppText>
            </View>
          </ContentRow>
        </ListSection>
        <ListSection
          title={t('several.places')}
          footer={
            isComplete
              ? undefined
              : t('several.incomplete', { shown: passages.length, count: totalCount })
          }
        >
          {passages.map((passage, index) => (
            <ListRow
              key={`${index}:${passage.surah}:${passage.firstVerse}`}
              label={passage.surah}
              value={t('several.rowValue', { verse: passage.firstVerse, page: passage.page })}
              onPress={() => onOpenPage(passage.page)}
            />
          ))}
        </ListSection>
        <ListSection>
          <ButtonRow label={t('actions.listenAgain')} variant="secondary" onPress={onListenAgain} />
        </ListSection>
        <ListSection>
          <ButtonRow label={t('actions.close')} variant="plain" onPress={onClose} />
        </ListSection>
      </GroupedList>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
});
