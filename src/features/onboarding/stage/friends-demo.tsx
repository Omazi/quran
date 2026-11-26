import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { baseAsset, waterAsset } from '@/features/garden';
import {
  AppText,
  Avatar,
  GradientBackdrop,
  Icon,
  useColors,
  useColorValues,
  useElevation,
  voiceStoryLayout as L,
  voiceStoryDetails as D,
} from '@/ui';

import { STORY_MOTION } from '../config';
import { clamp, heartPoint, heartProgress, presence, smooth } from '../story-math';
import { isNear, type StageProps } from './stage-props';

/** The three friends of the prototype (D25), their garden's pictures and what they are doing. */
const FRIENDS = [
  { name: 'first', avatar: 0, base: 'h38-f0', water: 'h38-f0-w2', hizb: 38, isDry: false },
  { name: 'second', avatar: 2, base: 'h52-f0', water: 'h52-f0-w2', hizb: 52, isDry: false },
  { name: 'third', avatar: 1, base: 'h14-f1', water: 'h14-f1-w1', hizb: 14, isDry: true },
] as const;

/** The family khatma of the demonstration: juz 18 of 30, so its bar is 60 % full. */
const KHATMA = { juz: 18, total: 30 } as const;

/**
 * The friends' page (page 13 of the prototype): three friends' gardens, real pictures of the
 * garden, that arrive at three speeds with the finger, the one in the middle reciting; as the page
 * comes, a heart leaves her card and lands on the thirsty garden, whose words turn to
 * "Encouragée"; under them, a khatma read together. Decorative: the page describes it in words.
 */
export function FriendsDemo(stage: StageProps) {
  const { position, layout, marks, pageIndex, reducedMotion } = stage;
  const { t } = useTranslation('onboarding');
  const colors = useColors();
  const values = useColorValues();
  const shadow = useElevation('card');
  const [height, setHeight] = useState(0);
  const [cards, setCards] = useState<
    readonly ({ x: number; y: number; width: number } | undefined)[]
  >([]);
  const top = Math.max(
    layout.top + L.friendsTopMin,
    (layout.top + L.previewTop + layout.copyTop) / 2 - height / 2 - L.friendsLift,
  );
  const onCardLayout = (index: number) => (event: LayoutChangeEvent) => {
    const { x, y, width } = event.nativeEvent.layout;
    setCards((current) => {
      const next = [...current];
      next[index] = { x, y, width };
      return next;
    });
  };
  const whole = useAnimatedStyle(() => ({
    opacity: height === 0 ? 0 : presence(position.get(), marks.friends),
  }));
  if (!isNear(pageIndex, marks.friends)) return null;
  const reciting = cards[1];
  const thirsty = cards[2];
  return (
    <>
      <Animated.View
        style={[styles.friends, { top }, whole]}
        onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="onboarding-friends"
      >
        {FRIENDS.map((friend, index) => (
          <Moving
            key={friend.name}
            index={index}
            position={position}
            marks={marks}
            reducedMotion={reducedMotion}
            style={styles.card}
            onLayout={onCardLayout(index)}
          >
            <View
              style={[styles.cardInner, { backgroundColor: colors.surface, boxShadow: shadow }]}
            >
              <View style={styles.thumb}>
                <GradientBackdrop
                  name={friend.isDry ? 'thirsty' : 'growing'}
                  style={StyleSheet.absoluteFill}
                />
                <FriendGarden base={friend.base} water={friend.water} />
              </View>
              <View style={styles.name}>
                <Avatar
                  content={{ initial: t(`friends.names.${friend.name}`).charAt(0) }}
                  color={friend.avatar}
                  size="small"
                />
                <AppText
                  variant="subheadEmphasized"
                  color="heading"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  style={styles.shrink}
                >
                  {t(`friends.names.${friend.name}`)}
                </AppText>
              </View>
              {index === 0 ? (
                <AppText variant="footnote" color="muted" style={styles.status}>
                  {t('friends.hizb', { count: friend.hizb })}
                </AppText>
              ) : index === 1 ? (
                <View style={[styles.status, styles.live]}>
                  <Equalizer color={values.water} reducedMotion={reducedMotion} />
                  <AppText variant="footnote" color="water" style={styles.bold}>
                    {t('friends.reciting')}
                  </AppText>
                </View>
              ) : (
                <Encouragement
                  position={position}
                  marks={marks}
                  thirsty={t('friends.thirsty', { count: friend.hizb })}
                  encouraged={t('friends.encouraged')}
                />
              )}
            </View>
          </Moving>
        ))}
        <Moving
          index={3}
          position={position}
          marks={marks}
          reducedMotion={reducedMotion}
          style={styles.khatma}
        >
          <View
            style={[styles.khatmaInner, { backgroundColor: colors.surface, boxShadow: shadow }]}
          >
            <View style={styles.khatmaTop}>
              <View style={styles.avatars}>
                {FRIENDS.map((friend, index) => (
                  <View key={friend.name} style={index > 0 && styles.overlap}>
                    <Avatar
                      content={{ initial: t(`friends.names.${friend.name}`).charAt(0) }}
                      color={friend.avatar}
                      size="small"
                    />
                  </View>
                ))}
                <View style={[styles.overlap, styles.you, { backgroundColor: colors.actionTonal }]}>
                  <AppText variant="footnote" color="actionTint" style={styles.bold}>
                    {t('friends.you')}
                  </AppText>
                </View>
              </View>
              <View style={styles.shrink}>
                <AppText variant="callout" color="heading">
                  {t('friends.khatma')}
                </AppText>
                <AppText variant="footnote" color="muted">
                  {t('friends.juz', { juz: KHATMA.juz, total: KHATMA.total })}
                </AppText>
              </View>
            </View>
            <KhatmaBar position={position} marks={marks} reducedMotion={reducedMotion} />
          </View>
        </Moving>
      </Animated.View>
      {reciting !== undefined && thirsty !== undefined ? (
        <Heart
          position={position}
          marks={marks}
          reducedMotion={reducedMotion}
          start={[
            L.friendsInset + reciting.x + reciting.width / 2,
            top + reciting.y + L.heartStartDrop,
          ]}
          end={[
            L.friendsInset + thirsty.x + thirsty.width - L.heartEndInset,
            top + thirsty.y + L.heartEndDrop,
          ]}
        />
      ) : null}
    </>
  );
}

