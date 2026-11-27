import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Platform } from 'react-native';

import { useGenderedTranslation } from '@/features/gender';
import { AddFriendPage } from '@/features/friends';

/**
 * "Ajouter un proche", presented as a sheet over the tab (./_layout.tsx; maquettes 2026-11-26,
 * 5b), closed by the system button at the leading end of its bar (sheets.md › Best practices).
 * The sheet closes before anything else opens: the friend whose code was accepted, or the
 * scanner, are pages of the tab, under the tab bar, not more sheets. A link of invitation
 * (src/app/invite) arrives with its code, which fills the code field.
 */
export default function AddFriendRoute() {
  const { t } = useGenderedTranslation('friends');
  const { code } = useLocalSearchParams<{ code?: string }>();
  return (
    <>
      {Platform.OS === 'web' ? null : (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            icon="xmark"
            accessibilityLabel={t('add.close')}
            onPress={() => router.dismiss()}
          />
        </Stack.Toolbar>
      )}
      <AddFriendPage
        linkedCode={code}
        openFriend={(userId) => {
          router.dismiss();
          router.push({ pathname: '/friends/[id]', params: { id: userId } });
        }}
        openScanner={() => {
          router.dismiss();
          router.push('/friends/scan');
        }}
      />
    </>
  );
}
