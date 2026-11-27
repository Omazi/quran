import { StyleSheet, View } from 'react-native';

import { useGenderedTranslation } from '@/features/gender';
import { AppText, Icon, layout, pieceSizes, spacing } from '@/ui';

import { HOME_SYMBOLS } from './config';

/**
 * A garden watered again today after a drought: good news, told in water's colours, as the first
 * row of the glass panel over the home garden (maquette-wow). Said once, never as an alert
 * (feedback.md › Best practices).
 */
export function RecoveringBanner() {
  const { t } = useGenderedTranslation('home');
  const title = t('notice.recovering.title');
  const text = t('notice.recovering.text');
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${title}. ${text}`}
      testID="home-notice-recovering"
    >
      <View style={styles.symbol}>
        <Icon symbol={HOME_SYMBOLS.drop} textStyle="title2" color="waterFill" />
      </View>
      <View style={styles.text}>
        <AppText variant="headline">{title}</AppText>
        <AppText variant="subhead" color="muted">
          {text}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: layout.controlGap,
    paddingVertical: spacing.sm,
  },
  symbol: { width: pieceSizes.ringLarge, alignItems: 'center' },
  text: { flex: 1, rowGap: spacing.xs },
});
