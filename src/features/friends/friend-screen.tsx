import { useEffect, useRef, type ComponentRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { GardenState } from '@/domain/garden';
import { styleOfLevel } from '@/domain/levels';
import { HIZB_COUNT } from '@/domain/quran';
import { publishHandle } from '@/features/screen-check/handles';
import { GARDEN_PICTURE_ASPECT_RATIO, GardenView3D } from '@/features/garden';
import { FriendLevelSection, useGardenArt } from '@/features/gardens';
import {
  ActionButton,
  AppText,
  Avatar,
  Card,
  DottedProgress,
  layout,
  Placeholder,
  radius,
  spacing,
  useColors,
  type IconSymbol,
} from '@/ui';

import { avatarIndexOf, initialOf } from './friend-avatar';
import { visitSummary } from './friend-words';
import { FriendsButtonPair, FriendsRow, FriendsSeparator, useSkyStyle } from './friends-kit';
import type { FriendPageModel } from './friends-model';
import type { ShownRefusal } from './refusal';
import { FriendsUnavailable } from './screen-states';
import type { FriendPageActions } from './use-friends';
import { useVisibleArea } from './visible-area';

const HEART: IconSymbol = { ios: 'heart', android: 'favorite_border' };
const HEART_FILLED: IconSymbol = { ios: 'heart.fill', android: 'favorite' };
const BOOK: IconSymbol = { ios: 'book', android: 'menu_book' };

/** One item of the More menu of the bar. */
export interface FriendOptionsItem {
  readonly label: string;
  readonly isDestructive: boolean;
  readonly onPress: () => void;
}

/** The More menu of the bar (pull-down-buttons.md › Mobile: a More pull-down button). */
export interface FriendOptionsMenu {
  /** What VoiceOver says of the ellipsis button. */
  readonly label: string;
  readonly items: readonly FriendOptionsItem[];
}

export interface FriendScreenProps {
  model: FriendPageModel;
  refusal: ShownRefusal | null;
  actions: FriendPageActions;
  /** "Lire avec …": the person's own reader, where they left off. */
  openReader?: () => void;
  /**
   * Draws the More menu in the navigation bar (the route does, with the system's menu). Without
   * it, removing and blocking are buttons at the end of the page.
   */
  renderOptions?: (menu: FriendOptionsMenu) => ReactNode;
}

/** Numbers in the language of the interface, with the digits the rest of the app uses. */
function formatNumber(value: number, language: string): string {
  return new Intl.NumberFormat(`${language}-u-nu-latn`).format(value);
}

/**
 * A friend's page, as the owner validated it (maquettes 2026-11-26, "friend", after visite.png).
 * The first screen is the part the bars leave visible (`useVisibleArea`; layout.md › Guides and
 * safe areas): the garden fills it edge to edge down to the card, which rests just above the tab
 * bar, so both buttons show without scrolling and no empty band is left. The card: the friend's
 * initial and name, the line "42 hizb sur 60, arrosé depuis 21 jours", sixty dots for the sixty
 * hizb, three figures side by side (the streak, the verses read, the level), and two capsule
 * buttons, "Encourager" soft and "Lire avec …" green (buttons.md › Style: style, not size, tells
 * the preferred one). The title and back button are the system's navigation bar; the ellipsis is
 * the system's More menu (pull-down-buttons.md › Mobile), whose items, both destructive, still
 * ask with an action sheet (› Best practices; action-sheets.md › Best practices).
 *
 * Below the first screen, the rest of what the friend shares (D23, D37): khatmas, words and the
 * hasanat as an estimate, in a card of the same kind.
 */
export function FriendScreen({
  model,
  refusal,
  actions,
  openReader,
  renderOptions,
}: FriendScreenProps) {
  const { t, i18n } = useTranslation('friends');
  const sky = useSkyStyle('visit');
  // Measured after the first layout; until then the window under both bars, never nothing: a 3D
  // garden asked to fill a flat area makes a context with no pixels (iOS check of 683ad8d).
  const { area, ref: pageRef, onLayout } = useVisibleArea();
  const { fontScale } = useWindowDimensions();
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const { encourage } = actions;
  // The iOS check's automatic run presses Encourager and scrolls the page through these; nothing
  // in any other build (the handle is only kept when the check opened it).
  useEffect(
    () =>
      publishHandle('friend-page', {
        encourage,
        scrollTo: (y: number) => scroller.current?.scrollTo({ y, animated: true }),
      }),
    [encourage],
  );
  if (model.status === 'unavailable') {
    return (
      <FriendsUnavailable
        title={t('friend.unavailableTitle')}
        description={t('friend.unavailableText')}
        testID="friend-unavailable"
      />
    );
  }
  if (model.status === 'not-friend') {
    return (
      <FriendsUnavailable
        title={model.name}
        description={t('friend.notFriend', { name: model.name })}
        testID="friend-not-friend"
      />
    );
  }
  const { card, level, streakDays } = model;
  const name = card.name;
  const colour = avatarIndexOf(card.userId);
  const number = (value: number) => formatNumber(value, i18n.language);
  const confirmation = (kind: 'remove' | 'block') => ({
    title: t(`friend.${kind}Title`, { name }),
    message: t(`friend.${kind}Message`, { name }),
    confirmLabel: t(`friend.${kind}Confirm`),
    cancelLabel: t('friend.cancel'),
  });
  const menu: FriendOptionsMenu = {
    label: t('friend.options'),
    items: [
      {
        label: t('friend.remove'),
        isDestructive: true,
        onPress: () => actions.remove(confirmation('remove')),
      },
      {
        label: t('friend.block', { name }),
        isDestructive: true,
        onPress: () => actions.block(confirmation('block')),
      },
    ],
  };

  return (
    <View ref={pageRef} onLayout={onLayout} style={[styles.screen, sky]} testID="friend">
      <ScrollView
        ref={scroller}
        // The page keeps clear of the bars itself, with the measured area: the first screen is
        // then exactly what shows between them.
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.content,
          { paddingTop: area.top, paddingBottom: area.bottom + spacing.xl },
        ]}
        scrollIndicatorInsets={{ top: area.top, bottom: area.bottom }}
        testID="friend-scroll"
      >
        {/* The first screen: the garden, then the card resting at the bottom, as in the mockup. */}
        <View style={[styles.firstScreen, { minHeight: area.height }]} testID="friend-first-screen">
          <View style={styles.garden}>
            {card.garden === null ? (
              <Placeholder
                name={t('card.hidden')}
                style={styles.hiddenGarden}
                testID="friend-garden-hidden"
              />
            ) : (
              // The garden to visit in 3D (visite.png: « Glisse pour tourner, pince pour zoomer »).
              <FriendGarden state={card.garden} level={level?.level ?? null} />
            )}
          </View>
          <Card style={styles.sheet} testID="friend-card">
            <View style={styles.who}>
              <Avatar content={{ initial: initialOf(name) }} color={colour} size="large" />
              <View style={styles.whoWords}>
                <AppText variant="title3" accessibilityRole="header">
                  {name}
                </AppText>
                <AppText variant="subhead" color="muted" testID="friend-summary">
                  {visitSummary(card, t)}
                </AppText>
              </View>
            </View>
            {card.hizbCompleted === null ? null : (
              <DottedProgress
                reached={card.hizbCompleted}
                total={HIZB_COUNT}
                color={colour}
                accessibilityLabel={t('friend.hizbProgress')}
                accessibilityValue={t('friend.hizbOutOf', { count: card.hizbCompleted })}
                testID="friend-hizb"
              />
            )}
            <FriendStats
              streakDays={streakDays}
              level={level}
              number={number}
              isSideBySide={fontScale <= layout.sideBySideMaxFontScale}
            />
            <FriendsButtonPair>
              <ActionButton
                variant="tonal"
                symbol={model.encouragedToday ? HEART_FILLED : HEART}
                label={model.encouragedToday ? t('friend.encouraged') : t('friend.encourageShort')}
                accessibilityLabel={
                  model.encouragedToday ? t('friend.encouraged') : t('friend.encourage', { name })
                }
                accessibilityHint={t('friend.encourageNote')}
                onPress={actions.encourage}
                isDone={model.encouragedToday}
                grows
                testID="friend-encourage"
              />
              <ActionButton
                variant="filled"
                symbol={BOOK}
                label={t('friend.readWith', { name })}
                accessibilityHint={t('friend.readHint')}
                onPress={() => openReader?.()}
                grows
                testID="friend-read"
              />
            </FriendsButtonPair>
            {refusal === null ? null : (
              <AppText variant="footnote" color="muted" testID="friend-refusal">
                {t(`refusals.${refusal}`)}
              </AppText>
            )}
          </Card>
        </View>

        {/* Their level and badges (D46, friendProfile.png); nothing when they hide them. */}
        {level === null ? null : (
          <View style={styles.more}>
            <FriendLevelSection level={level} hizbCompleted={card.hizbCompleted} />
          </View>
        )}

        <Card contentGap="md" style={styles.more}>
          <AppText variant="title2" color="heading">
            {t('friend.readingTitle')}
          </AppText>
          {level === null ? (
            <AppText variant="subhead" color="muted" testID="friend-level-hidden">
              {t('friend.levelHidden', { name })}
            </AppText>
          ) : (
            <View>
              <FriendsRow
                label={t('friend.words')}
                value={number(level.wordsRead)}
                testID="friend-words"
              />
              <FriendsSeparator />
              <FriendsRow
                label={t('friend.hasanat')}
                value={number(level.hasanatEstimate)}
                testID="friend-hasanat"
              />
            </View>
          )}
          {level === null ? null : (
            <AppText variant="footnote" color="muted">
              {t('friend.hasanatNote')}
            </AppText>
          )}
        </Card>

        {renderOptions === undefined ? (
          <Card contentGap="md" style={[styles.more, styles.manage]}>
            {menu.items.map((item, index) => (
              <ActionButton
                key={item.label}
                variant="destructive"
                fullWidth={false}
                label={item.label}
                onPress={item.onPress}
                testID={index === 0 ? 'friend-remove' : 'friend-block'}
              />
            ))}
          </Card>
        ) : null}
      </ScrollView>
      {renderOptions?.(menu)}
    </View>
  );
}

