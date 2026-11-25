import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import { SOCIAL_CONFIG, type SignInProvider } from '@/domain/social';
import { GardenScene, previewGardenState } from '@/features/garden';
import { layout, spacing, type IconSymbol } from '@/ui';

import {
  FriendsButton,
  FriendsCard,
  FriendsEyebrow,
  FriendsPage,
  FriendsText,
  FriendsTextField,
  type FriendsButtonKind,
} from './friends-kit';
import type { SignInActions, SignInModel } from './use-session';

/** The garden shown while signed out: a garden in its prime, what reading together grows. */
const SIGN_IN_GARDEN = previewGardenState({ hizbCompleted: 36 });

/**
 * The buttons of the validated welcome screen (docs/design/bienvenue.png): Apple in black (white
 * at night), Google outlined, the e-mail as green words. Apple comes first on iOS and is never
 * smaller than the others (sign-in-with-apple.md › Displaying buttons).
 */
const KINDS: Readonly<Record<SignInProvider, FriendsButtonKind>> = {
  apple: 'apple',
  google: 'outline',
  email: 'link',
};

/** The Apple logo, as the system draws it; iOS only (the other platforms have no such symbol). */
const APPLE_LOGO: IconSymbol = { ios: 'apple.logo', android: 'person' };

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
      <FriendsText variant="title2" color="title" align="center" style={styles.place}>
        {t('title')}
      </FriendsText>
      <View style={styles.garden}>
        <GardenScene state={SIGN_IN_GARDEN} size="band" />
      </View>
      <View style={styles.pitch}>
        <FriendsText variant="heading" color="title">
          {t('signIn.heading')}
        </FriendsText>
        <FriendsText variant="subhead" color="inkSecondary">
          {t('signIn.text')}
        </FriendsText>
      </View>
      <View style={styles.buttons}>
        {model.providers.map((provider) => (
          <FriendsButton
            key={provider}
            kind={KINDS[provider]}
            symbol={provider === 'apple' && Platform.OS === 'ios' ? APPLE_LOGO : undefined}
            label={label[provider]}
            onPress={press[provider]}
            disabled={model.isBusy}
            testID={`sign-in-${provider}`}
          />
        ))}
      </View>

      {model.emailStep === 'closed' ? null : (
        <FriendsCard>
          <FriendsEyebrow>{t('signIn.emailField')}</FriendsEyebrow>
          <FriendsTextField
            label={t('signIn.emailField')}
            placeholder={t('signIn.emailPlaceholder')}
            value={model.email}
            onChange={actions.changeEmail}
            kind="email"
            onSubmit={actions.requestCode}
            testID="sign-in-email-field"
          />
          <FriendsButton
            kind="soft"
            label={t('signIn.requestCode')}
            onPress={actions.requestCode}
            disabled={model.isBusy || model.email.trim() === ''}
            testID="sign-in-request-code"
          />
          {model.emailStep === 'code' ? (
            <FriendsText variant="footnote" color="inkSecondary">
              {t('signIn.codeSent', { email: model.email.trim() })}
            </FriendsText>
          ) : null}
        </FriendsCard>
      )}
      {model.emailStep === 'code' ? (
        <FriendsCard>
          <FriendsEyebrow>{t('signIn.codeField')}</FriendsEyebrow>
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
          <FriendsButton
            kind="primary"
            label={t('signIn.signInWithCode')}
            onPress={actions.signInWithEmail}
            disabled={model.isBusy || model.code.trim() === ''}
            testID="sign-in-with-code"
          />
        </FriendsCard>
      ) : null}

      {/* A refusal first, where the person looks after pressing; then, while nothing here is
          real, the demonstration said plainly (docs/specs/social.md, section 4). */}
      {refusal === null ? null : (
        <FriendsText variant="footnote" color="inkSecondary">
          {refusal}
        </FriendsText>
      )}
      {model.isDemonstration ? (
        <FriendsText variant="footnote" color="inkSecondary">
          {t('signIn.demoNote')}
        </FriendsText>
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
