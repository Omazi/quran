import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { spacing, type IconSymbol } from '@/ui';

import { avatarRoleOf, initialOf } from './friend-avatar';
import { FriendCardGrid } from './friend-card-grid';
import {
  FriendsAvatar,
  FriendsButton,
  FriendsButtonPair,
  FriendsCard,
  FriendsPage,
  FriendsRow,
  FriendsSectionTitle,
  FriendsSeparator,
  FriendsSymbol,
  FriendsText,
  type FriendsButtonKind,
} from './friends-kit';
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
  const acceptKind: FriendsButtonKind = fewRequests ? 'primary' : 'soft';
  const declineKind: FriendsButtonKind = fewRequests ? 'soft' : 'outline';
  return (
    <FriendsPage testID="friends-list">
      <View style={styles.title}>
        <FriendsText variant="largeTitle" color="title">
          {t('title')}
        </FriendsText>
        {model.isDemonstration ? (
          <FriendsText variant="footnote" color="inkSecondary" testID="friends-demo-note">
            {t('demoNote')}
          </FriendsText>
        ) : null}
      </View>

      {model.requests.length === 0 ? null : (
        <View style={styles.part}>
          <FriendsSectionTitle title={t('list.requestsTitle')} />
          {model.requests.map((request) => (
            <FriendsCard key={request.userId}>
              <FriendsRow
                label={request.name}
                detail={t('list.requestDetail')}
                leading={
                  <FriendsAvatar
                    initial={initialOf(request.name)}
                    color={avatarRoleOf(request.userId)}
                  />
                }
                testID={`request-${request.userId}`}
              />
              <FriendsButtonPair>
                <FriendsButton
                  kind={acceptKind}
                  label={t('list.acceptShort')}
                  accessibilityLabel={t('list.accept', { name: request.name })}
                  onPress={() => actions.accept(request.userId)}
                  isWide
                  testID={`request-accept-${request.userId}`}
                />
                <FriendsButton
                  kind={declineKind}
                  label={t('list.declineShort')}
                  accessibilityLabel={t('list.decline', { name: request.name })}
                  onPress={() => actions.decline(request.userId)}
                  isWide
                  testID={`request-decline-${request.userId}`}
                />
              </FriendsButtonPair>
            </FriendsCard>
          ))}
          {refusal === null ? null : (
            <FriendsText variant="footnote" color="inkSecondary">
              {t(`refusals.${refusal}`)}
            </FriendsText>
          )}
        </View>
      )}

      <View style={styles.part}>
        <FriendsSectionTitle title={t('list.gardensTitle')} />
        {model.friends.length === 0 ? (
          <FriendsCard>
            <FriendsText variant="headline" testID="friends-empty">
              {t('list.noFriends')}
            </FriendsText>
            <FriendsText variant="subhead" color="inkSecondary">
              {t('list.noFriendsNote')}
            </FriendsText>
          </FriendsCard>
        ) : (
          <FriendCardGrid cards={model.friends} onOpen={actions.openFriend} />
        )}
        <FriendsButton
          kind="soft"
          symbol={ADD_SYMBOL}
          label={t('list.add')}
          onPress={actions.addFriend}
          testID="friends-add"
        />
      </View>

      <View style={styles.part}>
        <FriendsSectionTitle title={t('list.groupsTitle')} />
        <FriendsCard style={styles.groups}>
          {model.groups.length === 0 ? (
            <FriendsRow label={t('list.noGroups')} testID="groups-empty" />
          ) : (
            model.groups.map((group) => (
              <View key={group.id}>
                <FriendsRow
                  label={group.name}
                  detail={t('list.members', { count: group.memberCount })}
                  leading={<FriendsSymbol symbol={GROUP_SYMBOL} color="forestText" />}
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
            labelColor="forestText"
            leading={<FriendsSymbol symbol={PLUS_SYMBOL} color="forestText" />}
            onPress={actions.createGroup}
            accessibilityLabel={t('list.createGroup')}
            testID="groups-create"
          />
        </FriendsCard>
      </View>
    </FriendsPage>
  );
}

const styles = StyleSheet.create({
  title: { paddingTop: spacing.lg, gap: spacing.xs },
  part: { gap: spacing.md },
  groups: { gap: spacing.none, paddingVertical: spacing.sm },
});