function FriendGarden({ base, water }: { base: string; water: string }) {
  const dry = baseAsset(base);
  const wet = waterAsset(water);
  return (
    <View style={styles.thumbPicture}>
      {dry === undefined ? null : (
        <Image
          source={dry}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          cachePolicy="memory"
          accessible={false}
        />
      )}
      {wet === undefined ? null : (
        <Image
          source={wet}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          cachePolicy="memory"
          accessible={false}
        />
      )}
    </View>
  );
}

/** Each card arrives at its own speed and tilt with the finger (`friends`, `.fc`). */
function Moving({
  index,
  position,
  marks,
  reducedMotion,
  style,
  onLayout,
  children,
}: Pick<StageProps, 'position' | 'marks' | 'reducedMotion'> & {
  index: number;
  style: object;
  onLayout?: (event: LayoutChangeEvent) => void;
  children: React.ReactNode;
}) {
  const m = STORY_MOTION;
  const lift = index === 1 ? -L.friendMiddleLift : 0;
  const look = useAnimatedStyle(() => {
    const d = position.get() - marks.friends;
    return {
      transform: reducedMotion
        ? [{ translateY: lift }]
        : [
            { translateY: lift - d * (m.cardTravel + index * m.cardTravelStep) },
            { rotate: `${d * (Math.min(index, 2) - 1) * -m.cardTilt}deg` },
          ],
    };
  });
  return (
    <Animated.View style={[style, look]} onLayout={onLayout}>
      {children}
    </Animated.View>
  );
}

/** The thirsty friend's words: "14 hizb, a soif", then "Encouragée" once the heart has landed. */
function Encouragement({
  position,
  marks,
  thirsty,
  encouraged,
}: Pick<StageProps, 'position' | 'marks'> & { thirsty: string; encouraged: string }) {
  // Once the heart has landed, the words change in a 250 ms crossfade (motion spec §10).
  const amount = useSharedValue(0);
  useAnimatedReaction(
    () => {
      const pos = position.get();
      const progress = heartProgress(pos, marks.friends);
      return progress >= STORY_MOTION.encouragedAt && presence(pos, marks.friends) > 0.3;
    },
    (landed, was) => {
      if (landed === was) return;
      amount.set(
        withTiming(landed ? 1 : 0, {
          duration: STORY_MOTION.encouragedFadeMs,
          easing: Easing.inOut(Easing.ease),
        }),
      );
    },
  );
  const before = useAnimatedStyle(() => ({ opacity: 1 - amount.get() }));
  const after = useAnimatedStyle(() => ({ opacity: amount.get() }));
  return (
    <View style={styles.status}>
      <Animated.View style={before}>
        <AppText variant="footnote" color="muted" numberOfLines={1}>
          {thirsty}
        </AppText>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, after]}>
        <AppText variant="footnote" color="encouraged" numberOfLines={1} style={styles.bold}>
          {encouraged}
        </AppText>
      </Animated.View>
    </View>
  );
}

