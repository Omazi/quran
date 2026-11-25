import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { HIZB_COUNT } from '@/domain/quran';
import { GARDEN_PICTURE_ASPECT_RATIO, GardenView3D } from '@/features/garden';
import { layout, Placeholder, spacing, useVisitColors, visitShape, type IconSymbol } from '@/ui';

import { avatarRoleOf, initialOf } from './friend-avatar';
import { visitSummary } from './friend-words';
import {
  FriendsAvatar,
  FriendsButton,
  FriendsButtonPair,
  FriendsCard,
  FriendsHizbDots,
  FriendsRow,
  FriendsSeparator,
  FriendsText,
  useSkyStyle,
} from './friends-kit';
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
  const colour = avatarRoleOf(card.userId);
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
              <GardenView3D state={card.garden} hintPlacement="below" testID="friend-garden-3d" />
            )}
          </View>
          <FriendsCard radius="sheet" style={styles.sheet}>
            <View style={styles.who}>
              <FriendsAvatar initial={initialOf(name)} color={colour} />
              <View style={styles.whoWords}>
                <FriendsText variant="name" accessibilityRole="header">
                  {name}
                </FriendsText>
                <FriendsText variant="subhead" color="inkSecondary" testID="friend-summary">
                  {visitSummary(card, t)}
                </FriendsText>
              </View>
            </View>
            {card.hizbCompleted === null ? null : (
              <FriendsHizbDots
                completed={card.hizbCompleted}
                total={HIZB_COUNT}
                color={colour}
                label={t('friend.hizbProgress')}
                valueText={t('friend.hizbOutOf', { count: card.hizbCompleted })}
                testID="friend-hizb"
              />
            )}
            <FriendsButtonPair>
              <FriendsButton
                kind="soft"
                symbol={model.encouragedToday ? HEART_FILLED : HEART}
                label={model.encouragedToday ? t('friend.encouraged') : t('friend.encourageShort')}
                accessibilityLabel={
                  model.encouragedToday ? t('friend.encouraged') : t('friend.encourage', { name })
                }
                accessibilityHint={t('friend.encourageNote')}
                onPress={actions.encourage}
                isDone={model.encouragedToday}
                isWide
                testID="friend-encourage"
              />
              <FriendsButton
                kind="primary"
                symbol={BOOK}
                label={t('friend.read')}
                accessibilityHint={t('friend.readHint')}
                onPress={() => openReader?.()}
                isWide
                testID="friend-read"
              />
            </FriendsButtonPair>
            {refusal === null ? null : (
              <FriendsText variant="footnote" color="inkSecondary" testID="friend-refusal">
                {t(`refusals.${refusal}`)}
              </FriendsText>
            )}
          </FriendsCard>
        </View>

        <FriendsCard style={styles.more}>
          <FriendsText variant="title2" color="title">
            {t('friend.readingTitle')}
          </FriendsText>
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
            <FriendsText variant="subhead" color="inkSecondary" testID="friend-level-hidden">
              {t('friend.levelHidden', { name })}
            </FriendsText>
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
            <FriendsText variant="footnote" color="inkSecondary">
              {t('friend.hasanatNote')}
            </FriendsText>
          )}
        </FriendsCard>

        {renderOptions === undefined ? (
          <FriendsCard style={[styles.more, styles.manage]}>
            {menu.items.map((item, index) => (
              <FriendsButton
                key={item.label}
                kind="destructive"
                label={item.label}
                onPress={item.onPress}
                testID={index === 0 ? 'friend-remove' : 'friend-block'}
              />
            ))}
          </FriendsCard>
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
  const colors = useVisitColors();
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${value}`}
      style={[styles.tile, { backgroundColor: colors.field }]}
      testID={testID}
    >
      <FriendsText variant="headline" color="title">
        {value}
      </FriendsText>
      <FriendsText variant="footnote" color="inkSecondary">
        {label}
      </FriendsText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: spacing.xl, gap: spacing.md },
  firstScreen: { justifyContent: 'space-between' },
  // High in the free space, as in the mockup: the sky stays open between the garden and the card.
  garden: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  hiddenGarden: {
    aspectRatio: GARDEN_PICTURE_ASPECT_RATIO,
    marginHorizontal: layout.screenMargin,
  },
  sheet: {
    marginHorizontal: visitShape.sheetMargin,
    marginBottom: visitShape.sheetMargin,
    gap: spacing.md + spacing.xs,
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: layout.controlGap },
  whoWords: { flex: 1, gap: spacing.xs / 2 },
  more: { marginHorizontal: visitShape.sheetMargin },
  manage: { gap: spacing.none, paddingVertical: spacing.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: spacing.xxl * 2,
    borderRadius: visitShape.tileRadius,
    padding: layout.controlGap,
    gap: spacing.xs / 2,
  },
});
