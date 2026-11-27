import { StyleSheet, View } from 'react-native';

import { useGenderedTranslation } from '@/features/gender';
import { ActionButton, AppText, Card, IconTile, layout, spacing } from '@/ui';

import { HOME_SYMBOLS } from './config';
import type { HomeReadyModel } from './home-model';

export interface DeadGardenProps {
  model: HomeReadyModel;
  onRead: () => void;
}

/**
 * Under the dry earth (mort.png): what happened, in a large serif title and one sentence; the
 * reassurance that the hizb read stay counted, in a quiet card with a leaf; one button to read a
 * page. No reproach, a clear next step (writing.md › Best practices; charter, voice).
 */
export function DeadGarden({ model, onRead }: DeadGardenProps) {
  const { t } = useGenderedTranslation('home');
  const days = model.drought?.daysWithoutReading ?? model.garden.missedDaysInARow;
  const kept = t('dead.kept', { count: model.hizb.completed });
  const comeBack = t('dead.comeBack');
  return (
    <View style={styles.block}>
      <View style={styles.message}>
        <AppText variant="title1" color="earth" align="center">
          {t('dead.title')}
        </AppText>
        <AppText variant="body" color="earthSecondary" align="center">
          {t('dead.text', { count: days })}
        </AppText>
      </View>
      <Card tone="quiet" accessibilityLabel={`${kept} ${comeBack}`} testID="home-notice-dead">
        <View style={styles.row}>
          <IconTile symbol={HOME_SYMBOLS.leaf} tone="growth" size="medium" />
          <AppText variant="subhead" color="earth" style={styles.text}>
            {/* The first sentence in bold, as in the mockup: nested text keeps one paragraph. */}
            <AppText variant="subheadEmphasized" color="earth">
              {kept}
            </AppText>{' '}
            {comeBack}
          </AppText>
        </View>
      </Card>
      <ActionButton
        label={t('actions.readOnePage')}
        symbol={HOME_SYMBOLS.drop}
        onPress={onRead}
        testID="home-read"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: layout.screenMargin, rowGap: spacing.md },
  message: { rowGap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', columnGap: spacing.md },
  text: { flex: 1 },
});
