import { router } from 'expo-router';

import { ScanInvitePage } from '@/features/friends';

/**
 * Scanning a friend's QR code, a page of the tab opened from the list or from the sheet once it
 * has closed. A code that is accepted leads to the new friend's page, in place of the scanner:
 * going back returns to the list.
 */
export default function ScanInviteRoute() {
  return (
    <ScanInvitePage
      openFriend={(userId) => router.replace({ pathname: '/friends/[id]', params: { id: userId } })}
    />
  );
}
