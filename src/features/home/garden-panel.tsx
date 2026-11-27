import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useGenderedTranslation } from '@/features/gender';
// The mark alone, not the whole listening module (which reaches the reader, then the home screen).
import { RosetteMark } from '@/features/listening/rosette/rosette-mark';
import {
  ActionButton,
  AppText,
  GlassSurface,
  Icon,
  ProgressRing,
  SegmentProgress,
  layout,
  pieceSizes,
  spacing,
  stateOpacity,
  useColors,
  type IconSymbol,
} from '@/ui';

import { HOME_SYMBOLS } from './config';
import type { HomeReadyModel } from './home-model';
import { RecoveringBanner } from './notice-banner';
import { resumePlaceOf } from './resume-place';

const DISCLOSURE: IconSymbol = { ios: 'chevron.forward', android: 'chevron_right' };

export interface GardenPanelProps {
  model: HomeReadyModel;
  appearance: 'light' | 'dark';
  /** Opacity of the glass's tint where the app draws it (`useSkyChrome`). */
  veil: number;
  onRead: () => void;
  onRecognize: () => void;
  /** "Un grenadier pousse": the camera goes to the plant, a second tap comes back. */
  onLookAtGrowth: () => void;
}

/** The first letter in capitals: the garden module writes its phrases to sit inside a sentence. */
function sentenceCase(text: string, language: string): string {
  return text.charAt(0).toLocaleUpperCase(language) + text.slice(1);
}

/**
 * The glass panel at the bottom of the home garden (maquette-wow, `.hm-panel`, validated on 27
 * November 2026): what grows and how far ("Un grenadier pousse · 3 pages sur 10 du hizb 25", its
 * ring), the day's watering ("Arrosage du jour", one bar per page of the goal, "5 sur 8"), then
 * the one main button and its quiet neighbour (buttons.md › Style: one prominent button, the
 * other quieter by style, not by size). Rows read as one sentence each for VoiceOver
 * (voiceover.md › Descriptions); the two buttons stack rather than cut a word at large text
 * sizes (typography.md › Supporting Dynamic Type).
 */
