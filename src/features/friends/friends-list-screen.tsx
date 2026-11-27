import { StyleSheet, View } from 'react-native';

import { useGenderedTranslation } from '@/features/gender';
import type { Invite } from '@/domain/social';
import {
  ActionButton,
  AppText,
  Avatar,
  Card,
  Icon,
  SectionHeader,
  layout,
  radius,
  spacing,
  useColors,
  type ActionButtonVariant,
  type IconSymbol,
} from '@/ui';

import { avatarIndexOf, initialOf } from './friend-avatar';
import { FriendCardGrid } from './friend-card-grid';
import {
  FriendsButtonPair,
  FriendsPage,
  FriendsRow,
  FriendsSeparator,
  FriendsTile,
} from './friends-kit';
import type { FriendsModel } from './friends-model';
import { shownInviteCode } from './invite-code-text';
import type { ShownRefusal } from './refusal';
import type { FriendsListActions } from './use-friends';

const SCAN_SYMBOL: IconSymbol = { ios: 'qrcode.viewfinder', android: 'qr_code_scanner' };
const QR_SYMBOL: IconSymbol = { ios: 'qrcode', android: 'qr_code_2' };
const SHARE_SYMBOL: IconSymbol = { ios: 'square.and.arrow.up', android: 'share' };
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
  /** My invitation, null while it is being made. */
  invite: Invite | null;
}

/**
 * The Proches tab: "how are my friends' gardens, and who is waiting for me?"
 *
 * As the owner validated it without an account (maquettes 2026-11-26, "friends"): a serif title
 * on the warm sky, then white cards on the page's cream. First the card "Ajoute tes proches",
 * the ways to add someone (scanning their QR code, showing mine) and my code to share, because a
 * tab without friends starts there; then the requests waiting for an answer, the gardens (the
 * cards of "Jardins voisins", marked "Exemple" while they are the demonstration's), then the
 * groups (layout.md › Visual hierarchy). No search by name: the owner adds by code and QR code
 * only. The demonstration is said in the first card, beside the code it concerns: discreet, but
 * never hidden (docs/specs/social.md, section 4), and here only.
 *
 * A request is the person, then the answer on one row: "Accepter" and "Refuser" side by side at
 * the same size, the preferred one in the stronger style (buttons.md › Style).
 */
export function FriendsListScreen({ model, refusal, actions, invite }: FriendsListScreenProps) {
  const { t } = useGenderedTranslation('friends');
  const fewRequests = model.requests.length <= MOST_PROMINENT_REQUESTS;
  const acceptKind: ActionButtonVariant = fewRequests ? 'filled' : 'tonal';
  const declineKind: ActionButtonVariant = fewRequests ? 'tonal' : 'outline';
  return (
    <FriendsPage testID="friends-list">
      <View style={styles.title}>
        <AppText variant="largeTitle" color="heading">
          {t('title')}
        </AppText>
      </View>

      <AddCard isDemonstration={model.isDemonstration} invite={invite} actions={actions} />

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
        <View style={styles.header}>
          <SectionHeader title={t('list.gardensTitle')} />
          {model.gardensAreExamples && model.friends.length > 0 ? (
            <AppText variant="footnote" color="muted">
              {t('list.examples')}
            </AppText>
          ) : null}
        </View>
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
          <FriendCardGrid
            cards={model.friends}
            areExamples={model.gardensAreExamples}
            onOpen={actions.openFriend}
          />
        )}
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

/**
 * "Ajoute tes proches": why (their gardens, encouraging each other), the two ways as tiles of the
 * same size (buttons.md › Style: a set of choices), then my code in two groups, with the system's
 * share sheet beside it (activity-views.md), which also offers to copy it. In the demonstration a
 * line says the codes do not reach another phone yet: nothing here claims more than the app does.
 */
function AddCard({
  isDemonstration,
  invite,
  actions,
}: {
  isDemonstration: boolean;
  invite: Invite | null;
  actions: FriendsListActions;
}) {
  const { t } = useGenderedTranslation('friends');
  const colors = useColors();
  return (
    <Card contentGap="md" testID="friends-add-card">
      <View style={styles.addWords}>
        <AppText variant="headline" accessibilityRole="header">
          {t('list.addTitle')}
        </AppText>
        <AppText variant="subhead" color="muted">
          {t('list.addText')}
        </AppText>
        {isDemonstration ? (
          <AppText variant="footnote" color="muted" testID="friends-demo-note">
            {t('demoNote')}
          </AppText>
        ) : null}
      </View>
      <View style={styles.ways}>
        <FriendsTile
          label={t('list.scan')}
          accessibilityLabel={t('add.scan')}
          symbol={SCAN_SYMBOL}
          onPress={actions.scan}
          testID="friends-scan"
        />
        <FriendsTile
          label={t('list.myQr')}
          symbol={QR_SYMBOL}
          onPress={actions.addFriend}
          testID="friends-my-qr"
        />
      </View>
      <View style={[styles.code, { backgroundColor: colors.field }]}>
        <View accessible style={styles.codeWords} testID="friends-my-code">
          <AppText variant="footnote" color="muted">
            {t('add.myCode')}
          </AppText>
          <AppText variant="title3" color="heading">
            {invite === null ? '…' : shownInviteCode(invite.code)}
          </AppText>
        </View>
        <ActionButton
          variant="surface"
          isCompact
          fullWidth={false}
          symbol={SHARE_SYMBOL}
          accessibilityLabel={t('add.share')}
          onPress={() => actions.shareInvite((link, code) => t('add.shareMessage', { link, code }))}
          disabled={invite === null}
          testID="friends-share-code"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  // The title of a tab starts at the same place on every tab (`layout.tabTitle`); the page
  // already keeps `spacing.md` above its content and `layout.screenMargin` beside it.
  title: {
    marginTop: layout.tabTitle.top - spacing.md,
    marginStart: layout.tabTitle.inset - layout.screenMargin,
    gap: spacing.xs,
  },
  header: { gap: spacing.xs },
  addWords: { gap: spacing.xs },
  ways: { flexDirection: 'row', gap: spacing.sm },
  code: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.controlGap,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingStart: spacing.md,
    paddingEnd: spacing.sm,
  },
  codeWords: { flex: 1 },
  part: { gap: spacing.md },
  groups: { gap: spacing.none, paddingVertical: spacing.sm },
});