/** The heart that flies from the friend who recites to the thirsty garden. */
function Heart({
  position,
  marks,
  reducedMotion,
  start,
  end,
}: Pick<StageProps, 'position' | 'marks' | 'reducedMotion'> & {
  start: readonly [number, number];
  end: readonly [number, number];
}) {
  const values = useColorValues();
  const style = useAnimatedStyle(() => {
    const pos = position.get();
    const progress = heartProgress(pos, marks.friends);
    const shown = presence(pos, marks.friends);
    if (progress < 0 || shown <= 0.01) return { opacity: 0 };
    const point = heartPoint(progress, start, end, L.heartArc, reducedMotion);
    return {
      opacity: shown * smooth(progress * 5),
      transform: [
        { translateX: point.x - L.heartSize / 2 },
        { translateY: point.y - L.heartSize / 2 },
        { scale: point.scale },
        { rotate: `${point.rotate}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[styles.heart, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Icon
        symbol={{ ios: 'heart.fill', android: 'favorite' }}
        tint={values.heart}
        textStyle="title1"
      />
    </Animated.View>
  );
}

/** The khatma's bar fills a little as the page arrives (`kbar`). */
function KhatmaBar({
  position,
  marks,
  reducedMotion,
}: Pick<StageProps, 'position' | 'marks' | 'reducedMotion'>) {
  const colors = useColors();
  const m = STORY_MOTION;
  const fill = useAnimatedStyle(() => {
    const d = position.get() - marks.friends;
    const growth = reducedMotion
      ? 1
      : m.khatmaFloor + (1 - m.khatmaFloor) * smooth(1 - Math.abs(d) * m.khatmaRate);
    return { transform: [{ scaleX: m.khatmaShare * growth }] };
  });
  return (
    <View style={[styles.bar, { backgroundColor: colors.track }]}>
      <Animated.View style={[styles.barFill, { backgroundColor: colors.action }, fill]} />
    </View>
  );
}

/** The four bars beside "Récite", swaying like a voice (`.mini`); still with "reduce motion". */
function Equalizer({ color, reducedMotion }: { color: string; reducedMotion: boolean }) {
  const time = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) return;
    time.set(
      withRepeat(
        withTiming(1, { duration: STORY_MOTION.equalizerMs, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [reducedMotion, time]);
  return (
    <View style={styles.equalizer}>
      {STORY_MOTION.equalizerPhases.map((offset) => (
        <EqualizerBar key={offset} offset={offset} time={time} color={color} />
      ))}
    </View>
  );
}

function EqualizerBar({
  offset,
  time,
  color,
}: {
  offset: number;
  time: SharedValue<number>;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const phase = (time.get() + offset) % 1;
    const floor = STORY_MOTION.equalizerFloor;
    return { transform: [{ scaleY: floor + (1 - floor) * clamp(Math.sin(Math.PI * phase)) }] };
  });
  return <Animated.View style={[styles.equalizerBar, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  friends: {
    position: 'absolute',
    start: L.friendsInset,
    end: L.friendsInset,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: L.friendsGap,
  },
  card: { flex: 1, minWidth: 0 },
  cardInner: {
    borderRadius: L.friendCardRadius,
    padding: D.friendCardPadding,
    paddingBottom: D.friendCardPaddingBottom,
  },
  thumb: { height: L.friendGardenHeight, borderRadius: L.friendGardenRadius, overflow: 'hidden' },
  thumbPicture: {
    position: 'absolute',
    start: D.friendGardenOverflow,
    end: D.friendGardenOverflow,
    top: 0,
    bottom: 0,
    transform: [{ translateY: D.friendGardenShift }],
  },
  name: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: D.friendNameGap,
    marginTop: D.friendNameTop,
    marginHorizontal: D.hairGap,
  },
  shrink: { flexShrink: 1 },
  status: {
    marginTop: D.hairGap,
    marginHorizontal: D.friendStatusInset,
    minHeight: D.friendStatusMinHeight,
  },
  live: { flexDirection: 'row', alignItems: 'center', gap: D.friendLiveGap },
  bold: { fontWeight: '600' },
  khatma: { flexBasis: '100%', marginTop: D.khatmaTop },
  khatmaInner: {
    borderRadius: L.friendCardRadius,
    paddingVertical: D.khatmaPaddingVertical,
    paddingHorizontal: L.cardPadding,
    gap: L.choiceGap,
  },
  khatmaTop: { flexDirection: 'row', alignItems: 'center', gap: D.khatmaGap },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  overlap: { marginStart: D.avatarOverlap },
  you: {
    height: D.youHeight,
    minWidth: D.youMinWidth,
    paddingHorizontal: D.youPadding,
    borderRadius: D.youHeight / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: { height: L.khatmaBarHeight, borderRadius: L.khatmaBarHeight / 2, overflow: 'hidden' },
  barFill: {
    height: '100%',
    width: '100%',
    borderRadius: L.khatmaBarHeight / 2,
    transformOrigin: 'left',
  },
  heart: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: L.heartSize,
    height: L.heartSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  equalizer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: D.hairGap,
    height: D.equalizerHeight,
  },
  equalizerBar: {
    width: D.equalizerBar,
    height: D.equalizerHeight,
    borderRadius: D.equalizerBar / 2,
  },
});
