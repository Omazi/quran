import { router } from 'expo-router';

import { ScanInvitePage } from '@/features/friends';

/**
 * Scanning a friend's QR code. A code that is accepted leads to the new friend's page, in place
 * of the scanner and of the page that opened it: going back returns to the list.
 */
export default function ScanInviteRoute() {
  return (
    <ScanInvitePage
      openFriend={(userId) => {
        // The scanner closes, then the friend's page takes the place of "Ajouter un proche", as
        // after a typed code.
        router.dismiss();
        router.replace({ pathname: '/friends/[id]', params: { id: userId } });
      }}
    />
  );
}
