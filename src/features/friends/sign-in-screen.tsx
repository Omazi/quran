import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { SOCIAL_CONFIG, type SignInProvider } from '@/domain/social';
import { GardenScene, previewGardenState } from '@/features/garden';
import {
  AppText,
  ButtonRow,
  ContentRow,
  GroupedList,
  ListSection,
  Screen,
  TextFieldRow,
  spacing,
  type ButtonVariant,
} from '@/ui';

import type { SignInActions, SignInModel } from './use-session';

/** The garden shown while signed out: a garden in its prime, what reading together grows. */
const SIGN_IN_GARDEN = previewGardenState({ hizbCompleted: 36 });

/**
 * The first way is the prominent one, the next one bordered, the e-mail way a plain button: Apple
 * comes first on iOS and is never smaller than the others (sign-in-with-apple.md › Displaying
 * buttons: prominently display it, no smaller than other sign-in buttons).
 */
const VARIANTS: readonly ButtonVariant[] = ['primary', 'secondary', 'plain'];

export interface SignInScreenProps {
  model: SignInModel;
  actions: SignInActions;
}

/**
 * Sign-in for the first visit to the tab, and only there: the rest of the app works without an
 * account (sign-in-with-apple.md › Delay sign-in as long as possible). It says what the account
 * is for before any button (› Ask people to sign in only in exchange for value;
 * managing-accounts.md › Explain the benefits), and each button names its way
 * (› Always identify the authentication method). Layout of the validated welcome screen
 * (docs/design/bienvenue.png): the garden, a title, one sentence, then the buttons.
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
  const refusal = model.refusal === null ? undefined : t(`refusals.${model.refusal}`);
  return (
    <Screen background="groupedBackground" testID="friends-sign-in">
      <GroupedList>
        <ListSection isBare>
          <ContentRow>
            <View style={styles.title}>
              <AppText variant="largeTitle">{t('title')}</AppText>
            </View>
          </ContentRow>
          <ContentRow isEdgeToEdge>
            <GardenScene state={SIGN_IN_GARDEN} size="band" />
          </ContentRow>
          <ContentRow>
            <View style={styles.pitch}>
              <AppText variant="title2">{t('signIn.heading')}</AppText>
              <AppText variant="subhead" color="secondaryLabel">
                {t('signIn.text')}
              </AppText>
            </View>
          </ContentRow>
        </ListSection>
        {model.providers.map((provider, index) => (
          <ListSection
            key={provider}
            footer={
              // The demonstration is said under the last way, where every way ends.
              index === model.providers.length - 1 && model.emailStep === 'closed'
                ? demoFooter(model, t('signIn.demoNote'), refusal)
                : undefined
            }
          >
            <ButtonRow
              label={label[provider]}
              onPress={press[provider]}
              variant={VARIANTS[index] ?? 'plain'}
              disabled={model.isBusy}
              testID={`sign-in-${provider}`}
            />
          </ListSection>
        ))}
        {model.emailStep === 'closed' ? null : (
          <ListSection
            title={t('signIn.emailField')}
            footer={
              model.emailStep === 'address'
                ? demoFooter(model, t('signIn.demoNote'), refusal)
                : t('signIn.codeSent', { email: model.email.trim() })
            }
          >
            <TextFieldRow
              label={t('signIn.emailField')}
              placeholder={t('signIn.emailPlaceholder')}
              value={model.email}
              onChange={actions.changeEmail}
              kind="email"
              onSubmit={actions.requestCode}
              testID="sign-in-email-field"
            />
            <ButtonRow
              label={t('signIn.requestCode')}
              onPress={actions.requestCode}
              variant="plain"
              disabled={model.isBusy || model.email.trim() === ''}
              testID="sign-in-request-code"
            />
          </ListSection>
        )}
        {model.emailStep === 'code' ? (
          <ListSection
            title={t('signIn.codeField')}
            footer={demoFooter(model, t('signIn.demoNote'), refusal)}
          >
            <TextFieldRow
              label={t('signIn.codeField')}
              placeholder={t('signIn.codePlaceholder')}
              value={model.code}
              onChange={actions.changeCode}
              kind="emailCode"
              maxLength={SOCIAL_CONFIG.emailCodeLength}
              onSubmit={actions.signInWithEmail}
              testID="sign-in-code-field"
            />
            <ButtonRow
              label={t('signIn.signInWithCode')}
              onPress={actions.signInWithEmail}
              variant="plain"
              disabled={model.isBusy || model.code.trim() === ''}
              testID="sign-in-with-code"
            />
          </ListSection>
        ) : null}
      </GroupedList>
    </Screen>
  );
}

/**
 * A refusal first, where the person looks after pressing; then, while nothing here is real, the
 * demonstration said plainly (docs/specs/social.md, section 4).
 */
function demoFooter(model: SignInModel, demoNote: string, refusal: string | undefined) {
  const parts = [refusal, model.isDemonstration ? demoNote : undefined].filter(
    (part): part is string => part !== undefined,
  );
  return parts.length === 0 ? undefined : parts.join('\n\n');
}

const styles = StyleSheet.create({
  title: { paddingVertical: spacing.sm },
  pitch: { gap: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.sm },
});
