import * as Haptics from 'expo-haptics';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { previewGardenState } from '@/features/garden';
import {
  ActionButton,
  AppText,
  ArabicDisplayText,
  Card,
  GradientBackdrop,
  layout,
  radius,
  spacing,
  useColors,
  useColorValues,
  useReducedMotion,
  useSafeInsets,
  type IconSymbol,
} from '@/ui';

import { GardenThumb } from './garden-thumb';
import type { Celebration } from './gardens-model';
import { KhatmaBadge } from './khatma-badge';

const CLOSE: IconSymbol = { ios: 'xmark', android: 'close' };
const BARE_EARTH = previewGardenState({ hizbCompleted: 0 });

/**
 * The motion of the celebration (animate skill: a rare moment, the delight budget lives here;
 * purpose: delight and state indication). One orchestrated moment: the badge settles with an
 * Apple-style spring, a gold light swells once behind it, a few petals fall, then the words come
 * in one soft fade. With "reduce motion", only fades.
 */
const MOTION = {
  badgeSpring: { duration: 700, dampingRatio: 0.72 },
  badgeFromScale: 0.86,
  haloInMs: 520,
  haloOutMs: 1400,
  haloPeak: 0.9,
  haloRest: 0.45,
  /** At night the gold light is dimmed: a full one reads as a flat disc on the dark sky. */
  haloNightShare: 0.4,
  wordsDelayMs: 380,
  wordsMs: 320,
  reducedFadeMs: 220,
  petalFallMs: 3600,
  petalStaggerMs: 140,
} as const;

/** The falling petals: where each starts across the width, and how it drifts. Decoration only. */
const PETALS = [
  { x: 0.1, drift: 18, delay: 0, size: 9 },
  { x: 0.24, drift: -14, delay: 2, size: 7 },
  { x: 0.4, drift: 12, delay: 5, size: 8 },
  { x: 0.58, drift: -16, delay: 1, size: 10 },
  { x: 0.72, drift: 14, delay: 4, size: 7 },
  { x: 0.88, drift: -12, delay: 3, size: 9 },
] as const;

/** The badge takes this share of the width, at most `BADGE_MAX` points. */
const BADGE_SHARE = 0.62;
const BADGE_MAX = 280;

export interface KhatmaCelebrationScreenProps {
  celebration: Celebration;
  onSeeGarden: () => void;
  onClose: () => void;
}

/**
 * "Khatma terminée" (khatm.png, D46): shown once, when a khatma is completed. The badge (the
 * completed garden in the gold star, the khatma's number), the invocation تقبّل الله منك, the 60
 * hizb, 604 pages and days it took, then the new garden waiting on its bare earth, and the one
 * action: see it. A success haptic marks the moment.
 */
export function KhatmaCelebrationScreen({
  celebration,
  onSeeGarden,
  onClose,
}: KhatmaCelebrationScreenProps) {
  const { t, i18n } = useTranslation('gardens');
  const colors = useColors();
  const insets = useSafeInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const badgeSize = Math.min(width * BADGE_SHARE, BADGE_MAX);
  const garden = t(`styles.${celebration.styleId}`);
  const nextGarden = t(`styles.${celebration.next.styleId}`);
  const days = t('celebration.days', { count: celebration.days });

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, []);

  return (
    <View style={styles.screen} accessibilityViewIsModal testID="khatma-celebration">
      <GradientBackdrop name="growing" style={StyleSheet.absoluteFill} />
      {reduceMotion ? null : <Petals width={width} />}
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.md },
        ]}
      >
        <View style={styles.closeRow}>
          <ActionButton
            variant="tonal"
            symbol={CLOSE}
            accessibilityLabel={t('celebration.close')}
            onPress={onClose}
            fullWidth={false}
            testID="khatma-celebration-close"
          />
        </View>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('celebration.badgeLabel', { khatm: celebration.khatm, garden })}
          style={styles.badgeStage}
        >
          <BadgeEntrance size={badgeSize} reduceMotion={reduceMotion}>
            <KhatmaBadge
              view={{
                kind: 'earned',
                khatm: celebration.khatm,
                styleId: celebration.styleId,
                completedOn: celebration.completedOn,
              }}
              size={badgeSize}
            />
          </BadgeEntrance>
        </View>
        <Animated.View
          entering={FadeIn.delay(reduceMotion ? 0 : MOTION.wordsDelayMs)
            .duration(reduceMotion ? MOTION.reducedFadeMs : MOTION.wordsMs)
            .reduceMotion(ReduceMotion.Never)}
          style={styles.words}
        >
          <AppText variant="subheadEmphasized" color="ornament" align="center">
            {t('celebration.badge', { garden })}
          </AppText>
          <AppText variant="largeTitle" color="heading" align="center">
            {t('celebration.title')}
          </AppText>
          <ArabicDisplayText text={t('celebration.dua')} align="center" />
          {i18n.language === 'ar' ? null : (
            <AppText variant="subhead" color="muted" align="center">
              {t('celebration.duaMeaning')}
            </AppText>
          )}
          <Card style={styles.stats} testID="khatma-celebration-stats">
            <View
              style={styles.statsRow}
              accessible
              accessibilityLabel={t('celebration.statsLabel', {
                hizb: celebration.hizb,
                pages: celebration.pages,
                days: t('celebration.daysSpoken', { count: celebration.days }),
              })}
            >
              <Figure value={celebration.hizb} label={t('celebration.hizb')} />
              <View style={[styles.divider, { backgroundColor: colors.divider }]} />
              <Figure value={celebration.pages} label={t('celebration.pages')} />
              <View style={[styles.divider, { backgroundColor: colors.divider }]} />
              <Figure value={celebration.days} label={days} />
            </View>
          </Card>
          <Card tone="inset" testID="khatma-celebration-next">
            <View style={styles.nextRow}>
              <View style={styles.nextPicture}>
                <GardenThumb styleId={celebration.next.styleId} state={BARE_EARTH} />
              </View>
              <View style={styles.nextWords}>
                <AppText variant="headline">{t('celebration.next')}</AppText>
                <AppText variant="subhead" color="muted">
                  {celebration.next.isSameStyle
                    ? t('celebration.nextSame', { garden: nextGarden })
                    : t('celebration.nextDetail', {
                        level: celebration.next.level,
                        garden: nextGarden,
                      })}
                </AppText>
              </View>
            </View>
          </Card>
        </Animated.View>
        <ActionButton
          variant="filled"
          label={t('celebration.button')}
          onPress={onSeeGarden}
          testID="khatma-celebration-see"
        />
      </View>
    </View>
  );
}

