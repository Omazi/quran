import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { SOCIAL_CONFIG, type PersonSearchResult, type SearchRelation } from '@/domain/social';
import { formatLongDate } from '@/features/home/format-date';
import {
  ButtonRow,
  ContentRow,
  GroupedList,
  ListRow,
  ListSection,
  Placeholder,
  Screen,
  TextFieldRow,
  radius,
} from '@/ui';

import { shownInviteCode, typedInviteCode } from './invite-code-text';
import type { AddFriendActions, AddFriendModel } from './use-friends';

/** A shown code is "ABCD EFGH": the space takes one more character. */
const SHOWN_CODE_LENGTH = SOCIAL_CONFIG.inviteCodeLength + 1;

/** The QR code takes half the width of the row: large enough for a camera at arm's length. */
const QR_SLOT_WIDTH = '50%';

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
 * The three ways to add a friend (D36), one section each, the quickest first:
 * by name, a search field above the results it filters, searching as the person types
 * (search-fields.md › Best practices; › Search as an inline field); with my code, shown and
 * shared through the system's share sheet (activity-views.md › Use the Share button); with their
 * code, a field with the keyboard of a code (text-fields.md › Best practices); with a QR code,
 * whose picture and scan are not built yet: a named placeholder and a disabled button say so
 * (SwiftUI Design, principle 4).
 */
export function AddFriendScreen({ model, actions }: AddFriendScreenProps) {
  const { t, i18n } = useTranslation('friends');
  const searchFooter =
    model.searchRefusal === null ? t('add.searchNote') : t(`refusals.${model.searchRefusal}`);
  const codeIsComplete = typedInviteCode(model.code).length === SOCIAL_CONFIG.inviteCodeLength;
  return (
    <Screen background="groupedBackground" testID="add-friend">
      <GroupedList>
        <ListSection title={t('add.searchTitle')} footer={searchFooter}>
          <TextFieldRow
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
            <ListRow label={t('add.noResults')} testID="add-no-results" />
          ) : (
            model.results.map((result) => (
              <SearchResultRows
                key={result.userId}
                result={result}
                actions={actions}
                relation={t(RELATION_KEYS[result.relation])}
                isBusy={model.isBusy}
              />
            ))
          )}
        </ListSection>
        <ListSection
          title={t('add.myCodeTitle')}
          footer={
            model.invite === null
              ? undefined
              : t('add.myCodeNote', { date: formatLongDate(model.invite.expiresOn, i18n.language) })
          }
        >
          <ListRow
            label={t('add.myCode')}
            value={model.invite === null ? '…' : shownInviteCode(model.invite.code)}
            testID="add-my-code"
          />
          <ButtonRow
            label={t('add.share')}
            onPress={() =>
              actions.shareInvite((link, code) => t('add.shareMessage', { link, code }))
            }
            variant="plain"
            disabled={model.invite === null}
            testID="add-share"
          />
        </ListSection>
        <ListSection
          title={t('add.enterTitle')}
          footer={model.codeRefusal === null ? undefined : t(`refusals.${model.codeRefusal}`)}
        >
          <TextFieldRow
            label={t('add.enterField')}
            placeholder={t('add.enterPlaceholder')}
            value={model.code}
            onChange={actions.changeCode}
            kind="inviteCode"
            maxLength={SHOWN_CODE_LENGTH}
            onSubmit={actions.submitCode}
            testID="add-code"
          />
          <ButtonRow
            label={t('add.enterSubmit')}
            onPress={actions.submitCode}
            variant="plain"
            disabled={!codeIsComplete || model.isBusy}
            testID="add-code-submit"
          />
        </ListSection>
        <ListSection title={t('add.qrTitle')} isBare>
          <ContentRow>
            {/* The picture of the QR code needs a drawing library the architect has not approved
                yet: a named slot until then (docs/specs/social.md, section 6). */}
            <Placeholder name={t('add.qrSlot')} style={styles.qr} testID="add-qr-slot" />
          </ContentRow>
        </ListSection>
        <ListSection
          footer={[t('add.qrNote'), model.isDemonstration ? t('demoNote') : undefined]
            .filter((part) => part !== undefined)
            .join('\n\n')}
        >
          {/* Scanning needs expo-camera, not installed in this lot. */}
          <ButtonRow
            label={t('add.scan')}
            onPress={() => undefined}
            variant="plain"
            disabled
            testID="add-scan"
          />
        </ListSection>
      </GroupedList>
    </Screen>
  );
}

/**
 * One person found: their name and what they are to me (rule 11: nothing else), then the action
 * that fits, as a row of its own: send a request, or accept theirs. A friend opens their page.
 */
function SearchResultRows({
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
    <Fragment>
      <ListRow
        label={result.displayName}
        value={relation}
        onPress={result.relation === 'friend' ? () => actions.openFriend(result.userId) : undefined}
        testID={`add-result-${result.userId}`}
      />
      {result.relation === 'none' ? (
        <ButtonRow
          label={t('add.send', { name: result.displayName })}
          onPress={() => actions.sendRequest(result.userId)}
          variant="plain"
          disabled={isBusy}
          testID={`add-send-${result.userId}`}
        />
      ) : null}
      {result.relation === 'request-received' ? (
        <ButtonRow
          label={t('add.accept', { name: result.displayName })}
          onPress={() => actions.acceptRequest(result.userId)}
          variant="plain"
          disabled={isBusy}
          testID={`add-accept-${result.userId}`}
        />
      ) : null}
    </Fragment>
  );
}

const styles = StyleSheet.create({
  qr: { aspectRatio: 1, alignSelf: 'center', width: QR_SLOT_WIDTH, borderRadius: radius.md },
});
