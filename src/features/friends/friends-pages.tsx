import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { GroupId, UserId } from '@/domain/social';
import type { ConfirmAction } from '@/ui';

import { AddFriendScreen } from './add-friend-screen';
import { FriendScreen } from './friend-screen';
import { FriendsListScreen } from './friends-list-screen';
import { GroupScreen, NewGroupScreen } from './group-screen';
import { ScanInviteScreen } from './scan-invite-screen';
import { FriendsLoading, FriendsUnavailable } from './screen-states';
import { SignInScreen } from './sign-in-screen';
import {
  useAddFriend,
  useFriendPage,
  useFriendsList,
  useGroup,
  useNewGroup,
  useScanInvite,
  type FriendsListNavigation,
} from './use-friends';
import { useSession, useSignIn } from './use-session';

/**
 * Each page of the tab: its hook, then its screen, with a loading and a failed state between
 * them. The routes of src/app give the navigation and nothing else.
 */

function Failed() {
  const { t } = useTranslation('friends');
  return (
    <FriendsUnavailable
      title={t('failed.title')}
      description={t('failed.text')}
      testID="friends-failed"
    />
  );
}

/** The root of the tab: sign-in on the first visit, the list once signed in. */
export function FriendsHome(navigation: FriendsListNavigation) {
  const session = useSession();
  if (session.status === 'loading') return <FriendsLoading testID="friends-loading" />;
  if (session.status === 'signed-out') return <SignInPage />;
  return <FriendsListPage {...navigation} />;
}

/**
 * Every page but the root needs a session: a link that opens one directly, before sign-in (or
 * after the demonstration was reset), gets the sign-in screen instead of an error.
 */
function SignedIn({ children }: { children: ReactNode }) {
  const session = useSession();
  if (session.status === 'loading') return <FriendsLoading testID="friends-loading" />;
  if (session.status === 'signed-out') return <SignInPage />;
  return <>{children}</>;
}

function SignInPage() {
  const { model, actions } = useSignIn();
  return <SignInScreen model={model} actions={actions} />;
}

function FriendsListPage(navigation: FriendsListNavigation) {
  const { state, refusal, actions } = useFriendsList(navigation);
  if (state.status === 'loading') return <FriendsLoading testID="friends-loading" />;
  if (state.status === 'failed') return <Failed />;
  return <FriendsListScreen model={state.value} refusal={refusal} actions={actions} />;
}

/** Gives the title of the page to the navigation bar, once it is known. */
function useTitle(title: string | null, onTitle: ((title: string) => void) | undefined) {
  useEffect(() => {
    if (title !== null) onTitle?.(title);
  }, [title, onTitle]);
}

function FriendPageContent({
  userId,
  goBack,
  confirm,
  onTitle,
}: {
  userId: UserId;
  goBack(): void;
  confirm?: ConfirmAction;
  onTitle?: (title: string) => void;
}) {
  const { t } = useTranslation('friends');
  const { state, refusal, actions } = useFriendPage(userId, { goBack, confirm });
  const name =
    state.status !== 'ready'
      ? null
      : state.value.status === 'friend'
        ? state.value.card.name
        : state.value.status === 'not-friend'
          ? state.value.name
          : null;
  useTitle(name === null ? null : t('friend.gardenTitle', { name }), onTitle);
  if (state.status === 'loading') return <FriendsLoading testID="friend-loading" />;
  if (state.status === 'failed') return <Failed />;
  return <FriendScreen model={state.value} refusal={refusal} actions={actions} />;
}

function AddFriendPageContent({
  openFriend,
  openScanner,
  linkedCode,
  share,
}: {
  openFriend(userId: UserId): void;
  openScanner(): void;
  /** The code of a link of invitation that opened the page, as it came. */
  linkedCode?: string;
  share?: (message: string) => Promise<unknown>;
}) {
  const { model, actions } = useAddFriend({ openFriend, openScanner, linkedCode, share });
  return <AddFriendScreen model={model} actions={actions} />;
}

function ScanInvitePageContent({ openFriend }: { openFriend(userId: UserId): void }) {
  const { model, actions } = useScanInvite({ openFriend });
  return <ScanInviteScreen model={model} actions={actions} />;
}

function GroupPageContent({
  groupId,
  openPerson,
  onTitle,
}: {
  groupId: GroupId;
  openPerson(userId: UserId): void;
  onTitle?: (title: string) => void;
}) {
  const { t } = useTranslation('friends');
  const { state, refusal, actions } = useGroup(groupId, { openPerson });
  useTitle(state.status === 'ready' ? state.value.name : null, onTitle);
  if (state.status === 'loading') return <FriendsLoading testID="group-loading" />;
  if (state.status === 'failed') return <Failed />;
  if (state.status === 'not-found') {
    return (
      <FriendsUnavailable
        title={t('group.notFoundTitle')}
        description={t('group.notFoundText')}
        testID="group-not-found"
      />
    );
  }
  return <GroupScreen model={state.value} refusal={refusal} actions={actions} />;
}

function NewGroupPageContent({ openGroup }: { openGroup(groupId: GroupId): void }) {
  const { model, actions } = useNewGroup({ openGroup });
  return <NewGroupScreen model={model} actions={actions} />;
}

export function FriendPage(props: Parameters<typeof FriendPageContent>[0]) {
  return (
    <SignedIn>
      <FriendPageContent {...props} />
    </SignedIn>
  );
}

export function AddFriendPage(props: Parameters<typeof AddFriendPageContent>[0]) {
  return (
    <SignedIn>
      <AddFriendPageContent {...props} />
    </SignedIn>
  );
}

export function ScanInvitePage(props: Parameters<typeof ScanInvitePageContent>[0]) {
  return (
    <SignedIn>
      <ScanInvitePageContent {...props} />
    </SignedIn>
  );
}

export function GroupPage(props: Parameters<typeof GroupPageContent>[0]) {
  return (
    <SignedIn>
      <GroupPageContent {...props} />
    </SignedIn>
  );
}

export function NewGroupPage(props: Parameters<typeof NewGroupPageContent>[0]) {
  return (
    <SignedIn>
      <NewGroupPageContent {...props} />
    </SignedIn>
  );
}
