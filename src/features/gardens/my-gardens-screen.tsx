import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { GardenState } from '@/domain/garden';
import { levelPath, type LevelStep, type Progression } from '@/domain/levels';
import { HIZB_COUNT } from '@/domain/quran';
import { previewGardenState } from '@/features/garden';
import {
  AppText,
  getWritingDirection,
  Icon,
  layout,
  spacing,
  useColors,
  useColorValues,
  useSafeInsets,
  type IconSymbol,
} from '@/ui';

import { formatBadgeDate } from './format';
import { GardenSilhouette, GardenThumb } from './garden-thumb';

const CHECK: IconSymbol = { ios: 'checkmark', android: 'check' };
const LOCK: IconSymbol = { ios: 'lock.fill', android: 'lock' };

const COMPLETE_GARDEN = previewGardenState({ hizbCompleted: HIZB_COUNT });
const BARE_EARTH = previewGardenState({ hizbCompleted: 0 });

/** Height of the dotted path between two steps, in points. */
const CONNECTOR_HEIGHT = 44;
/** Size of the gold check on a completed garden. */
const SEAL = 36;

export interface MyGardensScreenProps {
  progression: Progression | null;
  /** The garden on display, as the home screen computes it: the current step shows it live. */
  garden: GardenState | null;
}

/**
 * "Mes jardins" (path.png): the levels of this version as a path, one garden after the other on
 * alternate sides. A completed level shows its garden whole, with a gold check and the khatma and
 * day that completed it; the current one its garden as it grows; the levels to come a blank plot
 * and a lock, nothing of their name or look (D46: a surprise). One scroll view; each step is one
 * element for VoiceOver.
 */
export function MyGardensScreen({ progression, garden }: MyGardensScreenProps) {
  const { t } = useTranslation('gardens');
  const colors = useColors();
  const insets = useSafeInsets();
  const steps = useMemo(() => (progression === null ? [] : levelPath(progression)), [progression]);
  const ownsInsets = Platform.OS !== 'ios';
  return (
    <ScrollView
      style={{ backgroundColor: colors.canvas }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.content,
        ownsInsets ? { paddingTop: insets.top, paddingBottom: insets.bottom } : null,
      ]}
      testID="my-gardens"
    >
      <View style={styles.header}>
        <AppText variant="largeTitle" color="heading">
          {t('path.title')}
        </AppText>
        <AppText variant="body" color="muted">
          {t('path.subtitle')}
        </AppText>
      </View>
      {steps.map((step, index) => (
        <View key={step.level}>
          {index === 0 ? null : (
            <Connector fromStart={index % 2 === 1} isWalked={step.status !== 'locked'} />
          )}
          <PathStep
            step={step}
            pictureAtStart={index % 2 === 0}
            progression={progression}
            garden={garden}
          />
        </View>
      ))}
      {progression !== null && progression.level === progression.maxLevel ? (
        <AppText variant="footnote" color="muted" style={styles.note} testID="my-gardens-last">
          {t('path.lastLevel')}
        </AppText>
      ) : null}
    </ScrollView>
  );
}

