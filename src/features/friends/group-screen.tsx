import { StyleSheet, View } from 'react-native';

import { useGenderedTranslation } from '@/features/gender';
import type { LeaderboardPeriod } from '@/domain/social';
import { ActionButton, AppText, Avatar, Card, SegmentedChoice, spacing } from '@/ui';

import { avatarIndexOf, initialOf } from './friend-avatar';
import { FriendsPage, FriendsRow, FriendsSeparator, FriendsTextField } from './friends-kit';
import type { GroupModel } from './friends-model';
import type { ShownRefusal } from './refusal';
import type { GroupActions } from './use-friends';

export interface GroupScreenProps {
  model: GroupModel;
  refusal: ShownRefusal | null;
  actions: GroupActions;
}

/**
 * A group: its leaderboard over the week or the month, then the friends I can add to it, in the
 * cards of the mockups (docs/design/accueil.png). The period is the system's segmented control,
 * above what it changes (segmented-controls.md › Best practices). The leaderboard is one row per
 * member: initial, rank and name, pages at the trailing side (lists-and-tables.md › Best
 * practices); my own row is tinted, and says "(toi)" in words. The note of the add card says,
 * before anyone is added, that no consent is asked and what members see (D36). The title is the
 * native bar's (see the route).
 */
export function GroupScreen({ model, refusal, actions }: GroupScreenProps) {
  const { t } = useGenderedTranslation('friends');
  const periods: readonly { value: LeaderboardPeriod['kind']; label: string }[] = [
    { value: 'week', label: t('group.week') },
    { value: 'month', label: t('group.month') },
  ];
  return (
    <FriendsPage isUnderBar testID="group">
      <SegmentedChoice
        label={t('group.period')}
        options={periods}
        value={model.period}
        onChange={actions.changePeriod}
        testID="group-period"
      />
      <Card contentGap="md" style={styles.list}>
        <AppText variant="subheadEmphasized" color="actionTint">
          {t('group.leaderboardTitle')}
        </AppText>
        {model.leaderboard.map((line, index) => (
          <View key={line.userId}>
            {index === 0 ? null : <FriendsSeparator />}
            <FriendsRow
              label={t(line.isMe ? 'group.me' : 'group.rank', {
                rank: line.rank,
                name: line.name,
              })}
              value={t('group.pages', { count: line.newPages })}
              leading={
                <Avatar
                  content={{ initial: initialOf(line.name) }}
                  color={avatarIndexOf(line.userId)}
                  size="small"
                />
              }
              isHighlighted={line.isMe}
              testID={`group-line-${line.userId}`}
            />
          </View>
        ))}
        <AppText variant="footnote" color="muted">
          {model.period === 'week' ? t('group.weekNote') : t('group.monthNote')}
        </AppText>
      </Card>

      <Card contentGap="md" style={styles.list}>
        <AppText variant="subheadEmphasized" color="actionTint">
          {t('group.addTitle')}
        </AppText>
        {model.friendsToAdd.length === 0 ? (
          <AppText variant="subhead" color="muted" testID="group-no-one-to-add">
            {t('group.noOneToAdd')}
          </AppText>
        ) : (
          model.friendsToAdd.map((friend, index) => (
            <View key={friend.userId}>
              {index === 0 ? null : <FriendsSeparator />}
              <FriendsRow
                label={friend.name}
                leading={
                  <Avatar
                    content={{ initial: initialOf(friend.name) }}
                    color={avatarIndexOf(friend.userId)}
                    size="small"
                  />
                }
                trailing={
                  <ActionButton
                    variant="plain"
                    fullWidth={false}
                    label={t('group.addShort')}
                    accessibilityLabel={t('group.add', { name: friend.name })}
                    onPress={() => actions.addMember(friend.userId)}
                    testID={`group-add-${friend.userId}`}
                  />
                }
              />
            </View>
          ))
        )}
        {refusal === null ? null : (
          <AppText variant="footnote" color="muted">
            {t(`refusals.${refusal}`)}
          </AppText>
        )}
        <AppText variant="footnote" color="muted">
          {t('group.addNote')}
        </AppText>
      </Card>
    </FriendsPage>
  );
}

export interface NewGroupScreenProps {
  model: {
    readonly isDemonstration: boolean;
    readonly name: string;
    readonly refusal: ShownRefusal | null;
    readonly isBusy: boolean;
  };
  actions: { changeName(text: string): void; create(): void };
}

/**
 * A new group: one field for its name, with a hint, and one button that says what it does
 * (text-fields.md › Best practices; buttons.md › Content), the green capsule of the mockups. The
 * name follows the rules of a display name (rule 8); a refusal is said under the field.
 */
export function NewGroupScreen({ model, actions }: NewGroupScreenProps) {
  const { t } = useGenderedTranslation('friends');
  return (
    <FriendsPage isUnderBar testID="new-group">
      <Card contentGap="md">
        <AppText variant="subheadEmphasized" color="actionTint">
          {t('newGroup.nameField')}
        </AppText>
        <FriendsTextField
          label={t('newGroup.nameField')}
          placeholder={t('newGroup.namePlaceholder')}
          value={model.name}
          onChange={actions.changeName}
          kind="name"
          onSubmit={actions.create}
          testID="new-group-name"
        />
        {model.refusal === null ? null : (
          <AppText variant="footnote" color="muted">
            {t(`refusals.${model.refusal}`)}
          </AppText>
        )}
        <AppText variant="footnote" color="muted">
          {t('newGroup.note')}
        </AppText>
      </Card>
      <ActionButton
        variant="filled"
        label={t('newGroup.create')}
        onPress={actions.create}
        disabled={model.isBusy || model.name.trim() === ''}
        testID="new-group-create"
      />
    </FriendsPage>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
});
