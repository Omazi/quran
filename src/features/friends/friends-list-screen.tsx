import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  ButtonPairRow,
  ButtonRow,
  ContentRow,
  DetailRow,
  GroupedList,
  LabelRow,
  ListRow,
  ListSection,
  Screen,
  spacing,
  type IconSymbol,
} from '@/ui';

import { FriendCardGrid } from './friend-card-grid';
import type { FriendsModel } from './friends-model';
import type { ShownRefusal } from './refusal';
import type { FriendsListActions } from './use-friends';

const REQUEST_SYMBOL: IconSymbol = { ios: 'person.badge.plus', android: 'person_add' };

/**
 * "Keep the number of prominent buttons to one or two per view" (buttons.md › Style): beyond two
 * requests, "Accepter" takes the bordered style, still more visible than "Refuser".
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
 * One list of the system, so the screen scrolls as one (lists-and-tables.md › Style). In order of
 * importance (layout.md › Visual hierarchy): the title, the requests waiting for an answer, the
 * gardens (the signature of the screen, as cards: docs/design/accueil.png), the way to add a
 * friend, then the groups. The demonstration is said under the title, in the secondary colour:
 * discreet, but never hidden (docs/specs/social.md, section 4); it is said here only, at the root
 * of the tab, not again on every page.
 *
 * A request is the person (who asks), then the answer on one row: "Accepter" and "Refuser" side
 * by side at the same size, the preferred one in the more prominent style
 * (buttons.md › Style: "Use style — not size — to visually distinguish the preferred choice").
 */
export function FriendsListScreen({ model, refusal, actions }: FriendsListScreenProps) {
  const { t } = useTranslation('friends');
  return (
    <Screen background="groupedBackground" testID="friends-list">
      <GroupedList>
        <ListSection isBare>
          <ContentRow>
            <View style={styles.title}>
              <AppText variant="largeTitle">{t('title')}</AppText>
              {model.isDemonstration ? (
                <AppText variant="footnote" color="secondaryLabel" testID="friends-demo-note">
                  {t('demoNote')}
                </AppText>
              ) : null}
            </View>
          </ContentRow>
        </ListSection>
        {model.requests.length === 0 ? null : (
          <ListSection
            title={t('list.requestsTitle')}
            footer={refusal === null ? undefined : t(`refusals.${refusal}`)}
          >
            {model.requests.flatMap((request) => [
              <LabelRow
                key={`${request.userId}-who`}
                label={request.name}
                detail={t('list.requestDetail')}
                symbol={REQUEST_SYMBOL}
                testID={`request-${request.userId}`}
              />,
              <ButtonPairRow
                key={`${request.userId}-answer`}
                preferred={{
                  label: t('list.acceptShort'),
                  accessibilityLabel: t('list.accept', { name: request.name }),
                  onPress: () => actions.accept(request.userId),
                  testID: `request-accept-${request.userId}`,
                }}
                other={{
                  label: t('list.declineShort'),
                  accessibilityLabel: t('list.decline', { name: request.name }),
                  onPress: () => actions.decline(request.userId),
                  testID: `request-decline-${request.userId}`,
                }}
                preferredVariant={
                  model.requests.length <= MOST_PROMINENT_REQUESTS ? 'primary' : 'secondary'
                }
              />,
            ])}
          </ListSection>
        )}
        {model.friends.length === 0 ? (
          <ListSection title={t('list.gardensTitle')} footer={t('list.noFriendsNote')}>
            <ListRow label={t('list.noFriends')} testID="friends-empty" />
          </ListSection>
        ) : (
          <ListSection title={t('list.gardensTitle')} isBare>
            <ContentRow>
              <FriendCardGrid cards={model.friends} onOpen={actions.openFriend} />
            </ContentRow>
          </ListSection>
        )}
        <ListSection>
          <ButtonRow
            label={t('list.add')}
            onPress={actions.addFriend}
            variant="plain"
            testID="friends-add"
          />
        </ListSection>
        <ListSection title={t('list.groupsTitle')}>
          {model.groups.length === 0 ? (
            <ListRow label={t('list.noGroups')} testID="groups-empty" />
          ) : (
            model.groups.map((group) => (
              <DetailRow
                key={group.id}
                label={group.name}
                detail={t('list.members', { count: group.memberCount })}
                onPress={() => actions.openGroup(group.id)}
                testID={`group-${group.id}`}
              />
            ))
          )}
          <ButtonRow
            label={t('list.createGroup')}
            onPress={actions.createGroup}
            variant="plain"
            testID="groups-create"
          />
        </ListSection>
      </GroupedList>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { paddingVertical: spacing.sm, gap: spacing.xs },
});
