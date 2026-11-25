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
  useSocialStore,
  useSocialVersion,
  type SocialClient,
  type SocialStore,
} from './social-store';
export { useSession } from './use-session';
// What the home screen's "Jardins voisins" reads: a friend's garden, their water, their colour.
export { gardenStateOf, waterStatusOf } from './friend-garden';
export { avatarIndexOf } from './friend-avatar';
