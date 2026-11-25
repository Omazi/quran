import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { HIZB_COUNT } from '@/domain/quran';
import { GARDEN_PICTURE_ASPECT_RATIO, GardenView3D } from '@/features/garden';
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
  /** "Lire et arroser": the reader, where the person left off. */
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
 * A friend's page: the visit of the validated mockup (docs/design/visite.png), followed
 * faithfully (owner's rule of 25 November 2026). The garden in the middle of a warm sky, then at
 * the bottom of the first screen a white card: the friend's initial and name, the line "38 hizb
 * sur 60, arrosé depuis 21 jours", sixty dots for the sixty hizb, and two capsule buttons side by
 * side, "Encourager" soft and the green one (buttons.md › Style: style, not size, tells the
 * preferred one). The title and back button are the system's navigation bar; the ellipsis is the
 * system's More menu (pull-down-buttons.md › Mobile), whose items, both destructive, still ask
 * with an action sheet (› Best practices; action-sheets.md › Best practices).
 *
 * Below the first screen, what the friend shares beyond the mockup: streak, level, khatmas and
 * reading counters (D23, D37), in a card of the same kind.
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
  const [viewportHeight, setViewportHeight] = useState(0);
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
    <View style={[styles.screen, sky]} testID="friend">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
      >
        {/* The first screen: the garden, then the card resting at the bottom, as in the mockup. */}
        <View style={[styles.firstScreen, { minHeight: viewportHeight }]}>
          <View style={styles.garden}>
            {card.garden === null ? (
              <Placeholder
                name={t('card.hidden')}
                style={styles.hiddenGarden}
                testID="friend-garden-hidden"
              />
            ) : (
              // The garden to visit in 3D (visite.png: « Glisse pour tourner, pince pour zoomer »).
              <GardenView3D
                state={card.garden}
                hintPlacement="below"
                fill
                testID="friend-garden-3d"
              />
            )}
          </View>
          <Card shape="sheet" style={styles.sheet}>
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
                label={t('friend.read')}
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

        <Card contentGap="md" style={styles.more}>
          <AppText variant="title2" color="heading">
            {t('friend.readingTitle')}
          </AppText>
          <View style={styles.tiles}>
            {streakDays === null ? null : (
              <FriendsStat
                value={t('friend.streakValue', { count: streakDays })}
                label={t('friend.streak')}
                testID="friend-streak"
              />
            )}
            {level === null ? null : (
              <>
                <FriendsStat
                  value={t('friend.levelValue', { count: level.level })}
                  label={t('friend.level')}
                  testID="friend-level"
                />
                <FriendsStat
                  value={number(level.badgeCount)}
                  label={t('friend.badges')}
                  testID="friend-badges"
                />
              </>
            )}
          </View>
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
                label={t('friend.verses')}
                value={number(level.versesRead)}
                testID="friend-verses"
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
 * One figure the friend shares, on a tile of the page's cream: the value large, its name under
 * it (the "24 hizb sur 60" of the home screen, accueil.png). VoiceOver reads it as one element.
 */
function FriendsStat({ value, label, testID }: { value: string; label: string; testID: string }) {
  const colors = useColors();
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${value}`}
      style={[styles.tile, { backgroundColor: colors.field }]}
      testID={testID}
    >
      <AppText variant="headline" color="heading">
        {value}
      </AppText>
      <AppText variant="footnote" color="muted">
        {label}
      </AppText>
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
  sheet: {
    marginHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.md + spacing.xs,
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: layout.controlGap },
  whoWords: { flex: 1, gap: spacing.xs / 2 },
  more: { marginHorizontal: spacing.sm },
  manage: { gap: spacing.none, paddingVertical: spacing.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: spacing.xxl * 2,
    borderRadius: radius.md,
    padding: layout.controlGap,
    gap: spacing.xs / 2,
  },
});
