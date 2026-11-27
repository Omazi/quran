import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useGenderedTranslation } from '@/features/gender';
import { ActionButton, AppText, IconTile, layout, spacing } from '@/ui';

import type { Arrival } from './arrival';
import { ELEMENT_SYMBOLS, HOME_SYMBOLS } from './config';
import { DismissibleSheet } from './dismissible-sheet';

export interface ArrivalSheetProps {
  arrival: Arrival;
  onDismiss: () => void;
  onShare: (message: string) => void;
}

/**
 * A hizb just finished (nouveau.png): a sheet over the dimmed home screen with the element it
 * grew, its name in a serif title and the next element to come, then "Voir dans mon jardin",
 * which closes it, and a quieter button to share. It follows the system sheet (`DismissibleSheet`:
 * a grabber, a swipe down or a tap outside closes it), drawn here to keep the mockup's card and
 * its size (SKILLS.md, deviation 74).
 *
 * The mockup also shows the verse that inspired the element: none is validated by a teacher yet
 * (`displayableVerse`), so none is shown.
 */
export function ArrivalSheet({ arrival, onDismiss, onShare }: ArrivalSheetProps) {
  const { t } = useGenderedTranslation('home');
  const { t: tGarden } = useTranslation('garden');
  const next = arrival.next;
  return (
    <DismissibleSheet
      onDismiss={onDismiss}
      closeLabel={t('arrival.close')}
      testID="home-arrival"
      closeTestID="home-arrival-close"
      contentStyle={styles.sheet}
    >
      <IconTile symbol={ELEMENT_SYMBOLS[arrival.element.kind]} tone="waterStrong" size="large" />
      <View style={styles.words}>
        <AppText variant="subheadEmphasized" color="actionTint" align="center">
          {t('arrival.hizb', { hizb: arrival.hizb })}
        </AppText>
        <AppText variant="title1" color="heading" align="center">
          {tGarden(`arrival.${arrival.element.kind}`)}
        </AppText>
        {next === null ? null : (
          <AppText variant="footnote" color="muted" align="center">
            {t('arrival.next', {
              hizb: next.hizb,
              element: tGarden(`kinds.${next.kind}`),
            })}
          </AppText>
        )}
      </View>
      <View style={styles.actions}>
        <ActionButton
          symbol={HOME_SYMBOLS.share}
          variant="tonal"
          accessibilityLabel={t('arrival.share')}
          fullWidth={false}
          onPress={() => onShare(t('arrival.shareMessage', { hizb: arrival.hizb }))}
          testID="home-arrival-share"
        />
        <View style={styles.mainAction}>
          <ActionButton label={t('arrival.see')} onPress={onDismiss} testID="home-arrival-see" />
        </View>
      </View>
    </DismissibleSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { alignItems: 'center', rowGap: spacing.md },
  words: { alignSelf: 'stretch', rowGap: spacing.sm },
  actions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: layout.controlGap,
    marginTop: spacing.sm,
  },
  mainAction: { flex: 1 },
});
