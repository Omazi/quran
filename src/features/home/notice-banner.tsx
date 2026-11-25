import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { GardenPhase } from '@/domain/garden';
import { AppText, Card, IconTile, spacing } from '@/ui';

import { HOME_SYMBOLS } from './config';
import type { HomeDrought } from './home-model';

type DroughtPhase = Extract<GardenPhase, 'thirsty' | 'wilting' | 'dying'>;

export interface ThirstBannerProps {
  phase: DroughtPhase;
  drought: HomeDrought;
}

/**
 * The banner of a thirsty garden (soif.png): how many days without reading and what it did to the
 * garden, then what the next days bring if nothing is read, from the garden module's own forecast.
 * Said once, in the content, never as an alert (feedback.md › Best practices), and never as a
 * reproach (charter, voice). Amber with a drop, the words saying the same (color.md › Inclusive color).
 */
export function ThirstBanner({ phase, drought }: ThirstBannerProps) {
  const { t } = useTranslation('home');
  const title = t(`thirst.title.${phase}`);
  const text = t(`thirst.text.${phase}`, { count: drought.daysWithoutReading });
  const next =
    drought.next === null
      ? null
      : t(`thirst.next.${drought.next.phase}`, { count: drought.next.inDays });
  const words = next === null ? text : `${text} ${next}`;
  return (
    <Card tone="thirst" accessibilityLabel={`${title}. ${words}`} testID={`home-notice-${phase}`}>
      <View style={styles.row}>
        <IconTile symbol={HOME_SYMBOLS.drop} tone="thirst" size="medium" />
        <View style={styles.text}>
          <AppText variant="headline" color="thirst">
            {title}
          </AppText>
          <AppText variant="subhead" color="thirstSecondary">
            {words}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

/** A garden watered again today after a drought: good news, told in water's colours. */
export function RecoveringBanner() {
  const { t } = useTranslation('home');
  const title = t('notice.recovering.title');
  const text = t('notice.recovering.text');
  return (
    <Card tone="raised" accessibilityLabel={`${title}. ${text}`} testID="home-notice-recovering">
      <View style={styles.row}>
        <IconTile symbol={HOME_SYMBOLS.drop} tone="water" size="medium" />
        <View style={styles.text}>
          <AppText variant="headline">{title}</AppText>
          <AppText variant="subhead" color="muted">
            {text}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', columnGap: spacing.md },
  text: { flex: 1, rowGap: spacing.xs },
});
