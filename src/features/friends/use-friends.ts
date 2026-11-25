import { useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Share } from 'react-native';

import { compareLocalDates, type LocalDate } from '@/domain/shared/local-date';
import {
  inviteLink,
  parseInviteLink,
  SOCIAL_CONFIG,
  type GroupId,
  type Invite,
  type LeaderboardPeriod,
  type PersonSearchResult,
  type UserId,
} from '@/domain/social';
import { useToday } from '@/features/home';
import { confirmAction, type ConfirmAction } from '@/ui';

import {
  buildFriendPageModel,
  buildFriendsModel,
  buildGroupModel,
  type FriendPageModel,
  type FriendsModel,
  type GroupModel,
} from './friends-model';
import { shownInviteCode, typedInviteCode } from './invite-code-text';
import { isRefusal, refusalOf, type ShownRefusal } from './refusal';
import { useSocialStore, useSocialVersion, type SocialStore } from './social-store';
import { useAsync, type AsyncState } from './use-async';

/** Runs an action of the tab, then tells every screen to read again; a refusal is kept to show. */
function useAction(store: SocialStore) {
  const [refusal, setRefusal] = useState<ShownRefusal | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const run = useCallback(
    (work: () => Promise<unknown>, onDone?: () => void, onRefused?: (error: unknown) => void) => {
      setIsBusy(true);
      setRefusal(null);
      work().then(
        () => {
          setIsBusy(false);
          onDone?.();
          store.changed();
        },
        (error: unknown) => {
          setIsBusy(false);
          if (onRefused === undefined) setRefusal(refusalOf(error));
          else onRefused(error);
        },
      );
    },
    [store],
  );
  return { run, refusal, setRefusal, isBusy };
}

// --- The list ----------------------------------------------------------------------------------

export interface FriendsListActions {
  openFriend(userId: UserId): void;
  openGroup(groupId: GroupId): void;
  addFriend(): void;
  createGroup(): void;
  accept(userId: UserId): void;
  decline(userId: UserId): void;
}

export interface FriendsListNavigation {
  openFriend(userId: UserId): void;
  openGroup(groupId: GroupId): void;
  addFriend(): void;
  createGroup(): void;
}

/** The Proches tab once signed in: requests, friends' gardens, groups. */
export function useFriendsList(navigation: FriendsListNavigation): {
  state: AsyncState<FriendsModel>;
  refusal: ShownRefusal | null;
  actions: FriendsListActions;
} {
  const store = useSocialStore();
  const version = useSocialVersion(store);
  const today = useToday();
  const { repository, isDemonstration } = store.client;
  const state = useAsync(async () => {
    const [friends, requests, groups] = await Promise.all([
      repository.listFriends(),
      repository.listFriendRequests(),
      repository.listMyGroups(),
    ]);
    const counted = await Promise.all(
      groups.map(async (group) => ({
        group,
        memberCount: (await repository.listGroupMembers(group.id)).length,
      })),
    );
    return buildFriendsModel({ isDemonstration, friends, requests, groups: counted, today });
  }, [repository, version, today, isDemonstration]);
  const { run, refusal } = useAction(store);
  return {
    state,
    refusal,
    actions: {
      ...navigation,
      accept: (userId) => run(() => repository.acceptFriendRequest(userId)),
      decline: (userId) => run(() => repository.declineFriendRequest(userId)),
    },
  };
}

// --- A friend's page ---------------------------------------------------------------------------

/** The words of the confirmations, which the screen translates. */
export interface ConfirmationTexts {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
}

export interface FriendPageActions {
  encourage(): void;
  /** Asks first (an action sheet), then removes the friend and goes back. */
  remove(texts: ConfirmationTexts): void;
  /** Asks first, then blocks and goes back. */
  block(texts: ConfirmationTexts): void;
}

export interface FriendPageDependencies {
  /** Back to the list, after removing or blocking. */
  goBack(): void;
  confirm?: ConfirmAction;
}

