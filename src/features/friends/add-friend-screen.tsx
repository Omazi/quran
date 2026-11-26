import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { inviteLink, SOCIAL_CONFIG } from '@/domain/social';
import { formatLongDate } from '@/features/home/format-date';
import {
  ActionButton,
  AppText,
  Card,
  layout,
  ProgressIndicator,
  QrCode,
  radius,
  spacing,
  useColors,
  type IconSymbol,
} from '@/ui';

import { FriendsPage, FriendsTextField } from './friends-kit';
import { shownInviteCode, typedInviteCode } from './invite-code-text';
import type { AddFriendActions, AddFriendModel } from './use-friends';

/** A shown code is "ABCD EFGH": the space takes one more character. */
const SHOWN_CODE_LENGTH = SOCIAL_CONFIG.inviteCodeLength + 1;

/**
 * The QR code takes 60 % of the width of its card: about 190 points on an iPhone, read at once by
 * a camera held at arm's length.
 */
const QR_WIDTH = '60%';

const SHARE_SYMBOL: IconSymbol = { ios: 'square.and.arrow.up', android: 'share' };
const SCAN_SYMBOL: IconSymbol = { ios: 'qrcode.viewfinder', android: 'qr_code_scanner' };

export interface AddFriendScreenProps {
  model: AddFriendModel;
  actions: AddFriendActions;
}

/**
 * "Ajouter un proche", the sheet of the Proches tab (maquettes 2026-11-26, 5b; sheets.md: a
 * focused task, closed by its own button in the bar). In order:
 *
 * - my QR code, large enough to be scanned at arm's length, and the one sentence that says who
 *   scans it; under it my code in two groups with "Partager", the system's share sheet
 *   (activity-views.md), which also offers to copy it;
 * - their code: a field with the keyboard of a code (text-fields.md › Best practices) and, beside
 *   it, "Scanner" for their QR code, which asks for the camera only at that tap
 *   (privacy.md › Requesting permission); then the button that adds them, once the code is whole.
 *
 * No search by name: the owner adds by code and QR code only, so that no one's name can be found.
 * Field and button share a row while the text fits, and stack at large text sizes.
 */
export function AddFriendScreen({ model, actions }: AddFriendScreenProps) {
  const { t, i18n } = useTranslation('friends');
  const colors = useColors();
  const { fontScale } = useWindowDimensions();
  const isSideBySide = fontScale <= layout.sideBySideMaxFontScale;
  const codeIsComplete = typedInviteCode(model.code).length === SOCIAL_CONFIG.inviteCodeLength;
  return (
    <FriendsPage isUnderBar testID="add-friend">
      <Card contentGap="md">
        <View testID="add-qr" style={styles.qrArea}>
          {model.invite === null ? (
            <ProgressIndicator accessibilityLabel={t('add.qrLoading')} />
          ) : (
            <QrCode
              value={inviteLink(model.invite.code)}
              accessibilityLabel={t('add.qrLabel')}
              style={styles.qr}
              testID="add-qr-code"
            />
          )}
          <AppText variant="subhead" color="muted" align="center">
            {t('add.qrCaption')}
          </AppText>
        </View>
        <View style={[styles.code, { backgroundColor: colors.field }]}>
          <View accessible testID="add-my-code" style={styles.codeWords}>
            <AppText variant="footnote" color="muted">
              {t('add.myCode')}
            </AppText>
            <AppText variant="title3" color="heading">
              {model.invite === null ? '…' : shownInviteCode(model.invite.code)}
            </AppText>
          </View>
          <ActionButton
            variant="tonal"
            isCompact
            fullWidth={false}
            symbol={SHARE_SYMBOL}
            label={t('add.shareShort')}
            accessibilityLabel={t('add.share')}
            onPress={() =>
              actions.shareInvite((link, code) => t('add.shareMessage', { link, code }))
            }
            disabled={model.invite === null}
            testID="add-share"
          />
        </View>
        {model.invite === null ? null : (
          <AppText variant="footnote" color="muted">
            {t('add.myCodeNote', { date: formatLongDate(model.invite.expiresOn, i18n.language) })}
          </AppText>
        )}
      </Card>

      <View style={styles.section}>
        <AppText variant="subheadEmphasized" accessibilityRole="header" style={styles.heading}>
          {t('add.enterTitle')}
        </AppText>
        <View style={isSideBySide ? styles.entryRow : styles.entryColumn}>
          <View style={isSideBySide ? styles.entryField : undefined}>
            <FriendsTextField
              label={t('add.enterField')}
              placeholder={t('add.enterPlaceholder')}
              value={model.code}
              onChange={actions.changeCode}
              kind="inviteCode"
              maxLength={SHOWN_CODE_LENGTH}
              onSubmit={actions.submitCode}
              ground="surface"
              testID="add-code"
            />
          </View>
          <ActionButton
            variant="tonal"
            isCompact
            fullWidth={!isSideBySide}
            symbol={SCAN_SYMBOL}
            label={t('add.scanShort')}
            accessibilityLabel={t('add.scan')}
            onPress={actions.scan}
            testID="add-scan"
          />
        </View>
        <ActionButton
          variant="filled"
          label={t('add.enterSubmit')}
          onPress={actions.submitCode}
          disabled={!codeIsComplete || model.isBusy}
          testID="add-code-submit"
        />
        {model.codeRefusal === null ? null : (
          <AppText variant="footnote" color="muted">
            {t(`refusals.${model.codeRefusal}`)}
          </AppText>
        )}
      </View>
    </FriendsPage>
  );
}

const styles = StyleSheet.create({
  qrArea: { alignItems: 'center', gap: layout.controlGap, paddingTop: spacing.xs },
  qr: { width: QR_WIDTH },
  code: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.controlGap,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingStart: spacing.md,
    paddingEnd: spacing.sm,
  },
  codeWords: { flex: 1 },
  section: { gap: layout.controlGap },
  heading: { paddingHorizontal: spacing.xs },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: layout.controlGap },
  entryColumn: { flexDirection: 'column', gap: layout.controlGap },
  entryField: { flex: 1 },
});
