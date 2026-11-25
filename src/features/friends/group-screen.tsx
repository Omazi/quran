import { useTranslation } from 'react-i18next';

import type { LeaderboardPeriod } from '@/domain/social';
import {
  ButtonRow,
  GroupedList,
  ListRow,
  ListSection,
  Screen,
  SegmentedChoice,
  TextFieldRow,
} from '@/ui';

import type { GroupModel } from './friends-model';
import type { ShownRefusal } from './refusal';
import type { GroupActions } from './use-friends';

export interface GroupScreenProps {
  model: GroupModel;
  refusal: ShownRefusal | null;
  actions: GroupActions;
}

/**
 * A group: its leaderboard over the week or the month, then the friends I can add to it.
 * The period is a segmented control of two closely related choices, above what it changes
 * (segmented-controls.md › Best practices). The leaderboard is a list of text, one row per member:
 * rank and name, pages at the trailing side (lists-and-tables.md › Best practices). The footer of
 * the add section says, before anyone is added, that no consent is asked and what members see
 * (D36; writing.md: be clear). The title is the native bar's (see the route).
 */
export function GroupScreen({ model, refusal, actions }: GroupScreenProps) {
  const { t } = useTranslation('friends');
  const periods: readonly { value: LeaderboardPeriod['kind']; label: string }[] = [
    { value: 'week', label: t('group.week') },
    { value: 'month', label: t('group.month') },
  ];
  return (
    <Screen background="groupedBackground" testID="group">
      <GroupedList>
        <ListSection>
          <SegmentedChoice
            label={t('group.period')}
            options={periods}
            value={model.period}
            onChange={actions.changePeriod}
            testID="group-period"
          />
        </ListSection>
        <ListSection
          title={t('group.leaderboardTitle')}
          footer={model.period === 'week' ? t('group.weekNote') : t('group.monthNote')}
        >
          {model.leaderboard.map((line) => (
            <ListRow
              key={line.userId}
              label={t(line.isMe ? 'group.me' : 'group.rank', { rank: line.rank, name: line.name })}
              value={t('group.pages', { count: line.newPages })}
              testID={`group-line-${line.userId}`}
            />
          ))}
        </ListSection>
        <ListSection
          title={t('group.addTitle')}
          footer={[
            refusal === null ? undefined : t(`refusals.${refusal}`),
            t('group.addNote'),
            model.isDemonstration ? t('demoNote') : undefined,
          ]
            .filter((part) => part !== undefined)
            .join('\n\n')}
        >
          {model.friendsToAdd.length === 0 ? (
            <ListRow label={t('group.noOneToAdd')} testID="group-no-one-to-add" />
          ) : (
            model.friendsToAdd.map((friend) => (
              <ButtonRow
                key={friend.userId}
                label={t('group.add', { name: friend.name })}
                onPress={() => actions.addMember(friend.userId)}
                variant="plain"
                testID={`group-add-${friend.userId}`}
              />
            ))
          )}
        </ListSection>
      </GroupedList>
    </Screen>
  );
}

export interface NewGroupScreenProps {
  model: {
    readonly isDemonstration: boolean;
    readonly name: string;
    readonly refusal: ShownRefusal | null;
    readonly isBusy: boolean;
  };
  actions: { changeName(text: string): void; create(): void };
}

/**
 * A new group: one field for its name, with a hint, and one button that says what it does
 * (text-fields.md › Best practices; buttons.md › Content). The name follows the rules of a
 * display name (rule 8); a refusal is said under the field, where the person looks.
 */
export function NewGroupScreen({ model, actions }: NewGroupScreenProps) {
  const { t } = useTranslation('friends');
  return (
    <Screen background="groupedBackground" testID="new-group">
      <GroupedList>
        <ListSection
          footer={[
            model.refusal === null ? undefined : t(`refusals.${model.refusal}`),
            t('newGroup.note'),
            model.isDemonstration ? t('demoNote') : undefined,
          ]
            .filter((part) => part !== undefined)
            .join('\n\n')}
        >
          <TextFieldRow
            label={t('newGroup.nameField')}
            placeholder={t('newGroup.namePlaceholder')}
            value={model.name}
            onChange={actions.changeName}
            kind="name"
            onSubmit={actions.create}
            testID="new-group-name"
          />
        </ListSection>
        <ListSection>
          <ButtonRow
            label={t('newGroup.create')}
            onPress={actions.create}
            disabled={model.isBusy || model.name.trim() === ''}
            testID="new-group-create"
          />
        </ListSection>
      </GroupedList>
    </Screen>
  );
}
