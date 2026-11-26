import { StyleSheet, View } from 'react-native';

import { useGenderedTranslation } from '@/features/gender';
import { ContentUnavailable, ProgressIndicator, type IconSymbol } from '@/ui';

import { FriendsPage } from './friends-kit';

const FAILED_SYMBOL: IconSymbol = { ios: 'person.2', android: 'group' };

/**
 * While the data comes: the system's activity indicator, without a duration it cannot know
 * (progress-indicators.md › Best practices), on the sky of the tab's pages so that nothing
 * flashes grey before the page. With the demonstration it lasts a moment.
 */
export function FriendsLoading({ testID }: { testID?: string }) {
  const { t } = useGenderedTranslation('friends');
  return (
    <FriendsPage isBare testID={testID}>
      <View style={styles.centre}>
        <ProgressIndicator accessibilityLabel={t('loading')} />
      </View>
    </FriendsPage>
  );
}

/** Nothing to show: the system's empty state, with what happened and what to expect. */
export function FriendsUnavailable({
  title,
  description,
  testID,
}: {
  title: string;
  description: string;
  testID?: string;
}) {
  return (
    <FriendsPage isBare testID={testID}>
      <ContentUnavailable title={title} description={description} symbol={FAILED_SYMBOL} />
    </FriendsPage>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
