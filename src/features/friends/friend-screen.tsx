import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { HIZB_COUNT } from '@/domain/quran';
import { GARDEN_PICTURE_ASPECT_RATIO, GardenScene, HIZB_TONE } from '@/features/garden';
import {
  ButtonRow,
  ContentRow,
  Gauge,
  GroupedList,
  ListRow,
  ListSection,
  Placeholder,
  Screen,
} from '@/ui';

import { waterWords } from './friend-words';
import type { FriendPageModel } from './friends-model';
import type { ShownRefusal } from './refusal';
import { FriendsUnavailable } from './screen-states';
import type { FriendPageActions } from './use-friends';

export interface FriendScreenProps {
  model: FriendPageModel;
  refusal: ShownRefusal | null;
  actions: FriendPageActions;
}

/** Numbers in the language of the interface, with the digits the rest of the app uses. */
function formatNumber(value: number, language: string): string {
  return new Intl.NumberFormat(`${language}-u-nu-latn`).format(value);
}

/**
 * A friend's page, the visit of the validated design (docs/design/visite.png): their garden
 * from edge to edge, then what they share, in a list of the system (lists-and-tables.md ›
 * Style): hizb and water, streak, the one coloured button, "Encourager", right under them as in the
 * validated design (buttons.md › Style: one prominent button), then level, khatmas and reading
 * counters when they share their level (D23, D37). Removing and blocking come last, in red, each confirmed by an action sheet
 * (action-sheets.md › Best practices; buttons.md › Role). The title is the native bar's, with
 * the system back button (see the route).
 */
export function FriendScreen({ model, refusal, actions }: FriendScreenProps) {
  const { t, i18n } = useTranslation('friends');
  if (model.status === 'unavailable') {
    return (
      <FriendsUnavailable
        title={t('friend.unavailableTitle')}
        description={t('friend.unavailableText')}
        testID="friend-unavailable"
      />
    );
  }
  if (model.status === 'not-friend') {
    return (
      <FriendsUnavailable
        title={model.name}
        description={t('friend.notFriend', { name: model.name })}
        testID="friend-not-friend"
      />
    );
  }
  const { card, level, streakDays } = model;
  const name = card.name;
  const number = (value: number) => formatNumber(value, i18n.language);
  const confirmation = (kind: 'remove' | 'block') => ({
    title: t(`friend.${kind}Title`, { name }),
    message: t(`friend.${kind}Message`, { name }),
    confirmLabel: t(`friend.${kind}Confirm`),
    cancelLabel: t('friend.cancel'),
  });
  return (
    <Screen background="groupedBackground" testID="friend">
      <GroupedList>
        <ListSection isBare>
          <ContentRow isEdgeToEdge>
            {card.garden === null ? (
              <Placeholder
                name={t('card.hidden')}
                style={styles.hiddenGarden}
                testID="friend-garden-hidden"
              />
            ) : (
              <GardenScene state={card.garden} size="band" />
            )}
          </ContentRow>
        </ListSection>
        {card.hizbCompleted === null || card.water === null ? (
          <ListSection>
            <ListRow label={t('friend.gardenHidden', { name })} testID="friend-garden-hidden-row" />
          </ListSection>
        ) : (
          <ListSection>
            <Gauge
              value={card.hizbCompleted / HIZB_COUNT}
              label={t('friend.hizb')}
              valueLabel={t('friend.hizbValue', { count: card.hizbCompleted })}
              tone={HIZB_TONE}
              testID="friend-hizb"
            />
            <ListRow
              label={t('friend.water')}
              value={waterWords(card.water, t)}
              testID="friend-water"
            />
            {streakDays === null ? null : (
              <ListRow
                label={t('friend.streak')}
                value={t('friend.streakValue', { count: streakDays })}
                testID="friend-streak"
              />
            )}
          </ListSection>
        )}
        <ListSection
          footer={[
            refusal === null ? undefined : t(`refusals.${refusal}`),
            t('friend.encourageNote'),
          ]
            .filter((part) => part !== undefined)
            .join(' ')}
        >
          <ButtonRow
            label={model.encouragedToday ? t('friend.encouraged') : t('friend.encourage', { name })}
            onPress={actions.encourage}
            disabled={model.encouragedToday}
            testID="friend-encourage"
          />
        </ListSection>
        {level === null ? (
          <ListSection>
            <ListRow label={t('friend.levelHidden', { name })} testID="friend-level-hidden" />
          </ListSection>
        ) : (
          <>
            <ListSection>
              <ListRow
                label={t('friend.level')}
                value={t('friend.levelValue', { count: level.level })}
                testID="friend-level"
              />
              <ListRow
                label={t('friend.badges')}
                value={number(level.badgeCount)}
                testID="friend-badges"
              />
            </ListSection>
            <ListSection title={t('friend.readingTitle')} footer={t('friend.hasanatNote')}>
              <ListRow
                label={t('friend.words')}
                value={number(level.wordsRead)}
                testID="friend-words"
              />
              <ListRow
                label={t('friend.verses')}
                value={number(level.versesRead)}
                testID="friend-verses"
              />
              <ListRow
                label={t('friend.hasanat')}
                value={number(level.hasanatEstimate)}
                testID="friend-hasanat"
              />
            </ListSection>
          </>
        )}
        <ListSection footer={model.isDemonstration ? t('demoNote') : undefined}>
          <ButtonRow
            label={t('friend.remove')}
            onPress={() => actions.remove(confirmation('remove'))}
            variant="plain"
            role="destructive"
            testID="friend-remove"
          />
          <ButtonRow
            label={t('friend.block', { name })}
            onPress={() => actions.block(confirmation('block'))}
            variant="plain"
            role="destructive"
            testID="friend-block"
          />
        </ListSection>
      </GroupedList>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hiddenGarden: { aspectRatio: GARDEN_PICTURE_ASPECT_RATIO },
});