function encouragedOn(store: SocialStore, userId: UserId, today: LocalDate): boolean {
  const day = store.encouraged.get(userId);
  return day !== undefined && compareLocalDates(day, today) === 0;
}

export function useFriendPage(
  userId: UserId,
  { goBack, confirm = confirmAction }: FriendPageDependencies,
): {
  state: AsyncState<FriendPageModel>;
  refusal: ShownRefusal | null;
  actions: FriendPageActions;
} {
  const store = useSocialStore();
  const version = useSocialVersion(store);
  const today = useToday();
  const { repository, isDemonstration } = store.client;
  const state = useAsync(
    async () =>
      buildFriendPageModel({
        isDemonstration,
        view: await repository.getPersonView(userId),
        encouragedToday: encouragedOn(store, userId, today),
        today,
      }),
    [repository, userId, version, today, isDemonstration, store],
  );
  const { run, refusal } = useAction(store);
  const remember = () => store.encouraged.set(userId, today);
  return {
    state,
    refusal,
    actions: {
      encourage: () =>
        run(
          () => repository.sendNudge(userId, 'encourage'),
          remember,
          (error) => {
            // Sent from another screen or another phone today: the button says so, nothing more.
            if (isRefusal(error, 'already-nudged-today')) {
              remember();
              store.changed();
            }
          },
        ),
      remove: (texts) =>
        confirm({
          ...texts,
          isDestructive: true,
          onConfirm: () => run(() => repository.removeFriend(userId), goBack),
        }),
      block: (texts) =>
        confirm({
          ...texts,
          isDestructive: true,
          onConfirm: () => run(() => repository.blockPerson(userId), goBack),
        }),
    },
  };
}

// --- Adding a friend ---------------------------------------------------------------------------

export interface AddFriendModel {
  readonly isDemonstration: boolean;
  readonly query: string;
  /** Null before a search can start (fewer than 2 characters). */
  readonly results: readonly PersonSearchResult[] | null;
  readonly searchRefusal: ShownRefusal | null;
  /** Null while it is being made. */
  readonly invite: Invite | null;
  readonly code: string;
  readonly codeRefusal: ShownRefusal | null;
  readonly isBusy: boolean;
}

export interface AddFriendActions {
  changeQuery(text: string): void;
  sendRequest(userId: UserId): void;
  acceptRequest(userId: UserId): void;
  openFriend(userId: UserId): void;
  shareInvite(message: (link: string, code: string) => string): void;
  changeCode(text: string): void;
  submitCode(): void;
  /** Asks for the camera if it was never asked, then opens the scanner, whatever the answer. */
  scan(): void;
}

export interface AddFriendDependencies {
  openFriend(userId: UserId): void;
  openScanner(): void;
  /**
   * The code of a link of invitation that opened the page: it fills the code field when it is a
   * well-formed code, and is dropped otherwise (an entry from outside, read by `parseInviteLink`).
   */
  linkedCode?: string;
  /** The system's share sheet; injected for tests. */
  share?: (message: string) => Promise<unknown>;
}

const systemShare = (message: string) => Share.share({ message });

function wellFormedCodeOrEmpty(text: string | undefined): string {
  if (text === undefined) return '';
  try {
    return shownInviteCode(parseInviteLink(text));
  } catch {
    return '';
  }
}

/**
 * The three ways to add a friend (D36): a search by name, my code to share and someone's code to
 * type, and the QR code: mine to show, theirs to scan.
 */
