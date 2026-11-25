import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { GardenState } from '@/domain/garden';
import { GardenScene } from '@/features/garden';
import { ActionButton, AppText, ArabicDisplayText, Card, layout, spacing } from '@/ui';

import { HOME_SYMBOLS } from './config';
import type { HomeCompletedKhatma } from './home-model';

export interface KhatmaCompleteProps {
  garden: GardenState;
  khatma: HomeCompletedKhatma;
  onShare: (message: string) => void;
  onStartNext: () => void;
}

/**
 * The completed khatma (khatm.png): the whole garden on a sunrise, "60 hizb sur 60", the serif
 * title, a blessing in Arabic and its meaning, the three figures of the khatma, then two
 * buttons: share, quieter, and start the next one, the main action (buttons.md › Style: style,
 * not size, tells the preferred choice).
 */
export function KhatmaComplete({ garden, khatma, onShare, onStartNext }: KhatmaCompleteProps) {
  const { t, i18n } = useTranslation('home');
  // The blessing is Arabic: in Arabic it needs no translation under it. (An empty string in the
  // Arabic file would fall back to the French one.)
  const meaning = i18n.language === 'ar' ? '' : t('complete.blessingMeaning');
  const figures = [
    { value: khatma.hizb, label: t('complete.hizb') },
    { value: khatma.pages, label: t('complete.pages') },
    { value: khatma.days, label: t('complete.days', { count: khatma.days }) },
  ];
  return (
    <View style={styles.page} testID="home-complete">
      <View style={styles.garden}>
        <GardenScene state={garden} size="band" />
      </View>
      <View style={styles.message}>
        <AppText variant="subheadEmphasized" color="ornament" align="center">
          {t('complete.count', { hizb: khatma.hizb, total: khatma.hizb })}
        </AppText>
        <AppText variant="title1" color="heading" align="center">
          {t('complete.title')}
        </AppText>
        <ArabicDisplayText text={t('complete.blessing')} align="center" />
        {meaning === '' ? null : (
          <AppText variant="subhead" color="muted" align="center">
            {meaning}
          </AppText>
        )}
      </View>
      <Card
        tone="raised"
        accessibilityLabel={t('complete.summary', {
          hizb: khatma.hizb,
          pages: khatma.pages,
          count: khatma.days,
        })}
        style={styles.inset}
        testID="home-khatma-figures"
      >
        <View style={styles.figures}>
          {figures.map((figure) => (
            <View key={figure.label} style={styles.figure}>
              <AppText variant="figure" align="center">
                {String(figure.value)}
              </AppText>
              <AppText variant="footnote" color="muted" align="center">
                {figure.label}
              </AppText>
            </View>
          ))}
        </View>
      </Card>
      <View style={styles.actions}>
        <View style={styles.action}>
          <ActionButton
            label={t('complete.share')}
            symbol={HOME_SYMBOLS.share}
            variant="tonal"
            onPress={() => onShare(t('complete.shareMessage', { count: khatma.days }))}
            testID="home-share"
          />
        </View>
        <View style={styles.action}>
          <ActionButton
            label={t('complete.newKhatma')}
            onPress={onStartNext}
            testID="home-new-khatma"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The page fills the screen, the garden taking the room left, as on the mockup.
  page: { flexGrow: 1, rowGap: spacing.lg, paddingBottom: spacing.lg },
  garden: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.xl },
  message: { rowGap: spacing.xs, paddingHorizontal: layout.screenMargin },
  figures: { flexDirection: 'row', justifyContent: 'space-around', columnGap: spacing.sm },
  figure: { flex: 1 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: layout.controlGap,
    rowGap: layout.controlGap,
    paddingHorizontal: layout.screenMargin,
  },
  // Each button as wide as its label needs, the room left shared: "Nouvelle khatma" on one line.
  action: { flexGrow: 1 },
  inset: { marginHorizontal: layout.screenMargin },
});
