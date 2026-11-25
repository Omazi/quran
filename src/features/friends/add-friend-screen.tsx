import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  inviteLink,
  SOCIAL_CONFIG,
  type PersonSearchResult,
  type SearchRelation,
} from '@/domain/social';
import { formatLongDate } from '@/features/home/format-date';
import {
  ActionButton,
  AppText,
  Avatar,
  Card,
  ProgressIndicator,
  QrCode,
  spacing,
  type IconSymbol,
} from '@/ui';

import { avatarIndexOf, initialOf } from './friend-avatar';
import { FriendsPage, FriendsRow, FriendsSeparator, FriendsTextField } from './friends-kit';
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

const RELATION_KEYS: Readonly<Record<SearchRelation, string>> = {
  friend: 'add.relationFriend',
  'request-sent': 'add.relationSent',
  'request-received': 'add.relationReceived',
  none: 'add.relationNone',
};

export interface AddFriendScreenProps {
  model: AddFriendModel;
  actions: AddFriendActions;
}

/**
 * The ways to add a friend (D36), one card each, the quickest first, in the look of the home
 * screen's cards (docs/design/accueil.png: a small green line above, the content, a capsule
 * button). By name: a search field above the results it filters, searching as the person types
 * (search-fields.md › Best practices); with my code, shown large and shared through the system's
 * share sheet, the one prominent button of the page (activity-views.md; buttons.md › Style); with
 * their code, a field with the keyboard of a code (text-fields.md › Best practices); with a QR
 * code: mine, drawn large enough to be scanned, and a button to scan theirs, which asks for the
 * camera only then (privacy.md › Requesting permission).
 */
export function AddFriendScreen({ model, actions }: AddFriendScreenProps) {
  const { t, i18n } = useTranslation('friends');
  const codeIsComplete = typedInviteCode(model.code).length === SOCIAL_CONFIG.inviteCodeLength;
  return (
    <FriendsPage isUnderBar testID="add-friend">
      <Card contentGap="md">
        <AppText variant="subheadEmphasized" color="actionTint">
          {t('add.searchTitle')}
        </AppText>
        <FriendsTextField
          label={t('add.searchField')}
          placeholder={t('add.searchPlaceholder')}
          value={model.query}
          onChange={actions.changeQuery}
          kind="search"
          maxLength={SOCIAL_CONFIG.nameMaxLength}
          clearLabel={t('add.clear')}
          testID="add-search"
        />
        {model.results === null ? null : model.results.length === 0 ? (
          <AppText variant="subhead" color="muted" testID="add-no-results">
            {t('add.noResults')}
          </AppText>
        ) : (
          model.results.map((result) => (
            <SearchResult
              key={result.userId}
              result={result}
              actions={actions}
              relation={t(RELATION_KEYS[result.relation])}
              isBusy={model.isBusy}
            />
          ))
        )}
        <AppText variant="footnote" color="muted">
          {model.searchRefusal === null
            ? t('add.searchNote')
            : t(`refusals.${model.searchRefusal}`)}
        </AppText>
      </Card>

      <Card contentGap="md">
        <AppText variant="subheadEmphasized" color="actionTint">
          {t('add.myCodeTitle')}
        </AppText>
        <View accessible testID="add-my-code" style={styles.code}>
          <AppText variant="subhead" color="muted">
            {t('add.myCode')}
          </AppText>
          <AppText variant="title1" color="heading" accessibilityRole="text">
            {model.invite === null ? '…' : shownInviteCode(model.invite.code)}
          </AppText>
        </View>
        <ActionButton
          variant="filled"
          symbol={SHARE_SYMBOL}
          label={t('add.share')}
          onPress={() => actions.shareInvite((link, code) => t('add.shareMessage', { link, code }))}
          disabled={model.invite === null}
          testID="add-share"
        />
        {model.invite === null ? null : (
          <AppText variant="footnote" color="muted">
            {t('add.myCodeNote', { date: formatLongDate(model.invite.expiresOn, i18n.language) })}
          </AppText>
        )}
      </Card>

      <Card contentGap="md">
        <AppText variant="subheadEmphasized" color="actionTint">
          {t('add.enterTitle')}
        </AppText>
        <FriendsTextField
          label={t('add.enterField')}
          placeholder={t('add.enterPlaceholder')}
          value={model.code}
          onChange={actions.changeCode}
          kind="inviteCode"
          maxLength={SHOWN_CODE_LENGTH}
          onSubmit={actions.submitCode}
          testID="add-code"
        />
        <ActionButton
          variant="tonal"
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
      </Card>

      <Card contentGap="md">
        <AppText variant="subheadEmphasized" color="actionTint">
          {t('add.qrTitle')}
        </AppText>
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
        </View>
        <ActionButton
          variant="tonal"
          symbol={SCAN_SYMBOL}
          label={t('add.scan')}
          onPress={actions.scan}
          testID="add-scan"
        />
        <AppText variant="footnote" color="muted">
          {t('add.qrNote')}
        </AppText>
      </Card>
    </FriendsPage>
  );
}

/**
 * One person found: their initial, name and what they are to me (rule 11: nothing else), then the
 * action that fits as green words: send a request, or accept theirs. A friend opens their page.
 */
function SearchResult({
  result,
  relation,
  actions,
  isBusy,
}: {
  result: PersonSearchResult;
  relation: string;
  actions: AddFriendActions;
  isBusy: boolean;
}) {
  const { t } = useTranslation('friends');
  return (
    <View>
      <FriendsSeparator />
      <FriendsRow
        label={result.displayName}
        detail={relation}
        leading={
          <Avatar
            content={{ initial: initialOf(result.displayName) }}
            color={avatarIndexOf(result.userId)}
            size="small"
          />
        }
        onPress={result.relation === 'friend' ? () => actions.openFriend(result.userId) : undefined}
        accessibilityLabel={`${result.displayName}, ${relation}`}
        testID={`add-result-${result.userId}`}
      />
      {result.relation === 'none' ? (
        <View style={styles.resultAction}>
          <ActionButton
            variant="plain"
            fullWidth={false}
            label={t('add.send', { name: result.displayName })}
            onPress={() => actions.sendRequest(result.userId)}
            disabled={isBusy}
            testID={`add-send-${result.userId}`}
          />
        </View>
      ) : null}
      {result.relation === 'request-received' ? (
        <View style={styles.resultAction}>
          <ActionButton
            variant="plain"
            fullWidth={false}
            label={t('add.accept', { name: result.displayName })}
            onPress={() => actions.acceptRequest(result.userId)}
            disabled={isBusy}
            testID={`add-accept-${result.userId}`}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  code: { gap: spacing.xs },
  qrArea: { alignItems: 'center', paddingVertical: spacing.sm },
  qr: { width: QR_WIDTH },
  resultAction: { alignItems: 'flex-start' },
});