function PathStep({
  step,
  pictureAtStart,
  progression,
  garden,
}: {
  step: LevelStep;
  pictureAtStart: boolean;
  progression: Progression | null;
  garden: GardenState | null;
}) {
  const { t, i18n } = useTranslation('gardens');
  const colors = useColors();
  const values = useColorValues();
  const level = t('level.value', { level: step.level });
  const isLocked = step.styleId === null;
  const name = step.styleId === null ? t('path.locked') : t(`styles.${step.styleId}`);
  let detail: string;
  if (step.status === 'completed' && step.khatm !== null && step.completedOn !== null) {
    detail = t('path.completed', {
      khatm: step.khatm,
      date: formatBadgeDate(step.completedOn, i18n.language),
    });
  } else if (step.status === 'current' && progression !== null) {
    detail = progression.hasStarted
      ? t('path.current', { count: progression.hizbCompleted })
      : t('path.currentNotStarted');
  } else {
    detail = '';
  }
  const label = isLocked
    ? t('path.lockedLabel', { level: step.level })
    : [level, name, step.status === 'completed' ? t('path.doneLabel') : null, detail]
        .filter((part): part is string => part !== null && part !== '')
        .join(', ');
  const currentState =
    progression !== null && (progression.hasStarted || progression.currentKhatm === 1) && garden
      ? garden
      : BARE_EARTH;

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.step, pictureAtStart ? styles.pictureFirst : styles.pictureLast]}
      testID={`my-gardens-level-${step.level}`}
    >
      <View style={styles.picture}>
        {step.status === 'current' ? (
          <View style={[styles.halo, { backgroundColor: colors.actionTonal }]} />
        ) : null}
        {step.styleId === null ? (
          <View style={styles.locked}>
            <GardenSilhouette />
            <View style={styles.lock}>
              <Icon symbol={LOCK} textStyle="title3" tint={values.muted} />
            </View>
          </View>
        ) : (
          <GardenThumb
            styleId={step.styleId}
            state={step.status === 'completed' ? COMPLETE_GARDEN : currentState}
          />
        )}
        {step.status === 'completed' ? (
          <View style={[styles.seal, { backgroundColor: colors.gold }]}>
            <Icon symbol={CHECK} textStyle="subheadEmphasized" tint={values.onAction} />
          </View>
        ) : null}
      </View>
      <View style={styles.words}>
        <AppText variant="subheadEmphasized" color={isLocked ? 'muted' : 'actionTint'}>
          {level}
        </AppText>
        <AppText variant="title3" color={isLocked ? 'muted' : 'heading'}>
          {name}
        </AppText>
        {detail === '' ? null : (
          <AppText variant="subhead" color="muted">
            {detail}
          </AppText>
        )}
      </View>
    </View>
  );
}

/**
 * The dotted path from one step to the next, from the side of one picture to the side of the
 * other: green where the person has walked, quiet where the way is still to come. Drawn for left to
 * right and mirrored in Arabic, where the pictures change sides too.
 */
function Connector({ fromStart, isWalked }: { fromStart: boolean; isWalked: boolean }) {
  const values = useColorValues();
  const drawnLeftToRight = getWritingDirection() === 'rtl' ? !fromStart : fromStart;
  return (
    <View
      style={[styles.connector, drawnLeftToRight ? null : styles.mirrored]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Svg
        width="100%"
        height={CONNECTOR_HEIGHT}
        viewBox={`0 0 100 ${CONNECTOR_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <Path
          d={`M 30 0 C 30 ${CONNECTOR_HEIGHT / 2}, 70 ${CONNECTOR_HEIGHT / 2}, 70 ${CONNECTOR_HEIGHT}`}
          fill="none"
          stroke={isWalked ? values.actionTint : values.dotEmpty}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray="0.1 6"
          vectorEffect="non-scaling-stroke"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  header: {
    paddingHorizontal: layout.screenMargin + spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    rowGap: spacing.xs,
  },
  step: {
    alignItems: 'center',
    columnGap: spacing.md,
    paddingHorizontal: layout.screenMargin,
  },
  pictureFirst: { flexDirection: 'row' },
  pictureLast: { flexDirection: 'row-reverse' },
  picture: { width: '52%', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    top: '-6%',
    bottom: '-6%',
    start: '4%',
    end: '4%',
    borderRadius: 999,
    opacity: 0.7,
  },
  locked: { opacity: 0.6 },
  lock: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    start: 0,
    end: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seal: {
    position: 'absolute',
    top: 0,
    end: spacing.sm,
    width: SEAL,
    height: SEAL,
    borderRadius: SEAL / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: { flex: 1, rowGap: spacing.xs },
  connector: { height: CONNECTOR_HEIGHT },
  mirrored: { transform: [{ scaleX: -1 }] },
  note: { paddingHorizontal: layout.screenMargin + spacing.xs, paddingTop: spacing.lg },
});