export function GardenPanel({
  model,
  appearance,
  veil,
  onRead,
  onRecognize,
  onLookAtGrowth,
}: GardenPanelProps) {
  const { t, i18n } = useGenderedTranslation('home');
  const { t: tGarden } = useGenderedTranslation('garden');
  const colors = useColors();
  const { fontScale } = useWindowDimensions();
  const isSideBySide = fontScale <= layout.sideBySideMaxFontScale;
  const { today, hizb, garden, layout: homeLayout } = model;
  const isThirsty = homeLayout === 'thirsty';
  const next = garden.nextElement;
  const pagesToday = t('today.pages', { count: today.pagesRead, goal: today.goalPages });
  // Where "Lire et arroser" opens, said to VoiceOver (voiceover.md › Hints): the card that wrote
  // it on screen is not in the validated mockup.
  const place = resumePlaceOf(model.reading.nextPage, i18n.language);
  const where = t(model.reading.hasStarted ? 'today.resume' : 'today.start', {
    page: model.reading.nextPage,
  });
  return (
    <GlassSurface appearance={appearance} shape="panel" veil={veil} testID="home-panel">
      <View style={styles.inside}>
        {model.notice === 'recovering' ? <RecoveringBanner /> : null}
        {isThirsty && model.drought !== null ? (
          <ThirstRow model={model} />
        ) : next !== null && hizb.inProgress !== null ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={growingLabel()}
            accessibilityHint={t('growing.lookHint')}
            onPress={onLookAtGrowth}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            testID="home-growing"
          >
            <ProgressRing
              progress={next.growth}
              size="large"
              tone="growth"
              accessibilityLabel={tGarden(`growing.${next.element.kind}`)}
              accessibilityValue={t('growing.value', { percent: Math.round(next.growth * 100) })}
            >
              <Icon symbol={HOME_SYMBOLS.leaf} textStyle="title3" color="actionTint" />
            </ProgressRing>
            <View style={styles.text}>
              <AppText variant="headline">
                {sentenceCase(tGarden(`growing.${next.element.kind}`), i18n.language)}
              </AppText>
              <AppText variant="subhead" color="muted">
                {growingDetail()}
              </AppText>
            </View>
            <Icon symbol={DISCLOSURE} textStyle="footnote" color="muted" />
          </Pressable>
        ) : (
          <View
            style={styles.row}
            accessible
            accessibilityLabel={tGarden('readout.hizb.value', {
              hizb: hizb.completed,
              total: hizb.total,
            })}
            testID="home-hizb-count"
          >
            <Icon symbol={HOME_SYMBOLS.leaf} textStyle="title3" color="actionTint" />
            <AppText variant="headline" style={styles.text}>
              {tGarden('readout.hizb.value', { hizb: hizb.completed, total: hizb.total })}
            </AppText>
          </View>
        )}
        <View style={[styles.divider, { backgroundColor: colors.glassDivider }]} />
        <View
          style={styles.row}
          accessible
          accessibilityLabel={`${t('today.title')}, ${pagesToday}`}
          testID="home-today-pages"
        >
          <View style={styles.dropSlot}>
            <Icon symbol={HOME_SYMBOLS.drop} textStyle="title2" color="waterFill" />
          </View>
          <View style={styles.text}>
            <AppText variant="subheadEmphasized" color="water">
              {t('today.title')}
            </AppText>
            <SegmentProgress
              total={today.goalPages}
              reached={today.pagesRead}
              accessibilityLabel={t('today.title')}
              accessibilityValue={pagesToday}
            />
          </View>
          <View style={styles.count}>
            <AppText variant="title3">{String(today.pagesRead)}</AppText>
            <AppText variant="footnote" color="muted">
              {t('today.ofGoal', { goal: today.goalPages })}
            </AppText>
          </View>
        </View>
        <View style={[styles.actions, isSideBySide ? styles.actionRow : styles.actionColumn]}>
          <ActionButton
            label={t(isThirsty ? 'actions.waterNow' : 'actions.read')}
            symbol={HOME_SYMBOLS.drop}
            accessibilityHint={`${place.name}, ${where}`}
            onPress={onRead}
            grows={isSideBySide}
            testID="home-read"
          />
          <ActionButton
            variant="glass"
            label={t('actions.recognize')}
            accessibilityLabel={t('actions.recognizeLabel')}
            leading={<RosetteMark size={pieceSizes.markInButton} tone="tonal" />}
            onPress={onRecognize}
            grows={isSideBySide}
            testID="home-recognize"
          />
        </View>
      </View>
    </GlassSurface>
  );

  function growingDetail(): string {
    const pages = model.growingPages;
    const inProgress = hizb.inProgress ?? hizb.completed + 1;
    if (pages === null) return t('growing.lineAlone', { hizb: inProgress, total: hizb.total });
    return t('growing.ofHizb', {
      pages: t('growing.pages', { count: pages.read, total: pages.total }),
      hizb: inProgress,
    });
  }

  function growingLabel(): string {
    if (next === null) return '';
    const title = sentenceCase(tGarden(`growing.${next.element.kind}`), i18n.language);
    return `${title}, ${growingDetail()}`;
  }
}

/** A thirsty garden: what the drought did, and what one page brings back (soif.png's words). */
function ThirstRow({ model }: { model: HomeReadyModel }) {
  const { t } = useGenderedTranslation('home');
  const phase = model.garden.phase;
  const drought = model.drought;
  if (drought === null || (phase !== 'thirsty' && phase !== 'wilting' && phase !== 'dying')) {
    return null;
  }
  const title = t(`thirst.title.${phase}`);
  const text = t(`thirst.text.${phase}`, { count: drought.daysWithoutReading });
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${title}. ${text}`}
      testID={`home-notice-${phase}`}
    >
      <View style={styles.dropSlot}>
        <Icon symbol={HOME_SYMBOLS.drop} textStyle="title2" color="thirstIcon" />
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
  inside: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: layout.controlGap,
    minHeight: layout.touchTarget,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: stateOpacity.pressed },
  text: { flex: 1, rowGap: spacing.xs },
  dropSlot: { width: pieceSizes.ringLarge, alignItems: 'center' },
  count: { flexDirection: 'row', alignItems: 'baseline', columnGap: spacing.xs },
  divider: { height: layout.outlineWidth },
  actions: { marginTop: spacing.sm, gap: layout.controlGap },
  actionRow: { flexDirection: 'row', alignItems: 'center' },
  actionColumn: { flexDirection: 'column' },
});
