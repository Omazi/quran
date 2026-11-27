import { Platform, Pressable, StyleSheet, View } from 'react-native';

import type { SignInProvider } from '@/domain/social';
import { APPLE_LOGO, SIGN_IN_BUTTON_KINDS, useSignIn } from '@/features/friends';
import { useGenderedTranslation } from '@/features/gender';
import { ActionButton, AppText, layout, spacing } from '@/ui';

import { DismissibleSheet } from './dismissible-sheet';

export interface AccountInvitationSheetProps {
  onDismiss: () => void;
  /** The e-mail way needs a field and a code: it continues in the sign-in of the friends tab. */
  onOpenEmail: () => void;
}

/**
 * "Ton jardin est prêt." (docs/design/premier-lancement-voix, the account sheet): a sheet that
 * rises over the new garden and offers an account to find it on every device. The buttons and
 * what they do are those of the sign-in of the friends tab (`useSignIn`), nothing is written
 * twice: Apple in black, Google outlined, the e-mail as green words, then a quiet "Plus tard".
 * Signing in closes it from outside (the session changes); a refusal is said under the buttons.
 */
export function AccountInvitationSheet({ onDismiss, onOpenEmail }: AccountInvitationSheetProps) {
  const { t } = useGenderedTranslation('home');
  const { t: tFriends } = useGenderedTranslation('friends');
  const { model, actions } = useSignIn();
  const press: Record<SignInProvider, () => void> = {
    apple: actions.signInWithApple,
    google: actions.signInWithGoogle,
    email: () => {
      onDismiss();
      onOpenEmail();
    },
  };
  const label: Record<SignInProvider, string> = {
    apple: tFriends('signIn.apple'),
    google: tFriends('signIn.google'),
    email: tFriends('signIn.email'),
  };
  return (
    <DismissibleSheet
      onDismiss={onDismiss}
      closeLabel={t('invitation.close')}
      testID="account-invitation"
      closeTestID="account-invitation-close"
      contentStyle={styles.sheet}
    >
      <View style={styles.words}>
        <AppText variant="title1" color="heading" accessibilityRole="header">
          {t('invitation.title')}
        </AppText>
        <AppText variant="subhead" color="muted">
          {t('invitation.text')}
        </AppText>
      </View>
      <View style={styles.buttons}>
        {model.providers.map((provider) => (
          <ActionButton
            key={provider}
            variant={SIGN_IN_BUTTON_KINDS[provider]}
            symbol={provider === 'apple' && Platform.OS === 'ios' ? APPLE_LOGO : undefined}
            label={label[provider]}
            onPress={press[provider]}
            disabled={model.isBusy}
            testID={`sign-in-${provider}`}
          />
        ))}
      </View>
      {model.refusal === null ? null : (
        <AppText variant="footnote" color="muted" align="center">
          {tFriends(`refusals.${model.refusal}`)}
        </AppText>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={onDismiss}
        style={styles.later}
        testID="account-invitation-later"
      >
        <AppText variant="subhead" color="muted" align="center">
          {t('invitation.later')}
        </AppText>
      </Pressable>
    </DismissibleSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { rowGap: spacing.md },
  words: { rowGap: spacing.sm },
  buttons: { rowGap: spacing.sm, marginTop: spacing.sm },
  later: { minHeight: layout.touchTarget, alignItems: 'center', justifyContent: 'center' },
});
