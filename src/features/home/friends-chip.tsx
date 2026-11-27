import { Pressable, StyleSheet, View } from 'react-native';

import type { UserId } from '@/domain/social';
import { useGenderedTranslation } from '@/features/gender';
import { AppText, Avatar, GlassSurface, layout, spacing, stateOpacity } from '@/ui';

import type { NeighbourDetail, NeighbourGardens } from './neighbours';

/** At most this many faces in the chip (the mockup's three). */
const FACES = 3;

export interface FriendsChipProps {
  neighbours: NeighbourGardens;
  appearance: 'light' | 'dark';
  veil: number;
  onOpenFriend: (userId: UserId) => void;
}

/**
 * The shortcut to a friend's garden under the title (maquette-wow `.friends`): their faces and
 * the first one's news, on glass. Shown only once there are friends to show; signed out or alone,
 * the Proches tab says how to add one. The faces only decorate the names VoiceOver reads.
 */
export function FriendsChip({ neighbours, appearance, veil, onOpenFriend }: FriendsChipProps) {
  const { t } = useGenderedTranslation('home');
  if (neighbours.status !== 'ready' || neighbours.gardens.length === 0) return null;
  const gardens = neighbours.gardens;
  const first = gardens[0];
  if (first === undefined) return null;
  const names = gardens
    .slice(0, FACES)
    .map((garden) => garden.name)
    .join(', ');
  const news = detailText(first.detail, t);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('friendsChip.label', { names })}. ${first.name}, ${news}`}
      accessibilityHint={t('friendsChip.hint', { name: first.name })}
      onPress={() => onOpenFriend(first.userId)}
      style={({ pressed }) => [styles.press, pressed && styles.pressed]}
      testID="home-friends-chip"
    >
      <GlassSurface appearance={appearance} shape="capsule" veil={veil} style={styles.chip}>
        <View style={styles.faces}>
          {gardens.slice(0, FACES).map((garden, index) => (
            <View key={garden.userId} style={index > 0 ? styles.overlap : null}>
              <Avatar
                content={garden.initial === null ? { initial: '·' } : { initial: garden.initial }}
                color={garden.colorIndex}
                size="small"
              />
            </View>
          ))}
        </View>
        <AppText variant="subheadEmphasized" style={styles.text}>
          {first.name}
          <AppText variant="subhead"> · {news}</AppText>
        </AppText>
      </GlassSurface>
    </Pressable>
  );
}

function detailText(
  detail: NeighbourDetail,
  t: ReturnType<typeof useGenderedTranslation>['t'],
): string {
  switch (detail.kind) {
    case 'watered':
    case 'rested':
    case 'thirsty':
      return t(`neighbours.${detail.kind}`, { hizb: detail.hizb, count: detail.days });
    case 'dry':
    case 'new':
      return t(`neighbours.${detail.kind}`, { hizb: detail.hizb });
    case 'complete':
    case 'hidden':
      return t(`neighbours.${detail.kind}`);
  }
}

const styles = StyleSheet.create({
  press: { alignSelf: 'flex-start', maxWidth: '100%' },
  pressed: { opacity: stateOpacity.pressed },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.sm,
    minHeight: layout.touchTarget,
    paddingStart: spacing.sm,
    paddingEnd: spacing.md,
  },
  faces: { flexDirection: 'row' },
  overlap: { marginStart: -spacing.sm },
  text: { flexShrink: 1 },
});
