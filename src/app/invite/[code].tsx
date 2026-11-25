import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * `quranapp://invite/<CODE>`, the link a QR code of invitation carries (docs/specs/social.md,
 * rule 6), when it is scanned with the phone's own camera: the app opens "Ajouter un proche" with
 * the code in its field. Nothing is accepted until the person taps the button: a link from
 * outside never adds anyone by itself.
 */
export default function InviteLinkRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <Redirect href={{ pathname: '/friends/add', params: { code } }} />;
}
