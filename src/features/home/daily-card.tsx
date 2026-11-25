import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  ActionButton,
  AppText,
  ArabicDisplayText,
  Card,
  Icon,
  ProgressRing,
  layout,
  spacing,
} from '@/ui';

import { HOME_SYMBOLS } from './config';
import type { HomeReadyModel } from './home-model';
import { resumePlaceOf } from './resume-place';

export interface DailyCardProps {
  model: HomeReadyModel;
  onRead: () => void;
}

/**
 * "Arrosage du jour" (accueil.png, soif.png): the ring of the pages read today out of the goal,
 * what is left to finish the hizb (or, on a thirsty garden, that one page brings the water back),
 * the page to resume in its cream card, and the one main button of the screen
 * (buttons.md › Style). The header is read as one sentence; the ring only draws it.
 */
export function DailyCard({ model, onRead }: DailyCardProps) {
  const { t, i18n } = useTranslation('home');
  const { today, reading, hizb, layout: homeLayout } = model;
  const isThirsty = homeLayout === 'thirsty';
  const pages = t('today.pages', { count: today.pagesRead, goal: today.goalPages });
  const detail =
    isThirsty || hizb.inProgress === null || hizb.pagesLeft === null
      ? t('today.onePage')
      : t('today.hizbLeft', { count: hizb.pagesLeft, hizb: hizb.inProgress });
  const place = resumePlaceOf(reading.nextPage, i18n.language);
  const where = t(reading.hasStarted ? 'today.resume' : 'today.start', { page: reading.nextPage });
  const progress = Math.min(1, today.pagesRead / today.goalPages);
  return (
    <Card tone="raised" testID="home-today">
      <View
        style={styles.header}
        accessible
        accessibilityLabel={`${t('today.title')}, ${pages}, ${detail}`}
        testID="home-today-pages"
      >
        <ProgressRing
          progress={progress}
          size="large"
          tone="water"
          accessibilityLabel={t('today.title')}
          accessibilityValue={pages}
        >
          <Icon symbol={HOME_SYMBOLS.drop} textStyle="title3" color="waterFill" />
        </ProgressRing>
        <View style={styles.headerText}>
          <AppText variant="subheadEmphasized" color="water">
            {t('today.title')}
          </AppText>
          <AppText variant="title3">{pages}</AppText>
          <AppText variant="footnote" color="muted">
            {detail}
          </AppText>
        </View>
      </View>
      <Card
        tone="inset"
        accessibilityLabel={`${place.name}, ${where}`}
        style={styles.resume}
        testID="home-resume"
      >
        <View style={styles.resumeRow}>
          <View style={styles.resumeText}>
            <AppText variant="callout">{place.name}</AppText>
            <AppText variant="footnote" color="muted">
              {where}
            </AppText>
          </View>
          {place.arabicName === null ? null : <ArabicDisplayText text={place.arabicName} />}
        </View>
      </Card>
      <View style={styles.action}>
        <ActionButton
          label={t(isThirsty ? 'actions.waterNow' : 'actions.read')}
          symbol={HOME_SYMBOLS.drop}
          onPress={onRead}
          testID="home-read"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', columnGap: spacing.md },
  headerText: { flex: 1, rowGap: spacing.none },
  resume: { marginTop: spacing.md },
  resumeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing.md,
  },
  resumeText: { flexShrink: 1, paddingVertical: spacing.xs },
  action: { marginTop: layout.controlGap + spacing.xs },
});
