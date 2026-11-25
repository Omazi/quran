import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  GradientBackdrop,
  spacing,
  storyLayout,
  useColors,
  useElevation,
  type BackdropName,
} from '@/ui';

import type { OnboardingScene } from '../pages';
import type { SceneRenderer } from '../scene';

/**
 * The friends of the example, with the first names the owner chose (D25): their place in the
 * row, the garden each has, and the colour of their avatar (the prototype's violet, blue, ochre).
 */
const FRIENDS = [
  { name: 'first', hizb: 38, daysWithoutReading: 0, avatar: 0 },
  { name: 'second', hizb: 52, daysWithoutReading: 0, avatar: 2 },
  { name: 'third', hizb: 14, daysWithoutReading: 3, avatar: 1 },
] as const;

export interface FriendsSceneProps {
  /** Draws each friend's garden: the same renderer as the gardens of the story. */
  renderScene: SceneRenderer;
}

function sceneOf(friend: (typeof FRIENDS)[number]): OnboardingScene {
  return friend.daysWithoutReading === 0
    ? { kind: 'garden', hizbCompleted: friend.hizb }
    : {
        kind: 'drought',
        hizbCompleted: friend.hizb,
        daysWithoutReading: friend.daysWithoutReading,
      };
}

/**
 * The picture of the friends' page, as the prototype draws it (`.friends`): three cards of
 * neighbouring gardens, the middle one raised, each with its garden on the sky of its state, the
 * friend's avatar, name and hizb, the same cards as the home screen's "Jardins voisins"
 * (accueil.png). Screen readers hear one description that names the three friends.
 */
export function FriendsScene({ renderScene }: FriendsSceneProps) {
  const { t } = useTranslation('onboarding');
  const friends = FRIENDS.map((friend) => ({
    ...friend,
    label: t(`friends.names.${friend.name}`),
    status: t('friends.hizb', { count: friend.hizb }),
  }));
  const description = [
    t('scenes.friends'),
    ...friends.map(({ label, status }) => `${label}, ${status}`),
  ].join(' ; ');
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="image"
      accessibilityLabel={description}
      testID="onboarding-friends-scene"
    >
      {friends.map((friend, index) => (
        <FriendCard
          key={friend.name}
          name={friend.label}
          status={friend.status}
          avatar={friend.avatar}
          sky={friend.daysWithoutReading === 0 ? 'growing' : 'thirsty'}
          isRaised={index === 1}
        >
          {renderScene(sceneOf(friend))}
        </FriendCard>
      ))}
    </View>
  );
}

interface FriendCardProps {
  name: string;
  status: string;
  avatar: number;
  sky: BackdropName;
  isRaised: boolean;
  children: ReactNode;
}

function FriendCard({ name, status, avatar, sky, isRaised, children }: FriendCardProps) {
  const colors = useColors();
  const shadow = useElevation('card');
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, boxShadow: shadow },
        isRaised && styles.raised,
      ]}
    >
      <View style={styles.garden}>
        <GradientBackdrop name={sky} style={StyleSheet.absoluteFill} />
        {children}
      </View>
      <View style={styles.name}>
        <Avatar content={{ initial: name.slice(0, 1) }} color={avatar} size="small" />
        <AppText variant="subheadEmphasized" numberOfLines={1} style={styles.nameText}>
          {name}
        </AppText>
      </View>
      <AppText variant="footnote" color="muted" numberOfLines={1}>
        {status}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    columnGap: spacing.sm,
    paddingHorizontal: spacing.sm,
    // Room for the raised middle card.
    paddingTop: storyLayout.friendMiddleLift,
  },
  card: {
    flex: 1,
    minWidth: 0,
    borderRadius: storyLayout.friendCardRadius,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  raised: { transform: [{ translateY: -storyLayout.friendMiddleLift }] },
  garden: {
    height: storyLayout.friendGardenHeight,
    borderRadius: storyLayout.friendGardenRadius,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  name: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.xs,
    marginTop: spacing.xs,
  },
  nameText: { flexShrink: 1 },
});
