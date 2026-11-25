/**
 * The Proches tab (docs/specs/social.md; D33, D36, D37): sign-in, friends and their gardens, a
 * friend's page, adding a friend, groups. On demonstration data until the server exists.
 * Everything else in this folder is private.
 */

export {
  AddFriendPage,
  FriendPage,
  FriendsHome,
  GroupPage,
  NewGroupPage,
  ScanInvitePage,
  type FriendOptionsItem,
  type FriendOptionsMenu,
} from './friends-pages';
export {
  SocialProvider,
  createSocialStore,
  type SocialClient,
  type SocialStore,
} from './social-store';
export { useSession } from './use-session';