/**
 * The garden to visit in 3D, in the style of the friend's level (D46). A friend who hides their
 * level shows the first garden: the style would tell the level.
 */
function FriendGarden({ state, level }: { state: GardenState; level: number | null }) {
  const { art, tint } = useGardenArt(level === null ? null : styleOfLevel(level));
  return (
    <GardenView3D
      state={state}
      hintPlacement="below"
      fill
      art={art}
      tint={tint}
      testID="friend-garden-3d"
    />
  );
}

/**
 * The three figures of the card, side by side on the page's cream (maquettes 2026-11-26,
 * "friend"): the days in a row, the verses read, the level. Each is one element for VoiceOver,
 * its name then its value; a figure the friend does not share is left out, and the row with it
 * when none is shared. At large text sizes the figures stack, each on its own line
 * (typography.md › Supporting Dynamic Type).
 */
function FriendStats({
  streakDays,
  level,
  number,
  isSideBySide,
}: {
  streakDays: number | null;
  level: { readonly level: number; readonly versesRead: number } | null;
  number: (value: number) => string;
  isSideBySide: boolean;
}) {
  const { t } = useTranslation('friends');
  const colors = useColors();
  const figures = [
    streakDays === null
      ? null
      : {
          id: 'friend-streak',
          value: t('friend.streakShort', { count: streakDays }),
          spoken: t('friend.streakValue', { count: streakDays }),
          label: t('friend.streak'),
        },
    level === null
      ? null
      : {
          id: 'friend-verses',
          value: number(level.versesRead),
          spoken: number(level.versesRead),
          label: t('friend.verses'),
        },
    level === null
      ? null
      : {
          id: 'friend-level',
          value: number(level.level),
          spoken: number(level.level),
          label: t('friend.level'),
        },
  ].filter((figure) => figure !== null);
  if (figures.length === 0) return null;
  return (
    <View
      style={[
        styles.stats,
        isSideBySide ? styles.statsRow : styles.statsColumn,
        { backgroundColor: colors.field },
      ]}
      testID="friend-stats"
    >
      {figures.map((figure, index) => (
        <View
          key={figure.id}
          accessible
          accessibilityLabel={`${figure.label}, ${figure.spoken}`}
          style={[
            styles.stat,
            index === 0
              ? null
              : isSideBySide
                ? { borderStartWidth: layout.outlineWidth, borderColor: colors.divider }
                : { borderTopWidth: layout.outlineWidth, borderColor: colors.divider },
          ]}
          testID={figure.id}
        >
          <AppText variant="headline" color="heading" align="center">
            {figure.value}
          </AppText>
          <AppText variant="footnote" color="muted" align="center">
            {figure.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: spacing.xl, gap: spacing.md },
  firstScreen: { justifyContent: 'space-between' },
  // The garden takes all the space between the bar and the card (no empty band): its view is
  // transparent and dissolves at its edges, so a zoom never shows a box (visite.png).
  garden: { flexGrow: 1 },
  hiddenGarden: {
    aspectRatio: GARDEN_PICTURE_ASPECT_RATIO,
    marginHorizontal: layout.screenMargin,
  },
  // 14 points above the tab bar in the mockup: the gap between two controls.
  sheet: {
    marginHorizontal: layout.screenMargin,
    marginBottom: layout.controlGap,
    gap: spacing.md,
  },
  stats: { borderRadius: radius.lg, paddingVertical: layout.controlGap },
  statsRow: { flexDirection: 'row' },
  statsColumn: { flexDirection: 'column', paddingVertical: spacing.none },
  stat: { flex: 1, paddingHorizontal: spacing.xs, paddingVertical: spacing.xs / 2 },
  who: { flexDirection: 'row', alignItems: 'center', gap: layout.controlGap },
  whoWords: { flex: 1, gap: spacing.xs / 2 },
  more: { marginHorizontal: layout.screenMargin },
  manage: { gap: spacing.none, paddingVertical: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: spacing.xxl * 2,
    borderRadius: radius.md,
    padding: layout.controlGap,
    gap: spacing.xs / 2,
  },
});
