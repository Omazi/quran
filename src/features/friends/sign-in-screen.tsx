import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import { SOCIAL_CONFIG, type SignInProvider } from '@/domain/social';
import { GardenScene, previewGardenState } from '@/features/garden';
import {
  ActionButton,
  AppText,
  Card,
  layout,
  spacing,
  type ActionButtonVariant,
  type IconSymbol,
} from '@/ui';

import { FriendsPage, FriendsTextField } from './friends-kit';
import type { SignInActions, SignInModel } from './use-session';

/** The garden shown while signed out: a garden in its prime, what reading together grows. */
const SIGN_IN_GARDEN = previewGardenState({ hizbCompleted: 36 });

/**
 * The buttons of the validated welcome screen (docs/design/bienvenue.png): Apple in black (white
 * at night), Google outlined, the e-mail as green words. Apple comes first on iOS and is never
 * smaller than the others (sign-in-with-apple.md › Displaying buttons).
 */
export const SIGN_IN_BUTTON_KINDS: Readonly<Record<SignInProvider, ActionButtonVariant>> = {
  apple: 'contrast',
  google: 'outline',
  email: 'plain',
};

/** The Apple logo, as the system draws it; iOS only (the other platforms have no such symbol). */
export const APPLE_LOGO: IconSymbol = { ios: 'apple.logo', android: 'person' };

export interface SignInScreenProps {
  model: SignInModel;
  actions: SignInActions;
}

/**
 * Sign-in for the first visit to the tab, and only there: the rest of the app works without an
 * account (sign-in-with-apple.md › Delay sign-in as long as possible). It says what the account
 * is for before any button (› Ask people to sign in only in exchange for value;
 * managing-accounts.md › Explain the benefits), and each button names its way
 * (› Always identify the authentication method). The layout and look are those of the validated
 * welcome screen (docs/design/bienvenue.png): the name of the place at the top, the garden in the
 * sky, a big serif sentence, one line of grey text, then the capsule buttons.
 */
export function SignInScreen({ model, actions }: SignInScreenProps) {
  const { t } = useTranslation('friends');
  const press: Record<SignInProvider, () => void> = {
    apple: actions.signInWithApple,
    google: actions.signInWithGoogle,
    email: actions.openEmail,
  };
  const label: Record<SignInProvider, string> = {
    apple: t('signIn.apple'),
    google: t('signIn.google'),
    email: t('signIn.email'),
  };
  const refusal = model.refusal === null ? null : t(`refusals.${model.refusal}`);
  return (
    <FriendsPage sky="visit" testID="friends-sign-in">
      <AppText variant="title2" color="heading" align="center" style={styles.place}>
        {t('title')}
      </AppText>
      <View style={styles.garden}>
        <GardenScene state={SIGN_IN_GARDEN} size="band" />
      </View>
      <View style={styles.pitch}>
        <AppText variant="title1" color="heading">
          {t('signIn.heading')}
        </AppText>
        <AppText variant="subhead" color="muted">
          {t('signIn.text')}
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

      {model.emailStep === 'closed' ? null : (
        <Card contentGap="md">
          <AppText variant="subheadEmphasized" color="actionTint">
            {t('signIn.emailField')}
          </AppText>
          <FriendsTextField
            label={t('signIn.emailField')}
            placeholder={t('signIn.emailPlaceholder')}
            value={model.email}
            onChange={actions.changeEmail}
            kind="email"
            onSubmit={actions.requestCode}
            testID="sign-in-email-field"
          />
          <ActionButton
            variant="tonal"
            label={t('signIn.requestCode')}
            onPress={actions.requestCode}
            disabled={model.isBusy || model.email.trim() === ''}
            testID="sign-in-request-code"
          />
          {model.emailStep === 'code' ? (
            <AppText variant="footnote" color="muted">
              {t('signIn.codeSent', { email: model.email.trim() })}
            </AppText>
          ) : null}
        </Card>
      )}
      {model.emailStep === 'code' ? (
        <Card contentGap="md">
          <AppText variant="subheadEmphasized" color="actionTint">
            {t('signIn.codeField')}
          </AppText>
          <FriendsTextField
            label={t('signIn.codeField')}
            placeholder={t('signIn.codePlaceholder')}
            value={model.code}
            onChange={actions.changeCode}
            kind="emailCode"
            maxLength={SOCIAL_CONFIG.emailCodeLength}
            onSubmit={actions.signInWithEmail}
            testID="sign-in-code-field"
          />
          <ActionButton
            variant="filled"
            label={t('signIn.signInWithCode')}
            onPress={actions.signInWithEmail}
            disabled={model.isBusy || model.code.trim() === ''}
            testID="sign-in-with-code"
          />
        </Card>
      ) : null}

      {/* A refusal first, where the person looks after pressing; then, while nothing here is
          real, the demonstration said plainly (docs/specs/social.md, section 4). */}
      {refusal === null ? null : (
        <AppText variant="footnote" color="muted">
          {refusal}
        </AppText>
      )}
      {model.isDemonstration ? (
        <AppText variant="footnote" color="muted">
          {t('signIn.demoNote')}
        </AppText>
      ) : null}
    </FriendsPage>
  );
}

const styles = StyleSheet.create({
  place: { paddingTop: spacing.lg },
  garden: { paddingVertical: spacing.md, marginHorizontal: -layout.screenMargin },
  pitch: { gap: spacing.sm },
  buttons: { gap: spacing.md - spacing.xs },
});