export function useAddFriend({
  openFriend,
  openScanner,
  linkedCode,
  share = systemShare,
}: AddFriendDependencies): {
  model: AddFriendModel;
  actions: AddFriendActions;
} {
  const store = useSocialStore();
  const version = useSocialVersion(store);
  const today = useToday();
  const { repository, isDemonstration } = store.client;
  const [query, setQuery] = useState('');
  const [code, setCode] = useState(() => wellFormedCodeOrEmpty(linkedCode));

  // Search as the person types (search-fields.md › Best practices). Too short is not an error.
  const search = useAsync(async () => {
    if (query.trim().length < SOCIAL_CONFIG.searchMinLength) return null;
    return repository.searchPeople(query);
  }, [repository, query, version]);

  const invite = useAsync(async () => {
    const kept = store.invite();
    if (kept !== null && compareLocalDates(kept.expiresOn, today) >= 0) return kept;
    const made = await repository.createInvite();
    store.keepInvite(made);
    return made;
  }, [repository, store, today]);

  const action = useAction(store);
  const codeAction = useAction(store);
  // Nothing is read on arrival: the camera is asked about only when the person taps "Scanner"
  // (privacy.md › Requesting permission).
  const [, requestCamera] = useCameraPermissions({ get: false });

  return {
    model: {
      isDemonstration,
      query,
      results: search.status === 'ready' ? search.value : null,
      searchRefusal: search.status === 'failed' ? refusalOf(search.error) : action.refusal,
      invite: invite.status === 'ready' ? invite.value : null,
      code,
      codeRefusal: codeAction.refusal,
      isBusy: action.isBusy || codeAction.isBusy,
    },
    actions: {
      changeQuery: setQuery,
      sendRequest: (userId) => action.run(() => repository.sendFriendRequest(userId)),
      acceptRequest: (userId) => action.run(() => repository.acceptFriendRequest(userId)),
      openFriend,
      shareInvite: (message) => {
        if (invite.status !== 'ready') return;
        const { code: myCode } = invite.value;
        void share(message(inviteLink(myCode), myCode));
      },
      changeCode: (text) => {
        setCode(text);
        codeAction.setRefusal(null);
      },
      submitCode: () => {
        let friendId: UserId | null = null;
        codeAction.run(
          async () => {
            friendId = (await repository.acceptInvite(typedInviteCode(code))).userId;
          },
          () => {
            setCode('');
            if (friendId !== null) openFriend(friendId);
          },
        );
      },
      scan: () => {
        // A permission already given or refused returns at once, without asking again: the
        // scanner then shows the camera, or how to turn it on in Settings.
        requestCamera().then(openScanner, openScanner);
      },
    },
  };
}

// --- Scanning a friend's QR code ---------------------------------------------------------------

/**
 * What the camera may do. `blocked`: refused, and the system will not ask again; only Settings
 * can change it. `askable`: never asked (the scanner was opened some other way than its button).
 */
export type CameraAccess = 'unknown' | 'granted' | 'askable' | 'blocked';

/** What the scanner says under the camera. */
export type ScanNote = 'not-an-invitation' | ShownRefusal | null;

export interface ScanInviteModel {
  readonly camera: CameraAccess;
  /** The camera could not start (no camera, or it is used by another app). */
  readonly cameraFailed: boolean;
  readonly note: ScanNote;
  readonly isBusy: boolean;
}

export interface ScanInviteActions {
  /** Text read from a code by the camera. */
  scanned(text: string): void;
  /** The single button before the system question, when the camera was never asked about. */
  askForCamera(): void;
  openSettings(): void;
  cameraFailed(): void;
}

/**
 * The scanner: a text read by the camera goes through `parseInviteLink` (an entry from outside,
 * docs/specs/social.md, section 6), then the same acceptance as a typed code. Anything else is
 * "not an invitation", and the camera keeps looking. The same text is handled once: a camera
 * reads a code many times a second.
 */
