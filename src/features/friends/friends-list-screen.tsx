import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  ActionButton,
  AppText,
  Avatar,
  Card,
  Icon,
  SectionHeader,
  spacing,
  type ActionButtonVariant,
  type IconSymbol,
} from '@/ui';

import { avatarIndexOf, initialOf } from './friend-avatar';
import { FriendCardGrid } from './friend-card-grid';
import { FriendsButtonPair, FriendsPage, FriendsRow, FriendsSeparator } from './friends-kit';
import type { FriendsModel } from './friends-model';
import type { ShownRefusal } from './refusal';
import type { FriendsListActions } from './use-friends';

const ADD_SYMBOL: IconSymbol = { ios: 'person.badge.plus', android: 'person_add' };
const GROUP_SYMBOL: IconSymbol = { ios: 'person.3', android: 'groups' };
const PLUS_SYMBOL: IconSymbol = { ios: 'plus', android: 'add' };

/**
 * "Keep the number of prominent buttons to one or two per view" (buttons.md › Style): beyond two
 * requests, "Accepter" takes the soft style and "Refuser" the outlined one.
 */
const MOST_PROMINENT_REQUESTS = 2;

export interface FriendsListScreenProps {
  model: FriendsModel;
  refusal: ShownRefusal | null;
  actions: FriendsListActions;
}

/**
 * The Proches tab: "how are my friends' gardens, and who is waiting for me?"
 *
 * In the language of the validated home screen (docs/design/accueil.png): a serif title on the
 * warm sky, then white cards on the page's cream. In order of importance
 * (layout.md › Visual hierarchy): the requests waiting for an answer, the gardens (the cards of
 * "Jardins voisins"), the way to add a friend, then the groups. The demonstration is said under
 * the title: discreet, but never hidden (docs/specs/social.md, section 4), and here only.
 *
 * A request is the person, then the answer on one row: "Accepter" and "Refuser" side by side at
 * the same size, the preferred one in the stronger style (buttons.md › Style).
 */
export function FriendsListScreen({ model, refusal, actions }: FriendsListScreenProps) {
  const { t } = useTranslation('friends');
  const fewRequests = model.requests.length <= MOST_PROMINENT_REQUESTS;
  const acceptKind: ActionButtonVariant = fewRequests ? 'filled' : 'tonal';
  const declineKind: ActionButtonVariant = fewRequests ? 'tonal' : 'outline';
  return (
    <FriendsPage testID="friends-list">
      <View style={styles.title}>
        <AppText variant="largeTitle" color="heading">
          {t('title')}
        </AppText>
        {model.isDemonstration ? (
          <AppText variant="footnote" color="muted" testID="friends-demo-note">
            {t('demoNote')}
          </AppText>
        ) : null}
      </View>

      {model.requests.length === 0 ? null : (
        <View style={styles.part}>
          <SectionHeader title={t('list.requestsTitle')} />
          {model.requests.map((request) => (
            <Card contentGap="md" key={request.userId}>
              <FriendsRow
                label={request.name}
                detail={t('list.requestDetail')}
                leading={
                  <Avatar
                    content={{ initial: initialOf(request.name) }}
                    color={avatarIndexOf(request.userId)}
                    size="large"
                  />
                }
                testID={`request-${request.userId}`}
              />
              <FriendsButtonPair>
                <ActionButton
                  variant={acceptKind}
                  label={t('list.acceptShort')}
                  accessibilityLabel={t('list.accept', { name: request.name })}
                  onPress={() => actions.accept(request.userId)}
                  grows
                  testID={`request-accept-${request.userId}`}
                />
                <ActionButton
                  variant={declineKind}
                  label={t('list.declineShort')}
                  accessibilityLabel={t('list.decline', { name: request.name })}
                  onPress={() => actions.decline(request.userId)}
                  grows
                  testID={`request-decline-${request.userId}`}
                />
              </FriendsButtonPair>
            </Card>
          ))}
          {refusal === null ? null : (
            <AppText variant="footnote" color="muted">
              {t(`refusals.${refusal}`)}
            </AppText>
          )}
        </View>
      )}

      <View style={styles.part}>
        <SectionHeader title={t('list.gardensTitle')} />
        {model.friends.length === 0 ? (
          <Card contentGap="md">
            <AppText variant="headline" testID="friends-empty">
              {t('list.noFriends')}
            </AppText>
            <AppText variant="subhead" color="muted">
              {t('list.noFriendsNote')}
            </AppText>
          </Card>
        ) : (
          <FriendCardGrid cards={model.friends} onOpen={actions.openFriend} />
        )}
        <ActionButton
          variant="tonal"
          symbol={ADD_SYMBOL}
          label={t('list.add')}
          onPress={actions.addFriend}
          testID="friends-add"
        />
      </View>

      <View style={styles.part}>
        <SectionHeader title={t('list.groupsTitle')} />
        <Card contentGap="md" style={styles.groups}>
          {model.groups.length === 0 ? (
            <FriendsRow label={t('list.noGroups')} testID="groups-empty" />
          ) : (
            model.groups.map((group) => (
              <View key={group.id}>
                <FriendsRow
                  label={group.name}
                  detail={t('list.members', { count: group.memberCount })}
                  leading={<Icon symbol={GROUP_SYMBOL} color="actionTint" />}
                  onPress={() => actions.openGroup(group.id)}
                  accessibilityLabel={`${group.name}, ${t('list.members', { count: group.memberCount })}`}
                  testID={`group-${group.id}`}
                />
                <FriendsSeparator />
              </View>
            ))
          )}
          <FriendsRow
            label={t('list.createGroup')}
            labelColor="actionTint"
            leading={<Icon symbol={PLUS_SYMBOL} color="actionTint" />}
            onPress={actions.createGroup}
            accessibilityLabel={t('list.createGroup')}
            testID="groups-create"
          />
        </Card>
      </View>
    </FriendsPage>
  );
}

const styles = StyleSheet.create({
  title: { paddingTop: spacing.lg, gap: spacing.xs },
  part: { gap: spacing.md },
  groups: { gap: spacing.none, paddingVertical: spacing.sm },
});