function Figure({ value, label }: { value: number; label: string }) {
  const { i18n } = useTranslation();
  return (
    <View
      style={styles.figure}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <AppText variant="title2" color="heading" align="center">
        {new Intl.NumberFormat(`${i18n.language}-u-nu-latn`).format(value)}
      </AppText>
      <AppText variant="footnote" color="muted" align="center">
        {label}
      </AppText>
    </View>
  );
}

/** The badge settles on a spring while a gold light swells behind it, once. */
function BadgeEntrance({
  size,
  reduceMotion,
  children,
}: {
  size: number;
  reduceMotion: boolean;
  children: ReactNode;
}) {
  const values = useColorValues();
  const isNight = useColorScheme() === 'dark';
  const haloShare = isNight ? MOTION.haloNightShare : 1;
  const scale = useSharedValue(reduceMotion ? 1 : MOTION.badgeFromScale);
  const opacity = useSharedValue(0);
  const halo = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      opacity.value = withTiming(1, { duration: MOTION.reducedFadeMs });
      halo.value = withTiming(MOTION.haloRest * haloShare, { duration: MOTION.reducedFadeMs });
      return;
    }
    scale.value = withSpring(1, MOTION.badgeSpring);
    opacity.value = withTiming(1, { duration: MOTION.haloInMs, easing: Easing.out(Easing.cubic) });
    halo.value = withSequence(
      withTiming(MOTION.haloPeak * haloShare, {
        duration: MOTION.haloInMs,
        easing: Easing.out(Easing.cubic),
      }),
      withDelay(
        120,
        withTiming(MOTION.haloRest * haloShare, {
          duration: MOTION.haloOutMs,
          easing: Easing.inOut(Easing.cubic),
        }),
      ),
    );
  }, [reduceMotion, haloShare, scale, opacity, halo]);
  const badgeStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.value }));
  const haloSize = size * 1.25;
  return (
    <View style={[styles.entrance, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.halo,
          {
            width: haloSize,
            height: haloSize,
            borderRadius: haloSize / 2,
            backgroundColor: values.goldLight,
            boxShadow: `0 0 ${Math.round(size * 0.25)}px ${Math.round(size * 0.12)}px ${values.goldLight}`,
          },
          haloStyle,
        ]}
      />
      <Animated.View style={badgeStyle}>{children}</Animated.View>
    </View>
  );
}

/** A few petals fall once across the screen, behind the words. Never with "reduce motion". */
function Petals({ width }: { width: number }) {
  const { height } = useWindowDimensions();
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {PETALS.map((petal, index) => (
        <Petal key={index} petal={petal} width={width} fall={height * 0.7} />
      ))}
    </View>
  );
}

function Petal({
  petal,
  width,
  fall,
}: {
  petal: (typeof PETALS)[number];
  width: number;
  fall: number;
}) {
  const values = useColorValues();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      petal.delay * MOTION.petalStaggerMs,
      withTiming(1, { duration: MOTION.petalFallMs, easing: Easing.linear }),
    );
  }, [petal.delay, progress]);
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p === 0 ? 0 : p < 0.15 ? p / 0.15 : 1 - Math.max(0, p - 0.6) / 0.4,
      transform: [
        { translateY: -24 + p * fall },
        { translateX: Math.sin(p * Math.PI * 2) * petal.drift },
        { rotate: `${p * 220}deg` },
      ],
    };
  });
  const colour = petal.delay % 2 === 0 ? values.avatarRose : values.goldLight;
  return (
    <Animated.View
      style={[
        styles.petal,
        {
          start: petal.x * width,
          width: petal.size,
          height: petal.size * 0.6,
          borderRadius: petal.size,
          backgroundColor: colour,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: layout.screenMargin + spacing.xs,
    justifyContent: 'space-between',
    rowGap: spacing.md,
  },
  closeRow: { alignItems: 'flex-end' },
  badgeStage: { alignItems: 'center' },
  entrance: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute' },
  words: { rowGap: spacing.sm },
  stats: { marginTop: spacing.sm },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  figure: { flex: 1, rowGap: 2 },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  nextRow: { flexDirection: 'row', alignItems: 'center', columnGap: spacing.md },
  nextPicture: { width: '30%' },
  nextWords: { flex: 1, rowGap: 2 },
  petal: { position: 'absolute', top: 0, opacity: 0, borderRadius: radius.full },
});