export function useScanInvite({ openFriend }: { openFriend(userId: UserId): void }): {
  model: ScanInviteModel;
  actions: ScanInviteActions;
} {
  const store = useSocialStore();
  const { repository } = store.client;
  const [permission, requestCamera, readCamera] = useCameraPermissions();
  const [note, setNote] = useState<ScanNote>(null);
  const [cameraFailed, setCameraFailed] = useState(false);
  const { run, isBusy } = useAction(store);
  const lastText = useRef<string | null>(null);

  // Coming back from Settings: the answer may have changed there.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void readCamera();
    });
    return () => subscription.remove();
  }, [readCamera]);

  const camera: CameraAccess =
    permission === null
      ? 'unknown'
      : permission.granted
        ? 'granted'
        : permission.canAskAgain
          ? 'askable'
          : 'blocked';

  return {
    model: { camera, cameraFailed, note, isBusy },
    actions: {
      scanned: (text) => {
        if (isBusy || text === lastText.current) return;
        lastText.current = text;
        let code: string;
        try {
          code = parseInviteLink(text);
        } catch {
          setNote('not-an-invitation');
          return;
        }
        let friendId: UserId | null = null;
        setNote(null);
        run(
          async () => {
            friendId = (await repository.acceptInvite(code)).userId;
          },
          () => {
            if (friendId !== null) openFriend(friendId);
          },
          (error) => setNote(refusalOf(error)),
        );
      },
      askForCamera: () => void requestCamera(),
      openSettings: () => void Linking.openSettings(),
      cameraFailed: () => setCameraFailed(true),
    },
  };
}

// --- A group -----------------------------------------------------------------------------------

export interface GroupActions {
  changePeriod(period: LeaderboardPeriod['kind']): void;
  addMember(userId: UserId): void;
  openPerson(userId: UserId): void;
}

export type GroupState =
  | AsyncState<GroupModel>
  /** Not one of my groups (or no longer): the same answer as a group that does not exist. */
  | { readonly status: 'not-found' };

export function useGroup(
  groupId: GroupId,
  { openPerson }: { openPerson(userId: UserId): void },
): { state: GroupState; refusal: ShownRefusal | null; actions: GroupActions } {
  const store = useSocialStore();
  const version = useSocialVersion(store);
  const today = useToday();
  const { repository, auth, isDemonstration } = store.client;
  const [period, setPeriod] = useState<LeaderboardPeriod['kind']>('week');
  const state = useAsync(async () => {
    const group = (await repository.listMyGroups()).find((candidate) => candidate.id === groupId);
    if (group === undefined) return null;
    const [members, leaderboard, friends, session] = await Promise.all([
      repository.listGroupMembers(groupId),
      repository.getGroupLeaderboard(groupId, { kind: period, day: today }),
      repository.listFriends(),
      auth.getSession(),
    ]);
    return buildGroupModel({
      isDemonstration,
      group,
      period,
      leaderboard,
      memberIds: members.map((member) => member.userId),
      friends,
      myId: session?.userId ?? '',
    });
  }, [repository, auth, groupId, period, today, version, isDemonstration]);
  const { run, refusal } = useAction(store);
  return {
    state:
      state.status === 'ready'
        ? state.value === null
          ? { status: 'not-found' }
          : { status: 'ready', value: state.value }
        : state,
    refusal,
    actions: {
      changePeriod: setPeriod,
      addMember: (userId) => run(() => repository.addGroupMember(groupId, userId)),
      openPerson,
    },
  };
}

// --- A new group -------------------------------------------------------------------------------

export function useNewGroup({ openGroup }: { openGroup(groupId: GroupId): void }): {
  model: {
    readonly isDemonstration: boolean;
    readonly name: string;
    readonly refusal: ShownRefusal | null;
    readonly isBusy: boolean;
  };
  actions: { changeName(text: string): void; create(): void };
} {
  const store = useSocialStore();
  const [name, setName] = useState('');
  const { run, refusal, setRefusal, isBusy } = useAction(store);
  return {
    model: { isDemonstration: store.client.isDemonstration, name, refusal, isBusy },
    actions: {
      changeName: (text) => {
        setName(text);
        setRefusal(null);
      },
      create: () => {
        let created: GroupId | null = null;
        run(
          async () => {
            created = (await store.client.repository.createGroup(name)).id;
          },
          () => {
            if (created !== null) openGroup(created);
          },
        );
      },
    },
  };
}
